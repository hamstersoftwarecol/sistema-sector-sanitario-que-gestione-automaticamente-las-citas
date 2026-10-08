import type Stripe from "stripe";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getStripe, isStripeConfigured, syncSubscription } from "@/lib/stripe";

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!isStripeConfigured() || !secret) return Response.json({ error: "Stripe no está configurado." }, { status: 503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Falta la firma." }, { status: 400 });

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    // La firma se valida sobre el cuerpo crudo, por eso se lee como texto.
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return Response.json({ error: "Firma inválida." }, { status: 400 });
  }

  if (await db.stripeEvent.findUnique({ where: { id: event.id } })) {
    return Response.json({ received: true, duplicate: true });
  }

  try {
    let subscriptionId: string | null = null;
    if (event.type === "checkout.session.completed" && event.data.object.mode === "subscription") {
      const { subscription } = event.data.object;
      subscriptionId = typeof subscription === "string" ? subscription : (subscription?.id ?? null);
    } else if (SUBSCRIPTION_EVENTS.has(event.type)) {
      subscriptionId = (event.data.object as Stripe.Subscription).id;
    }

    if (subscriptionId) {
      // Se consulta el estado actual: los eventos pueden llegar desordenados.
      await syncSubscription(await stripe.subscriptions.retrieve(subscriptionId));
    }
  } catch (error) {
    console.error(`[stripe] error procesando ${event.type} (${event.id})`, error);
    return Response.json({ error: "Error procesando el evento." }, { status: 500 });
  }

  try {
    await db.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
  }
  return Response.json({ received: true });
}
