// Bridges @opennextjs/cloudflare's `getCloudflareContext()` env type to the
// real bindings declared in `worker-configuration.d.ts` (generated locally by
// `npx wrangler types` from wrangler.jsonc — gitignored/regenerated per
// machine, not part of this delivery).
//
// @opennextjs/cloudflare types `getCloudflareContext()`'s `env` as a global
// `CloudflareEnv` interface that ships EMPTY from the package itself — it's
// meant to be filled in by the consuming project via declaration merging.
// Without this file, `CloudflareEnv` never picks up the `DB`/`IMAGES`/`ASSETS`
// bindings that `wrangler types` puts on the generated `Env` interface, so
// every `env.DB`/`env.IMAGES`/`env.ASSETS` access across the app fails to
// type-check even though the bindings genuinely exist at runtime.
//
// This is the fix documented by @opennextjs/cloudflare itself (see
// https://opennext.js.org/cloudflare/get-started — "Add the generated
// bindings to CloudflareEnv"). It must stay a global ambient declaration
// (no top-level import/export) so `interface` here merges with the package's
// own global `CloudflareEnv`, not shadow it as a module-local type.
interface CloudflareEnv extends Env {
  // Secrets set via `wrangler secret put` — none of these are declared
  // under wrangler.jsonc's bindings (that's normal; secrets usually aren't),
  // so `wrangler types` never picks any of them up on `Env`/`Cloudflare.Env`.
  // (Round 3 guessed SESSION_SECRET was already covered via `.dev.vars`
  // scanning — round 4's real tsc run shows that guess was wrong; it needs
  // declaring here too, same as the other two.) Declared here by hand.
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;

  // Stripe — set via the Cloudflare dashboard (Workers & Pages → ozyfi →
  // Settings → Variables and Secrets), same pattern as the three above.
  // STRIPE_SECRET_KEY is a Secret (encrypted); NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  // is a plain Variable — it's public by design (used client-side to load
  // Stripe.js) and the NEXT_PUBLIC_ prefix is what lets Next.js inline it
  // into the client bundle at build time. STRIPE_WEBHOOK_SECRET verifies
  // that POST /api/webhooks/stripe requests genuinely came from Stripe
  // (see that route) — get it from the webhook endpoint's settings page
  // in the Stripe Dashboard once the endpoint is created there.
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string;

  // wrangler.jsonc correctly declares IMAGES under r2_buckets (bucket_name
  // "ozyfi-images") — but the generated Env interface inferred it as a
  // Cloudflare Images product binding instead of a real R2Bucket, so
  // app/api/admin/upload/route.ts's `.put()` and app/images/[...key]/
  // route.ts's `.get()`/`.writeHttpMetadata()`/`.httpEtag`/`.body` (all
  // real R2Bucket/R2Object API) didn't type-check. Overridden here to the
  // real binding type instead of re-running `wrangler types` per machine.
  IMAGES: R2Bucket;
}
