import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, makeOrderNum } from '@/lib/api-helpers';
import { trackPurchaseServerSide } from '@/lib/server-tracking';
import { validateCoupon, normalizeCouponCode } from '@/lib/coupons';
import { loadMenuData } from '@/lib/menu-data';
import { normalizeMenuBlob } from '@/lib/menu-i18n';
import { verifyCartLine } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

interface OrderItemInput {
  productId?: string | null;
  name: string;
  qty: number;
  lineTotal: number;
  details?: string[];
  // Structured pricing data (money-correctness pass) — see lib/pricing.ts.
  // Left as `unknown` here (not the real CartLineSelectionData/
  // CartLineBundleItem[] shape) because this is untrusted request JSON —
  // lib/pricing.ts's verifyCartLine() is what actually validates its
  // shape before trusting anything in it, same principle as `lineTotal`
  // itself never being trusted at face value.
  selection?: unknown;
  bundleId?: string;
  bundleItems?: unknown;
}

interface OrderCustomerInput {
  name: string;
  address: string;
  postalCode: string;
  phone: string;
  email?: string;
  notes?: string;
}

interface CreateOrderBody {
  customer: OrderCustomerInput;
  items: OrderItemInput[];
  couponCode?: string | null;
  marketingConsent?: boolean;
}

export async function POST(request: Request) {
  const { env, ctx } = await getCloudflareContext({ async: true });

  const body = (await request.json().catch(() => null)) as CreateOrderBody | null;

  if (!body || !body.customer || !Array.isArray(body.items) || body.items.length === 0) {
    return json({ error: 'Invalid order payload' }, 400);
  }

  // One D1 round trip for everything price verification below needs
  // (products/addons/option deltas/bundles/settings) — the exact same
  // data source + shaping (lib/menu-data.ts + lib/menu-i18n.ts) that
  // /api/menu and the SSR pages already use, so "what should this cost"
  // is computed identically everywhere rather than re-derived separately
  // here. `store_closed` also lives in this same settings blob, so the
  // separate single-key query this replaced is no longer needed either.
  const rawMenu = await loadMenuData(env);
  const menu = normalizeMenuBlob(rawMenu, 'en'); // locale only affects display labels, never prices/ids — irrelevant here.

  if (menu.storeClosed) {
    return json({ error: "We're temporarily closed and not taking orders right now." }, 403);
  }

  const { customer, items } = body;

  // Email removed from this check — it's optional at checkout now (not
  // legally required in Finland for a cash-on-delivery order). Phone
  // remains required and is the primary contact/tracking method either
  // way. Postal code is required (used for the delivery-zone check
  // below) — restored here after being found missing during the price-
  // verification work; see CheckoutModal.tsx for the matching form field.
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
  // list all ~90 of them individually. Reads straight from rawMenu's
  // settings blob (already fetched above for pricing) rather than a
  // separate query.
  const allowedZones = String(rawMenu.settings?.delivery_postal_codes || '')
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

  // --- Server-side price/quantity validation (money-correctness pass) ---
  // The client computes prices (base + toppings + size upcharge, or a
  // bundle's base + each filled slot's customization extra) for a
  // responsive UI, but that number must never be trusted as-is — anyone
  // can edit the request before it reaches this route. Every line is now
  // recomputed EXACTLY (not just floor-checked) from real D1 data via
  // lib/pricing.ts — see that file's header for the previous floor-only
  // limitation this replaces, for both customizable products and bundles.
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

    const result = verifyCartLine(
      {
        productId: line.productId,
        bundleId: line.bundleId,
        qty,
        lineTotal,
        selection: line.selection,
        bundleItems: line.bundleItems,
      },
      menu
    );
    if (!result.ok) {
      return json({ error: result.error || 'Item price could not be verified. Please refresh your cart and try again.' }, 400);
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
  let appliedCouponCode: string | null = null;

  if (body.couponCode) {
    const result = await validateCoupon(env, body.couponCode, recomputedTotal);
    if (!result.valid) {
      return json({ error: result.error || 'This coupon code is not valid.' }, 400);
    }
    finalTotal = result.finalTotal as number;
    discountAmount = result.discountAmount as number;
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
      (order_num, customer_name, address, email, phone, notes, total, status, payment_method, coupon_code, discount_amount, marketing_consent)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'received', 'cod', ?, ?, ?)`
  )
    .bind(orderNum, customer.name, customer.address, email, customer.phone, customer.notes || '', finalTotal, appliedCouponCode, discountAmount, body.marketingConsent ? 1 : 0)
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
  //
  // Gated on marketing_consent — a customer who chose "Necessary only"
  // in the cookie banner should not have their order sent to Meta/
  // TikTok/GA4 server-side either; the earlier version of this code
  // fired regardless of that choice, which was a real compliance gap.
  if (body.marketingConsent) {
    ctx.waitUntil(
      trackPurchaseServerSide(
        env,
        { orderNum, total: finalTotal, email, phone: customer.phone, items },
        request
      )
    );
  }

  return json({ orderNum, id: orderId, status: 'received', total: finalTotal, discountAmount }, 201);
}
