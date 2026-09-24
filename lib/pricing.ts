// Server-side, authoritative re-computation of what a cart line SHOULD
// cost — used by POST /api/orders (app/api/orders/route.ts) to verify
// every line's `lineTotal` before an order is ever written to D1.
//
// Money-correctness pass (see this feature's brief). Closes two gaps in
// the previous check:
//   1. Customizable items (toppings/size/base/sauce/cheese/fillings/
//      sauce-stripe/dip) were only floor-checked (lineTotal >= qty ×
//      product.price) — this recomputes the *exact* expected price from
//      real D1 option deltas and rejects any mismatch.
//   2. Bundle line items had no price verification at all (no matching
//      product/addon row for a bundle's own id) — this now verifies a
//      bundle's base price plus every filled slot item's customization
//      extra.
//
// The formula below is a direct port of context/StoreContext.tsx's
// calcUnitPrice — same terms, same order, same "unrecognized option id
// contributes 0" fallback — driven by the same normalized menu shape
// (lib/menu-i18n.ts's MenuBlob) that /api/menu and SSR pages already use,
// via lib/menu-data.ts's loadMenuData(). Reusing that shape (rather than
// re-querying/re-deriving option deltas separately here) is deliberate —
// see this feature's summary for why: it's the one place that already
// turns raw D1 rows into "what should this actually cost," and it's also
// where the effective per-unit base price (offer_price when set, else
// price — see normalizeProducts()) already lives, which the *previous*
// floor check did not use (it read the raw `products.price` column
// directly) — see this feature's summary for that pre-existing gap.
import type { CartLineSelectionData, CartLineBundleItem, MenuBlob, DiscountValue, OptionItem } from './types';

export interface PriceCheckResult {
  ok: boolean;
  error?: string;
  expectedUnitPrice?: number;
}

// "a cent or two" per this feature's brief — generous enough for
// legitimate floating-point rounding across up to ~10 summed deltas,
// tight enough that a genuine mismatch (a tampered lineTotal) never
// slips through it. Not scaled by qty: qty is capped at 50 elsewhere
// (app/api/orders/route.ts) and every summed term here is already a
// per-unit euro amount with at most 2 decimal places, so drift doesn't
// compound with qty the way it would from repeated float addition.
const TOLERANCE = 0.02;

const MAX_TOPPINGS = 20;
const MAX_FILLING_QTY = 20;
const MAX_BUNDLE_ITEMS = 50;

function findDelta(options: { id: string; delta: number }[], id: string | undefined): number {
  if (!id) return 0;
  return options.find((o) => o.id === id)?.delta || 0;
}

// A `selection` comes straight from request.json() — it could be anything.
// Bounds-checks its shape (never its specific option ids: an id that
// doesn't match a real option simply contributes 0 below, exactly like
// calcUnitPrice's own `.find(...)?.delta || 0` fallback does client-side —
// there's nothing to "verify" about an id beyond that). The one thing
// that MUST be bounds-checked here is filling quantity: calcUnitPrice
// sums `item.price * qty`, so an untrusted negative qty would subtract
// from the total instead of adding to it — the one real way this data,
// left unchecked, could lower a price rather than only ever raising it.
function validateSelectionShape(selection: unknown): selection is CartLineSelectionData {
  if (!selection || typeof selection !== 'object') return false;
  const s = selection as Record<string, unknown>;
  // Per-product-size brief, Part 2 — the old binary M/L `size` field is
  // retired; no shape check for it anymore. A HISTORICAL selection_json
  // blob (a past order, reordered) may still carry a `size: 'M'|'L'` key
  // from before this brief — that's just an inert, ignored extra property
  // on the parsed object now (this function only checks the keys it
  // cares about), never a validation failure.
  if (!Array.isArray(s.toppingIds) || s.toppingIds.length > MAX_TOPPINGS) return false;
  if (!s.toppingIds.every((t) => typeof t === 'string')) return false;
  if (s.fillings !== undefined) {
    if (typeof s.fillings !== 'object' || s.fillings === null || Array.isArray(s.fillings)) return false;
    for (const qty of Object.values(s.fillings as Record<string, unknown>)) {
      if (!Number.isInteger(qty) || (qty as number) < 0 || (qty as number) > MAX_FILLING_QTY) return false;
    }
  }
  // Pizza-size-feature brief — sizeOptionId added to this list, same
  // "optional, must be a string if present" check as every other option
  // kind's id field. Not bounds-checked against real option ids here (any
  // more than baseId/sauceId/etc. are) — an id that doesn't match a real
  // option simply contributes 0 in calcUnitPriceFromSelection below, same
  // fallback as those.
  for (const key of ['baseId', 'sauceId', 'cheeseId', 'sauceStripeId', 'dipId', 'sizeOptionId'] as const) {
    if (s[key] !== undefined && typeof s[key] !== 'string') return false;
  }
  return true;
}

