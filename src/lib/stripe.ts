import "server-only";
import Stripe from "stripe";
import type { PlanTier } from "@/generated/prisma/enums";
import { db } from "./db";
import { planForPriceId } from "./plans";

let stripe: Stripe | null = null;

export function isStripeConfigured() {
  return !!process.env.STRIPE_SECRET_KEY;
}

// Instancia perezosa: así el build no falla si la clave aún no está definida.
export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY no está definida.");
  stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY, { appInfo: { name: "MediCita IA" } });
  return stripe;
}

export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Copia a la base de datos el estado de una suscripción de Stripe. */
export async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const doctor =
    (subscription.metadata.doctorId
      ? await db.doctorProfile.findUnique({ where: { id: subscription.metadata.doctorId } })
      : null) ?? (await db.doctorProfile.findUnique({ where: { stripeCustomerId: customerId } }));
  if (!doctor) {
    console.warn(`[stripe] suscripción ${subscription.id} sin médico asociado (customer ${customerId})`);
    return;
  }

  const item = subscription.items.data[0];
  const plan: PlanTier = planForPriceId(item?.price.id) ?? (subscription.metadata.plan as PlanTier | undefined) ?? "FREE";
  const data = {
    plan,
    status: subscription.status,
    stripeSubscriptionId: subscription.id,
    stripePriceId: item?.price.id ?? null,
    currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };

  await db.$transaction([
    db.doctorProfile.update({ where: { id: doctor.id }, data: { stripeCustomerId: customerId } }),
    db.subscription.upsert({ where: { doctorId: doctor.id }, create: { doctorId: doctor.id, ...data }, update: data }),
  ]);
}
