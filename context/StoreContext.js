'use client';

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';

const StoreContext = createContext(null);

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function setUrl(path) {
  if (typeof window === 'undefined') return;
  window.history.pushState({}, '', path);
}

// Fallback single-option lists used only until /api/menu has loaded, so the
// UI never crashes on first paint. Real values always come from the DB.
const FALLBACK_OPTION = [{ id: 'default', label: 'Default', delta: 0 }];

export function StoreProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [activeProduct, setActiveProduct] = useState(null);
  const [selection, setSelection] = useState(null);
  const [isProductPageOpen, setProductPageOpen] = useState(false);
  const [isCartOpen, setCartOpen] = useState(false);
  const [isCheckoutOpen, setCheckoutOpen] = useState(false);
  const [isDrinkUpsellOpen, setDrinkUpsellOpen] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  // ---- Menu data, loaded once from the database (/api/menu). ----
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState('');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [baseOptions, setBaseOptions] = useState(FALLBACK_OPTION);
  const [sauceOptions, setSauceOptions] = useState(FALLBACK_OPTION);
  const [cheeseOptions, setCheeseOptions] = useState(FALLBACK_OPTION);
  const [sauceStripeOptions, setSauceStripeOptions] = useState([{ id: 'default', label: 'None', delta: 0, color: 'transparent' }]);
  const [dipOptions, setDipOptions] = useState(FALLBACK_OPTION);
  const [toppings, setToppings] = useState([]); // [{ id, label, delta }]
  const [fillingCategories, setFillingCategories] = useState([]);
  const [sizeLargeUpcharge, setSizeLargeUpcharge] = useState(0);
  const [drinks, setDrinks] = useState([]);
  const [dipCups, setDipCups] = useState([]);
  const [snacks, setSnacks] = useState([]);

  const allFillings = useMemo(
    () => fillingCategories.flatMap((c) => c.items),
    [fillingCategories]
  );

  useEffect(() => {
    async function loadMenu() {
      try {
        setMenuLoading(true);
        setMenuError('');

        const res = await fetch('/api/menu', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load menu');
        const data = await res.json();

        setCategories(
          (data.categories || []).map((cat) => ({
            id: cat.id,
            title: cat.title,
            sub: cat.sub,
            image: cat.image,
            sort_order: cat.sort_order,
          }))
        );

        setProducts(
          (data.products || [])
            .filter((item) => item.active !== 0)
            .map((item) => ({
              id: item.id,
              cat: item.category_id,
              name: item.name,
              desc: item.description,
              price: item.offer_price !== null ? Number(item.offer_price) : Number(item.price),
              basePrice: Number(item.price),
              offerPrice: item.offer_price !== null ? Number(item.offer_price) : null,
              image: item.image,
              tag: item.tag,
              toppings: Boolean(item.has_toppings),
              toppingsEnabled: Boolean(item.has_toppings),
              sort_order: item.sort_order,
            }))
        );

        const groups = data.optionGroups || [];
        const fillings = [];

        groups.forEach((g) => {
          const opts = (g.options || []).map((o) => ({
            id: o.id,
            label: o.label,
            delta: Number(o.price_delta) || 0,
            color: o.color || null,
          }));

          switch (g.kind) {
            case 'base':
              setBaseOptions(opts.length ? opts : FALLBACK_OPTION);
              break;
            case 'sauce':
              setSauceOptions(opts.length ? opts : FALLBACK_OPTION);
              break;
            case 'cheese':
              setCheeseOptions(opts.length ? opts : FALLBACK_OPTION);
              break;
            case 'sauce_stripe':
              setSauceStripeOptions(opts.length ? opts : [{ id: 'default', label: 'None', delta: 0, color: 'transparent' }]);
              break;
            case 'dip':
              setDipOptions(opts.length ? opts : FALLBACK_OPTION);
              break;
            case 'topping':
              setToppings(opts);
              break;
            case 'filling':
              fillings.push({
                id: g.id,
                title: g.title,
                icon: g.icon,
                items: (g.options || []).map((o) => ({
                  id: o.id,
                  label: o.label,
                  price: Number(o.price_delta) || 0,
                })),
              });
              break;
            default:
              break;
          }
        });

        setFillingCategories(fillings);

        const addons = data.addons || [];
        setDrinks(
          addons
            .filter((a) => a.type === 'drink')
            .map((a) => ({ id: a.id, name: a.name, price: Number(a.price) || 0, image: a.image }))
        );
        setDipCups(
          addons
            .filter((a) => a.type === 'dip')
            .map((a) => ({ id: a.id, name: a.name, price: Number(a.price) || 0, image: a.image }))
        );
        setSnacks(
          addons
            .filter((a) => a.type === 'snack')
            .map((a) => ({ id: a.id, name: a.name, price: Number(a.price) || 0, image: a.image }))
        );

        const settings = data.settings || {};
        setSizeLargeUpcharge(Number(settings.size_large_upcharge) || 0);
      } catch (err) {
        console.error('Menu loading error:', err);
        setMenuError('Unable to load menu. Please try again.');
      } finally {
        setMenuLoading(false);
      }
    }

    loadMenu();
  }, []);

  const fillingsTotal = useCallback(
    (fillings) =>
      Object.entries(fillings || {}).reduce((sum, [id, qty]) => {
        if (!qty) return sum;
        const item = allFillings.find((f) => f.id === id);
        return item ? sum + item.price * qty : sum;
      }, 0),
    [allFillings]
  );

  const calcUnitPrice = useCallback(
    (product) => {
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

  const openProduct = useCallback(
    (item) => {
      setActiveProduct(item);
      setSelection({
        basePrice: item.price,
        toppingsEnabled: item.toppings,
        qty: 1,
        size: 'M',
        toppings: [],
        base: baseOptions[0]?.id,
        sauce: sauceOptions[0]?.id,
        cheese: cheeseOptions[0]?.id,
        fillings: {},
        sauceStripe: sauceStripeOptions[0]?.id,
        dip: dipOptions[0]?.id,
      });
      setProductPageOpen(true);
      setUrl(`/product/${slugify(item.name)}`);
    },
    [baseOptions, sauceOptions, cheeseOptions, sauceStripeOptions, dipOptions]
  );

  const closeProduct = useCallback(() => {
    setProductPageOpen(false);
    setUrl('/');
  }, []);

  const toggleTopping = useCallback((topping) => {
    setSelection((s) => {
      if (!s) return s;
      const has = s.toppings.includes(topping);
      return {
        ...s,
        toppings: has ? s.toppings.filter((t) => t !== topping) : [...s.toppings, topping],
      };
    });
  }, []);

  const setSize = useCallback((size) => setSelection((s) => ({ ...s, size })), []);
  const setQty = useCallback((fn) => setSelection((s) => ({ ...s, qty: Math.max(1, fn(s.qty)) })), []);
  const setOption = useCallback((key, id) => setSelection((s) => ({ ...s, [key]: id })), []);

  const setFillingQty = useCallback((fillingId, nextQty) => {
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
    const details = [];
    if (selection.toppingsEnabled) {
      if (selection.size === 'L') details.push(`Large (+${sizeLargeUpcharge.toFixed(2)} €)`);
      selection.toppings.forEach((t) => details.push(t));
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
    setProductPageOpen(false);
    setUrl('/');
  }, [
    activeProduct, selection, unitPrice, lineTotal, sizeLargeUpcharge,
    baseOptions, sauceOptions, cheeseOptions, sauceStripeOptions, dipOptions, allFillings,
  ]);

  const removeFromCart = useCallback((key) => {
    setCart((c) => c.filter((line) => line.key !== key));
  }, []);

  const addDrinkToCart = useCallback((drink) => {
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

  const updateCartQty = useCallback((key, nextQty) => {
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
    setCartOpen(false);
    setDrinkUpsellOpen(true);
    setUrl('/drinks');
  }, [cart.length]);

  const closeCheckout = useCallback(() => {
    setCheckoutOpen(false);
    setUrl('/');
  }, []);

  const continueFromUpsell = useCallback(() => {
    setDrinkUpsellOpen(false);
    setCheckoutOpen(true);
    setUrl('/checkout');
  }, []);

  const placeOrder = useCallback(async (customer) => {
    const payload = {
      customer,
      total: cartTotal,
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
      throw new Error(body.error || 'Could not place order. Please try again.');
    }

    const data = await res.json();

    setConfirmedOrder({ orderNum: `#${data.orderNum}`, customer, total: cartTotal, items: cart });
    setCheckoutOpen(false);
    setCart([]);
    setUrl('/order-confirmed');
  }, [cart, cartTotal]);

  const closeConfirm = useCallback(() => {
    setConfirmedOrder(null);
    setUrl('/');
  }, []);

  const value = {
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
    drinks,
    dipCups,
    snacks,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
