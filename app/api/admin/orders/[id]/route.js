import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/adminAuth';

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
  const { env } = await getCloudflareContext({ async: true });
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const allowed = ['received', 'preparing', 'on_the_way', 'delivered', 'cancelled'];

  if (!allowed.includes(body.status)) {
    return json({ error: 'Invalid status' }, 400);
  }

  await env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(body.status, params.id).run();

  return json({ ok: true });
}
