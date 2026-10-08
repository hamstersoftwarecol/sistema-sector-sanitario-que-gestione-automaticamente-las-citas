import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader, Skeleton } from "@/components/ui/feedback";
import { requireDoctor } from "@/lib/auth";
import { db } from "@/lib/db";
import { SUPPORTED_TIMEZONES } from "@/lib/scheduling/time";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Perfil" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Perfil profesional" description="Información pública y preferencias de tu agenda." />
      <Suspense fallback={<Skeleton className="h-[560px] w-full rounded-2xl" />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}

async function SettingsContent() {
  const doctor = await requireDoctor();
  const [profile, specialties] = await Promise.all([
    db.doctorProfile.findUniqueOrThrow({ where: { id: doctor.doctorProfileId }, include: { user: true } }),
    db.specialty.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const timezones = SUPPORTED_TIMEZONES.includes(profile.timezone as (typeof SUPPORTED_TIMEZONES)[number])
    ? SUPPORTED_TIMEZONES
    : [profile.timezone, ...SUPPORTED_TIMEZONES];

  return (
    <Card className="max-w-3xl">
      <CardBody>
        <ProfileForm
          specialties={specialties}
          timezones={timezones}
          values={{
            name: profile.user.name,
            phone: profile.user.phone ?? "",
            specialtyId: profile.specialtyId,
            bio: profile.bio ?? "",
            licenseNumber: profile.licenseNumber ?? "",
            timezone: profile.timezone,
            slotDurationMinutes: profile.slotDurationMinutes,
            autoConfirm: profile.autoConfirm,
          }}
        />
      </CardBody>
    </Card>
  );
}
