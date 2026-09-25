// Shared type definitions for the ozy.fi storefront app.
//
// These describe the shapes passed between the modules converted in
// TypeScript Migration Phase 1 (lib/analytics, lib/menu-i18n, lib/menu-data,
// context/StoreContext, components/CheckoutModal, components/ProductPage).
// This is a types-only migration — no runtime logic changes — so the types
// here are kept permissive (lots of optional fields, loose raw-row shapes)
// rather than maximally strict, matching this phase's `strict: false` /
// `checkJs: false` tsconfig.

import type { RawScheduledOffer, ScheduledOffer } from './scheduledOffers';
export type { RawScheduledOffer, ScheduledOffer };
import type { SpecialHoursEntry } from './openingHours';
export type { SpecialHoursEntry };

export type Locale = 'fi' | 'en';

// Shared discount-value shape (color-palette-and-discount-pattern brief,
// part 2 — "shared discount-value pattern"). Every growth feature (first-
// order welcome discount, stamp card, referral, scheduled weekday offer,
// Ozy Wow Moment) used to hardcode its own discount shape — most percent-
// only, referral flat-euro-only. This is the ONE shape all five now use
// for "what does this discount setting mean" — not new vocabulary,
// either: it mirrors worker/schema.sql's pre-existing
// `coupons.discount_type` / `coupons.discount_value` columns exactly, so
// a manual/referral coupon and every automatic discount are all
// described the same way. The actual euro-amount calculation from this
// shape lives in lib/pricing.ts's computeDiscountAmount() (reused by
// lib/coupons.ts too, so coupons/referral share the same math as the
// other four features rather than a sixth near-duplicate).
export interface DiscountValue {
  type: 'percent' | 'amount';
  value: number;
}

// Stamp-card redesign / discount-source tracking — the fixed vocabulary
// recorded in orders.discount_source (worker/migrations/
// 010_stamp_card_redesign_and_source_tracking.sql), reflecting whichever
// SINGLE mechanism won the "most favorable discount" comparison in
// app/api/orders/route.ts. Not exhaustive of every code path that can
// touch `total` (e.g. no discount at all is `null`, not a member of this
// union) — see that route for the full decision.
export type DiscountSource = 'manual_coupon' | 'referral' | 'first_order_welcome' | 'stamp_card' | 'scheduled_offer';

// ---------------------------------------------------------------------
// Raw D1 rows — as returned by loadMenuData() (lib/menu-data.ts) and the
// GET /api/menu route that wraps it.
// ---------------------------------------------------------------------

export interface RawCategory {
  id: string;
  title: string;
  title_fi?: string | null;
  sub?: string | null;
  sub_fi?: string | null;
  image?: string | null;
  sort_order?: number;
  // Admin SEO fields (worker/migrations/017_admin_seo_fields.sql) — see
  // that migration's header comment for what each one overrides, and
  // generateMetadata in app/(site)/[locale]/menu/[category]/page.tsx for
  // the fallback chain when unset.
  meta_description?: string | null;
  meta_description_fi?: string | null;
  seo_title?: string | null;
  seo_title_fi?: string | null;
  canonical_url?: string | null;
  noindex?: number | boolean;
  og_image_url?: string | null;
  [key: string]: unknown;
}

export interface RawProduct {
  id: string;
  category_id: string;
  name: string;
  name_fi?: string | null;
  description?: string | null;
  description_fi?: string | null;
  // SEO meta description (worker/migrations/014_product_meta_description.sql)
  // — independent of `description`/`description_fi` above, which stay the
  // customer-facing ingredients text. NULL until the business owner writes
  // one in the admin panel; generateMetadata (app/(site)/[locale]/product/
  // [id]/page.tsx) falls back to `description`/`description_fi` and then a
  // generic sentence when unset.
  meta_description?: string | null;
  meta_description_fi?: string | null;
  price: number | string;
  offer_price?: number | string | null;
  image?: string | null;
  tag?: string | null;
  has_toppings?: number | boolean;
  sort_order?: number;
  active?: number;
  // Option-gating-and-extras-system brief, Task 3 — freeform per-product
  // notes (worker/migrations/023_extras_and_additional_info.sql). NULL/
  // undefined means "nothing written" — see Product.additionalInfo's own
  // comment for the customer-facing fallback (nothing rendered at all).
  additional_info?: string | null;
  additional_info_fi?: string | null;
  // Admin SEO fields (worker/migrations/017_admin_seo_fields.sql) — see
  // that migration's header comment for what each one overrides.
  seo_title?: string | null;
  seo_title_fi?: string | null;
  canonical_url?: string | null;
  noindex?: number | boolean;
  og_image_url?: string | null;
  [key: string]: unknown;
}

export interface RawOption {
  id: string;
  group_id: string;
  label: string;
  label_fi?: string | null;
  price_delta?: number | string;
  color?: string | null;
  [key: string]: unknown;
}

