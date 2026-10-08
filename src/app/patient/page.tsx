import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Bot, CalendarDays, CalendarPlus, Sparkles } from "lucide-react";
import { PatientAppointmentCard } from "@/components/patient-appointment-card";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ACTIVE_STATUSES, appointmentInclude } from "@/lib/scheduling/booking";

export const metadata: Metadata = { title: "Inicio" };

export default function PatientHomePage({ searchParams }: PageProps<"/patient">) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <PatientHome searchParams={searchParams} />
    </Suspense>
  );
}

async function PatientHome({ searchParams }: { searchParams: PageProps<"/patient">["searchParams"] }) {
  const user = await requireUser("PATIENT");
  const { welcome } = await searchParams;
  const now = new Date();
  const upcoming = await db.appointment.findMany({
    where: { patientId: user.id, status: { in: ACTIVE_STATUSES }, startsAt: { gte: now } },
    include: appointmentInclude,
    orderBy: { startsAt: "asc" },
    take: 4,
  });
  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-6">
      {welcome && (
        <Alert tone="teal" title="¡Tu cuenta está lista!">
          Prueba a contarle al asistente qué te pasa: buscará el especialista adecuado y te reservará la cita.
        </Alert>
      )}

      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-sm sm:p-8">
        <p className="flex items-center gap-2 text-sm font-medium text-brand-100">
          <Sparkles className="size-4" aria-hidden /> Asistente de citas con IA
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Hola, {firstName}. ¿Cómo te podemos ayudar hoy?</h1>
        <p className="mt-2 max-w-xl text-brand-50">
          Describe tus síntomas o lo que necesitas y Sofía encontrará el especialista y el horario que mejor te encajan.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/patient/assistant" variant="secondary" size="lg">
            <Bot className="size-5" aria-hidden /> Hablar con el asistente
          </ButtonLink>
          <ButtonLink href="/patient/book" size="lg" className="bg-white/10 ring-1 ring-white/30 hover:bg-white/20">
            <CalendarPlus className="size-5" aria-hidden /> Reservar manualmente
          </ButtonLink>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Próximas citas"
          description="Tus citas confirmadas o pendientes de confirmación."
          action={
            <Link href="/patient/appointments" className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
              Ver todas <ArrowRight className="size-4" aria-hidden />
            </Link>
          }
        />
        <CardBody className="space-y-3">
          {upcoming.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="size-6" />}
              title="No tienes citas próximas"
              description="Reserva en segundos con el asistente de IA o eligiendo tú mismo el horario."
              action={<ButtonLink href="/patient/assistant">Reservar con IA</ButtonLink>}
            />
          ) : (
            upcoming.map((appointment) => <PatientAppointmentCard key={appointment.id} appointment={appointment} now={now} />)
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-56 w-full rounded-2xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}
