import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";
import { db } from "./db";
import { ROLE_HOME } from "./roles";
import { readSession } from "./session";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  doctorProfileId: string | null;
};

/** Capa de acceso a datos: única fuente de verdad sobre quién hace la petición. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, doctorProfile: { select: { id: true } } },
  });
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    doctorProfileId: user.doctorProfile?.id ?? null,
  };
});

export async function requireUser(...roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    // La cookie puede ser válida aunque el usuario ya no exista: la limpiamos antes de ir al login.
    redirect("/api/auth/signout?expired=1");
  }
  if (roles.length > 0 && !roles.includes(user.role)) {
    redirect(ROLE_HOME[user.role]);
  }
  return user;
}

export async function requireDoctor() {
  const user = await requireUser("DOCTOR");
  if (!user.doctorProfileId) redirect("/api/auth/signout?expired=1");
  return { ...user, doctorProfileId: user.doctorProfileId };
}
