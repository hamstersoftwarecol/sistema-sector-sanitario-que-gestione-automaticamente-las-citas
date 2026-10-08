import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { findDoctorSlots } from "@/lib/scheduling/booking";
import { addDaysToKey, formatTime, isDateKey, toDateKey } from "@/lib/scheduling/time";

export type SlotsResponse = {
  timezone: string;
  slotDurationMinutes: number;
  days: { date: string; slots: { startsAt: string; time: string }[] }[];
};

const MAX_DAYS = 31;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "No autenticado." }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const doctorId = params.get("doctorId");
  const from = params.get("from");
  const days = Math.min(Math.max(Number(params.get("days")) || 14, 1), MAX_DAYS);
  if (!doctorId) return Response.json({ error: "Falta doctorId." }, { status: 400 });
  if (from && !isDateKey(from)) return Response.json({ error: "Fecha inválida." }, { status: 400 });

  const doctor = await db.doctorProfile.findUnique({ where: { id: doctorId }, include: { availability: true } });
  if (!doctor) return Response.json({ error: "Médico no encontrado." }, { status: 404 });

  const today = toDateKey(new Date(), doctor.timezone);
  const fromKey = from && from > today ? from : today;
  const toKey = addDaysToKey(fromKey, days - 1);
  const slots = await findDoctorSlots(doctor, fromKey, toKey);

  const byDay = new Map<string, SlotsResponse["days"][number]["slots"]>();
  for (let i = 0; i < days; i++) byDay.set(addDaysToKey(fromKey, i), []);
  for (const slot of slots) {
    byDay.get(toDateKey(slot.startsAt, doctor.timezone))?.push({
      startsAt: slot.startsAt.toISOString(),
      time: formatTime(slot.startsAt, doctor.timezone),
    });
  }

  const body: SlotsResponse = {
    timezone: doctor.timezone,
    slotDurationMinutes: doctor.slotDurationMinutes,
    days: [...byDay].map(([date, daySlots]) => ({ date, slots: daySlots })),
  };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
