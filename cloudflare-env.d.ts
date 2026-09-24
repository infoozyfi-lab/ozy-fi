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

  // Stripe (server-side, runtime only) — set via the Cloudflare dashboard
  // under the Worker's Settings → Variables and Secrets, same pattern as
  // the three above. Both are read through `env.X` inside a request
  // handler (lib/stripe.ts, app/api/webhooks/stripe/route.ts), which is
  // exactly what that panel is for. STRIPE_SECRET_KEY is a Secret
  // (encrypted); STRIPE_WEBHOOK_SECRET verifies that POST /api/webhooks/
  // stripe requests genuinely came from Stripe (see that route) — get it
  // from the webhook endpoint's settings page in the Stripe Dashboard
  // once the endpoint is created there.
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;

  // Priority-fixes brief (roadmap gap analysis), Bundle 1 Task 1 — email
  // notifications (lib/email.ts). Same pattern as the Stripe secrets
  // above: set via the Cloudflare dashboard's Worker → Settings →
  // Variables and Secrets panel, read through `env.X` at request time.
  // RESEND_API_KEY is a Secret (encrypted) from Resend's dashboard
  // (resend.com/api-keys). EMAIL_FROM is optional plain text — a verified
  // sender address/name for the Resend domain the business owner sets up
  // (e.g. "ozy.fi <orders@ozy.fi>"); lib/email.ts falls back to a
  // placeholder default if it's left unset, which will fail to actually
  // send until a real verified domain is configured in Resend.
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;

  // NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is DELIBERATELY NOT declared here.
  // Despite living in "the same env vars area" conceptually, it does not
  // go through this CloudflareEnv/`env.X` runtime binding mechanism at
  // all — components/CardPaymentStep.tsx reads it as
  // `process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, a plain build-time
  // constant Next.js inlines into the CLIENT bundle while `next build`
  // runs, before the Worker ever starts serving requests.
  //
  // This is the one Stripe var that must be set under the Worker's
  // Settings → Build → "Build variables and secrets" panel, NOT
  // Settings → Variables and Secrets (that one only reaches `env.X` at
  // runtime — Workers Builds' build step runs in a separate environment
  // and never sees it — see https://developers.cloudflare.com/workers/
  // ci-cd/builds/configuration/ and https://opennext.js.org/cloudflare/
  // howtos/env-vars, both of which document this split explicitly). An
  // earlier version of this comment conflated the two panels and told
  // the Cloudflare dashboard's runtime-only "Variables and Secrets" panel
  // to be used for this — that was the actual root cause of "choosing
  // Card renders nothing": the deployed client bundle had this baked in
  // as `undefined`, so `loadStripe(undefined)` silently resolved to
  // `null` with no error. See CardPaymentStep.tsx's own comment for the
  // fail-loud handling added once that was diagnosed.

  // wrangler.jsonc correctly declares IMAGES under r2_buckets (bucket_name
  // "ozyfi-images") — but the generated Env interface inferred it as a
  // Cloudflare Images product binding instead of a real R2Bucket, so
  // app/api/admin/upload/route.ts's `.put()` and app/images/[...key]/
  // route.ts's `.get()`/`.writeHttpMetadata()`/`.httpEtag`/`.body` (all
  // real R2Bucket/R2Object API) didn't type-check. Overridden here to the
  // real binding type instead of re-running `wrangler types` per machine.
  IMAGES: R2Bucket;
}
