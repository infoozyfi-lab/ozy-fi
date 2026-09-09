import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/adminAuth';
import { trackRefundServerSide } from '@/lib/server-tracking';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(params.id).first();
  if (!order) return json({ error: 'Not found' }, 404);

  const items = await env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(params.id).all();

  return json({ ...order, items: items.results });
}

export async function PATCH(request, { params }) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const denied = await requireAdmin(request, env);
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
  if (Number.isFinite(minutes) && minutes > 0) {
    const eta = new Date(Date.now() + minutes * 60000).toISOString();
    await env.DB.prepare('UPDATE orders SET status = ?, estimated_ready_at = ? WHERE id = ?')
      .bind(body.status, eta, params.id)
      .run();
  } else {
    await env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(body.status, params.id).run();
  }

  // Tell the ad platforms this order didn't actually happen, so revenue
  // reports and campaign optimization don't count it — see the "Refund
  // tracking" note in the roadmap for why this can only be done
  // server-side. Safely does nothing until ad-account secrets exist.
  if (body.status === 'cancelled') {
    const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(params.id).first();
    if (order) {
      ctx.waitUntil(
        trackRefundServerSide(
          env,
          { orderNum: order.order_num, total: order.total, email: order.email, phone: order.phone },
          request
        )
      );
    }
  }

  return json({ ok: true });
}
