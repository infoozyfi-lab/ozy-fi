'use client';

// Shared CLIENT-side Stripe.js loader (publishable key only — never the
// secret key, that's lib/stripe.ts, server-only). Previously this was a
// module-private copy inside components/CardPaymentStep.tsx; Part B (Stripe
// return_url / redirect handling) needs the exact same loaded Stripe
// instance from a second place — the new /checkout-return landing page,
// which calls stripe.retrievePaymentIntent() after a redirect-based payment
// method sends the customer back here — so this is now the one shared
// copy both import, instead of each keeping its own stripePromise cache
// (which would double-load the Stripe.js script if both were ever mounted,
// and just duplicates logic for no reason otherwise).
//
// NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is inlined into the client bundle at
// `next build` time (see cloudflare-env.d.ts). Missing here is a deploy-time
// misconfiguration, not something a reload fixes — callers should check
// stripePublishableKey themselves and render a visible error instead of
// silently mounting a dead Stripe instance (same convention
// CardPaymentStep.tsx already followed before this file existed).
import { loadStripe, type Stripe as StripeJs } from '@stripe/stripe-js';

export const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

let stripePromise: Promise<StripeJs | null> | null = null;

// No explicit return type annotation — same as the original inline version
// of this function (components/CardPaymentStep.tsx, before this file
// existed): letting it infer keeps this identical to that already-working
// pattern rather than risking a mismatch between an explicit annotation and
// what a missing `@stripe/stripe-js` type declaration resolves to in this
// sandbox (no node_modules here to check against directly).
export function getStripePromise() {
  if (!stripePromise) {
    stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : Promise.resolve(null);
  }
  return stripePromise;
}
