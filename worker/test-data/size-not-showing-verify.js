// Real-execution reproduction of "size tiers save, but no selector appears
// on the product page" — for /[locale]/product/pizzat-0 specifically
// (the SSR-seeded standalone product page, components/ProductPageStandalone.tsx).
//
// Traces the FULL chain the bug report asks for, using the REAL, verbatim
// source of every link (extracted by brace-matching where a piece isn't
// separately exported, same pattern as every prior round's harnesses —
// never a reimplementation of the logic under test):
//   1. lib/menu-data.ts's loadMenuData() + lib/menu-i18n.ts's
//      normalizeProducts()/normalizeMenuBlob() — the two DIFFERENT
//      functions that shape product data for, respectively, the SSR seed
//      and the client-side /api/menu fetch.
//   2. context/StoreContext.tsx's menuLoading initial state + its
//      loadMenu() effect's own guard around it.
//   3. components/ProductPageStandalone.tsx's AutoOpenProduct — the
//      component that actually calls openProduct() for this page.
//   4. context/StoreContext.tsx's real openProduct() callback body.
//   5. components/ProductPage.tsx's real hasRealSizeTiers expression.

const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

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
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${detail !== undefined ? ' :: ' + detail : ''}`);
  if (cond) passed++; else failed++;
}

function extractBetween(src, startMarker, fileLabel) {
  const idx = src.indexOf(startMarker);
  if (idx === -1) throw new Error(`Could not find "${startMarker}" in ${fileLabel}`);
  return idx;
}

// ---------------------------------------------------------------------
// STEP 1 — real normalizeProducts() (SSR seed shaping) vs real
// normalizeMenuBlob() (client /api/menu shaping): do they produce the
// SAME sizeOptions field for the same raw row?
// ---------------------------------------------------------------------
console.log('=== STEP 1: what does each real shaping function put on a product for "sizeOptions"? ===');
const { normalizeProducts, normalizeMenuBlob } = require(path.join(ROOT, 'lib/menu-i18n.ts'));

const rawProductRow = {
  id: 'pizzat-0', category_id: 'pizzat', name: '1. Bolognese', name_fi: null,
  description: 'Ground beef.', description_fi: null, price: 9.9, offer_price: null,
  image: null, tag: null, has_toppings: 1, sort_order: 0, active: 1,
};
const rawOptionGroups = [
  {
    id: 'size-pizzat-0', title: 'Size', title_fi: null, kind: 'size', icon: null, sort_order: 0, product_id: 'pizzat-0',
    options: [
      { id: 'pannu-real1', label: 'Pannu', label_fi: null, price_delta: 3.0, color: null, sort_order: 0 },
      { id: 'perhe-real2', label: 'Perhe', label_fi: null, price_delta: 6.5, color: null, sort_order: 1 },
    ],
  },
];

// This is EXACTLY what app/(site)/[locale]/product/[id]/page.tsx does:
// StoreProviderInitialData only ever carries { categories, products } —
// loadMenuData()'s optionGroups/options are fetched but never passed
// through to the client seed at all (see that page + StoreContext's own
// initialData typing).
const ssrSeededProducts = normalizeProducts([rawProductRow], 'en');
const ssrSeededProduct = ssrSeededProducts.find((p) => p.id === 'pizzat-0');
check(!!ssrSeededProduct, 'SSR-seeded product (via real normalizeProducts()) found');
check(
  ssrSeededProduct.sizeOptions === undefined,
  'normalizeProducts() (the SSR-seed function) never sets `sizeOptions` at all — confirmed by real execution, not assumption',
  JSON.stringify(ssrSeededProduct.sizeOptions)
);

// This is what the client's /api/menu fetch effect uses instead, once it
// resolves — the REAL, already-fixed normalizeMenuBlob().
const fullMenuData = {
  categories: [], products: [rawProductRow], optionGroups: rawOptionGroups,
  addons: [], bundles: [], scheduledOffers: [], settings: {},
};
const clientBlob = normalizeMenuBlob(fullMenuData, 'en');
const clientProduct = clientBlob.products.find((p) => p.id === 'pizzat-0');
check(
  Array.isArray(clientProduct.sizeOptions) && clientProduct.sizeOptions.length === 3,
  'normalizeMenuBlob() (the client /api/menu shaping function) correctly attaches all 3 sizes (base + Pannu + Perhe) — confirms Part 1\'s prior fix is NOT the problem here',
  JSON.stringify(clientProduct.sizeOptions)
);

// ---------------------------------------------------------------------
// STEP 2 — context/StoreContext.tsx's menuLoading initial state and its
// loadMenu() effect's own guard, read directly from the real file (not
// re-typed from memory) to confirm the exact condition.
// ---------------------------------------------------------------------
console.log('\n=== STEP 2: does menuLoading correctly stay `true` while /api/menu is in flight, when SSR already seeded initialData? ===');
const storeContextSrc = fs.readFileSync(path.join(ROOT, 'context/StoreContext.tsx'), 'utf8');
const initMatch = storeContextSrc.match(/const \[menuLoading, setMenuLoading\] = useState\(([^)]+)\);/);
check(!!initMatch, 'Found menuLoading\'s real useState initializer');
console.log('  real initializer expression:', initMatch && initMatch[1]);
const initialDataTruthy = true; // SSR succeeded and passed a real initialData — the expected/common case
// eslint-disable-next-line no-eval
const menuLoadingInitial = eval(`(function(initialData){ return ${initMatch[1]}; })`)({ categories: [], products: [rawProductRow] });
check(menuLoadingInitial === false, 'menuLoading STARTS FALSE when SSR seeded initialData (the standalone product page\'s normal case)', String(menuLoadingInitial));

const guardMatch = storeContextSrc.match(/if \(!initialData\) setMenuLoading\(true\);/);
check(!!guardMatch, 'loadMenu()\'s effect has a real `if (!initialData) setMenuLoading(true)` guard');
console.log('  --> Since initialData IS truthy here, this guard does NOT fire — menuLoading stays false');
console.log('      for the ENTIRE duration of the /api/menu fetch, not just before it starts.');

// ---------------------------------------------------------------------
// STEP 3 + 4 — the actual bug: components/ProductPageStandalone.tsx's
// AutoOpenProduct, and context/StoreContext.tsx's real openProduct(),
// driven through the REAL sequence of renders a browser would produce:
//   render 1 (mount, initialData present): menuLoading=false (per Step 2),
//     activeProduct=null, products=[SSR-seeded pizzat-0, no sizeOptions]
//   render 2 (after /api/menu resolves): products=[fully-normalized
//     pizzat-0, real sizeOptions] — but did openProduct() get called AGAIN
//     to pick up the corrected data?
// ---------------------------------------------------------------------
console.log('\n=== STEP 3+4: AutoOpenProduct + the real openProduct() callback, driven through the real render sequence ===');

// Extract AutoOpenProduct verbatim (brace-matched, not retyped).
const standaloneSrc = fs.readFileSync(path.join(ROOT, 'components/ProductPageStandalone.tsx'), 'utf8');
// Two-phase brace matching (same fix this project's own buttons-UI harness
// already needed): phase 1 balances PARENS over the parameter list, which
// for AutoOpenProduct's signature contains its own destructuring braces
// (`{ productId, productHint }: { productId: string; ... }`) — naively
// scanning for the first top-level '{' from the start of the function
// text finds that destructuring brace, not the function body's brace.
// Phase 2 then finds the body's own matching brace pair starting AFTER
// the parameter list closes.
function extractFunction(src, name) {
  const startIdx = src.indexOf(`function ${name}(`);
  if (startIdx === -1) throw new Error(`Could not find function ${name}`);
  const parenStart = src.indexOf('(', startIdx);
  let pdepth = 0, j = parenStart;
  for (; j < src.length; j++) { if (src[j] === '(') pdepth++; else if (src[j] === ')') { pdepth--; if (pdepth === 0) break; } }
  const braceStart = src.indexOf('{', j);
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) break; } }
  return { full: src.slice(startIdx, i + 1), body: src.slice(braceStart + 1, i) };
}
const { full: autoOpenSrc, body: autoOpenBodySrc } = extractFunction(standaloneSrc, 'AutoOpenProduct');
console.log('--- Extracted AutoOpenProduct (verbatim from components/ProductPageStandalone.tsx) ---');
console.log(autoOpenSrc);

// Extract the real openProduct callback BODY (the arrow function passed to
// useCallback), and wrap it as a plain function taking the same context
// state it closes over in the real file, so it runs unmodified.
const openProductStart = storeContextSrc.indexOf('const openProduct = useCallback(');
const arrowStart = storeContextSrc.indexOf('(item: Product', openProductStart);
// Find the arrow function's own matching close (the `},\n    [baseOptions...` after it) —
// locate `,\n    [baseOptions` which marks the end of the callback + start of the deps array.
const depsMarker = storeContextSrc.indexOf('[baseOptions, sauceOptions, cheeseOptions, sauceStripeOptions, dipOptions, lp]', openProductStart);
const arrowBodyEnd = storeContextSrc.lastIndexOf('},', depsMarker) + 1; // include the closing brace
const openProductArrowSrc = storeContextSrc.slice(arrowStart, arrowBodyEnd);
console.log('\n--- Extracted openProduct callback body (verbatim from context/StoreContext.tsx) ---');
console.log(openProductArrowSrc.slice(0, 200) + ' ... (truncated in this log; full source is compiled and run)');

const FALLBACK_OPTION = [{ id: 'default', label: 'Default', delta: 0 }];

// Compile the real openProduct arrow function, providing exactly the
// context state/setters it closes over as real, tracked variables.
let capturedActiveProduct = null;
let capturedSelection = null;
const openProductModuleSrc = `
const FALLBACK_OPTION = ${JSON.stringify(FALLBACK_OPTION)};
function makeOpenProduct({ baseOptions, sauceOptions, cheeseOptions, sauceStripeOptions, dipOptions, lp, setActiveProduct, setSelection, setProductPageOpen, setUrl, trackViewItem, slugify }) {
  const openProduct = ${openProductArrowSrc};
  return openProduct;
}
module.exports = { makeOpenProduct };
`;
const compiledOpenProduct = ts.transpileModule(openProductModuleSrc, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, strict: false },
  fileName: 'extracted-openProduct.ts',
}).outputText;
const openProductMod = new Module('extracted-openProduct.js', null);
openProductMod._compile(compiledOpenProduct, 'extracted-openProduct.js');
const realOpenProduct = openProductMod.exports.makeOpenProduct({
  baseOptions: FALLBACK_OPTION, sauceOptions: FALLBACK_OPTION, cheeseOptions: FALLBACK_OPTION,
  sauceStripeOptions: FALLBACK_OPTION, dipOptions: FALLBACK_OPTION,
  lp: (p) => p,
  setActiveProduct: (p) => { capturedActiveProduct = p; },
  setSelection: (s) => { capturedSelection = s; },
  setProductPageOpen: () => {},
  setUrl: () => {},
  trackViewItem: () => {},
  slugify: (s) => s,
});

// Compile the real AutoOpenProduct component body, with a minimal (but
// generically correct, bug-agnostic) useEffect: run the effect callback
// immediately whenever its dep array differs from the previous call's,
// exactly matching React's own mount/update effect-firing rule for a
// component with a single effect and no cleanup.
const autoOpenModuleSrc = `
function ProductSkeleton() { return null; } // stubbed — this harness only cares whether/when openProduct() fires
function AutoOpenProduct(props, deps) {
  const useEffect = deps.useEffect;
  const useStore = deps.useStore;
  const useTranslations = deps.useTranslations;
  const { productId, productHint } = props;
  ${autoOpenBodySrc}
}
module.exports = { AutoOpenProduct };
`;
// The regex-replace above strips the real function's own signature line so
// we can splice in (props, deps) instead, while keeping literally every
// other real line (the useEffect call, the guard condition, the JSX
// returns) untouched.
const compiledAutoOpen = ts.transpileModule(autoOpenModuleSrc, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, strict: false },
  fileName: 'extracted-AutoOpenProduct.tsx',
}).outputText;
const React = require('react');
const autoOpenMod = new Module('extracted-AutoOpenProduct.js', null);
autoOpenMod.paths = Module._nodeModulePaths(ROOT);
autoOpenMod._compile(compiledAutoOpen, 'extracted-AutoOpenProduct.js');
const { AutoOpenProduct } = autoOpenMod.exports;

let prevDeps = null;
function runEffect(fn, currentDeps) {
  const changed = !prevDeps || currentDeps.length !== prevDeps.length || currentDeps.some((d, i) => !Object.is(d, prevDeps[i]));
  if (changed) fn();
  prevDeps = currentDeps;
}

function render(storeState) {
  return AutoOpenProduct(
    { productId: 'pizzat-0', productHint: rawProductRow },
    {
      useEffect: (fn, deps) => runEffect(fn, deps),
      useStore: () => storeState,
      useTranslations: () => ({ common: { loading: '' }, productPage: { loadingOptions: '', itemUnavailable: '' } }),
    }
  );
}

// RENDER 1 — mount, with the FIX in place: menuFullyLoaded starts FALSE
// regardless of whether SSR seeded initialData (unlike the old, buggy
// menuLoading gate — see Step 2). products holds the SSR-seeded product
// shape (no sizeOptions field at all, per Step 1) — but that no longer
// matters, because the effect's guard should now skip entirely.
render({
  products: ssrSeededProducts,
  menuFullyLoaded: false,
  openProduct: realOpenProduct,
  activeProduct: null,
});
check(
  capturedActiveProduct === null,
  'RENDER 1 (mount, real fetch still in flight): openProduct() correctly did NOT fire yet — the fix\'s whole point',
  String(capturedActiveProduct)
);

// RENDER 2 — the /api/menu fetch has now resolved. StoreContext.tsx's
// loadMenu() effect calls setProducts(blob.products) (the REAL,
// fully-normalized array, with real sizeOptions per Step 1) AND
// setMenuFullyLoaded(true), together, in the same `finally` block.
render({
  products: clientBlob.products, // the REAL, fully-normalized products (real sizeOptions)
  menuFullyLoaded: true,
  openProduct: realOpenProduct,
  activeProduct: null, // never got set prematurely this time
});
check(capturedActiveProduct !== null, 'RENDER 2 (fetch resolved): openProduct() now fires — activeProduct got set', capturedActiveProduct && capturedActiveProduct.id);
check(
  capturedSelection && capturedSelection.sizeOptions.length === 3,
  'RENDER 2: the captured selection now has the REAL 3-tier sizeOptions (base + Pannu + Perhe), not the fallback',
  JSON.stringify(capturedSelection && capturedSelection.sizeOptions)
);

// RENDER 3 — a later, unrelated re-render (e.g. the once-a-minute
// scheduled-offer clock tick elsewhere in StoreContext.tsx) must NOT
// re-open the product and clobber whatever the customer has since
// selected — same "only open once" contract as before the fix, just keyed
// off the right signal now.
const beforeSelection3 = capturedSelection;
render({
  products: clientBlob.products,
  menuFullyLoaded: true,
  openProduct: realOpenProduct,
  activeProduct: capturedActiveProduct, // now correctly set, from render 2
});
check(
  capturedSelection === beforeSelection3,
  'RENDER 3 (later re-render, product already correctly open): openProduct() does NOT fire again — no regression on the "only auto-open once" behavior'
);

// ---------------------------------------------------------------------
// STEP 5 — feed the FINAL selection.sizeOptions (post-fix) into the real,
// unmodified hasRealSizeTiers expression from components/ProductPage.tsx.
// ---------------------------------------------------------------------
console.log('\n=== STEP 5: what does the real hasRealSizeTiers expression do with the FIXED selection? ===');
const productPageSrc = fs.readFileSync(path.join(ROOT, 'components/ProductPage.tsx'), 'utf8');
const hrstMatch = productPageSrc.match(/const hasRealSizeTiers = (.+);/);
const hrstFn = new Function('selectionSizeOptions', `return ${hrstMatch[1].replace(/selection\.sizeOptions/g, 'selectionSizeOptions')};`);
check(
  hrstFn(capturedSelection.sizeOptions) === true,
  'hasRealSizeTiers(the real, post-fix selection) === true — the size selector now renders on the standalone product page',
  String(hrstFn(capturedSelection.sizeOptions))
);

console.log(`\n${passed} passed, ${failed} failed`);
console.log('\nConclusion: the data chain (option_groups/options -> normalizeMenuBlob) was');
console.log('ALREADY CORRECT (Step 1) — confirming Part 1\'s prior data-model fix was not the');
console.log('problem here. The actual break was in the SSR-hydration handoff, specifically:');
console.log('  (a) context/StoreContext.tsx: menuLoading initialized to `!initialData`, so it');
console.log('      stayed FALSE the whole time /api/menu was in flight whenever a Server');
console.log('      Component already seeded initialData (true for every standalone');
console.log('      /product/[id] page) — NOT just before the fetch started.');
console.log('  (b) components/ProductPageStandalone.tsx: AutoOpenProduct\'s effect guard used');
console.log('      to treat menuLoading===false as "data is ready" and call openProduct()');
console.log('      immediately, using the SSR-seeded product shape — which (per');
console.log('      normalizeProducts(), Step 1) never carries `sizeOptions` at all, unlike');
console.log('      toppingsEnabled which has a has_toppings fallback built into');
console.log('      openProduct() itself.');
console.log('  (c) That first, premature openProduct() call set activeProduct, and');
console.log('      AutoOpenProduct\'s own guard then permanently skipped every later run — so');
console.log('      when the real /api/menu fetch resolved moments later with the correct');
console.log('      3-tier sizeOptions, nothing ever re-opened the product to pick it up.');
console.log('');
console.log('FIX: a new `menuFullyLoaded` flag (context/StoreContext.tsx), decoupled from');
console.log('`menuLoading`, starts false regardless of `initialData` and only becomes true');
console.log('once the real /api/menu fetch has settled. AutoOpenProduct now gates on that');
console.log('instead — Renders 1-3 above show it correctly waiting, then opening exactly');
console.log('once with the real data, and not re-opening on a later unrelated re-render.');
console.log('This was a general SSR-hydration gap (any option kind could go stale this way on');
console.log('the standalone product page), but it\'s only VISIBLE for \'size\' because');
console.log('hasRealSizeTiers hides the whole section outright when it\'s the fallback —');
console.log('base/sauce/cheese/dip degrade to showing a single (technically also stale, but');
console.log('less visibly wrong) default choice instead of disappearing.');
process.exit(failed ? 1 : 0);
