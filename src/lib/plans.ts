import type { PlanTier } from "@/generated/prisma/enums";

export type Plan = {
  id: PlanTier;
  name: string;
  /** Precio mensual en centavos de USD. */
  priceCents: number;
  description: string;
  /** null = ilimitado. */
  monthlyAppointmentLimit: number | null;
  /** Si los pacientes pueden reservar con este médico desde el asistente de IA. */
  aiBooking: boolean;
  features: string[];
  highlighted?: boolean;
};

export const PLANS: Record<PlanTier, Plan> = {
  FREE: {
    id: "FREE",
    name: "Básico",
    priceCents: 0,
    description: "Para empezar a digitalizar tu agenda.",
    monthlyAppointmentLimit: 30,
    aiBooking: false,
    features: [
      "Hasta 30 citas al mes",
      "Reserva online por parte de los pacientes",
      "Horarios semanales y bloqueos de agenda",
      "Calendario y panel de citas",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Profesional",
    priceCents: 2900,
    description: "Agenda automática con IA para consultorios.",
    monthlyAppointmentLimit: 500,
    aiBooking: true,
    highlighted: true,
    features: [
      "Hasta 500 citas al mes",
      "Reservas automáticas con el asistente de IA",
      "Resumen pre-consulta generado por IA",
      "Todo lo del plan Básico",
    ],
  },
  CLINIC: {
    id: "CLINIC",
    name: "Clínica",
    priceCents: 9900,
    description: "Para clínicas con alto volumen de pacientes.",
    monthlyAppointmentLimit: null,
    aiBooking: true,
    features: [
      "Citas ilimitadas",
      "Reservas automáticas con el asistente de IA",
      "Resumen pre-consulta generado por IA",
      "Todo lo del plan Profesional",
    ],
  },
};

export const PAID_PLANS = [PLANS.PRO, PLANS.CLINIC];

// past_due conserva el plan durante el periodo de gracia de reintentos de cobro de Stripe.
const ENTITLED_STATUSES = new Set(["active", "trialing", "past_due"]);

export function resolvePlan(subscription: { plan: PlanTier; status: string } | null | undefined): Plan {
  if (!subscription || !ENTITLED_STATUSES.has(subscription.status)) return PLANS.FREE;
  return PLANS[subscription.plan];
}

export function priceIdForPlan(plan: PlanTier): string | undefined {
  if (plan === "PRO") return process.env.STRIPE_PRICE_PRO || undefined;
  if (plan === "CLINIC") return process.env.STRIPE_PRICE_CLINIC || undefined;
  return undefined;
}

export function planForPriceId(priceId: string | null | undefined): PlanTier | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PRO) return "PRO";
  if (priceId === process.env.STRIPE_PRICE_CLINIC) return "CLINIC";
  return null;
}
