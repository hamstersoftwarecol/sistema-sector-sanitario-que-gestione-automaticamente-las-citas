import "server-only";
import { z } from "zod";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { resolvePlan } from "@/lib/plans";
import {
  ACTIVE_STATUSES,
  BookingError,
  appointmentInclude,
  bookAppointment,
  cancelAppointment,
  findDoctorSlots,
  rescheduleAppointment,
  type AppointmentWithRelations,
} from "@/lib/scheduling/booking";
import { addDaysToKey, diffInDays, formatDateTime, isDateKey, minuteOfDayIn, toDateKey } from "@/lib/scheduling/time";
import { STATUS_LABEL } from "@/lib/appointments";
import { ToolError, type AgentTool } from "./agent";

export type ToolContext = {
  patientId: string;
  now: Date;
  timeZone: string;
};

export type AppointmentSummary = {
  appointmentId: string;
  doctorName: string;
  specialty: string;
  startsAt: string;
  localTime: string;
  status: AppointmentStatus;
  statusLabel: string;
};

export function summarizeAppointment(appointment: AppointmentWithRelations): AppointmentSummary {
  return {
    appointmentId: appointment.id,
    doctorName: appointment.doctor.user.name,
    specialty: appointment.doctor.specialty.name,
    startsAt: appointment.startsAt.toISOString(),
    localTime: formatDateTime(appointment.startsAt, appointment.doctor.timezone),
    status: appointment.status,
    statusLabel: STATUS_LABEL[appointment.status],
  };
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

async function findSpecialty(query: string) {
  const specialties = await db.specialty.findMany();
  const needle = normalize(query);
  return (
    specialties.find((s) => normalize(s.slug) === needle || normalize(s.name) === needle) ??
    specialties.find((s) => normalize(s.name).includes(needle) || needle.includes(normalize(s.name)))
  );
}

function parseArgs<T extends z.ZodType>(schema: T, args: unknown): z.infer<T> {
  const result = schema.safeParse(args);
  if (!result.success) {
    throw new ToolError(`Argumentos inválidos: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  }
  return result.data;
}

async function asToolError<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof BookingError) throw new ToolError(error.message);
    throw error;
  }
}

const isoDate = z.string().refine(isDateKey, "usa el formato AAAA-MM-DD");

const PART_OF_DAY: Record<string, [number, number]> = {
  morning: [0, 12 * 60],
  afternoon: [12 * 60, 18 * 60],
  evening: [18 * 60, 24 * 60],
  any: [0, 24 * 60],
};

const MAX_SEARCH_DAYS = 21;

export function createSchedulingTools(ctx: ToolContext): Record<string, AgentTool> {
  const patientActor = { id: ctx.patientId, role: "PATIENT" as const, doctorProfileId: null };

  return {
    list_specialties: {
      definition: {
        type: "function",
        function: {
          name: "list_specialties",
          description: "Lista las especialidades médicas disponibles en la plataforma y cuántos médicos tiene cada una.",
          parameters: { type: "object", properties: {}, additionalProperties: false },
        },
      },
      async execute() {
        const specialties = await db.specialty.findMany({
          orderBy: { name: "asc" },
          include: { _count: { select: { doctors: true } } },
        });
        return {
          specialties: specialties.map((s) => ({
            slug: s.slug,
            name: s.name,
            description: s.description,
            doctors: s._count.doctors,
          })),
        };
      },
    },

    search_doctors: {
      definition: {
        type: "function",
        function: {
          name: "search_doctors",
          description: "Busca médicos por especialidad y/o nombre. Indica si aceptan reservas por el asistente.",
          parameters: {
            type: "object",
            properties: {
              specialty: { type: "string", description: "Nombre o slug de la especialidad, p. ej. 'cardiologia'." },
              name: { type: "string", description: "Parte del nombre del médico." },
            },
            additionalProperties: false,
          },
        },
      },
      async execute(raw) {
        const args = parseArgs(z.object({ specialty: z.string().nullish(), name: z.string().nullish() }), raw);
        const specialty = args.specialty ? await findSpecialty(args.specialty) : undefined;
        if (args.specialty && !specialty) throw new ToolError(`No existe la especialidad «${args.specialty}». Usa list_specialties.`);

        const doctors = await db.doctorProfile.findMany({
          where: {
            ...(specialty ? { specialtyId: specialty.id } : {}),
            ...(args.name ? { user: { name: { contains: args.name, mode: "insensitive" } } } : {}),
          },
          include: { user: { select: { name: true } }, specialty: { select: { name: true } }, subscription: true },
          take: 10,
        });
        return {
          doctors: doctors.map((d) => ({
            doctorId: d.id,
            name: d.user.name,
            specialty: d.specialty.name,
            bio: d.bio,
            acceptsAiBooking: resolvePlan(d.subscription).aiBooking,
          })),
        };
      },
    },

    find_available_slots: {
      definition: {
        type: "function",
        function: {
          name: "find_available_slots",
          description:
            "Busca horarios libres reales. Requiere specialty o doctorId. Devuelve como mucho `limit` huecos ordenados por fecha.",
          parameters: {
            type: "object",
            properties: {
              specialty: { type: "string", description: "Nombre o slug de la especialidad." },
              doctorId: { type: "string", description: "ID de un médico concreto." },
              fromDate: { type: "string", description: "Primer día a buscar (AAAA-MM-DD). Por defecto hoy." },
              toDate: { type: "string", description: `Último día a buscar (AAAA-MM-DD). Máximo ${MAX_SEARCH_DAYS} días después de fromDate.` },
              partOfDay: { type: "string", enum: ["morning", "afternoon", "evening", "any"] },
              limit: { type: "integer", minimum: 1, maximum: 20 },
            },
            additionalProperties: false,
          },
        },
      },
      async execute(raw) {
        const args = parseArgs(
          z.object({
            specialty: z.string().nullish(),
            doctorId: z.string().nullish(),
            fromDate: isoDate.nullish(),
            toDate: isoDate.nullish(),
            partOfDay: z.enum(["morning", "afternoon", "evening", "any"]).nullish(),
            limit: z.number().int().min(1).max(20).nullish(),
          }),
          raw,
        );
        if (!args.specialty && !args.doctorId) throw new ToolError("Indica una especialidad o un doctorId.");

        const today = toDateKey(ctx.now, ctx.timeZone);
        const from = args.fromDate && args.fromDate > today ? args.fromDate : today;
        let to = args.toDate ?? addDaysToKey(from, 7);
        if (to < from) throw new ToolError("toDate debe ser igual o posterior a fromDate.");
        if (diffInDays(from, to) > MAX_SEARCH_DAYS) to = addDaysToKey(from, MAX_SEARCH_DAYS);

        let where = {};
        if (args.doctorId) {
          where = { id: args.doctorId };
        } else {
          const specialty = await findSpecialty(args.specialty!);
          if (!specialty) throw new ToolError(`No existe la especialidad «${args.specialty}». Usa list_specialties.`);
          where = { specialtyId: specialty.id };
        }

        const doctors = await db.doctorProfile.findMany({
          where,
          include: {
            availability: true,
            subscription: true,
            user: { select: { name: true } },
            specialty: { select: { name: true } },
          },
        });
        if (doctors.length === 0) throw new ToolError("No se encontraron médicos con ese criterio.");

        const eligible = doctors.filter((doctor) => resolvePlan(doctor.subscription).aiBooking);
        if (eligible.length === 0) {
          return {
            slots: [],
            note: "Los médicos encontrados no aceptan reservas por el asistente. El paciente puede reservar con ellos desde la sección «Reservar cita».",
          };
        }

        const [minMinute, maxMinute] = PART_OF_DAY[args.partOfDay ?? "any"]!;
        const perDoctor = await Promise.all(
          eligible.map(async (doctor) => {
            const slots = await findDoctorSlots(doctor, from, to, { now: ctx.now });
            return slots
              .filter((slot) => {
                const minute = minuteOfDayIn(slot.startsAt, doctor.timezone);
                return minute >= minMinute && minute < maxMinute;
              })
              .map((slot) => ({
                doctorId: doctor.id,
                doctorName: doctor.user.name,
                specialty: doctor.specialty.name,
                startsAt: slot.startsAt.toISOString(),
                localTime: formatDateTime(slot.startsAt, doctor.timezone),
              }));
          }),
        );

        const slots = perDoctor
          .flat()
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
          .slice(0, args.limit ?? 8);

        return {
          range: { from, to },
          slots,
          ...(slots.length === 0 ? { note: "No hay horarios libres en ese rango. Prueba con otras fechas o franja." } : {}),
        };
      },
    },

    book_appointment: {
      definition: {
        type: "function",
        function: {
          name: "book_appointment",
          description:
            "Reserva una cita para el paciente. Úsala solo después de que el paciente confirme médico, día y hora.",
          parameters: {
            type: "object",
            properties: {
              doctorId: { type: "string" },
              startsAt: { type: "string", description: "Valor startsAt exacto devuelto por find_available_slots." },
              reason: { type: "string", description: "Motivo de consulta breve, en palabras del paciente." },
              summary: { type: "string", description: "Resumen pre-consulta objetivo para el médico, sin diagnósticos." },
            },
            required: ["doctorId", "startsAt", "reason", "summary"],
            additionalProperties: false,
          },
        },
      },
      async execute(raw) {
        const args = parseArgs(
          z.object({
            doctorId: z.string().min(1),
            startsAt: z.iso.datetime({ offset: true }),
            reason: z.string().trim().min(3).max(500),
            summary: z.string().trim().max(1500),
          }),
          raw,
        );
        const appointment = await asToolError(
          bookAppointment({
            patientId: ctx.patientId,
            doctorId: args.doctorId,
            startsAt: new Date(args.startsAt),
            reason: args.reason,
            aiSummary: args.summary,
            source: "AI_ASSISTANT",
            now: ctx.now,
          }),
        );
        return { booked: true, appointment: summarizeAppointment(appointment) };
      },
    },

    list_my_appointments: {
      definition: {
        type: "function",
        function: {
          name: "list_my_appointments",
          description: "Lista las próximas citas activas del paciente (y opcionalmente las últimas pasadas).",
          parameters: {
            type: "object",
            properties: { includePast: { type: "boolean" } },
            additionalProperties: false,
          },
        },
      },
      async execute(raw) {
        const args = parseArgs(z.object({ includePast: z.boolean().nullish() }), raw);
        const upcoming = await db.appointment.findMany({
          where: { patientId: ctx.patientId, status: { in: ACTIVE_STATUSES }, startsAt: { gte: ctx.now } },
          include: appointmentInclude,
          orderBy: { startsAt: "asc" },
          take: 10,
        });
        const past = args.includePast
          ? await db.appointment.findMany({
              where: { patientId: ctx.patientId, startsAt: { lt: ctx.now } },
              include: appointmentInclude,
              orderBy: { startsAt: "desc" },
              take: 5,
            })
          : [];
        return {
          upcoming: upcoming.map(summarizeAppointment),
          ...(args.includePast ? { past: past.map(summarizeAppointment) } : {}),
        };
      },
    },

    cancel_appointment: {
      definition: {
        type: "function",
        function: {
          name: "cancel_appointment",
          description: "Cancela una cita activa del paciente. Confirma antes con el paciente.",
          parameters: {
            type: "object",
            properties: {
              appointmentId: { type: "string" },
              reason: { type: "string" },
            },
            required: ["appointmentId"],
            additionalProperties: false,
          },
        },
      },
      async execute(raw) {
        const args = parseArgs(z.object({ appointmentId: z.string().min(1), reason: z.string().max(300).nullish() }), raw);
        await asToolError(
          cancelAppointment({ appointmentId: args.appointmentId, actor: patientActor, reason: args.reason ?? undefined, now: ctx.now }),
        );
        const appointment = await db.appointment.findUniqueOrThrow({ where: { id: args.appointmentId }, include: appointmentInclude });
        return { cancelled: true, appointment: summarizeAppointment(appointment) };
      },
    },

    reschedule_appointment: {
      definition: {
        type: "function",
        function: {
          name: "reschedule_appointment",
          description:
            "Mueve una cita activa a otro horario libre del mismo médico (consulta antes find_available_slots con su doctorId).",
          parameters: {
            type: "object",
            properties: {
              appointmentId: { type: "string" },
              newStartsAt: { type: "string", description: "Valor startsAt exacto devuelto por find_available_slots." },
            },
            required: ["appointmentId", "newStartsAt"],
            additionalProperties: false,
          },
        },
      },
      async execute(raw) {
        const args = parseArgs(
          z.object({ appointmentId: z.string().min(1), newStartsAt: z.iso.datetime({ offset: true }) }),
          raw,
        );
        const appointment = await asToolError(
          rescheduleAppointment({
            appointmentId: args.appointmentId,
            patientId: ctx.patientId,
            newStartsAt: new Date(args.newStartsAt),
            source: "AI_ASSISTANT",
            now: ctx.now,
          }),
        );
        return { rescheduled: true, appointment: summarizeAppointment(appointment) };
      },
    },
  };
}
