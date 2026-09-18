'use client';

import { useEffect, useRef, useState } from 'react';
import type { StripeError } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { useLocalePath } from '@/lib/i18n';
import { stripePublishableKey as stripeKey, getStripePromise } from '@/lib/stripe-client';

// How long we give Stripe's own PaymentElement skeleton to finish loading
// before treating it as failed even without an explicit loaderror event
// (see the ELEMENT_LOAD_TIMEOUT_MS usage below for why that backstop is
// needed). Normal load is under 2s; this is deliberately generous so a
// slow connection doesn't get falsely flagged.
const ELEMENT_LOAD_TIMEOUT_MS = 12000;

// stripeKey/getStripePromise now come from lib/stripe-client.ts (Part B —
// shared with the new /checkout-return landing page, see that file's
// header comment). Behavior is unchanged: still one loadStripe() call per
// page, still a visible error below instead of a silently-dead Elements
// provider when the publishable key is missing.

interface CardPaymentStepProps {
  clientSecret: string;
  amountLabel: string; // pre-formatted "12.50 €", same convention as the rest of CheckoutModal.
  onSuccess: () => void;
  t: any;
}

function PayButton({ amountLabel, onSuccess, t }: Omit<CardPaymentStepProps, 'clientSecret'>) {
  const stripe = useStripe();
  const elements = useElements();
  const lp = useLocalePath();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Previously nothing watched whether Stripe's own PaymentElement skeleton
  // ever actually finished loading — if it hung (see CardPaymentStep's own
  // comment below for the leading theory of why), the customer was stuck
  // looking at Stripe's built-in spinner forever with no way for our code
  // to know or say anything about it. onReady/onLoadError are the
  // PaymentElement's own lifecycle callbacks (confirmed against Stripe's
  // current docs: https://docs.stripe.com/js/react_stripe_js/elements/
  // payment_element — "onLoadError: Callback called when the Element
  // fails to load"). The timeout below is a backstop for a hang that
  // never fires loaderror at all (e.g. a request that never completes
  // rather than one that fails outright).
  const [elementLoad, setElementLoad] = useState<'loading' | 'ready' | 'failed'>('loading');
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadTimeoutRef.current = setTimeout(() => {
      setElementLoad((current: 'loading' | 'ready' | 'failed') => {
        if (current === 'loading') {
          // eslint-disable-next-line no-console
          console.error(
            '[CardPaymentStep] PaymentElement never fired onReady or onLoadError within',
            ELEMENT_LOAD_TIMEOUT_MS,
            'ms — treating as failed. No Stripe-reported error, so check the network tab for a hung request to js.stripe.com/api.stripe.com.'
          );
          return 'failed';
        }
        return current;
      });
    }, ELEMENT_LOAD_TIMEOUT_MS);
    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, []);

  const clearLoadTimeout = () => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  };

  if (elementLoad === 'failed') {
    // Customer-facing message stays generic and actionable (fall back to
    // cash on delivery) — the specific Stripe error, when there is one,
    // goes to the console via onLoadError below, not to the customer.
    return (
      <div>
        <p className="field-error">{t.checkout.cardUnavailableError}</p>
      </div>
    );
  }

  const handlePay = async () => {
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    setError('');

    // redirect: 'if_required' — Stripe only navigates away when the
    // chosen method genuinely needs it (some bank redirect methods);
    // card / Google Pay / Apple Pay (the only methods enabled server-side
    // — see app/api/orders/route.ts's automatic_payment_methods) resolve
    // in place, including any 3-D Secure challenge, which Stripe.js shows
    // as an in-page modal, not a redirect — MOST of the time. This project
    // has observed Google Pay/Apple Pay occasionally hit this path on
    // mobile anyway, and Stripe's own API requires confirmParams.return_url
    // even with redirect: 'if_required', as the destination for those
    // unpredictable cases (Stripe throws an integration error without one —
    // this was previously missing entirely). A full page reload happens on
    // an actual redirect, so any in-memory state here (this whole
    // CheckoutModal) is lost; /checkout-return (Part B) is what picks the
    // customer back up on the other side, using the same clientSecret via
    // Stripe's own appended query params.
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: `${window.location.origin}${lp('/checkout-return')}`,
      },
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
      <PaymentElement
        onReady={() => {
          clearLoadTimeout();
          setElementLoad('ready');
        }}
        onLoadError={(event: { elementType: 'payment'; error: StripeError }) => {
          clearLoadTimeout();
          // eslint-disable-next-line no-console
          console.error('[CardPaymentStep] PaymentElement onLoadError:', event.error);
          setElementLoad('failed');
        }}
      />
      {error && <p className="field-error" style={{ marginTop: 12 }}>{error}</p>}
      <button
        type="button"
        className={`btn-primary${submitting ? ' is-loading' : ''}`}
        style={{ width: '100%', marginTop: 16 }}
        disabled={!stripe || elementLoad !== 'ready' || submitting}
        onClick={handlePay}
      >
        {t.checkout.placeOrder(amountLabel)}
      </button>
    </div>
  );
}

export default function CardPaymentStep({ clientSecret, amountLabel, onSuccess, t }: CardPaymentStepProps) {
  // Leading theory for "PaymentElement's own spinner never resolves" (as
  // opposed to the earlier "nothing renders at all" bug, which was the
  // missing-key case above): `clientSecret` comes from a PaymentIntent
  // created server-side with STRIPE_SECRET_KEY (lib/stripe.ts, read from
  // the Cloudflare dashboard's runtime Variables and Secrets — correct
  // panel for that one, see cloudflare-env.d.ts), while this component
  // loads Stripe.js with NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY. Both values
  // are configured independently, in different dashboard panels even
  // (one Build-only, one runtime-only) — nothing enforces that they
  // belong to the same Stripe account AND the same mode (test vs live).
  // If STRIPE_SECRET_KEY is a test-mode key (`sk_test_...`) while
  // NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is the confirmed-live
  // `pk_live_...` key (or vice versa), the PaymentIntent this
  // clientSecret refers to simply doesn't exist from the client's point
  // of view — Stripe.js can hang trying to resolve it rather than
  // failing outright. Not confirmed from here (STRIPE_SECRET_KEY's value
  // isn't visible in this codebase, by design — it's a Secret), but the
  // fastest way to check: Cloudflare dashboard → Worker → Settings →
  // Variables and Secrets → STRIPE_SECRET_KEY's value should start with
  // `sk_live_`, not `sk_test_`, to match the confirmed-live publishable
  // key. onLoadError below will also now log the real Stripe-reported
  // reason to the browser console the next time this happens, which
  // settles it definitively either way.
  //
  // Fail loud: previously, a missing key silently produced a `null` Stripe
  // instance and an inert Elements/PaymentElement — "nothing visibly
  // happens" when the customer picks Card. Surface it instead, so the
  // customer isn't stuck on a blank step and can fall back to
  // cash-on-delivery.
  if (!stripeKey) {
    return (
      <div>
        <p className="field-error">{t.checkout.cardUnavailableError}</p>
      </div>
    );
  }

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
