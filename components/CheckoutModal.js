'use client';

import { useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { useTranslations } from '@/lib/i18n';

const EMPTY = { name: '', address: '', email: '', phone: '', notes: '' };

// Accepts +358401234567, 0401234567, +358 40 123 4567, 040-123-4567, etc.
function isValidFinnishPhone(raw) {
  const cleaned = raw.replace(/[\s-]/g, '');
  return /^(\+358[1-9]\d{6,9}|0[1-9]\d{6,9})$/.test(cleaned);
}

function StepIndicator({ step, stepLabels }) {
  return (
    <div className="checkout-steps">
      {stepLabels.map((label, i) => {
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

function MiniSummary({ cart, cartTotal, t }) {
  const [open, setOpen] = useState(false);
  const itemCount = cart.reduce((sum, l) => sum + l.qty, 0);
  return (
    <div className="mini-summary">
      <button type="button" className="mini-summary-head" onClick={() => setOpen((v) => !v)}>
        <span>{t.checkout.itemsCount(itemCount)}</span>
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
    drinks, dipCups, snacks,
  } = useStore();
  const t = useTranslations();
  const STEP_LABELS = [t.checkout.stepCart, t.checkout.stepDetails, t.checkout.stepPayment];

  const EXTRA_SECTIONS = {
    drinks: { label: t.checkout.allDrinks, items: drinks },
    dips: { label: t.checkout.dipsShortcut, items: dipCups },
    snacks: { label: t.checkout.snacks, items: snacks },
  };

  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [openSection, setOpenSection] = useState(null);
  const [justAddedId, setJustAddedId] = useState(null);

  // Phase 7.6 — coupon code. `couponStatus` 'applied' is only ever an
  // advisory preview from /api/coupons/validate (see that route + the
  // shared lib/coupons.js logic it shares with app/api/orders/route.js) —
  // the real check happens again, from scratch, when the order is
  // actually submitted. If that later check disagrees (e.g. someone else
  // used the last remaining redemption in between), submitOrder's catch
  // below surfaces that as the normal order-error banner.
  const [couponInput, setCouponInput] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponStatus, setCouponStatus] = useState('idle'); // idle | checking | applied | error
  const [couponError, setCouponError] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponFinalTotal, setCouponFinalTotal] = useState(null);

  const handleAdd = (item) => {
    addDrinkToCart(item);
    setJustAddedId(item.id);
    window.clearTimeout(handleAdd._t);
    handleAdd._t = window.setTimeout(() => setJustAddedId(null), 1100);
  };

  const resetCoupon = () => {
    setCouponInput('');
    setCouponCode('');
    setCouponStatus('idle');
    setCouponError('');
    setCouponDiscount(0);
    setCouponFinalTotal(null);
  };

  const close = () => {
    closeCheckout();
    setStep(1);
    setOpenSection(null);
    setErrors({});
    setOrderError('');
    resetCoupon();
  };

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponStatus('checking');
    setCouponError('');
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal: cartTotal }),
      });
      const data = await res.json().catch(() => ({ valid: false }));
      if (!data.valid) {
        setCouponStatus('error');
        setCouponError(data.error || t.checkout.couponGenericError);
        return;
      }
      setCouponCode(data.code);
      setCouponDiscount(data.discountAmount);
      setCouponFinalTotal(data.finalTotal);
      setCouponStatus('applied');
    } catch {
      setCouponStatus('error');
      setCouponError(t.checkout.couponNetworkError);
    }
  };

  const onField = (key) => (e) => {
    setCustomer((c) => ({ ...c, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: null }));
  };

  const validateDetails = () => {
    const next = {};
    if (!customer.name.trim()) next.name = t.checkout.errorName;
    if (!customer.address.trim()) next.address = t.checkout.errorAddress;
    // Email is optional (not legally required for a cash-on-delivery order
    // in Finland) — an empty field passes straight through, but if the
    // customer does type something, it's still format-checked so we don't
    // silently accept garbage. Phone stays the required contact/tracking
    // method either way.
    if (customer.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) {
      next.email = t.checkout.errorEmail;
    }
    if (!isValidFinnishPhone(customer.phone.trim())) {
      next.phone = t.checkout.errorPhone;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submitDetails = (e) => {
    e.preventDefault();
    if (validateDetails()) setStep(3);
  };

  const submitOrder = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setOrderError('');
    try {
      await placeOrder(customer, couponStatus === 'applied' ? couponCode : undefined);
      setStep(1);
      setCustomer(EMPTY);
      resetCoupon();
    } catch (err) {
      setOrderError(err.message || t.checkout.genericOrderError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`checkout-page${isCheckoutOpen ? ' open' : ''}`}>
      <div className="pp-topbar">
        <button className="pp-back" type="button" aria-label={step > 1 ? t.checkout.backAriaLabel : t.checkout.closeAriaLabel} onClick={() => (step > 1 ? setStep(step - 1) : close())}>←</button>
        <span className="pp-topbar-title">{t.checkout.title}</span>
        <span style={{ width: 28 }} />
      </div>

      <div className="pp-scroll">
        <div className="wrap" style={{ paddingTop: 24, paddingBottom: 40 }}>
          <StepIndicator step={step} stepLabels={STEP_LABELS} />

          {step === 1 && cart.length === 0 && (
            <div className="checkout-empty">
              <div className="checkout-empty-icon">🛒</div>
              <p>{t.checkout.emptyCart}</p>
              <button type="button" className="btn-primary" onClick={close}>{t.checkout.backToMenu}</button>
            </div>
          )}

          {step === 1 && cart.length > 0 && (
            <div>
              <p className="desc" style={{ marginBottom: 16 }}>{t.checkout.reviewOrder}</p>
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
                        <button type="button" className="cs-remove" onClick={() => removeFromCart(l.key)}>{t.checkout.remove}</button>
                      </div>
                    </div>
                    <span className="cs-price">{l.lineTotal.toFixed(2)} €</span>
                  </div>
                ))}
                <div className="cs-total">
                  <span>{t.checkout.total}</span>
                  <span>{cartTotal.toFixed(2)} €</span>
                </div>
              </div>

              <p className="pp-label" style={{ marginTop: 24 }}>{t.checkout.coldDrink}</p>
              <div className="drink-upsell-row">
                {drinks.map((d) => {
                  const line = cart.find((l) => l.drinkId === d.id);
                  return (
                    <button type="button" className="drink-tile" key={d.id} onClick={() => addDrinkToCart(d)}>
                      <img src={d.image} alt={d.name} />
                      <span className="dname">{d.name}</span>
                      <span className="dprice">{line ? t.checkout.inCart(line.qty) : `${d.price.toFixed(2)} €`}</span>
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
              <MiniSummary cart={cart} cartTotal={cartTotal} t={t} />
              <p className="desc" style={{ marginBottom: 16 }}>{t.checkout.orderDetails}</p>
              <label className={errors.name ? 'has-error' : ''}>
                {t.checkout.fullName}
                <input type="text" value={customer.name} onChange={onField('name')} />
                {errors.name && <span className="field-error">{errors.name}</span>}
              </label>
              <label className={errors.address ? 'has-error' : ''}>
                {t.checkout.deliveryAddress}
                <input type="text" value={customer.address} onChange={onField('address')} placeholder={t.checkout.deliveryAddressPlaceholder} />
                {errors.address && <span className="field-error">{errors.address}</span>}
              </label>
              <label className={errors.email ? 'has-error' : ''}>
                {t.checkout.emailOptional}
                <input type="email" value={customer.email} onChange={onField('email')} placeholder={t.checkout.emailPlaceholder} />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </label>
              <label className={errors.phone ? 'has-error' : ''}>
                {t.checkout.phone}
                <input type="tel" value={customer.phone} onChange={onField('phone')} placeholder={t.checkout.phonePlaceholder} />
                {errors.phone && <span className="field-error">{errors.phone}</span>}
              </label>
              <label>
                {t.checkout.additionalInfo}
                <input type="text" value={customer.notes} onChange={onField('notes')} placeholder={t.checkout.additionalInfoPlaceholder} />
              </label>
            </form>
          )}

          {step === 3 && (
            <form id="paymentForm" onSubmit={submitOrder}>
              <MiniSummary cart={cart} cartTotal={cartTotal} t={t} />

              <div style={{ margin: '16px 0' }}>
                {couponStatus === 'applied' ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(60,160,80,0.12)', borderRadius: 8 }}>
                    <span>🏷️ {t.checkout.couponApplied(couponCode, `${couponDiscount.toFixed(2)} €`)}</span>
                    <button type="button" onClick={resetCoupon} style={{ background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontSize: 13 }}>
                      {t.checkout.couponRemove}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        placeholder={t.checkout.couponPlaceholder}
                        value={couponInput}
                        onChange={(e) => { setCouponInput(e.target.value); if (couponStatus === 'error') setCouponStatus('idle'); }}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={!couponInput.trim() || couponStatus === 'checking'}
                        onClick={applyCoupon}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {couponStatus === 'checking' ? t.checkout.couponChecking : t.checkout.couponApply}
                      </button>
                    </div>
                    {couponStatus === 'error' && <span className="field-error">{couponError}</span>}
                  </div>
                )}
              </div>

              <div className="payment-method">
                <p>{t.checkout.paymentMethodHeading}</p>
                <label className="pay-option">
                  <span className="pay-icon">💵</span>
                  <span className="pay-option-text">
                    <b>{t.checkout.cod}</b>
                    <span>{t.checkout.codDesc}</span>
                  </span>
                  <input type="radio" name="payment" value="cod" checked readOnly />
                </label>
              </div>

              {orderError && <p className="field-error" style={{ marginTop: 12 }}>{orderError}</p>}
            </form>
          )}
        </div>
      </div>

      {step === 1 && cart.length > 0 && (
        <div className="checkout-footer">
          <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={() => setStep(2)}>
            {t.checkout.continueWithTotal(`${cartTotal.toFixed(2)} €`)}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="checkout-footer">
          <button type="submit" form="checkoutForm" className="btn-primary" style={{ flex: 1 }}>{t.checkout.continue}</button>
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
            {t.checkout.placeOrder(`${(couponStatus === 'applied' ? couponFinalTotal : cartTotal).toFixed(2)} €`)}
          </button>
        </div>
      )}

      <div className={`extra-page${openSection ? ' open' : ''}`}>
        {openSection && (
          <>
            <div className="pp-topbar">
              <button className="pp-back" type="button" aria-label={t.checkout.closeAriaLabel} onClick={() => setOpenSection(null)}>×</button>
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
                            <span>{t.checkout.added}</span>
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
                {t.checkout.ready}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
