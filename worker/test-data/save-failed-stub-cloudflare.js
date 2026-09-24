// Stub for '@opennextjs/cloudflare' — the real package needs the actual
// Cloudflare Workers runtime, unavailable in this sandbox (no live D1/
// Workers env — same infra gap as every prior delivery on this project).
// getCloudflareContext returns whatever fake { env, ctx } the harness
// installed on globalThis.__FAKE_CF_CONTEXT before calling the real route
// handler — so the REAL route.ts code runs unmodified against a REAL
// (if in-memory) env.DB / ctx.waitUntil, not a re-implementation of it.
async function getCloudflareContext(_opts) {
  if (!globalThis.__FAKE_CF_CONTEXT) throw new Error('Test harness did not install __FAKE_CF_CONTEXT');
  return globalThis.__FAKE_CF_CONTEXT;
}
module.exports = { getCloudflareContext };
