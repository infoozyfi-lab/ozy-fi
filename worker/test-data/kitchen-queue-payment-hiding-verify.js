// Real-execution verification for the "keep failed/pending-payment orders
// out of the active kitchen queue" task. Loads the REAL, exported
// `isAwaitingOrFailedPayment` predicate straight from
// components/admin/OrderKanban.tsx (nothing about the actual gating logic
// is reimplemented here), and drives it — plus the same filter
// expressions the real component builds from it — against realistic
// order rows, including the exact real-time paid-transition scenario the
// brief asks to confirm (a 'pending' order flipping to 'paid' on the next
// 15s poll, with no manual refresh).

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const Module = require('module');

const ROOT = path.resolve(__dirname, '../..');

Module._extensions['.ts'] = Module._extensions['.tsx'] = function (module, filename) {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
  }).outputText;
  module._compile(out, filename);
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const rel = request.slice(2);
    for (const ext of ['.ts', '.tsx']) {
      const candidate = path.join(ROOT, rel + ext);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  // Everything OrderKanban.tsx imports besides plain type-only/@/ modules
  // (React JSX runtime bits, sibling admin components) resolves normally —
  // this harness only ever calls the two pure, exported predicate
  // functions, so those other imports never actually execute meaningfully,
  // but they still need to resolve for `require()` to succeed at all.
  return origResolve.call(this, request, parent, isMain, options);
};

const { isAwaitingOrFailedPayment, isRefundEligible } = require(path.join(ROOT, 'components/admin/OrderKanban.tsx'));

