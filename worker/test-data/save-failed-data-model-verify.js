// Real-execution verification of the data-model fix in lib/menu-i18n.ts —
// loads the ACTUAL normalizeMenuBlob() (not a reimplementation) and proves,
// for a product with 2 admin-added size tiers (mirroring the brief's own
// "Pannu"/"Perhe" example), that it now yields 3 selectable prices —
// Normaali (the base price itself) + the 2 added tiers — where before the
// fix it yielded only 2 (the base price wasn't selectable at all).
//
// Also re-verifies (regression) that a product with NO size tiers still
// gets the exact single-entry FALLBACK_OPTION unchanged — the thing
// components/ProductPage.tsx's `hasRealSizeTiers` check depends on to
// decide whether to show a size selector at all.

const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const ROOT = require('path').resolve(__dirname, '../..');

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const rel = request.slice(2);
    for (const ext of ['.ts', '.tsx']) {
      const candidate = path.join(ROOT, rel + ext);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  if (request.startsWith('./') || request.startsWith('../')) {
    return origResolve.call(this, request, parent, isMain, options);
  }
  return origResolve.call(this, request, parent, isMain, options);
};

Module._extensions['.ts'] = Module._extensions['.tsx'] = function (module, filename) {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      strict: false,
    },
    fileName: filename,
  }).outputText;
  module._compile(out, filename);
};

const { normalizeMenuBlob } = require(path.join(ROOT, 'lib/menu-i18n.ts'));

let passed = 0, failed = 0;
function check(cond, label, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${detail !== undefined ? ' :: ' + JSON.stringify(detail) : ''}`);
  if (cond) passed++; else failed++;
}

// ---------------------------------------------------------------------
// Case 1: pizzat-0-shaped product, base price 9.90, with exactly the 2
// ADDITIONAL tiers the bug report's business-owner clarification expects
// an admin to add (Pannu +3.00, Perhe +6.50) — no "Normaali" row added by
// the admin, since (per the brief) they should never have to.
// ---------------------------------------------------------------------
const raw1 = {
  categories: [],
  products: [
    { id: 'pizzat-0', category_id: 'pizzat', name: '1. Bolognese', name_fi: null, description: null, description_fi: null, price: 9.9, offer_price: null, image: null, tag: null, has_toppings: 1, sort_order: 0, active: 1 },
  ],
  optionGroups: [
    {
      id: 'size-pizzat-0', title: 'Size', title_fi: null, kind: 'size', icon: null, sort_order: 0, product_id: 'pizzat-0',
      options: [
        { id: 'pannu-abcd', label: 'Pannu', label_fi: null, price_delta: 3.0, color: null, sort_order: 0 },
        { id: 'perhe-wxyz', label: 'Perhe', label_fi: null, price_delta: 6.5, color: null, sort_order: 1 },
      ],
    },
  ],
  addons: [],
  bundles: [],
  scheduledOffers: [],
  settings: {},
};

const blobEn = normalizeMenuBlob(raw1, 'en');
const product = blobEn.products.find((p) => p.id === 'pizzat-0');
check(!!product, 'pizzat-0 present in normalized products');
check(product.sizeOptions.length === 3, 'pizzat-0 now has 3 selectable sizes (Normaali + Pannu + Perhe), not 2', product.sizeOptions);
check(product.sizeOptions[0].delta === 0, 'The FIRST (default-selected) size option has delta 0 — the true base price', product.sizeOptions[0]);
check(product.sizeOptions[0].label === 'Regular', 'English locale labels the synthetic base option "Regular"', product.sizeOptions[0].label);
check(
  product.sizeOptions[1].id === 'pannu-abcd' && product.sizeOptions[2].id === 'perhe-wxyz',
  'The 2 admin-added tiers (Pannu, Perhe) still appear, in their own sort order, after the synthetic base entry'
);
check(
  product.sizeOptions[0].id !== 'pannu-abcd' && product.sizeOptions[0].id !== 'perhe-wxyz',
  'The synthetic base option id never collides with a real option id'
);

// Resulting absolute prices a customer would see: base 9.90, Pannu 12.90, Perhe 16.40.
const resultingPrices = product.sizeOptions.map((o) => Math.round((product.price + o.delta) * 100) / 100);
check(JSON.stringify(resultingPrices) === JSON.stringify([9.9, 12.9, 16.4]), 'Resulting absolute prices are correct: 9.90 / 12.90 / 16.40 €', resultingPrices);

// Finnish locale — the synthetic label should read "Normaali".
const blobFi = normalizeMenuBlob(raw1, 'fi');
const productFi = blobFi.products.find((p) => p.id === 'pizzat-0');
check(productFi.sizeOptions[0].label === 'Normaali', 'Finnish locale labels the synthetic base option "Normaali"', productFi.sizeOptions[0].label);

// ---------------------------------------------------------------------
// Case 2 (regression): a product with NO 'size' group at all must still
// get the exact unchanged single-entry FALLBACK_OPTION — this is what
// components/ProductPage.tsx's hasRealSizeTiers relies on to decide
// whether to render a size selector at all.
// ---------------------------------------------------------------------
const raw2 = {
  categories: [],
  products: [
    { id: 'plain-product', category_id: 'pizzat', name: 'Plain', name_fi: null, description: null, description_fi: null, price: 7.5, offer_price: null, image: null, tag: null, has_toppings: 0, sort_order: 1, active: 1 },
  ],
  optionGroups: [],
  addons: [],
  bundles: [],
  scheduledOffers: [],
  settings: {},
};
const blob2 = normalizeMenuBlob(raw2, 'en');
const plain = blob2.products.find((p) => p.id === 'plain-product');
check(
  plain.sizeOptions.length === 1 && plain.sizeOptions[0].id === 'default',
  'A product with no real size tiers still gets the untouched single-entry fallback (id "default") — hasRealSizeTiers stays false',
  plain.sizeOptions
);

// ---------------------------------------------------------------------
// Case 3 (regression): a product with exactly ONE real admin-added tier
// (no second tier) — still correctly gets base + that one tier = 2
// selectable sizes, not confused with the fallback.
// ---------------------------------------------------------------------
const raw3 = {
  categories: [],
  products: [
    { id: 'one-tier-product', category_id: 'pizzat', name: 'OneTier', name_fi: null, description: null, description_fi: null, price: 5.0, offer_price: null, image: null, tag: null, has_toppings: 1, sort_order: 2, active: 1 },
  ],
  optionGroups: [
    {
      id: 'size-one-tier-product', title: 'Size', title_fi: null, kind: 'size', icon: null, sort_order: 0, product_id: 'one-tier-product',
      options: [{ id: 'jumbo-xyz', label: 'Jumbo', label_fi: null, price_delta: 4.0, color: null, sort_order: 0 }],
    },
  ],
  addons: [],
  bundles: [],
  scheduledOffers: [],
  settings: {},
};
const blob3 = normalizeMenuBlob(raw3, 'en');
const oneTier = blob3.products.find((p) => p.id === 'one-tier-product');
check(oneTier.sizeOptions.length === 2, 'A product with exactly 1 admin-added tier now has 2 selectable sizes (base + that tier)', oneTier.sizeOptions);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
