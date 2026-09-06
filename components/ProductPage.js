'use client';

import { useState } from 'react';
import { useStore } from '@/context/StoreContext';

const TOPPING_EMOJI = {
  'Extra cheese': '🧀', Pepperoni: '🔴', Mushroom: '🍄', Onion: '🧅',
  Bacon: '🥓', Jalapeño: '🌶️', Olives: '🫒', Pineapple: '🍍', Ham: '🍖', Garlic: '🧄',
};

function money(n) {
  return `${n.toFixed(2)} €`;
}

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

function SauceStripeRow({ options, current, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === current) || options[0];
  if (!selected) return null;
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
          {options.map((opt) => (
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

function DipRow({ options, current, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === current) || options[0];
  if (!selected) return null;
  return (
    <div className="pp-section">
      <p className="pp-label">Dip the edges</p>
      <div className="pp-select-box">
        <button type="button" className="pp-select-head" onClick={() => setOpen((v) => !v)}>
          <span>{selected.id === options[0]?.id ? 'Select a dip' : selected.label}</span>
          <span className="change-btn">select <span className={`chev${open ? ' up' : ''}`}>▾</span></span>
        </button>
        {open && (
          <div className="pp-bottom-options">
            {options.map((opt) => (
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

function QtyStepper({ qty, onDec, onInc }) {
  return (
    <div className="pp-qty-stepper">
      <button type="button" aria-label="Remove one" onClick={onDec} disabled={qty <= 0}>−</button>
      {qty > 0 && <span>{qty}</span>}
      <button type="button" aria-label="Add one" onClick={onInc}>+</button>
    </div>
  );
}

function CurrentFillings({ allFillings, fillings, onSetQty }) {
  const entries = Object.entries(fillings).filter(([, qty]) => qty > 0);
  return (
    <div className="pp-section">
      <p className="pp-label">Fillings</p>
      {entries.length === 0 ? (
        <p className="pp-empty-hint">No fillings added yet — add some from “More fillings” below.</p>
      ) : (
        <div className="pp-fillings-list">
          {entries.map(([id, qty]) => {
            const item = allFillings.find((f) => f.id === id);
            if (!item) return null;
            return (
              <div className="pp-filling-row active" key={id}>
                <button
                  type="button"
                  className="fname"
                  onClick={() => onSetQty(id, qty + 1)}
                >
                  {item.label}{qty > 1 ? <span className="fqty-badge"> x {qty}</span> : null}
                </button>
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
              <div className={`pp-filling-row${qty > 0 ? ' active' : ''}`} key={item.id}>
                <button
                  type="button"
                  className="fname"
                  onClick={() => onSetQty(item.id, qty + 1)}
                >
                  {item.label}
                  <span className="fprice"> +{item.price.toFixed(2)} €</span>
                </button>
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

export default function ProductPage() {
  const {
    activeProduct, selection, unitPrice, lineTotal,
    isProductPageOpen, closeProduct, toggleTopping, setSize, setQty, setOption,
    setFillingQty, addToCart, goToCheckout,
    toppings: TOPPINGS, toppingPrice: TOPPING_PRICE, sizeLargeUpcharge: SIZE_LARGE_UPCHARGE,
    baseOptions: BASE_OPTIONS, sauceOptions: SAUCE_OPTIONS, cheeseOptions: CHEESE_OPTIONS,
    fillingCategories: FILLING_CATEGORIES, allFillings: ALL_FILLINGS,
    sauceStripeOptions: SAUCE_STRIPE_OPTIONS, dipOptions: DIP_OPTIONS,
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
          onClick={() => { closeProduct(); goToCheckout(); }}
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
                      key={t.id}
                      type="button"
                      className={`pp-finish-tile${selection.toppings.includes(t.label) ? ' selected' : ''}`}
                      onClick={() => toggleTopping(t.label)}
                    >
                      <span className="emoji">{TOPPING_EMOJI[t.label] || '●'}</span>
                      <span className="fname">{t.label}</span>
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

              <CurrentFillings allFillings={ALL_FILLINGS} fillings={selection.fillings} onSetQty={setFillingQty} />

              <SauceStripeRow options={SAUCE_STRIPE_OPTIONS} current={selection.sauceStripe} onChange={(id) => setOption('sauceStripe', id)} />

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

              <DipRow options={DIP_OPTIONS} current={selection.dip} onChange={(id) => setOption('dip', id)} />

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
    </div>
  );
}
