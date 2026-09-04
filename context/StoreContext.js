'use client';

import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  TOPPING_PRICE,
  SIZE_LARGE_UPCHARGE,
  BASE_OPTIONS,
  SAUCE_OPTIONS,
  CHEESE_OPTIONS,
} from '@/data/menu';

const StoreContext = createContext(null);

function calcUnitPrice(product) {
  if (!product) return 0;
  let unit = product.basePrice;
  if (product.toppingsEnabled) {
    if (product.size === 'L') unit += SIZE_LARGE_UPCHARGE;
    unit += product.toppings.length * TOPPING_PRICE;
    unit += BASE_OPTIONS.find((o) => o.id === product.base).delta;
    unit += SAUCE_OPTIONS.find((o) => o.id === product.sauce).delta;
    unit += CHEESE_OPTIONS.find((o) => o.id === product.cheese).delta;
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
    });
    setProductPageOpen(true);
  }, []);

  const closeProduct = useCallback(() => setProductPageOpen(false), []);

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
    setCartOpen(true);
  }, [activeProduct, selection, unitPrice, lineTotal]);

  const removeFromCart = useCallback((key) => {
    setCart((c) => c.filter((line) => line.key !== key));
  }, []);

  const cartTotal = useMemo(() => cart.reduce((sum, l) => sum + l.lineTotal, 0), [cart]);

  const goToCheckout = useCallback(() => {
    if (cart.length === 0) return;
    setCartOpen(false);
    setCheckoutOpen(true);
  }, [cart.length]);

  const placeOrder = useCallback((customer) => {
    const orderNum = `#OZY-${Math.floor(1000 + Math.random() * 9000)}`;
    setConfirmedOrder({ orderNum, customer, total: cartTotal, items: cart });
    setCheckoutOpen(false);
    setCart([]);
  }, [cart, cartTotal]);

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
    confirmedOrder,
    openProduct,
    closeProduct,
    toggleTopping,
    setSize,
    setQty,
    setOption,
    addToCart,
    removeFromCart,
    setCartOpen,
    goToCheckout,
    setCheckoutOpen,
    placeOrder,
    setConfirmedOrder,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
