"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { PlanTier } from "@/generated/prisma/enums";
import { requireDoctor } from "@/lib/auth";
import { db } from "@/lib/db";
import { priceIdForPlan } from "@/lib/plans";
import { BookingError, updateAppointmentByDoctor, type DoctorAction } from "@/lib/scheduling/booking";
import { validateRules, type WeeklyRule } from "@/lib/scheduling/slots";
import { addDaysToKey, zonedDateTime } from "@/lib/scheduling/time";
import { appUrl, getStripe, isStripeConfigured } from "@/lib/stripe";
import { availabilitySchema, doctorProfileSchema, formValues, timeOffSchema, type FormState } from "@/lib/validation";

const DOCTOR_ACTIONS = new Set<DoctorAction>(["confirm", "complete", "no_show", "cancel"]);

function refreshDoctorArea() {
  revalidatePath("/doctor", "layout");
}

export async function updateAppointmentStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const doctor = await requireDoctor();
  const appointmentId = formData.get("appointmentId");
  const action = formData.get("action") as DoctorAction;
  if (typeof appointmentId !== "string" || !DOCTOR_ACTIONS.has(action)) return { error: "Acción no válida." };

  try {
    await updateAppointmentByDoctor({ appointmentId, actor: doctor, action });
  } catch (error) {
    if (error instanceof BookingError) return { error: error.message };
    throw error;
  }
  refreshDoctorArea();
  return { success: "Cita actualizada." };
}

export async function saveDoctorNotesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const doctor = await requireDoctor();
  const appointmentId = formData.get("appointmentId");
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 4000);
  if (typeof appointmentId !== "string") return { error: "Cita no válida." };

  const { count } = await db.appointment.updateMany({
    where: { id: appointmentId, doctorId: doctor.doctorProfileId },
    data: { doctorNotes: notes || null },
  });
  if (count === 0) return { error: "No encontramos esa cita.", values: { notes } };
  refreshDoctorArea();
  return { success: "Notas guardadas." };
}

export async function saveAvailabilityAction(rules: WeeklyRule[]): Promise<FormState> {
  const doctor = await requireDoctor();
  const parsed = availabilitySchema.safeParse({ rules });
  if (!parsed.success) return { error: "El horario enviado no es válido." };
  const problem = validateRules(parsed.data.rules);
  if (problem) return { error: problem };

  await db.$transaction([
    db.availabilityRule.deleteMany({ where: { doctorId: doctor.doctorProfileId } }),
    db.availabilityRule.createMany({
      data: parsed.data.rules.map((rule) => ({ ...rule, doctorId: doctor.doctorProfileId })),
    }),
  ]);
  refreshDoctorArea();
  return { success: "Horario guardado. Los pacientes ya ven tu nueva disponibilidad." };
}

export async function addTimeOffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const doctor = await requireDoctor();
  const parsed = timeOffSchema.safeParse({
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: formValues(formData) };

  const profile = await db.doctorProfile.findUniqueOrThrow({ where: { id: doctor.doctorProfileId } });
  await db.timeOff.create({
    data: {
      doctorId: profile.id,
      startsAt: zonedDateTime(parsed.data.startDate, 0, profile.timezone),
      endsAt: zonedDateTime(addDaysToKey(parsed.data.endDate, 1), 0, profile.timezone),
      reason: parsed.data.reason || null,
    },
  });
  refreshDoctorArea();
  return { success: "Bloqueo añadido. Las citas ya reservadas en esas fechas se mantienen." };
}

export async function deleteTimeOffAction(formData: FormData) {
  const doctor = await requireDoctor();
  const id = formData.get("id");
  if (typeof id !== "string") return;
  await db.timeOff.deleteMany({ where: { id, doctorId: doctor.doctorProfileId } });
  refreshDoctorArea();
}

export async function saveProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const doctor = await requireDoctor();
  const parsed = doctorProfileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    specialtyId: formData.get("specialtyId"),
    bio: formData.get("bio") ?? "",
    licenseNumber: formData.get("licenseNumber") ?? "",
    timezone: formData.get("timezone"),
    slotDurationMinutes: formData.get("slotDurationMinutes"),
    autoConfirm: formData.get("autoConfirm") === "on",
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: formValues(formData) };
  const data = parsed.data;

  const specialty = await db.specialty.findUnique({ where: { id: data.specialtyId } });
  if (!specialty) return { fieldErrors: { specialtyId: ["Especialidad no válida."] }, values: formValues(formData) };

  await db.$transaction([
    db.user.update({ where: { id: doctor.id }, data: { name: data.name, phone: data.phone || null } }),
    db.doctorProfile.update({
      where: { id: doctor.doctorProfileId },
      data: {
        specialtyId: data.specialtyId,
        bio: data.bio || null,
        licenseNumber: data.licenseNumber || null,
        timezone: data.timezone,
        slotDurationMinutes: data.slotDurationMinutes,
        autoConfirm: data.autoConfirm,
      },
    }),
  ]);
  refreshDoctorArea();
  return { success: "Perfil actualizado." };
}

export async function startCheckoutAction(formData: FormData) {
  const doctor = await requireDoctor();
  const plan = formData.get("plan") as PlanTier;
  const priceId = priceIdForPlan(plan);
  if (!isStripeConfigured() || !priceId) redirect("/doctor/billing?error=not-configured");

  const stripe = getStripe();
  const profile = await db.doctorProfile.findUniqueOrThrow({
    where: { id: doctor.doctorProfileId },
    include: { subscription: true },
  });

  // Si ya hay una suscripción de pago, los cambios de plan se hacen desde el portal de Stripe.
  if (profile.subscription?.stripeSubscriptionId && ["active", "trialing", "past_due"].includes(profile.subscription.status)) {
    redirect("/doctor/billing?error=already-subscribed");
  }

  let customerId = profile.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: doctor.email,
      name: doctor.name,
      metadata: { doctorId: profile.id, userId: doctor.id },
    });
    customerId = customer.id;
    await db.doctorProfile.update({ where: { id: profile.id }, data: { stripeCustomerId: customerId } });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: profile.id,
    subscription_data: { metadata: { doctorId: profile.id, plan } },
    metadata: { doctorId: profile.id, plan },
    allow_promotion_codes: true,
    success_url: `${appUrl()}/doctor/billing?checkout=success`,
    cancel_url: `${appUrl()}/doctor/billing?checkout=cancelled`,
  });
  if (!session.url) redirect("/doctor/billing?error=checkout");
  redirect(session.url);
}

export async function openBillingPortalAction() {
  const doctor = await requireDoctor();
  if (!isStripeConfigured()) redirect("/doctor/billing?error=not-configured");
  const profile = await db.doctorProfile.findUniqueOrThrow({ where: { id: doctor.doctorProfileId } });
  if (!profile.stripeCustomerId) redirect("/doctor/billing?error=no-customer");

  const portal = await getStripe().billingPortal.sessions.create({
    customer: profile.stripeCustomerId,
    return_url: `${appUrl()}/doctor/billing`,
  });
  redirect(portal.url);
}
