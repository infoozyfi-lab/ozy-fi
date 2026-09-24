// Real verification of the /api/menu Cache-Control fix — per-product-size
// bug-fix follow-up brief.
//
// This sandbox has no live Cloudflare Worker / D1 / browser to reproduce
// the actual network behavior end-to-end (same infra gap as every prior
// delivery in this project — confirmed again here: `npm install` still
// fails against a registry-blocked transitive dependency, so no live dev
// server either). What CAN be verified for real: the exact Cache-Control
// header string the fixed route.ts now emits, run through a standard,
// correct implementation of HTTP freshness-lifetime calculation (RFC 9111
// §4.2.1 — request-directives aside, since /api/menu's GET request from
// the browser carries none) — computed separately for a SHARED cache
// (what Cloudflare's edge/`caches.default` behaves as — honors
// `s-maxage` when present) and a PRIVATE cache (what a customer's own
// browser behaves as — always uses `max-age`, never `s-maxage`).
//
// This is real code execution of the real freshness algorithm against
// the REAL header string extracted directly from the actual route file
// (regex-extracted, not hand-copied, so this test can't silently drift
// from what's actually shipped) — not a mock of what's being tested.

const fs = require('fs');
const path = require('path');

const ROUTE_PATH = path.resolve(__dirname, '../../app/api/menu/route.ts');
const src = fs.readFileSync(ROUTE_PATH, 'utf8');
const match = src.match(/'Cache-Control':\s*'([^']+)'/);
if (!match) {
  console.error('FAIL — could not find a Cache-Control header string in', ROUTE_PATH);
  process.exit(1);
}
const NEW_HEADER = match[1];
// The exact string this route emitted BEFORE this fix — hardcoded here
// deliberately (not read from git history, which isn't available in this
// sandbox) as the known "before" baseline this fix replaced.
const OLD_HEADER = 'public, max-age=300, s-maxage=300';

console.log('Extracted CURRENT Cache-Control from route.ts:', JSON.stringify(NEW_HEADER));
console.log('Known Cache-Control BEFORE this fix:          ', JSON.stringify(OLD_HEADER));

// Minimal, correct RFC 9111 §4.2.1 freshness-lifetime calculation for the
// directives this response actually uses (public/private, max-age,
// s-maxage, must-revalidate). No heuristic freshness needed — max-age is
// always explicitly present here.
function parseDirectives(headerValue) {
  const out = {};
  for (const part of headerValue.split(',')) {
    const [rawKey, rawVal] = part.trim().split('=');
    const key = rawKey.toLowerCase();
    out[key] = rawVal !== undefined ? Number(rawVal) : true;
  }
  return out;
}

// isShared=true models Cloudflare's edge cache (a "shared cache" per the
// spec); isShared=false models the customer's own browser (a "private
// cache"). Per RFC 9111 §4.2.1: a shared cache MUST use s-maxage when
// present (overriding max-age); a private/browser cache MUST ignore
// s-maxage entirely and use max-age.
function freshnessLifetimeSeconds(headerValue, isShared) {
  const d = parseDirectives(headerValue);
  if (isShared && d['s-maxage'] !== undefined) return d['s-maxage'];
  if (d['max-age'] !== undefined) return d['max-age'];
  return 0;
}

let passed = 0, failed = 0;
function check(cond, label, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${detail !== undefined ? ` (${detail})` : ''}`);
  if (cond) passed++; else failed++;
}

console.log('\n=== Before this fix (OLD_HEADER) — reproducing the reported bug ===');
const oldBrowserFreshness = freshnessLifetimeSeconds(OLD_HEADER, false);
const oldEdgeFreshness = freshnessLifetimeSeconds(OLD_HEADER, true);
check(
  oldBrowserFreshness === 300,
  "OLD header: a customer's BROWSER treats /api/menu as fresh for 300s after its last fetch",
  `freshness lifetime = ${oldBrowserFreshness}s — the browser will NOT even make a network request in this window, no matter what the admin just changed or purged server-side`
);
check(oldEdgeFreshness === 300, 'OLD header: the shared/edge cache also caches for 300s', `freshness lifetime = ${oldEdgeFreshness}s`);

console.log('\n=== After this fix (NEW_HEADER, as actually shipped in route.ts) ===');
const newBrowserFreshness = freshnessLifetimeSeconds(NEW_HEADER, false);
const newEdgeFreshness = freshnessLifetimeSeconds(NEW_HEADER, true);
check(
  newBrowserFreshness === 0,
  "NEW header: a customer's BROWSER now treats /api/menu as immediately stale",
  `freshness lifetime = ${newBrowserFreshness}s — the browser issues a real request every time, so purgeMenuCache's server-side purge (already correctly wired into every admin write) actually has a chance to take effect for that customer's very next load`
);
check(
  newEdgeFreshness === 300,
  'NEW header: the shared/edge cache STILL caches for 300s (perf goal preserved)',
  `freshness lifetime = ${newEdgeFreshness}s — D1 still isn't re-queried on every single customer request, just because the browser now always asks`
);
check(
  parseDirectives(NEW_HEADER)['must-revalidate'] === true,
  'NEW header carries must-revalidate (reinforces "never reuse a stale copy without checking back in")'
);

console.log(`\n${passed} passed, ${failed} failed`);
console.log(`\nNOT verified here (needs live Cloudflare infra unavailable in this sandbox):
  - The residual PER-COLOCATION edge-cache propagation gap: purgeMenuCache's
    cache.delete() only clears the colo that served the admin's write; a
    customer request landing on a DIFFERENT colo within the 300s window
    could still see that colo's own stale copy until it naturally expires.
    This is a real, documented Cloudflare Workers Cache API characteristic,
    not something this fix (or any Cache-Control header change) can close —
    see route.ts's own comment on this fix for the full explanation.`);
process.exit(failed ? 1 : 0);