export interface RawOptionGroup {
  id: string;
  // Pizza-size-feature brief — 'size' added alongside the existing kinds.
  // Required/single-select, identical selection behavior to 'base' (see
  // lib/menu-i18n.ts's normalizeMenuBlob and context/StoreContext.tsx's
  // calcUnitPrice). The pre-existing `size: 'M'|'L'` binary upcharge
  // toggle this originally had to coexist with (Selection.size/
  // CartLineSelectionData.size) was retired by the per-product-size
  // brief — `sizeOptionId` (see Selection/CartLineSelectionData below) is
  // now the only size-related field.
  // Option-gating-and-extras-system brief, Task 2 — 'extra' added
  // alongside 'size'. Generalizes the exact same per-product mechanism
  // (product_id-scoped groups — see that field's own comment below) but,
  // unlike 'size' (single-select, required, always has a synthesized base
  // tier), is multi-select and optional, with no synthesized entry — see
  // lib/menu-i18n.ts's normalizeMenuBlob and Product.extraOptions.
  kind: 'base' | 'sauce' | 'cheese' | 'sauce_stripe' | 'dip' | 'topping' | 'filling' | 'size' | 'extra' | string;
  title?: string;
  title_fi?: string | null;
  icon?: string | null;
  // Per-product-size brief (worker/migrations/021_option_group_product_id.sql)
  // — NULL/undefined means a global group, shared by every product, the
  // same behavior every kind but 'size' still has. Only 'size'-kind groups
  // are looked up by this field (lib/menu-i18n.ts's normalizeMenuBlob
  // builds one sizeOptions list PER product_id, not one shared list) — see
  // that file and this brief's delivery summary for the full design.
  product_id?: string | null;
  options?: RawOption[];
  [key: string]: unknown;
}

export interface RawAddon {
  id: string;
  type: 'drink' | 'dip' | 'snack' | string;
  name: string;
  name_fi?: string | null;
  price: number | string;
  image?: string | null;
  [key: string]: unknown;
}

export interface RawBundle {
  id: string;
  title: string;
  title_fi?: string | null;
  description?: string | null;
  description_fi?: string | null;
  image?: string | null;
  price: number | string;
  slots?: string; // JSON-encoded BundleSlotDef[]
  [key: string]: unknown;
}

export type RawSettings = Record<string, string>;

export interface MenuData {
  categories: RawCategory[];
  products: RawProduct[];
  optionGroups: RawOptionGroup[];
  addons: RawAddon[];
  bundles: RawBundle[];
  settings: RawSettings;
  // Growth features batch 2 (Feature 5) — active scheduled weekday
  // offers (e.g. a Monday/Tuesday slow-day discount, a Friday special).
  // Raw row shape + normalization live in lib/scheduledOffers.ts rather
  // than here, since that module is shared with server-side enforcement
  // (app/api/orders/route.ts) and needs to stay dependency-free.
  scheduledOffers: RawScheduledOffer[];
}