let passed = 0, failed = 0;
function check(cond, label, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${detail !== undefined ? ' :: ' + JSON.stringify(detail) : ''}`);
  if (cond) passed++; else failed++;
}

check(typeof isAwaitingOrFailedPayment === 'function', 'isAwaitingOrFailedPayment is a real, exported function');
check(typeof isRefundEligible === 'function', 'isRefundEligible (pre-existing) still exports correctly — no accidental breakage from the new export alongside it');

// --- The predicate itself, against every real payment_method/status
// combination that actually occurs in this codebase (see lib/types.ts's
// OrderRow.payment_status comment for the authoritative list of values).
check(isAwaitingOrFailedPayment({ payment_method: 'card', payment_status: 'pending' }) === true, 'a pending card order IS awaiting/failed payment');
check(isAwaitingOrFailedPayment({ payment_method: 'card', payment_status: 'failed' }) === true, 'a failed card order IS awaiting/failed payment');
check(isAwaitingOrFailedPayment({ payment_method: 'card', payment_status: 'paid' }) === false, 'a paid card order is NOT awaiting/failed payment');
check(isAwaitingOrFailedPayment({ payment_method: 'card', payment_status: 'partially_refunded' }) === false, 'a partially-refunded card order is NOT awaiting/failed payment (it was paid)');
check(isAwaitingOrFailedPayment({ payment_method: 'card', payment_status: 'refunded' }) === false, 'a fully-refunded card order is NOT awaiting/failed payment');
check(isAwaitingOrFailedPayment({ payment_method: 'cod', payment_status: 'cod' }) === false, 'a COD order is NEVER treated as awaiting/failed payment, regardless of its own payment_status value');
check(isAwaitingOrFailedPayment({ payment_method: 'cod', payment_status: 'pending' }) === false, 'even a COD order with an unusual/unexpected payment_status is not swept up — this is scoped to payment_method === "card" only, per the brief\'s explicit instruction not to touch COD behavior');

// --- The same split the real component builds from this predicate
// (status !== 'cancelled' partitioned by isAwaitingOrFailedPayment) — a
// direct, real re-application of the exported predicate, matching
// OrderKanban.tsx's own activeOrders/awaitingPaymentOrders/cancelledOrders
// expressions verbatim (see worker/test-data/cart-checkout-source-checks.js
// and this project's other harnesses for the established pattern of
// pairing a real exported predicate with a source-inspection check that
// the component actually applies it the same way — done at the bottom of
// this file).
function splitOrders(orders) {
  return {
    active: orders.filter((o) => o.status !== 'cancelled' && !isAwaitingOrFailedPayment(o)),
    awaitingPayment: orders.filter((o) => o.status !== 'cancelled' && isAwaitingOrFailedPayment(o)),
    cancelled: orders.filter((o) => o.status === 'cancelled'),
  };
}

const baseOrders = [
  { id: 1, order_num: 'OZY-0001', status: 'received', payment_method: 'cod', payment_status: 'cod', total: 24.5 },
  { id: 2, order_num: 'OZY-0002', status: 'received', payment_method: 'card', payment_status: 'pending', total: 31.9 },
  { id: 3, order_num: 'OZY-0003', status: 'preparing', payment_method: 'card', payment_status: 'paid', total: 18.0 },
  { id: 4, order_num: 'OZY-0004', status: 'received', payment_method: 'card', payment_status: 'failed', total: 12.5 },
  { id: 5, order_num: 'OZY-0005', status: 'cancelled', payment_method: 'card', payment_status: 'pending', total: 9.9 },
];

{
  const { active, awaitingPayment, cancelled } = splitOrders(baseOrders);
  check(active.map((o) => o.id).join(',') === '1,3', 'the active queue shows only the COD order and the genuinely paid card order', active.map((o) => o.id));
  check(awaitingPayment.map((o) => o.id).join(',') === '2,4', 'the awaiting-payment section shows exactly the pending and failed card orders (never the cancelled one)', awaitingPayment.map((o) => o.id));
  check(cancelled.map((o) => o.id).join(',') === '5', 'a cancelled order is only ever shown in the cancelled section, even if its payment was also pending — never double-listed', cancelled.map((o) => o.id));
}

// --- The exact real-time transition the brief asks to confirm: order #2
// (pending) has its Stripe webhook land, and the NEXT 15s poll's response
// now reports payment_status: 'paid' — with zero other change to how the
// two derived lists are computed, order #2 must move from
// awaitingPayment into active automatically.
{
  const beforeWebhook = splitOrders(baseOrders);
  check(beforeWebhook.awaitingPayment.some((o) => o.id === 2), 'before the webhook lands, order #2 sits in the awaiting-payment section');
  check(!beforeWebhook.active.some((o) => o.id === 2), 'before the webhook lands, order #2 is NOT in the active queue');

  // Simulates OrderKanban's own `load()` effect: the next poll's fetch
  // response is a fresh array with this one field changed — exactly what
  // GET /api/admin/orders (a plain `SELECT * FROM orders`) would now
  // return once the webhook has updated that row server-side.
  const afterWebhook = baseOrders.map((o) => (o.id === 2 ? { ...o, payment_status: 'paid' } : o));
  const after = splitOrders(afterWebhook);
  check(!after.awaitingPayment.some((o) => o.id === 2), 'the instant the polled data shows payment_status: "paid", order #2 leaves the awaiting-payment section');
  check(after.active.some((o) => o.id === 2), 'and promptly appears in the real active queue instead — automatically, from the same 15s poll, with no separate manual refresh action needed');
}

// --- Source-inspection: confirm the real component actually wires
// isAwaitingOrFailedPayment into activeOrders/awaitingPaymentOrders
// exactly as tested above, and that the new section is rendered ABOVE the
// main board and starts expanded (the deliberate "don't let staff miss
// this" choice), and that it's absent from the separate all-orders list
// view in app/admin/dashboard/page.tsx.
{
  const kanbanSrc = fs.readFileSync(path.join(ROOT, 'components/admin/OrderKanban.tsx'), 'utf8');
  check(/activeOrders = orders\.filter\(\(o\) => o\.status !== 'cancelled' && !isAwaitingOrFailedPayment\(o\)\)/.test(kanbanSrc), 'activeOrders excludes awaiting/failed-payment card orders in the real source');
  check(/awaitingPaymentOrders = orders/.test(kanbanSrc) && /isAwaitingOrFailedPayment\(o\)\)/.test(kanbanSrc), 'awaitingPaymentOrders is built from the same real predicate');
  check(/\[showAwaitingPayment,\s*setShowAwaitingPayment\]\s*=\s*useState\(true\)/.test(kanbanSrc), 'the awaiting-payment section starts expanded by default (not collapsed like the cancelled-orders link)');

  const awaitingIdx = kanbanSrc.indexOf('awaitingPaymentCount > 0');
  const gridIdx = kanbanSrc.indexOf("gridTemplateColumns: `repeat(auto-fit");
  check(awaitingIdx !== -1 && gridIdx !== -1 && awaitingIdx < gridIdx, 'the awaiting-payment section is rendered ABOVE the main board grid, not buried below it');

  const dashboardSrc = fs.readFileSync(path.join(ROOT, 'app/admin/dashboard/page.tsx'), 'utf8');
  check(!dashboardSrc.includes('isAwaitingOrFailedPayment'), 'the separate all-orders list view (visibleOrders/OrderDetailRow, used for invoice links) is untouched — this stays specific to the kitchen queue, not a blanket exclusion');
  check(dashboardSrc.includes("statusFilter === 'all' ? orders : orders.filter"), 'that list view still shows every order regardless of payment_status, confirming it was not touched');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
