'use client';

import { useState } from 'react';
import { useStore } from '@/context/StoreContext';

const EMPTY = { name: '', phone: '', address: '', city: '', notes: '' };

export default function CheckoutModal() {
  const { cart, cartTotal, isCheckoutOpen, setCheckoutOpen, placeOrder } = useStore();
  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState(EMPTY);

  const close = () => {
    setCheckoutOpen(false);
    setStep(1);
  };

  const onField = (key) => (e) => setCustomer((c) => ({ ...c, [key]: e.target.value }));

  const goToReview = (e) => {
    e.preventDefault();
    setStep(2);
  };

  const submitOrder = (e) => {
    e.preventDefault();
    placeOrder(customer);
    setStep(1);
    setCustomer(EMPTY);
  };

  return (
    <div className={`modal-overlay${isCheckoutOpen ? ' open' : ''}`}>
      <div className="modal-box">
        <button className="modal-close" type="button" onClick={close}>×</button>
        <h3>Checkout</h3>

        <div className="checkout-steps">
          <div className={`checkout-step-dot${step === 1 ? ' active' : step > 1 ? ' done' : ''}`}>1</div>
          <div className={`checkout-step-line${step > 1 ? ' done' : ''}`} />
          <div className={`checkout-step-dot${step === 2 ? ' active' : ''}`}>2</div>
        </div>

        {step === 1 && (
          <form id="checkoutForm" onSubmit={goToReview}>
            <p className="desc" style={{ marginBottom: 16 }}>Delivery details</p>
            <label>
              Full name
              <input required type="text" value={customer.name} onChange={onField('name')} />
            </label>
            <label>
              Phone
              <input required type="tel" value={customer.phone} onChange={onField('phone')} />
            </label>
            <label>
              Delivery address
              <input required type="text" value={customer.address} onChange={onField('address')} />
            </label>
            <label>
              City / Postal code
              <input required type="text" value={customer.city} onChange={onField('city')} />
            </label>
            <label>
              Notes for the courier (optional)
              <input type="text" value={customer.notes} onChange={onField('notes')} placeholder="Doorbell, gate code, allergies…" />
            </label>
            <button type="submit" className="btn-primary" style={{ width: '100%' }}>
              Continue to payment
            </button>
          </form>
        )}

        {step === 2 && (
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
                  <span>Pay the courier when your order arrives</span>
                </span>
                <input type="radio" name="payment" value="cod" checked readOnly />
              </label>
            </div>

            <div className="checkout-nav">
              <button type="button" className="btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                Place order — {cartTotal.toFixed(2)} €
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