// Minimal D1-like binding — only the shape loadMenuData() actually calls.
// Deliberately not pulling in @cloudflare/workers-types here since this
// phase's TS setup is intentionally minimal (see the migration brief) and
// nothing outside lib/menu-data.ts touches this type.
export interface D1ResultLike<T> {
  results: T[];
}
export interface D1PreparedStatementLike<T> {
  all(): Promise<D1ResultLike<T>>;
}
export interface D1DatabaseLike {
  prepare<T = unknown>(query: string): D1PreparedStatementLike<T>;
}
export interface LoadMenuDataEnv {
  DB: D1DatabaseLike;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------
// Normalized/localized shapes — lib/menu-i18n.ts's output, and the shape
// context/StoreContext.tsx's state holds.
// ---------------------------------------------------------------------

export interface Category {
  id: string;
  title: string;
  sub: string;
  image?: string | null;
  sort_order?: number;
}

// `id` and `name` are the only fields StoreContext/ProductPage/analytics
// can always rely on — everything else is optional because this same
// shape is used for two different things: a fully-normalized product from
// lib/menu-i18n.ts's normalizeProducts(), AND a raw D1 row passed straight
// through as StoreContext.openProduct()'s `item` (the /product/[id] page's
// productHint — see that function's comment). Modeling it as one lenient
// shape rather than a stricter union keeps property access on
// `activeProduct` etc. from needing a runtime type guard at every use.
export interface Product {
  id: string;
  name: string;
  cat?: string;
  category_id?: string;
  desc?: string;
  price?: number;
  basePrice?: number;
  offerPrice?: number | null;
  image?: string | null;
  tag?: string | null;
  toppings?: boolean;
  toppingsEnabled?: boolean;
  has_toppings?: number | boolean;
  sort_order?: number;
  // Per-product-size brief — THIS product's own size tiers (e.g. a real
  // pizza's Normaali/Pannu/Perhe), built by lib/menu-i18n.ts's
  // normalizeMenuBlob from whichever `'size'`-kind option_groups row(s)
  // have this product's own id as `product_id` — not a shared/global list
  // (see MenuBlob's own comment history for why the prior, global design
  // couldn't support this). Always at least one entry (falls back to the
  // single "Default"/delta-0 option, same convention as every other
  // option kind, when this product has no size tiers configured) — never
  // undefined on a normalized product; optional here only because this
  // same `Product` shape also covers a raw D1 row passed straight through
  // as StoreContext.openProduct()'s productHint (see this interface's own
  // header comment), which was never run through normalizeMenuBlob.
  sizeOptions?: OptionItem[];
  // Option-gating-and-extras-system brief, Task 2 — THIS product's own
  // admin-defined extras (e.g. "Double meat +4.00€"), built by
  // lib/menu-i18n.ts's normalizeMenuBlob from whichever `'extra'`-kind
  // option_groups row(s) have this product's own id as `product_id` —
  // same per-product mechanism as `sizeOptions` above, generalized to a
  // second kind. Unlike sizeOptions, this is NEVER defaulted to a single
  // fallback/"Default" entry when unconfigured — an extra has no
  // equivalent of a product's base price being auto-included (see this
  // brief's own explicit "no synthesized base tier" instruction), so an
  // unconfigured product simply gets an empty array here, and
  // components/ProductPage.tsx renders no extras row at all for it.
  // Always an array (never undefined) on a normalized product; optional
  // here only because this same `Product` shape also covers a raw D1 row
  // passed straight through as productHint (see this interface's own
  // header comment), which was never run through normalizeMenuBlob.
  extraOptions?: OptionItem[];
  // Option-gating-and-extras-system brief, Task 3 — resolved, localized
  // freeform note text (worker/migrations/
  // 023_extras_and_additional_info.sql's additional_info/
  // additional_info_fi columns), mirroring `desc` above exactly (same
  // resolveText bilingual-fallback rule). Empty string when unset — see
  // components/ProductPage.tsx for the "render nothing at all" rule that
  // distinguishes empty from a real (even short) note.
  additionalInfo?: string;
  // Priority-fixes brief (roadmap gap analysis), Bundle 1 Task 2 — menu
  // search. `name`/`desc` above are already resolved to ONE locale (see
  // normalizeProducts's resolveText calls), so they can't be used to match
  // a query typed in the other language. This carries a single
  // lowercased, whitespace-normalized string built from BOTH locales'
  // name/description (English + Finnish) purely for search matching —
  // never rendered. Optional because the same Product shape is also used
  // for a raw D1 row passed straight through as productHint (see this
  // interface's own comment above), which never has this field.
  searchText?: string;
}

export interface OptionItem {
  id: string;
  label: string;
  delta: number;
  color?: string | null;
}

export interface FillingItem {
  id: string;
  label: string;
  price: number;
}

export interface FillingCategory {
  id: string;
  title: string;
  icon?: string | null;
  items: FillingItem[];
  badge?: string;
}

export interface Addon {
  id: string;
  name: string;
  price: number;
  image?: string | null;
}

export interface BundleSlotDef {
  kind: 'fixed' | 'choice' | string;
  productId?: string;
  label?: string;
  qty?: number;
  // A "choice" slot picks from one or more menu categories — components/
  // BundleModal.js falls back from categoryIds to a single categoryId
  // when the former is absent/empty (older bundle data may only have
  // the singular field).
  categoryIds?: string[];
  categoryId?: string;
  [key: string]: unknown;
}

export interface BundleSlotFilledItem {
  key: string;
  productId: string;
  name: string;
  details: string[];
  extra: number;
  // Structured pricing data for this filled unit — set only when it went
  // through the full ProductPage customization flow (StoreContext.tsx's
  // addToCart, bundleSlotIndex branch), matching `extra` (the customer-
  // visible upcharge over this product's base price). Absent for a
  // quick-pick or fixed-slot item, which is always uncustomized (extra 0).
  // Carried through to CartLine.bundleItems (see addBundleToCart) so
  // POST /api/orders can recompute `extra` itself from real D1 option
  // data instead of trusting the number the client already computed —
  // see money-correctness pass, lib/pricing.ts.
  selection?: CartLineSelectionData;
}

export interface BundleSlot extends BundleSlotDef {
  filled: BundleSlotFilledItem[];
}

export interface Bundle {
  id: string;
  title: string;
  description: string;
  image?: string | null;
  price: number;
  slots: BundleSlotDef[];
}

export interface TrackingConfig {
  ga4Id: string | null;
  metaPixelId: string | null;
  tiktokPixelId: string | null;
  clarityId: string | null;
}

export interface Featured {
  type: string;
  bannerImage?: string;
  bannerTitle?: string;
  bannerPrice?: string;
  productId?: string;
  bundleId?: string;
}

// Phase 7.7 — structured per-day opening hours (see lib/menu-i18n.ts's
// normalizeMenuBlob and components/Visit.js's formatHoursRows). `day` is
// a translation-dictionary key (t.visit.days[d.day]), not a display string.
export interface OpeningHoursDay {
  day: string;
  closed: boolean;
  open?: string;
  close?: string;
}

export type OpeningHours = OpeningHoursDay[] | null;

export interface MenuBlob {
  categories: Category[];
  products: Product[];
  baseOptions: OptionItem[];
  sauceOptions: OptionItem[];
  cheeseOptions: OptionItem[];
  sauceStripeOptions: OptionItem[];
  dipOptions: OptionItem[];
  // Per-product-size brief — the 'size' kind is no longer a shared/global
  // list here. Each product now carries its OWN size tiers directly on
  // `Product.sizeOptions` (see that field's comment) — this is why MenuBlob
  // itself has no top-level `sizeOptions` field the way baseOptions/
  // sauceOptions/etc. do; there is no one list that would even make sense
  // to expose at this level anymore.
  toppings: OptionItem[];
  fillingCategories: FillingCategory[];
  drinks: Addon[];
  dipCups: Addon[];
  snacks: Addon[];
  bundles: Bundle[];
  storeClosed: boolean;
  trackingConfig: TrackingConfig;
  openingHours: OpeningHours;
  featured: Featured;
  popularProductIds: string[];
  // Growth features — shared discount-value shape (color-palette-and-
  // discount-pattern brief, part 2). Was a bare admin-configurable
  // percentage (admin_settings' first_order_discount_percent /
  // stamp_card_reward_percent); now a DiscountValue so either feature can
  // be configured as a flat euro amount instead — value 0 still means
  // "not configured / disabled" for each, same as before (mirrors the
  // project's usual "unset admin_settings key → Number('') || 0"
  // fallback, just one level down inside the shape). See
  // CheckoutModal.tsx (welcome-discount banner), lib/pricing.ts
  // (computeDiscountAmount/readDiscountSetting), and
  // app/api/orders/route.ts (server-side enforcement of both).
  firstOrderDiscount: DiscountValue;
  stampCardReward: DiscountValue;
  // Growth features batch 2 (Feature 5) — normalized, currently-active
  // scheduled offers (already filtered to active=1 by lib/menu-data.ts's
  // query; day/time-window evaluation happens separately, at the moment
  // it's needed, via lib/scheduledOffers.ts's findBestActiveScheduledOffer
  // — see context/StoreContext.tsx). Empty array if none are configured.
  scheduledOffers: ScheduledOffer[];
  // Priority-fixes brief (roadmap gap analysis), Part 7 — special/holiday
  // hours overriding the regular weekly schedule for specific calendar
  // dates (see lib/openingHours.ts's SpecialHoursEntry/getEffectiveHoursForDate).
  // Empty array if none are configured.
  specialHours: SpecialHoursEntry[];
  // Story banner slider (Bundle 1 Task 5) — admin-uploaded photos for
  // components/Story.tsx's homepage banner slider, in slide order. Empty
  // array (the pre-this-feature state, and any fresh install) renders the
  // slider's own on-brand placeholder rather than the old third-party
  // random-image API — see that component. Capped at 10 by the admin UI
  // and defensively again here (lib/menu-i18n.ts's normalizeMenuBlob).
  storyBannerImages: StoryBannerImage[];
}

// Story banner slider (Bundle 1 Task 5) — one admin-uploaded photo, with
// its own admin-entered alt text (never left empty/generic — the brief
// specifically calls for real, descriptive alt text per image, which a
// bare list of URLs can't carry on its own). Stored as a JSON-encoded
// array under admin_settings.story_banner_images — same "ordered list as
// one flat-settings JSON value" pattern already established by
// admin_settings.popular_product_ids (see lib/menu-i18n.ts's
// normalizeMenuBlob and app/admin/dashboard/page.tsx's
// HomepageDisplaySettings) — chosen over a new dedicated table since this
// is a small (max 10), admin-owned, single-purpose ordered list with no
// need for its own id/foreign keys/independent querying.
export interface StoryBannerImage {
  url: string;
  alt: string;
}

// ---------------------------------------------------------------------
// Cart / checkout / analytics shapes — context/StoreContext.tsx state,
// components/CheckoutModal.tsx + components/ProductPage.tsx props, and
// what lib/analytics.ts's trackX() functions accept.
// ---------------------------------------------------------------------

// Structured pricing selection carried alongside a customizable product's
// cart line — the actual option/size/filling IDs chosen (mirrors
// context/StoreContext.tsx's Selection, minus the fields calcUnitPrice's
// formula doesn't need) — so the server can recompute the exact price
// from real D1 option deltas (lib/pricing.ts) instead of trusting the
// client's number, or trying to reverse-engineer it from the
// human-readable `details` strings (which is all the cart line carried
// before this money-correctness pass — see CartLine.details below).
export interface CartLineSelectionData {
  toppingIds: string[];
  baseId?: string;
  sauceId?: string;
  cheeseId?: string;
  fillings: Record<string, number>;
  sauceStripeId?: string;
  dipId?: string;
  // Per-product-size brief — the chosen `'size'`-kind option_groups
  // option id (e.g. a real pizza's Normaali/Pannu/Perhe choice), scoped
  // to THIS line's own product (see lib/pricing.ts's calcUnitPriceFromSelection
  // — it looks this id up against that specific product's own sizeOptions,
  // never a shared/global list, so a tampered id belonging to a different
  // product simply isn't found and contributes nothing). This used to
  // coexist with a separate pre-existing `size: 'M'|'L'` field (the old
  // binary upcharge toggle) — that field is retired by this brief
  // (Part 2), so `sizeOptionId` is now the sole size-related field here.
  sizeOptionId?: string;
  // Option-gating-and-extras-system brief, Task 2 — the chosen `'extra'`-
  // kind option ids (zero or more — multi-select, unlike every `...Id`
  // field above), scoped to THIS line's own product exactly like
  // `sizeOptionId` (see lib/pricing.ts's calcUnitPriceFromSelection — it
  // looks these up against that specific product's own extraOptions,
  // never a shared/global list, so a tampered id belonging to a different
  // product's extras simply isn't found and contributes nothing).
  // Optional (not required, unlike `toppingIds`) so a HISTORICAL
  // selection_json blob written before this feature existed (a past
  // order, reordered) still validates — validateSelectionShape treats a
  // missing `extraIds` as "no extras selected," never a shape error, same
  // backward-compatibility treatment the old M/L `size` key got from the
  // per-product-size brief.
  extraIds?: string[];
}

// One filled bundle-slot unit, as sent to POST /api/orders — see
// CartLine.bundleItems below.
export interface CartLineBundleItem {
  productId: string;
  selection?: CartLineSelectionData;
}

export interface CartLine {
  key: string;
  productId?: string | null;
  drinkId?: string;
  name: string;
  image?: string | null;
  details: string[];
  qty: number;
  unitPrice: number;
  lineTotal: number;
  // --- Structured pricing data (money-correctness pass) ---
  // Everything below is ADDITIVE — existing consumers of CartLine that
  // only read the fields above (analytics, /track, the admin order view,
  // CartDrawer/CheckoutModal display) are unaffected. Only
  // app/api/orders/route.ts (via lib/pricing.ts) reads these, to verify
  // `lineTotal` server-side instead of trusting it.
  //
  // Set for a customizable product line (toppingsEnabled) — undefined for
  // a plain product, a drink/dip/snack addon line, or a bundle line
  // (which carries its own per-slot-item selections in `bundleItems`).
  selection?: CartLineSelectionData;
  // Set to the bundle's id for a bundle line — an explicit, unambiguous
  // discriminator (rather than overloading `productId`, which this line
  // also sets to the same value for display/analytics) that tells the
  // server to verify this line as a bundle rather than a regular product.
  bundleId?: string;
  // One entry per filled bundle-slot unit (fixed and choice slots alike),
  // in the same order CartLine.details' bundle text is built from
  // (addBundleToCart) — only set on a bundle line.
  bundleItems?: CartLineBundleItem[];
}

// Looser variant used where a cart-shaped object is built inline just to
// pass to lib/analytics.ts's trackAddToCart() (see StoreContext.addToCart)
// — that call site never sets `key`/`details`, since analytics only reads
// productId/name/qty/unitPrice/lineTotal off it. A real CartLine (with
// `key`) satisfies this shape too.
export interface CartLineLike {
  key?: string;
  productId?: string | null;
  drinkId?: string;
  name: string;
  image?: string | null;
  details?: string[];
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Selection {
  basePrice: number;
  toppingsEnabled: boolean;
  qty: number;
  toppings: string[];
  base?: string;
  sauce?: string;
  cheese?: string;
  fillings: Record<string, number>;
  sauceStripe?: string;
  dip?: string;
  // Per-product-size brief — mirrors `base`/`sauce`/`cheese` above exactly
  // (set via the same generic `setOption('sizeOptionId', id)` call — see
  // context/StoreContext.tsx's setOption).
  sizeOptionId?: string;
  // Per-product-size brief — a SNAPSHOT of the active product's own
  // `Product.sizeOptions` (see that field's comment), captured once when
  // the product page opens (context/StoreContext.tsx's openProduct), so
  // calcUnitPrice can look up `sizeOptionId`'s delta against THIS
  // product's own tiers without needing a separate context-level lookup —
  // the same reason `basePrice`/`toppingsEnabled` above are already
  // snapshotted onto Selection rather than re-read from `products` on
  // every price calculation.
  sizeOptions: OptionItem[];
  // Option-gating-and-extras-system brief, Task 2 — mirrors
  // toppings/sizeOptions above: `extraIds` is the customer's current
  // multi-select choice (zero, one, or several — unlike the single-select
  // base/sauce/cheese/dip/sizeOptionId fields, this is an array, same
  // shape convention as `toppings`), and `extraOptions` is a SNAPSHOT of
  // the active product's own `Product.extraOptions`, captured once when
  // the product page opens (context/StoreContext.tsx's openProduct) —
  // same reasoning as `sizeOptions`'s own comment: calcUnitPrice looks up
  // `extraIds` against THIS product's own extras without a separate
  // context-level lookup, and a tampered id from a different product's
  // extras group is never found here.
  extraIds: string[];
  extraOptions: OptionItem[];
  bundleSlotIndex: number | null;
}

export interface Customer {
  name: string;
  address: string;
  postalCode: string;
  email: string;
  phone: string;
  notes: string;
}

// Stamp-card loyalty progress for the order that was just placed — see
// POST /api/orders's response and ConfirmModal.tsx's progress message.
//
// Stamp-card redesign — `rewardCode` is gone: the reward is no longer a
// minted coupon, it's applied directly to this order's total (or banked
// as a pending reward for a future one) — see app/api/orders/route.ts
// and worker/migrations/010_stamp_card_redesign_and_source_tracking.sql.
// Whether THIS order's discount was the stamp-card reward is on
// ConfirmedOrder.discountSource below, not here.
export interface LoyaltyProgress {
  orderCount: number;
  // True only when THIS order just earned a fresh stamp-card reward but
  // had no eligible item to apply it to (or lost the "most favorable
  // discount" comparison to something else) — banked in
  // stamp_card_pending_rewards for the next order that has one, however
  // many orders later. Purely informational for the confirmation screen;
  // there is no code to copy.
  pendingRewardCreated: boolean;
  // Rewards dashboard consolidation — the admin-configured "every Nth
  // order" threshold used to compute this order's progress, sent so
  // ConfirmModal.tsx never has to hardcode it (or separately fetch
  // settings just for this one number) — see app/api/orders/route.ts.
  everyNOrders: number;
}

export interface ConfirmedOrder {
  orderNum: string;
  customer: Customer;
  total: number;
  discountAmount: number;
  items: CartLine[];
  loyalty?: LoyaltyProgress;
  // Growth features (Feature 2) — distinguishes an automatic welcome
  // discount from a manually-entered coupon code, both of which land in
  // the same `discountAmount` above (see app/api/orders/route.ts) — so
  // ConfirmModal.tsx can show the right label for each rather than
  // always saying "Coupon applied" for a discount the customer never
  // typed a code for.
  welcomeDiscountApplied?: boolean;
  // Growth features batch 2 (Feature 5) — set when the applied discount
  // was a scheduled weekday offer rather than a coupon or the welcome
  // discount, so ConfirmModal.tsx can show its admin-entered label
  // instead of a generic "discount applied" line.
  scheduledOfferApplied?: { id: string; label: string } | null;
  // Growth features batch 2 (Feature 6 — "Ozy Wow Moment") — set only
  // when this order's random check succeeded; the code is for a FUTURE
  // order (see app/api/orders/route.ts), never applied retroactively to
  // this one. null/undefined every other time.
  wowMomentRewardCode?: string | null;
  // Stamp-card redesign / discount-source tracking — which single
  // mechanism actually won the discount on THIS order (see
  // app/api/orders/route.ts); null/undefined when no discount applied.
  // ConfirmModal.tsx uses this to show the right message for a stamp-card
  // win specifically, distinct from welcomeDiscountApplied/
  // scheduledOfferApplied above (which already carry their own labels).
  discountSource?: DiscountSource | null;
  // Order confirmation screen (Part A) — which payment method this order
  // was placed with, so ConfirmModal.tsx can show a message that actually
  // matches what happened ("Paid — thank you!" for a successful card
  // charge vs. "Pay on delivery" for COD) instead of always showing the
  // cash-on-delivery note regardless of how the order was actually paid
  // for. Set by finalizeOrder in context/StoreContext.tsx from the same
  // paymentMethod placeOrder was called with — never re-derived or
  // guessed here.
  paymentMethod: 'cod' | 'card';
  // Round-2 fixes brief, Part 5 — which fulfillment type this order was
  // actually placed as, so ConfirmModal.tsx can show pickup-appropriate
  // copy (e.g. "pay by cash when you collect it" instead of "...when your
  // order arrives"). Defaults to 'delivery' at every call site that
  // predates this field for the same reason as OrderRow.order_type above.
  orderType?: OrderType;
}

export interface OpenProductOptions {
  skipUrlPush?: boolean;
}

// window.gtag/fbq/ttq are only ever defined at runtime by
// components/TrackingScripts.js once a platform ID is configured and
// consent has been given — see lib/analytics.ts's header comment. Declared
// here (rather than in analytics.ts itself) so any other converted module
// that touches these globals picks up the same shape.
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    ttq?: {
      track: (...args: unknown[]) => void;
      [key: string]: unknown;
    };
    // components/TrackingScripts.js's own load-once guards + the vendor
    // snippets' own globals (gtag's dataLayer, TikTok's object-name
    // pointer). Loose types on purpose — these are third-party vendor
    // snippets, copied verbatim; not worth modeling precisely.
    __ga4Loaded?: boolean;
    __metaPixelLoaded?: boolean;
    __ttqLoaded?: boolean;
    __clarityLoaded?: boolean;
    dataLayer?: unknown[];
    TiktokAnalyticsObject?: string;
    clarity?: (...args: unknown[]) => void;
    _fbq?: unknown;
    [key: string]: any;
  }

