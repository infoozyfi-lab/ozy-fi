// Real-execution verification for lib/flyToCart.ts (Add-to-cart-
// improvements brief, item 6). Loads the REAL compiled module against a
// small hand-written DOM stand-in (no jsdom available in this sandbox —
// no npm registry access, same disclosed limitation as every prior
// delivery on this project) that implements just the handful of DOM APIs
// this module actually calls: document.querySelector/createElement/body,
// element.getBoundingClientRect/style/classList, addEventListener, and
// window.matchMedia/requestAnimationFrame/setTimeout.

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const Module = require('module');

const ROOT = path.resolve(__dirname, '../..');

function makeFakeElement(tag) {
  const listeners = {};
  return {
    tagName: tag,
    style: {},
    children: [],
    src: '',
    attrs: {},
    className: '',
    appendChild(child) { this.children.push(child); return child; },
    querySelector(sel) {
      if (sel === 'img') return this.children.find((c) => c.tagName === 'img') || null;
      return null;
    },
    getBoundingClientRect() {
      return this._rect || { left: 0, top: 0, width: 40, height: 40 };
    },
    addEventListener(evt, fn, _opts) { (listeners[evt] = listeners[evt] || []).push(fn); },
    __fire(evt) { (listeners[evt] || []).forEach((fn) => fn()); },
    remove() { this.__removed = true; },
  };
}

function makeFakeDocument() {
  const body = makeFakeElement('body');
  const registered = [];
  return {
    body,
    createElement(tag) {
      const el = makeFakeElement(tag);
      registered.push(el);
      return el;
    },
    querySelector(sel) {
      // Only ever queried for '[data-cart-fly-target]' by this module.
      return this.__target || null;
    },
    __registered: registered,
  };
}

let matches = false;
global.window = {
  matchMedia: (q) => ({ matches: q.includes('reduce') ? matches : false }),
  setTimeout: (...a) => setTimeout(...a),
  innerHeight: 800,
};
global.document = makeFakeDocument();
global.requestAnimationFrame = (fn) => { fn(); return 1; };
global.HTMLImageElement = function HTMLImageElement() {}; // for `instanceof` checks

const REACT_LESS_TS_LOADER = true; // no react involved in this module at all
Module._extensions['.ts'] = function (module, filename) {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  module._compile(out, filename);
};

const { triggerFlyToCart } = require(path.join(ROOT, 'lib/flyToCart.ts'));

let passed = 0, failed = 0;
function check(cond, label, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${detail !== undefined ? ' :: ' + JSON.stringify(detail) : ''}`);
  if (cond) passed++; else failed++;
}

// --- null source is a safe no-op.
{
  let threw = false;
  try { triggerFlyToCart(null); } catch { threw = true; }
  check(!threw, 'calling with a null sourceEl never throws');
}

// --- prefers-reduced-motion: reduce -> no ghost element created at all.
{
  matches = true;
  global.document = makeFakeDocument();
  global.document.__target = makeFakeElement('span');
  global.document.__target._rect = { left: 300, top: 700, width: 26, height: 26 };
  const source = makeFakeElement('button');
  source._rect = { left: 20, top: 20, width: 60, height: 60 };
  const img = makeFakeElement('img');
  img.src = 'https://example.com/pizza.jpg';
  source.children.push(img);

  triggerFlyToCart(source);
  check(global.document.__registered.length === 0, 'prefers-reduced-motion suppresses the flying ghost entirely (no element created)');
}

// --- Normal motion: a ghost is created, positioned from the source's own
// rect, carries the image found inside the source container, and is
// transitioned toward the [data-cart-fly-target] element's position.
{
  matches = false;
  global.document = makeFakeDocument();
  const target = makeFakeElement('span');
  target._rect = { left: 300, top: 700, width: 26, height: 26 };
  global.document.__target = target;

  const source = makeFakeElement('button');
  source._rect = { left: 20, top: 20, width: 60, height: 60 };
  const img = makeFakeElement('img');
  img.src = 'https://example.com/pizza.jpg';
  source.children.push(img);

  triggerFlyToCart(source);

  check(global.document.__registered.length === 1, 'a ghost element is created for a normal (non-reduced-motion) add');
  const ghost = global.document.__registered[0];
  check(ghost.className === 'fly-to-cart-ghost', 'the ghost carries the real .fly-to-cart-ghost class (styled in app/globals.css)');
  check(ghost.style.backgroundImage.includes('pizza.jpg'), 'the ghost\'s background image is the real <img> found inside the clicked source element', ghost.style.backgroundImage);
  check(global.document.body.children.includes(ghost), 'the ghost is appended to document.body');
  // Started at the source's own center (20+30, 20+30 = 50,50), moving
  // toward the target's center (300+13, 700+13 = 313,713) — dx=263, dy=663.
  check(/translate\(263px, 663px\) scale\(0\.15\)/.test(ghost.style.transform), 'the ghost transitions toward the real cart-indicator target\'s exact position (not a guessed/fixed offset)', ghost.style.transform);

  ghost.__fire('transitionend');
  check(ghost.__removed === true, 'the ghost cleans itself up on transitionend (no leaked DOM nodes)');
}

// --- No [data-cart-fly-target] found (defensive fallback) — still flies
// somewhere sane (bottom-left) rather than throwing or silently no-op'ing.
{
  matches = false;
  global.document = makeFakeDocument();
  global.document.__target = null;
  const source = makeFakeElement('button');
  source._rect = { left: 20, top: 20, width: 60, height: 60 };

  let threw = false;
  try { triggerFlyToCart(source); } catch { threw = true; }
  check(!threw, 'missing the cart-indicator target falls back gracefully instead of throwing');
  check(global.document.__registered.length === 1, 'still creates and flies the ghost using the fallback position');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
