// Real-execution verification for lib/hooks.ts's useHoldRepeat (Add-to-
// cart-improvements brief, item 7). Loads the REAL compiled hook and runs
// it against a tiny hand-written stand-in for React's hook runtime
// (useRef/useEffect only — the two primitives this hook actually uses),
// since a full React renderer isn't needed to exercise its real timer
// logic. Uses short delay/interval values (passed as real options, not a
// reimplementation) so this runs in well under a second.

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const Module = require('module');

const ROOT = path.resolve(__dirname, '../..');

// Minimal React stand-in — useHoldRepeat only calls useRef and useEffect,
// so this is a real (if tiny) implementation of those two primitives'
// actual contract for a single "mounted" hook instance, not a mock of
// useHoldRepeat's own behavior.
const cleanups = [];
function useRef(initial) {
  return { current: initial };
}
function useEffect(fn) {
  const cleanup = fn();
  if (typeof cleanup === 'function') cleanups.push(cleanup);
}
global.window = global.window || {};
window.setTimeout = setTimeout;
window.clearTimeout = clearTimeout;
window.setInterval = setInterval;
window.clearInterval = clearInterval;

const REACT_STUB = path.join(__dirname, '__react-stub-hold-repeat.js');
fs.writeFileSync(REACT_STUB, 'module.exports = { useRef: global.__useRef, useEffect: global.__useEffect };');
global.__useRef = useRef;
global.__useEffect = useEffect;

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'react') return REACT_STUB;
  return origResolve.call(this, request, parent, isMain, options);
};

Module._extensions['.ts'] = function (module, filename) {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  module._compile(out, filename);
};

const { useHoldRepeat } = require(path.join(ROOT, 'lib/hooks.ts'));

let passed = 0, failed = 0;
function check(cond, label, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${detail !== undefined ? ' :: ' + JSON.stringify(detail) : ''}`);
  if (cond) passed++; else failed++;
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  // --- Plain tap: pointerdown then pointerup+click quickly (well under
  // the delay), then a real click event — should fire onFire exactly once.
  {
    let fireCount = 0;
    const handlers = useHoldRepeat(() => { fireCount++; }, { delay: 40, interval: 15 });
    handlers.onPointerDown({});
    await sleep(5);
    handlers.onPointerUp({});
    let clickPrevented = false;
    handlers.onClick({ preventDefault: () => { clickPrevented = true; } });
    check(fireCount === 1, 'a plain quick tap fires onFire exactly once (via onClick, not onPointerDown)', fireCount);
    check(!clickPrevented, 'a plain tap does not preventDefault the click', clickPrevented);
  }

  // --- Held past the delay: should repeat multiple times, then the
  // trailing click (which browsers still dispatch on release) must be
  // swallowed rather than firing one extra time.
  {
    let fireCount = 0;
    const handlers = useHoldRepeat(() => { fireCount++; }, { delay: 40, interval: 15 });
    handlers.onPointerDown({});
    await sleep(120); // 40ms delay + several 15ms repeats
    handlers.onPointerUp({});
    const countAfterHold = fireCount;
    check(countAfterHold >= 3, 'holding past the delay fires multiple repeats', countAfterHold);

    let prevented = false;
    handlers.onClick({ preventDefault: () => { prevented = true; } });
    check(fireCount === countAfterHold, 'the trailing click after a hold does not fire one extra time', { before: countAfterHold, after: fireCount });
    check(prevented, 'the trailing click after a hold is explicitly prevented', prevented);
  }

  // --- Releasing (pointerup) before the delay elapses cancels the
  // pending repeat-start timer entirely — no repeats should ever fire.
  {
    let fireCount = 0;
    const handlers = useHoldRepeat(() => { fireCount++; }, { delay: 40, interval: 15 });
    handlers.onPointerDown({});
    await sleep(10);
    handlers.onPointerUp({});
    await sleep(80);
    check(fireCount === 0, 'releasing before the delay elapses fires no repeats at all', fireCount);
  }

  // --- pointerleave / pointercancel also stop an in-progress hold (e.g.
  // dragging the finger off the button on a touch device).
  {
    let fireCount = 0;
    const handlers = useHoldRepeat(() => { fireCount++; }, { delay: 40, interval: 15 });
    handlers.onPointerDown({});
    await sleep(60);
    const afterStart = fireCount;
    handlers.onPointerLeave({});
    await sleep(80);
    check(fireCount === afterStart, 'onPointerLeave stops further repeats', { afterStart, final: fireCount });
  }

  // --- Default delay/interval (500ms/120ms) are applied when no options
  // are passed — checked via source inspection rather than a slow
  // real-time wait, to keep this harness fast.
  {
    const src = fs.readFileSync(path.join(ROOT, 'lib/hooks.ts'), 'utf8');
    check(/delay = 500/.test(src), 'default delay is 500ms per the brief');
    check(/interval = 120/.test(src), 'default interval is 120ms per the brief');
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  fs.unlinkSync(REACT_STUB);
  process.exit(failed ? 1 : 0);
}

main();
