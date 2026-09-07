
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, makeOrderNum } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { env } = await getCloudflareContext({ async: true });

  const body = await request.json().catch(() => null);

  if (!body || !body.customer || !Array.isArray(body.items) || body.items.length === 0) {
    return json({ error: 'Invalid order payload' }, 400);
  }

  const { customer, items, total } = body;

  if (!customer.name || !customer.address || !customer.email || !customer.phone) {
    return json({ error: 'Missing customer details' }, 400);
  }

  const orderNum = makeOrderNum();

  const insertOrder = await env.DB.prepare(
    `INSERT INTO orders
      (order_num, customer_name, address, email, phone, notes, total, status, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'received', 'cod')`
  )
    .bind(orderNum, customer.name, customer.address, customer.email, customer.phone, customer.notes || '', total)
    .run();

  const orderId = insertOrder.meta.last_row_id;

  const stmts = items.map((line) =>
    env.DB.prepare(
      `INSERT INTO order_items (order_id, product_id, name, qty, line_total, details)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(orderId, line.productId || null, line.name, line.qty, line.lineTotal, JSON.stringify(line.details || []))
  );

  if (stmts.length) {
    await env.DB.batch(stmts);
  }

  return json({ orderNum, id: orderId, status: 'received' }, 201);
}
