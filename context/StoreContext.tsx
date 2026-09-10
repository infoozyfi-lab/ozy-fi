'use client';

import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import { trackViewItem, trackAddToCart, trackBeginCheckout, trackPurchase } from '@/lib/analytics';
import { useLocale, useLocalePath, useTranslations } from '@/lib/i18n';
import { normalizeCategories, normalizeProducts, normalizeMenuBlob } from '@/lib/menu-i18n';
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
  Selection,
  Customer,
  ConfirmedOrder,
  OpenProductOptions,
  RawCategory,
  RawProduct,
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
  setSize: (size: 'M' | 'L') => void;
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
  placeOrder: (customer: Customer, couponCode?: string) => Promise<void>;
  setConfirmedOrder: Dispatch<SetStateAction<ConfirmedOrder | null>>;
  closeConfirm: () => void;

  // Menu data (from /api/menu — the database).
  menuLoading: boolean;
  menuError: string;
  categories: Category[];
  products: Product[];
  baseOptions: OptionItem[];
  sauceOptions: OptionItem[];
  cheeseOptions: OptionItem[];
  sauceStripeOptions: OptionItem[];
  dipOptions: OptionItem[];
  toppings: OptionItem[];
  toppingPrice: number;
  fillingCategories: FillingCategory[];
  allFillings: FillingItem[];
  sizeLargeUpcharge: number;
  storeClosed: boolean;
  trackingConfig: TrackingConfig;
  openingHours: OpeningHours;
  drinks: Addon[];
  dipCups: Addon[];
  snacks: Addon[];

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

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function setUrl(path: string) {
  if (typeof window === 'undefined') return;
  window.history.pushState({}, '', path);
}

// Fallback single-option lists used only until /api/menu has loaded, so the
// UI never crashes on first paint. Real values always come from the DB.
const FALLBACK_OPTION: OptionItem[] = [{ id: 'default', label: 'Default', delta: 0 }];

interface StoreProviderInitialData {
  categories?: RawCategory[];
  products?: RawProduct[];
}

interface StoreProviderProps {
  children: ReactNode;
  initialData?: StoreProviderInitialData | null;
}

