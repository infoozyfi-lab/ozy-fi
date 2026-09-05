'use client';

import { useStore } from '@/context/StoreContext';
import { DRINKS } from '@/data/menu';

export default function DrinkUpsellModal() {
  const { isDrinkUpsellOpen, setDrinkUpsellOpen, continueFromUpsell, cart, addDrinkToCart } = useStore();

  const qtyFor = (drinkId) => {
    const line = cart.find((l) => l.drinkId === drinkId);
    return line ? line.qty : 0;
  };

  return (
    <div className={`upsell-page${isDrinkUpsellOpen ? ' open' : ''}`}>
      <button className="upsell-close" type="button" onClick={() => setDrinkUpsellOpen(false)}>×</button>

      <div className="upsell-scroll">
        <h2 className="upsell-title">A cold drink<br />on the side?</h2>

        <div className="upsell-grid">
          {DRINKS.map((d) => {
            const qty = qtyFor(d.id);
            return (
              <button
                type="button"
                className="upsell-card"
                key={d.id}
                onClick={() => addDrinkToCart(d)}
              >
                <img src={d.image} alt={d.name} />
                <span className="upsell-card-name">{d.name}</span>
                <span className="upsell-card-btn">
                  {qty > 0 ? `In cart · ${qty}` : `Add · ${d.price.toFixed(2)} €`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="upsell-footer">
        <button type="button" className="upsell-skip" onClick={continueFromUpsell}>
          No thanks
        </button>
        <button type="button" className="btn-primary upsell-continue" onClick={continueFromUpsell}>
          Continue
        </button>
      </div>
    </div>
  );
}