  // The global `caches` object itself ("dom" lib, via CacheStorage) is
  // already declared — this only adds the Cloudflare Workers runtime's
  // `.default` named cache (used by lib/api-helpers.js's
  // purgeMenuCache() and app/api/menu/route.js) via interface merging,
  // rather than redeclaring `caches` itself (which "dom" already owns
  // as a `var`, and can't be redeclared `const`). `.default` isn't part
  // of the standard (browser) Cache API this project's tsconfig `lib`
  // array pulls in, and there's no @cloudflare/workers-types dependency
  // per this migration's "no new dependencies" rule — merged in
  // minimally here instead.
  interface CacheStorage {
    default: Cache;
  }
}

// ---------------------------------------------------------------------
// Stage A additions — order-tracking (components/TrackPageClient.js) and
// the "recent orders" shortcut it shares with StoreContext.placeOrder().
// Mirrors the D1 `orders`/`order_items` columns (worker/schema.sql) as
// returned by app/api/orders/[orderNum]/route.js (spreads the raw order
// row + `items`) and app/api/orders/by-phone/route.js (a small projection).
// ---------------------------------------------------------------------

// Priority-fixes brief (roadmap gap analysis), Bundle 1 Task 3 —
// 'accepted' (between received/preparing) and 'ready' (between
// preparing/on_the_way) are new. No DB CHECK constraint exists on
// orders.status (worker/schema.sql — it's a plain TEXT column with a
// 'received' default), so this is a pure application-level/TypeScript
// change; no migration was needed to allow these two new string values.
// Every existing order row keeps its current status string untouched —
// this only affects what NEW transitions are offered going forward (see
// components/admin/OrderKanban.tsx's COLUMNS).
export type OrderStatus = 'received' | 'accepted' | 'preparing' | 'ready' | 'on_the_way' | 'delivered' | 'cancelled';

