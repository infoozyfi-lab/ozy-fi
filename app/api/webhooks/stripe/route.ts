import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { getStripe } from '@/lib/stripe';
import type Stripe from 'stripe';

export const dynamic = 'force-dynamic';

// Source of truth for whether a card order actually got paid.
//
// POST /api/orders creating a PaymentIntent and the browser confirming it
// (components/CardPaymentStep.tsx) both happen on the customer's device —
// either step can be interrupted (closed tab, lost connection, phone
// locks mid-payment) without this app ever hearing back. Stripe calling
// this webhook is the only signal that's guaranteed to arrive once the
// charge really succeeds or fails, so it's the only place that writes
// orders.payment_status = 'paid'/'failed'. Everything else (the
// clientSecret flow) is just what gets the customer to the point of
// paying.
//
// Set this endpoint's URL (https://ozy.fi/api/webhooks/stripe) in Stripe
// Dashboard → Developers → Webhooks, listening for payment_intent.succeeded,
// payment_intent.payment_failed, and (Part C — admin-initiated refunds)
// charge.refunded, then copy its "Signing secret" into the
// STRIPE_WEBHOOK_SECRET Cloudflare secret (see cloudflare-env.d.ts).
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });

  if (!env.STRIPE_WEBHOOK_SECRET) {
    // Fails loudly rather than silently trusting an unverified payload —
    // this route must never mark an order paid without a real signature
    // check.
    return json({ error: 'Webhook not configured' }, 500);
  }

  const signature = request.headers.get('stripe-signature');
  const rawBody = await request.text();
  if (!signature) {
    return json({ error: 'Missing signature' }, 400);
  }

  const stripe = getStripe(env);
  let event: Stripe.Event;
  try {
    // constructEventAsync (not constructEvent) — the Workers runtime's
    // crypto is async-only, unlike Node's, which stripe-node's sync
    // signature verification depends on.
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return json({ error: 'Invalid signature' }, 400);
  }

  if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const status = event.type === 'payment_intent.succeeded' ? 'paid' : 'failed';
    await env.DB.prepare(
      `UPDATE orders SET payment_status = ? WHERE stripe_payment_intent_id = ?`
    ).bind(status, paymentIntent.id).run();
  }

  // Part C (admin-initiated refunds) — the admin refund route
  // (app/api/admin/orders/[id]/refund/route.ts) only ever CALLS
  // stripe.refunds.create(...); it deliberately never writes
  // orders.payment_status itself, so nothing marks an order refunded in
  // this database until Stripe confirms it really happened, here — same
  // "webhook is the sole source of truth for payment state" rule this file
  // already applies to paid/failed above. charge.refunded fires once per
  // refund (so a second, later partial refund against the same charge
  // fires this again) — amount_refunded/refunded on the Charge object are
  // always the CUMULATIVE total-so-far, not just this refund's own amount,
  // so this always overwrites refunded_amount with the authoritative
  // running total rather than trying to add to it.
  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId = typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id;

    if (paymentIntentId) {
      const status = charge.refunded ? 'refunded' : 'partially_refunded';
      const refundedAmount = charge.amount_refunded / 100;
      const refundedAt = new Date(event.created * 1000).toISOString();

      await env.DB.prepare(
        `UPDATE orders SET payment_status = ?, refunded_amount = ?, refunded_at = ? WHERE stripe_payment_intent_id = ?`
      ).bind(status, refundedAmount, refundedAt, paymentIntentId).run();
    }
  }

  // Every other event type is acknowledged but ignored — Stripe retries
  // a webhook that doesn't return 2xx, so unhandled types still need a
  // plain OK, not an error.
  return json({ received: true });
}
