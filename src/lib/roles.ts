import type { Role } from "@/generated/prisma/enums";

export const ROLE_HOME: Record<Role, string> = {
  PATIENT: "/patient",
  DOCTOR: "/doctor",
  ADMIN: "/admin",
};

export const ROLE_LABEL: Record<Role, string> = {
  PATIENT: "Paciente",
  DOCTOR: "Médico",
  ADMIN: "Administrador",
};

/** Qué rol puede entrar a cada área protegida. */
export function roleForPath(pathname: string): Role | null {
  if (pathname === "/patient" || pathname.startsWith("/patient/")) return "PATIENT";
  if (pathname === "/doctor" || pathname.startsWith("/doctor/")) return "DOCTOR";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "ADMIN";
  return null;
}
