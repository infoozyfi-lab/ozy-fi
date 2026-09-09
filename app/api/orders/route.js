import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, makeOrderNum } from '@/lib/api-helpers';
import { trackPurchaseServerSide } from '@/lib/server-tracking';
import { validateCoupon, normalizeCouponCode } from '@/lib/coupons';

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

  // Email removed from this check — it's optional at checkout now (not
  // legally required in Finland for a cash-on-delivery order). Phone
  // remains required and is the primary contact/tracking method either
  // way. Postal code is required (used for the delivery-zone check
  // below).
  if (!customer.name || !customer.address || !customer.postalCode || !customer.phone) {
    return json({ error: 'Missing customer details' }, 400);
  }

  // Delivery zone check — only enforced if the admin has actually listed
  // any postal codes/prefixes in Settings. Leaving that field blank (the
  // default) means no restriction at all, so this never blocks anyone
  // until the business deliberately turns it on.
  //
  // Entries can be a full 5-digit postal code (exact match) or a short
  // 2-3 digit prefix (matches anything starting with it) — e.g. "00"
  // covers every Helsinki postal code (00100–00990) without having to
  // list all ~90 of them individually.
  const zoneSetting = await env.DB.prepare("SELECT value FROM admin_settings WHERE key = 'delivery_postal_codes'").first();
  const allowedZones = (zoneSetting?.value || '')
    .split(',')
    .map((z) => z.trim())
    .filter(Boolean);
  const customerPostal = String(customer.postalCode).trim();
  const zoneOk = allowedZones.length === 0 || allowedZones.some((zone) =>
    zone.length <= 3 ? customerPostal.startsWith(zone) : customerPostal === zone
  );
  if (!zoneOk) {
    return json({ error: "Sorry, we don't currently deliver to that postal code." }, 400);
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

  // --- Coupon re-validation (Phase 7.6) ---
  // The client may have shown its own "10% off" preview (from
  // /api/coupons/validate, called as the customer types the code in) —
  // that preview is never trusted here. Same principle as the item-price
  // check above: re-validate and recompute the discount from scratch,
  // against the subtotal THIS route just verified, not anything the
  // client sent.
  let finalTotal = recomputedTotal;
  let discountAmount = 0;
  let appliedCouponCode = null;

  if (body.couponCode) {
    const result = await validateCoupon(env, body.couponCode, recomputedTotal);
    if (!result.valid) {
      return json({ error: result.error || 'This coupon code is not valid.' }, 400);
    }
    finalTotal = result.finalTotal;
    discountAmount = result.discountAmount;
    appliedCouponCode = normalizeCouponCode(body.couponCode);
  }

  const orderNum = makeOrderNum();

  // orders.email is NOT NULL (worker/schema.sql) — storing '' for a
  // skipped email needs no migration, vs. making the column nullable.
  // Kept consistent everywhere else that reads it: '' is already falsy in
  // JS, so display code and lib/server-tracking.js's
  // `order.email ? sha256Hex(order.email) : null` already treat it the
  // same as no email, no extra empty-string checks needed there.
  const email = (customer.email || '').trim();

  const insertOrder = await env.DB.prepare(
    `INSERT INTO orders
      (order_num, customer_name, address, email, phone, notes, total, status, payment_method, coupon_code, discount_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'received', 'cod', ?, ?)`
  )
    .bind(orderNum, customer.name, customer.address, email, customer.phone, customer.notes || '', finalTotal, appliedCouponCode, discountAmount)
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

  // Coupon usage counter — best-effort, after the order row itself is
  // safely committed. Not wrapped in the same batch as the order/items
  // inserts above (D1 batches are all-or-nothing as a group, but this is
  // a secondary bookkeeping update, not something that should roll back
  // an otherwise-successful order if it somehow failed). A theoretical
  // race between two simultaneous orders on the last remaining use of a
  // usage-limited coupon could let both through — acceptable for this
  // business's order volume; a stricter conditional UPDATE could close
  // that gap later if it ever matters.
  if (appliedCouponCode) {
    ctx.waitUntil(
      env.DB.prepare('UPDATE coupons SET times_used = times_used + 1 WHERE code = ?')
        .bind(appliedCouponCode)
        .run()
    );
  }

  // Fire-and-forget — doesn't delay the customer's response, and one
  // platform's failure never blocks another's (see server-tracking.js).
  // Safely does nothing until the matching ad-account secrets exist.
  // Uses the final (post-discount) total — what actually gets paid is
  // what ad platforms should count as the conversion value.
  ctx.waitUntil(
    trackPurchaseServerSide(
      env,
      { orderNum, total: finalTotal, email, phone: customer.phone, items },
      request
    )
  );

  return json({ orderNum, id: orderId, status: 'received', total: finalTotal, discountAmount }, 201);
}

