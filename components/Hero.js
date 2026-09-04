'use client';

import { useState } from 'react';

export default function Hero() {
  const [orderMode, setOrderMode] = useState('delivery');

  const goToMenu = (e) => {
    e.preventDefault();
    document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="hero">
      <div className="wrap">
        <p className="eyebrow">Pizza, kebab & burgers</p>
        <h1 className="hero-title display">
          Start your <em>order</em>
        </h1>
        <p className="hero-sub">
          Fresh dough, made to order, always hot. Pick how you&apos;d like it, then browse the full menu.
        </p>
        <div className="order-box">
          <div className="order-tabs">
            {['delivery', 'pickup', 'eatin'].map((mode) => (
              <button
                key={mode}
                type="button"
                className={`order-tab${orderMode === mode ? ' active' : ''}`}
                onClick={() => setOrderMode(mode)}
              >
                {mode === 'delivery' ? 'Delivery' : mode === 'pickup' ? 'Pickup' : 'Eat in'}
              </button>
            ))}
          </div>
          <a href="#menu" className="order-go" onClick={goToMenu}>
            Browse the menu
          </a>
        </div>
      </div>
    </section>
  );
}
