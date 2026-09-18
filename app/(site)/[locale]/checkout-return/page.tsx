import { Suspense } from 'react';
import CheckoutReturnClient from '@/components/CheckoutReturnClient';
import { getDictionary, hreflangAlternates } from '@/lib/i18n/locales';

// Part B (Stripe return_url / redirect handling) — the page Stripe's
// return_url (see components/CardPaymentStep.tsx) points at for the
// (uncommon but real, per this project's own observation of Google
// Pay/Apple Pay on mobile) case where confirmPayment genuinely redirects
// instead of resolving in-page. Same thin Server-Component-wrapper +
// Client-Component-child split as app/(site)/[locale]/track/page.tsx
// (generateMetadata needs a Server Component; the actual page reads
// Stripe's appended query params and calls stripe.retrievePaymentIntent,
// both client-only).
//
// force-dynamic: this page's whole purpose is reading per-visit query
// params Stripe appends on redirect — there is nothing here to statically
// prerender, and it should never serve a cached response to a different
// visitor's payment_intent_client_secret.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const title = `${t.checkoutReturn.checkingTitle} — ozy.fi`;

  return {
    title,
    // Deliberately no descriptive `description` beyond the dictionary —
    // this page only ever exists mid-payment-redirect, it's not content
    // anyone should land on from search, so it's also excluded from
    // indexing below.
    robots: { index: false, follow: false },
    alternates: {
      canonical: `/${locale}/checkout-return`,
      languages: hreflangAlternates('/checkout-return'),
    },
  };
}

export default function CheckoutReturnPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutReturnClient />
    </Suspense>
  );
}
