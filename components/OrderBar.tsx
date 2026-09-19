'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { useTranslations } from '@/lib/i18n';

export default function OrderBar() {
  const { cart, cartTotal, goToCheckout, isProductPageOpen, isCheckoutOpen, isDrinkUpsellOpen } = useStore();
  const t = useTranslations();

  const itemCount = cart.reduce((sum, line) => sum + line.qty, 0);

  // Round-2 fixes brief, Part 4 (item 3) — there was previously no visual
  // feedback anywhere in the app for "something was just added to the
  // cart" beyond this count silently changing. Compares against the
  // PREVIOUS render's count (via a ref, not state, so the comparison
  // itself never triggers an extra render) and toggles a one-shot pulse
  // class for ~350ms whenever it goes up — never on a decrease (removing
  // an item shouldn't visually celebrate) and never on the very first
  // render (prevCountRef starts at the real initial itemCount, not 0, so
  // a cart that already has items on mount doesn't pulse immediately).
  const prevCountRef = useRef(itemCount);
  const [pulsing, setPulsing] = useState(false);
  useEffect(() => {
    if (itemCount > prevCountRef.current) {
      setPulsing(true);
      const id = window.setTimeout(() => setPulsing(false), 350);
      prevCountRef.current = itemCount;
      return () => window.clearTimeout(id);
    }
    prevCountRef.current = itemCount;
  }, [itemCount]);

  if (itemCount === 0 || isCheckoutOpen || isDrinkUpsellOpen) return null;

  return (
    <button
      type="button"
      className={`order-bar${isProductPageOpen ? ' on-product-page' : ''}`}
      onClick={goToCheckout}
    >
      <span className={`order-bar-count${pulsing ? ' pulse' : ''}`}>{itemCount}</span>
      <span className="order-bar-label">{t.orderBar.viewOrder}</span>
      <span className="order-bar-total">{cartTotal.toFixed(2)} €</span>
    </button>
  );
}