// Mirrors context/StoreContext.tsx's calcUnitPrice exactly — see this
// file's header. `toppingsEligible` comes from the REAL product row
// (has_toppings), never from anything the client sent: a tampered
// `selection` on a non-customizable product can't add extras that don't
// exist, and there's no client-supplied "toppingsEnabled" flag left to
// tamper with in the other direction (omit extras on a customizable one)
// — see verifyProductLine below.
//
// Per-product-size brief — `sizeOptions` is a REQUIRED parameter, not read
// off `menu` the way base/sauce/cheese/etc. still are, and it must always
// be THIS SPECIFIC LINE'S OWN product's `sizeOptions` (menu.products.find
// (p => p.id === theThisLinesProductId)!.sizeOptions — see every call site
// below). This is the money-critical fix this brief asked for: option ids
// are globally unique (`options.id TEXT PRIMARY KEY`, worker/schema.sql),
// so a tampered `sizeOptionId` naming a DIFFERENT product's (more
// expensive, or differently-priced) size tier simply isn't present in
// THIS product's own `sizeOptions` array and contributes 0 via findDelta's
// existing "not found" fallback below — it can never resolve to another
// product's price. Verified for real in this brief's runtime harness (see
// the delivery summary), not just reasoned about.
export function calcUnitPriceFromSelection(
  basePrice: number,
  toppingsEligible: boolean,
  selection: CartLineSelectionData,
  menu: MenuBlob,
  sizeOptions: OptionItem[]
): number {
  let unit = basePrice;
  if (!toppingsEligible) return unit;

  const toppingPrice = menu.toppings[0]?.delta || 0;
  unit += selection.toppingIds.length * toppingPrice;
  unit += findDelta(menu.baseOptions, selection.baseId);
  unit += findDelta(menu.sauceOptions, selection.sauceId);
  unit += findDelta(menu.cheeseOptions, selection.cheeseId);
  // Per-product-size brief — looked up against THIS product's own
  // sizeOptions (the new parameter above), never a shared/global list —
  // see this function's own header comment for the money-correctness
  // reasoning.
  unit += findDelta(sizeOptions, selection.sizeOptionId);

  const allFillings = menu.fillingCategories.flatMap((c) => c.items);
  for (const [id, qty] of Object.entries(selection.fillings || {})) {
    if (!qty) continue;
    const item = allFillings.find((f) => f.id === id);
    if (item) unit += item.price * qty;
  }

  unit += findDelta(menu.sauceStripeOptions, selection.sauceStripeId);
  unit += findDelta(menu.dipOptions, selection.dipId);

  return unit;
}

interface ProductLineInput {
  productId?: string | null;
  qty: number;
  lineTotal: number;
  selection?: unknown;
}