// Round-2 fixes brief, Part 5 (worker/migrations/015_pickup_fulfillment.sql)
// — a customer either has this delivered, or comes to collect it
// themselves. Every order placed before this brief is 'delivery' (the
// column default), since that was the only option that ever actually
// existed at checkout despite marketing copy long promising both.
export type OrderType = 'delivery' | 'pickup';

export interface OrderTrackingItem {
  id: number;
  order_id?: number;
  product_id?: string | null;
  name: string;
  qty: number;
  line_total: number | string;
  details?: string | null; // JSON-encoded string[] — see parseDetails()
}

// The full row app/api/orders/[orderNum]/route.js returns: the raw
// `orders` table row (worker/schema.sql) spread together with `items`.
export interface OrderTrackingResult {
  id: number;
  order_num: string;
  customer_name: string;
  address: string;
  email: string;
  phone: string;
  notes?: string | null;
  total: number | string;
  status: OrderStatus;
  payment_method: string;
  // Stripe card payments (worker/migrations/012_stripe_payments.sql) — see
  // OrderRow below for the full value-lifecycle comment. Optional here for
  // the same reason as OrderRow's discount_source etc.: a handful of call
  // sites project only a subset of columns.
  payment_status?: string;
  stripe_payment_intent_id?: string | null;
  estimated_ready_at?: string | null;
  driver_name?: string | null;
  coupon_code?: string | null;
  discount_amount: number | string;
  marketing_consent?: number;
  created_at: string;
  items: OrderTrackingItem[];
  // Round-2 fixes brief, Part 5 — same optional-for-pre-migration-rows
  // reasoning as OrderRow.order_type above; TrackPageClient.tsx treats an
  // absent value as 'delivery', same as that column's own DB-level
  // default.
  order_type?: OrderType;
}

