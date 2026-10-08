import { CalendarClock, Stethoscope } from "lucide-react";
import { cancelAppointmentAction } from "@/app/patient/actions";
import type { AppointmentWithRelations } from "@/lib/scheduling/booking";
import { formatDate, formatTime } from "@/lib/scheduling/time";
import { upperFirst } from "@/lib/utils";
import { CancelAppointmentButton } from "./cancel-appointment-button";
import { SourceBadge, StatusBadge } from "./status-badge";

export function PatientAppointmentCard({ appointment, now }: { appointment: AppointmentWithRelations; now: Date }) {
  const tz = appointment.doctor.timezone;
  const cancellable = ["PENDING", "CONFIRMED"].includes(appointment.status) && appointment.startsAt > now;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
      <div className="flex w-full items-center gap-4 sm:w-auto">
        <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <span className="text-lg leading-none font-bold">
            {new Intl.DateTimeFormat("es-CO", { timeZone: tz, day: "numeric" }).format(appointment.startsAt)}
          </span>
          <span className="text-[11px] font-semibold uppercase">
            {new Intl.DateTimeFormat("es-CO", { timeZone: tz, month: "short" }).format(appointment.startsAt).replace(".", "")}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{appointment.doctor.user.name}</p>
          <p className="flex items-center gap-1.5 text-sm text-slate-500">
            <Stethoscope className="size-3.5" aria-hidden /> {appointment.doctor.specialty.name}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-700">
            <CalendarClock className="size-3.5" aria-hidden />
            <span>{upperFirst(formatDate(appointment.startsAt, tz))}</span> · {formatTime(appointment.startsAt, tz)}
          </p>
        </div>
      </div>
      <div className="min-w-0 flex-1 text-sm text-slate-600">
        <p className="line-clamp-2">
          <span className="font-medium text-slate-700">Motivo:</span> {appointment.reason}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <StatusBadge status={appointment.status} />
          <SourceBadge source={appointment.source} />
        </div>
      </div>
      {cancellable && <CancelAppointmentButton appointmentId={appointment.id} action={cancelAppointmentAction} />}
    </div>
  );
}
