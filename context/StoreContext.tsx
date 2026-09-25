'use client';

import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { trackViewItem, trackAddToCart, trackBeginCheckout, trackPurchase } from '@/lib/analytics';
import { useLocale, useLocalePath, useTranslations } from '@/lib/i18n';
import { normalizeCategories, normalizeProducts, normalizeMenuBlob } from '@/lib/menu-i18n';
import { findBestActiveScheduledOffer } from '@/lib/scheduledOffers';
import type {
  Product,
  Category,
  OptionItem,
  FillingCategory,
  FillingItem,
  Addon,
  Bundle,
  BundleSlot,
  BundleSlotDef,
  TrackingConfig,
  Featured,
  OpeningHours,
  CartLine,
  CartLineSelectionData,
  CartLineBundleItem,
  Selection,
  Customer,
  ConfirmedOrder,
  OpenProductOptions,
  RawCategory,
  RawProduct,
  RecentOrder,
  MenuData,
  ScheduledOffer,
  DiscountSource,
  DiscountValue,
  OrderType,
  SpecialHoursEntry,
  StoryBannerImage,
} from '@/lib/types';

interface StoreContextValue {
  cart: CartLine[];
  cartTotal: number;
  activeProduct: Product | null;
  selection: Selection | null;
  unitPrice: number;
  lineTotal: number;
  isProductPageOpen: boolean;
  isCartOpen: boolean;
  isCheckoutOpen: boolean;
  isDrinkUpsellOpen: boolean;
  setDrinkUpsellOpen: Dispatch<SetStateAction<boolean>>;
  continueFromUpsell: () => void;
  confirmedOrder: ConfirmedOrder | null;
  openProduct: (item: Product, bundleSlotIndex?: number | null, options?: OpenProductOptions) => void;
  closeProduct: () => void;
  toggleTopping: (topping: string) => void;
  // Option-gating-and-extras-system brief, Task 2 — mirrors toggleTopping
  // above exactly (multi-select, same add/remove-by-id toggle shape), but
  // keyed by the extra's own id rather than its label (toppings are keyed
  // by label for historical reasons — see the TOPPING_EMOJI comment in
  // components/ProductPage.tsx; extras have no such precedent to match,
  // so this uses the correct, collision-proof identifier from the start).
  toggleExtra: (extraId: string) => void;
  // Per-product-size brief, Part 2 — the old binary Medium/Large
  // `setSize`/`'M'|'L'` toggle is fully retired; `setOption('sizeOptionId',
  // id)` (the same generic setter base/sauce/cheese already use) is now
  // the only way to change a product's size.
  setQty: (fn: (qty: number) => number) => void;
  setOption: (key: string, id: string) => void;
  setFillingQty: (fillingId: string, nextQty: number) => void;
  addToCart: () => void;
  removeFromCart: (key: string) => void;
  addDrinkToCart: (drink: Addon) => void;
  updateCartQty: (key: string, nextQty: number) => void;
  setCartOpen: Dispatch<SetStateAction<boolean>>;
  goToCheckout: () => void;
  goToCheckoutDirect: () => void;
  setCheckoutOpen: Dispatch<SetStateAction<boolean>>;
  closeCheckout: () => void;
  // Stripe card payments — paymentMethod defaults to 'cod' (unchanged
  // behaviour: resolves once the order is fully placed). For 'card', the
  // order row is created immediately (payment_status 'pending') but the
  // promise resolves BEFORE the order is finalized — the caller
  // (CheckoutModal, via CardPaymentStep) must collect the card payment
  // using the returned clientSecret and then call `finalize()` itself;
  // only that closes the checkout / clears the cart / shows the
  // confirmation screen. This lets the same customer-details form work
  // for both payment methods without CheckoutModal needing its own copy
  // of the order-confirmation logic.
  placeOrder: (
    customer: Customer,
    couponCode?: string,
    paymentMethod?: 'cod' | 'card',
    // Round-2 fixes brief, Part 5 — a sibling to paymentMethod rather than
    // a field on Customer, since it's a property of how this order is
    // fulfilled, not of who the customer is. Defaults to 'delivery' below
    // (same default as the order_type column) so existing callers that
    // don't pass it keep behaving exactly as before pickup existed.
    orderType?: OrderType
  ) => Promise<
    // orderNum/amount (audit-fixes brief, Part 1) — the order number and
    // the server's own authoritative total at the moment this order/
    // PaymentIntent were created, handed back alongside clientSecret so
    // CheckoutModal can (a) show a payment amount that can never drift
    // from what Stripe will actually charge even if the customer edits
    // their cart in another tab/panel while this payment is pending, and
    // (b) cancel this exact order (POST /api/orders/[orderNum]/cancel) if
    // the customer backs out of paying instead of completing it.
    | { requiresPayment: true; clientSecret: string; finalize: () => void; orderNum: string; amount: number }
    | { requiresPayment: false }
  >;
  setConfirmedOrder: Dispatch<SetStateAction<ConfirmedOrder | null>>;
  closeConfirm: () => void;
  // Round-2 fixes brief, Part 5 — see this field's own comment on its
  // useState above. CheckoutModal.tsx applies this once (via its own
  // effect) to its local orderType state when reordering a pickup order,
  // so the reorder flow doesn't silently turn it back into delivery.
  reorderOrderType: OrderType | null;

  // Menu data (from /api/menu — the database).
  menuLoading: boolean;
  // Size-selector-not-showing bug report — see this field's own useState
  // comment below for why it's a separate signal from menuLoading above.
  menuFullyLoaded: boolean;
  menuError: string;
  categories: Category[];
  products: Product[];
  baseOptions: OptionItem[];
  sauceOptions: OptionItem[];
  cheeseOptions: OptionItem[];
  sauceStripeOptions: OptionItem[];
  dipOptions: OptionItem[];
  // Per-product-size brief — 'size' is no longer exposed as one global
  // list here; each product carries its own `sizeOptions` directly (see
  // `Product.sizeOptions`, lib/types.ts) and `selection.sizeOptions` is a
  // per-open-product snapshot of it (see `Selection.sizeOptions`) — read
  // whichever of those is in scope instead.
  toppings: OptionItem[];
  toppingPrice: number;
  fillingCategories: FillingCategory[];
  allFillings: FillingItem[];
  storeClosed: boolean;
  trackingConfig: TrackingConfig;
  openingHours: OpeningHours;
  // Priority-fixes brief (roadmap gap analysis), Part 7 — special/
  // holiday hours overriding openingHours for specific calendar dates.
  // Same "real data, empty array until loaded" contract as openingHours.
  specialHours: SpecialHoursEntry[];
  // Bundle 1 Task 5 — admin-uploaded photos for the homepage story
  // banner slider (components/Story.tsx), in slide order. Same "real
  // data, empty array until loaded/configured" contract as
  // specialHours/openingHours above — an empty array means either "still
  // loading" or "the admin hasn't configured any yet", and Story.tsx
  // treats both the same way (its own on-brand placeholder, never the
  // old third-party random-image API).
  storyBannerImages: StoryBannerImage[];
  // Audit-fixes brief, Part 6.4 — real admin_settings.email/phone/address
  // (the same three keys lib/site-settings.ts's getPublicSettings reads
  // for /contact, /about, /pickup), so components/Footer.tsx and
  // components/Visit.tsx can stop hardcoding placeholder contact details
  // and instead show whatever the business has actually configured — same
  // "real data, empty string until it's loaded/configured" contract as
  // openingHours above. Read straight off /api/menu's own raw `settings`
  // blob (see the loadMenu effect below) rather than through
  // normalizeMenuBlob, since these three are plain locale-independent
  // strings with nothing for that function to localize.
  contactInfo: { email: string; phone: string; address: string };
  // Round-2 fixes brief, Part 1 — admin_settings.delivery_fee/minimum_order,
  // parsed to plain numbers (0 when unset/non-numeric — "not configured"
  // reads the same as "configured as free/no minimum", matching how
  // DeliveryPageClient.tsx's own formatEuro helper already treats an
  // empty/invalid value). Read from the exact same settings keys that
  // page and app/api/orders/route.ts's server-side enforcement both use,
  // so this can't drift out of sync with what checkout actually charges.
  // Only ever used for DISPLAY here (the cart/checkout UI) — the server
  // independently re-reads admin_settings and enforces the real fee/
  // minimum at order-creation time, never trusting this client value.
  deliverySettings: { fee: number; minimumOrder: number };
  drinks: Addon[];
  dipCups: Addon[];
  snacks: Addon[];
  // Growth features — shared discount-value shape (lib/types.ts's
  // DiscountValue). value 0 means "not configured" (see lib/menu-i18n.ts's
  // normalizeMenuBlob). firstOrderDiscount drives CheckoutModal.tsx's
  // welcome-discount banner.
  firstOrderDiscount: DiscountValue;
  // Growth features batch 2 (Feature 5) — the scheduled offer that's
  // active RIGHT NOW (Helsinki day/time), recomputed every minute (see
  // the ticking effect below) so the Header/CheckoutModal banners appear
  // and disappear on their own without a page reload — same
  // once-a-minute precision already used by components/TrackPageClient's
  // EtaCountdown. null when no configured offer is active. This is
  // advisory/display-only: app/api/orders/route.ts independently
  // re-evaluates and enforces the real discount server-side at the
  // actual moment of checkout, never trusting this client-side value.
  activeScheduledOffer: ScheduledOffer | null;