// app/api/orders/by-phone/route.js's small projection.
export interface OrderPhoneMatch {
  orderNum: string;
  status: OrderStatus;
  total: number | string;
  createdAt: string;
}

// Saved to localStorage('ozy_recent_orders') by StoreContext.placeOrder()
// and read back by TrackPageClient's RecentOrderShortcut.
export interface RecentOrder {
  orderNum: string;
  phone: string;
  placedAt: string;
}

// ---------------------------------------------------------------------
// Stage B — auth/session, D1 row shapes (orders, coupons, staff,
// audit_log — see worker/schema.sql), and server-side tracking payloads.
// ---------------------------------------------------------------------

// lib/adminAuth.js's ROLES array, in the exact order the DB CHECK
// constraint (worker/schema.sql, `staff.role`) lists them.
//
// Priority-fixes brief (roadmap gap analysis), Bundle 1 Task 4 — 'staff'
// (worker/migrations/019_staff_role.sql) sits between 'kitchen' and
// 'manager'. Chosen permission boundary: same order-view/manage access
// as kitchen, PLUS toggling a product's availability (active on/off) —
// but none of manager's access to pricing, discounts, refunds, staff
// management, or settings. See the per-route requireRole()/getSession()
// role checks (app/api/admin/[table]/**/route.ts's PUT in particular)
// for exactly where that line is drawn.
export type StaffRole = 'kitchen' | 'staff' | 'manager' | 'owner';