// Verifies a normal product or addon (drink/dip/snack) cart line. Every
// line must resolve to a REAL product or addon id — previously, a
// productId that matched neither (a typo, a since-deleted item, or a
// completely fabricated id — which is also exactly what every bundle
// line's own id looked like to this same check, before bundle lines got
// their own path — see verifyBundleLine) skipped price verification
// entirely, since the floor check only ran `if (basePrice !== undefined)`.
export function verifyProductLine(line: ProductLineInput, menu: MenuBlob): PriceCheckResult {
  if (!line.productId) return { ok: false, error: 'An item in your cart is missing a product reference.' };

  const product = menu.products.find((p) => p.id === line.productId);
  const addon = product
    ? undefined
    : [...menu.drinks, ...menu.dipCups, ...menu.snacks].find((a) => a.id === line.productId);

  if (!product && !addon) {
    return { ok: false, error: 'An item in your cart is no longer available. Please refresh your cart and try again.' };
  }

  const name = product?.name ?? addon?.name ?? line.productId;

  if (addon) {
    // Addons are never customizable — same "exact match, not just a
    // floor" check as a plain product, just with no extras to compute.
    const expectedUnit = addon.price;
    if (Math.abs(expectedUnit * line.qty - line.lineTotal) > TOLERANCE) {
      return { ok: false, error: `Price mismatch for "${name}". Please refresh your cart and try again.` };
    }
    return { ok: true, expectedUnitPrice: expectedUnit };
  }

  // product is defined here (the `!product && !addon` guard above ruled
  // out both being undefined).
  const basePrice = product!.price ?? 0;
  const toppingsEligible = Boolean(product!.toppingsEnabled);

  let expectedUnit = basePrice;
  if (line.selection !== undefined) {
    if (!validateSelectionShape(line.selection)) {
      return { ok: false, error: `Invalid customization data for "${name}". Please refresh your cart and try again.` };
    }
    // product!.sizeOptions — THIS product's own size tiers (see
    // calcUnitPriceFromSelection's header comment for why passing the
    // right product's own list here is what actually makes a
    // cross-product sizeOptionId tamper attempt fail).
    expectedUnit = calcUnitPriceFromSelection(basePrice, toppingsEligible, line.selection, menu, product!.sizeOptions || []);
  }
  // No `selection` sent at all is treated as "no customization, base
  // price only" — the same thing a real customer gets by picking a
  // customizable product with every option left at its default (toppings
  // deltas are additive-only, so this can never be *cheaper* than any
  // real combination of choices, only ever equal to the cheapest one).

  if (Math.abs(expectedUnit * line.qty - line.lineTotal) > TOLERANCE) {
    return { ok: false, error: `Price mismatch for "${name}". Please refresh your cart and try again.` };
  }
  return { ok: true, expectedUnitPrice: expectedUnit };
}

interface BundleLineInput {
  bundleId?: string;
  qty: number;
  lineTotal: number;
  bundleItems?: unknown;
}

// Verifies a bundle cart line: bundle.price (covers every slot's base
// item, regardless of which product was actually picked for a "choice"
// slot — see worker/schema.sql's comment on the bundles table) plus each
// filled slot unit's own customization extra, same principle as a
// standalone product's toppings/size extras above.
export function verifyBundleLine(line: BundleLineInput, menu: MenuBlob): PriceCheckResult {
  if (!line.bundleId) return { ok: false, error: 'A bundle in your cart is missing a bundle reference.' };

  const bundle = menu.bundles.find((b) => b.id === line.bundleId);
  if (!bundle) {
    return { ok: false, error: 'A bundle in your cart is no longer available. Please refresh your cart and try again.' };
  }

  const items = Array.isArray(line.bundleItems) ? line.bundleItems : [];
  if (items.length > MAX_BUNDLE_ITEMS) {
    return { ok: false, error: `Too many items in "${bundle.title}".` };
  }

  let extrasTotal = 0;
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: `Invalid item data in "${bundle.title}". Please refresh your cart and try again.` };
    }
    const item = raw as CartLineBundleItem;
    if (typeof item.productId !== 'string' || !item.productId) {
      return { ok: false, error: `Invalid item data in "${bundle.title}". Please refresh your cart and try again.` };
    }

    const product = menu.products.find((p) => p.id === item.productId);
    if (!product) {
      return { ok: false, error: `"${bundle.title}" contains an item that is no longer available. Please refresh your cart and try again.` };
    }

    // No selection on this filled unit = uncustomized (quick-pick or
    // fixed slot) — extra 0, nothing to add. This is the bundle
    // equivalent of a standalone product line with no `selection`
    // (see verifyProductLine) — additive-only extras mean omitting one
    // can never make the bundle cheaper than its real cheapest
    // (uncustomized) form.
    if (item.selection === undefined) continue;

    if (!validateSelectionShape(item.selection)) {
      return { ok: false, error: `Invalid customization data in "${bundle.title}". Please refresh your cart and try again.` };
    }
    const basePrice = product.price ?? 0;
    const toppingsEligible = Boolean(product.toppingsEnabled);
    const unit = calcUnitPriceFromSelection(basePrice, toppingsEligible, item.selection, menu, product.sizeOptions || []);
    // Same "customization extra over this product's own base price" the
    // client computes in StoreContext.addToCart's bundleSlotIndex branch
    // (`unitPrice - activeProduct.basePrice!`) — basePrice itself is
    // never added again here; it's already covered by bundle.price.
    extrasTotal += unit - basePrice;
  }

  const expectedUnit = bundle.price + extrasTotal;
  if (Math.abs(expectedUnit * line.qty - line.lineTotal) > TOLERANCE) {
    return { ok: false, error: `Price mismatch for "${bundle.title}". Please refresh your cart and try again.` };
  }
  return { ok: true, expectedUnitPrice: expectedUnit };
}

