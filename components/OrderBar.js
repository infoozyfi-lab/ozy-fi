'use client';

import { useStore } from '@/context/StoreContext';

export default function OrderBar() {
  const { cart, cartTotal, setCartOpen, isProductPageOpen } = useStore();

  const itemCount = cart.reduce((sum, line) => sum + line.qty, 0);

  if (itemCount === 0) return null;

  return (
    <button
      type="button"
      className={`order-bar${isProductPageOpen ? ' on-product-page' : ''}`}
      onClick={() => setCartOpen(true)}
    >
      <span className="order-bar-count">{itemCount}</span>
      <span className="order-bar-label">View order</span>
      <span className="order-bar-total">{cartTotal.toFixed(2)} €</span>
    </button>
  );
}