// Returned by lib/adminAuth.js's getSession(). staffId is null exactly
// when isLegacy is true (the fallback ADMIN_EMAIL/ADMIN_PASSWORD login
// isn't backed by a staff row) — see that file's header comment.
export interface StaffSession {
  staffId: number | null;
  role: StaffRole;
  name: string;
  isLegacy: boolean;
}

// Minimal shape lib/adminAuth.js's createStaffToken() needs from a caller
// — usually a full StaffRow, but callers only ever read these three
// fields when minting a token.
export interface StaffTokenInput {
  id: number;
  role: StaffRole;
  name?: string;
}

// worker/schema.sql's `staff` table.
export interface StaffRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: StaffRole;
  active: number;
  totp_secret?: string | null;
  totp_enabled?: number;
  created_at: string;
}

// worker/schema.sql's `coupons` table (code is the primary key).
export interface CouponRow {
  code: string;
  discount_type: 'percent' | 'amount';
  discount_value: number;
  active: number;
  expires_at?: string | null;
  min_order_amount?: number | null;
  usage_limit?: number | null;
  times_used: number;
  created_at: string;
  // Priority-fixes brief (roadmap gap analysis), Part 4
  // (worker/migrations/018_coupon_max_discount.sql) — nullable euro
  // ceiling on this coupon's discount, enforced in lib/coupons.ts's
  // validateCoupon. NULL/undefined means uncapped (every coupon's
  // behavior before this migration).
  max_discount_amount?: number | null;
  // Growth features (Phase: referral program) — set only on a coupon
  // auto-created by POST /api/referral; see worker/schema.sql's comment.
  referral_email?: string | null;
}

// worker/schema.sql's `stamp_card_pending_rewards` table (stamp-card
// redesign — see worker/migrations/
// 010_stamp_card_redesign_and_source_tracking.sql). An un-redeemed row
// (redeemed_at IS NULL) is a reward this phone earned but couldn't apply
// yet (no eligible item in the cart that triggered it); at most one such
// row per phone at a time (enforced in app/api/orders/route.ts, not a DB
// constraint — see that file).
export interface StampCardPendingRewardRow {
  id: number;
  phone: string;
  // Legacy column, kept per this project's additive-only migration
  // convention (worker/migrations/011_shared_discount_value.sql) — still
  // written on every insert (0 when reward_type is 'amount') so the
  // NOT NULL constraint never needs relaxing, but no longer read by
  // app/api/orders/route.ts. reward_type/reward_value are authoritative;
  // see that migration's header comment.
  reward_percent: number;
  reward_type: 'percent' | 'amount';
  reward_value: number;
  earned_at: string;
  earned_order_num: string;
  redeemed_at?: string | null;
  redeemed_order_num?: string | null;
}

// lib/coupons.js's validateCoupon() result — a discriminated-ish shape
// (only `error` is guaranteed on failure; `coupon`/discountAmount/
// finalTotal are only guaranteed once `valid` is true), left as optional
// fields rather than a true discriminated union since the JS callers
// (app/api/coupons/validate, app/api/orders) narrow on `.valid` at the
// call site, not via a `kind`/`type` tag.
export interface CouponValidationResult {
  valid: boolean;
  error?: string;
  coupon?: CouponRow;
  discountAmount?: number;
  finalTotal?: number;
}

// worker/schema.sql's `orders` table — the exact D1 row shape, as opposed
// to OrderTrackingResult above (that one is /api/orders/[orderNum]'s
// derived response, which leaves total/discount_amount as `number |
// string` because that route never re-coerces them). Rows read straight
// back from D1 (admin order list/detail, order-creation insert) get real
// numbers for REAL/INTEGER columns.
export interface OrderRow {
  id: number;
  order_num: string;
  customer_name: string;
  address: string;
  email: string;
  phone: string;
  notes?: string | null;
  total: number;
  status: OrderStatus;
  payment_method: string;
  // Stripe card payments (worker/migrations/012_stripe_payments.sql).
  // payment_status: 'cod' (default, nothing to track) | 'pending' (a card
  // order was created and a Stripe PaymentIntent exists for it, unconfirmed)
  // | 'paid' (the webhook confirmed the charge — sole source of truth, see
  // app/api/webhooks/stripe) | 'failed' (card declined). Optional here for
  // the same reason as discount_source below — some call sites project
  // only a subset of columns.
  payment_status?: string;
  stripe_payment_intent_id?: string | null;
  // Part C (admin-initiated refunds, worker/migrations/013_refunds.sql) —
  // set by the webhook (charge.refunded) for a card order, or written
  // directly by the refund route for a COD order (see that route's own
  // comment on why COD never waits on a webhook). NULL for every order
  // that was never refunded.
  refunded_amount?: number | null;
  refunded_at?: string | null;
  estimated_ready_at?: string | null;
  driver_name?: string | null;
  coupon_code?: string | null;
  discount_amount: number;
  marketing_consent?: number;
  // Stamp-card redesign / discount-source tracking (worker/migrations/
  // 010_stamp_card_redesign_and_source_tracking.sql). Optional here (as
  // opposed to a required field with a null union) because a handful of
  // call sites project only a subset of `orders` columns rather than
  // SELECT * — see each route for which. Rows written before this
  // migration have discount_source NULL, triggered_wow_moment/is_reorder
  // 0 (SQLite backfills the column default for existing rows).
  discount_source?: DiscountSource | null;
  triggered_wow_moment?: number;
  is_reorder?: number;
  // Round-2 fixes brief, Part 5 — optional for the same reason as
  // discount_source above (a handful of call sites project only a subset
  // of `orders` columns). Absent on a row read before migration 015 ran
  // is not expected in practice (the column backfills a default for every
  // existing row), but treated as "delivery" wherever it matters, same as
  // the column's own default.
  order_type?: OrderType;
  // Priority-fixes brief (roadmap gap analysis), Bundle 1 Task 1
  // (worker/migrations/020_order_locale.sql) — see that migration's
  // comment. Optional here for the same reason as order_type above (a
  // handful of call sites project only a subset of `orders` columns).
  locale?: Locale;
  created_at: string;
}

