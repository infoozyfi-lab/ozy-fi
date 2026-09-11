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
interface CloudflareEnv extends Env {}
