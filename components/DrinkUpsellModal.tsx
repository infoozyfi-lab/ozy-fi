'use client';

import { useStore } from '@/context/StoreContext';
import { useTranslations, useLocalePath } from '@/lib/i18n';
import type { Addon } from '@/lib/types';

export default function DrinkUpsellModal() {
  const { isDrinkUpsellOpen, setDrinkUpsellOpen, continueFromUpsell, addDrinkToCart, drinks } = useStore();
  const t = useTranslations();
  const lp = useLocalePath();

  const closeToHome = () => {
    setDrinkUpsellOpen(false);
    if (typeof window !== 'undefined') window.history.pushState({}, '', lp('/'));
  };

  const featured = drinks.slice(0, 2);

  const pick = (drink: Addon) => {
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
              onClick={() => pick(d)}
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
