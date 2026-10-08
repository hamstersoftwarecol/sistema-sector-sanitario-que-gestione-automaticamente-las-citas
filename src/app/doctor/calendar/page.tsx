import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Bot, ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, Skeleton } from "@/components/ui/feedback";
import { requireDoctor } from "@/lib/auth";
import { STATUS_LABEL } from "@/lib/appointments";
import { db } from "@/lib/db";
import {
  addDaysToKey,
  formatDateKey,
  formatTime,
  isDateKey,
  minutesToTime,
  startOfWeekKey,
  toDateKey,
  zonedDateTime,
} from "@/lib/scheduling/time";
import { cn, upperFirst } from "@/lib/utils";

export const metadata: Metadata = { title: "Agenda semanal" };

const STATUS_STYLE = {
  PENDING: "border-amber-300 bg-amber-50 text-amber-900",
  CONFIRMED: "border-brand-300 bg-brand-50 text-brand-900",
  COMPLETED: "border-slate-200 bg-slate-50 text-slate-600",
  NO_SHOW: "border-violet-200 bg-violet-50 text-violet-800",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-700 line-through",
} as const;

export default function CalendarPage({ searchParams }: PageProps<"/doctor/calendar">) {
  return (
    <>
      <PageHeader title="Agenda semanal" description="Todas tus citas de la semana de un vistazo." />
      <Suspense fallback={<Skeleton className="h-[560px] w-full rounded-2xl" />}>
        <WeekView searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function WeekView({ searchParams }: { searchParams: PageProps<"/doctor/calendar">["searchParams"] }) {
  const doctor = await requireDoctor();
  const { week } = await searchParams;
  const profile = await db.doctorProfile.findUniqueOrThrow({
    where: { id: doctor.doctorProfileId },
    include: { availability: true },
  });
  const tz = profile.timezone;
  const today = toDateKey(new Date(), tz);
  const weekStart = startOfWeekKey(typeof week === "string" && isDateKey(week) ? week : today);
  const days = Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i));
  const rangeStart = zonedDateTime(weekStart, 0, tz);
  const rangeEnd = zonedDateTime(addDaysToKey(weekStart, 7), 0, tz);

  const [appointments, timeOff] = await Promise.all([
    db.appointment.findMany({
      where: { doctorId: profile.id, startsAt: { gte: rangeStart, lt: rangeEnd } },
      include: { patient: { select: { name: true } } },
      orderBy: { startsAt: "asc" },
    }),
    db.timeOff.findMany({ where: { doctorId: profile.id, startsAt: { lt: rangeEnd }, endsAt: { gt: rangeStart } } }),
  ]);

  const byDay = new Map(days.map((day) => [day, [] as typeof appointments]));
  for (const appointment of appointments) byDay.get(toDateKey(appointment.startsAt, tz))?.push(appointment);

  const active = appointments.filter((a) => a.status !== "CANCELLED").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/doctor/calendar?week=${addDaysToKey(weekStart, -7)}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            <ChevronLeft className="size-4" aria-hidden />
            <span className="sr-only">Semana anterior</span>
          </Link>
          <Link href="/doctor/calendar" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Hoy
          </Link>
          <Link href={`/doctor/calendar?week=${addDaysToKey(weekStart, 7)}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            <ChevronRight className="size-4" aria-hidden />
            <span className="sr-only">Semana siguiente</span>
          </Link>
          <p className="ml-2 text-sm font-semibold text-slate-700">
            {upperFirst(formatDateKey(weekStart, "short"))} – {formatDateKey(days[6]!, "short")}
          </p>
        </div>
        <p className="text-sm text-slate-500">
          {active === 1 ? "1 cita activa" : `${active} citas activas`} esta semana
        </p>
      </div>

      <Card className="overflow-x-auto">
        <div className="grid min-w-[900px] grid-cols-7 divide-x divide-slate-100">
          {days.map((day) => {
            const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
            const rules = profile.availability.filter((rule) => rule.dayOfWeek === dow).sort((a, b) => a.startMinute - b.startMinute);
            const dayStart = zonedDateTime(day, 0, tz);
            const dayEnd = zonedDateTime(addDaysToKey(day, 1), 0, tz);
            const blocked = timeOff.some((off) => off.startsAt < dayEnd && off.endsAt > dayStart);
            const items = byDay.get(day) ?? [];
            return (
              <div key={day} className={cn("min-h-[480px]", blocked && "bg-slate-50")}>
                <div className={cn("border-b border-slate-100 px-3 py-3", day === today && "bg-brand-50")}>
                  <p className={cn("text-xs font-semibold uppercase", day === today ? "text-brand-700" : "text-slate-500")}>
                    {formatDateKey(day, "short").split(",")[0]}
                  </p>
                  <p className={cn("text-xl font-bold", day === today ? "text-brand-700" : "text-slate-900")}>{Number(day.slice(8))}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {blocked
                      ? "Bloqueado"
                      : rules.length
                        ? rules.map((rule) => `${minutesToTime(rule.startMinute)}–${minutesToTime(rule.endMinute)}`).join(" · ")
                        : "Sin atención"}
                  </p>
                </div>
                <div className="space-y-2 p-2">
                  {items.map((appointment) => (
                    <div
                      key={appointment.id}
                      className={cn("rounded-lg border px-2 py-1.5 text-xs", STATUS_STYLE[appointment.status])}
                      title={`${STATUS_LABEL[appointment.status]} · ${appointment.reason}`}
                    >
                      <p className="flex items-center justify-between font-semibold tabular-nums">
                        {formatTime(appointment.startsAt, tz)}
                        {appointment.source === "AI_ASSISTANT" && <Bot className="size-3" aria-label="Reservada por IA" />}
                      </p>
                      <p className="truncate">{appointment.patient.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        {(["CONFIRMED", "PENDING", "COMPLETED", "NO_SHOW", "CANCELLED"] as const).map((status) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded border", STATUS_STYLE[status])} /> {STATUS_LABEL[status]}
          </span>
        ))}
      </div>
    </div>
  );
}
