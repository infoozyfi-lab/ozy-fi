import Stripe from 'stripe';

// One place to construct the Stripe client from the Cloudflare Worker's
// env bindings (STRIPE_SECRET_KEY — a Secret set via the Cloudflare
// dashboard, see cloudflare-env.d.ts) instead of each route re-reading
// process.env, which OpenNext/Workers doesn't populate the same way
// Node does.
//
// fetch-based HTTP client + no Node crypto — required for Stripe's SDK to
// work inside the Workers runtime (see
// https://github.com/stripe/stripe-node#workers). apiVersion is pinned so
// a future Stripe dashboard default-version bump can't silently change
// this app's request/response shapes.
export function getStripe(env: CloudflareEnv): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  });
}
