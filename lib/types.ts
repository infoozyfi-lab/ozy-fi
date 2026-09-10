// Shared type definitions for the ozy.fi storefront app.
//
// These describe the shapes passed between the modules converted in
// TypeScript Migration Phase 1 (lib/analytics, lib/menu-i18n, lib/menu-data,
// context/StoreContext, components/CheckoutModal, components/ProductPage).
// This is a types-only migration — no runtime logic changes — so the types
// here are kept permissive (lots of optional fields, loose raw-row shapes)
// rather than maximally strict, matching this phase's `strict: false` /
// `checkJs: false` tsconfig.

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
  [key: string]: unknown;
}

export interface BundleSlotFilledItem {
  key: string;
  productId: string;
  name: string;
  details: string[];
  extra: number;
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

export type OpeningHours = unknown[] | null;

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
}

// ---------------------------------------------------------------------
// Cart / checkout / analytics shapes — context/StoreContext.tsx state,
// components/CheckoutModal.tsx + components/ProductPage.tsx props, and
// what lib/analytics.ts's trackX() functions accept.
// ---------------------------------------------------------------------

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
  email: string;
  phone: string;
  notes: string;
}

export interface ConfirmedOrder {
  orderNum: string;
  customer: Customer;
  total: number;
  discountAmount: number;
  items: CartLine[];
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
  }
}
