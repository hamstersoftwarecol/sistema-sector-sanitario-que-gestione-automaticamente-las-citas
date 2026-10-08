import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarCheck, CalendarX2, RotateCcw, Siren, Stethoscope } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { isAiConfigured } from "@/lib/ai/openai";
import { requireUser } from "@/lib/auth";
import { AssistantChat } from "./assistant-chat";

export const metadata: Metadata = { title: "Asistente IA" };

const CAPABILITIES = [
  { icon: Stethoscope, text: "Te orienta sobre qué especialista consultar según lo que sientes." },
  { icon: CalendarCheck, text: "Busca huecos reales y reserva la cita por ti." },
  { icon: RotateCcw, text: "Reprograma tus citas a otro horario libre." },
  { icon: CalendarX2, text: "Cancela citas cuando no puedas asistir." },
];

export default function AssistantPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Suspense fallback={<Skeleton className="h-[640px] w-full rounded-2xl" />}>
        <ChatLoader />
      </Suspense>
      <aside className="space-y-4">
        <Card>
          <CardBody>
            <h2 className="font-semibold text-slate-900">¿Qué puede hacer Sofía?</h2>
            <ul className="mt-3 space-y-3">
              {CAPABILITIES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-3 text-sm text-slate-600">
                  <Icon className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Alert tone="rose" title="¿Es una emergencia?">
          <p className="flex gap-2">
            <Siren className="mt-0.5 size-4 shrink-0" aria-hidden />
            No uses el asistente. Llama a la línea de emergencias (123 en Colombia, 911 en México y EE. UU.) o acude a urgencias.
          </p>
        </Alert>
        <p className="px-1 text-xs text-slate-500">
          Sofía no realiza diagnósticos médicos. La información que compartas se usa solo para gestionar tus citas y se
          comparte con el profesional que te atenderá.
        </p>
      </aside>
    </div>
  );
}

async function ChatLoader() {
  const user = await requireUser("PATIENT");
  return <AssistantChat firstName={user.name.split(" ")[0] ?? user.name} configured={isAiConfigured()} />;
}
