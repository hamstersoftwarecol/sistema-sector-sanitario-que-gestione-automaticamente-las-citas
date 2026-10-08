import { afterEach, describe, expect, it, vi } from "vitest";
import { PLANS, planForPriceId, priceIdForPlan, resolvePlan } from "@/lib/plans";

describe("plans", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("usa el plan gratuito sin suscripción o con una suscripción inactiva", () => {
    expect(resolvePlan(null)).toBe(PLANS.FREE);
    expect(resolvePlan({ plan: "PRO", status: "canceled" })).toBe(PLANS.FREE);
    expect(resolvePlan({ plan: "PRO", status: "incomplete" })).toBe(PLANS.FREE);
  });

  it("mantiene el plan de pago mientras la suscripción está vigente o en periodo de gracia", () => {
    expect(resolvePlan({ plan: "PRO", status: "active" })).toBe(PLANS.PRO);
    expect(resolvePlan({ plan: "CLINIC", status: "trialing" })).toBe(PLANS.CLINIC);
    expect(resolvePlan({ plan: "PRO", status: "past_due" })).toBe(PLANS.PRO);
  });

  it("solo los planes de pago permiten reservas por IA", () => {
    expect(PLANS.FREE.aiBooking).toBe(false);
    expect(PLANS.PRO.aiBooking).toBe(true);
    expect(PLANS.CLINIC.monthlyAppointmentLimit).toBeNull();
  });

  it("traduce entre planes y precios de Stripe", () => {
    vi.stubEnv("STRIPE_PRICE_PRO", "price_pro");
    vi.stubEnv("STRIPE_PRICE_CLINIC", "price_clinic");
    expect(priceIdForPlan("PRO")).toBe("price_pro");
    expect(priceIdForPlan("FREE")).toBeUndefined();
    expect(planForPriceId("price_clinic")).toBe("CLINIC");
    expect(planForPriceId("price_unknown")).toBeNull();
  });
});
