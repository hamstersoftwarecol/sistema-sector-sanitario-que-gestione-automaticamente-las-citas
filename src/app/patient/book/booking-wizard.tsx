"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { CalendarX2, Clock, LoaderCircle, Stethoscope } from "lucide-react";
import type { SlotsResponse } from "@/app/api/slots/route";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/form";
import { formatDateKey } from "@/lib/scheduling/time";
import { cn, initials, upperFirst } from "@/lib/utils";
import { bookAppointmentAction } from "../actions";

export type BookingDoctor = {
  id: string;
  name: string;
  bio: string | null;
  specialtyId: string;
  slotDurationMinutes: number;
};

type SlotsState =
  | { status: "idle" }
  | { status: "loading"; doctorId: string }
  | { status: "error"; doctorId: string; message: string }
  | { status: "ready"; doctorId: string; data: SlotsResponse };

export function BookingWizard({
  specialties,
  doctors,
}: {
  specialties: { id: string; name: string }[];
  doctors: BookingDoctor[];
}) {
  const [specialtyId, setSpecialtyId] = useState(specialties[0]?.id ?? "");
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotsState>({ status: "idle" });
  const [day, setDay] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [state, action] = useActionState(bookAppointmentAction, undefined);

  const specialtyDoctors = useMemo(() => doctors.filter((d) => d.specialtyId === specialtyId), [doctors, specialtyId]);
  const doctor = doctors.find((d) => d.id === doctorId) ?? null;

  useEffect(() => {
    if (!doctorId) return;
    const controller = new AbortController();
    fetch(`/api/slots?doctorId=${encodeURIComponent(doctorId)}&days=14`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No se pudo cargar la disponibilidad.");
        const data = body as SlotsResponse;
        setSlots({ status: "ready", doctorId, data });
        setDay(data.days.find((d) => d.slots.length > 0)?.date ?? null);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setSlots({ status: "error", doctorId, message: error.message });
      });
    return () => controller.abort();
  }, [doctorId]);

  function selectDoctor(id: string) {
    setDoctorId(id);
    setSlots({ status: "loading", doctorId: id });
    setDay(null);
    setStartsAt(null);
  }

  const daySlots = slots.status === "ready" ? (slots.data.days.find((d) => d.date === day)?.slots ?? []) : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Card className="min-w-0">
        <CardHeader title="1. Especialidad y profesional" />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {specialties.map((specialty) => (
              <button
                key={specialty.id}
                type="button"
                onClick={() => {
                  setSpecialtyId(specialty.id);
                  setDoctorId(null);
                  setSlots({ status: "idle" });
                  setStartsAt(null);
                }}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors",
                  specialty.id === specialtyId
                    ? "bg-brand-600 text-white ring-brand-600"
                    : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50",
                )}
              >
                {specialty.name}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {specialtyDoctors.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => selectDoctor(d.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                  d.id === doctorId ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-slate-200 hover:border-slate-300",
                )}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800">
                  {initials(d.name)}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-slate-900">{d.name}</span>
                  {d.bio && <span className="line-clamp-2 block text-sm text-slate-500">{d.bio}</span>}
                  <span className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="size-3" aria-hidden /> Consultas de {d.slotDurationMinutes} min
                  </span>
                </span>
              </button>
            ))}
            {specialtyDoctors.length === 0 && (
              <p className="text-sm text-slate-500">No hay profesionales disponibles en esta especialidad.</p>
            )}
          </div>
        </CardBody>
      </Card>

      <Card className="min-w-0">
        <CardHeader
          title="2. Fecha y hora"
          description={
            slots.status === "ready" ? `Horarios en zona horaria ${slots.data.timezone.replace("_", " ")}.` : undefined
          }
        />
        <CardBody className="space-y-5">
          {slots.status === "idle" && (
            <EmptyState icon={<Stethoscope className="size-6" />} title="Elige un profesional" description="Te mostraremos sus próximos huecos libres." />
          )}
          {slots.status === "loading" && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <LoaderCircle className="size-4 animate-spin" aria-hidden /> Buscando disponibilidad…
            </div>
          )}
          {slots.status === "error" && <Alert tone="rose">{slots.message}</Alert>}
          {slots.status === "ready" && (
            <>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {slots.data.days.map((d) => (
                  <button
                    key={d.date}
                    type="button"
                    disabled={d.slots.length === 0}
                    onClick={() => {
                      setDay(d.date);
                      setStartsAt(null);
                    }}
                    className={cn(
                      "flex min-w-[76px] flex-col items-center rounded-xl border px-3 py-2 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      d.date === day ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 hover:border-slate-300",
                    )}
                  >
                    <span className="text-xs">{upperFirst(formatDateKey(d.date, "short").split(",")[0]!)}</span>
                    <span className="text-lg font-bold">{Number(d.date.slice(8))}</span>
                    <span className={cn("text-[11px]", d.date === day ? "text-brand-100" : "text-slate-500")}>
                      {d.slots.length} libres
                    </span>
                  </button>
                ))}
              </div>
              {day ? (
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">{upperFirst(formatDateKey(day))}</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                    {daySlots.map((slot) => (
                      <button
                        key={slot.startsAt}
                        type="button"
                        onClick={() => setStartsAt(slot.startsAt)}
                        className={cn(
                          "rounded-lg border px-2 py-2 text-sm font-semibold tabular-nums transition-colors",
                          slot.startsAt === startsAt
                            ? "border-brand-600 bg-brand-600 text-white"
                            : "border-slate-200 text-slate-700 hover:border-brand-400 hover:text-brand-700",
                        )}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<CalendarX2 className="size-6" />}
                  title="Sin huecos en las próximas dos semanas"
                  description="Prueba con otro profesional o pídele al asistente que te avise de alternativas."
                />
              )}
            </>
          )}

          {doctor && startsAt && (
            <form action={action} className="space-y-4 border-t border-slate-100 pt-5">
              <h3 className="font-semibold text-slate-900">3. Confirma tu cita</h3>
              {state?.error && <Alert tone="rose">{state.error}</Alert>}
              <input type="hidden" name="doctorId" value={doctor.id} />
              <input type="hidden" name="startsAt" value={startsAt} />
              <Field
                label="Motivo de la consulta"
                htmlFor="reason"
                error={state?.fieldErrors?.reason}
                hint="Ayuda al profesional a preparar tu visita."
              >
                <Textarea
                  id="reason"
                  name="reason"
                  required
                  maxLength={500}
                  defaultValue={state?.values?.reason}
                  placeholder="Ej.: dolor en la rodilla derecha desde hace dos semanas"
                />
              </Field>
              <SubmitButton className="w-full" size="lg" pendingText="Reservando…">
                Reservar con {doctor.name}
              </SubmitButton>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
