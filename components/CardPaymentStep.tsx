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
      options={{
        clientSecret,
        // Daylight Ember tokens (app/globals.css) — colorPrimary drives
        // Stripe's own focus rings/selected-tab styling inside
        // PaymentElement, colorText/colorTextPlaceholder/colorDanger match
        // this app's body-text/muted/danger colors so the embedded iframe
        // reads as part of this page rather than a foreign widget dropped
        // into it. Literal hex, not var(...) — Stripe's Elements
        // `appearance` API reads these values itself (in an iframe, where
        // CSS custom properties from the host page don't apply), so the
        // current token values are duplicated here rather than referenced.
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#C14815', // --ember-dark
            colorText: '#231D19', // --cream
            colorTextPlaceholder: '#756B5F', // --muted
            colorDanger: '#B3261E', // --danger
            fontFamily: "'Work Sans', Arial, sans-serif",
            borderRadius: '8px',
          },
        },
      }}
    >
      <PayButton amountLabel={amountLabel} onSuccess={onSuccess} t={t} />
    </Elements>
  );
}