// Single entry point app/api/orders/route.ts calls per cart line — routes
// to the bundle or product/addon check based on the explicit `bundleId`
// discriminator (see lib/types.ts's CartLine.bundleId comment for why
// that's a dedicated field rather than overloading `productId`).
export function verifyCartLine(
  line: ProductLineInput & BundleLineInput,
  menu: MenuBlob
): PriceCheckResult {
  return line.bundleId ? verifyBundleLine(line, menu) : verifyProductLine(line, menu);
}

// ---------------------------------------------------------------------
// Growth features (reorder) — GET /api/orders/[orderNum]/reorder needs to
// compute what a historical order_item would cost TODAY, not check a
// claimed price against a tolerance the way verifyProductLine/
// verifyBundleLine above do. Kept as separate functions rather than
// reworking verifyProductLine/verifyBundleLine to serve both callers —
// those two are the money-critical path POST /api/orders depends on
// (verified with real worked examples during the price-verification
// pass) and this project's standing rule is to stay tightly scoped, so
// this deliberately touches neither of them. Both still reuse the exact
// same primitives those functions do — calcUnitPriceFromSelection and
// validateSelectionShape — so "current prices, not historical" is
// computed by the one real pricing formula this file owns, not a
// reimplementation of it.
export interface ReorderLineResult {
  ok: boolean;
  error?: string;
  productId?: string;
  bundleId?: string;
  name?: string;
  image?: string | null;
  unitPrice?: number;
  selection?: CartLineSelectionData;
  bundleItems?: CartLineBundleItem[];
}

// Resolves a plain product or addon (drink/dip/snack) line at CURRENT
// prices. A selection that no longer validates (shape changed, or was
// simply never stored — see worker/schema.sql's selection_json comment
// for pre-migration rows) is treated as "no customization" rather than
// an error, same fallback verifyProductLine uses for an omitted
// `selection` — never a reason to skip an otherwise-reorderable item.
export function computeCurrentProductPrice(
  productId: string | null | undefined,
  selection: unknown,
  menu: MenuBlob
): ReorderLineResult {
  if (!productId) return { ok: false, error: 'Missing product reference.' };

  const product = menu.products.find((p) => p.id === productId);
  const addon = product
    ? undefined
    : [...menu.drinks, ...menu.dipCups, ...menu.snacks].find((a) => a.id === productId);

  if (!product && !addon) {
    return { ok: false, error: 'This item is no longer on the menu.' };
  }

  if (addon) {
    return { ok: true, productId, name: addon.name, image: addon.image, unitPrice: addon.price };
  }

  const basePrice = product!.price ?? 0;
  const toppingsEligible = Boolean(product!.toppingsEnabled);
  let unitPrice = basePrice;
  let resolvedSelection: CartLineSelectionData | undefined;
  if (selection !== undefined && validateSelectionShape(selection)) {
    resolvedSelection = selection;
    unitPrice = calcUnitPriceFromSelection(basePrice, toppingsEligible, selection, menu, product!.sizeOptions || []);
  }
  return { ok: true, productId, name: product!.name, image: product!.image, unitPrice, selection: resolvedSelection };
}

