import { z } from "zod";
import { isDateKey, isValidTimeZone } from "./scheduling/time";

export const registerSchema = z
  .object({
    name: z.string().trim().min(3, "Escribe tu nombre completo.").max(80),
    email: z.email("Correo electrónico inválido.").trim().toLowerCase(),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres.")
      .max(72, "La contraseña es demasiado larga.")
      .regex(/[A-Za-z]/, "Incluye al menos una letra.")
      .regex(/\d/, "Incluye al menos un número."),
    phone: z.string().trim().max(30).optional().or(z.literal("")),
    role: z.enum(["PATIENT", "DOCTOR"], "Elige un tipo de cuenta."),
    specialtyId: z.string().optional(),
  })
  .refine((data) => data.role !== "DOCTOR" || !!data.specialtyId, {
    message: "Elige tu especialidad.",
    path: ["specialtyId"],
  });

export const loginSchema = z.object({
  email: z.email("Correo electrónico inválido.").trim().toLowerCase(),
  password: z.string().min(1, "Escribe tu contraseña."),
});

export const dateKeySchema = z.string().refine(isDateKey, "Fecha inválida (usa AAAA-MM-DD).");

export const bookingSchema = z.object({
  doctorId: z.string().min(1, "Elige un médico."),
  startsAt: z.iso.datetime({ offset: true, message: "Horario inválido." }),
  reason: z.string().trim().min(3, "Cuéntanos brevemente el motivo de la consulta.").max(500),
});

export const doctorProfileSchema = z.object({
  name: z.string().trim().min(3).max(80),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  specialtyId: z.string().min(1, "Elige tu especialidad."),
  bio: z.string().trim().max(600).optional().or(z.literal("")),
  licenseNumber: z.string().trim().max(40).optional().or(z.literal("")),
  timezone: z.string().refine(isValidTimeZone, "Zona horaria inválida."),
  slotDurationMinutes: z.coerce.number().int().refine((v) => [15, 20, 30, 45, 60].includes(v), {
    message: "Duración no permitida.",
  }),
  autoConfirm: z.boolean(),
});

export const availabilitySchema = z.object({
  rules: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startMinute: z.number().int().min(0).max(1440),
        endMinute: z.number().int().min(0).max(1440),
      }),
    )
    .max(50),
});

export const timeOffSchema = z
  .object({
    startDate: dateKeySchema,
    endDate: dateKeySchema,
    reason: z.string().trim().max(120).optional().or(z.literal("")),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "La fecha final debe ser igual o posterior a la inicial.",
    path: ["endDate"],
  });

export type FieldErrors = Record<string, string[] | undefined>;

export type FormState = {
  error?: string;
  fieldErrors?: FieldErrors;
  success?: string;
  /** Valores enviados: React reinicia el formulario tras la acción y los usamos para no perderlos. */
  values?: Record<string, string>;
} | undefined;

export function formValues(formData: FormData, omit: string[] = []) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData) {
    if (typeof value === "string" && !key.startsWith("$ACTION") && !omit.includes(key)) values[key] = value;
  }
  return values;
}
