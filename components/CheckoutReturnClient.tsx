'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { StoreProvider } from '@/context/StoreContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import OrderConfirmationCard from '@/components/OrderConfirmationCard';
import { useTranslations, useLocalePath } from '@/lib/i18n';
import { getStripePromise, stripePublishableKey } from '@/lib/stripe-client';

// Part B (Stripe return_url / redirect handling) — what actually happens
// when a customer lands back here after a redirect-based confirmPayment().
// Stripe appends its own query params to the return_url we gave it
// (payment_intent, payment_intent_client_secret, redirect_status) — see
// components/CardPaymentStep.tsx. A full page reload happened to get here,
// so nothing from the in-memory checkout (cart, customer, discount/loyalty
// data) survives; this reads ONLY what Stripe's own PaymentIntent can tell
// us via stripe.retrievePaymentIntent(clientSecret) — the real, source-of-
// truth outcome (succeeded/processing/failed), not an assumption that
// landing here at all means success.
type Outcome =
  | { kind: 'checking' }
  | { kind: 'missing' } // no Stripe params at all — not a real redirect return
  | { kind: 'success'; orderNum: string; total: number }
  | { kind: 'successNoOrderNum'; total: number }
  | { kind: 'processing' }
  | { kind: 'failed' }
  | { kind: 'error' };

function readOrderNum(metadata: unknown): string {
  if (metadata && typeof metadata === 'object' && 'orderNum' in metadata) {
    const raw = (metadata as Record<string, unknown>).orderNum;
    if (typeof raw === 'string' && raw) return raw;
  }
  return '';
}

export default function CheckoutReturnClient() {
  const t = useTranslations();
  const lp = useLocalePath();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'checking' });

  useEffect(() => {
    const clientSecret = searchParams.get('payment_intent_client_secret');

    // No Stripe params at all — this page was opened directly rather than
    // as an actual redirect return (bookmarked, refreshed after Stripe's
    // own params were already consumed once, a stray crawler hit, etc.).
    // Nothing to check; send the visitor somewhere real instead of showing
    // a payment-status page with no payment to report on.
    if (!clientSecret) {
      setOutcome({ kind: 'missing' });
      return;
    }

    if (!stripePublishableKey) {
      setOutcome({ kind: 'error' });
      return;
    }

    let cancelled = false;

    (async () => {
      const stripe = await getStripePromise();
      if (cancelled) return;
      if (!stripe) {
        setOutcome({ kind: 'error' });
        return;
      }

      const { paymentIntent, error } = await stripe.retrievePaymentIntent(clientSecret);
      if (cancelled) return;

      if (error || !paymentIntent) {
        setOutcome({ kind: 'error' });
        return;
      }

      if (paymentIntent.status === 'succeeded') {
        const orderNum = readOrderNum(paymentIntent.metadata);
        if (orderNum) {
          setOutcome({ kind: 'success', orderNum: `#${orderNum}`, total: paymentIntent.amount / 100 });
        } else {
          // Shouldn't normally happen — app/api/orders/route.ts always sets
          // metadata.orderNum on the PaymentIntent it creates — but don't
          // claim an order number we don't actually have.
          setOutcome({ kind: 'successNoOrderNum', total: paymentIntent.amount / 100 });
        }
        return;
      }

      if (paymentIntent.status === 'processing') {
        setOutcome({ kind: 'processing' });
        return;
      }

      // requires_payment_method, requires_action (rare to still see this
      // here), canceled, etc. — Stripe is telling us this payment did not
      // succeed. Don't show anything success-shaped.
      setOutcome({ kind: 'failed' });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (outcome.kind === 'missing') {
      router.replace(lp('/menu'));
    }
  }, [outcome.kind, router, lp]);

  const goToMenu = () => router.push(lp('/menu'));

  return (
    <StoreProvider>
      <Header />
      <main className="wrap" style={{ padding: '60px 24px', display: 'flex', justifyContent: 'center' }}>
        <div className="modal-box" style={{ maxWidth: 460, width: '100%' }}>
          {(outcome.kind === 'checking' || outcome.kind === 'missing') && (
            <div className="confirm-box">
              <p className="eyebrow" style={{ marginBottom: 6 }}>{t.checkoutReturn.checkingTitle}</p>
              <p>{t.checkoutReturn.checkingMessage}</p>
            </div>
          )}

          {outcome.kind === 'success' && (
            <OrderConfirmationCard
              orderNum={outcome.orderNum}
              total={outcome.total}
              paymentMethod="card"
              onDismiss={goToMenu}
              dismissLabel={t.checkoutReturn.backToMenu}
            />
          )}

          {outcome.kind === 'successNoOrderNum' && (
            <div className="confirm-box">
              <div className="confirm-check">✓</div>
              <p className="eyebrow" style={{ marginBottom: 6 }}>{t.confirm.eyebrow}</p>
              <p>{t.checkoutReturn.successNoOrderNumMessage}</p>
              <div className="cod-note">
                <span style={{ fontSize: '1.3rem' }}>✅</span>
                <span>{t.confirm.cardPaidNote(`${outcome.total.toFixed(2)} €`)}</span>
              </div>
              <button type="button" className="btn-primary" onClick={goToMenu}>
                {t.checkoutReturn.backToMenu}
              </button>
            </div>
          )}

          {outcome.kind === 'processing' && (
            <div className="confirm-box">
              <p className="eyebrow" style={{ marginBottom: 6 }}>{t.checkoutReturn.processingTitle}</p>
              <p>{t.checkoutReturn.processingMessage}</p>
              <button type="button" className="btn-primary" onClick={goToMenu}>
                {t.checkoutReturn.backToMenu}
              </button>
            </div>
          )}

          {outcome.kind === 'failed' && (
            <div className="confirm-box">
              <p className="eyebrow" style={{ marginBottom: 6 }}>{t.checkoutReturn.failedTitle}</p>
              <p>{t.checkoutReturn.failedMessage}</p>
              <button type="button" className="btn-primary" onClick={goToMenu}>
                {t.checkoutReturn.backToMenu}
              </button>
            </div>
          )}

          {outcome.kind === 'error' && (
            <div className="confirm-box">
              <p className="eyebrow" style={{ marginBottom: 6 }}>{t.checkoutReturn.errorTitle}</p>
              <p>{t.checkoutReturn.errorMessage}</p>
              <button type="button" className="btn-primary" onClick={goToMenu}>
                {t.checkoutReturn.backToMenu}
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </StoreProvider>
  );
}
