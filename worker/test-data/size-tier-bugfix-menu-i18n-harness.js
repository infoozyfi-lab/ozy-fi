// Runtime verification harness for lib/menu-i18n.ts's normalizeMenuBlob —
// specifically the 'size' case's product_id attachment, using REAL code
// execution (not a re-implementation) to directly rule in/out a data-flow
// bug in this function, per the bug report's own "confirm for real rather
// than assumed correct" instruction.
//
// This module (unlike lib/pricing.ts) has real intra-project imports
// (./i18n/locales, ./scheduledOffers, ./pricing, ./openingHours, each
// using the project's `@/*` -> project-root path alias) — a minimal
// on-the-fly TS loader + alias resolver is set up below so `require()`
// can actually load and execute this dependency chain for real, rather
// than skipping this file because it's inconvenient to load.

const ts = require('typescript');
const Module = require('module');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '../..');

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith('@/')) {
    request = path.join(ROOT, request.slice(2));
  }
  return origResolve.call(this, request, ...rest);
};

function makeLoader(jsx) {
  return function (mod, filename) {
    const src = fs.readFileSync(filename, 'utf8');
    const out = ts.transpileModule(src, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
        strict: true,
        jsx: jsx ? ts.JsxEmit.ReactJSX : ts.JsxEmit.None,
      },
      fileName: filename,
    });
    mod._compile(out.outputText, filename);
  };
}
require.extensions['.ts'] = makeLoader(false);
require.extensions['.tsx'] = makeLoader(true);

const { normalizeMenuBlob } = require(path.join(ROOT, 'lib/menu-i18n.ts'));

let passed = 0, failed = 0;
function check(cond, label, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${detail !== undefined ? ' :: ' + JSON.stringify(detail) : ''}`);
  if (cond) passed++; else failed++;
}

// ---------------------------------------------------------------------
// Simulates the EXACT reported repro: a product that starts with ZERO
// size tiers (option_groups has no 'size' row for it at all — the most
// common starting state) getting its FIRST tier added, then the raw
// /api/menu-shaped payload (what loadMenuData()/the route return) is fed
// through the real normalizeMenuBlob() to see what a customer's browser
// would actually receive and render.

const productId = 'TEST-fresh-tier-product';

function rawMenuBefore() {
  return {
    categories: [{ id: 'pizzat', title: 'Pizzas', sub: '', image: '', sort_order: 0 }],
    products: [
      { id: productId, category_id: 'pizzat', name: 'Fresh Tier Test', description: '', price: 9.5, offer_price: null, image: '', tag: null, has_toppings: 1, sort_order: 0, active: 1 },
    ],
    optionGroups: [], // no 'size' group yet — matches "product currently has zero tiers"
    addons: [],
    bundles: [],
    settings: {},
    scheduledOffers: [],
  };
}

function rawMenuAfterFirstTierAdded() {
  const raw = rawMenuBefore();
  // Mirrors exactly what SizesEditor.addTier() does for a product's FIRST
  // tier: creates the product_id-scoped 'size' group, then one option row.
  raw.optionGroups = [
    {
      id: `size-${productId}`,
      title: 'Size',
      title_fi: null,
      kind: 'size',
      icon: null,
      sort_order: 0,
      product_id: productId,
      options: [
        { id: `size-${productId}-tier1`, group_id: `size-${productId}`, label: 'Small', label_fi: null, price_delta: 0, color: null },
      ],
    },
  ];
  return raw;
}

const blobBefore = normalizeMenuBlob(rawMenuBefore(), 'en');
const productBefore = blobBefore.products.find((p) => p.id === productId);
check(!!productBefore, 'Product found in normalized "before" blob');
check(
  Array.isArray(productBefore.sizeOptions) && productBefore.sizeOptions.length === 1 && productBefore.sizeOptions[0].id === 'default',
  "BEFORE adding a tier: product.sizeOptions is FALLBACK_OPTION (single 'Default' entry)",
  productBefore.sizeOptions
);

const blobAfter = normalizeMenuBlob(rawMenuAfterFirstTierAdded(), 'en');
const productAfter = blobAfter.products.find((p) => p.id === productId);
check(!!productAfter, 'Product found in normalized "after" blob');
check(
  Array.isArray(productAfter.sizeOptions) && productAfter.sizeOptions.length === 1 && productAfter.sizeOptions[0].id === `size-${productId}-tier1`,
  "AFTER adding the FIRST tier: product.sizeOptions correctly contains the new tier (proves normalizeMenuBlob's 'size' attachment logic is NOT the bug)",
  productAfter.sizeOptions
);
check(
  productAfter.sizeOptions[0].label === 'Small' && productAfter.sizeOptions[0].delta === 0,
  'New tier\'s label/delta round-trip correctly through normalizeMenuBlob'
);

// A second product, unaffected — proves this isn't accidentally global.
function rawMenuTwoProducts() {
  const raw = rawMenuAfterFirstTierAdded();
  raw.products.push({ id: 'TEST-other-product', category_id: 'pizzat', name: 'Other', description: '', price: 7, offer_price: null, image: '', tag: null, has_toppings: 1, sort_order: 1, active: 1 });
  return raw;
}
const blobTwo = normalizeMenuBlob(rawMenuTwoProducts(), 'en');
const other = blobTwo.products.find((p) => p.id === 'TEST-other-product');
check(
  other.sizeOptions.length === 1 && other.sizeOptions[0].id === 'default',
  "A second, unrelated product's sizeOptions stay FALLBACK_OPTION — the new tier didn't leak onto it",
  other.sizeOptions
);

console.log(`\n${passed} passed, ${failed} failed`);
console.log('\nConclusion: normalizeMenuBlob\'s product_id-scoped \'size\' attachment logic');
console.log('correctly reflects a freshly-added first tier the moment it is fed the raw');
console.log('data — this rules OUT a normalize/attach logic bug as the cause. The actual');
console.log('root cause is the /api/menu Cache-Control staleness window (see');
console.log('verify-cache-fix.js and the delivery report).');
process.exit(failed ? 1 : 0);
