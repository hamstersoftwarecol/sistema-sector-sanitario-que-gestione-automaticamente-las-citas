import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionFunctionTool,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";

/** Error esperado de una herramienta: su mensaje se le muestra al modelo tal cual. */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

export type AgentTool = {
  definition: ChatCompletionFunctionTool;
  execute: (args: unknown) => Promise<unknown>;
};

export type ChatClient = {
  chat: { completions: { create: (params: ChatCompletionCreateParamsNonStreaming) => Promise<ChatCompletion> } };
};

export type ToolEvent = { name: string; ok: boolean; result: unknown };

export type AgentResult = {
  reply: string;
  events: ToolEvent[];
  /** Historial completo (sin el mensaje de sistema) para persistirlo. */
  messages: ChatCompletionMessageParam[];
};

export const FALLBACK_REPLY =
  "Lo siento, no pude completar tu solicitud en este momento. ¿Puedes intentarlo de nuevo con un poco más de detalle?";

/**
 * Bucle del agente: el modelo decide qué herramientas llamar, las ejecutamos en el servidor
 * con la identidad del paciente y le devolvemos los resultados hasta que responde en texto.
 */
export async function runAgent(options: {
  client: ChatClient;
  model: string;
  system: string;
  messages: ChatCompletionMessageParam[];
  tools: Record<string, AgentTool>;
  maxSteps?: number;
  onToolError?: (name: string, error: unknown) => void;
}): Promise<AgentResult> {
  const { client, model, system, tools, maxSteps = 8 } = options;
  const history: ChatCompletionMessageParam[] = [...options.messages];
  const events: ToolEvent[] = [];
  const definitions = Object.values(tools).map((tool) => tool.definition);

  for (let step = 0; step < maxSteps; step++) {
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "system", content: system }, ...history],
      tools: definitions,
      tool_choice: "auto",
    });

    const message = completion.choices[0]?.message;
    if (!message) break;

    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0) {
      const reply = message.content?.trim() || FALLBACK_REPLY;
      history.push({ role: "assistant", content: reply });
      return { reply, events, messages: history };
    }

    history.push({ role: "assistant", content: message.content ?? null, tool_calls: toolCalls });

    for (const call of toolCalls) {
      if (call.type !== "function") {
        history.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "Tipo de herramienta no soportado." }) });
        continue;
      }
      const tool = tools[call.function.name];
      let result: unknown;
      let ok = true;

      if (!tool) {
        ok = false;
        result = { error: `La herramienta «${call.function.name}» no existe.` };
      } else {
        try {
          const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
          result = await tool.execute(args);
        } catch (error) {
          ok = false;
          if (error instanceof ToolError) {
            result = { error: error.message };
          } else if (error instanceof SyntaxError) {
            result = { error: "Los argumentos no son JSON válido." };
          } else {
            options.onToolError?.(call.function.name, error);
            result = { error: "Error interno al ejecutar la herramienta. Inténtalo de nuevo." };
          }
        }
      }

      events.push({ name: call.function.name, ok, result });
      history.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  history.push({ role: "assistant", content: FALLBACK_REPLY });
  return { reply: FALLBACK_REPLY, events, messages: history };
}

/**
 * Recorta el historial a los últimos `max` mensajes empezando siempre en un mensaje del usuario,
 * para no dejar respuestas de herramientas huérfanas de su llamada.
 */
export function trimHistory(messages: ChatCompletionMessageParam[], max = 40): ChatCompletionMessageParam[] {
  if (messages.length <= max) return messages;
  const tail = messages.slice(-max);
  const firstUser = tail.findIndex((message) => message.role === "user");
  return firstUser === -1 ? [] : tail.slice(firstUser);
}
