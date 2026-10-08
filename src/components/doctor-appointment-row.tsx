import { Mail, Phone, Sparkles } from "lucide-react";
import type { AppointmentWithRelations } from "@/lib/scheduling/booking";
import { formatDate, formatTime } from "@/lib/scheduling/time";
import { upperFirst } from "@/lib/utils";
import { DoctorAppointmentActions, DoctorNotesForm } from "./doctor-appointment-actions";
import { SourceBadge, StatusBadge } from "./status-badge";

export function DoctorAppointmentRow({
  appointment,
  now,
  showDate = false,
}: {
  appointment: AppointmentWithRelations;
  now: Date;
  showDate?: boolean;
}) {
  const tz = appointment.doctor.timezone;
  const active = appointment.status === "PENDING" || appointment.status === "CONFIRMED";
  const started = appointment.startsAt <= now;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="w-28 shrink-0">
          <p className="text-lg font-bold tabular-nums text-slate-900">{formatTime(appointment.startsAt, tz)}</p>
          <p className="text-xs text-slate-500 tabular-nums">hasta {formatTime(appointment.endsAt, tz)}</p>
          {showDate && <p className="mt-1 text-xs font-medium text-slate-600">{upperFirst(formatDate(appointment.startsAt, tz, "short"))}</p>}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">{appointment.patient.name}</p>
            <StatusBadge status={appointment.status} />
            <SourceBadge source={appointment.source} />
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Mail className="size-3" aria-hidden /> {appointment.patient.email}
            </span>
            {appointment.patient.phone && (
              <span className="flex items-center gap-1">
                <Phone className="size-3" aria-hidden /> {appointment.patient.phone}
              </span>
            )}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium">Motivo:</span> {appointment.reason}
          </p>
          {appointment.aiSummary && (
            <details className="group rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium">
                <Sparkles className="size-3.5" aria-hidden /> Resumen pre-consulta (IA)
              </summary>
              <p className="mt-2 whitespace-pre-line">{appointment.aiSummary}</p>
            </details>
          )}
          {appointment.cancellationReason && appointment.status === "CANCELLED" && (
            <p className="text-xs text-rose-600">{appointment.cancellationReason}</p>
          )}
          {appointment.status !== "CANCELLED" && (
            <details className="text-sm">
              <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
                {appointment.doctorNotes ? "Ver notas" : "Añadir notas"}
              </summary>
              <div className="mt-2">
                <DoctorNotesForm appointmentId={appointment.id} notes={appointment.doctorNotes} />
              </div>
            </details>
          )}
        </div>
        <DoctorAppointmentActions
          appointmentId={appointment.id}
          canConfirm={appointment.status === "PENDING" && !started}
          canClose={active && started}
          canCancel={active && !started}
        />
      </div>
    </div>
  );
}
