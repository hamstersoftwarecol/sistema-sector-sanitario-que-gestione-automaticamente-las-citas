import type { AppointmentStatus, BookingSource } from "@/generated/prisma/enums";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: "Pendiente de confirmar",
  CONFIRMED: "Confirmada",
  COMPLETED: "Atendida",
  CANCELLED: "Cancelada",
  NO_SHOW: "No asistió",
};

export const STATUS_TONE: Record<AppointmentStatus, "amber" | "teal" | "slate" | "rose" | "violet"> = {
  PENDING: "amber",
  CONFIRMED: "teal",
  COMPLETED: "slate",
  CANCELLED: "rose",
  NO_SHOW: "violet",
};

export const SOURCE_LABEL: Record<BookingSource, string> = {
  MANUAL: "Reserva manual",
  AI_ASSISTANT: "Asistente IA",
};
