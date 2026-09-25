// Real-execution verification for the "fake pushState URL causes a real
// 404 on refresh" bug report.
//
// Three independent things are checked here, each against the REAL
// source (never a re-implementation):
//   1. middleware.ts's real exported `middleware()` function — run
//      through a mocked next/server + @/lib/i18n/locales exactly as
//      Next.js would call it, for every one of the 5 confirmed fake
//      paths plus a battery of real-route/edge cases (this file focuses
//      on the OTHER two checks; middleware.ts's own dedicated harness —
//      see /tmp .../middleware_runtime_verify.js output captured in the
//      delivery report — already exercises this function directly; it's
//      re-run here too so this single file is the one source of truth
//      for "did this round's fix work").
//   2. context/StoreContext.tsx's real openProduct() source text — proves
//      the pushed URL now uses the product's real `id`, not a slugified
//      name, and that the old `slugify` helper has no remaining caller.
//   3. context/StoreContext.tsx's real restore-on-mount effect body,
//      extracted by brace-matching and executed with a mocked
//      pathname/sessionStorage/state-setters — proves it only restores
//      checkout/drinks when there's a real saved cart to restore FOR,
//      and leaves every other path (including /order-confirmed and
//      /bundle, and a real route like /menu) untouched.

const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '../..');
let passed = 0, failed = 0;
function check(cond, label, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${detail !== undefined ? ' :: ' + JSON.stringify(detail) : ''}`);
  if (cond) passed++; else failed++;
}

// =======================================================================
// PART 1 — middleware.ts, real function, mocked next/server + locales
// =======================================================================
{
  class FakeNextResponse {
    constructor(kind, extra) { this.kind = kind; Object.assign(this, extra); this._cookies = []; this.cookies = { set: (n, v, o) => this._cookies.push({ n, v, o }) }; }
    static next() { return new FakeNextResponse('next', {}); }
    static redirect(url, status) { return new FakeNextResponse('redirect', { url: url.pathname + (url.search || ''), status }); }
    static rewrite(url) { return new FakeNextResponse('rewrite', { url: url.pathname + (url.search || '') }); }
  }
  const isLocale = (v) => v === 'fi' || v === 'en';

  const origResolve = Module._resolveFilename;
  const origLoad = Module._load;
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === 'next/server' || request === '@/lib/i18n/locales') return `\0fake:${request}`;
    return origResolve.call(this, request, parent, isMain, options);
  };
  Module._load = function (request, parent, isMain) {
    if (request === 'next/server') return { NextRequest: class {}, NextResponse: FakeNextResponse };
    if (request === '@/lib/i18n/locales') return { DEFAULT_LOCALE: 'fi', LOCALE_COOKIE: 'ozy_locale', isLocale };
    return origLoad.call(this, request, parent, isMain);
  };

  const mwPath = path.join(ROOT, 'middleware.ts');
  const src = fs.readFileSync(mwPath, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true },
    fileName: mwPath,
  }).outputText;
  const tmpFile = path.join(ROOT, '__mw_test_tmp__.js');
  fs.writeFileSync(tmpFile, out);
  let middleware;
  try {
    delete require.cache[require.resolve(tmpFile)];
    middleware = require(tmpFile).middleware;
  } finally {
    fs.unlinkSync(tmpFile);
  }
  Module._resolveFilename = origResolve;
  Module._load = origLoad;

  function req(pathname, search = '') {
    return { nextUrl: { pathname, search, clone() { return { pathname: this.pathname, search: this.search }; } }, cookies: { get: () => undefined } };
  }

  const FAKE_PATHS = ['/fi/checkout', '/fi/drinks', '/fi/order-confirmed', '/fi/bundle'];
  for (const p of FAKE_PATHS) {
    const res = middleware(req(p));
    check(res.kind === 'rewrite' && res.url === '/fi/menu', `${p} refresh no longer 404s — rewritten to the real /fi/menu page (address bar stays ${p})`, res);
  }
  {
    const res = middleware(req('/fi/product/margherita-pizza'));
    check(res.kind === 'next', '/fi/product/<slug> is untouched by middleware — the id-based fix (Part 2 below) is what actually resolves it now', res);
  }
  {
    const res = middleware(req('/fi/menu'));
    check(res.kind === 'next', 'a real route (/fi/menu) is never rewritten', res);
  }
}

// =======================================================================
// PART 2 — StoreContext.tsx's real openProduct(): pushes the product's
// real id, not a slugified name; `slugify` has no remaining caller.
// =======================================================================
{
  const scPath = path.join(ROOT, 'context/StoreContext.tsx');
  const src = fs.readFileSync(scPath, 'utf8');

  const openProductIdx = src.indexOf('const openProduct = useCallback(');
  check(openProductIdx !== -1, 'openProduct is still defined (found in real source)');
  const openProductChunk = src.slice(openProductIdx, openProductIdx + 4000);

  check(
    /setUrl\(lp\(`\/product\/\$\{item\.id\}`\)\)/.test(openProductChunk),
    'openProduct() real source now pushes `/product/${item.id}` — the exact id app/(site)/[locale]/product/[id]/page.tsx looks up with',
  );
  check(
    !/setUrl\(lp\(`\/product\/\$\{slugify\(item\.name\)\}`\)\)/.test(openProductChunk),
    'openProduct() real source no longer pushes a slugified-name URL (the old, mismatched id scheme)',
  );
  check(
    !/function slugify\(/.test(src),
    'the now-dead `slugify` helper was removed from the real source entirely (had no other caller)',
  );
}

// =======================================================================
// PART 3 — StoreContext.tsx's real restore-on-mount effect, extracted
// and executed with mocked pathname/sessionStorage/setters.
// =======================================================================
{
  const scPath = path.join(ROOT, 'context/StoreContext.tsx');
  const src = fs.readFileSync(scPath, 'utf8');

  const marker = "afterLocale !== '/checkout' && afterLocale !== '/drinks'";
  const markerIdx = src.indexOf(marker);
  check(markerIdx !== -1, 'restore-on-mount effect body found in real source (via its real branch condition)');
  const effectStart = src.lastIndexOf('useEffect(() => {', markerIdx);
  check(effectStart !== -1, 'restore-on-mount effect useEffect(...) call found in real source');
  // Grab the callback body between the effect's opening brace and its
  // matching closing brace (simple depth counter — same brace-matching
  // approach as prior rounds' harnesses).
  const bodyStart = src.indexOf('{', effectStart + 'useEffect(() => '.length);
  let depth = 0, i = bodyStart, bodyEnd = -1;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { bodyEnd = i; break; } }
  }
  check(bodyEnd !== -1, 'restore-on-mount effect body brace-matched cleanly');
  const effectBody = src.slice(bodyStart + 1, bodyEnd);

  // Execute the REAL extracted body in a sandbox with mocked bindings —
  // same technique prior rounds used to test a hook body without a full
  // React render.
  function runEffect({ pathname, locale, savedCart }) {
    const calls = [];
    const sessionStorage = {
      getItem: (k) => (k === 'ozy_cart' ? (savedCart === undefined ? null : JSON.stringify(savedCart)) : null),
    };
    const setCartOpen = (v) => calls.push(['setCartOpen', v]);
    const setCheckoutOpen = (v) => calls.push(['setCheckoutOpen', v]);
    const setDrinkUpsellOpen = (v) => calls.push(['setDrinkUpsellOpen', v]);
    const window = {}; // typeof window !== 'undefined' guard
    const fn = new Function(
      'pathname', 'locale', 'window', 'sessionStorage',
      'setCartOpen', 'setCheckoutOpen', 'setDrinkUpsellOpen',
      effectBody
    );
    fn(pathname, locale, window, sessionStorage, setCartOpen, setCheckoutOpen, setDrinkUpsellOpen);
    return calls;
  }

  {
    const calls = runEffect({ pathname: '/fi/checkout', locale: 'fi', savedCart: [{ key: 'x', qty: 1 }] });
    check(
      JSON.stringify(calls) === JSON.stringify([['setCartOpen', false], ['setDrinkUpsellOpen', false], ['setCheckoutOpen', true]]),
      '/fi/checkout + non-empty saved cart -> reopens checkout (cart intact)',
      calls,
    );
  }
  {
    const calls = runEffect({ pathname: '/fi/checkout', locale: 'fi', savedCart: [] });
    check(calls.length === 0, '/fi/checkout + EMPTY saved cart -> does nothing (nothing real to restore)', calls);
  }
  {
    const calls = runEffect({ pathname: '/fi/checkout', locale: 'fi', savedCart: undefined });
    check(calls.length === 0, '/fi/checkout + NO saved cart at all (first-ever visit) -> does nothing', calls);
  }
  {
    const calls = runEffect({ pathname: '/fi/drinks', locale: 'fi', savedCart: [{ key: 'x', qty: 2 }] });
    check(
      JSON.stringify(calls) === JSON.stringify([['setCartOpen', false], ['setCheckoutOpen', false], ['setDrinkUpsellOpen', true]]),
      '/fi/drinks + non-empty saved cart -> reopens the drink-upsell step',
      calls,
    );
  }
  {
    const calls = runEffect({ pathname: '/fi/order-confirmed', locale: 'fi', savedCart: [{ key: 'x', qty: 1 }] });
    check(calls.length === 0, '/fi/order-confirmed -> deliberately does nothing (no replayed confirmation, even with a cart present)', calls);
  }
  {
    const calls = runEffect({ pathname: '/fi/bundle', locale: 'fi', savedCart: [{ key: 'x', qty: 1 }] });
    check(calls.length === 0, '/fi/bundle -> deliberately does nothing (no persisted bundle data to restore from)', calls);
  }
  {
    const calls = runEffect({ pathname: '/fi/menu', locale: 'fi', savedCart: [{ key: 'x', qty: 1 }] });
    check(calls.length === 0, '/fi/menu (a real, non-overlay route) -> does nothing', calls);
  }
  {
    const calls = runEffect({ pathname: '/en/checkout', locale: 'en', savedCart: [{ key: 'x', qty: 1 }] });
    check(calls.some(c => c[0] === 'setCheckoutOpen' && c[1] === true), 'English-locale /en/checkout also restores correctly (locale-prefix stripping works for both locales)', calls);
  }
  {
    // Malformed sessionStorage content must not throw.
    let threw = false;
    try {
      const calls = [];
      const sessionStorage = { getItem: () => '{not json' };
      const fn = new Function('pathname', 'locale', 'window', 'sessionStorage', 'setCartOpen', 'setCheckoutOpen', 'setDrinkUpsellOpen', effectBody);
      fn('/fi/checkout', 'fi', {}, sessionStorage, () => calls.push('cartOpen'), () => calls.push('checkoutOpen'), () => calls.push('drinkOpen'));
      check(calls.length === 0, 'corrupt sessionStorage JSON is caught and treated as "no cart" (does not open checkout, does not throw)', calls);
    } catch (e) {
      threw = true;
      check(false, 'corrupt sessionStorage JSON must not throw', String(e));
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
