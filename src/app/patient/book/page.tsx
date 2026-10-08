import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/ui/feedback";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BookingWizard, type BookingDoctor } from "./booking-wizard";

export const metadata: Metadata = { title: "Reservar cita" };

export default function BookPage() {
  return (
    <>
      <PageHeader
        title="Reservar cita"
        description="Elige especialidad, profesional y horario. Si prefieres que lo haga la IA, usa el asistente."
      />
      <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-2xl" />}>
        <BookingLoader />
      </Suspense>
    </>
  );
}

async function BookingLoader() {
  const user = await requireUser("PATIENT");
  const [specialties, doctors] = await Promise.all([
    db.specialty.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.doctorProfile.findMany({
      where: { userId: { not: user.id } },
      orderBy: { user: { name: "asc" } },
      select: {
        id: true,
        bio: true,
        specialtyId: true,
        slotDurationMinutes: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  const bookingDoctors: BookingDoctor[] = doctors.map((doctor) => ({
    id: doctor.id,
    name: doctor.user.name,
    bio: doctor.bio,
    specialtyId: doctor.specialtyId,
    slotDurationMinutes: doctor.slotDurationMinutes,
  }));

  return (
    <BookingWizard
      specialties={specialties.filter((specialty) => bookingDoctors.some((d) => d.specialtyId === specialty.id))}
      doctors={bookingDoctors}
    />
  );
}
