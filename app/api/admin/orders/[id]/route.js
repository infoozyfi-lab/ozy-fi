import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { requireRole, getSession } from '@/lib/adminAuth';
import { logActivity } from '@/lib/auditLog';
import { trackRefundServerSide } from '@/lib/server-tracking';

export const dynamic = 'force-dynamic';

const ORDER_ROLES = ['kitchen', 'manager', 'owner'];

export async function GET(request, { params }) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, ORDER_ROLES);
  if (denied) return denied;

  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(params.id).first();
  if (!order) return json({ error: 'Not found' }, 404);

  const items = await env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(params.id).all();

  return json({ ...order, items: items.results });
}

export async function PATCH(request, { params }) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, ORDER_ROLES);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const allowed = ['received', 'preparing', 'on_the_way', 'delivered', 'cancelled'];

  if (!allowed.includes(body.status)) {
    return json({ error: 'Invalid status' }, 400);
  }

  // Optional: when accepting an order (moving it to "preparing"), staff
  // can attach an ETA. Stored as an absolute timestamp so it stays
  // correct however long the customer waits before checking /track.
  const minutes = Number(body.estimated_minutes);
  let etaNote = '';
  if (Number.isFinite(minutes) && minutes > 0) {
    const eta = new Date(Date.now() + minutes * 60000).toISOString();
    await env.DB.prepare('UPDATE orders SET status = ?, estimated_ready_at = ? WHERE id = ?')
      .bind(body.status, eta, params.id)
      .run();
    etaNote = ` (ETA ${minutes} min)`;
  } else {
    await env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(body.status, params.id).run();
  }

  // Fetched once, reused for both the audit log entry (needs order_num)
  // and the cancellation-tracking branch below (needs total/email/phone)
  // — avoids a second identical SELECT.
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(params.id).first();

  const session = await getSession(request, env);
  ctx.waitUntil(
    logActivity(env, session, 'order.status_changed', `Order ${order?.order_num || params.id} → ${body.status}${etaNote}`)
  );

  // Tell the ad platforms this order didn't actually happen, so revenue
  // reports and campaign optimization don't count it — see the "Refund
  // tracking" note in the roadmap for why this can only be done
  // server-side. Safely does nothing until ad-account secrets exist.
  if (body.status === 'cancelled' && order) {
    ctx.waitUntil(
      trackRefundServerSide(
        env,
        { orderNum: order.order_num, total: order.total, email: order.email, phone: order.phone },
        request
      )
    );
  }

  return json({ ok: true });
}
