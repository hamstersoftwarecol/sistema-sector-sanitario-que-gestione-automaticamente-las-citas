import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarOff, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader, Skeleton } from "@/components/ui/feedback";
import { requireDoctor } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDaysToKey, formatDateKey, toDateKey } from "@/lib/scheduling/time";
import { upperFirst } from "@/lib/utils";
import { deleteTimeOffAction } from "../actions";
import { AvailabilityEditor } from "./availability-editor";
import { TimeOffForm } from "./time-off-form";

export const metadata: Metadata = { title: "Disponibilidad" };

export default function AvailabilityPage() {
  return (
    <>
      <PageHeader
        title="Disponibilidad"
        description="Define tu horario semanal y bloquea días concretos. El asistente de IA y la reserva online solo ofrecen estos huecos."
      />
      <Suspense fallback={<Skeleton className="h-[640px] w-full rounded-2xl" />}>
        <AvailabilityContent />
      </Suspense>
    </>
  );
}

async function AvailabilityContent() {
  const doctor = await requireDoctor();
  const profile = await db.doctorProfile.findUniqueOrThrow({
    where: { id: doctor.doctorProfileId },
    include: {
      availability: true,
      timeOff: { where: { endsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" } },
    },
  });
  const tz = profile.timezone;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <CardHeader title="Horario semanal" description={`Zona horaria: ${tz.replace("_", " ")}`} />
        <CardBody>
          <AvailabilityEditor
            initialRules={profile.availability.map(({ dayOfWeek, startMinute, endMinute }) => ({ dayOfWeek, startMinute, endMinute }))}
            slotMinutes={profile.slotDurationMinutes}
          />
        </CardBody>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Bloquear fechas" description="Vacaciones, congresos o ausencias." />
          <CardBody>
            <TimeOffForm today={toDateKey(new Date(), tz)} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Próximos bloqueos" />
          <CardBody className="space-y-2">
            {profile.timeOff.length === 0 && <p className="text-sm text-slate-500">No tienes bloqueos programados.</p>}
            {profile.timeOff.map((off) => {
              const start = toDateKey(off.startsAt, tz);
              const end = addDaysToKey(toDateKey(off.endsAt, tz), -1);
              return (
                <div key={off.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
                  <CalendarOff className="size-4 shrink-0 text-slate-400" aria-hidden />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium text-slate-800">
                      {upperFirst(start === end ? formatDateKey(start, "short") : `${formatDateKey(start, "short")} – ${formatDateKey(end, "short")}`)}
                    </p>
                    {off.reason && <p className="truncate text-xs text-slate-500">{off.reason}</p>}
                  </div>
                  <form action={deleteTimeOffAction}>
                    <input type="hidden" name="id" value={off.id} />
                    <button type="submit" className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Eliminar bloqueo">
                      <Trash2 className="size-4" aria-hidden />
                      <span className="sr-only">Eliminar bloqueo</span>
                    </button>
                  </form>
                </div>
              );
            })}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
