import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ClipboardList } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { DoctorAppointmentRow } from "@/components/doctor-appointment-row";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/feedback";
import { requireDoctor } from "@/lib/auth";
import { db } from "@/lib/db";
import { ACTIVE_STATUSES, appointmentInclude } from "@/lib/scheduling/booking";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Citas" };

const VIEWS = {
  upcoming: { label: "Próximas" },
  pending: { label: "Por confirmar" },
  attention: { label: "Por cerrar" },
  history: { label: "Historial" },
} as const;

type View = keyof typeof VIEWS;

export default function DoctorAppointmentsPage({ searchParams }: PageProps<"/doctor/appointments">) {
  return (
    <>
      <PageHeader title="Citas" description="Confirma, cierra o cancela citas y consulta el resumen pre-consulta generado por la IA." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <AppointmentsList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function AppointmentsList({ searchParams }: { searchParams: PageProps<"/doctor/appointments">["searchParams"] }) {
  const doctor = await requireDoctor();
  const params = await searchParams;
  const view: View = typeof params.view === "string" && params.view in VIEWS ? (params.view as View) : "upcoming";
  const now = new Date();
  const doctorId = doctor.doctorProfileId;

  const filters: Record<View, Prisma.AppointmentWhereInput> = {
    upcoming: { doctorId, status: { in: ACTIVE_STATUSES }, startsAt: { gte: now } },
    pending: { doctorId, status: "PENDING", startsAt: { gte: now } },
    attention: { doctorId, status: { in: ACTIVE_STATUSES }, startsAt: { lt: now } },
    history: { doctorId, status: { notIn: ACTIVE_STATUSES } },
  };

  const appointments = await db.appointment.findMany({
    where: filters[view],
    include: appointmentInclude,
    orderBy: { startsAt: view === "history" || view === "attention" ? "desc" : "asc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="inline-flex flex-wrap rounded-lg bg-slate-100 p-1">
        {(Object.keys(VIEWS) as View[]).map((key) => (
          <Link
            key={key}
            href={key === "upcoming" ? "/doctor/appointments" : `/doctor/appointments?view=${key}`}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium",
              view === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900",
            )}
          >
            {VIEWS[key].label}
          </Link>
        ))}
      </div>
      <Card>
        <CardBody className="space-y-3">
          {appointments.length === 0 ? (
            <EmptyState icon={<ClipboardList className="size-6" />} title="No hay citas en esta vista" />
          ) : (
            appointments.map((appointment) => (
              <DoctorAppointmentRow key={appointment.id} appointment={appointment} now={now} showDate />
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}
