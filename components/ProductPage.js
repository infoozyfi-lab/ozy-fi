'use client';

import { useState } from 'react';
import { useStore } from '@/context/StoreContext';
import {
  TOPPINGS,
  TOPPING_PRICE,
  SIZE_LARGE_UPCHARGE,
  BASE_OPTIONS,
  SAUCE_OPTIONS,
  CHEESE_OPTIONS,
  FILLING_CATEGORIES,
  ALL_FILLINGS,
  SAUCE_STRIPE_OPTIONS,
  DIP_OPTIONS,
} from '@/data/menu';

const TOPPING_EMOJI = {
  'Extra cheese': '🧀', Pepperoni: '🔴', Mushroom: '🍄', Onion: '🧅',
  Bacon: '🥓', Jalapeño: '🌶️', Olives: '🫒', Pineapple: '🍍', Ham: '🍖', Garlic: '🧄',
};

function money(n) {
  return `${n.toFixed(2)} €`;
}

/* ---------- Bottom rows (base / sauce / cheese) ---------- */
function BottomRow({ label, options, current, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === current);
  return (
    <div className="pp-bottom-row">
      <button type="button" className="pp-bottom-row-head" onClick={() => setOpen((v) => !v)}>
        <span className="label">{selected.label}</span>
        <span className="change-btn">change <span className={`chev${open ? ' up' : ''}`}>▾</span></span>
      </button>
      {open && (
        <div className="pp-bottom-options">
          {options.map((opt) => (
            <label key={opt.id} className={opt.id === current ? 'is-current' : ''}>
              <input
                type="radio"
                name={label}
                checked={opt.id === current}
                onChange={() => { onChange(opt.id); setOpen(false); }}
              />
              <span>{opt.label}</span>
              {opt.delta > 0 && <span className="opt-delta">+{opt.delta.toFixed(2)} €</span>}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Finish with sauce stripes (colour swatch + change) ---------- */
function SauceStripeRow({ current, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = SAUCE_STRIPE_OPTIONS.find((o) => o.id === current);
  return (
    <div className="pp-section">
      <p className="pp-label">Finish with sauce stripes</p>
      <div className="pp-swatch-row">
        <span className="pp-swatch" style={{ background: selected.color }} aria-hidden="true" />
        <span className="pp-swatch-label">{selected.label}</span>
        <button type="button" className="change-btn" onClick={() => setOpen((v) => !v)}>
          change <span className={`chev${open ? ' up' : ''}`}>▾</span>
        </button>
      </div>
      {open && (
        <div className="pp-bottom-options">
          {SAUCE_STRIPE_OPTIONS.map((opt) => (
            <label key={opt.id} className={opt.id === current ? 'is-current' : ''}>
              <input
                type="radio"
                name="sauce-stripe"
                checked={opt.id === current}
                onChange={() => { onChange(opt.id); setOpen(false); }}
              />
              <span className="pp-swatch pp-swatch-sm" style={{ background: opt.color }} />
              <span>{opt.label}</span>
              {opt.delta > 0 && <span className="opt-delta">+{opt.delta.toFixed(2)} €</span>}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Dip the edges ---------- */
function DipRow({ current, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = DIP_OPTIONS.find((o) => o.id === current);
  return (
    <div className="pp-section">
      <p className="pp-label">Dip the edges</p>
      <div className="pp-select-box">
        <button type="button" className="pp-select-head" onClick={() => setOpen((v) => !v)}>
          <span>{selected.id === 'none' ? 'Select a dip' : selected.label}</span>
          <span className="change-btn">select <span className={`chev${open ? ' up' : ''}`}>▾</span></span>
        </button>
        {open && (
          <div className="pp-bottom-options">
            {DIP_OPTIONS.map((opt) => (
              <label key={opt.id} className={opt.id === current ? 'is-current' : ''}>
                <input
                  type="radio"
                  name="dip"
                  checked={opt.id === current}
                  onChange={() => { onChange(opt.id); setOpen(false); }}
                />
                <span>{opt.label}</span>
                {opt.delta > 0 && <span className="opt-delta">+{opt.delta.toFixed(2)} €</span>}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Qty stepper used for current fillings + more-fillings lists ---------- */
function QtyStepper({ qty, onDec, onInc }) {
  return (
    <div className="pp-qty-stepper">
      <button type="button" aria-label="Remove one" onClick={onDec} disabled={qty <= 0}>−</button>
      {qty > 0 && <span>{qty}</span>}
      <button type="button" aria-label="Add one" onClick={onInc}>+</button>
    </div>
  );
}

/* ---------- Currently added fillings ---------- */
function CurrentFillings({ fillings, onSetQty }) {
  const entries = Object.entries(fillings).filter(([, qty]) => qty > 0);
  return (
    <div className="pp-section">
      <p className="pp-label">Fillings</p>
      {entries.length === 0 ? (
        <p className="pp-empty-hint">No fillings added yet — add some from “More fillings” below.</p>
      ) : (
        <div className="pp-fillings-list">
          {entries.map(([id, qty]) => {
            const item = ALL_FILLINGS.find((f) => f.id === id);
            if (!item) return null;
            return (
              <div className="pp-filling-row" key={id}>
                <span className="fname">
                  {item.label}{qty > 1 ? <span className="fqty-badge"> x {qty}</span> : null}
                </span>
                <QtyStepper
                  qty={qty}
                  onDec={() => onSetQty(id, qty - 1)}
                  onInc={() => onSetQty(id, qty + 1)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- More fillings: collapsible categories ---------- */
function MoreFillingsCategory({ category, fillings, onSetQty, open, onToggle }) {
  return (
    <div className="pp-cat">
      <button type="button" className="pp-cat-head" onClick={onToggle}>
        <span className="pp-cat-icon">{category.icon}</span>
        <span className="pp-cat-title">{category.title}</span>
        {category.badge && <span className="pp-cat-badge">{category.badge}</span>}
        <span className={`chev pp-cat-chev${open ? ' up' : ''}`}>⌄</span>
      </button>
      {open && (
        <div className="pp-cat-body">
          {category.items.map((item) => {
            const qty = fillings[item.id] || 0;
            return (
              <div className="pp-filling-row" key={item.id}>
                <span className="fname">
                  {item.label}
                  <span className="fprice"> +{item.price.toFixed(2)} €</span>
                </span>
                <QtyStepper
                  qty={qty}
                  onDec={() => onSetQty(item.id, qty - 1)}
                  onInc={() => onSetQty(item.id, qty + 1)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Product details accordion ---------- */
const PRODUCT_DETAIL_SECTIONS = [
  {
    id: 'raw-material',
    title: 'Raw material information',
    body: 'All ingredients are sourced from approved suppliers and prepared fresh in-house daily. Allergen and origin information for every topping is available on request at the restaurant, and full ingredient lists are printed on the packaging.',
  },
  {
    id: 'nutrition',
    title: 'Nutritional information',
    body: 'Energy, fat, carbohydrate, sugar, protein and salt values are calculated per 100 g and per portion, and vary slightly depending on the size and toppings you choose. Exact values for your customised order are shown at checkout.',
  },
  {
    id: 'climate',
    title: 'Climate calculator',
    body: 'This item\u2019s estimated carbon footprint is calculated from its ingredients, packaging and preparation method. Choosing plant-based fillings and cheese generally lowers the footprint of your order.',
  },
];

function ProductDetails() {
  const [openId, setOpenId] = useState(null);
  return (
    <div className="pp-section">
      <p className="pp-heading">Product details</p>
      <div className="pp-details-list">
        {PRODUCT_DETAIL_SECTIONS.map((sec) => {
          const open = openId === sec.id;
          return (
            <div className="pp-details-row" key={sec.id}>
              <button
                type="button"
                className="pp-details-head"
                onClick={() => setOpenId(open ? null : sec.id)}
              >
                <span>{sec.title}</span>
                <span className={`chev${open ? ' up' : ''}`}>⌄</span>
              </button>
              {open && <p className="pp-details-body">{sec.body}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Main product page ---------- */
export default function ProductPage() {
  const {
    activeProduct, selection, unitPrice, lineTotal,
    isProductPageOpen, closeProduct, toggleTopping, setSize, setQty, setOption,
    setFillingQty, addToCart, setCartOpen,
  } = useStore();

  const [openCat, setOpenCat] = useState(null);

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

              <CurrentFillings fillings={selection.fillings} onSetQty={setFillingQty} />

              <SauceStripeRow current={selection.sauceStripe} onChange={(id) => setOption('sauceStripe', id)} />

              <div className="pp-section">
                <p className="pp-heading">More fillings</p>
                <div className="pp-cat-list">
                  {FILLING_CATEGORIES.map((cat) => (
                    <MoreFillingsCategory
                      key={cat.id}
                      category={cat}
                      fillings={selection.fillings}
                      onSetQty={setFillingQty}
                      open={openCat === cat.id}
                      onToggle={() => setOpenCat((c) => (c === cat.id ? null : cat.id))}
                    />
                  ))}
                </div>
              </div>

              <DipRow current={selection.dip} onChange={(id) => setOption('dip', id)} />

              <ProductDetails />
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
          Add to order — {money(lineTotal)}
        </button>
      </div>

      <style jsx>{`
        .pp-section { margin-top: 28px; }
        .pp-label {
          font-size: 13px; font-weight: 700; letter-spacing: 0.02em;
          text-transform: uppercase; color: #e8a33d; margin: 0 0 10px;
        }
        .pp-heading {
          font-size: 22px; font-weight: 800; color: #f5ede4; margin: 0 0 12px;
        }
        .pp-empty-hint {
          font-size: 14px; color: #a89a8c; margin: 0; padding: 14px 16px;
          background: #1c140f; border-radius: 10px;
        }

        /* current fillings + more-fillings rows */
        .pp-fillings-list, .pp-cat-body {
          border: 1px solid #3a2c22; border-radius: 12px; overflow: hidden;
        }
        .pp-filling-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px; border-bottom: 1px solid #2a2018; background: #1c140f;
        }
        .pp-filling-row:last-child { border-bottom: none; }
        .pp-filling-row .fname { font-size: 15px; color: #f0e6da; }
        .pp-filling-row .fprice, .fqty-badge { color: #f0793f; font-weight: 700; }

        .pp-qty-stepper {
          display: flex; align-items: center; gap: 10px;
        }
        .pp-qty-stepper button {
          width: 30px; height: 30px; border-radius: 50%; border: none;
          font-size: 18px; font-weight: 700; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .pp-qty-stepper button:first-child { background: #3a1f18; color: #e5533d; }
        .pp-qty-stepper button:last-child { background: #3a2a14; color: #f0973f; }
        .pp-qty-stepper button:disabled { opacity: 0.35; cursor: default; }
        .pp-qty-stepper span { min-width: 16px; text-align: center; font-weight: 700; color: #f0e6da; }

        /* sauce stripe swatch row */
        .pp-swatch-row {
          display: flex; align-items: center; gap: 12px;
          border: 1px solid #3a2c22; border-radius: 12px; padding: 12px 16px; background: #1c140f;
        }
        .pp-swatch {
          width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0;
          border: 1px solid rgba(255,255,255,0.12);
        }
        .pp-swatch-sm { width: 18px; height: 18px; border-radius: 5px; }
        .pp-swatch-label { flex: 1; font-size: 15px; color: #f0e6da; }

        /* generic change/select controls */
        .change-btn {
          color: #f0793f; font-weight: 700; font-size: 14px; border: none;
          background: none; cursor: pointer; display: inline-flex; align-items: center; gap: 2px;
        }
        .chev { display: inline-block; transition: transform 0.15s ease; }
        .chev.up { transform: rotate(180deg); }

        .pp-bottom-row-head, .pp-select-head {
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          background: #1c140f; border: none; padding: 14px 16px; cursor: pointer;
          font-size: 15px; color: #f0e6da; text-align: left;
        }
        .pp-bottom-row { border: 1px solid #3a2c22; border-radius: 12px; margin-bottom: 10px; overflow: hidden; }
        .pp-select-box { border: 1px solid #f0793f; border-radius: 12px; overflow: hidden; }

        .pp-bottom-options { border-top: 1px solid #2a2018; }
        .pp-bottom-options label {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px; font-size: 14px; color: #f0e6da;
          border-bottom: 1px solid #2a2018; cursor: pointer; background: #150f0c;
        }
        .pp-bottom-options label:last-child { border-bottom: none; }
        .pp-bottom-options label.is-current { background: #2a1f14; font-weight: 700; }
        .pp-bottom-options .opt-delta { margin-left: auto; color: #f0793f; font-weight: 700; }

        /* more fillings categories */
        .pp-cat-list { display: flex; flex-direction: column; gap: 10px; }
        .pp-cat { background: #2a2018; border-radius: 12px; overflow: hidden; }
        .pp-cat-head {
          width: 100%; display: flex; align-items: center; gap: 12px;
          background: none; border: none; padding: 16px; cursor: pointer;
          font-size: 17px; font-weight: 700; color: #f5ede4; text-align: left;
        }
        .pp-cat-icon { font-size: 18px; }
        .pp-cat-title { flex: 1; }
        .pp-cat-badge {
          background: #1e5fa8; color: #fff; font-size: 11px; font-weight: 700;
          padding: 3px 8px; border-radius: 5px;
        }
        .pp-cat-chev { font-size: 20px; }
        .pp-cat-body { background: #1c140f; }

        /* product details accordion */
        .pp-details-list { border-top: 1px solid #3a2c22; }
        .pp-details-row { border-bottom: 1px solid #3a2c22; }
        .pp-details-head {
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          background: none; border: none; padding: 16px 0; cursor: pointer;
          font-size: 17px; font-weight: 700; color: #f5ede4; text-align: left;
        }
        .pp-details-body {
          margin: 0 0 16px; font-size: 14px; line-height: 1.5; color: #a89a8c;
        }
      `}</style>
    </div>
  );
}
