// Real-execution, end-to-end verification for the "split kebab categories"
// migration (worker/migrations/024_split_kebab_categories.sql).
//
// worker/test-data/kebab-split-dry-run.py already confirmed the migration
// executes cleanly against a real SQLite database (built from the real
// worker/schema.sql + the real 022/023/024 migrations) with the right row
// counts, no orphans, and no cross-product leakage at the raw-row level.
// This harness goes one level further: it builds the exact MenuData shape
// lib/menu-data.ts's loadMenuData() builds from those same real rows, then
// traces it through the REAL, current lib/menu-i18n.ts's
// normalizeMenuBlob() and lib/pricing.ts's calcUnitPriceFromSelection() —
// the exact functions the live site's /api/menu route and POST
// /api/orders's price verification actually call — never a
// reimplementation of either. Uses Node's built-in node:sqlite so the
// database this reads from is the real thing, not a hand-built fixture.

const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '../..');

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, strict: false },
    fileName: filename,
  }).outputText;
  module._compile(out, filename);
};

let passed = 0, failed = 0;
function check(cond, label, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${detail !== undefined ? ' :: ' + JSON.stringify(detail) : ''}`);
  if (cond) passed++; else failed++;
}

// ---------------------------------------------------------------------
// Build the real post-024 database: schema.sql + 022 + 023 (minus its 2
// ALTER TABLE lines, already reflected in current schema.sql — see
// kebab-split-dry-run.py's own comment for why) + 024.
// ---------------------------------------------------------------------
const db = new DatabaseSync(':memory:');
db.exec(fs.readFileSync(path.join(ROOT, 'worker/schema.sql'), 'utf8'));
for (const name of ['022_pizza_kuningas_menu_import.sql', '023_extras_and_additional_info.sql', '024_split_kebab_categories.sql']) {
  let sql = fs.readFileSync(path.join(ROOT, 'worker/migrations', name), 'utf8');
  if (name.startsWith('023_')) {
    sql = sql.split('\n').filter((l) => !l.trim().startsWith('ALTER TABLE')).join('\n');
  }
  db.exec(sql);
}

const { normalizeMenuBlob } = require(path.join(ROOT, 'lib/menu-i18n.ts'));
const { calcUnitPriceFromSelection } = require(path.join(ROOT, 'lib/pricing.ts'));

const categories = db.prepare('SELECT * FROM categories').all();
const products = db.prepare('SELECT * FROM products').all();
const groups = db.prepare('SELECT * FROM option_groups').all();
const options = db.prepare('SELECT * FROM options').all();
const addons = db.prepare('SELECT * FROM addons').all();

const optionsByGroup = {};
for (const o of options) (optionsByGroup[o.group_id] ||= []).push(o);
const optionGroups = groups.map((g) => ({ ...g, options: optionsByGroup[g.id] || [] }));

// ---------------------------------------------------------------------
// Raw-row-level checks against the real, freshly-built database, straight
// from SQL — before any app-level normalization. This is the "real SQLite
// dry run" the brief's own "How to verify" section asks for: exactly 3 new
// categories, 36 new products, 36x5=180 new extra options rows, zero
// orphans, and the old 12 kebabit-* products/their extras genuinely gone
// (not just orphaned).
// ---------------------------------------------------------------------
const newCatRows = categories.filter((c) => ['kebabit', 'kanakebabit', 'broilerin-rintafile'].includes(c.id));
check(newCatRows.length === 3, 'exactly 3 new categories in the real database', newCatRows.length);
check(categories.length === 16, 'total category count is 16 (14 - 1 old combined + 3 new)', categories.length);
check(!categories.some((c) => c.title && c.title.includes('Rintafile / Kebabit / Kanakebabit')), 'the old combined category row is genuinely gone (not just renamed/orphaned)');

const sortByCat = Object.fromEntries(categories.map((c) => [c.id, c.sort_order]));
const sortOrders = categories.map((c) => c.sort_order).sort((a, b) => a - b);
check(JSON.stringify(sortOrders) === JSON.stringify([...Array(16).keys()]), 'category sort_order is a clean, contiguous 0..15 sequence with no gaps or duplicates after the shift', sortOrders);
check(sortByCat.kebabit === 7 && sortByCat.kanakebabit === 8 && sortByCat['broilerin-rintafile'] === 9, 'the 3 new categories sit at sort_order 7/8/9 — right where the old combined category used to be', [sortByCat.kebabit, sortByCat.kanakebabit, sortByCat['broilerin-rintafile']]);
check(sortByCat.burgerit === 10 && sortByCat.salaatit === 15, 'every category after the old slot (burgerit..salaatit) shifted up by 2, preserving the real menu section order', [sortByCat.burgerit, sortByCat.salaatit]);
check(sortByCat.pizzat === 0 && sortByCat.voner === 6, 'every category before the old slot (pizzat..voner) is completely untouched', [sortByCat.pizzat, sortByCat.voner]);

const newProductRows = products.filter((p) => ['kebabit', 'kanakebabit', 'broilerin-rintafile'].includes(p.category_id));
check(newProductRows.length === 36, 'exactly 36 new products in the real database', newProductRows.length);
check(products.length === 128, 'total product count is 128 (104 before this round - 12 old kebabit + 36 new)', products.length);
check(newProductRows.every((p) => p.price === 11.9), 'every one of the 36 new products is priced at exactly 11.90 in the real database row (no float drift, no per-style/per-protein variation)', [...new Set(newProductRows.map((p) => p.price))]);

const newProductIds = new Set(newProductRows.map((p) => p.id));
const newGroupRows = groups.filter((g) => g.product_id && newProductIds.has(g.product_id));
check(newGroupRows.length === 36, 'exactly 36 new extra option_groups (one per new product)', newGroupRows.length);
const newOptionRows = options.filter((o) => newGroupRows.some((g) => g.id === o.group_id));
check(newOptionRows.length === 180, 'exactly 180 new extra options rows (36 products x 5 extras each)', newOptionRows.length);

// Orphan checks across the WHOLE database, not just the new rows — this
// migration must not have broken any pre-existing relationship either.
const catIds = new Set(categories.map((c) => c.id));
const productIds = new Set(products.map((p) => p.id));
const groupIds = new Set(groups.map((g) => g.id));
check(products.every((p) => catIds.has(p.category_id)), 'zero orphaned products anywhere in the database (every product.category_id resolves to a real category)');
check(groups.every((g) => !g.product_id || productIds.has(g.product_id)), 'zero orphaned option_groups anywhere in the database (every per-product group.product_id resolves to a real product)');
check(options.every((o) => groupIds.has(o.group_id)), 'zero orphaned options anywhere in the database (every option.group_id resolves to a real option_group)');

const rawMenuData = { categories, products, optionGroups, addons, bundles: [], settings: {}, scheduledOffers: [] };
const blob = normalizeMenuBlob(rawMenuData, 'en');

// ---------------------------------------------------------------------
// The 3 new categories exist in the normalized blob, in the right place.
// ---------------------------------------------------------------------
check(blob.categories.length === 16, '16 categories in the normalized blob (14 - 1 old combined + 3 new)', blob.categories.length);
check(blob.products.length === 128, '128 products in the normalized blob (104 - 12 old kebabit + 36 new)', blob.products.length);

const newCatIds = ['kebabit', 'kanakebabit', 'broilerin-rintafile'];
for (const id of newCatIds) {
  const cat = blob.categories.find((c) => c.id === id);
  check(!!cat, `category "${id}" present in the normalized blob`);
}

// ---------------------------------------------------------------------
// Spot-check from the brief: "Kebab — Riisillä" and "Chicken Kebab —
// Riisillä" are two distinct products, both 11.90 €, each with their own
// 5 extras correctly scoped (no cross-product leakage).
// ---------------------------------------------------------------------
const kebabRice = blob.products.find((p) => p.id === 'kebabit-1');
const kanakebabRice = blob.products.find((p) => p.id === 'kanakebabit-1');
const rintafileRice = blob.products.find((p) => p.id === 'broilerin-rintafile-1');

check(!!kebabRice && !!kanakebabRice && !!rintafileRice, 'all 3 "with Rice" style variants (one per protein) are present as distinct products');
check(kebabRice.name !== kanakebabRice.name && kanakebabRice.name !== rintafileRice.name, 'the 3 "with Rice" products have 3 distinct names', [kebabRice.name, kanakebabRice.name, rintafileRice.name]);
check(kebabRice.basePrice === 11.9 && kanakebabRice.basePrice === 11.9 && rintafileRice.basePrice === 11.9, 'all 3 "with Rice" products are 11.90 € — same real source price, no invented per-protein variation', [kebabRice.basePrice, kanakebabRice.basePrice, rintafileRice.basePrice]);

check(kebabRice.extraOptions.length === 5 && kanakebabRice.extraOptions.length === 5 && rintafileRice.extraOptions.length === 5, 'each of the 3 "with Rice" products has exactly its own 5 extras', [kebabRice.extraOptions.length, kanakebabRice.extraOptions.length, rintafileRice.extraOptions.length]);

const kebabDoubleMeat = kebabRice.extraOptions.find((o) => o.id.endsWith('double-meat'));
const kanakebabDoubleMeat = kanakebabRice.extraOptions.find((o) => o.id.endsWith('double-meat'));
const rintafileDoubleMeat = rintafileRice.extraOptions.find((o) => o.id.endsWith('double-meat'));
check(kebabDoubleMeat.delta === 4 && kanakebabDoubleMeat.delta === 4 && rintafileDoubleMeat.delta === 4, 'Double meat is +4.00 on all 3 proteins', [kebabDoubleMeat.delta, kanakebabDoubleMeat.delta, rintafileDoubleMeat.delta]);
// The ENGLISH "Double meat" label is deliberately identical across all 3
// proteins (protein-agnostic, unchanged from the old data — see the
// migration's own header comment) — it's the FINNISH label that's adapted
// per protein, so that check needs the 'fi'-locale normalization, not the
// 'en' one `blob` above already is.
const blobFi = normalizeMenuBlob(rawMenuData, 'fi');
const kebabDoubleMeatFi = blobFi.products.find((p) => p.id === 'kebabit-1').extraOptions.find((o) => o.id.endsWith('double-meat'));
const kanakebabDoubleMeatFi = blobFi.products.find((p) => p.id === 'kanakebabit-1').extraOptions.find((o) => o.id.endsWith('double-meat'));
const rintafileDoubleMeatFi = blobFi.products.find((p) => p.id === 'broilerin-rintafile-1').extraOptions.find((o) => o.id.endsWith('double-meat'));
check(kebabDoubleMeat.label === 'Double meat' && kanakebabDoubleMeat.label === 'Double meat' && rintafileDoubleMeat.label === 'Double meat', 'the ENGLISH "Double meat" label is identical across all 3 proteins (protein-agnostic, unchanged from the old data)', [kebabDoubleMeat.label, kanakebabDoubleMeat.label, rintafileDoubleMeat.label]);
check(kebabDoubleMeatFi.label !== kanakebabDoubleMeatFi.label && kanakebabDoubleMeatFi.label !== rintafileDoubleMeatFi.label, 'the FINNISH "Double meat" label is adapted per protein via the real, current locale resolution path (3 distinct labels, not one generic label copy-pasted 3x)', [kebabDoubleMeatFi.label, kanakebabDoubleMeatFi.label, rintafileDoubleMeatFi.label]);

// ---------------------------------------------------------------------
// End-to-end pricing via the real calcUnitPriceFromSelection() — same
// cross-product-tamper guarantee already proven for size/extras in prior
// rounds, re-confirmed here against this migration's real data.
// ---------------------------------------------------------------------
const kebabWithDoubleMeat = calcUnitPriceFromSelection(kebabRice.basePrice, kebabRice.toppingsEnabled, { toppingIds: [], fillings: {}, extraIds: [kebabDoubleMeat.id] }, blob, kebabRice.sizeOptions, kebabRice.extraOptions);
check(Math.abs(kebabWithDoubleMeat - 15.9) < 0.001, 'Kebab with Rice + its own Double meat extra = 11.90 + 4.00 = 15.90', kebabWithDoubleMeat);

const tamperedKanakebab = calcUnitPriceFromSelection(kanakebabRice.basePrice, kanakebabRice.toppingsEnabled, { toppingIds: [], fillings: {}, extraIds: [kebabDoubleMeat.id] /* a REAL id, but for a DIFFERENT product (kebabit-1) */ }, blob, kanakebabRice.sizeOptions, kanakebabRice.extraOptions);
check(Math.abs(tamperedKanakebab - 11.9) < 0.001, 'Chicken Kebab with Rice, priced with Kebab\'s real extraId, contributes 0 (never resolves to the other product\'s extra) — looked up only against its OWN extraOptions', tamperedKanakebab);

// ---------------------------------------------------------------------
// The old combined category/products are genuinely gone from the app's
// own normalized view too (not just the raw DB rows).
// ---------------------------------------------------------------------
check(!blob.categories.some((c) => c.title && c.title.includes('Rintafile / Kebabit')), 'the old combined category title does not appear anywhere in the normalized blob');
check(blob.products.filter((p) => p.id.startsWith('kebabit-') || p.id.startsWith('kanakebabit-') || p.id.startsWith('broilerin-rintafile-')).length === 36, 'exactly 36 products under the 3 new category id prefixes in the normalized blob — the old 12 are not still lingering under those same ids with old data', blob.products.filter((p) => p.id.startsWith('kebabit-') || p.id.startsWith('kanakebabit-') || p.id.startsWith('broilerin-rintafile-')).length);

// ---------------------------------------------------------------------
// Untouched-by-this-migration sanity: a pre-existing pizza product still
// prices exactly as it did before (same real end-to-end check
// menu-import-verify.js already established, re-run here against the
// post-024 database to confirm nothing else moved).
// ---------------------------------------------------------------------
const bolognese = blob.products.find((p) => p.id === 'pizzat-0');
const boloUnit = calcUnitPriceFromSelection(bolognese.basePrice, bolognese.toppingsEnabled, { toppingIds: [], fillings: {}, sizeOptionId: bolognese.sizeOptions[0].id }, blob, bolognese.sizeOptions);
check(Math.abs(boloUnit - 10.9) < 0.001, 'pizzat-0 (an unrelated, pre-existing product) still prices at its plain 10.90 base — completely unaffected by this migration', boloUnit);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
