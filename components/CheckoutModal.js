'use client';

import { useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { DRINKS, DIP_CUPS, SNACKS } from '@/data/menu';

const EMPTY = { name: '', email: '', phone: '', notes: '' };

const EXTRA_SECTIONS = {
  drinks: { label: 'All drinks', items: DRINKS },
  dips: { label: 'Dip the edges', items: DIP_CUPS },
  snacks: { label: 'Snacks', items: SNACKS },
};

export default function CheckoutModal() {
  const {
    cart, cartTotal, isCheckoutOpen, closeCheckout, placeOrder,
    removeFromCart, updateCartQty, addDrinkToCart,
  } = useStore();
  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState(EMPTY);
  const [openSection, setOpenSection] = useState(null);

  const close = () => {
    closeCheckout();
    setStep(1);
    setOpenSection(null);
  };

  const onField = (key) => (e) => setCustomer((c) => ({ ...c, [key]: e.target.value }));

  const submitOrder = (e) => {
    e.preventDefault();
    placeOrder(customer);
    setStep(1);
    setCustomer(EMPTY);
  };

  return (
    <div className={`checkout-page${isCheckoutOpen ? ' open' : ''}`}>
      <div className="pp-topbar">
        <button className="pp-back" type="button" aria-label="Close" onClick={close}>←</button>
        <span className="pp-topbar-title">Your order</span>
        <span style={{ width: 28 }} />
      </div>

      <div className="pp-scroll">
        <div className="wrap" style={{ paddingTop: 24, paddingBottom: 40 }}>
        <div className="checkout-steps">
          <div className={`checkout-step-dot${step === 1 ? ' active' : step > 1 ? ' done' : ''}`}>1</div>
          <div className={`checkout-step-line${step > 1 ? ' done' : ''}`} />
          <div className={`checkout-step-dot${step === 2 ? ' active' : step > 2 ? ' done' : ''}`}>2</div>
          <div className={`checkout-step-line${step > 2 ? ' done' : ''}`} />
          <div className={`checkout-step-dot${step === 3 ? ' active' : ''}`}>3</div>
        </div>

        {step === 1 && (
          <div>
            <p className="desc" style={{ marginBottom: 16 }}>Review your order</p>
            <div className="checkout-summary">
              {cart.length === 0 && <p className="desc">Your cart is empty.</p>}
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

            <button
              type="button"
              className="btn-primary"
              style={{ width: '100%', marginTop: 24 }}
              disabled={cart.length === 0}
              onClick={() => setStep(2)}
            >
              Continue — {cartTotal.toFixed(2)} €
            </button>
          </div>
        )}

        {step === 2 && (
          <form id="checkoutForm" onSubmit={(e) => { e.preventDefault(); setStep(3); }}>
            <p className="desc" style={{ marginBottom: 16 }}>Order details</p>
            <label>
              First name and last name
              <input required type="text" value={customer.name} onChange={onField('name')} />
            </label>
            <label>
              Email address
              <input required type="email" value={customer.email} onChange={onField('email')} />
            </label>
            <label>
              Phone
              <input required type="tel" value={customer.phone} onChange={onField('phone')} />
            </label>
            <label>
              Additional information for the restaurant
              <input type="text" value={customer.notes} onChange={onField('notes')} placeholder="e.g. door code, floor, company, food allergy" />
            </label>
            <div className="checkout-nav">
              <button type="button" className="btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>Continue</button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={submitOrder}>
            <div className="checkout-summary">
              {cart.map((l) => (
                <div className="cs-row" key={l.key}>
                  <span>{l.qty} × {l.name}</span>
                  <span>{l.lineTotal.toFixed(2)} €</span>
                </div>
              ))}
              <div className="cs-total">
                <span>Total</span>
                <span>{cartTotal.toFixed(2)} €</span>
              </div>
            </div>

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

            <div className="checkout-nav">
              <button type="button" className="btn-secondary" onClick={() => setStep(2)}>Back</button>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                Place order — {cartTotal.toFixed(2)} €
              </button>
            </div>
          </form>
        )}
        </div>
      </div>

      <div className={`extra-page${openSection ? ' open' : ''}`}>
        {openSection && (
          <>
            <div className="pp-topbar">
              <button className="pp-back" type="button" aria-label="Close" onClick={() => setOpenSection(null)}>×</button>
              <span className="pp-topbar-title">{EXTRA_SECTIONS[openSection].label.toUpperCase()}</span>
              <span style={{ width: 28 }} />
            </div>
            <div className="pp-scroll">
              <div className="wrap" style={{ paddingTop: 8, paddingBottom: 40 }}>
                <div className="extra-list">
                  {EXTRA_SECTIONS[openSection].items.map((item) => {
                    const line = cart.find((l) => l.drinkId === item.id);
                    return (
                      <div className="extra-list-row" key={item.id}>
                        <img src={item.image} alt={item.name} />
                        <div className="extra-list-body">
                          <span className="extra-list-name">{item.name}</span>
                          <span className="extra-list-price">{item.price.toFixed(2)} €</span>
                        </div>
                        <button
                          type="button"
                          className={`extra-list-add${line ? ' in-cart' : ''}`}
                          onClick={() => addDrinkToCart(item)}
                        >
                          {line ? `In cart · ${line.qty}` : '+'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
