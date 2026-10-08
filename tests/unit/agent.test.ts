import type { ChatCompletion, ChatCompletionCreateParamsNonStreaming, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { describe, expect, it, vi } from "vitest";
import { FALLBACK_REPLY, ToolError, runAgent, trimHistory, type AgentTool, type ChatClient } from "@/lib/ai/agent";

type ScriptedMessage = ChatCompletion["choices"][number]["message"];

function completion(message: Partial<ScriptedMessage>): ChatCompletion {
  return {
    id: "cmpl",
    object: "chat.completion",
    created: 0,
    model: "test",
    choices: [{ index: 0, finish_reason: "stop", logprobs: null, message: { role: "assistant", content: null, refusal: null, ...message } }],
  };
}

function toolCall(id: string, name: string, args: unknown) {
  return { id, type: "function" as const, function: { name, arguments: JSON.stringify(args) } };
}

function scriptedClient(responses: ChatCompletion[]) {
  const calls: ChatCompletionCreateParamsNonStreaming[] = [];
  const client: ChatClient = {
    chat: {
      completions: {
        create: async (params) => {
          calls.push(structuredClone(params));
          const next = responses.shift();
          if (!next) throw new Error("No quedan respuestas simuladas");
          return next;
        },
      },
    },
  };
  return { client, calls };
}

function tool(name: string, execute: AgentTool["execute"]): AgentTool {
  return { definition: { type: "function", function: { name, parameters: { type: "object", properties: {} } } }, execute };
}

const user = (content: string): ChatCompletionMessageParam => ({ role: "user", content });

describe("runAgent", () => {
  it("devuelve la respuesta directa cuando el modelo no usa herramientas", async () => {
    const { client, calls } = scriptedClient([completion({ content: "¡Hola! ¿En qué te ayudo?" })]);
    const result = await runAgent({ client, model: "m", system: "sys", messages: [user("hola")], tools: {} });

    expect(result.reply).toBe("¡Hola! ¿En qué te ayudo?");
    expect(result.events).toEqual([]);
    expect(calls[0]!.messages[0]).toEqual({ role: "system", content: "sys" });
    expect(result.messages.at(-1)).toEqual({ role: "assistant", content: "¡Hola! ¿En qué te ayudo?" });
  });

  it("ejecuta las herramientas pedidas y devuelve su resultado al modelo", async () => {
    const findSlots = vi.fn(async () => ({ slots: [{ startsAt: "2030-01-07T14:00:00.000Z" }] }));
    const { client, calls } = scriptedClient([
      completion({ tool_calls: [toolCall("call_1", "find_available_slots", { specialty: "cardiologia" })] }),
      completion({ content: "Tengo un hueco el lunes a las 09:00." }),
    ]);

    const result = await runAgent({
      client,
      model: "m",
      system: "sys",
      messages: [user("cita con cardiología")],
      tools: { find_available_slots: tool("find_available_slots", findSlots) },
    });

    expect(findSlots).toHaveBeenCalledWith({ specialty: "cardiologia" });
    expect(result.reply).toBe("Tengo un hueco el lunes a las 09:00.");
    expect(result.events).toEqual([
      { name: "find_available_slots", ok: true, result: { slots: [{ startsAt: "2030-01-07T14:00:00.000Z" }] } },
    ]);
    const toolMessage = calls[1]!.messages.find((m) => m.role === "tool");
    expect(toolMessage).toMatchObject({ role: "tool", tool_call_id: "call_1" });
  });

  it("convierte los errores de herramientas en mensajes para el modelo", async () => {
    const onToolError = vi.fn();
    const { client, calls } = scriptedClient([
      completion({
        tool_calls: [
          toolCall("a", "book_appointment", {}),
          toolCall("b", "explode", {}),
          toolCall("c", "does_not_exist", {}),
        ],
      }),
      completion({ content: "Ese horario ya no está libre, ¿te ofrezco otro?" }),
    ]);

    const result = await runAgent({
      client,
      model: "m",
      system: "sys",
      messages: [user("resérvala")],
      tools: {
        book_appointment: tool("book_appointment", async () => {
          throw new ToolError("Ese horario ya no está disponible.");
        }),
        explode: tool("explode", async () => {
          throw new Error("conexión perdida");
        }),
      },
      onToolError,
    });

    expect(result.events.map((e) => e.ok)).toEqual([false, false, false]);
    const toolContents = calls[1]!.messages.filter((m) => m.role === "tool").map((m) => JSON.parse(m.content as string));
    expect(toolContents[0]).toEqual({ error: "Ese horario ya no está disponible." });
    expect(toolContents[1].error).toMatch(/Error interno/);
    expect(toolContents[2].error).toMatch(/no existe/);
    expect(onToolError).toHaveBeenCalledOnce();
  });

  it("se detiene tras el máximo de pasos", async () => {
    const looping = Array.from({ length: 3 }, (_, i) => completion({ tool_calls: [toolCall(`c${i}`, "noop", {})] }));
    const { client } = scriptedClient(looping);
    const result = await runAgent({
      client,
      model: "m",
      system: "sys",
      messages: [user("hola")],
      tools: { noop: tool("noop", async () => ({ ok: true })) },
      maxSteps: 3,
    });
    expect(result.reply).toBe(FALLBACK_REPLY);
    expect(result.events).toHaveLength(3);
  });
});

describe("trimHistory", () => {
  it("recorta empezando siempre por un mensaje del usuario", () => {
    const history: ChatCompletionMessageParam[] = [
      user("1"),
      { role: "assistant", content: null, tool_calls: [toolCall("x", "t", {})] },
      { role: "tool", tool_call_id: "x", content: "{}" },
      { role: "assistant", content: "r1" },
      user("2"),
      { role: "assistant", content: "r2" },
    ];
    const trimmed = trimHistory(history, 4);
    expect(trimmed).toEqual([user("2"), { role: "assistant", content: "r2" }]);
    expect(trimHistory(history, 10)).toBe(history);
  });
});
