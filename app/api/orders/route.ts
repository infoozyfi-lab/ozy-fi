import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, makeOrderNum, findOrdersByPhone, makeCouponCode } from '@/lib/api-helpers';
import { trackPurchaseServerSide } from '@/lib/server-tracking';
import { validateCoupon, normalizeCouponCode } from '@/lib/coupons';
import { loadMenuData } from '@/lib/menu-data';
import { normalizeMenuBlob } from '@/lib/menu-i18n';
import { verifyCartLine } from '@/lib/pricing';
import { findBestActiveScheduledOffer } from '@/lib/scheduledOffers';

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

  // --- Growth features: this phone's order history (Feature 2 + 3) ---
  // One lookup, reused by both the first-order welcome discount (was
  // there ANY order before this one, of any status?) and the stamp-card
  // loyalty count (how many non-cancelled orders, including the one being
  // placed right now?) below. Computed here, before either the item-price
  // verification or the order is written, from the phone number ON THIS
  // REQUEST — never from anything the client claims about its own
  // eligibility, same "never trust the client" principle as the price
  // checks that follow.
  const priorOrders = await findOrdersByPhone(env, customer.phone);
  const isFirstOrderEver = priorOrders.length === 0;

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
  let welcomeDiscountApplied = false;
  let scheduledOfferApplied: { id: string; label: string } | null = null;

  if (body.couponCode) {
    const result = await validateCoupon(env, body.couponCode, recomputedTotal);
    if (!result.valid) {
      return json({ error: result.error || 'This coupon code is not valid.' }, 400);
    }
    finalTotal = result.finalTotal as number;
    discountAmount = result.discountAmount as number;
    appliedCouponCode = normalizeCouponCode(body.couponCode);
  } else {
    // --- Automatic discounts: welcome discount vs. scheduled offer
    // (Feature 2 vs. Feature 5) ---
    // Neither requires the customer to type anything, so — unlike a
    // manually-entered coupon, which always wins outright above — these
    // two can both be "available" on the same order and must not stack.
    // Growth features batch 2 explicitly authorized touching this same
    // if/else (previously just an if/else-if between coupon and welcome
    // discount) to fold the scheduled offer in "consistently": compute
    // every automatic candidate's discount amount off the SAME verified
    // subtotal, then apply whichever is largest — the one most
    // favorable to the customer, same rule as coupon-vs-welcome before
    // it. Checked against THIS request's own moment in time (never a
    // client-supplied "offer was active when I added to cart" flag) via
    // lib/scheduledOffers.ts's findBestActiveScheduledOffer, using the
    // real server clock evaluated in Helsinki time.
    const candidates: Array<{ amount: number; apply: () => void }> = [];

    const welcomePct = Number(rawMenu.settings?.first_order_discount_percent) || 0;
    if (isFirstOrderEver && welcomePct > 0) {
      const amount = Math.min(Math.round(recomputedTotal * (welcomePct / 100) * 100) / 100, recomputedTotal);
      candidates.push({
        amount,
        apply: () => {
          discountAmount = amount;
          appliedCouponCode = 'WELCOME';
          welcomeDiscountApplied = true;
        },
      });
    }

    const activeOffer = findBestActiveScheduledOffer(menu.scheduledOffers);
    if (activeOffer) {
      const amount = Math.min(
        Math.round(recomputedTotal * (activeOffer.discountPercent / 100) * 100) / 100,
        recomputedTotal
      );
      candidates.push({
        amount,
        apply: () => {
          discountAmount = amount;
          scheduledOfferApplied = { id: activeOffer.id, label: activeOffer.label };
        },
      });
    }

    if (candidates.length) {
      const best = candidates.reduce((a, b) => (b.amount > a.amount ? b : a));
      best.apply();
      finalTotal = Math.round((recomputedTotal - discountAmount) * 100) / 100;
    }
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
      `INSERT INTO order_items (order_id, product_id, name, qty, line_total, details, selection_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      orderId, line.productId || null, line.name, line.qty, line.lineTotal, JSON.stringify(line.details || []),
      // Growth features (Feature 1 — reorder) — the same structured
      // pricing data just verified above via verifyCartLine, saved
      // alongside the order so a later reorder can rebuild this exact
      // line and recompute it at CURRENT prices (lib/pricing.ts's
      // computeCurrentProductPrice/computeCurrentBundlePrice) instead of
      // trusting this row's own line_total. `bundleId` is included here
      // (not just left implicit via `product_id`, which for a bundle
      // line already holds the bundle's own id) so the reorder route
      // never has to guess whether a given product_id refers to a real
      // product or a bundle.
      JSON.stringify({ selection: line.selection, bundleId: line.bundleId, bundleItems: line.bundleItems })
    )
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
  if (appliedCouponCode && !welcomeDiscountApplied) {
    // Only for a REAL stored coupon — the synthetic 'WELCOME' code above
    // has no row in the coupons table to increment.
    ctx.waitUntil(
      env.DB.prepare('UPDATE coupons SET times_used = times_used + 1 WHERE code = ?')
        .bind(appliedCouponCode)
        .run()
    );
  }

  // --- Stamp card / loyalty (Feature 3) ---
  // Counts this phone's non-cancelled orders, INCLUDING the one just
  // placed above — a freshly-created order always starts as 'received'
  // (never 'cancelled'), so this is always exactly
  // (priorOrders filtered to non-cancelled) + 1; no separate re-query
  // needed. A cancelled order is excluded from `priorOrders` here the
  // same way it would be excluded from any FUTURE count once it's
  // cancelled — it can never itself trigger a reward (its own count
  // included it as non-cancelled only for the brief instant it existed
  // before being cancelled, which is the same "can't retroactively
  // un-trigger a reward" tradeoff already accepted for coupon usage
  // counting elsewhere in this route — flagged in this delivery's
  // summary as a case not fully covered).
  const nonCancelledOrderCount = priorOrders.filter((o) => o.status !== 'cancelled').length + 1;
  let loyaltyRewardCode: string | null = null;
  const stampRewardPct = Number(rawMenu.settings?.stamp_card_reward_percent) || 0;

  if (stampRewardPct > 0 && nonCancelledOrderCount > 0 && nonCancelledOrderCount % 5 === 0) {
    loyaltyRewardCode = makeCouponCode('LOYALTY');
    // Reuses the exact same coupons row shape/creation logic as the admin
    // coupon-creation endpoint (app/api/admin/coupons/route.ts) — a
    // percent-off, single-use, no-minimum, no-expiry code. Awaited
    // (unlike the coupon-usage counter above, which is fire-and-forget)
    // because this code is handed to the customer in THIS response —
    // unlike incrementing a counter on a coupon that already exists, the
    // row has to actually be in D1 before the response goes out, or a
    // customer trying it immediately could hit "coupon not found".
    await env.DB.prepare(
      `INSERT INTO coupons (code, discount_type, discount_value, active, usage_limit)
       VALUES (?, 'percent', ?, 1, 1)`
    ).bind(loyaltyRewardCode, stampRewardPct).run();
  }

  // --- "Ozy Wow Moment" (Feature 6) — random per-order surprise reward ---
  // A REAL random roll, server-side, using this request's own moment —
  // never anything client-influenced (there's no client input involved
  // in this decision at all). Both settings are 0/unset by default, so
  // this does nothing until an admin explicitly configures odds AND a
  // reward percentage. Mirrors the stamp-card reward immediately above:
  // the exact same coupons row shape, and `await`-ed (not fire-and-
  // forget) for the same reason — this code is handed to the customer in
  // THIS response, so the row must exist in D1 before the response goes
  // out. Never applied to the order that triggered it (that would need
  // this check to happen before the order's own total was known, which
  // is backwards) — it's a single-use code for a FUTURE order, same as
  // the stamp-card/referral rewards.
  let wowMomentRewardCode: string | null = null;
  const wowChancePct = Number(rawMenu.settings?.wow_moment_chance_percent) || 0;
  const wowRewardPct = Number(rawMenu.settings?.wow_moment_reward_percent) || 0;

  if (wowChancePct > 0 && wowRewardPct > 0 && Math.random() * 100 < wowChancePct) {
    wowMomentRewardCode = makeCouponCode('WOW');
    await env.DB.prepare(
      `INSERT INTO coupons (code, discount_type, discount_value, active, usage_limit)
       VALUES (?, 'percent', ?, 1, 1)`
    ).bind(wowMomentRewardCode, wowRewardPct).run();
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

  return json({
    orderNum,
    id: orderId,
    status: 'received',
    total: finalTotal,
    discountAmount,
    welcomeDiscountApplied,
    scheduledOfferApplied,
    loyalty: { orderCount: nonCancelledOrderCount, rewardCode: loyaltyRewardCode },
    wowMomentRewardCode,
  }, 201);
}
