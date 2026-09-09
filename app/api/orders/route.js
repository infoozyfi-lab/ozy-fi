import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, makeOrderNum } from '@/lib/api-helpers';
import { trackPurchaseServerSide } from '@/lib/server-tracking';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { env, ctx } = await getCloudflareContext({ async: true });

  const body = await request.json().catch(() => null);

  if (!body || !body.customer || !Array.isArray(body.items) || body.items.length === 0) {
    return json({ error: 'Invalid order payload' }, 400);
  }

  const closedSetting = await env.DB.prepare("SELECT value FROM admin_settings WHERE key = 'store_closed'").first();
  if (closedSetting && closedSetting.value === '1') {
    return json({ error: "We're temporarily closed and not taking orders right now." }, 403);
  }

  const { customer, items } = body;

  if (!customer.name || !customer.address || !customer.email || !customer.phone) {
    return json({ error: 'Missing customer details' }, 400);
  }

  // --- Server-side price/quantity validation ---
  // The client computes prices (base + toppings + size upcharge) for a
  // responsive UI, but that number must never be trusted as-is — anyone
  // can edit the request before it reaches this route. We re-check each
  // line against the real product/addon price in D1.
  //
  // Known limitation: for customizable items (toppings, size, sauces),
  // we only enforce a *floor* — lineTotal can't be below qty × the
  // product's base price — rather than recomputing the exact expected
  // total, because topping/size price deltas aren't sent as structured
  // data in the cart line (only human-readable strings like "Extra
  // cheese"). This still blocks the obvious attack (setting an item's
  // price to near-zero) without needing to duplicate the full topping
  // pricing engine here. Bundle line items (no matching product/addon
  // row) are checked for sane qty/price shape only — full bundle price
  // verification is a follow-up.
  const productIds = [...new Set(items.map((l) => l.productId).filter(Boolean))];
  let priceByProductId = {};
  if (productIds.length) {
    const placeholders = productIds.map(() => '?').join(',');
    const [productRows, addonRows] = await Promise.all([
      env.DB.prepare(`SELECT id, price FROM products WHERE id IN (${placeholders})`).bind(...productIds).all(),
      env.DB.prepare(`SELECT id, price FROM addons WHERE id IN (${placeholders})`).bind(...productIds).all(),
    ]);
    for (const r of [...productRows.results, ...addonRows.results]) {
      priceByProductId[r.id] = Number(r.price) || 0;
    }
  }

  let recomputedTotal = 0;
  for (const line of items) {
    const qty = Number(line.qty);
    const lineTotal = Number(line.lineTotal);

    if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
      return json({ error: 'Invalid item quantity.' }, 400);
    }
    if (!Number.isFinite(lineTotal) || lineTotal < 0) {
      return json({ error: 'Invalid item price.' }, 400);
    }

    const basePrice = line.productId ? priceByProductId[line.productId] : undefined;
    if (basePrice !== undefined && lineTotal < qty * basePrice - 0.01) {
      return json({ error: 'Item price could not be verified. Please refresh your cart and try again.' }, 400);
    }

    recomputedTotal += lineTotal;
  }
  recomputedTotal = Math.round(recomputedTotal * 100) / 100;

  const orderNum = makeOrderNum();

  const insertOrder = await env.DB.prepare(
    `INSERT INTO orders
      (order_num, customer_name, address, email, phone, notes, total, status, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'received', 'cod')`
  )
    .bind(orderNum, customer.name, customer.address, customer.email, customer.phone, customer.notes || '', recomputedTotal)
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

  // Fire-and-forget — doesn't delay the customer's response, and one
  // platform's failure never blocks another's (see server-tracking.js).
  // Safely does nothing until the matching ad-account secrets exist.
  ctx.waitUntil(
    trackPurchaseServerSide(
      env,
      { orderNum, total: recomputedTotal, email: customer.email, phone: customer.phone, items },
      request
    )
  );

  return json({ orderNum, id: orderId, status: 'received' }, 201);
}

