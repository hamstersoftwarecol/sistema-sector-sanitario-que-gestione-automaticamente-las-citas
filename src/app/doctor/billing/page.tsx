import type { Metadata } from "next";
import { Suspense } from "react";
import { Check, CreditCard } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, Badge, PageHeader, Skeleton } from "@/components/ui/feedback";
import { requireDoctor } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLANS, priceIdForPlan, resolvePlan } from "@/lib/plans";
import { formatDate } from "@/lib/scheduling/time";
import { isStripeConfigured } from "@/lib/stripe";
import { cn, formatMoney } from "@/lib/utils";
import { openBillingPortalAction, startCheckoutAction } from "../actions";

export const metadata: Metadata = { title: "Suscripción" };

const ERRORS: Record<string, string> = {
  "not-configured": "Los pagos aún no están configurados en este entorno (faltan las claves de Stripe).",
  "already-subscribed": "Ya tienes una suscripción activa. Cambia de plan desde «Gestionar suscripción».",
  "no-customer": "Todavía no tienes datos de facturación en Stripe.",
  checkout: "No se pudo iniciar el pago. Inténtalo de nuevo.",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Activa",
  trialing: "En periodo de prueba",
  past_due: "Pago pendiente",
  canceled: "Cancelada",
  unpaid: "Impagada",
  incomplete: "Incompleta",
  incomplete_expired: "Expirada",
  paused: "Pausada",
};

export default function BillingPage({ searchParams }: PageProps<"/doctor/billing">) {
  return (
    <>
      <PageHeader title="Suscripción" description="Elige el plan que mejor se adapta al volumen de tu consulta." />
      <Suspense fallback={<Skeleton className="h-[520px] w-full rounded-2xl" />}>
        <BillingContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function BillingContent({ searchParams }: { searchParams: PageProps<"/doctor/billing">["searchParams"] }) {
  const doctor = await requireDoctor();
  const params = await searchParams;
  const profile = await db.doctorProfile.findUniqueOrThrow({
    where: { id: doctor.doctorProfileId },
    include: { subscription: true },
  });
  const subscription = profile.subscription;
  const current = resolvePlan(subscription);
  const stripeReady = isStripeConfigured();
  const hasPaidSubscription = !!subscription?.stripeSubscriptionId && current.id !== "FREE";
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  return (
    <div className="space-y-6">
      {params.checkout === "success" && (
        <Alert title="¡Gracias por suscribirte!">
          Estamos confirmando el pago con Stripe; tu plan se actualizará en unos segundos.
        </Alert>
      )}
      {params.checkout === "cancelled" && <Alert tone="amber">El pago se canceló. No se ha realizado ningún cargo.</Alert>}
      {error && <Alert tone="rose">{error}</Alert>}
      {!stripeReady && (
        <Alert tone="amber" title="Modo demostración">
          Configura STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET y los precios para activar los pagos.
        </Alert>
      )}

      <Card>
        <CardHeader
          title={`Plan actual: ${current.name}`}
          description={current.description}
          action={
            subscription && current.id !== "FREE" ? (
              <Badge tone={subscription.status === "active" ? "teal" : "amber"}>{STATUS_LABEL[subscription.status] ?? subscription.status}</Badge>
            ) : (
              <Badge>Gratis</Badge>
            )
          }
        />
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            {subscription?.currentPeriodEnd && current.id !== "FREE"
              ? `${subscription.cancelAtPeriodEnd ? "Finaliza" : "Se renueva"} el ${formatDate(subscription.currentPeriodEnd, profile.timezone)}.`
              : "Sin cargos recurrentes."}
          </p>
          {profile.stripeCustomerId && stripeReady && (
            <form action={openBillingPortalAction}>
              <SubmitButton variant="secondary" pendingText="Abriendo…">
                <CreditCard className="size-4" aria-hidden /> Gestionar suscripción y facturas
              </SubmitButton>
            </form>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {Object.values(PLANS).map((plan) => {
          const isCurrent = plan.id === current.id;
          const purchasable = plan.id !== "FREE" && !!priceIdForPlan(plan.id) && stripeReady;
          return (
            <Card key={plan.id} className={cn("flex flex-col", plan.highlighted && "border-brand-500 ring-1 ring-brand-500")}>
              <CardBody className="flex flex-1 flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                  {isCurrent ? <Badge tone="teal">Tu plan</Badge> : plan.highlighted ? <Badge tone="sky">Más elegido</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                <p className="mt-4">
                  <span className="text-4xl font-bold tracking-tight">{formatMoney(plan.priceCents)}</span>
                  <span className="text-sm text-slate-500"> /mes</span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm text-slate-700">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {isCurrent || plan.id === "FREE" ? null : hasPaidSubscription ? (
                    <form action={openBillingPortalAction}>
                      <SubmitButton variant="secondary" className="w-full" pendingText="Abriendo…">
                        Cambiar a {plan.name}
                      </SubmitButton>
                    </form>
                  ) : (
                    <form action={startCheckoutAction}>
                      <input type="hidden" name="plan" value={plan.id} />
                      <SubmitButton className="w-full" disabled={!purchasable} pendingText="Redirigiendo a Stripe…">
                        Elegir {plan.name}
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">Precios en USD. Pagos procesados de forma segura por Stripe. Puedes cancelar cuando quieras.</p>
    </div>
  );
}
