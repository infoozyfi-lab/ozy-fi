'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/context/StoreContext';
import { useTranslations, useLocalePath } from '@/lib/i18n';
import type { FillingCategory, FillingItem, OptionItem } from '@/lib/types';

// Keyed by the ENGLISH topping label from the database — since Finnish
// toppings now resolve to their translated `label_fi` text (see
// lib/menu-i18n.js), a topping the business owner has translated no
// longer matches a key here and silently falls back to the generic '●'
// bullet below. Purely cosmetic (pricing/selection still work correctly
// either way) — flagged in this feature's delivery summary rather than
// reworked into a bigger ID-based lookup.
const TOPPING_EMOJI: Record<string, string> = {
  'Extra cheese': '🧀', Pepperoni: '🔴', Mushroom: '🍄', Onion: '🧅',
  Bacon: '🥓', Jalapeño: '🌶️', Olives: '🫒', Pineapple: '🍍', Ham: '🍖', Garlic: '🧄',
};

function money(n: number) {
  return `${n.toFixed(2)} €`;
}

function BottomRow({ label, options, current, onChange, t }: { label: string; options: OptionItem[]; current: string | undefined; onChange: (id: string) => void; t: any }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === current) || options[0];
  if (!selected) return null;
  return (
    <div className="pp-bottom-row">
      <button type="button" className="pp-bottom-row-head" onClick={() => setOpen((v) => !v)}>
        <span className="label">{selected.label}</span>
        <span className="change-btn">{t.productPage.change} <span className={`chev${open ? ' up' : ''}`}>▾</span></span>
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

function SauceStripeRow({ options, current, onChange, t }: { options: OptionItem[]; current: string | undefined; onChange: (id: string) => void; t: any }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === current) || options[0];
  if (!selected) return null;
  return (
    <div className="pp-section">
      <p className="pp-label">{t.productPage.sauceStripesHeading}</p>
      <div className="pp-swatch-row">
        <span className="pp-swatch" style={{ background: selected.color }} aria-hidden="true" />
        <span className="pp-swatch-label">{selected.label}</span>
        <button type="button" className="change-btn" onClick={() => setOpen((v) => !v)}>
          {t.productPage.change} <span className={`chev${open ? ' up' : ''}`}>▾</span>
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

function DipRow({ options, current, onChange, t }: { options: OptionItem[]; current: string | undefined; onChange: (id: string) => void; t: any }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === current) || options[0];
  if (!selected) return null;
  return (
    <div className="pp-section">
      <p className="pp-label">{t.productPage.dipHeading}</p>
      <div className="pp-select-box">
        <button type="button" className="pp-select-head" onClick={() => setOpen((v) => !v)}>
          <span>{selected.id === options[0]?.id ? t.productPage.selectADip : selected.label}</span>
          <span className="change-btn">{t.productPage.select} <span className={`chev${open ? ' up' : ''}`}>▾</span></span>
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

function QtyStepper({ qty, onDec, onInc, t }: { qty: number; onDec: () => void; onInc: () => void; t: any }) {
  return (
    <div className="pp-qty-stepper">
      <button type="button" aria-label={t.productPage.removeOneAriaLabel} onClick={onDec} disabled={qty <= 0}>−</button>
      {qty > 0 && <span>{qty}</span>}
      <button type="button" aria-label={t.productPage.addOneAriaLabel} onClick={onInc}>+</button>
    </div>
  );
}

function CurrentFillings({ allFillings, fillings, onSetQty, t }: { allFillings: FillingItem[]; fillings: Record<string, number>; onSetQty: (id: string, qty: number) => void; t: any }) {
  const entries = Object.entries(fillings).filter(([, qty]) => qty > 0);
  return (
    <div className="pp-section">
      <p className="pp-label">{t.productPage.fillingsHeading}</p>
      {entries.length === 0 ? (
        <p className="pp-empty-hint">{t.productPage.fillingsEmptyHint}</p>
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
                  t={t}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MoreFillingsCategory({ category, fillings, onSetQty, open, onToggle, t }: { category: FillingCategory; fillings: Record<string, number>; onSetQty: (id: string, qty: number) => void; open: boolean; onToggle: () => void; t: any }) {
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
                  t={t}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProductDetails({ t }: { t: any }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const sections = [
    { id: 'raw-material', title: t.productPage.rawMaterialTitle, body: t.productPage.rawMaterialBody },
    { id: 'nutrition', title: t.productPage.nutritionTitle, body: t.productPage.nutritionBody },
    { id: 'climate', title: t.productPage.climateTitle, body: t.productPage.climateBody },
  ];
  return (
    <div className="pp-section">
      <p className="pp-heading">{t.productPage.productDetailsHeading}</p>
      <div className="pp-details-list">
        {sections.map((sec) => {
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
    setFillingQty, addToCart, goToCheckoutDirect,
    toppings: TOPPINGS, toppingPrice: TOPPING_PRICE, sizeLargeUpcharge: SIZE_LARGE_UPCHARGE,
    baseOptions: BASE_OPTIONS, sauceOptions: SAUCE_OPTIONS, cheeseOptions: CHEESE_OPTIONS,
    fillingCategories: FILLING_CATEGORIES, allFillings: ALL_FILLINGS,
    sauceStripeOptions: SAUCE_STRIPE_OPTIONS, dipOptions: DIP_OPTIONS,
  } = useStore();
  const t = useTranslations();
  const lp = useLocalePath();

  const [openCat, setOpenCat] = useState<string | null>(null);

  if (!activeProduct || !selection) {
    return <div className="product-page" aria-hidden="true" />;
  }

  const isBundleSlot = selection.bundleSlotIndex != null;

  const [intPart, decPart] = unitPrice.toFixed(2).split('.');

  return (
    <div className={`product-page${isProductPageOpen ? ' open' : ''}`}>
      <div className="pp-topbar">
        <button className="pp-back" type="button" aria-label={t.productPage.backAriaLabel} onClick={closeProduct}>←</button>
        <Link href={lp('/')} className="pp-topbar-title">ozy<span>.fi</span></Link>
        <button
          className="pp-cart"
          type="button"
          aria-label={t.productPage.cartAriaLabel}
          onClick={() => { closeProduct(); goToCheckoutDirect(); }}
        >
          🛒
        </button>
      </div>

      <div className="pp-scroll">
        <div className="pp-hero">
          <img className="pp-hero-img" src={activeProduct.image ?? undefined} alt={activeProduct.name} />
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
                <p className="pp-label">{t.productPage.size}</p>
                <div className="pp-toggle">
                  <button
                    type="button"
                    className={`pp-toggle-opt${selection.size === 'M' ? ' active' : ''}`}
                    onClick={() => setSize('M')}
                  >
                    {t.productPage.medium}
                  </button>
                  <button
                    type="button"
                    className={`pp-toggle-opt${selection.size === 'L' ? ' active' : ''}`}
                    onClick={() => setSize('L')}
                  >
                    {t.productPage.large}<span className="pp-toggle-sub">+{SIZE_LARGE_UPCHARGE.toFixed(2)} €</span>
                  </button>
                </div>
              </div>

              <div className="pp-section">
                <p className="pp-label">{t.productPage.finishToppings}</p>
                <div className="pp-finish-row">
                  {TOPPINGS.map((topping) => (
                    <button
                      key={topping.id}
                      type="button"
                      className={`pp-finish-tile${selection.toppings.includes(topping.label) ? ' selected' : ''}`}
                      onClick={() => toggleTopping(topping.label)}
                    >
                      <span className="emoji">{TOPPING_EMOJI[topping.label] || '●'}</span>
                      <span className="fname">{topping.label}</span>
                      <span className="fprice">+{TOPPING_PRICE.toFixed(2)} €</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pp-section">
                <p className="pp-label">{t.productPage.bottom}</p>
                <div className="pp-bottom-list">
                  <BottomRow label="base" options={BASE_OPTIONS} current={selection.base} onChange={(id) => setOption('base', id)} t={t} />
                  <BottomRow label="sauce" options={SAUCE_OPTIONS} current={selection.sauce} onChange={(id) => setOption('sauce', id)} t={t} />
                  <BottomRow label="cheese" options={CHEESE_OPTIONS} current={selection.cheese} onChange={(id) => setOption('cheese', id)} t={t} />
                </div>
              </div>

              <CurrentFillings allFillings={ALL_FILLINGS} fillings={selection.fillings} onSetQty={setFillingQty} t={t} />

              <SauceStripeRow options={SAUCE_STRIPE_OPTIONS} current={selection.sauceStripe} onChange={(id) => setOption('sauceStripe', id)} t={t} />

              <div className="pp-section">
                <p className="pp-heading">{t.productPage.moreFillings}</p>
                <div className="pp-cat-list">
                  {FILLING_CATEGORIES.map((cat) => (
                    <MoreFillingsCategory
                      key={cat.id}
                      category={cat}
                      fillings={selection.fillings}
                      onSetQty={setFillingQty}
                      open={openCat === cat.id}
                      onToggle={() => setOpenCat((c) => (c === cat.id ? null : cat.id))}
                      t={t}
                    />
                  ))}
                </div>
              </div>

              <DipRow options={DIP_OPTIONS} current={selection.dip} onChange={(id) => setOption('dip', id)} t={t} />

              <ProductDetails t={t} />
            </>
          )}
        </div>
      </div>

      <div className="pp-footer">
        {!isBundleSlot && (
          <div className="pp-qty">
            <button type="button" onClick={() => setQty((q) => q - 1)}>−</button>
            <span>{selection.qty}</span>
            <button type="button" onClick={() => setQty((q) => q + 1)}>+</button>
          </div>
        )}
        <button className="btn-primary pp-add-btn" type="button" onClick={addToCart}>
          {/* basePrice is typed optional (Product.basePrice?) but always populated
              once a product is active/selected here — non-null assertions are a
              no-op fix under strict mode, same behavior as before. */}
          {isBundleSlot
            ? unitPrice > activeProduct.basePrice!
              ? t.productPage.addToBundleExtra(money(unitPrice - activeProduct.basePrice!))
              : t.productPage.addToBundle
            : t.productPage.addToOrder(money(lineTotal))}
        </button>
      </div>
    </div>
  );
}
