import "server-only";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_TIMEZONE } from "@/lib/scheduling/time";
import { runAgent, trimHistory } from "./agent";
import { aiModel, getOpenAI } from "./openai";
import { buildSystemPrompt } from "./prompt";
import { createSchedulingTools, type AppointmentSummary } from "./tools";

export type AssistantAction = {
  type: "booked" | "cancelled" | "rescheduled";
  appointment: AppointmentSummary;
};

const ACTION_BY_TOOL: Record<string, AssistantAction["type"]> = {
  book_appointment: "booked",
  cancel_appointment: "cancelled",
  reschedule_appointment: "rescheduled",
};

export function appTimeZone() {
  return process.env.APP_TIMEZONE || DEFAULT_TIMEZONE;
}

export async function runSchedulingAssistant(input: {
  user: { id: string; name: string };
  conversationId?: string;
  message: string;
}) {
  const now = new Date();
  const timeZone = appTimeZone();

  const conversation = input.conversationId
    ? await db.aiConversation.findFirst({ where: { id: input.conversationId, userId: input.user.id } })
    : null;
  const previous = (conversation?.messages ?? []) as unknown as ChatCompletionMessageParam[];

  const result = await runAgent({
    client: getOpenAI(),
    model: aiModel(),
    system: buildSystemPrompt({ patientName: input.user.name, now, timeZone }),
    messages: trimHistory([...previous, { role: "user", content: input.message }]),
    tools: createSchedulingTools({ patientId: input.user.id, now, timeZone }),
    onToolError: (name, error) => console.error(`[ai] fallo en la herramienta ${name}`, error),
  });

  const messages = result.messages as unknown as Prisma.InputJsonValue;
  const saved = conversation
    ? await db.aiConversation.update({ where: { id: conversation.id }, data: { messages } })
    : await db.aiConversation.create({ data: { userId: input.user.id, messages } });

  const actions: AssistantAction[] = result.events.flatMap((event) => {
    const type = ACTION_BY_TOOL[event.name];
    const appointment = (event.result as { appointment?: AppointmentSummary } | null)?.appointment;
    return event.ok && type && appointment ? [{ type, appointment }] : [];
  });

  return { conversationId: saved.id, reply: result.reply, actions };
}
