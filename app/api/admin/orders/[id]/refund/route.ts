import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { requireRole, getSession } from '@/lib/adminAuth';
import { logActivity } from '@/lib/auditLog';
import { getStripe } from '@/lib/stripe';
import { trackRefundServerSide } from '@/lib/server-tracking';
import type { StaffRole, OrderRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Same bar as the invoice route (app/api/admin/orders/[id]/invoice/
// route.ts) — a refund is at least as sensitive a financial action as
// viewing an invoice, per this task's brief ("restrict to manager/owner
// roles, same bar as the invoice route").
const REFUND_ROLES: StaffRole[] = ['manager', 'owner'];

interface RefundBody {
  // Euros, optional — omitted (or equal to the full remaining refundable
  // amount) means a full refund of whatever hasn't already been refunded;
  // a smaller positive number is a partial refund of that amount.
  amount?: unknown;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, REFUND_ROLES);
  if (denied) return denied;

  const { id } = await params;
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRow>();
  if (!order) return json({ error: 'Not found' }, 404);

  const body = (await request.json().catch(() => ({}))) as RefundBody;

  const alreadyRefunded = Number(order.refunded_amount) || 0;
  const remaining = Math.round((Number(order.total) - alreadyRefunded) * 100) / 100;

  if (remaining <= 0) {
    return json({ error: 'This order has already been fully refunded.' }, 400);
  }

  // A requested amount is optional (defaults to the full remaining
  // balance); when given, it must be a real positive number that doesn't
  // exceed what's actually left to refund — never trust the admin UI's own
  // arithmetic, same as every other money-handling route in this project.
  let requestedAmount = remaining;
  if (body.amount !== undefined && body.amount !== null && body.amount !== '') {
    const n = Number(body.amount);
    if (!Number.isFinite(n) || n <= 0) {
      return json({ error: 'Invalid refund amount.' }, 400);
    }
    if (n > remaining + 0.001) {
      return json({ error: `Refund amount can't exceed the remaining balance of ${remaining.toFixed(2)} €.` }, 400);
    }
    requestedAmount = Math.round(n * 100) / 100;
  }

  const isFullRefund = requestedAmount >= remaining - 0.001;

  // --- COD orders: never touch Stripe. There's no charge to refund
  // through Stripe for cash that was never processed through it, so this
  // is a plain manual status marker, written directly here — unlike the
  // card path below, there's no async webhook to wait on, so there's
  // nothing to defer.
  if (order.payment_method !== 'card') {
    const newRefundedAmount = Math.round((alreadyRefunded + requestedAmount) * 100) / 100;
    const newStatus = newRefundedAmount >= Number(order.total) - 0.001 ? 'refunded' : 'partially_refunded';
    const refundedAt = new Date().toISOString();

    await env.DB.prepare(
      `UPDATE orders SET payment_status = ?, refunded_amount = ?, refunded_at = ? WHERE id = ?`
    ).bind(newStatus, newRefundedAmount, refundedAt, id).run();

    const session = await getSession(request, env);
    ctx.waitUntil(
      logActivity(
        env,
        session,
        'order.refunded',
        `Order ${order.order_num} — ${newStatus === 'refunded' ? 'full' : 'partial'} COD refund of ${requestedAmount.toFixed(2)} € marked manually (no Stripe involved)`
      )
    );

    if (order.marketing_consent && newStatus === 'refunded') {
      ctx.waitUntil(
        trackRefundServerSide(
          env,
          { orderNum: order.order_num, total: order.total, email: order.email, phone: order.phone },
          request
        )
      );
    }

    return json({ ok: true, paymentStatus: newStatus });
  }

  // --- Card orders: refund through Stripe. `payment_status` is NOT
  // updated here — same "webhook is the sole source of truth for payment
  // state" principle this project already applies to 'paid'/'failed' (see
  // app/api/webhooks/stripe/route.ts). This route only asks Stripe to
  // refund the charge and logs that it did; the charge.refunded webhook
  // event is what actually flips payment_status once Stripe confirms it.
  if (order.payment_status !== 'paid' && order.payment_status !== 'partially_refunded') {
    return json({ error: `This order's payment status (${order.payment_status || 'unknown'}) isn't refundable.` }, 400);
  }

  // Guards against the one real edge case in this schema: a card order
  // that shows payment_status 'paid' but was fully covered by a discount
  // (finalTotal <= 0 at checkout — see app/api/orders/route.ts) never had
  // a Stripe PaymentIntent created for it at all, so there is nothing to
  // refund through Stripe's API even though the order is marked paid.
  if (!order.stripe_payment_intent_id) {
    return json({ error: 'This order has no Stripe payment to refund (it was fully covered by a discount).' }, 400);
  }

  try {
    const stripe = getStripe(env);
    await stripe.refunds.create({
      payment_intent: order.stripe_payment_intent_id,
      amount: Math.round(requestedAmount * 100),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe refund failed.';
    return json({ error: message }, 502);
  }

  const session = await getSession(request, env);
  ctx.waitUntil(
    logActivity(
      env,
      session,
      'order.refund_requested',
      `Order ${order.order_num} — ${isFullRefund ? 'full' : 'partial'} Stripe refund of ${requestedAmount.toFixed(2)} € requested; payment_status will update once the charge.refunded webhook confirms it`
    )
  );

  // Ad-platform "this revenue didn't happen" signal — only for a full
  // refund, same as the existing cancellation precedent
  // (app/api/admin/orders/[id]/route.ts). A partial refund doesn't mean
  // the order didn't happen, just that less was ultimately kept, so it
  // isn't reported as a full refund event here.
  if (order.marketing_consent && isFullRefund) {
    ctx.waitUntil(
      trackRefundServerSide(
        env,
        { orderNum: order.order_num, total: order.total, email: order.email, phone: order.phone },
        request
      )
    );
  }

  // The Stripe refund call succeeded, but payment_status in the DB hasn't
  // moved yet — that happens when charge.refunded arrives. `pending: true`
  // lets the admin UI show "refund requested" rather than implying the
  // status pill has already updated.
  return json({ ok: true, pending: true });
}
