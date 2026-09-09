'use client';

import { useStore } from '@/context/StoreContext';
import { useTranslations } from '@/lib/i18n';

export default function OrderBar() {
  const { cart, cartTotal, goToCheckout, isProductPageOpen, isCheckoutOpen, isDrinkUpsellOpen } = useStore();
  const t = useTranslations();

  const itemCount = cart.reduce((sum, line) => sum + line.qty, 0);

  if (itemCount === 0 || isCheckoutOpen || isDrinkUpsellOpen) return null;

  return (
    <button
      type="button"
      className={`order-bar${isProductPageOpen ? ' on-product-page' : ''}`}
      onClick={goToCheckout}
    >
      <span className="order-bar-count">{itemCount}</span>
      <span className="order-bar-label">{t.orderBar.viewOrder}</span>
      <span className="order-bar-total">{cartTotal.toFixed(2)} €</span>
    </button>
  );
}
