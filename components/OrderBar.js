'use client';

import { useStore } from '@/context/StoreContext';

export default function OrderBar() {
  const { cart, cartTotal, goToCheckout, isProductPageOpen, isCheckoutOpen } = useStore();

  const itemCount = cart.reduce((sum, line) => sum + line.qty, 0);

  if (itemCount === 0 || isCheckoutOpen) return null;

  return (
    <button
      type="button"
      className={`order-bar${isProductPageOpen ? ' on-product-page' : ''}`}
      onClick={goToCheckout}
    >
      <span className="order-bar-count">{itemCount}</span>
      <span className="order-bar-label">View order</span>
      <span className="order-bar-total">{cartTotal.toFixed(2)} €</span>
    </button>
  );
}
