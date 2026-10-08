"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { ROLE_HOME, roleForPath } from "@/lib/roles";
import { createSession, deleteSession } from "@/lib/session";
import { formValues, loginSchema, registerSchema, type FormState } from "@/lib/validation";
import type { Role } from "@/generated/prisma/enums";

// Hash de relleno para que el tiempo de respuesta no revele si un correo existe.
const DUMMY_HASH = "$2b$12$RhKyR00b99lT2iclJutObea4FzSfGjCbqfZ.EGEM0PAv0zz.TX/Pu";

// Horario inicial para médicos nuevos: lunes a viernes, 08:00–12:00 y 14:00–18:00.
const DEFAULT_AVAILABILITY = [1, 2, 3, 4, 5].flatMap((dayOfWeek) => [
  { dayOfWeek, startMinute: 8 * 60, endMinute: 12 * 60 },
  { dayOfWeek, startMinute: 14 * 60, endMinute: 18 * 60 },
]);

function safeRedirectTarget(next: FormDataEntryValue | null, role: Role) {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return ROLE_HOME[role];
  const area = roleForPath(new URL(next, "http://localhost").pathname);
  return area === role ? next : ROLE_HOME[role];
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["password"]);
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) return { error: "Correo o contraseña incorrectos.", values };

  await createSession(user.id, user.role);
  redirect(safeRedirectTarget(formData.get("next"), user.role));
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["password"]);
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone") ?? "",
    role: formData.get("role"),
    specialtyId: formData.get("specialtyId") || undefined,
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const data = parsed.data;

  if (data.role === "DOCTOR") {
    const specialty = await db.specialty.findUnique({ where: { id: data.specialtyId! } });
    if (!specialty) return { fieldErrors: { specialtyId: ["Especialidad no válida."] }, values };
  }

  let user;
  try {
    user = await db.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        role: data.role,
        passwordHash: await hashPassword(data.password),
        ...(data.role === "DOCTOR"
          ? {
              doctorProfile: {
                create: {
                  specialtyId: data.specialtyId!,
                  availability: { create: DEFAULT_AVAILABILITY },
                },
              },
            }
          : {}),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { fieldErrors: { email: ["Ya existe una cuenta con este correo."] }, values };
    }
    throw error;
  }

  await createSession(user.id, user.role);
  redirect(`${ROLE_HOME[user.role]}?welcome=1`);
}

export async function logoutAction() {
  await deleteSession();
  redirect("/");
}
