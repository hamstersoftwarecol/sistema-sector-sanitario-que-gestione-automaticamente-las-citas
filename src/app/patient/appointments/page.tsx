import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays } from "lucide-react";
import { PatientAppointmentCard } from "@/components/patient-appointment-card";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Alert, EmptyState, PageHeader, Skeleton } from "@/components/ui/feedback";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ACTIVE_STATUSES, appointmentInclude } from "@/lib/scheduling/booking";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mis citas" };

export default function PatientAppointmentsPage({ searchParams }: PageProps<"/patient/appointments">) {
  return (
    <>
      <PageHeader
        title="Mis citas"
        description="Consulta, cancela o reprograma tus citas. Para reprogramar, pídeselo al asistente."
        action={<ButtonLink href="/patient/book">Nueva cita</ButtonLink>}
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <AppointmentsList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function AppointmentsList({ searchParams }: { searchParams: PageProps<"/patient/appointments">["searchParams"] }) {
  const user = await requireUser("PATIENT");
  const { view, booked } = await searchParams;
  const showPast = view === "past";
  const now = new Date();

  const appointments = await db.appointment.findMany({
    where: showPast
      ? { patientId: user.id, OR: [{ startsAt: { lt: now } }, { status: { notIn: ACTIVE_STATUSES } }] }
      : { patientId: user.id, status: { in: ACTIVE_STATUSES }, startsAt: { gte: now } },
    include: appointmentInclude,
    orderBy: { startsAt: showPast ? "desc" : "asc" },
    take: 50,
  });

  const tabs = [
    { href: "/patient/appointments", label: "Próximas", active: !showPast },
    { href: "/patient/appointments?view=past", label: "Historial", active: showPast },
  ];

  return (
    <div className="space-y-4">
      {booked && <Alert title="¡Cita reservada!">Te esperamos. Puedes cancelarla desde aquí si te surge un imprevisto.</Alert>}
      <div className="inline-flex rounded-lg bg-slate-100 p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium",
              tab.active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <Card>
        <CardBody className="space-y-3">
          {appointments.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="size-6" />}
              title={showPast ? "Aún no hay historial" : "No tienes citas próximas"}
              description={showPast ? "Aquí verás tus citas pasadas y canceladas." : "Reserva una cita en menos de un minuto."}
            />
          ) : (
            appointments.map((appointment) => <PatientAppointmentCard key={appointment.id} appointment={appointment} now={now} />)
          )}
        </CardBody>
      </Card>
    </div>
  );
}
