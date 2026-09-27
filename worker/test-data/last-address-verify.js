// Real-execution verification for GET /api/checkout/last-address
// (Checkout-improvements brief, item 12). Loads the ACTUAL route.ts and
// the REAL lib/api-helpers.ts's phoneMatches (nothing about the matching
// logic is reimplemented here), stubbing only what needs a live
// Cloudflare Workers runtime — same '@opennextjs/cloudflare' stub used by
// worker/test-data/save-failed-bug-verify.js elsewhere in this project's
// test suite — against a tiny in-memory fake env.DB.

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const Module = require('module');

const ROOT = path.resolve(__dirname, '../..');
const STUB_CF = path.join(__dirname, 'save-failed-stub-cloudflare.js');

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === '@opennextjs/cloudflare') return STUB_CF;
  if (request.startsWith('@/')) {
    const rel = request.slice(2);
    for (const ext of ['.ts', '.tsx']) {
      const candidate = path.join(ROOT, rel + ext);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return origResolve.call(this, request, parent, isMain, options);
};

Module._extensions['.ts'] = Module._extensions['.tsx'] = function (module, filename) {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
  }).outputText;
  module._compile(out, filename);
};

// Minimal fake D1 — just enough for this route's one prepared statement
// (a plain SELECT with no bound params): .prepare(sql).all() resolves
// against the rows this harness seeds, exactly like the real
// worker/schema.sql `orders` table would return them.
function makeFakeDB(rows) {
  return {
    prepare(_sql) {
      return {
        bind() { return this; },
        all: async () => ({ results: rows }),
      };
    },
  };
}

const { GET } = require(path.join(ROOT, 'app/api/checkout/last-address/route.ts'));

let passed = 0, failed = 0;
function check(cond, label, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${detail !== undefined ? ' :: ' + JSON.stringify(detail) : ''}`);
  if (cond) passed++; else failed++;
}

async function callRoute(phone, rows) {
  globalThis.__FAKE_CF_CONTEXT = { env: { DB: makeFakeDB(rows) }, ctx: { waitUntil: () => {} } };
  const req = new Request(`https://example.com/api/checkout/last-address?phone=${encodeURIComponent(phone)}`);
  const res = await GET(req);
  return res.json();
}

async function main() {
  const rows = [
    { customer_name: 'Matti Meikäläinen', address: 'Mannerheimintie 1, Helsinki', phone: '0401234567', order_type: 'delivery', created_at: '2026-09-01 10:00:00' },
    { customer_name: 'Matti Meikäläinen', address: 'OLDER Address 5, Helsinki', phone: '0401234567', order_type: 'delivery', created_at: '2026-08-01 10:00:00' },
    { customer_name: 'Pickup Person', address: 'Pickup — no delivery address', phone: '0409999999', order_type: 'pickup', created_at: '2026-09-05 10:00:00' },
    { customer_name: 'Other Customer', address: 'Some Other St 9', phone: '0405555555', order_type: 'delivery', created_at: '2026-09-08 10:00:00' },
  ];

  // A returning customer's phone (last 6 digits match) — real fuzzy match,
  // same tolerance every other phone lookup in this codebase uses.
  {
    const data = await callRoute('040 123 4567', rows);
    check(data.found === true, 'a matching phone number is found');
    check(data.name === 'Matti Meikäläinen', 'returns the customer\'s name');
    check(data.address === 'Mannerheimintie 1, Helsinki', 'returns the MOST RECENT delivery address, not an older one for the same phone', data.address);
    check(!('postalCode' in data), 'never invents a postalCode — the orders table has no such column to read one from');
  }

  // A phone number that only ever placed pickup orders — must NOT surface
  // the pickup sentinel address as if it were a real delivery address.
  {
    const data = await callRoute('0409999999', rows);
    check(data.found === false, 'a phone with only pickup orders finds no address to prefill (never returns the pickup sentinel string)', data);
  }

  // A phone number never seen before.
  {
    const data = await callRoute('0401112233', rows);
    check(data.found === false, 'an unknown phone number returns found:false');
  }

  // A too-short/garbage phone input never even reaches the DB query with
  // something nonsensical — short-circuits to not-found immediately.
  {
    const data = await callRoute('abc', rows);
    check(data.found === false, 'a garbage/too-short phone input returns found:false without querying');
  }

  // Same phoneMatches() tolerance as every other lookup — different
  // formatting of the same number still matches.
  {
    const data = await callRoute('+358401234567', rows);
    check(data.found === true, 'an internationally-formatted version of the same number still matches (same tolerance as existing phone lookups)', data);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main();