// Resolves a bundle line at CURRENT prices — same "bundle base price plus
// each filled slot item's real customization extra" formula as
// verifyBundleLine, just computing a fresh total instead of checking one.
// If the bundle itself, or any one of its filled slot items' products, no
// longer exists, the WHOLE bundle line is treated as unavailable (not
// just the missing sub-item) — a bundle with a silently-dropped slot item
// isn't the same bundle the customer originally ordered, so this reorder
// feature skips it entirely (and counts it in the "N items skipped"
// notice) rather than guessing at a partial substitute.
export function computeCurrentBundlePrice(
  bundleId: string | undefined,
  bundleItems: unknown,
  menu: MenuBlob
): ReorderLineResult {
  if (!bundleId) return { ok: false, error: 'Missing bundle reference.' };

  const bundle = menu.bundles.find((b) => b.id === bundleId);
  if (!bundle) return { ok: false, error: 'This bundle is no longer available.' };

  const items = Array.isArray(bundleItems) ? bundleItems : [];
  let extrasTotal = 0;
  const resolvedItems: CartLineBundleItem[] = [];

  for (const raw of items) {
    if (!raw || typeof raw !== 'object' || typeof (raw as CartLineBundleItem).productId !== 'string') {
      return { ok: false, error: `"${bundle.title}" has invalid item data.` };
    }
    const item = raw as CartLineBundleItem;
    const product = menu.products.find((p) => p.id === item.productId);
    if (!product) {
      return { ok: false, error: `"${bundle.title}" contains an item that is no longer available.` };
    }

    if (item.selection !== undefined && validateSelectionShape(item.selection)) {
      const basePrice = product.price ?? 0;
      const toppingsEligible = Boolean(product.toppingsEnabled);
      const unit = calcUnitPriceFromSelection(basePrice, toppingsEligible, item.selection, menu, product.sizeOptions || []);
      extrasTotal += unit - basePrice;
      resolvedItems.push({ productId: item.productId, selection: item.selection });
    } else {
      resolvedItems.push({ productId: item.productId });
    }
  }

  return {
    ok: true,
    bundleId,
    name: bundle.title,
    image: bundle.image,
    unitPrice: bundle.price + extrasTotal,
    bundleItems: resolvedItems,
  };
}

// ---------------------------------------------------------------------
// Growth features — shared discount-value calculation (color-palette-
// and-discount-pattern brief, part 2 — "shared discount-value pattern").
// See lib/types.ts's DiscountValue for the shape itself and why it
// exists. This is the ONE place that turns a DiscountValue + a base
// amount into an actual euro discount, used by app/api/orders/route.ts
// for all four automatic discounts (welcome, scheduled offer, stamp
// card, Ozy Wow Moment's minted coupon) and by lib/coupons.ts's
// validateCoupon() (manual coupons + referral) — so a customer's final
// discount is computed identically no matter which of the five features
// produced it.
//
// The rounding/clamping convention below is NOT new — it's the exact
// `Math.min(Math.round(raw * 100) / 100, cap)` pattern that was already
// duplicated across app/api/orders/route.ts (three times) and
// lib/coupons.ts (once) before this task; this just gives that one
// pattern one implementation.

// baseAmount: the euro amount this discount applies against — an order
// subtotal for the welcome discount/scheduled offer/manual coupon, or a
// single cheapest-eligible-item's unit price for the stamp card. Always
// clamped to [0, baseAmount] — a discount can never take something below
// free (e.g. a flat "5€ off" amount-type discount on a 3€ base) or above
// 100% of what it's discounting.
export function computeDiscountAmount(discount: DiscountValue | null | undefined, baseAmount: number): number {
  if (!discount || !Number.isFinite(discount.value) || discount.value <= 0) return 0;
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) return 0;

  const raw = discount.type === 'amount' ? discount.value : baseAmount * (discount.value / 100);
  return Math.max(0, Math.min(Math.round(raw * 100) / 100, baseAmount));
}

// Reads a `{type, value}` pair out of a flat admin_settings-style blob
// keyed as `${key}_type` / `${key}_value` — e.g. readDiscountSetting(
// settings, 'first_order_discount') reads first_order_discount_type /
// first_order_discount_value. This is the same "two sibling keys for one
// concept" convention admin_settings already used elsewhere (e.g.
// stamp_card_eligible_product_ids alongside stamp_card_reward_percent),
// just applied consistently now. A missing/unrecognized `_type` (a
// setting never migrated, or simply never configured) falls back to
// `fallbackType` and reads `_value` as 0 — "0, disabled" for whichever
// type, same behavior every one of these settings already had as a bare
// percent field before this task.
export function readDiscountSetting(
  settings: Record<string, unknown> | null | undefined,
  key: string,
  fallbackType: DiscountValue['type'] = 'percent'
): DiscountValue {
  const rawType = settings?.[`${key}_type`];
  const type: DiscountValue['type'] = rawType === 'percent' || rawType === 'amount' ? rawType : fallbackType;
  const value = Number(settings?.[`${key}_value`]) || 0;
  return { type, value };
}

// Plain-language description of a DiscountValue for customer-facing
// banners/labels (e.g. "10%" vs. "2.00 €") — one shared formatter so
// every growth feature's UI describes its own setting the same way,
// rather than each one re-deciding how to show a euro amount vs. a
// percentage.
export function describeDiscountValue(discount: DiscountValue): string {
  return discount.type === 'percent' ? `${discount.value}%` : `${discount.value.toFixed(2)} €`;
}
