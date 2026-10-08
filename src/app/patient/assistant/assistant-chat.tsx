"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, Bot, CalendarCheck, CalendarX2, RotateCcw, Sparkles, SquarePen } from "lucide-react";
import type { AssistantAction } from "@/lib/ai/assistant";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { cn, upperFirst } from "@/lib/utils";

type Message = { id: string; role: "user" | "assistant"; content: string; actions?: AssistantAction[] };

const SUGGESTIONS = [
  "Tengo dolor de cabeza fuerte desde hace 3 días",
  "Necesito una cita de cardiología la próxima semana por la mañana",
  "¿Cuáles son mis próximas citas?",
  "Quiero mover mi próxima cita al viernes",
];

const ACTION_META = {
  booked: { title: "Cita reservada", icon: CalendarCheck, tone: "border-brand-200 bg-brand-50 text-brand-800" },
  rescheduled: { title: "Cita reprogramada", icon: RotateCcw, tone: "border-sky-200 bg-sky-50 text-sky-800" },
  cancelled: { title: "Cita cancelada", icon: CalendarX2, tone: "border-rose-200 bg-rose-50 text-rose-800" },
} as const;

let counter = 0;
const nextId = () => `m${++counter}`;

/** Render mínimo y seguro de Markdown (negritas y listas), sin HTML arbitrario. */
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

function RichText({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={cn("my-1 space-y-1 pl-5", list.ordered ? "list-decimal" : "list-disc")}>
        {list.items.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };

  for (const line of content.split("\n")) {
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = !!numbered;
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]!);
    } else {
      flush();
      if (line.trim()) blocks.push(<p key={blocks.length}>{renderInline(line)}</p>);
    }
  }
  flush();
  return <div className="space-y-2">{blocks}</div>;
}

export function AssistantChat({ firstName, configured }: { firstName: string; configured: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setError(null);
    setInput("");
    setMessages((current) => [...current, { id: nextId(), role: "user", content: message }]);
    setPending(true);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "No se pudo contactar con el asistente.");
      setConversationId(body.conversationId);
      setMessages((current) => [...current, { id: nextId(), role: "assistant", content: body.reply, actions: body.actions }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setPending(false);
    }
  }

  function reset() {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-brand-600 text-white">
            <Bot className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-slate-900">Sofía · Asistente de citas</p>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={cn("size-1.5 rounded-full", configured ? "bg-emerald-500" : "bg-slate-300")} />
              {configured ? "En línea" : "No configurado"}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={reset} disabled={pending}>
            <SquarePen className="size-4" aria-hidden /> Nueva conversación
          </Button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-6 sm:px-6" aria-live="polite">
        {messages.length === 0 && (
          <div className="mx-auto flex max-w-lg flex-col items-center pt-6 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <Sparkles className="size-7" aria-hidden />
            </span>
            <h1 className="mt-4 text-xl font-bold text-slate-900">Hola, {firstName}. Soy Sofía.</h1>
            <p className="mt-2 text-sm text-slate-500">
              Cuéntame qué te pasa o qué cita necesitas y me encargo de buscar el especialista y el horario.
            </p>
            {!configured && (
              <Alert tone="amber" className="mt-4 text-left">
                El asistente aún no está configurado en este entorno. Mientras tanto puedes{" "}
                <Link href="/patient/book" className="font-semibold underline">
                  reservar manualmente
                </Link>
                .
              </Alert>
            )}
            <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={!configured}
                  onClick={() => send(suggestion)}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] space-y-2", message.role === "user" && "items-end")}>
              <div
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  message.role === "user"
                    ? "rounded-br-sm bg-brand-600 text-white"
                    : "rounded-bl-sm bg-slate-100 text-slate-800",
                )}
              >
                {message.role === "assistant" ? <RichText content={message.content} /> : message.content}
              </div>
              {message.actions?.map((action) => {
                const meta = ACTION_META[action.type];
                const Icon = meta.icon;
                return (
                  <div key={`${action.type}-${action.appointment.appointmentId}`} className={cn("rounded-xl border p-3 text-sm", meta.tone)}>
                    <p className="flex items-center gap-2 font-semibold">
                      <Icon className="size-4" aria-hidden /> {meta.title}
                    </p>
                    <p className="mt-1">
                      {action.appointment.doctorName} · {action.appointment.specialty}
                    </p>
                    <p>{upperFirst(action.appointment.localTime)}</p>
                    {action.type !== "cancelled" && (
                      <Link href="/patient/appointments" className="mt-1 inline-block text-xs font-semibold underline">
                        Ver mis citas
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {pending && (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3" aria-label="Sofía está escribiendo">
              <span className="typing-dot size-1.5 rounded-full bg-slate-500" />
              <span className="typing-dot size-1.5 rounded-full bg-slate-500" />
              <span className="typing-dot size-1.5 rounded-full bg-slate-500" />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 sm:px-6">
          <Alert tone="rose">{error}</Alert>
        </div>
      )}

      <form
        className="flex items-end gap-2 border-t border-slate-100 p-3 sm:p-4"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <label htmlFor="assistant-input" className="sr-only">
          Mensaje para el asistente
        </label>
        <textarea
          id="assistant-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send(input);
            }
          }}
          rows={1}
          maxLength={2000}
          disabled={!configured}
          placeholder={configured ? "Escribe tu mensaje…" : "Asistente no disponible"}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border-0 bg-slate-50 px-4 py-3 text-sm ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-brand-600 disabled:opacity-60"
        />
        <Button type="submit" className="size-11 shrink-0 rounded-xl p-0" disabled={!configured || pending || !input.trim()}>
          <ArrowUp className="size-5" aria-hidden />
          <span className="sr-only">Enviar</span>
        </Button>
      </form>
    </div>
  );
}
