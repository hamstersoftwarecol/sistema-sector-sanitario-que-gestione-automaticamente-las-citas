import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { AppointmentStatus, BookingSource, Role } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { resolvePlan } from "@/lib/plans";
import { generateSlots, type Slot } from "./slots";
import { addDaysToKey, monthRangeKeys, toDateKey, zonedDateTime } from "./time";

type Client = Prisma.TransactionClient;

export type BookingErrorCode =
  | "DOCTOR_NOT_FOUND"
  | "SLOT_UNAVAILABLE"
  | "PLAN_LIMIT_REACHED"
  | "AI_BOOKING_DISABLED"
  | "PATIENT_CONFLICT"
  | "NOT_FOUND"
  | "INVALID_STATE";

export class BookingError extends Error {
  constructor(
    public readonly code: BookingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export const ACTIVE_STATUSES: AppointmentStatus[] = ["PENDING", "CONFIRMED"];

export const appointmentInclude = {
  doctor: {
    select: {
      id: true,
      timezone: true,
      user: { select: { name: true } },
      specialty: { select: { name: true } },
    },
  },
  patient: { select: { id: true, name: true, email: true, phone: true } },
} satisfies Prisma.AppointmentInclude;

export type AppointmentWithRelations = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

type DoctorForSlots = {
  id: string;
  timezone: string;
  slotDurationMinutes: number;
  availability: { dayOfWeek: number; startMinute: number; endMinute: number }[];
};

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Huecos libres de un médico entre dos fechas (inclusive) de su zona horaria. */
export async function findDoctorSlots(
  doctor: DoctorForSlots,
  fromDateKey: string,
  toDateKey: string,
  options: { now?: Date; client?: Client } = {},
): Promise<Slot[]> {
  const client = options.client ?? db;
  const rangeStart = zonedDateTime(fromDateKey, 0, doctor.timezone);
  const rangeEnd = zonedDateTime(addDaysToKey(toDateKey, 1), 0, doctor.timezone);
  const overlapping = { startsAt: { lt: rangeEnd }, endsAt: { gt: rangeStart } };

  // Secuencial a propósito: dentro de una transacción interactiva las consultas comparten conexión.
  const appointments = await client.appointment.findMany({
    where: { doctorId: doctor.id, status: { not: "CANCELLED" }, ...overlapping },
    select: { startsAt: true, endsAt: true },
  });
  const timeOff = await client.timeOff.findMany({
    where: { doctorId: doctor.id, ...overlapping },
    select: { startsAt: true, endsAt: true },
  });

  return generateSlots({
    rules: doctor.availability,
    timeZone: doctor.timezone,
    slotMinutes: doctor.slotDurationMinutes,
    fromDateKey,
    toDateKey,
    busy: [...appointments, ...timeOff],
    now: options.now ?? new Date(),
  });
}

export type BookingInput = {
  patientId: string;
  doctorId: string;
  startsAt: Date;
  reason: string;
  aiSummary?: string | null;
  source: BookingSource;
  now?: Date;
};

async function bookWithClient(tx: Client, input: BookingInput, ignoreAppointmentId?: string) {
  const doctor = await tx.doctorProfile.findUnique({
    where: { id: input.doctorId },
    include: { availability: true, subscription: true },
  });
  if (!doctor) throw new BookingError("DOCTOR_NOT_FOUND", "No encontramos a ese médico.");
  if (doctor.userId === input.patientId) {
    throw new BookingError("INVALID_STATE", "No puedes reservar una cita contigo mismo.");
  }

  const plan = resolvePlan(doctor.subscription);
  if (input.source === "AI_ASSISTANT" && !plan.aiBooking) {
    throw new BookingError(
      "AI_BOOKING_DISABLED",
      "Este médico no acepta reservas por el asistente de IA; el paciente puede reservar desde la sección «Reservar cita».",
    );
  }

  const dateKey = toDateKey(input.startsAt, doctor.timezone);
  const slots = await findDoctorSlots(doctor, dateKey, dateKey, { now: input.now, client: tx });
  const slot = slots.find((candidate) => candidate.startsAt.getTime() === input.startsAt.getTime());
  if (!slot) throw new BookingError("SLOT_UNAVAILABLE", "Ese horario ya no está disponible.");

  const excludeSelf = ignoreAppointmentId ? { id: { not: ignoreAppointmentId } } : {};

  if (plan.monthlyAppointmentLimit !== null) {
    const { first, next } = monthRangeKeys(dateKey);
    const booked = await tx.appointment.count({
      where: {
        doctorId: doctor.id,
        status: { not: "CANCELLED" },
        startsAt: { gte: zonedDateTime(first, 0, doctor.timezone), lt: zonedDateTime(next, 0, doctor.timezone) },
        ...excludeSelf,
      },
    });
    if (booked >= plan.monthlyAppointmentLimit) {
      throw new BookingError("PLAN_LIMIT_REACHED", "La agenda de este médico está completa para ese mes.");
    }
  }

  const clash = await tx.appointment.findFirst({
    where: {
      patientId: input.patientId,
      status: { in: ACTIVE_STATUSES },
      startsAt: { lt: slot.endsAt },
      endsAt: { gt: slot.startsAt },
      ...excludeSelf,
    },
    select: { id: true },
  });
  if (clash) throw new BookingError("PATIENT_CONFLICT", "Ya tienes otra cita a esa misma hora.");

  return tx.appointment.create({
    data: {
      patientId: input.patientId,
      doctorId: doctor.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      reason: input.reason,
      aiSummary: input.aiSummary || null,
      source: input.source,
      status: doctor.autoConfirm ? "CONFIRMED" : "PENDING",
    },
    include: appointmentInclude,
  });
}

/** Reserva una cita validando horario, bloqueos, límite del plan y solapamientos. */
export async function bookAppointment(input: BookingInput): Promise<AppointmentWithRelations> {
  try {
    return await db.$transaction((tx) => bookWithClient(tx, input));
  } catch (error) {
    // El índice único parcial resuelve la carrera de dos reservas simultáneas al mismo hueco.
    if (isUniqueViolation(error)) throw new BookingError("SLOT_UNAVAILABLE", "Ese horario acaba de ser reservado.");
    throw error;
  }
}

export async function rescheduleAppointment(input: {
  appointmentId: string;
  patientId: string;
  newStartsAt: Date;
  source: BookingSource;
  now?: Date;
}): Promise<AppointmentWithRelations> {
  const now = input.now ?? new Date();
  try {
    return await db.$transaction(async (tx) => {
      const current = await tx.appointment.findUnique({ where: { id: input.appointmentId } });
      if (!current || current.patientId !== input.patientId) {
        throw new BookingError("NOT_FOUND", "No encontramos esa cita.");
      }
      if (!ACTIVE_STATUSES.includes(current.status) || current.startsAt <= now) {
        throw new BookingError("INVALID_STATE", "Esta cita ya no se puede reprogramar.");
      }

      const created = await bookWithClient(
        tx,
        {
          patientId: input.patientId,
          doctorId: current.doctorId,
          startsAt: input.newStartsAt,
          reason: current.reason,
          aiSummary: current.aiSummary,
          source: input.source,
          now,
        },
        current.id,
      );

      await tx.appointment.update({
        where: { id: current.id },
        data: { status: "CANCELLED", cancelledAt: now, cancellationReason: "Reprogramada por el paciente" },
      });
      return created;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new BookingError("SLOT_UNAVAILABLE", "Ese horario acaba de ser reservado.");
    throw error;
  }
}

export type Actor = { id: string; role: Role; doctorProfileId: string | null };

export async function cancelAppointment(input: {
  appointmentId: string;
  actor: Actor;
  reason?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const appointment = await db.appointment.findUnique({ where: { id: input.appointmentId } });
  const isPatient = appointment?.patientId === input.actor.id;
  const isDoctor = !!input.actor.doctorProfileId && appointment?.doctorId === input.actor.doctorProfileId;
  if (!appointment || !(isPatient || isDoctor || input.actor.role === "ADMIN")) {
    throw new BookingError("NOT_FOUND", "No encontramos esa cita.");
  }
  if (!ACTIVE_STATUSES.includes(appointment.status)) {
    throw new BookingError("INVALID_STATE", "Esta cita ya no se puede cancelar.");
  }
  if (isPatient && !isDoctor && appointment.startsAt <= now) {
    throw new BookingError("INVALID_STATE", "No puedes cancelar una cita que ya comenzó.");
  }

  const { count } = await db.appointment.updateMany({
    where: { id: appointment.id, status: { in: ACTIVE_STATUSES } },
    data: {
      status: "CANCELLED",
      cancelledAt: now,
      cancellationReason: input.reason?.trim() || (isPatient ? "Cancelada por el paciente" : "Cancelada por el médico"),
    },
  });
  if (count === 0) throw new BookingError("INVALID_STATE", "Esta cita ya no se puede cancelar.");
  return appointment;
}

export type DoctorAction = "confirm" | "complete" | "no_show" | "cancel";

const TRANSITIONS: Record<Exclude<DoctorAction, "cancel">, { from: AppointmentStatus[]; to: AppointmentStatus; afterStart: boolean }> = {
  confirm: { from: ["PENDING"], to: "CONFIRMED", afterStart: false },
  complete: { from: ["PENDING", "CONFIRMED"], to: "COMPLETED", afterStart: true },
  no_show: { from: ["PENDING", "CONFIRMED"], to: "NO_SHOW", afterStart: true },
};

export async function updateAppointmentByDoctor(input: {
  appointmentId: string;
  actor: Actor;
  action: DoctorAction;
  now?: Date;
}) {
  if (input.action === "cancel") {
    return cancelAppointment({ appointmentId: input.appointmentId, actor: input.actor, now: input.now });
  }
  const now = input.now ?? new Date();
  const appointment = await db.appointment.findUnique({ where: { id: input.appointmentId } });
  if (!appointment || appointment.doctorId !== input.actor.doctorProfileId) {
    throw new BookingError("NOT_FOUND", "No encontramos esa cita.");
  }
  const transition = TRANSITIONS[input.action];
  if (!transition.from.includes(appointment.status)) {
    throw new BookingError("INVALID_STATE", "La cita no admite ese cambio de estado.");
  }
  if (transition.afterStart && appointment.startsAt > now) {
    throw new BookingError("INVALID_STATE", "Solo puedes marcarla así cuando la cita haya comenzado.");
  }
  const { count } = await db.appointment.updateMany({
    where: { id: appointment.id, status: { in: transition.from } },
    data: { status: transition.to },
  });
  if (count === 0) throw new BookingError("INVALID_STATE", "La cita cambió mientras tanto; recarga la página.");
  return appointment;
}