// worker/schema.sql's `order_items` table.
export interface OrderItemRow {
  id: number;
  order_id: number;
  product_id?: string | null;
  name: string;
  qty: number;
  line_total: number;
  details?: string | null;
  // Growth features (Phase: reorder) — JSON-encoded
  // `{ selection?, bundleId?, bundleItems? }`, see worker/schema.sql's
  // comment on this column. NULL for any row written before this column
  // existed, or for a plain uncustomized product/addon line.
  selection_json?: string | null;
}

// worker/schema.sql's `audit_log` table — see lib/auditLog.js.
export interface AuditLogRow {
  id: number;
  staff_id: number | null;
  staff_name: string;
  action: string;
  detail?: string | null;
  created_at: string;
}

// lib/server-tracking.js's loadTrackingSettings() result — Meta/TikTok/
// GA4 credentials, all sourced from admin_settings (never env vars).
export interface TrackingSettings {
  ga4MeasurementId: string | null;
  ga4ApiSecret: string | null;
  ga4DebugMode: boolean;
  metaPixelId: string | null;
  metaAccessToken: string | null;
  metaTestEventCode: string | null;
  tiktokPixelId: string | null;
  tiktokAccessToken: string | null;
  tiktokTestEventCode: string | null;
}

// The minimal order shape lib/server-tracking.js's
// trackPurchaseServerSide()/trackRefundServerSide() read from — a subset
// of OrderRow plus the line items, in the units those functions actually
// use (order.total as a number, not the D1-string-or-number union).
export interface TrackingOrderItem {
  productId?: string | null;
  name?: string;
  qty: number;
  unitPrice?: number;
}

export interface TrackingOrder {
  orderNum: string;
  email?: string | null;
  phone?: string | null;
  total: number;
  items?: TrackingOrderItem[];
}

// ---------------------------------------------------------------------
// Stage C — admin panel (BundleManager, ResourceManager, OrderKanban).
// ---------------------------------------------------------------------

// worker/schema.sql's `bundles` table, as returned by GET
// /api/admin/bundles — `slots` is stored as a JSON-encoded string
// (BundleSlotDef[], same slot shape components/BundleModal.js reads at
// checkout time), not parsed server-side.
export interface BundleRow {
  id: string;
  title: string;
  title_fi?: string | null;
  description?: string | null;
  description_fi?: string | null;
  image?: string | null;
  price: number;
  slots: string;
  active: number;
  sort_order?: number;
}

// components/admin/ResourceManager.js's field-config prop — one generic
// admin CRUD form/table, reused for categories/products/option_groups/
// options/addons/bundles (each with its own `fields` array, built in
// app/admin/dashboard/page.js). A real discriminated union on `type`
// (rather than one loose object with every field's optional properties
// mixed together) so e.g. accessing `.options` only type-checks on a
// 'select' field, and a typo'd type string is a compile error rather
// than a field silently rendering as plain text.
interface ResourceFieldBase {
  key: string;
  label: string;
  required?: boolean;
  // Optional short helper text rendered beneath the field's label in the
  // admin form (see ResourceManager.tsx) — for guidance that needs to stay
  // visible while the admin is actively typing (e.g. a character-count
  // target), which a `placeholder` can't do since it disappears on input.
  // Omitted by every existing field array, so this is purely additive.
  hint?: string;
}

export interface ResourceTextField extends ResourceFieldBase {
  type?: 'text';
  placeholder?: string;
  default?: string;
}

export interface ResourceNumberField extends ResourceFieldBase {
  type: 'number';
  step?: string;
  placeholder?: string;
  default?: number;
}

export interface ResourceSelectOption {
  value: string;
  label: string;
}

export interface ResourceSelectField extends ResourceFieldBase {
  type: 'select';
  options: ResourceSelectOption[];
  default?: string;
}

export interface ResourceCheckboxField extends ResourceFieldBase {
  type: 'checkbox';
  default?: boolean;
}

export interface ResourceImageField extends ResourceFieldBase {
  type: 'image';
  default?: string;
}

export interface ResourceTextareaField extends ResourceFieldBase {
  type: 'textarea';
  placeholder?: string;
  default?: string;
}

export type ResourceField =
  | ResourceTextField
  | ResourceNumberField
  | ResourceSelectField
  | ResourceCheckboxField
  | ResourceImageField
  | ResourceTextareaField;
