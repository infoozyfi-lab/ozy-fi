'use client';

import { useStore } from '@/context/StoreContext';
import { DRINKS } from '@/data/menu';

export default function DrinkUpsellModal() {
  const { isDrinkUpsellOpen, setDrinkUpsellOpen, continueFromUpsell, addDrinkToCart } = useStore();

  const closeToHome = () => {
    setDrinkUpsellOpen(false);
    if (typeof window !== 'undefined') window.history.pushState({}, '', '/');
  };

  const featured = DRINKS.slice(0, 2);

  const pick = (drink) => {
    addDrinkToCart(drink);
    continueFromUpsell();
  };

  return (
    <div className={`upsell-page${isDrinkUpsellOpen ? ' open' : ''}`}>
      <button className="upsell-close" type="button" onClick={closeToHome}>×</button>

      <div className="upsell-scroll">
        <h2 className="upsell-title">Pepsi or<br />Pepsi Max?</h2>

        <div className="upsell-grid">
          {featured.map((d) => (
            <button
              type="button"
              className="upsell-card"
              key={d.id}
              onClick={() => pick(d)}
            >
              <img src={d.image} alt={d.name} />
              <span className="upsell-card-name">{d.name}</span>
              <span className="upsell-card-btn">{d.price.toFixed(2)} €</span>
            </button>
          ))}
        </div>
      </div>

      <div className="upsell-footer">
        <button type="button" className="upsell-skip" onClick={continueFromUpsell}>
          No thanks
        </button>
      </div>
    </div>
  );
}
