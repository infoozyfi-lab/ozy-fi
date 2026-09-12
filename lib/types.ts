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

export type Locale = 'fi' | 'en';

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
  [key: string]: unknown;
}

export interface RawProduct {
  id: string;
  category_id: string;
  name: string;
  name_fi?: string | null;
  description?: string | null;
  description_fi?: string | null;
  price: number | string;
  offer_price?: number | string | null;
  image?: string | null;
  tag?: string | null;
  has_toppings?: number | boolean;
  sort_order?: number;
  active?: number;
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
  kind: 'base' | 'sauce' | 'cheese' | 'sauce_stripe' | 'dip' | 'topping' | 'filling' | string;
  title?: string;
  title_fi?: string | null;
  icon?: string | null;
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
  toppings: OptionItem[];
  fillingCategories: FillingCategory[];
  drinks: Addon[];
  dipCups: Addon[];
  snacks: Addon[];
  bundles: Bundle[];
  sizeLargeUpcharge: number;
  storeClosed: boolean;
  trackingConfig: TrackingConfig;
  openingHours: OpeningHours;
  featured: Featured;
  popularProductIds: string[];
  // Growth features — admin-configurable percentages (admin_settings keys
  // first_order_discount_percent / stamp_card_reward_percent), 0 means
  // "not configured / disabled" for each (mirrors sizeLargeUpcharge's own
  // "unset admin_settings key → Number('') || 0" fallback). See
  // CheckoutModal.tsx (welcome-discount banner) and
  // app/api/orders/route.ts (server-side enforcement of both).
  firstOrderDiscountPercent: number;
  stampCardRewardPercent: number;
  // Growth features batch 2 (Feature 5) — normalized, currently-active
  // scheduled offers (already filtered to active=1 by lib/menu-data.ts's
  // query; day/time-window evaluation happens separately, at the moment
  // it's needed, via lib/scheduledOffers.ts's findBestActiveScheduledOffer
  // — see context/StoreContext.tsx). Empty array if none are configured.
  scheduledOffers: ScheduledOffer[];
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
  size: 'M' | 'L';
  toppingIds: string[];
  baseId?: string;
  sauceId?: string;
  cheeseId?: string;
  fillings: Record<string, number>;
  sauceStripeId?: string;
  dipId?: string;
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
  size: 'M' | 'L';
  toppings: string[];
  base?: string;
  sauce?: string;
  cheese?: string;
  fillings: Record<string, number>;
  sauceStripe?: string;
  dip?: string;
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
// POST /api/orders's response and ConfirmModal.tsx's progress message /
// reward-code display. `rewardCode` is only set on the order that just
// brought this phone number's non-cancelled order count to a multiple of
// 5 (see app/api/orders/route.ts) — null every other time.
export interface LoyaltyProgress {
  orderCount: number;
  rewardCode: string | null;
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

export type OrderStatus = 'received' | 'preparing' | 'on_the_way' | 'delivered' | 'cancelled';

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
  estimated_ready_at?: string | null;
  driver_name?: string | null;
  coupon_code?: string | null;
  discount_amount: number | string;
  marketing_consent?: number;
  created_at: string;
  items: OrderTrackingItem[];
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
export type StaffRole = 'kitchen' | 'manager' | 'owner';

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
  // Growth features (Phase: referral program) — set only on a coupon
  // auto-created by POST /api/referral; see worker/schema.sql's comment.
  referral_email?: string | null;
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
  estimated_ready_at?: string | null;
  driver_name?: string | null;
  coupon_code?: string | null;
  discount_amount: number;
  marketing_consent?: number;
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
