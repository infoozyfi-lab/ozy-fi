'use client';

import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  TOPPING_PRICE,
  SIZE_LARGE_UPCHARGE,
  BASE_OPTIONS,
  SAUCE_OPTIONS,
  CHEESE_OPTIONS,
  ALL_FILLINGS,
  SAUCE_STRIPE_OPTIONS,
  DIP_OPTIONS,
} from '@/data/menu';

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

function fillingsTotal(fillings) {
  return Object.entries(fillings || {}).reduce((sum, [id, qty]) => {
    if (!qty) return sum;
    const item = ALL_FILLINGS.find((f) => f.id === id);
    return item ? sum + item.price * qty : sum;
  }, 0);
}

function calcUnitPrice(product) {
  if (!product) return 0;
  let unit = product.basePrice;
  if (product.toppingsEnabled) {
    if (product.size === 'L') unit += SIZE_LARGE_UPCHARGE;
    unit += product.toppings.length * TOPPING_PRICE;
    unit += BASE_OPTIONS.find((o) => o.id === product.base).delta;
    unit += SAUCE_OPTIONS.find((o) => o.id === product.sauce).delta;
    unit += CHEESE_OPTIONS.find((o) => o.id === product.cheese).delta;
    unit += fillingsTotal(product.fillings);
    unit += SAUCE_STRIPE_OPTIONS.find((o) => o.id === product.sauceStripe).delta;
    unit += DIP_OPTIONS.find((o) => o.id === product.dip).delta;
  }
  return unit;
}

export function StoreProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [activeProduct, setActiveProduct] = useState(null);
  const [selection, setSelection] = useState(null);
  const [isProductPageOpen, setProductPageOpen] = useState(false);
  const [isCartOpen, setCartOpen] = useState(false);
  const [isCheckoutOpen, setCheckoutOpen] = useState(false);
  const [isDrinkUpsellOpen, setDrinkUpsellOpen] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  const openProduct = useCallback((item) => {
    setActiveProduct(item);
    setSelection({
      basePrice: item.price,
      toppingsEnabled: item.toppings,
      qty: 1,
      size: 'M',
      toppings: [],
      base: BASE_OPTIONS[0].id,
      sauce: SAUCE_OPTIONS[0].id,
      cheese: CHEESE_OPTIONS[0].id,
      fillings: {},
      sauceStripe: SAUCE_STRIPE_OPTIONS[0].id,
      dip: DIP_OPTIONS[0].id,
    });
    setProductPageOpen(true);
    setUrl(`/product/${slugify(item.name)}`);
  }, []);

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

  const unitPrice = useMemo(() => calcUnitPrice(selection), [selection]);
  const lineTotal = useMemo(() => (selection ? unitPrice * selection.qty : 0), [unitPrice, selection]);

  const addToCart = useCallback(() => {
    if (!activeProduct || !selection) return;
    const details = [];
    if (selection.toppingsEnabled) {
      if (selection.size === 'L') details.push(`Large (+${SIZE_LARGE_UPCHARGE.toFixed(2)} €)`);
      selection.toppings.forEach((t) => details.push(t));
      const baseOpt = BASE_OPTIONS.find((o) => o.id === selection.base);
      if (baseOpt.id !== 'classic') details.push(baseOpt.label);
      const sauceOpt = SAUCE_OPTIONS.find((o) => o.id === selection.sauce);
      if (sauceOpt.id !== 'tomato') details.push(sauceOpt.label);
      const cheeseOpt = CHEESE_OPTIONS.find((o) => o.id === selection.cheese);
      if (cheeseOpt.id !== 'normal') details.push(cheeseOpt.label);
      Object.entries(selection.fillings || {}).forEach(([id, qty]) => {
        const item = ALL_FILLINGS.find((f) => f.id === id);
        if (item && qty > 0) details.push(qty > 1 ? `${item.label} x${qty}` : item.label);
      });
      const sauceStripeOpt = SAUCE_STRIPE_OPTIONS.find((o) => o.id === selection.sauceStripe);
      if (sauceStripeOpt.id !== 'none') details.push(sauceStripeOpt.label);
      const dipOpt = DIP_OPTIONS.find((o) => o.id === selection.dip);
      if (dipOpt.id !== 'none') details.push(dipOpt.label);
    }
    setCart((c) => [
      ...c,
      {
        key: `${activeProduct.id}-${Date.now()}`,
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
  }, [activeProduct, selection, unitPrice, lineTotal]);

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
    setUrl('/checkout');
  }, [cart.length]);

  const closeCheckout = useCallback(() => {
    setCheckoutOpen(false);
    setUrl('/');
  }, []);

  const continueFromUpsell = useCallback(() => {
    setDrinkUpsellOpen(false);
    setCheckoutOpen(true);
  }, []);

  const placeOrder = useCallback((customer) => {
    const orderNum = `#OZY-${Math.floor(1000 + Math.random() * 9000)}`;
    setConfirmedOrder({ orderNum, customer, total: cartTotal, items: cart });
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
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
