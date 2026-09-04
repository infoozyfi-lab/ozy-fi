'use client';

import { useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { TOPPINGS, TOPPING_PRICE, SIZE_LARGE_UPCHARGE, BASE_OPTIONS, SAUCE_OPTIONS, CHEESE_OPTIONS } from '@/data/menu';

const TOPPING_EMOJI = {
  'Extra cheese': '🧀', Pepperoni: '🔴', Mushroom: '🍄', Onion: '🧅',
  Bacon: '🥓', Jalapeño: '🌶️', Olives: '🫒', Pineapple: '🍍', Ham: '🍖', Garlic: '🧄',
};

function BottomRow({ label, options, current, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === current);
  return (
    <div className="pp-bottom-row">
      <span className="label">{selected.label}</span>
      <button type="button" className="change-btn" onClick={() => setOpen((v) => !v)}>
        change ▾
      </button>
      {open && (
        <div className="pp-bottom-options">
          {options.map((opt) => (
            <label key={opt.id}>
              <input
                type="radio"
                name={label}
                checked={opt.id === current}
                onChange={() => onChange(opt.id)}
              />
              {opt.label}{opt.delta > 0 ? ` (+${opt.delta.toFixed(2)} €)` : ''}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductPage() {
  const {
    activeProduct, selection, unitPrice, lineTotal,
    isProductPageOpen, closeProduct, toggleTopping, setSize, setQty, setOption,
    addToCart, setCartOpen,
  } = useStore();

  if (!activeProduct || !selection) {
    return <div className="product-page" aria-hidden="true" />;
  }

  const [intPart, decPart] = unitPrice.toFixed(2).split('.');

  return (
    <div className={`product-page${isProductPageOpen ? ' open' : ''}`}>
      <div className="pp-topbar">
        <button className="pp-back" type="button" aria-label="Back" onClick={closeProduct}>←</button>
        <span className="pp-topbar-title">ozy<span>.fi</span></span>
        <button
          className="pp-cart"
          type="button"
          aria-label="Cart"
          onClick={() => { closeProduct(); setCartOpen(true); }}
        >
          🛒
        </button>
      </div>

      <div className="pp-scroll">
        <div className="pp-hero">
          <img className="pp-hero-img" src={activeProduct.image} alt={activeProduct.name} />
          <div className="pp-price-badge">
            <div className="pp-price-row">
              <span>{intPart}</span>
              <span className="pp-price-dec">.{decPart}</span>
              <span className="pp-price-eur">€</span>
            </div>
            <span className="pp-price-label">Price</span>
          </div>
        </div>

        <div className="pp-body wrap">
          <h1 className="pp-name">{activeProduct.name}</h1>
          <p className="pp-desc">{activeProduct.desc}</p>

          {selection.toppingsEnabled && (
            <>
              <div className="pp-section">
                <p className="pp-label">Size</p>
                <div className="pp-toggle">
                  <button
                    type="button"
                    className={`pp-toggle-opt${selection.size === 'M' ? ' active' : ''}`}
                    onClick={() => setSize('M')}
                  >
                    Medium
                  </button>
                  <button
                    type="button"
                    className={`pp-toggle-opt${selection.size === 'L' ? ' active' : ''}`}
                    onClick={() => setSize('L')}
                  >
                    Large<span className="pp-toggle-sub">+{SIZE_LARGE_UPCHARGE.toFixed(2)} €</span>
                  </button>
                </div>
              </div>

              <div className="pp-section">
                <p className="pp-label">Finish — tap to add toppings</p>
                <div className="pp-finish-row">
                  {TOPPINGS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`pp-finish-tile${selection.toppings.includes(t) ? ' selected' : ''}`}
                      onClick={() => toggleTopping(t)}
                    >
                      <span className="emoji">{TOPPING_EMOJI[t] || '●'}</span>
                      <span className="fname">{t}</span>
                      <span className="fprice">+{TOPPING_PRICE.toFixed(2)} €</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pp-section">
                <p className="pp-label">Bottom</p>
                <div className="pp-bottom-list">
                  <BottomRow label="base" options={BASE_OPTIONS} current={selection.base} onChange={(id) => setOption('base', id)} />
                  <BottomRow label="sauce" options={SAUCE_OPTIONS} current={selection.sauce} onChange={(id) => setOption('sauce', id)} />
                  <BottomRow label="cheese" options={CHEESE_OPTIONS} current={selection.cheese} onChange={(id) => setOption('cheese', id)} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="pp-footer">
        <div className="pp-qty">
          <button type="button" onClick={() => setQty((q) => q - 1)}>−</button>
          <span>{selection.qty}</span>
          <button type="button" onClick={() => setQty((q) => q + 1)}>+</button>
        </div>
        <button className="btn-primary pp-add-btn" type="button" onClick={addToCart}>
          Add to order — {lineTotal.toFixed(2)} €
        </button>
      </div>
    </div>
  );
}