  // Bundles/combos + featured-card settings.
  bundles: Bundle[];
  featured: Featured;
  popularProductIds: string[];
  activeBundle: Bundle | null;
  bundleSlots: BundleSlot[];
  isBundleModalOpen: boolean;
  openBundle: (bundle: Bundle) => void;
  closeBundleModal: () => void;
  removeBundleSlotItem: (slotIndex: number, itemKey: string) => void;
  addBundleSlotItem: (slotIndex: number, product: Product) => void;
  bundleReady: boolean;
  bundleExtrasTotal: number;
  bundleTotal: number;
  addBundleToCart: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

// Bugfix (fake-URL-404 report) — this file used to build the pushState
// URL for an opened product via a `slugify(item.name)` helper, producing
// e.g. `/product/margherita-pizza`. That was a second, DIFFERENT id
// scheme from the real `/product/[id]` route (app/(site)/[locale]/
// product/[id]/page.tsx), which looks a product up by its actual
// database `id`, not a slugified name — so a customer who refreshed the
// browser while a product overlay was open almost never landed back on
// the right product (or any product at all): the slug frequently doesn't
// match any real id, so the real page's own `getProduct(id)` lookup
// misses and it calls `notFound()`. The fix below (in `openProduct`) now
// pushes `/product/${item.id}` instead — the exact id the real route
// already knows how to resolve — which removes the mismatch at its root
// instead of adding a second lookup/rewrite layer just for this one path
// shape. `slugify` no longer has any caller and was removed along with
// this comment's neighbor.
function setUrl(path: string) {
  if (typeof window === 'undefined') return;
  window.history.pushState({}, '', path);
}

// Fallback single-option lists used only until /api/menu has loaded, so the
// UI never crashes on first paint. Real values always come from the DB.
const FALLBACK_OPTION: OptionItem[] = [{ id: 'default', label: 'Default', delta: 0 }];

export interface StoreProviderInitialData {
  categories?: RawCategory[];
  products?: RawProduct[];
}

interface StoreProviderProps {
  children: ReactNode;
  initialData?: StoreProviderInitialData | null;
}

export function StoreProvider({ children, initialData }: StoreProviderProps) {
  const router = useRouter();
  // Bugfix (fake-URL-404 report) — the real, visible browser URL (never
  // affected by middleware.ts's rewrite of the fake overlay paths below
  // to a real route's content; a rewrite only changes what gets rendered,
  // never what the address bar/usePathname() report). Read once at mount
  // by the restore-on-load effect further down, to notice "we're on a
  // fake overlay path" after a hard refresh/direct load.
  const pathname = usePathname();

  // Bilingual site — every route in this app now lives under /fi or /en
  // (see middleware.js). `locale` comes from the [locale] URL segment via
  // useParams() (see lib/i18n/index.js), so it's correct from the very
  // first server-rendered paint, not just after hydration. `lp()` turns
  // an old-style bare path ("/menu", "/checkout") into the locale-correct
  // one — every navigation below uses it instead of a hardcoded path, so
  // a customer browsing in Finnish never gets bounced into English mid-flow.
  // useLocale() is typed (via next/navigation's useParams()) as
  // string | string[] since lib/i18n/index.js stays a plain .js module —
  // it only ever returns a single locale string ('fi' | 'en') at runtime.
  const locale = useLocale() as string;
  const lp = useLocalePath();
  const t = useTranslations();

  // Used by every "close this overlay" action (product page, checkout,
  // bundle builder, order confirmation). Deliberately always a real,
  // predictable Next.js navigation to the full menu — not a "smart" guess
  // at browser history, which is unreliable (a tab's history often holds
  // unrelated earlier pages, not just this app's own flow) and would make
  // "close" land in a different, confusing place depending on how the
  // customer arrived.
  const goBack = useCallback(() => {
    router.push(lp('/menu'));
  }, [router, lp]);

  const [cart, setCart] = useState<CartLine[]>([]);

  // Persist the cart across page navigations (/, /menu, /product/...) and
  // reloads within the same tab — without this, moving between the new
  // real URLs would silently empty a customer's cart.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('ozy_cart');
      if (saved) setCart(JSON.parse(saved));
    } catch {
      // Corrupt or unavailable storage — start with an empty cart.
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem('ozy_cart', JSON.stringify(cart));
    } catch {
      // Storage full/unavailable — cart still works for this page view.
    }
  }, [cart]);

  // Growth features (Feature 1 — reorder) — a one-shot flag set by
  // TrackPageClient.tsx right before it writes a reordered cart into
  // `ozy_cart` (above) and navigates to /menu. Consumed here, once, on
  // this fresh StoreProvider's first mount (every top-level page gets its
  // own StoreProvider instance — see this file's header — so /track's
  // "Reorder this" button can't just call setCheckoutOpen(true) directly,
  // it has no StoreContext in common with the page it's navigating to).
  // Removed immediately so a later reload of /menu (or navigating back to
  // it normally) never re-opens checkout unexpectedly.
  // Stamp-card redesign / discount-source tracking (Part C — "Reorders")
  // — a sibling one-shot flag to `ozy_open_checkout` above, set by the
  // SAME ReorderButton.continueToCheckout() call right before it writes
  // `ozy_cart` and navigates here. Consumed once, the same way, so the
  // order this cart turns into can be marked orders.is_reorder = 1 (see
  // placeOrder below) — nothing previously tracked this at all (traced
  // app/api/orders/[orderNum]/reorder/route.ts: it only rebuilds and
  // returns a cart, with no awareness of what happens to it afterwards).
  const [isReorderCart, setIsReorderCart] = useState(false);
  // Round-2 fixes brief, Part 5 — a third sibling one-shot flag, same
  // handoff pattern as ozy_open_checkout/ozy_is_reorder above: only ever
  // written (by TrackPageClient.tsx's ReorderButton) when the reordered
  // order was actually 'pickup', so null here means either "not a
  // reorder" or "was a delivery reorder" — both cases where
  // CheckoutModal.tsx's own 'delivery' starting state already needs no
  // override.
  const [reorderOrderType, setReorderOrderType] = useState<OrderType | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('ozy_open_checkout') === '1') {
        sessionStorage.removeItem('ozy_open_checkout');
        setCheckoutOpen(true);
        setUrl(lp('/checkout'));
      }
      if (sessionStorage.getItem('ozy_is_reorder') === '1') {
        sessionStorage.removeItem('ozy_is_reorder');
        setIsReorderCart(true);
      }
      if (sessionStorage.getItem('ozy_reorder_order_type') === 'pickup') {
        sessionStorage.removeItem('ozy_reorder_order_type');
        setReorderOrderType('pickup');
      }
    } catch {
      // Storage unavailable — reorder still lands the cart (see above),
      // just without auto-opening checkout; the customer can open it
      // themselves from the cart icon. is_reorder tracking degrades the
      // same way — purely informational, never blocks placing the order.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isProductPageOpen, setProductPageOpen] = useState(false);
  const [isCartOpen, setCartOpen] = useState(false);
  const [isCheckoutOpen, setCheckoutOpen] = useState(false);
  const [isDrinkUpsellOpen, setDrinkUpsellOpen] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(null);

  // ---- Menu data, loaded once from the database (/api/menu). ----
  // If a Server Component already fetched categories/products (see
  // app/menu/page.js etc.), seed state with them directly so the very
  // first render — including the server-rendered HTML search engines
  // see — already has real menu content, not an empty loading state.
  // The fetch effect below still runs afterward to pick up anything not
  // seeded (toppings, drinks, option groups) and to catch any changes
  // since the page was rendered.
  const [menuLoading, setMenuLoading] = useState(!initialData);
  // Size-selector-not-showing bug report — a SEPARATE flag from
  // `menuLoading` above, deliberately: `menuLoading` starts `false`
  // whenever a Server Component already seeded `initialData` (so pages
  // like the menu grid don't flash a loading skeleton they don't need —
  // `initialData` only ever carries `{ categories, products }`, and
  // normalizeCategories()/normalizeProducts() are already enough for
  // that grid). But `initialData`'s `products` are shaped by
  // normalizeProducts() (lib/menu-i18n.ts), which never attaches
  // `sizeOptions` at all — only the FULL normalizeMenuBlob() output from
  // this effect's own `/api/menu` fetch below does. A consumer that needs
  // a product's real per-product data (size tiers, but the same is true
  // of base/sauce/cheese/dip) needs to wait for THIS flag, not
  // `menuLoading` — see components/ProductPageStandalone.tsx's
  // AutoOpenProduct, the confirmed real consumer of this gap. Always
  // starts `false` (regardless of `initialData`) and only ever becomes
  // `true` once, right below, after this effect's fetch settles (success
  // or failure — same "don't hang forever" contract `menuLoading` itself
  // already has).
  const [menuFullyLoaded, setMenuFullyLoaded] = useState(false);
  const [menuError, setMenuError] = useState('');
  // initialData holds raw D1 rows (same shape loadMenuData()/`/api/menu`
  // return) — normalize + localize it here, to `locale`, so the very
  // first server-rendered HTML already shows the right language instead
  // of flashing English/raw text until the fetch effect below resolves.
  const [categories, setCategories] = useState<Category[]>(() => normalizeCategories(initialData?.categories, locale as 'fi' | 'en'));
  const [products, setProducts] = useState<Product[]>(() => normalizeProducts(initialData?.products, locale as 'fi' | 'en'));
  const [baseOptions, setBaseOptions] = useState<OptionItem[]>(FALLBACK_OPTION);
  const [sauceOptions, setSauceOptions] = useState<OptionItem[]>(FALLBACK_OPTION);
  const [cheeseOptions, setCheeseOptions] = useState<OptionItem[]>(FALLBACK_OPTION);
  const [sauceStripeOptions, setSauceStripeOptions] = useState<OptionItem[]>([{ id: 'default', label: 'None', delta: 0, color: 'transparent' }]);
  const [dipOptions, setDipOptions] = useState<OptionItem[]>(FALLBACK_OPTION);
  // Per-product-size brief — no global sizeOptions state anymore; each
  // product in `products` above already carries its own `sizeOptions`
  // (set by lib/menu-i18n.ts's normalizeMenuBlob).
  const [toppings, setToppings] = useState<OptionItem[]>([]); // [{ id, label, delta }]
  const [fillingCategories, setFillingCategories] = useState<FillingCategory[]>([]);
  const [storeClosed, setStoreClosed] = useState(false);
  const [trackingConfig, setTrackingConfig] = useState<TrackingConfig>({ ga4Id: null, metaPixelId: null, tiktokPixelId: null, clarityId: null });
  // Phase 7.7 — structured per-day opening hours (replaces the old
  // free-text admin_settings.opening_hours value). null until the /api/menu
  // fetch below resolves, or if the stored value is missing/still the old
  // free-text shape — components/Visit.js falls back to its own
  // placeholder rows in either case rather than rendering nothing.
  const [openingHours, setOpeningHours] = useState<OpeningHours>(null);
  // Priority-fixes brief (roadmap gap analysis), Part 7 — see this
  // field's own comment on StoreContextValue above.
  const [specialHours, setSpecialHours] = useState<SpecialHoursEntry[]>([]);
  // Bundle 1 Task 5 — see this field's own comment on StoreContextValue
  // above.
  const [storyBannerImages, setStoryBannerImages] = useState<StoryBannerImage[]>([]);
  // Audit-fixes brief, Part 6.4 — see this field's own comment on
  // StoreContextValue above. Empty strings (not null/undefined) so
  // Footer.tsx/Visit.tsx can treat "not loaded yet" and "not configured in
  // Admin → Settings" the same way, matching how every other optional
  // admin_settings-backed string is already handled in this codebase
  // (e.g. lib/site-settings.ts's PublicSettings fields).
  const [contactInfo, setContactInfo] = useState<{ email: string; phone: string; address: string }>({ email: '', phone: '', address: '' });
  // Round-2 fixes brief, Part 1 — see this field's own comment on
  // StoreContextValue above. 0/0 until the /api/menu fetch below resolves,
  // same "real data, harmless default until loaded" contract as the rest
  // of this file's admin_settings-backed state.
  const [deliverySettings, setDeliverySettings] = useState<{ fee: number; minimumOrder: number }>({ fee: 0, minimumOrder: 0 });
  const [drinks, setDrinks] = useState<Addon[]>([]);
  const [dipCups, setDipCups] = useState<Addon[]>([]);
  const [snacks, setSnacks] = useState<Addon[]>([]);
  const [firstOrderDiscount, setFirstOrderDiscount] = useState<DiscountValue>({ type: 'percent', value: 0 });
  const [scheduledOffers, setScheduledOffers] = useState<ScheduledOffer[]>([]);
  // Ticks once a minute so activeScheduledOffer (below) is recomputed
  // without requiring a menu refetch or page reload — same pattern as
  // components/TrackPageClient.tsx's EtaCountdown.
  const [offerClockTick, setOfferClockTick] = useState(0);

  // ---- Bundles/combos (e.g. "3 Pizza + 1.5L Lemonade — €45"). ----
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [featured, setFeatured] = useState<Featured>({ type: 'none' });
  const [popularProductIds, setPopularProductIds] = useState<string[]>([]);

  // ---- Bundle-building flow (filling a bundle's slots one item at a time). ----
  const [activeBundle, setActiveBundle] = useState<Bundle | null>(null);
  const [bundleSlots, setBundleSlots] = useState<BundleSlot[]>([]); // [{ ...slotDef, filled: [{ key, name, details, extra }] }]
  const [isBundleModalOpen, setBundleModalOpen] = useState(false);

  const allFillings = useMemo(
    () => fillingCategories.flatMap((c) => c.items),
    [fillingCategories]
  );

  useEffect(() => {
    const id = setInterval(() => setOfferClockTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    async function loadMenu() {
      try {
        // Only show the loading state if we don't already have seeded
        // data from the server — otherwise this background refresh
        // would flash the UI back to "loading" for no visible reason.
        if (!initialData) setMenuLoading(true);
        setMenuError('');

        const res = await fetch('/api/menu');
        if (!res.ok) throw new Error('Failed to load menu');
        // res.json() resolves to `unknown` under real fetch typings — cast
        // to MenuData, the shape /api/menu actually returns (and the shape
        // normalizeMenuBlob has always expected).
        const data = (await res.json()) as MenuData;

        // /api/menu itself stays raw/unlocalized (it's aggressively
        // cached — see app/api/menu/route.js — so it must not vary by
        // locale). Localization to the current [locale] segment happens
        // once, here, via the same shaping function the server-rendered
        // initial state above uses — see lib/menu-i18n.js.
        const blob = normalizeMenuBlob(data, locale as 'fi' | 'en');

        setCategories(blob.categories);
        setProducts(blob.products);
        setBaseOptions(blob.baseOptions);
        setSauceOptions(blob.sauceOptions);
        setCheeseOptions(blob.cheeseOptions);
        setSauceStripeOptions(blob.sauceStripeOptions);
        setDipOptions(blob.dipOptions);
        setToppings(blob.toppings);
        setFillingCategories(blob.fillingCategories);
        setDrinks(blob.drinks);
        setDipCups(blob.dipCups);
        setSnacks(blob.snacks);
        setBundles(blob.bundles);
        setStoreClosed(blob.storeClosed);
        setTrackingConfig(blob.trackingConfig);
        setOpeningHours(blob.openingHours);
        setSpecialHours(blob.specialHours);
        setStoryBannerImages(blob.storyBannerImages);
        // Audit-fixes brief, Part 6.4 — read straight off `data.settings`
        // (the raw, pre-normalizeMenuBlob response) rather than `blob`:
        // normalizeMenuBlob's return shape never carried these three
        // through (it only extracts the specific settings keys each of
        // its own existing callers needs), and there's nothing locale-
        // specific about a phone number or address to localize anyway.
        setContactInfo({
          email: data.settings?.email || '',
          phone: data.settings?.phone || '',
          address: data.settings?.address || '',
        });
        // Round-2 fixes brief, Part 1 — same raw-string-to-number parsing
        // as DeliveryPageClient.tsx's formatEuro (Number(...) on the raw
        // admin_settings string, falling back to 0 when unset/non-numeric)
        // so this page's own fee/minimum display can never show a
        // different number than /delivery does.
        {
          const rawFee = Number(data.settings?.delivery_fee);
          const rawMin = Number(data.settings?.minimum_order);
          setDeliverySettings({
            fee: Number.isFinite(rawFee) ? rawFee : 0,
            minimumOrder: Number.isFinite(rawMin) ? rawMin : 0,
          });
        }
        setFeatured(blob.featured);
        setPopularProductIds(blob.popularProductIds);
        setFirstOrderDiscount(blob.firstOrderDiscount);
        setScheduledOffers(blob.scheduledOffers);
      } catch (err) {
        console.error('Menu loading error:', err);
        setMenuError(t.menuSection.loadError);
      } finally {
        setMenuLoading(false);
        // Size-selector-not-showing bug report — see menuFullyLoaded's own
        // comment above. Set in `finally`, same as menuLoading, so a fetch
        // failure doesn't leave a consumer waiting on this forever either.
        setMenuFullyLoaded(true);
      }
    }

    loadMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  // Make the phone/browser back button close whatever panel is open
  // (product page, cart, checkout, drink upsell, confirmation) instead of
  // leaving the site. Every navigation in this app pushes a fake URL via
  // pushState for a nicer address bar, but none of those are real Next.js
  // routes — so without this listener, pressing back does nothing useful
  // and a second press exits the site entirely.
  useEffect(() => {
    const handlePopState = () => {
      setProductPageOpen(false);
      setCartOpen(false);
      setCheckoutOpen(false);
      setDrinkUpsellOpen(false);
      setConfirmedOrder(null);
      setBundleModalOpen(false);
      setActiveBundle(null);
      setBundleSlots([]);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Bugfix (fake-URL-404 report), part 2 of the fix — restores the
  // checkout/drink-upsell overlay on a hard refresh or direct load of
  // their fake pushState URL, instead of only avoiding the 404 (see
  // middleware.ts's rewrite of these same paths to a real route's
  // content). Runs once, at mount, on every top-level page (each of
  // HomePageClient/MenuPageClient/ProductPageStandalone mounts its own
  // StoreProvider — see those files) — so a refresh (a real, full page
  // load) always re-triggers it, while a normal in-app pushState-only
  // "open checkout" navigation never does (that doesn't remount this
  // provider at all).
  //
  // Deliberately narrow in what it restores:
  //   - /checkout and /drinks: restored, but ONLY when a saved cart
  //     exists (read directly from sessionStorage — the exact same
  //     source and shape as the cart-loading effect above — rather than
  //     depending on effect-ordering against that effect's own `cart`
  //     state update). This is the case the bug report calls out as the
  //     worst ("money-adjacent... mid-checkout is exactly when this is
  //     worst") and the one this app already has everything it needs to
  //     restore correctly: the cart itself persists across reloads, and
  //     CheckoutModal/DrinkUpsellModal only ever need `cart`/`cartTotal`
  //     to render (see those components) — no other ephemeral state.
  //   - /order-confirmed is deliberately NOT restored here: the order
  //     confirmation (confirmedOrder) is plain in-memory React state,
  //     never persisted anywhere, and the cart is already cleared the
  //     moment an order is placed (see finalizeOrder above) — so there is
  //     nothing left to restore, which is the intended, correct behavior
  //     per the bug report's own instruction ("shouldn't necessarily be
  //     able to replay a confirmation for an order that's no longer the
  //     live cart state"): a refreshed /order-confirmed now shows a
  //     normal working page with an empty cart, not a replayed receipt.
  //   - /bundle is deliberately NOT restored here either, but for a
  //     different reason: which bundle was being built (activeBundle)
  //     and its slot contents (bundleSlots) are, like confirmedOrder,
  //     plain in-memory state with no persisted counterpart — there is
  //     no real data to restore it FROM. Reopening an empty/unknown
  //     bundle modal would be worse than not reopening it at all. A
  //     refreshed /bundle now shows a normal working page instead of a
  //     404; re-starting a bundle from the menu is the one remaining gap
  //     this report flags as a reasonable separate/later task rather
  //     than something to paper over here.
  //   - /product/<id> needs no restoring here at all — see the header
  //     comment on `setUrl`/openProduct's own comment: it's now a real,
  //     resolvable route that already re-opens the product overlay on
  //     its own (components/ProductPageStandalone.tsx's AutoOpenProduct).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const afterLocale = (pathname || '').replace(new RegExp(`^/${locale}`), '') || '/';
    if (afterLocale !== '/checkout' && afterLocale !== '/drinks') return;

    let hasSavedCart = false;
    try {
      const saved = sessionStorage.getItem('ozy_cart');
      const parsed = saved ? JSON.parse(saved) : [];
      hasSavedCart = Array.isArray(parsed) && parsed.length > 0;
    } catch {
      hasSavedCart = false;
    }
    if (!hasSavedCart) return;

    setCartOpen(false);
    if (afterLocale === '/checkout') {
      setDrinkUpsellOpen(false);
      setCheckoutOpen(true);
    } else {
      setCheckoutOpen(false);
      setDrinkUpsellOpen(true);
    }
    // Deliberately run only once, at mount — see this effect's own
    // header comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fillingsTotal = useCallback(
    (fillings: Record<string, number> | undefined) =>
      Object.entries(fillings || {}).reduce((sum, [id, qty]) => {
        if (!qty) return sum;
        const item = allFillings.find((f) => f.id === id);
        return item ? sum + item.price * qty : sum;
      }, 0),
    [allFillings]
  );

  const calcUnitPrice = useCallback(
    (product: Selection | null) => {
      if (!product) return 0;
      let unit = product.basePrice;
      // Option-gating-and-extras-system brief, Task 2 — mirrors
      // lib/pricing.ts's calcUnitPriceFromSelection exactly: extras are
      // summed BEFORE (independent of) the `toppingsEnabled` check below,
      // unlike every other option kind in this function, since extras
      // must price correctly on a non-customizable product too (e.g. a
      // kebab). Each selected extra's OWN delta (never a flat rate),
      // looked up only against `product.extraOptions` — THIS product's
      // own snapshotted extras (Selection.extraOptions), never a
      // context-level global list.
      for (const id of product.extraIds) {
        unit += product.extraOptions.find((o) => o.id === id)?.delta || 0;
      }
      if (product.toppingsEnabled) {
        const toppingPrice = toppings[0]?.delta || 0;
        unit += product.toppings.length * toppingPrice;
        unit += baseOptions.find((o) => o.id === product.base)?.delta || 0;
        unit += sauceOptions.find((o) => o.id === product.sauce)?.delta || 0;
        unit += cheeseOptions.find((o) => o.id === product.cheese)?.delta || 0;
        unit += fillingsTotal(product.fillings);
        unit += sauceStripeOptions.find((o) => o.id === product.sauceStripe)?.delta || 0;
        unit += dipOptions.find((o) => o.id === product.dip)?.delta || 0;
        // Per-product-size brief — looked up against `product.sizeOptions`,
        // a snapshot of the ACTIVE PRODUCT's own size tiers captured onto
        // Selection when its page opened (see openProduct below and
        // Selection.sizeOptions's own comment) — never a context-level
        // global list, mirroring lib/pricing.ts's calcUnitPriceFromSelection
        // exactly (same per-product scoping, same reasoning).
        unit += product.sizeOptions.find((o) => o.id === product.sizeOptionId)?.delta || 0;
      }
      return unit;
    },
    [toppings, baseOptions, sauceOptions, cheeseOptions, sauceStripeOptions, dipOptions, fillingsTotal]
  );

  // bundleSlotIndex: when set, this ProductPage visit is filling one item of
  // a bundle slot (see openBundle below) instead of a normal cart add.
  // skipUrlPush: set by the standalone /product/[id] page, which already
  // did a real Next.js navigation to get here — pushing another cosmetic
  // URL on top would break the browser back button.
  const openProduct = useCallback(
    (item: Product, bundleSlotIndex: number | null = null, { skipUrlPush = false }: OpenProductOptions = {}) => {
      setActiveProduct(item);
      if (bundleSlotIndex == null) trackViewItem(item);
      setSelection({
        // price is typed optional (Product.price?) but always populated for
        // a real product — non-null assertion is a no-op fix under strict mode.
        basePrice: item.price!,
        // `item` here is sometimes the already-processed product from the
        // `products` list (has a real toppingsEnabled boolean, set by
        // lib/menu-i18n.js's normalize function), and sometimes a raw D1
        // row passed straight from the server (the /product/[id] page's
        // productHint) — which only has has_toppings, not
        // toppingsEnabled. Falling back to has_toppings covers that
        // second case; without it, opening a product via its direct URL
        // showed just the name with no toppings/options at all, since
        // `item.toppings` doesn't exist on either shape.
        toppingsEnabled: item.toppingsEnabled ?? Boolean(item.has_toppings),
        qty: 1,
        toppings: [],
        base: baseOptions[0]?.id,
        sauce: sauceOptions[0]?.id,
        cheese: cheeseOptions[0]?.id,
        fillings: {},
        sauceStripe: sauceStripeOptions[0]?.id,
        dip: dipOptions[0]?.id,
        // Per-product-size brief — THIS product's own size tiers, snapshotted
        // onto Selection (see Selection.sizeOptions's own comment). `item`
        // is always the fully-normalized product from `products` by the
        // time this runs for real (see components/ProductPageStandalone.tsx's
        // AutoOpenProduct — it waits for `products` to load before ever
        // calling openProduct, the raw productHint is only ever used for a
        // loading skeleton) so `item.sizeOptions` is populated in practice;
        // the fallback below is defensive, same spirit as the
        // toppingsEnabled fallback just above.
        sizeOptions: item.sizeOptions && item.sizeOptions.length ? item.sizeOptions : FALLBACK_OPTION,
        // Defaults to the first (cheapest, since options arrive sorted by
        // sort_order — see lib/menu-i18n.ts) size option, same "pre-select
        // index 0" pattern as base/sauce/cheese/dip above — required,
        // single-select, never left unset.
        sizeOptionId: (item.sizeOptions && item.sizeOptions[0]?.id) || FALLBACK_OPTION[0].id,
        // Option-gating-and-extras-system brief, Task 2 — THIS product's
        // own extras, snapshotted onto Selection exactly like sizeOptions
        // above. No default-selected entry (unlike size's index-0
        // pre-select) — extras start with nothing selected, since they're
        // optional multi-select, not required single-select.
        extraIds: [],
        extraOptions: item.extraOptions && item.extraOptions.length ? item.extraOptions : [],
        bundleSlotIndex,
      });
      setProductPageOpen(true);
      // Fixed to push the product's real `id` (see this file's header
      // comment on `setUrl`) instead of a slugified name — this URL now
      // resolves correctly on the real /product/[id] route, so refreshing
      // the browser while this overlay is open lands the customer on the
      // real, fully-working standalone product page for this exact
      // product (which auto-reopens this same overlay on top of itself —
      // see components/ProductPageStandalone.tsx's AutoOpenProduct)
      // instead of a 404.
      if (bundleSlotIndex == null && !skipUrlPush) setUrl(lp(`/product/${item.id}`));
    },
    [baseOptions, sauceOptions, cheeseOptions, sauceStripeOptions, dipOptions, lp]
  );

  const closeProduct = useCallback(() => {
    if (selection?.bundleSlotIndex != null) {
      // Was filling a bundle slot — go back to the bundle modal, not home.
      setProductPageOpen(false);
      setBundleModalOpen(true);
      return;
    }
    // Deliberately not closing the overlay before navigating — see the
    // note in addToCart above.
    goBack();
  }, [selection, goBack]);

  const toggleTopping = useCallback((topping: string) => {
    setSelection((s) => {
      if (!s) return s;
      const has = s.toppings.includes(topping);
      return {
        ...s,
        toppings: has ? s.toppings.filter((t) => t !== topping) : [...s.toppings, topping],
      };
    });
  }, []);

  // Option-gating-and-extras-system brief, Task 2 — see this function's
  // own StoreContextValue comment for why extras toggle by id, not label.
  const toggleExtra = useCallback((extraId: string) => {
    setSelection((s) => {
      if (!s) return s;
      const has = s.extraIds.includes(extraId);
      return {
        ...s,
        extraIds: has ? s.extraIds.filter((id) => id !== extraId) : [...s.extraIds, extraId],
      };
    });
  }, []);

  // setQty/setOption are only ever invoked while the ProductPage is
  // open, i.e. selection is already set — same invariant the original JS
  // relied on implicitly (s.qty etc. would already throw at runtime if s
  // were null here). `s as Selection` tells the type checker what the
  // runtime already assumes, without adding a behavior-changing null guard;
  // matches the existing `(s as any)` cast setOption already used before
  // this pass, just narrowed to a real type instead of `any`.
  // Per-product-size brief — `setSize`/the M/L toggle is fully retired;
  // size selection now goes entirely through `setOption('sizeOptionId', id)`
  // like every other option kind.
  const setQty = useCallback((fn: (qty: number) => number) => setSelection((s) => ({ ...(s as Selection), qty: Math.max(1, fn((s as Selection).qty)) })), []);
  const setOption = useCallback((key: string, id: string) => setSelection((s) => ({ ...(s as Selection), [key]: id })), []);

  const setFillingQty = useCallback((fillingId: string, nextQty: number) => {
    setSelection((s) => {
      if (!s) return s;
      const qty = Math.max(0, nextQty);
      const fillings = { ...s.fillings };
      if (qty === 0) {
        delete fillings[fillingId];
      } else {
        fillings[fillingId] = qty;
      }
      return { ...s, fillings };
    });
  }, []);

  const unitPrice = useMemo(() => calcUnitPrice(selection), [selection, calcUnitPrice]);
  const lineTotal = useMemo(() => (selection ? unitPrice * selection.qty : 0), [unitPrice, selection]);

  const addToCart = useCallback(() => {
    if (!activeProduct || !selection) return;
    const details: string[] = [];
    if (selection.toppingsEnabled) {
      selection.toppings.forEach((topping) => details.push(topping));
      const baseOpt = baseOptions.find((o) => o.id === selection.base);
      if (baseOpt && baseOpt.id !== baseOptions[0]?.id) details.push(baseOpt.label);
      const sauceOpt = sauceOptions.find((o) => o.id === selection.sauce);
      if (sauceOpt && sauceOpt.id !== sauceOptions[0]?.id) details.push(sauceOpt.label);
      const cheeseOpt = cheeseOptions.find((o) => o.id === selection.cheese);
      if (cheeseOpt && cheeseOpt.id !== cheeseOptions[0]?.id) details.push(cheeseOpt.label);
      Object.entries(selection.fillings || {}).forEach(([id, qty]) => {
        const item = allFillings.find((f) => f.id === id);
        if (item && qty > 0) details.push(qty > 1 ? `${item.label} x${qty}` : item.label);
      });
      const sauceStripeOpt = sauceStripeOptions.find((o) => o.id === selection.sauceStripe);
      if (sauceStripeOpt && sauceStripeOpt.id !== sauceStripeOptions[0]?.id) details.push(sauceStripeOpt.label);
      const dipOpt = dipOptions.find((o) => o.id === selection.dip);
      if (dipOpt && dipOpt.id !== dipOptions[0]?.id) details.push(dipOpt.label);
      // Pizza-size-feature brief — same "only note it in details when it's
      // not the default/cheapest choice" convention as base/sauce/cheese/
      // sauce-stripe/dip above. Per-product-size brief — looked up against
      // `selection.sizeOptions`, THIS product's own snapshotted size tiers
      // (see Selection.sizeOptions's own comment), never a context-level
      // global list.
      const sizeOpt = selection.sizeOptions.find((o) => o.id === selection.sizeOptionId);
      if (sizeOpt && sizeOpt.id !== selection.sizeOptions[0]?.id) details.push(sizeOpt.label);
    }

    // Option-gating-and-extras-system brief, Task 2 — extras are listed in
    // `details` regardless of `selection.toppingsEnabled` (outside the
    // `if` block above, unlike every other option kind), since extras must
    // work on a non-customizable product too (e.g. a kebab).
    selection.extraIds.forEach((id) => {
      const extraOpt = selection.extraOptions.find((o) => o.id === id);
      if (extraOpt) details.push(extraOpt.label);
    });

    // Structured pricing data (money-correctness pass) — the actual
    // option/size/filling IDs behind the `details` display strings above,
    // so POST /api/orders can recompute the exact price from real D1
    // option deltas instead of trusting `unitPrice`/`lineTotal` as sent.
    // Set for a customizable product OR a product with its own real
    // extras (Task 2 — `selection.extraOptions.length > 0`) — a plain
    // product with neither has just its base price, nothing to verify
    // beyond that, and the server already checks that independently.
    const selectionData: CartLineSelectionData | undefined = (selection.toppingsEnabled || selection.extraOptions.length > 0)
      ? {
          toppingIds: selection.toppings,
          baseId: selection.base,
          sauceId: selection.sauce,
          cheeseId: selection.cheese,
          fillings: selection.fillings,
          sauceStripeId: selection.sauceStripe,
          dipId: selection.dip,
          // Pizza-size-feature brief — carried through to the cart line's
          // structured pricing data exactly like baseId/sauceId/etc. above,
          // so POST /api/orders (via lib/pricing.ts) can independently
          // re-derive this line's exact price from the real, current
          // sizeOptions delta instead of trusting `unitPrice`/`lineTotal`.
          // Per-product-size brief — the server looks this id up against
          // THIS SPECIFIC product's own sizeOptions (see lib/pricing.ts's
          // calcUnitPriceFromSelection), so a tampered id from a different
          // product's size group simply isn't found there and contributes 0.
          sizeOptionId: selection.sizeOptionId,
          // Option-gating-and-extras-system brief, Task 2 — carried
          // through exactly like sizeOptionId above (server-side re-
          // derivation, per-product tamper protection via lib/pricing.ts's
          // calcUnitPriceFromSelection), regardless of toppingsEnabled —
          // see this const's own updated comment.
          extraIds: selection.extraIds,
        }
      : undefined;

    if (selection.bundleSlotIndex != null) {
      // Filling a bundle slot: only the customization *extra* (over the
      // product's base price) adds to the bundle total — the base price
      // is already covered by the bundle's flat price. Qty isn't used
      // here; each bundle slot unit is added one at a time.
      // basePrice is typed optional (Product.basePrice?) but always populated
      // for a real product — non-null assertion is a no-op fix under strict mode.
      const extra = unitPrice - activeProduct.basePrice!;
      // Captured to a local const — same closure-narrowing reason as
      // elsewhere in this migration: the `!= null` check above narrows the
      // `selection.bundleSlotIndex` *property access*, but that narrowing
      // doesn't survive into this nested setBundleSlots callback.
      const bundleSlotIndex = selection.bundleSlotIndex;
      setBundleSlots((slots) => {
        const next = [...slots];
        const slot = next[bundleSlotIndex];
        if (!slot) return slots;
        next[bundleSlotIndex] = {
          ...slot,
          filled: [
            ...slot.filled,
            { key: `${activeProduct.id}-${Date.now()}`, productId: activeProduct.id, name: activeProduct.name, details, extra, selection: selectionData },
          ],
        };
        return next;
      });
      setProductPageOpen(false);
      setBundleModalOpen(true);
      return;
    }

    setCart((c) => [
      ...c,
      {
        key: `${activeProduct.id}-${Date.now()}`,
        productId: activeProduct.id,
        name: activeProduct.name,
        image: activeProduct.image,
        details,
        qty: selection.qty,
        unitPrice,
        lineTotal,
        selection: selectionData,
      },
    ]);
    trackAddToCart({ productId: activeProduct.id, name: activeProduct.name, details, qty: selection.qty, unitPrice, lineTotal });
    // Deliberately not closing the overlay here — navigating straight to
    // /menu means the whole page (overlay included) swaps out in one go,
    // instead of a flash of the bare page underneath first.
    goBack();
  }, [
    activeProduct, selection, unitPrice, lineTotal,
    baseOptions, sauceOptions, cheeseOptions, sauceStripeOptions, dipOptions, allFillings, goBack,
  ]);

  const removeFromCart = useCallback((key: string) => {
    setCart((c) => c.filter((line) => line.key !== key));
  }, []);

  const addDrinkToCart = useCallback((drink: Addon) => {
    setCart((c) => {
      const existing = c.find((line) => line.drinkId === drink.id);
      if (existing) {
        return c.map((line) =>
          line.key === existing.key
            ? { ...line, qty: line.qty + 1, lineTotal: line.unitPrice * (line.qty + 1) }
            : line
        );
      }
      return [
        ...c,
        {
          key: `${drink.id}-${Date.now()}`,
          drinkId: drink.id,
          productId: drink.id,
          name: drink.name,
          image: drink.image,
          details: [],
          qty: 1,
          unitPrice: drink.price,
          lineTotal: drink.price,
        },
      ];
    });
  }, []);

  const updateCartQty = useCallback((key: string, nextQty: number) => {
    setCart((c) => {
      if (nextQty <= 0) return c.filter((line) => line.key !== key);
      return c.map((line) =>
        line.key === key
          ? { ...line, qty: nextQty, lineTotal: line.unitPrice * nextQty }
          : line
      );
    });
  }, []);

  const cartTotal = useMemo(() => cart.reduce((sum, l) => sum + l.lineTotal, 0), [cart]);

  // Growth features batch 2 (Feature 5) — moved below cartTotal (was
  // declared right after the scheduledOffers state above) so it can pass
  // the current cart total as findBestActiveScheduledOffer's `baseAmount`
  // — shared discount-value pattern (part 2 of this task): "most
  // favorable" among multiple simultaneously-active offers now needs a
  // real euro amount to compare against, since an offer's discount can
  // be either a percent or a flat amount (see that function's own
  // comment). Falls back to comparing raw values when cartTotal is 0
  // (empty cart) — same as passing no baseAmount at all.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- offerClockTick is a deliberate re-evaluation trigger, not a real dependency of the computation.
  const activeScheduledOffer = useMemo(
    () => findBestActiveScheduledOffer(scheduledOffers, cartTotal || undefined),
    [scheduledOffers, cartTotal, offerClockTick]
  );

  const goToCheckout = useCallback(() => {
    if (cart.length === 0) return;
    trackBeginCheckout(cart, cartTotal);
    setCartOpen(false);
    setDrinkUpsellOpen(true);
    setUrl(lp('/drinks'));
  }, [cart, cartTotal, lp]);

  // Header cart icon uses this — skips the drink-upsell step entirely and
  // goes straight to the checkout form.
  const goToCheckoutDirect = useCallback(() => {
    if (cart.length === 0) return;
    trackBeginCheckout(cart, cartTotal);
    setCartOpen(false);
    setDrinkUpsellOpen(false);
    setCheckoutOpen(true);
    setUrl(lp('/checkout'));
  }, [cart, cartTotal, lp]);

  const closeCheckout = useCallback(() => {
    setCheckoutOpen(false);
    goBack();
  }, [goBack]);

  const continueFromUpsell = useCallback(() => {
    setDrinkUpsellOpen(false);
    setCheckoutOpen(true);
    setUrl(lp('/checkout'));
  }, [lp]);

  // The tail end of what placeOrder used to do unconditionally: show the
  // confirmation screen, clear the cart, navigate. Split out so the card
  // path can defer it until AFTER the customer actually pays (see
  // placeOrder below) instead of the moment the order row is created.
  const finalizeOrder = useCallback((customer: Customer, data: {
    orderNum: string;
    total?: number;
    discountAmount?: number;
    discountSource?: DiscountSource | null;
    welcomeDiscountApplied?: boolean;
    scheduledOfferApplied?: { id: string; label: string } | null;
    loyalty?: { orderCount: number; everyNOrders: number; pendingRewardCreated: boolean };
    wowMomentRewardCode?: string | null;
  }, paymentMethod: 'cod' | 'card' = 'cod', orderType: OrderType = 'delivery') => {
    // Use the server's own total (post-discount, if a coupon applied) for
    // both the purchase event and the confirmation screen — it's the
    // authoritative number, not the client's pre-validation preview.
    const finalTotal = typeof data.total === 'number' ? data.total : cartTotal;
    trackPurchase(data.orderNum, cart, finalTotal);
    setConfirmedOrder({
      orderNum: `#${data.orderNum}`,
      customer,
      total: finalTotal,
      discountAmount: data.discountAmount || 0,
      items: cart,
      loyalty: data.loyalty,
      welcomeDiscountApplied: data.welcomeDiscountApplied,
      scheduledOfferApplied: data.scheduledOfferApplied,
      wowMomentRewardCode: data.wowMomentRewardCode,
      discountSource: data.discountSource,
      // Part A (order confirmation screen) — the caller already knows
      // which method this order was placed with (placeOrder's own
      // `paymentMethod` param, in scope at both call sites below); just
      // threading it through here so ConfirmModal can show the right
      // message. Doesn't change what gets charged or how — purely display.
      paymentMethod,
      // Round-2 fixes brief, Part 5 — same treatment as paymentMethod
      // above: threaded through purely so ConfirmModal can show
      // pickup-appropriate copy, never used in any price calculation.
      orderType,
    });
    setCheckoutOpen(false);
    setCart([]);
    setIsReorderCart(false);
    setReorderOrderType(null);
    setUrl(lp('/order-confirmed'));
  }, [cart, cartTotal, lp]);

  const placeOrder = useCallback(async (customer: Customer, couponCode?: string, paymentMethod: 'cod' | 'card' = 'cod', orderType: OrderType = 'delivery') => {
    if (storeClosed) {
      throw new Error(t.checkout.storeClosedError);
    }
    const payload = {
      customer,
      total: cartTotal,
      couponCode: couponCode || undefined,
      paymentMethod,
      // Round-2 fixes brief, Part 5 — a sibling to paymentMethod, read by
      // app/api/orders/route.ts to decide whether to require address/
      // postal code, run the delivery-zone check, and add the Part 1
      // delivery fee. Never used for pricing on the client — the server
      // re-derives everything from this flag plus its own admin_settings
      // reads, same "never trust the client" principle as every other
      // amount in this payload.
      orderType,
      // Priority-fixes brief (roadmap gap analysis), Bundle 1 Task 1 —
      // captured once here (from this component's own `locale`, already
      // read above via useLocale()) so the server can persist it on the
      // order row and send every later transactional email in the same
      // language the customer was actually checking out in — see
      // app/api/orders/route.ts's CreateOrderBody.locale.
      locale,
      // Whether this customer consented to marketing/analytics cookies
      // (see components/CookieBanner.js) — read fresh at order time
      // rather than trusted from anywhere else, so the server knows
      // whether it's allowed to fire ad-platform conversion events for
      // this specific order. Defaults to false (no consent) if the
      // banner hasn't been shown/answered yet for some reason, which is
      // the safe default.
      marketingConsent: typeof window !== 'undefined' && localStorage.getItem('ozy_cookie_consent') === 'all',
      // Stamp-card redesign / discount-source tracking (Part C —
      // "Reorders") — purely informational (see the `isReorderCart` state
      // above); the server trusts this as-is and never uses it in any
      // price or discount calculation, same trust level as
      // marketingConsent.
      isReorder: isReorderCart,
      items: cart.map((line) => ({
        productId: line.productId || null,
        name: line.name,
        qty: line.qty,
        lineTotal: line.lineTotal,
        details: line.details || [],
        // Structured pricing data (money-correctness pass) — see
        // lib/pricing.ts / app/api/orders/route.ts for how the server
        // uses these to recompute and verify lineTotal above, instead of
        // trusting it. Omitted (undefined) for a plain product or addon
        // line, which has nothing beyond its base price to verify.
        selection: line.selection,
        bundleId: line.bundleId,
        bundleItems: line.bundleItems,
      })),
    };

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || t.checkout.genericOrderError);
    }

    // res.json() resolves to `unknown` under real fetch typings — cast to
    // the shape POST /api/orders actually returns.
    const data = (await res.json()) as {
      orderNum: string;
      total?: number;
      discountAmount?: number;
      discountSource?: DiscountSource | null;
      welcomeDiscountApplied?: boolean;
      scheduledOfferApplied?: { id: string; label: string } | null;
      loyalty?: { orderCount: number; everyNOrders: number; pendingRewardCreated: boolean };
      wowMomentRewardCode?: string | null;
      clientSecret?: string | null;
    };

    // Remember this order on the customer's own device — /track can then
    // offer it as a one-tap shortcut without them needing to note down
    // the order number themselves. Written regardless of payment method:
    // the order row already exists in D1 (payment_status 'pending' for an
    // unpaid card order), so /track can already find it either way.
    try {
      const saved: RecentOrder[] = JSON.parse(localStorage.getItem('ozy_recent_orders') || '[]');
      const next = [
        { orderNum: data.orderNum, phone: customer.phone, placedAt: new Date().toISOString() },
        ...saved.filter((o) => o.orderNum !== data.orderNum),
      ].slice(0, 5);
      localStorage.setItem('ozy_recent_orders', JSON.stringify(next));
    } catch {
      // Non-essential — tracking still works via manual entry either way.
    }

    if (data.clientSecret) {
      // Card order: the order row exists but is still unpaid. Don't
      // finalize yet — hand the caller what it needs to collect payment
      // (CheckoutModal renders CardPaymentStep with this clientSecret) and
      // let it call finalize() itself once Stripe confirms the charge.
      return {
        requiresPayment: true as const,
        clientSecret: data.clientSecret,
        finalize: () => finalizeOrder(customer, data, 'card', orderType),
        orderNum: data.orderNum,
        // Server-authoritative (post price-verification, post-discount)
        // total for THIS order — falls back to the client's own cartTotal
        // only if the response is somehow missing `total` (shouldn't
        // happen; POST /api/orders always returns it), same defensive
        // pattern finalizeOrder's own `finalTotal` above already uses.
        amount: typeof data.total === 'number' ? data.total : cartTotal,
      };
    }

    finalizeOrder(customer, data, paymentMethod, orderType);
    return { requiresPayment: false as const };
  }, [cart, cartTotal, storeClosed, t, isReorderCart, finalizeOrder]);

  /* ---- Bundle building (e.g. "3 Pizza + 1.5L Lemonade — €45"). ---- */

  const openBundle = useCallback(
    (bundle: Bundle) => {
      const slots: BundleSlot[] = (bundle.slots || []).map((s: BundleSlotDef) => {
        if (s.kind === 'fixed') {
          // Fixed slots are included as-is — no customer choice needed,
          // so they're pre-filled immediately.
          const product = products.find((p) => p.id === s.productId);
          return {
            ...s,
            // A 'fixed' slot always names its product (that's what makes it
            // fixed rather than a customer choice) — s.productId is typed
            // optional on the shared BundleSlotDef only because 'choice'
            // slots don't set it. Non-null assertions here are a no-op fix
            // under strict mode, matching BundleSlotFilledItem's required
            // (non-optional) productId/name fields.
            filled: Array.from({ length: s.qty || 1 }, (_, i) => ({
              key: `${s.productId}-fixed-${i}`,
              productId: s.productId!,
              name: product?.name || s.label || s.productId!,
              details: [],
              extra: 0,
            })),
          };
        }
        return { ...s, filled: [] };
      });
      setActiveBundle(bundle);
      setBundleSlots(slots);
      setBundleModalOpen(true);
      setUrl(lp('/bundle'));
    },
    [products, lp]
  );

  const closeBundleModal = useCallback(() => {
    setBundleModalOpen(false);
    setActiveBundle(null);
    setBundleSlots([]);
    goBack();
  }, [goBack]);

  const removeBundleSlotItem = useCallback((slotIndex: number, itemKey: string) => {
    setBundleSlots((slots) => {
      const next = [...slots];
      const slot = next[slotIndex];
      if (!slot) return slots;
      next[slotIndex] = { ...slot, filled: slot.filled.filter((it) => it.key !== itemKey) };
      return next;
    });
  }, []);

  // Quick-pick for a choice slot: adds the product as-is (default topping/
  // size, no extra charge) without detouring through the full product
  // customization page — a single tap fills one unit of the slot.
  const addBundleSlotItem = useCallback((slotIndex: number, product: Product) => {
    setBundleSlots((slots) => {
      const next = [...slots];
      const slot = next[slotIndex];
      if (!slot) return slots;
      next[slotIndex] = {
        ...slot,
        filled: [
          ...slot.filled,
          { key: `${product.id}-${Date.now()}`, productId: product.id, name: product.name, details: [], extra: 0 },
        ],
      };
      return next;
    });
  }, []);

  const bundleReady = useMemo(
    () => bundleSlots.length > 0 && bundleSlots.every((s) => s.filled.length >= (s.qty || 1)),
    [bundleSlots]
  );

  const bundleExtrasTotal = useMemo(
    () => bundleSlots.reduce((sum, s) => sum + s.filled.reduce((a, it) => a + (it.extra || 0), 0), 0),
    [bundleSlots]
  );

  const bundleTotal = useMemo(
    () => (activeBundle ? activeBundle.price + bundleExtrasTotal : 0),
    [activeBundle, bundleExtrasTotal]
  );

  const addBundleToCart = useCallback(() => {
    if (!activeBundle || !bundleReady) return;
    const details = bundleSlots.flatMap((s) =>
      s.filled.map((it) => (it.details.length ? `${it.name} (${it.details.join(', ')})` : it.name))
    );
    // Structured pricing data (money-correctness pass) — one entry per
    // filled slot unit (fixed and choice alike, same flattening as
    // `details` above), each carrying the same `selection` a full
    // ProductPage customization set (see addToCart's bundleSlotIndex
    // branch) or nothing for a quick-pick/fixed item (always uncustomized
    // — extra 0). Lets POST /api/orders recompute this bundle's total
    // (base price + each item's real customization extra) instead of
    // trusting `bundleTotal` as sent.
    const bundleItems: CartLineBundleItem[] = bundleSlots.flatMap((s) =>
      s.filled.map((it) => ({ productId: it.productId, selection: it.selection }))
    );
    setCart((c) => [
      ...c,
      {
        key: `bundle-${activeBundle.id}-${Date.now()}`,
        productId: activeBundle.id,
        name: activeBundle.title,
        image: activeBundle.image,
        details,
        qty: 1,
        unitPrice: bundleTotal,
        lineTotal: bundleTotal,
        bundleId: activeBundle.id,
        bundleItems,
      },
    ]);
    closeBundleModal();
  }, [activeBundle, bundleReady, bundleSlots, bundleTotal, closeBundleModal]);

  const closeConfirm = useCallback(() => {
    setConfirmedOrder(null);
    goBack();
  }, [goBack]);

  const value: StoreContextValue = {
    cart,
    cartTotal,
    activeProduct,
    selection,
    unitPrice,
    lineTotal,
    isProductPageOpen,
    isCartOpen,
    isCheckoutOpen,
    isDrinkUpsellOpen,
    setDrinkUpsellOpen,
    continueFromUpsell,
    confirmedOrder,
    openProduct,
    closeProduct,
    toggleTopping,
    toggleExtra,
    setQty,
    setOption,
    setFillingQty,
    addToCart,
    removeFromCart,
    addDrinkToCart,
    updateCartQty,
    setCartOpen,
    goToCheckout,
    goToCheckoutDirect,
    setCheckoutOpen,
    closeCheckout,
    placeOrder,
    setConfirmedOrder,
    closeConfirm,
    reorderOrderType,

    // Menu data (from /api/menu — the database).
    menuLoading,
    menuFullyLoaded,
    menuError,
    categories,
    products,
    baseOptions,
    sauceOptions,
    cheeseOptions,
    sauceStripeOptions,
    dipOptions,
    toppings,
    toppingPrice: toppings[0]?.delta || 0,
    fillingCategories,
    allFillings,
    storeClosed,
    trackingConfig,
    openingHours,
    specialHours,
    storyBannerImages,
    contactInfo,
    deliverySettings,
    drinks,
    dipCups,
    snacks,
    firstOrderDiscount,
    activeScheduledOffer,

    // Bundles/combos + featured-card settings.
    bundles,
    featured,
    popularProductIds,
    activeBundle,
    bundleSlots,
    isBundleModalOpen,
    openBundle,
    closeBundleModal,
    removeBundleSlotItem,
    addBundleSlotItem,
    bundleReady,
    bundleExtrasTotal,
    bundleTotal,
    addBundleToCart,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
