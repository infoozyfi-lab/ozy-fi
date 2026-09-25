'use client';

import { useState, useRef, useEffect, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import { useStore } from '@/context/StoreContext';
import { useTranslations } from '@/lib/i18n';
import { computeDiscountAmount, describeDiscountValue } from '@/lib/pricing';
import { useBodyScrollLock } from '@/lib/hooks';
import type { Addon, CartLine, Customer, OpeningHours, OrderType } from '@/lib/types';
import CardPaymentStep, { type CardPaymentHandle } from './CardPaymentStep';

// Round-2 fixes brief, Part 5 — same row-shaping the store's opening hours
// already get elsewhere (see components/Visit.tsx's own formatHoursRows,
// which this mirrors exactly) so the pickup-info box below shows the same
// real per-day hours instead of a second, possibly-drifting copy of that
// logic.
function formatHoursRows(openingHours: OpeningHours, t: any) {
  if (!Array.isArray(openingHours)) return t.visit.fallbackRows;
  return openingHours.map((d) => ({
    label: t.visit.days[d.day] || d.day,
    value: d.closed ? t.visit.closed : `${d.open} – ${d.close}`,
  }));
}

const EMPTY: Customer = { name: '', address: '', postalCode: '', email: '', phone: '', notes: '' };

interface CustomerErrors {
  name?: string | null;
  address?: string | null;
  postalCode?: string | null;
  email?: string | null;
  phone?: string | null;
}

// Accepts +358401234567, 0401234567, +358 40 123 4567, 040-123-4567, etc.
function isValidFinnishPhone(raw: string) {
  const cleaned = raw.replace(/[\s-]/g, '');
  return /^(\+358[1-9]\d{6,9}|0[1-9]\d{6,9})$/.test(cleaned);
}

function StepIndicator({ step, stepLabels }: { step: number; stepLabels: string[] }) {
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
            {n < stepLabels.length && (
              <div className={`checkout-step-line${step > n ? ' done' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Round-2 fixes brief, Part 1 — `displayTotal` (fee-inclusive, once a
// delivery fee applies — see CheckoutModal's own computation) replaces
// the plain cart-item sum in both the collapsed head (so the customer
// sees what they'll actually be asked to pay before ever reaching the
// payment step) and, via `deliveryFee`, an extra row in the expanded
// body, right alongside the individual line items.
function MiniSummary({ cart, displayTotal, deliveryFee, t }: { cart: CartLine[]; displayTotal: number; deliveryFee: number; t: any }) {
  const [open, setOpen] = useState(false);
  const itemCount = cart.reduce((sum, l) => sum + l.qty, 0);
  return (
    <div className="mini-summary">
      <button type="button" className="mini-summary-head" onClick={() => setOpen((v) => !v)}>
        <span>{t.checkout.itemsCount(itemCount)}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <b>{displayTotal.toFixed(2)} €</b>
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
          {deliveryFee > 0 && (
            <div className="cs-row cs-fee-row">
              <span>{t.checkout.deliveryFeeRow}</span>
              <span>{deliveryFee.toFixed(2)} €</span>
            </div>
          )}
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
    firstOrderDiscount,
    activeScheduledOffer,
    // Round-2 fixes brief, Part 1 / Part 5 — real admin_settings-backed
    // delivery fee/minimum order, and the store's own address/hours for
    // the pickup-info box below (same three sources Visit.tsx already
    // reads from, see contactInfo/openingHours's own comments on
    // StoreContextValue).
    deliverySettings, contactInfo, openingHours, reorderOrderType,
  } = useStore();
  useBodyScrollLock(isCheckoutOpen);
  const t = useTranslations();
  const STEP_LABELS: string[] = [t.checkout.stepCart, t.checkout.stepDetails, t.checkout.stepPayment];

  const EXTRA_SECTIONS: Record<string, { label: string; items: Addon[] }> = {
    drinks: { label: t.checkout.allDrinks, items: drinks },
    dips: { label: t.checkout.dipsShortcut, items: dipCups },
    snacks: { label: t.checkout.snacks, items: snacks },
  };

  const [step, setStep] = useState(1);
  // Round-2 fixes brief, Part 5 — defaults to 'delivery', same default as
  // the order_type column and every server-side fallback, so a customer
  // who never touches this toggle gets exactly the behavior that always
  // existed before pickup did.
  const [orderType, setOrderType] = useState<OrderType>('delivery');
  // Round-2 fixes brief, Part 5 — applies StoreContext's one-shot
  // reorderOrderType handoff (see that field's own comment) to this
  // modal's local state. Only ever fires for a pickup reorder (the only
  // value that flag is ever set to) and only once per value change, so
  // manually switching back to delivery afterward in step 2 is never
  // overridden.
  useEffect(() => {
    if (reorderOrderType) setOrderType(reorderOrderType);
  }, [reorderOrderType]);
  const [customer, setCustomer] = useState<Customer>(EMPTY);
  const [errors, setErrors] = useState<CustomerErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  // Phase 7.6 — coupon code. `couponStatus` 'applied' is only ever an
  // advisory preview from /api/coupons/validate (see that route + the
  // shared lib/coupons.js logic it shares with app/api/orders/route.js) —
  // the real check happens again, from scratch, when the order is
  // actually submitted. If that later check disagrees (e.g. someone else
  // used the last remaining redemption in between), submitOrder's catch
  // below surfaces that as the normal order-error banner.
  const [couponInput, setCouponInput] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponStatus, setCouponStatus] = useState<'idle' | 'checking' | 'applied' | 'error'>('idle');
  const [couponError, setCouponError] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponFinalTotal, setCouponFinalTotal] = useState<number | null>(null);

  // Stripe card payments. `cardPayment` is set once POST /api/orders has
  // created the (still-unpaid) order and returned a clientSecret — while
  // it's set, step 3 shows CardPaymentStep instead of the payment-method
  // picker, and `finalize()` (closing the checkout / clearing the cart /
  // showing the confirmation screen) only runs once Stripe actually
  // confirms the charge, not when the order row was created.
  //
  // Audit-fixes brief, Part 1 — `orderNum`/`amount` added alongside the
  // original `clientSecret`/`finalize`: `amount` is the server's own
  // authoritative total at order-creation time (never recomputed from the
  // live cart afterwards — see payAmountLabel below), and `orderNum` is
  // what handleCancelPayment calls POST /api/orders/[orderNum]/cancel
  // with if the customer backs out instead of paying.
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'card'>('cod');
  const [cardPayment, setCardPayment] = useState<{ clientSecret: string; finalize: () => void; orderNum: string; amount: number } | null>(null);
  // Reported by CardPaymentStep via onStateChange — see that component's
  // header comment (Part 4). Drives the sticky-footer Pay button's
  // enabled/loading state now that the button itself lives in this file
  // rather than inside CardPaymentStep.
  const [cardPaymentState, setCardPaymentState] = useState<{ ready: boolean; submitting: boolean; error: string }>({ ready: false, submitting: false, error: '' });
  const cardPaymentRef = useRef<CardPaymentHandle>(null);
  const [cancellingPayment, setCancellingPayment] = useState(false);

  // Feature 2 — first-order welcome discount. `null` = not checked yet
  // (or the phone field isn't a valid number to check), `true`/`false` =
  // the last checked phone number's eligibility. This is purely advisory
  // for the banner below — POST /api/orders re-checks from scratch at
  // order-creation time and is the only check that actually matters (see
  // that route's comment), so a stale/wrong value here can never cause an
  // ineligible customer to actually get the discount, only show or hide
  // a banner incorrectly for a moment.
  const [firstOrderEligible, setFirstOrderEligible] = useState<boolean | null>(null);
  const checkedPhoneRef = useRef('');

  const checkFirstOrderEligibility = async (rawPhone: string) => {
    const cleaned = rawPhone.trim();
    if (!isValidFinnishPhone(cleaned) || checkedPhoneRef.current === cleaned) return;
    checkedPhoneRef.current = cleaned;
    try {
      const res = await fetch(`/api/checkout/first-order?phone=${encodeURIComponent(cleaned)}`);
      const data = (await res.json().catch(() => ({ eligible: false }))) as { eligible?: boolean };
      setFirstOrderEligible(Boolean(data.eligible));
    } catch {
      // Advisory only — leave the banner hidden rather than guessing.
      setFirstOrderEligible(null);
    }
  };

  // Growth features batch 2 (Feature 5) — "best banner" choice between
  // the welcome discount and an active scheduled offer, since the two
  // are mutually exclusive server-side (app/api/orders/route.ts applies
  // whichever is more favorable, never both) — this is purely about
  // which single banner to SHOW here; the server independently decides
  // and enforces the real discount at order-creation time regardless of
  // what this computes. Both discount settings are already known from
  // the menu blob before any API call, so this needs no extra request — unlike
  // firstOrderEligible, which only becomes known once the phone is
  // entered (see checkFirstOrderEligibility above), so the scheduled-
  // offer banner can show alone even before that.
  // Shared discount-value pattern — both settings can now independently
  // be a percent or a flat euro amount, so "most favorable" can no
  // longer compare raw percentages directly (10% vs. a flat 2€ isn't a
  // number-vs-number comparison) — same reasoning as
  // findBestActiveScheduledOffer's own baseAmount parameter. Compares
  // the ACTUAL euro amount each would come out to on this cart, mirroring
  // exactly what app/api/orders/route.ts's candidates[] comparison does
  // server-side, so this preview banner never disagrees with what the
  // server actually applies.
  const welcomeEligible = firstOrderEligible === true && firstOrderDiscount.value > 0;
  const welcomeAmount = welcomeEligible ? computeDiscountAmount(firstOrderDiscount, cartTotal) : 0;
  const scheduledOfferAmount = activeScheduledOffer ? computeDiscountAmount(activeScheduledOffer.discount, cartTotal) : 0;
  const bestAutoDiscount: { kind: 'welcome'; amountText: string } | { kind: 'scheduledOffer'; amountText: string; label: string } | null =
    welcomeEligible && welcomeAmount >= scheduledOfferAmount
      ? { kind: 'welcome', amountText: describeDiscountValue(firstOrderDiscount) }
      : scheduledOfferAmount > 0 && activeScheduledOffer
        ? { kind: 'scheduledOffer', amountText: describeDiscountValue(activeScheduledOffer.discount), label: activeScheduledOffer.label }
        : null;

  type HandleAddFn = ((item: Addon) => void) & { _t?: number };

  const handleAdd: HandleAddFn = (item) => {
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
    setFirstOrderEligible(null);
    checkedPhoneRef.current = '';
    setCardPayment(null);
    setCardPaymentState({ ready: false, submitting: false, error: '' });
    setPaymentMethod('cod');
    setOrderType('delivery');
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
      // res.json() resolves to `unknown` under real fetch typings — cast to
      // this endpoint's actual response shape (app/api/coupons/validate).
      const data = (await res.json().catch(() => ({ valid: false }))) as {
        valid: boolean;
        error?: string;
        code?: string;
        discountAmount?: number;
        finalTotal?: number;
      };
      if (!data.valid) {
        setCouponStatus('error');
        setCouponError(data.error || t.checkout.couponGenericError);
        return;
      }
      setCouponCode(data.code || '');
      setCouponDiscount(data.discountAmount ?? 0);
      setCouponFinalTotal(data.finalTotal ?? null);
      setCouponStatus('applied');
    } catch {
      setCouponStatus('error');
      setCouponError(t.checkout.couponNetworkError);
    }
  };

  const onField = (key: keyof Customer) => (e: ChangeEvent<HTMLInputElement>) => {
    setCustomer((c) => ({ ...c, [key]: e.target.value }));
    setErrors((er) => ({ ...(er as any), [key]: null }));
  };

  const validateDetails = () => {
    const next: CustomerErrors = {};
    if (!customer.name.trim()) next.name = t.checkout.errorName;
    // Round-2 fixes brief, Part 5 — a pickup order never collects an
    // address/postal code at all (the fields are hidden below), so there's
    // nothing to validate for either when orderType is 'pickup'. Mirrors
    // exactly what app/api/orders/route.ts's own conditional validation
    // does server-side.
    if (orderType === 'delivery') {
      if (!customer.address.trim()) next.address = t.checkout.errorAddress;
      if (!/^\d{5}$/.test(customer.postalCode.trim())) {
        next.postalCode = t.checkout.errorPostalCode;
      }
    }
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

  const submitDetails = (e: FormEvent) => {
    e.preventDefault();
    if (validateDetails()) setStep(3);
  };

  const submitOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setOrderError('');
    try {
      const result = await placeOrder(customer, couponStatus === 'applied' ? couponCode : undefined, paymentMethod, orderType);
      if (result.requiresPayment) {
        // Order row created, still unpaid — switch this step to show
        // CardPaymentStep instead of resetting; finalize() runs from
        // handleCardSuccess below, once Stripe actually confirms payment.
        setCardPayment({
          clientSecret: result.clientSecret,
          finalize: result.finalize,
          orderNum: result.orderNum,
          amount: result.amount,
        });
        return;
      }
      setStep(1);
      setCustomer(EMPTY);
      resetCoupon();
      setFirstOrderEligible(null);
      checkedPhoneRef.current = '';
      setPaymentMethod('cod');
      setOrderType('delivery');
    } catch (err: any) {
      setOrderError(err.message || t.checkout.genericOrderError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCardSuccess = () => {
    cardPayment?.finalize();
    setCardPayment(null);
    setCardPaymentState({ ready: false, submitting: false, error: '' });
    setStep(1);
    setCustomer(EMPTY);
    resetCoupon();
    setFirstOrderEligible(null);
    checkedPhoneRef.current = '';
    setPaymentMethod('cod');
    setOrderType('delivery');
  };

  // Audit-fixes brief, Part 1 — the explicit way out of a locked-in
  // pending card payment (see the pp-back button and cardPayment-branch
  // JSX below, both of which now refuse to just quietly step backward
  // while a PaymentIntent is open). Cancels the still-open PaymentIntent
  // and marks the order row 'cancelled' server-side (best-effort — see
  // that route's own comment for why a failure here still safely unblocks
  // the customer: submitOrder() always creates a brand-new order the next
  // time it runs, so an uncancelled leftover is a harmless, visibly-unpaid
  // row, never a double charge), then resets local state back to a clean
  // step 1 so the customer can freely edit the cart/address and try again.
  const handleCancelPayment = async () => {
    if (!cardPayment || cancellingPayment) return;
    setCancellingPayment(true);
    try {
      await fetch(`/api/orders/${encodeURIComponent(cardPayment.orderNum)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: customer.phone }),
      });
    } catch {
      // Best-effort — see this function's own comment above.
    } finally {
      setCancellingPayment(false);
      setCardPayment(null);
      setCardPaymentState({ ready: false, submitting: false, error: '' });
      setOrderError('');
      setStep(1);
    }
  };

  // Audit-fixes brief, Part 1 — while a card payment is pending, this is
  // the server's own authoritative amount from the moment the order/
  // PaymentIntent were created (cardPayment.amount), NEVER the live
  // cartTotal/couponFinalTotal below. Those two can still change under the
  // customer's feet even with back-navigation disabled in this modal — the
  // phone/browser back gesture is handled one level up, in
  // StoreContext.tsx's popstate listener, by simply hiding this whole
  // modal (not unmounting it, and not touching this component's own
  // `cardPayment` state), so the cart drawer underneath stays editable the
  // entire time a payment is pending. Freezing the displayed amount here
  // means that even in that case, what the customer sees they're about to
  // pay can never drift from what Stripe actually charges.
  // Round-2 fixes brief, Part 1 — the delivery fee only ever applies to a
  // delivery order (Part 5's coordination point with this part), is
  // added AFTER any discount (it's not itself discountable — mirrors
  // exactly how app/api/orders/route.ts will compute the real charge:
  // discount off the item subtotal first, fee added on top of that), and
  // is purely a DISPLAY preview here — the server independently re-reads
  // admin_settings.delivery_fee and enforces the real amount, never
  // trusting this value.
  const deliveryFee = orderType === 'delivery' ? deliverySettings.fee : 0;
  const preFeeTotal = couponStatus === 'applied' && couponFinalTotal !== null ? couponFinalTotal : cartTotal;
  const displayTotal = preFeeTotal + deliveryFee;
  // Minimum order only ever applies to delivery (a pickup customer isn't
  // asking the restaurant to send a driver, so there's no delivery cost
  // to protect a minimum against) — compared against the pre-discount,
  // pre-fee item subtotal, same value app/api/orders/route.ts's real
  // enforcement will compare against.
  const underMinimum = orderType === 'delivery' && deliverySettings.minimumOrder > 0 && cartTotal < deliverySettings.minimumOrder;
  const amountToMinimum = underMinimum ? deliverySettings.minimumOrder - cartTotal : 0;

  const payAmountLabel = cardPayment
    ? `${cardPayment.amount.toFixed(2)} €`
    : `${displayTotal.toFixed(2)} €`;

  // Round-2 fixes brief, Part 5 — real store address/hours for the
  // pickup-info box in step 2, same formatting Visit.tsx already uses.
  const storeHoursRows = formatHoursRows(openingHours, t);

  return (
    <div className={`checkout-page${isCheckoutOpen ? ' open' : ''}`}>
      <div className="pp-topbar">
        {/* Audit-fixes brief, Part 1 — disabled outright (not just relabeled)
            once a card PaymentIntent is pending: the explicit "Cancel and
            start over" button rendered alongside CardPaymentStep below is
            the only way out of that state now, so a customer can never
            silently step back to the address form and change it while this
            same already-created order/PaymentIntent is still what
            eventually gets charged. */}
        <button
          className="pp-back"
          type="button"
          aria-label={step > 1 ? t.checkout.backAriaLabel : t.checkout.closeAriaLabel}
          onClick={() => (step > 1 ? setStep(step - 1) : close())}
          disabled={Boolean(cardPayment)}
          aria-disabled={Boolean(cardPayment)}
          style={cardPayment ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
        >←</button>
        <span className="pp-topbar-title">{t.checkout.title}</span>
        <span style={{ width: 28 }} />
      </div>

      <div className="pp-scroll">
        <div className="wrap" style={{ paddingTop: 24, paddingBottom: 40 }}>
          <StepIndicator step={step} stepLabels={STEP_LABELS} />

          {/* Round-2 fixes brief, Part 4 (item 2) — `key={step}` forces
              React to mount a fresh element every time the step changes,
              which is what re-triggers .checkout-step-panel's fade-in
              animation (see app/globals.css) on every 1→2→3 transition. */}
          <div className="checkout-step-panel" key={step}>
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
                    <img src={l.image ?? undefined} alt={l.name} className="cs-thumb" />
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
                {/* Round-2 fixes brief, Part 1 — shown as soon as it's
                    known to apply. Before the customer reaches step 2,
                    orderType is still its 'delivery' default, so this
                    already reflects reality for the common case; it
                    updates instantly if they switch to pickup in step 2
                    (deliveryFee becomes 0, this row disappears). */}
                {deliveryFee > 0 && (
                  <div className="cs-row cs-fee-row">
                    <span>{t.checkout.deliveryFeeRow}</span>
                    <span>{deliveryFee.toFixed(2)} €</span>
                  </div>
                )}
                <div className="cs-total">
                  <span>{t.checkout.total}</span>
                  <span>{displayTotal.toFixed(2)} €</span>
                </div>
              </div>
              {underMinimum && (
                <p className="cs-min-notice">
                  {t.checkout.minOrderNotice(`${amountToMinimum.toFixed(2)} €`, `${deliverySettings.minimumOrder.toFixed(2)} €`)}
                </p>
              )}

              <p className="pp-label" style={{ marginTop: 24 }}>{t.checkout.coldDrink}</p>
              <div className="drink-upsell-row">
                {drinks.map((d) => {
                  const line = cart.find((l) => l.drinkId === d.id);
                  return (
                    <button type="button" className={`drink-tile${line ? ' in-cart' : ''}`} key={d.id} onClick={() => addDrinkToCart(d)}>
                      <img src={d.image ?? undefined} alt={d.name} />
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
                        <img key={it.id} src={it.image ?? undefined} alt="" />
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
              <MiniSummary cart={cart} displayTotal={displayTotal} deliveryFee={deliveryFee} t={t} />

              {/* Round-2 fixes brief, Part 5 — delivery/pickup choice.
                  Reuses the exact .payment-method/.pay-option/.pay-icon
                  CSS already powering the cash/card choice in step 3 (see
                  app/globals.css) — zero new CSS needed, just new icons. */}
              <div className="payment-method">
                <p>{t.checkout.orderTypeHeading}</p>
                <label className={`pay-option${orderType === 'delivery' ? ' selected' : ''}`}>
                  <span className="pay-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M3 12h13l-3-3m3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="18" cy="18" r="2" stroke="currentColor" strokeWidth="2" />
                      <circle cx="7" cy="18" r="2" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </span>
                  <span className="pay-option-text">
                    <b>{t.checkout.orderTypeDelivery}</b>
                    <span>{t.checkout.orderTypeDeliveryDesc}</span>
                  </span>
                  <input type="radio" name="orderType" value="delivery" checked={orderType === 'delivery'} onChange={() => setOrderType('delivery')} />
                </label>
                <label className={`pay-option${orderType === 'pickup' ? ' selected' : ''}`}>
                  <span className="pay-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 10.5 12 4l8 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M6 10v9h12v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M10 19v-5h4v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="pay-option-text">
                    <b>{t.checkout.orderTypePickup}</b>
                    <span>{t.checkout.orderTypePickupDesc}</span>
                  </span>
                  <input type="radio" name="orderType" value="pickup" checked={orderType === 'pickup'} onChange={() => setOrderType('pickup')} />
                </label>
              </div>

              <p className="desc" style={{ marginBottom: 16 }}>{t.checkout.orderDetails}</p>
              <label className={errors.name ? 'has-error' : ''}>
                {t.checkout.fullName}
                <input type="text" value={customer.name} onChange={onField('name')} />
                {errors.name && <span className="field-error">{errors.name}</span>}
              </label>
              {/* Round-2 fixes brief, Part 5 — a pickup order needs no
                  address/postal code at all; hidden entirely rather than
                  just disabled, matching how validateDetails() above skips
                  them outright for this orderType. Replaced with a small
                  real-data box showing where and when to actually come. */}
              {orderType === 'delivery' ? (
                <>
                  <label className={errors.address ? 'has-error' : ''}>
                    {t.checkout.deliveryAddress}
                    <input type="text" value={customer.address} onChange={onField('address')} placeholder={t.checkout.deliveryAddressPlaceholder} />
                    {errors.address && <span className="field-error">{errors.address}</span>}
                  </label>
                  <label className={errors.postalCode ? 'has-error' : ''}>
                    {t.checkout.postalCode}
                    <input type="text" inputMode="numeric" maxLength={5} value={customer.postalCode} onChange={onField('postalCode')} placeholder={t.checkout.postalCodePlaceholder} />
                    {errors.postalCode && <span className="field-error">{errors.postalCode}</span>}
                  </label>
                </>
              ) : (
                <div className="checkout-store-info">
                  <h4>{t.checkout.pickupInfoHeading}</h4>
                  <p className="csi-address">{t.checkout.pickupInfoIntro} {contactInfo.address || t.visit.notSet}</p>
                  {storeHoursRows.map((r: { label: string; value: string }) => (
                    <div className="hours-row" key={r.label}><span>{r.label}</span><span>{r.value}</span></div>
                  ))}
                </div>
              )}
              <label className={errors.email ? 'has-error' : ''}>
                {t.checkout.emailOptional}
                <input type="email" value={customer.email} onChange={onField('email')} placeholder={t.checkout.emailPlaceholder} />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </label>
              <label className={errors.phone ? 'has-error' : ''}>
                {t.checkout.phone}
                <input
                  type="tel"
                  value={customer.phone}
                  onChange={onField('phone')}
                  onBlur={() => checkFirstOrderEligibility(customer.phone)}
                  placeholder={t.checkout.phonePlaceholder}
                />
                {errors.phone && <span className="field-error">{errors.phone}</span>}
              </label>
              {/* Feature 2 / Feature 5 — welcome discount or scheduled
                  offer, whichever is more favorable (see
                  bestAutoDiscount above). Advisory only — the discount
                  itself is applied and re-checked server-side regardless
                  of whether this banner ever renders. */}
              {bestAutoDiscount && (
                <p className="cs-discount-banner">
                  {bestAutoDiscount.kind === 'welcome'
                    ? t.checkout.welcomeDiscountBanner(bestAutoDiscount.amountText)
                    : t.checkout.scheduledOfferBanner(bestAutoDiscount.label, bestAutoDiscount.amountText)}
                </p>
              )}
              <label>
                {t.checkout.additionalInfo}
                <input type="text" value={customer.notes} onChange={onField('notes')} placeholder={t.checkout.additionalInfoPlaceholder} />
              </label>
            </form>
          )}

          {step === 3 && (
            <form id="paymentForm" onSubmit={submitOrder}>
              <MiniSummary cart={cart} displayTotal={displayTotal} deliveryFee={deliveryFee} t={t} />

              {cardPayment ? (
                // Order row already created (payment_status 'pending') —
                // this is purely about collecting the charge now. The
                // payment-method/coupon UI below is intentionally hidden
                // here: switching either would no longer match the order
                // that's already been created server-side.
                <div style={{ marginTop: 16 }}>
                  <p className="desc" style={{ marginBottom: 16 }}>{t.checkout.paymentLockedNotice}</p>
                  <CardPaymentStep
                    ref={cardPaymentRef}
                    clientSecret={cardPayment.clientSecret}
                    onSuccess={handleCardSuccess}
                    onStateChange={setCardPaymentState}
                    t={t}
                  />
                  {/* Audit-fixes brief, Part 1 — the one explicit way to
                      back out of a pending card payment; see
                      handleCancelPayment's own comment. */}
                  <button
                    type="button"
                    onClick={handleCancelPayment}
                    disabled={cancellingPayment}
                    style={{
                      marginTop: 16, background: 'none', border: 'none', textDecoration: 'underline',
                      cursor: cancellingPayment ? 'default' : 'pointer', fontSize: 13, color: 'var(--muted)', padding: 0,
                    }}
                  >
                    {cancellingPayment ? t.checkout.cancellingPayment : t.checkout.cancelPaymentAction}
                  </button>
                </div>
              ) : (
                <>
                  {bestAutoDiscount && couponStatus !== 'applied' && (
                    <p className="cs-discount-banner">
                      {bestAutoDiscount.kind === 'welcome'
                        ? t.checkout.welcomeDiscountBanner(bestAutoDiscount.amountText)
                        : t.checkout.scheduledOfferBanner(bestAutoDiscount.label, bestAutoDiscount.amountText)}
                    </p>
                  )}

                  <div className="cs-coupon-block">
                    {couponStatus === 'applied' ? (
                      <div className="cs-coupon-applied">
                        <span>🏷️ {t.checkout.couponApplied(couponCode, `${couponDiscount.toFixed(2)} €`)}</span>
                        <button type="button" onClick={resetCoupon} className="cs-coupon-remove">
                          {t.checkout.couponRemove}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="cs-coupon-input-row">
                          <input
                            type="text"
                            placeholder={t.checkout.couponPlaceholder}
                            value={couponInput}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => { setCouponInput(e.target.value); if (couponStatus === 'error') setCouponStatus('idle'); }}
                          />
                          <button
                            type="button"
                            className="btn-primary cs-coupon-apply-btn"
                            disabled={!couponInput.trim() || couponStatus === 'checking'}
                            onClick={applyCoupon}
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
                    {/* Audit-fixes brief, Part 6.3 — 💵/💳 replaced with plain
                        inline SVGs (no icon library added): an emoji glyph
                        renders very differently across platforms (a literal
                        yellow banknote vs. a plain dollar-bill outline vs. a
                        generic symbol depending on OS/browser emoji font),
                        so "recognizable" wasn't guaranteed the way a
                        consistent vector icon is. .pay-icon's own existing
                        circle background + `color` (var(--muted), inverted
                        to var(--text-on-accent) when selected) already
                        apply automatically here via currentColor. */}
                    <label className={`pay-option${paymentMethod === 'cod' ? ' selected' : ''}`}>
                      <span className="pay-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
                          <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="2" />
                        </svg>
                      </span>
                      <span className="pay-option-text">
                        <b>{t.checkout.cod}</b>
                        <span>{t.checkout.codDesc}</span>
                      </span>
                      <input type="radio" name="payment" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
                    </label>
                    <label className={`pay-option${paymentMethod === 'card' ? ' selected' : ''}`}>
                      <span className="pay-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                          <path d="M2 10h20" stroke="currentColor" strokeWidth="2" />
                        </svg>
                      </span>
                      <span className="pay-option-text">
                        <b>{t.checkout.card}</b>
                        <span>{t.checkout.cardDesc}</span>
                      </span>
                      <input type="radio" name="payment" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} />
                    </label>
                  </div>

                  {orderError && <p className="field-error" style={{ marginTop: 12 }}>{orderError}</p>}
                </>
              )}
            </form>
          )}
          </div>
        </div>
      </div>

      {step === 1 && cart.length > 0 && (
        <div className="checkout-footer">
          <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={() => setStep(2)}>
            {t.checkout.continueWithTotal(`${displayTotal.toFixed(2)} €`)}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="checkout-footer">
          <button type="submit" form="checkoutForm" className="btn-primary" style={{ flex: 1 }}>{t.checkout.continue}</button>
        </div>
      )}

      {step === 3 && !cardPayment && (
        <div className="checkout-footer">
          <button
            type="submit"
            form="paymentForm"
            className={`btn-primary${submitting ? ' is-loading' : ''}`}
            style={{ flex: 1 }}
            disabled={submitting}
          >
            {t.checkout.placeOrder(payAmountLabel)}
          </button>
        </div>
      )}

      {/* Audit-fixes brief, Part 4 — this footer now stays mounted once a
          card payment is pending too (previously gated off entirely by
          `!cardPayment`), and is the ONLY "Pay" button rendered anywhere
          while a card payment is in progress — CardPaymentStep itself no
          longer renders one (see that component's header comment for why:
          its own inline button, at the bottom of the scrolling
          PaymentElement content, could get pushed off-screen by Stripe's
          form plus the mobile keyboard). Triggers the exact same submit
          path CardPaymentStep used to run internally, via the imperative
          `pay()` handle on cardPaymentRef. */}
      {step === 3 && cardPayment && (
        <div className="checkout-footer">
          <button
            type="button"
            className={`btn-primary${cardPaymentState.submitting ? ' is-loading' : ''}`}
            style={{ flex: 1 }}
            disabled={!cardPaymentState.ready || cardPaymentState.submitting}
            onClick={() => cardPaymentRef.current?.pay()}
          >
            {t.checkout.placeOrder(payAmountLabel)}
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
                        onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter' || e.key === ' ') handleAdd(item); }}
                      >
                        <img src={item.image ?? undefined} alt={item.name} />
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
