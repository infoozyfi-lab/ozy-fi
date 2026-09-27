'use client';

import { useStore } from '@/context/StoreContext';
import { useTranslations, useLocalePath } from '@/lib/i18n';
import { useBodyScrollLock } from '@/lib/hooks';
import { triggerFlyToCart } from '@/lib/flyToCart';
import type { Addon } from '@/lib/types';

export default function DrinkUpsellModal() {
  const { isDrinkUpsellOpen, setDrinkUpsellOpen, continueFromUpsell, addDrinkToCart, drinks } = useStore();
  useBodyScrollLock(isDrinkUpsellOpen);
  const t = useTranslations();
  const lp = useLocalePath();

  const closeToHome = () => {
    setDrinkUpsellOpen(false);
    if (typeof window !== 'undefined') window.history.pushState({}, '', lp('/'));
  };

  const featured = drinks.slice(0, 2);

  // Add-to-cart-improvements brief, item 6 — `sourceEl` is the clicked
  // card itself (via e.currentTarget below), which has the drink's <img>
  // inside it; triggerFlyToCart handles finding that image itself.
  const pick = (drink: Addon, sourceEl: HTMLElement | null) => {
    triggerFlyToCart(sourceEl);
    addDrinkToCart(drink);
    continueFromUpsell();
  };

  return (
    <div className={`upsell-page${isDrinkUpsellOpen ? ' open' : ''}`}>
      <button className="upsell-close" type="button" onClick={closeToHome}>×</button>

      <div className="upsell-scroll">
        <h2 className="upsell-title">{t.drinkUpsell.titleLine1}<br />{t.drinkUpsell.titleLine2}</h2>

        <div className="upsell-grid">
          {featured.map((d) => (
            <button
              type="button"
              className="upsell-card"
              key={d.id}
              onClick={(e) => pick(d, e.currentTarget)}
            >
              <img src={d.image ?? undefined} alt={d.name} />
              <span className="upsell-card-name">{d.name}</span>
              <span className="upsell-card-btn">{d.price.toFixed(2)} €</span>
            </button>
          ))}
        </div>
      </div>

      <div className="upsell-footer">
        <button type="button" className="upsell-skip" onClick={continueFromUpsell}>
          {t.drinkUpsell.noThanks}
        </button>
      </div>
    </div>
  );
}
