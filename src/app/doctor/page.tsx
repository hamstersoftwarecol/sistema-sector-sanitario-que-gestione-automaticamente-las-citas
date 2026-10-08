import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Bot, CalendarCheck, CalendarDays, CalendarRange, Hourglass } from "lucide-react";
import { DoctorAppointmentRow } from "@/components/doctor-appointment-row";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, Badge, EmptyState, PageHeader, Skeleton, StatCard } from "@/components/ui/feedback";
import { requireDoctor } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolvePlan } from "@/lib/plans";
import { ACTIVE_STATUSES, appointmentInclude } from "@/lib/scheduling/booking";
import { addDaysToKey, formatDateKey, monthRangeKeys, toDateKey, zonedDateTime } from "@/lib/scheduling/time";
import { upperFirst } from "@/lib/utils";

export const metadata: Metadata = { title: "Resumen" };

export default function DoctorHomePage({ searchParams }: PageProps<"/doctor">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DoctorHome searchParams={searchParams} />
    </Suspense>
  );
}

async function DoctorHome({ searchParams }: { searchParams: PageProps<"/doctor">["searchParams"] }) {
  const doctor = await requireDoctor();
  const { welcome } = await searchParams;
  const profile = await db.doctorProfile.findUniqueOrThrow({
    where: { id: doctor.doctorProfileId },
    include: { subscription: true, specialty: true },
  });

  const tz = profile.timezone;
  const now = new Date();
  const today = toDateKey(now, tz);
  const dayStart = zonedDateTime(today, 0, tz);
  const dayEnd = zonedDateTime(addDaysToKey(today, 1), 0, tz);
  const weekEnd = zonedDateTime(addDaysToKey(today, 7), 0, tz);
  const month = monthRangeKeys(today);
  const monthRange = { gte: zonedDateTime(month.first, 0, tz), lt: zonedDateTime(month.next, 0, tz) };
  const notCancelled = { not: "CANCELLED" as const };

  const [todayAppointments, nextWeekCount, monthCount, monthAiCount, pending] = await Promise.all([
    db.appointment.findMany({
      where: { doctorId: profile.id, status: notCancelled, startsAt: { gte: dayStart, lt: dayEnd } },
      include: appointmentInclude,
      orderBy: { startsAt: "asc" },
    }),
    db.appointment.count({ where: { doctorId: profile.id, status: { in: ACTIVE_STATUSES }, startsAt: { gte: now, lt: weekEnd } } }),
    db.appointment.count({ where: { doctorId: profile.id, status: notCancelled, startsAt: monthRange } }),
    db.appointment.count({ where: { doctorId: profile.id, status: notCancelled, startsAt: monthRange, source: "AI_ASSISTANT" } }),
    db.appointment.findMany({
      where: { doctorId: profile.id, status: "PENDING", startsAt: { gte: now } },
      include: appointmentInclude,
      orderBy: { startsAt: "asc" },
      take: 5,
    }),
  ]);

  const plan = resolvePlan(profile.subscription);
  const limit = plan.monthlyAppointmentLimit;
  const usage = limit ? Math.min(100, Math.round((monthCount / limit) * 100)) : 0;
  const aiShare = monthCount ? Math.round((monthAiCount / monthCount) * 100) : 0;

  return (
    <>
      <PageHeader
        title={`Hola, ${doctor.name}`}
        description={`${upperFirst(formatDateKey(today))} · ${profile.specialty.name}`}
        action={<ButtonLink href="/doctor/calendar" variant="secondary">Ver agenda semanal</ButtonLink>}
      />

      {welcome && (
        <Alert title="¡Bienvenido a MediCita IA!" className="mb-6">
          Creamos un horario inicial de lunes a viernes (08:00–12:00 y 14:00–18:00). Ajústalo en{" "}
          <Link href="/doctor/availability" className="font-semibold underline">
            Disponibilidad
          </Link>{" "}
          y los pacientes podrán reservar contigo de inmediato.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Citas hoy" value={todayAppointments.length} icon={<CalendarCheck className="size-5" />} />
        <StatCard label="Próximos 7 días" value={nextWeekCount} icon={<CalendarRange className="size-5" />} />
        <StatCard
          label="Este mes"
          value={limit ? `${monthCount}/${limit}` : monthCount}
          hint={limit ? `${usage}% del límite de tu plan ${plan.name}` : `Plan ${plan.name}: citas ilimitadas`}
          icon={<CalendarDays className="size-5" />}
        />
        <StatCard label="Reservadas por IA" value={`${aiShare}%`} hint={`${monthAiCount} citas este mes`} icon={<Bot className="size-5" />} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title="Agenda de hoy" description={`${todayAppointments.length} citas programadas`} />
          <CardBody className="space-y-3">
            {todayAppointments.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="size-6" />}
                title="Hoy no tienes citas"
                description="Cuando un paciente reserve, aparecerá aquí al instante."
              />
            ) : (
              todayAppointments.map((appointment) => <DoctorAppointmentRow key={appointment.id} appointment={appointment} now={now} />)
            )}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Pendientes de confirmar" action={<Badge tone="amber">{pending.length}</Badge>} />
            <CardBody className="space-y-3">
              {pending.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <Hourglass className="size-4" aria-hidden />
                  {profile.autoConfirm ? "Tus citas se confirman automáticamente." : "No hay solicitudes pendientes."}
                </p>
              ) : (
                pending.map((appointment) => (
                  <DoctorAppointmentRow key={appointment.id} appointment={appointment} now={now} showDate />
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={`Plan ${plan.name}`} description={plan.description} />
            <CardBody className="space-y-4">
              {limit ? (
                <div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Citas este mes</span>
                    <span>
                      {monthCount} de {limit}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={usage >= 90 ? "h-full bg-rose-500" : "h-full bg-brand-500"} style={{ width: `${usage}%` }} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-600">Citas ilimitadas.</p>
              )}
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <Bot className="size-4 text-brand-600" aria-hidden />
                {plan.aiBooking ? "Reservas con asistente de IA activas." : "Reservas por IA no incluidas en tu plan."}
              </p>
              {plan.id === "FREE" && (
                <ButtonLink href="/doctor/billing" className="w-full">
                  Mejorar plan <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}
