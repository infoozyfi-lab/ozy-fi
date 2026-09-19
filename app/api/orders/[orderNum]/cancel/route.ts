import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, phoneMatches } from '@/lib/api-helpers';
import { getStripe } from '@/lib/stripe';
import type { OrderRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Audit-fixes brief, Part 1 — "stale order/address after a card payment
// starts".
//
// Root cause this pairs with (see components/CheckoutModal.tsx's own
// comments): CheckoutModal used to leave its back button fully active
// once a card PaymentIntent had already been created server-side — a
// customer could step back to the address form, change it, and step
// forward again, landing back on the SAME already-created order/
// PaymentIntent. The order row's address (and the exact amount Stripe
// would charge) had been fixed the moment that order was inserted, so
// "going back and changing something" silently stopped doing what it
// looked like it did.
//
// The chosen fix is option (a) from the brief: once a card payment is
// pending, back navigation in the modal is disabled outright and replaced
// with an explicit "Cancel and start over" action. This route is what
// that action calls — it's the one piece of real server-side cleanup that
// choice needs: cancel the still-open Stripe PaymentIntent (so it can
// never later be confirmed against stale data — see CardPaymentStep.tsx)
// and mark the abandoned order row 'cancelled' rather than leaving it
// looking like a live, awaiting-fulfillment order.
//
// Customer-facing, so it needs the same "order number alone isn't secret
// enough" guard the existing GET /api/orders/[orderNum] (order tracking)
// route already uses — phone number match, same generic 404 either way.
export async function POST(request: Request, { params }: { params: Promise<{ orderNum: string }> }) {
  const { env } = await getCloudflareContext({ async: true });
  const { orderNum } = await params;

  const body = (await request.json().catch(() => null)) as { phone?: string } | null;
  const phone = body?.phone || '';

  const order = await env.DB.prepare('SELECT * FROM orders WHERE order_num = ?')
    .bind(orderNum)
    .first<OrderRow>();

  if (!order || !phoneMatches(order.phone, phone)) {
    return json({ error: 'Order not found' }, 404);
  }

  // Only a still-unpaid card order can be cancelled this way. A COD order
  // was never behind a PaymentIntent at all; an order that's already
  // 'paid' (or further along in the kitchen) is real and must go through
  // the admin's own cancel/refund flow (app/api/admin/orders/[id]/route.ts
  // + refund/route.ts), not this customer-facing, no-login endpoint.
  // Silently no-op'ing (rather than erroring) for anything already
  // cancelled keeps this safe to call more than once.
  if (order.status === 'cancelled') {
    return json({ ok: true });
  }
  if (order.payment_method !== 'card' || order.payment_status !== 'pending') {
    return json({ error: 'This order can no longer be cancelled this way.' }, 400);
  }

  if (order.stripe_payment_intent_id) {
    try {
      const stripe = getStripe(env);
      await stripe.paymentIntents.cancel(order.stripe_payment_intent_id);
    } catch {
      // Not fatal — e.g. the PaymentIntent was already canceled (a repeat
      // call), or (in a race even the brief's own worked example doesn't
      // need to guard against) the customer had just confirmed it on
      // Stripe's side a moment before this request landed. Either way,
      // the order status update below still runs so the order never sits
      // looking like a live, unpaid, awaiting-fulfillment order — an
      // admin who does see it, e.g. because payment actually succeeded in
      // that race, can still find it via the payment_status column and
      // straighten it out, same as any other edge case this dashboard
      // already surfaces via PaymentStatusPill.
    }
  }

  await env.DB.prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ?`).bind(order.id).run();

  return json({ ok: true });
}