export function StoreProvider({ children, initialData }: StoreProviderProps) {
  const router = useRouter();

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
  const [toppings, setToppings] = useState<OptionItem[]>([]); // [{ id, label, delta }]
  const [fillingCategories, setFillingCategories] = useState<FillingCategory[]>([]);
  const [sizeLargeUpcharge, setSizeLargeUpcharge] = useState(0);
  const [storeClosed, setStoreClosed] = useState(false);
  const [trackingConfig, setTrackingConfig] = useState<TrackingConfig>({ ga4Id: null, metaPixelId: null, tiktokPixelId: null, clarityId: null });
  // Phase 7.7 — structured per-day opening hours (replaces the old
  // free-text admin_settings.opening_hours value). null until the /api/menu
  // fetch below resolves, or if the stored value is missing/still the old
  // free-text shape — components/Visit.js falls back to its own
  // placeholder rows in either case rather than rendering nothing.
  const [openingHours, setOpeningHours] = useState<OpeningHours>(null);
  const [drinks, setDrinks] = useState<Addon[]>([]);
  const [dipCups, setDipCups] = useState<Addon[]>([]);
  const [snacks, setSnacks] = useState<Addon[]>([]);

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
    async function loadMenu() {
      try {
        // Only show the loading state if we don't already have seeded
        // data from the server — otherwise this background refresh
        // would flash the UI back to "loading" for no visible reason.
        if (!initialData) setMenuLoading(true);
        setMenuError('');

        const res = await fetch('/api/menu');
        if (!res.ok) throw new Error('Failed to load menu');
        const data = await res.json();

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
        setSizeLargeUpcharge(blob.sizeLargeUpcharge);
        setStoreClosed(blob.storeClosed);
        setTrackingConfig(blob.trackingConfig);
        setOpeningHours(blob.openingHours);
        setFeatured(blob.featured);
        setPopularProductIds(blob.popularProductIds);
      } catch (err) {
        console.error('Menu loading error:', err);
        setMenuError(t.menuSection.loadError);
      } finally {
        setMenuLoading(false);
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
      if (product.toppingsEnabled) {
        if (product.size === 'L') unit += sizeLargeUpcharge;
        const toppingPrice = toppings[0]?.delta || 0;
        unit += product.toppings.length * toppingPrice;
        unit += baseOptions.find((o) => o.id === product.base)?.delta || 0;
        unit += sauceOptions.find((o) => o.id === product.sauce)?.delta || 0;
        unit += cheeseOptions.find((o) => o.id === product.cheese)?.delta || 0;
        unit += fillingsTotal(product.fillings);
        unit += sauceStripeOptions.find((o) => o.id === product.sauceStripe)?.delta || 0;
        unit += dipOptions.find((o) => o.id === product.dip)?.delta || 0;
      }
      return unit;
    },
    [sizeLargeUpcharge, toppings, baseOptions, sauceOptions, cheeseOptions, sauceStripeOptions, dipOptions, fillingsTotal]
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
        basePrice: item.price,
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
        size: 'M',
        toppings: [],
        base: baseOptions[0]?.id,
        sauce: sauceOptions[0]?.id,
        cheese: cheeseOptions[0]?.id,
        fillings: {},
        sauceStripe: sauceStripeOptions[0]?.id,
        dip: dipOptions[0]?.id,
        bundleSlotIndex,
      });
      setProductPageOpen(true);
      if (bundleSlotIndex == null && !skipUrlPush) setUrl(lp(`/product/${slugify(item.name)}`));
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

  const setSize = useCallback((size: 'M' | 'L') => setSelection((s) => ({ ...s, size })), []);
  const setQty = useCallback((fn: (qty: number) => number) => setSelection((s) => ({ ...s, qty: Math.max(1, fn(s.qty)) })), []);
  const setOption = useCallback((key: string, id: string) => setSelection((s) => ({ ...(s as any), [key]: id })), []);

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
      if (selection.size === 'L') details.push(t.productPage.largeUpchargeDetail(`${sizeLargeUpcharge.toFixed(2)} €`));
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
    }

    if (selection.bundleSlotIndex != null) {
      // Filling a bundle slot: only the customization *extra* (over the
      // product's base price) adds to the bundle total — the base price
      // is already covered by the bundle's flat price. Qty isn't used
      // here; each bundle slot unit is added one at a time.
      const extra = unitPrice - activeProduct.basePrice;
      setBundleSlots((slots) => {
        const next = [...slots];
        const slot = next[selection.bundleSlotIndex];
        if (!slot) return slots;
        next[selection.bundleSlotIndex] = {
          ...slot,
          filled: [
            ...slot.filled,
            { key: `${activeProduct.id}-${Date.now()}`, productId: activeProduct.id, name: activeProduct.name, details, extra },
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
      },
    ]);
    trackAddToCart({ productId: activeProduct.id, name: activeProduct.name, details, qty: selection.qty, unitPrice, lineTotal });
    // Deliberately not closing the overlay here — navigating straight to
    // /menu means the whole page (overlay included) swaps out in one go,
    // instead of a flash of the bare page underneath first.
    goBack();
  }, [
    activeProduct, selection, unitPrice, lineTotal, sizeLargeUpcharge,
    baseOptions, sauceOptions, cheeseOptions, sauceStripeOptions, dipOptions, allFillings, goBack, t,
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

  const placeOrder = useCallback(async (customer: Customer, couponCode?: string) => {
    if (storeClosed) {
      throw new Error(t.checkout.storeClosedError);
    }
    const payload = {
      customer,
      total: cartTotal,
      couponCode: couponCode || undefined,
      // Whether this customer consented to marketing/analytics cookies
      // (see components/CookieBanner.js) — read fresh at order time
      // rather than trusted from anywhere else, so the server knows
      // whether it's allowed to fire ad-platform conversion events for
      // this specific order. Defaults to false (no consent) if the
      // banner hasn't been shown/answered yet for some reason, which is
      // the safe default.
      marketingConsent: typeof window !== 'undefined' && localStorage.getItem('ozy_cookie_consent') === 'all',
      items: cart.map((line) => ({
        productId: line.productId || null,
        name: line.name,
        qty: line.qty,
        lineTotal: line.lineTotal,
        details: line.details || [],
      })),
    };

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || t.checkout.genericOrderError);
    }

    const data = await res.json();

    // Remember this order on the customer's own device — /track can then
    // offer it as a one-tap shortcut without them needing to note down
    // the order number themselves.
    try {
      const saved = JSON.parse(localStorage.getItem('ozy_recent_orders') || '[]');
      const next = [
        { orderNum: data.orderNum, phone: customer.phone, placedAt: new Date().toISOString() },
        ...saved.filter((o) => o.orderNum !== data.orderNum),
      ].slice(0, 5);
      localStorage.setItem('ozy_recent_orders', JSON.stringify(next));
    } catch {
      // Non-essential — tracking still works via manual entry either way.
    }

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
    });
    setCheckoutOpen(false);
    setCart([]);
    setUrl(lp('/order-confirmed'));
  }, [cart, cartTotal, storeClosed, lp, t]);

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
            filled: Array.from({ length: s.qty || 1 }, (_, i) => ({
              key: `${s.productId}-fixed-${i}`,
              productId: s.productId,
              name: product?.name || s.label || s.productId,
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
    setSize,
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

    // Menu data (from /api/menu — the database).
    menuLoading,
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
    sizeLargeUpcharge,
    storeClosed,
    trackingConfig,
    openingHours,
    drinks,
    dipCups,
    snacks,

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
