import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { runSchedulingAssistant } from "@/lib/ai/assistant";
import { isAiConfigured } from "@/lib/ai/openai";
import { consumeAiQuota } from "@/lib/ai/usage";

export const maxDuration = 60;

const requestSchema = z.object({
  conversationId: z.string().max(40).nullish(),
  message: z.string().trim().min(1, "Escribe un mensaje.").max(2000, "El mensaje es demasiado largo."),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Inicia sesión para usar el asistente." }, { status: 401 });
  if (user.role !== "PATIENT") return Response.json({ error: "El asistente es solo para pacientes." }, { status: 403 });
  if (!isAiConfigured()) {
    return Response.json(
      { error: "El asistente de IA no está configurado todavía (falta OPENAI_API_KEY). Puedes reservar manualmente." },
      { status: 503 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Solicitud inválida." }, { status: 400 });
  }

  const quota = await consumeAiQuota(user.id);
  if (!quota.allowed) {
    return Response.json(
      { error: "Has alcanzado el límite diario de mensajes con el asistente. Puedes seguir reservando manualmente." },
      { status: 429 },
    );
  }

  try {
    const result = await runSchedulingAssistant({
      user,
      conversationId: parsed.data.conversationId ?? undefined,
      message: parsed.data.message,
    });
    return Response.json(result);
  } catch (error) {
    console.error("[ai] error en el asistente", error);
    return Response.json(
      { error: "El asistente no está disponible en este momento. Inténtalo de nuevo en unos minutos." },
      { status: 502 },
    );
  }
}
