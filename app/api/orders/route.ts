import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, makeOrderNum, findOrdersByPhone, findPendingStampCardReward, makeCouponCode } from '@/lib/api-helpers';
import { trackPurchaseServerSide } from '@/lib/server-tracking';
import { validateCoupon, normalizeCouponCode } from '@/lib/coupons';
import { loadMenuData } from '@/lib/menu-data';
import { normalizeMenuBlob } from '@/lib/menu-i18n';
import { verifyCartLine } from '@/lib/pricing';
import { findBestActiveScheduledOffer } from '@/lib/scheduledOffers';
import type { DiscountSource } from '@/lib/types';

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
  // Stamp-card redesign / discount-source tracking (Part C — "Reorders")
  // — set by context/StoreContext.tsx's placeOrder() when this cart
  // originated from the "Reorder this" button (see
  // app/api/orders/[orderNum]/reorder/route.ts + TrackPageClient.tsx's
  // ReorderButton). Client-supplied and trusted as-is: purely
  // informational/reporting, never used in any price or discount
  // calculation — same trust level already given to marketingConsent.
  isReorder?: boolean;
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

  // --- Stamp card / loyalty (Feature 3, redesigned) — precursor values ---
  // Computed here (before item-price verification) since none of this
  // depends on `items`; the cheapest-eligible-item lookup that DOES need
  // verified items happens further below, right after that loop.
  //
  // Counts this phone's non-cancelled orders, INCLUDING the one being
  // placed right now — a freshly-created order always starts as
  // 'received' (never 'cancelled'), so this is always exactly
  // (priorOrders filtered to non-cancelled) + 1; no separate re-query
  // needed. Same reasoning/caveat as before this redesign: a cancelled
  // order can never itself trigger a reward, and can't retroactively
  // un-trigger one either — an accepted tradeoff, same as coupon usage
  // counting elsewhere in this route.
  const nonCancelledOrderCount = priorOrders.filter((o) => o.status !== 'cancelled').length + 1;
  const stampRewardPct = Number(rawMenu.settings?.stamp_card_reward_percent) || 0;
  // Rewards dashboard consolidation — the "every Nth order" threshold,
  // admin-configurable (stamp_card_every_n_orders). Blank/unset falls
  // back to 5. Floored and clamped to at least 1 so a stray non-numeric
  // or negative stored value can never turn into a `% 0` (NaN, silently
  // never rewarding) or `% -3`.
  const stampEveryNOrders = Math.max(1, Math.floor(Number(rawMenu.settings?.stamp_card_every_n_orders) || 5));
  const reachedStampMilestone = stampRewardPct > 0 && nonCancelledOrderCount > 0 && nonCancelledOrderCount % stampEveryNOrders === 0;

  // Stamp-card redesign (Part A) — the business owner's chosen list of
  // eligible product ids, same JSON-array-in-a-flat-settings-key pattern
  // already established by admin_settings.popular_product_ids (see
  // app/admin/dashboard/page.tsx's HomepageDisplaySettings) — reused here
  // rather than inventing a new storage shape.
  let stampEligibleProductIds: string[] = [];
  try {
    const parsed = JSON.parse(rawMenu.settings?.stamp_card_eligible_product_ids || '[]');
    if (Array.isArray(parsed)) stampEligibleProductIds = parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    stampEligibleProductIds = [];
  }

  // A customer can only have ONE pending stamp-card reward at a time (see
  // worker/migrations/010_stamp_card_redesign_and_source_tracking.sql) —
  // looked up once here and reused below both to decide whether THIS
  // order should redeem it and, after the order is written, whether to
  // mark it redeemed. Skipped entirely while the feature is off
  // (stampRewardPct <= 0), so disabling it pauses both new-earning and
  // redemption of anything already pending — a judgment call, documented
  // in this task's delivery summary.
  const existingPendingReward = stampRewardPct > 0 ? await findPendingStampCardReward(env, customer.phone) : null;

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

  // --- Stamp card / loyalty (Feature 3, redesigned) — cheapest eligible
  // cart line ---
  // Operates on `items` AFTER the verification loop above has confirmed
  // every line's lineTotal is real (matches lib/pricing.ts's recomputed
  // price) — safe to derive a unit price as lineTotal / qty without
  // re-deriving it from menu data a second time. "Cheapest" compares
  // PER-UNIT price (a line's lineTotal already reflects its own qty), and
  // only ONE unit of the cheapest eligible line gets discounted — never
  // the whole line, never the whole order.
  let cheapestEligibleUnitPrice: number | null = null;
  if (stampRewardPct > 0 && stampEligibleProductIds.length > 0) {
    for (const line of items) {
      if (!line.productId || !stampEligibleProductIds.includes(line.productId)) continue;
      const qty = Number(line.qty);
      const lineTotal = Number(line.lineTotal);
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(lineTotal)) continue;
      const unitPrice = lineTotal / qty;
      if (cheapestEligibleUnitPrice === null || unitPrice < cheapestEligibleUnitPrice) {
        cheapestEligibleUnitPrice = unitPrice;
      }
    }
  }

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
  let discountSource: DiscountSource | null = null;
  // Set inside the stamp-card candidate's apply() closure below — true
  // when the applied reward came from a pre-existing pending reward
  // (about to be marked redeemed after the order is written), false when
  // it's a fresh milestone reward being consumed immediately (nothing to
  // persist), null if the stamp-card candidate never won at all.
  let stampCardWonViaExistingPending: boolean | null = null;

  if (body.couponCode) {
    const result = await validateCoupon(env, body.couponCode, recomputedTotal);
    if (!result.valid) {
      return json({ error: result.error || 'This coupon code is not valid.' }, 400);
    }
    finalTotal = result.finalTotal as number;
    discountAmount = result.discountAmount as number;
    appliedCouponCode = normalizeCouponCode(body.couponCode);
    // Discount-source tracking (Part B) — a referral-minted coupon is
    // distinguished from a manually-created one the exact way the rest of
    // this codebase already does: coupons.referral_email is set only for
    // the former (see app/api/referral/route.ts) — traced rather than
    // guessed.
    discountSource = result.coupon?.referral_email ? 'referral' : 'manual_coupon';
  } else {
    // --- Automatic discounts: welcome discount vs. scheduled offer vs.
    // stamp card (Feature 2 vs. Feature 5 vs. Feature 3) ---
    // None of these require the customer to type anything, so — unlike a
    // manually-entered coupon, which always wins outright above — all
    // three can be "available" on the same order and must not stack.
    // Growth features batch 2 explicitly authorized touching this same
    // if/else (previously just an if/else-if between coupon and welcome
    // discount) to fold the scheduled offer in "consistently"; the
    // stamp-card redesign explicitly extends the SAME pattern rather than
    // adding a separate parallel check: compute every automatic
    // candidate's discount amount off the SAME verified subtotal (or, for
    // stamp card, off its own eligible-item's unit price), then apply
    // whichever amount is largest — the one most favorable to the
    // customer, same rule as coupon-vs-welcome before it.
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
          discountSource = 'first_order_welcome';
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
          discountSource = 'scheduled_offer';
        },
      });
    }

    // Stamp card (Part A redesign) — only a candidate when there's an
    // eligible item in THIS cart to actually discount, and either an
    // existing pending reward is waiting to be redeemed or this order
    // freshly reaches the milestone. The percentage used is the pending
    // reward's own banked percentage when redeeming one (captured at the
    // moment it was earned, never re-read from current settings — see the
    // migration file), otherwise the current setting.
    if (cheapestEligibleUnitPrice !== null && (existingPendingReward || reachedStampMilestone)) {
      const usedPercent = existingPendingReward ? existingPendingReward.reward_percent : stampRewardPct;
      const amount = Math.min(
        Math.round(cheapestEligibleUnitPrice * (usedPercent / 100) * 100) / 100,
        cheapestEligibleUnitPrice
      );
      const viaExistingPending = Boolean(existingPendingReward);
      candidates.push({
        amount,
        apply: () => {
          discountAmount = amount;
          discountSource = 'stamp_card';
          stampCardWonViaExistingPending = viaExistingPending;
        },
      });
    }

    if (candidates.length) {
      const best = candidates.reduce((a, b) => (b.amount > a.amount ? b : a));
      best.apply();
      finalTotal = Math.round((recomputedTotal - discountAmount) * 100) / 100;
    }
  }

  // --- Stamp card / loyalty — pending-reward bookkeeping decision ---
  // Decided here (after the coupon-vs-automatic-discounts branch above
  // has fully run, so discountSource/stampCardWonViaExistingPending are
  // final) but the actual DB write happens further below, after the order
  // is inserted (it needs orderNum). An earned reward must never simply
  // vanish for having the bad luck of coinciding with a bigger discount,
  // or with the customer using a manual coupon instead — see this
  // delivery's summary for the worked examples covering every branch here.
  let createNewPendingReward = false;
  let redeemPendingRewardId: number | null = null;
  if (stampRewardPct > 0) {
    if (existingPendingReward) {
      // Only redeem it if it's the one that actually won the comparison
      // above (or was the outright winner via a manual coupon path, which
      // never touches discountSource — so a coupon being used instead
      // simply leaves this pending reward untouched, still pending, same
      // as losing to a bigger automatic discount or the cart having no
      // eligible item this time).
      if ((discountSource as DiscountSource) === 'stamp_card' && stampCardWonViaExistingPending === true) {
        redeemPendingRewardId = existingPendingReward.id;
      }
    } else if (reachedStampMilestone) {
      // Fresh milestone this order. If it was consumed immediately (won
      // the automatic-discount comparison), there's nothing to persist.
      // Otherwise — no eligible item at all, it lost to a bigger
      // discount, or a manual coupon was used instead — bank it as a new
      // pending reward rather than letting it vanish.
      const consumedImmediately = (discountSource as DiscountSource) === 'stamp_card' && stampCardWonViaExistingPending === false;
      if (!consumedImmediately) {
        createNewPendingReward = true;
      }
    }
  }

  const orderNum = makeOrderNum();

  // --- "Ozy Wow Moment" (Feature 6) — random per-order surprise reward ---
  // A REAL random roll, server-side, using this request's own moment —
  // never anything client-influenced (there's no client input involved
  // in this decision at all). Both settings are 0/unset by default, so
  // this does nothing until an admin explicitly configures odds AND a
  // reward percentage. Moved to run BEFORE the order insert (discount-
  // source tracking task) so the roll's outcome is known in time to set
  // orders.triggered_wow_moment on that same insert — its own logic is
  // otherwise completely unchanged from before this task. Never applied
  // to the order that triggered it (that would need this check to happen
  // before the order's own total was known, which is backwards) — it's a
  // single-use code for a FUTURE order, same as the stamp-card/referral
  // rewards.
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
  // Discount-source tracking (Part B) — kept as its OWN column rather than
  // folded into discount_source: this order may separately have a real
  // discount_source from one of the other mechanisms at the same time,
  // since Wow Moment's reward is for the NEXT order, not this one.
  const triggeredWowMoment = Boolean(wowMomentRewardCode);

  // orders.email is NOT NULL (worker/schema.sql) — storing '' for a
  // skipped email needs no migration, vs. making the column nullable.
  // Kept consistent everywhere else that reads it: '' is already falsy in
  // JS, so display code and lib/server-tracking.js's
  // `order.email ? sha256Hex(order.email) : null` already treat it the
  // same as no email, no extra empty-string checks needed there.
  const email = (customer.email || '').trim();

  const insertOrder = await env.DB.prepare(
    `INSERT INTO orders
      (order_num, customer_name, address, email, phone, notes, total, status, payment_method, coupon_code, discount_amount, marketing_consent, discount_source, triggered_wow_moment, is_reorder)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'received', 'cod', ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      orderNum, customer.name, customer.address, email, customer.phone, customer.notes || '', finalTotal,
      appliedCouponCode, discountAmount, body.marketingConsent ? 1 : 0,
      discountSource, triggeredWowMoment ? 1 : 0, body.isReorder ? 1 : 0
    )
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

  // --- Stamp card / loyalty — pending-reward DB write ---
  // Fire-and-forget, after the order row is safely committed — same
  // reasoning as the coupon-usage counter above: this is secondary
  // bookkeeping (nothing here is handed back to the customer as a code
  // they need immediately), not something that should roll back an
  // otherwise-successful order if it somehow failed. The two branches are
  // mutually exclusive by construction (see the decision above).
  if (redeemPendingRewardId !== null) {
    ctx.waitUntil(
      env.DB.prepare(
        `UPDATE stamp_card_pending_rewards SET redeemed_at = datetime('now'), redeemed_order_num = ? WHERE id = ?`
      ).bind(orderNum, redeemPendingRewardId).run()
    );
  } else if (createNewPendingReward) {
    ctx.waitUntil(
      env.DB.prepare(
        `INSERT INTO stamp_card_pending_rewards (phone, reward_percent, earned_order_num) VALUES (?, ?, ?)`
      ).bind(customer.phone, stampRewardPct, orderNum).run()
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

  return json({
    orderNum,
    id: orderId,
    status: 'received',
    total: finalTotal,
    discountAmount,
    discountSource,
    welcomeDiscountApplied,
    scheduledOfferApplied,
    loyalty: { orderCount: nonCancelledOrderCount, everyNOrders: stampEveryNOrders, pendingRewardCreated: createNewPendingReward },
    wowMomentRewardCode,
  }, 201);
}
