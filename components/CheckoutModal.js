'use client';

import { useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { DRINKS, DIP_CUPS, SNACKS } from '@/data/menu';

const EMPTY = { name: '', address: '', email: '', phone: '', notes: '' };

// Accepts +358401234567, 0401234567, +358 40 123 4567, 040-123-4567, etc.
function isValidFinnishPhone(raw) {
  const cleaned = raw.replace(/[\s-]/g, '');
  return /^(\+358[1-9]\d{6,9}|0[1-9]\d{6,9})$/.test(cleaned);
}
const STEP_LABELS = ['Cart', 'Details', 'Payment'];

const EXTRA_SECTIONS = {
  drinks: { label: 'All drinks', items: DRINKS },
  dips: { label: 'Dip the edges', items: DIP_CUPS },
  snacks: { label: 'Snacks', items: SNACKS },
};

function StepIndicator({ step }) {
  return (
    <div className="checkout-steps">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const isActive = step === n;
        const isDone = step > n;
        return (
          <div key={label} style={{ display: 'contents' }}>
            <div className="checkout-step">
              <div className={`checkout-step-dot${isActive ? ' active' : isDone ? ' done' : ''}`}>
                {isDone ? '✓' : n}
              </div>
              <span className={`checkout-step-label${isActive ? ' active' : ''}`}>{label}</span>
            </div>
            {n < STEP_LABELS.length && (
              <div className={`checkout-step-line${step > n ? ' done' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function MiniSummary({ cart, cartTotal }) {
  const [open, setOpen] = useState(false);
  const itemCount = cart.reduce((sum, l) => sum + l.qty, 0);
  return (
    <div className="mini-summary">
      <button type="button" className="mini-summary-head" onClick={() => setOpen((v) => !v)}>
        <span>{itemCount} item{itemCount !== 1 ? 's' : ''} in your order</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <b>{cartTotal.toFixed(2)} €</b>
          <span className={`mini-summary-chev${open ? ' up' : ''}`}>⌄</span>
        </span>
      </button>
      {open && (
        <div className="mini-summary-body">
          {cart.map((l) => (
            <div className="cs-row" key={l.key}>
              <span>{l.qty} × {l.name}</span>
              <span>{l.lineTotal.toFixed(2)} €</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CheckoutModal() {
  const {
    cart, cartTotal, isCheckoutOpen, closeCheckout, placeOrder,
    removeFromCart, updateCartQty, addDrinkToCart,
  } = useStore();
  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [openSection, setOpenSection] = useState(null);
  const [justAddedId, setJustAddedId] = useState(null);

  const handleAdd = (item) => {
    addDrinkToCart(item);
    setJustAddedId(item.id);
    window.clearTimeout(handleAdd._t);
    handleAdd._t = window.setTimeout(() => setJustAddedId(null), 1100);
  };

  const close = () => {
    closeCheckout();
    setStep(1);
    setOpenSection(null);
    setErrors({});
  };

  const onField = (key) => (e) => {
    setCustomer((c) => ({ ...c, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: null }));
  };

  const validateDetails = () => {
    const next = {};
    if (!customer.name.trim()) next.name = 'Please enter your full name.';
    if (!customer.address.trim()) next.address = 'Please enter your delivery address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) {
      next.email = 'Please enter a valid email address.';
    }
    if (!isValidFinnishPhone(customer.phone.trim())) {
      next.phone = 'Please enter a valid Finnish phone number (e.g. 040 123 4567).';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submitDetails = (e) => {
    e.preventDefault();
    if (validateDetails()) setStep(3);
  };

  const submitOrder = (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    window.setTimeout(() => {
      placeOrder(customer);
      setSubmitting(false);
      setStep(1);
      setCustomer(EMPTY);
    }, 900);
  };

  return (
    <div className={`checkout-page${isCheckoutOpen ? ' open' : ''}`}>
      <div className="pp-topbar">
        <button className="pp-back" type="button" aria-label={step > 1 ? 'Back' : 'Close'} onClick={() => (step > 1 ? setStep(step - 1) : close())}>←</button>
        <span className="pp-topbar-title">Your order</span>
        <span style={{ width: 28 }} />
      </div>

      <div className="pp-scroll">
        <div className="wrap" style={{ paddingTop: 24, paddingBottom: 40 }}>
          <StepIndicator step={step} />

          {step === 1 && cart.length === 0 && (
            <div className="checkout-empty">
              <div className="checkout-empty-icon">🛒</div>
              <p>Your cart is empty. Add something tasty from the menu first.</p>
              <button type="button" className="btn-primary" onClick={close}>Back to menu</button>
            </div>
          )}

          {step === 1 && cart.length > 0 && (
            <div>
              <p className="desc" style={{ marginBottom: 16 }}>Review your order</p>
              <div className="checkout-summary">
                {cart.map((l) => (
                  <div className="cs-row cs-row-editable" key={l.key}>
                    <img src={l.image} alt={l.name} className="cs-thumb" />
                    <div className="cs-body">
                      <span className="cs-name">{l.name}</span>
                      {l.details && l.details.length > 0 && (
                        <span className="cs-details">{l.details.join(', ')}</span>
                      )}
                      <div className="cs-qty-row">
                        <div className="cs-qty">
                          <button type="button" onClick={() => updateCartQty(l.key, l.qty - 1)}>−</button>
                          <span>{l.qty}</span>
                          <button type="button" onClick={() => updateCartQty(l.key, l.qty + 1)}>+</button>
                        </div>
                        <button type="button" className="cs-remove" onClick={() => removeFromCart(l.key)}>Remove</button>
                      </div>
                    </div>
                    <span className="cs-price">{l.lineTotal.toFixed(2)} €</span>
                  </div>
                ))}
                <div className="cs-total">
                  <span>Total</span>
                  <span>{cartTotal.toFixed(2)} €</span>
                </div>
              </div>

              <p className="pp-label" style={{ marginTop: 24 }}>A cold drink on the side?</p>
              <div className="drink-upsell-row">
                {DRINKS.map((d) => {
                  const line = cart.find((l) => l.drinkId === d.id);
                  return (
                    <button type="button" className="drink-tile" key={d.id} onClick={() => addDrinkToCart(d)}>
                      <img src={d.image} alt={d.name} />
                      <span className="dname">{d.name}</span>
                      <span className="dprice">{line ? `In cart · ${line.qty}` : `${d.price.toFixed(2)} €`}</span>
                      <span className="drink-add-btn">+</span>
                    </button>
                  );
                })}
              </div>

              <div className="shortcut-row">
                {Object.entries(EXTRA_SECTIONS).map(([key, section]) => (
                  <button
                    type="button"
                    key={key}
                    className="shortcut-pill"
                    onClick={() => setOpenSection(key)}
                  >
                    <span className="shortcut-thumbs">
                      {section.items.slice(0, 2).map((it) => (
                        <img key={it.id} src={it.image} alt="" />
                      ))}
                    </span>
                    {section.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <form id="checkoutForm" onSubmit={submitDetails} noValidate>
              <MiniSummary cart={cart} cartTotal={cartTotal} />
              <p className="desc" style={{ marginBottom: 16 }}>Order details</p>
              <label className={errors.name ? 'has-error' : ''}>
                First name and last name
                <input type="text" value={customer.name} onChange={onField('name')} />
                {errors.name && <span className="field-error">{errors.name}</span>}
              </label>
              <label className={errors.address ? 'has-error' : ''}>
                Delivery address
                <input type="text" value={customer.address} onChange={onField('address')} placeholder="Street, house number, city" />
                {errors.address && <span className="field-error">{errors.address}</span>}
              </label>
              <label className={errors.email ? 'has-error' : ''}>
                Email address
                <input type="email" value={customer.email} onChange={onField('email')} placeholder="you@example.com" />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </label>
              <label className={errors.phone ? 'has-error' : ''}>
                Phone
                <input type="tel" value={customer.phone} onChange={onField('phone')} placeholder="040 123 4567" />
                {errors.phone && <span className="field-error">{errors.phone}</span>}
              </label>
              <label>
                Additional information for the restaurant
                <input type="text" value={customer.notes} onChange={onField('notes')} placeholder="e.g. door code, floor, company, food allergy" />
              </label>
            </form>
          )}

          {step === 3 && (
            <form id="paymentForm" onSubmit={submitOrder}>
              <MiniSummary cart={cart} cartTotal={cartTotal} />

              <div className="payment-method">
                <p>Payment method</p>
                <label className="pay-option">
                  <span className="pay-icon">💵</span>
                  <span className="pay-option-text">
                    <b>Cash on delivery</b>
                    <span>Pay when your order arrives</span>
                  </span>
                  <input type="radio" name="payment" value="cod" checked readOnly />
                </label>
              </div>
            </form>
          )}
        </div>
      </div>

      {step === 1 && cart.length > 0 && (
        <div className="checkout-footer">
          <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={() => setStep(2)}>
            Continue — {cartTotal.toFixed(2)} €
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="checkout-footer">
          <button type="submit" form="checkoutForm" className="btn-primary" style={{ flex: 1 }}>Continue</button>
        </div>
      )}

      {step === 3 && (
        <div className="checkout-footer">
          <button
            type="submit"
            form="paymentForm"
            className={`btn-primary${submitting ? ' is-loading' : ''}`}
            style={{ flex: 1 }}
            disabled={submitting}
          >
            Place order — {cartTotal.toFixed(2)} €
          </button>
        </div>
      )}

      <div className={`extra-page${openSection ? ' open' : ''}`}>
        {openSection && (
          <>
            <div className="pp-topbar">
              <button className="pp-back" type="button" aria-label="Close" onClick={() => setOpenSection(null)}>×</button>
              <span className="pp-topbar-title">{EXTRA_SECTIONS[openSection].label.toUpperCase()}</span>
              <span style={{ width: 28 }} />
            </div>
            <div className="pp-scroll">
              <div className="wrap" style={{ paddingTop: 8, paddingBottom: 24 }}>
                <div className="extra-list">
                  {EXTRA_SECTIONS[openSection].items.map((item) => {
                    const line = cart.find((l) => l.drinkId === item.id);
                    const isJustAdded = justAddedId === item.id;
                    return (
                      <div
                        className={`extra-list-row${line ? ' in-cart' : ''}${isJustAdded ? ' just-added' : ''}`}
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleAdd(item)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleAdd(item); }}
                      >
                        <img src={item.image} alt={item.name} />
                        {isJustAdded ? (
                          <div className="extra-list-body extra-list-added">
                            <span className="extra-added-check">✓</span>
                            <span>Added</span>
                          </div>
                        ) : (
                          <div className="extra-list-body">
                            <span className="extra-list-name">{item.name}</span>
                            <span className="extra-list-price">{item.price.toFixed(2)} €</span>
                          </div>
                        )}
                        <span className="extra-list-add" aria-hidden="true">+</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="extra-footer">
              <button
                type="button"
                className="btn-primary extra-ready-btn"
                onClick={() => setOpenSection(null)}
              >
                Ready
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
