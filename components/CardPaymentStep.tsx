'use client';

import { useState } from 'react';
import { loadStripe, type Stripe as StripeJs } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

// Loaded once per page (module scope, not per-render) — loadStripe caches
// the script/instance itself anyway, but this avoids re-triggering that
// on every CheckoutModal re-render.
let stripePromise: Promise<StripeJs | null> | null = null;
function getStripePromise() {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripePromise;
}

interface CardPaymentStepProps {
  clientSecret: string;
  amountLabel: string; // pre-formatted "12.50 €", same convention as the rest of CheckoutModal.
  onSuccess: () => void;
  t: any;
}

function PayButton({ amountLabel, onSuccess, t }: Omit<CardPaymentStepProps, 'clientSecret'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handlePay = async () => {
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    setError('');

    // redirect: 'if_required' — Stripe only navigates away when the
    // chosen method genuinely needs it (some bank redirect methods);
    // card / Google Pay / Apple Pay (the only methods enabled server-side
    // — see app/api/orders/route.ts's automatic_payment_methods) resolve
    // in place, including any 3-D Secure challenge, which Stripe.js shows
    // as an in-page modal, not a redirect.
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message || t.checkout.cardGenericError);
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      onSuccess();
      return;
    }

    // requires_action/processing etc. without an error — rare with
    // redirect: 'if_required', but don't claim success if Stripe hasn't.
    setError(t.checkout.cardGenericError);
    setSubmitting(false);
  };

  return (
    <div>
      <PaymentElement />
      {error && <p className="field-error" style={{ marginTop: 12 }}>{error}</p>}
      <button
        type="button"
        className={`btn-primary${submitting ? ' is-loading' : ''}`}
        style={{ width: '100%', marginTop: 16 }}
        disabled={!stripe || submitting}
        onClick={handlePay}
      >
        {t.checkout.placeOrder(amountLabel)}
      </button>
    </div>
  );
}

export default function CardPaymentStep({ clientSecret, amountLabel, onSuccess, t }: CardPaymentStepProps) {
  return (
    <Elements
      stripe={getStripePromise()}
      options={{ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#7D5A16' } } }}
    >
      <PayButton amountLabel={amountLabel} onSuccess={onSuccess} t={t} />
    </Elements>
  );
}
