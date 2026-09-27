// Add-to-cart-improvements brief, item 6 — "flying to cart" animation.
// Plain DOM/CSS, no React, no new dependency: a small cloned "ghost" of
// the item's thumbnail is absolutely positioned over the real element and
// transitioned toward the cart indicator, then discarded. The cart's own
// state always updates instantly and independently of this — this module
// only adds an optional visual flourish on top.
//
// Respect for `prefers-reduced-motion: reduce` happens right here, at the
// single entry point every call site uses, so no call site needs to
// remember to check it itself.

const GHOST_CLASS = 'fly-to-cart-ghost';
const GHOST_SIZE = 64; // px — the ghost's fixed on-screen size before it shrinks toward the cart

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function extractImageSrc(sourceEl: HTMLElement): string | null {
  if (sourceEl instanceof HTMLImageElement && sourceEl.src) return sourceEl.src;
  const img = sourceEl.querySelector('img');
  return img && img.src ? img.src : null;
}

function getCartTarget(): { x: number; y: number } {
  // components/OrderBar.tsx always renders an element carrying this
  // attribute — either the real visible count badge (bar showing) or a
  // fixed invisible placeholder in the same spot (bar hidden, e.g. the
  // very first add to an empty cart) — so this always finds a target.
  const target = typeof document !== 'undefined' ? document.querySelector('[data-cart-fly-target]') : null;
  if (target) {
    const rect = target.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  // Defensive fallback if the attribute is ever missing for some reason —
  // bottom-left of the viewport is roughly where the order bar/its
  // placeholder always sits.
  return { x: 34, y: (typeof window !== 'undefined' ? window.innerHeight : 800) - 34 };
}

/**
 * Fires the flying-thumbnail animation from `sourceEl`'s current on-screen
 * position to the cart indicator. `sourceEl` may be the `<img>` itself, or
 * any container that has one inside it (e.g. a clicked button/card passed
 * via `e.currentTarget`). Safe to call with `null` (no-op) so call sites
 * never need their own null-guard. Never throws, never blocks the actual
 * add-to-cart logic — this is purely additive.
 */
export function triggerFlyToCart(sourceEl: HTMLElement | null): void {
  if (!sourceEl || typeof document === 'undefined') return;
  if (prefersReducedMotion()) return; // cart state itself always still updates — see call sites

  try {
    const src = extractImageSrc(sourceEl);
    const sourceRect = sourceEl.getBoundingClientRect();
    if (sourceRect.width === 0 && sourceRect.height === 0) return; // element not actually visible

    const startX = sourceRect.left + sourceRect.width / 2;
    const startY = sourceRect.top + sourceRect.height / 2;
    const target = getCartTarget();

    const ghost = document.createElement('div');
    ghost.className = GHOST_CLASS;
    ghost.style.left = `${startX - GHOST_SIZE / 2}px`;
    ghost.style.top = `${startY - GHOST_SIZE / 2}px`;
    ghost.style.width = `${GHOST_SIZE}px`;
    ghost.style.height = `${GHOST_SIZE}px`;
    ghost.style.opacity = '1';
    ghost.style.transform = 'translate(0, 0) scale(1)';
    if (src) ghost.style.backgroundImage = `url(${JSON.stringify(src).slice(1, -1)})`;
    else ghost.style.background = 'var(--ember, #FF6A3D)';

    document.body.appendChild(ghost);

    const dx = target.x - startX;
    const dy = target.y - startY;

    // Force layout so the browser registers the starting position before
    // the transform below is applied — otherwise the transition can be
    // skipped and the ghost would just "appear" already at the target.
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    ghost.getBoundingClientRect();

    requestAnimationFrame(() => {
      ghost.style.transform = `translate(${dx}px, ${dy}px) scale(0.15)`;
      ghost.style.opacity = '0.4';
    });

    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      ghost.remove();
    };
    ghost.addEventListener('transitionend', remove, { once: true });
    // Safety-net fallback (mirrors components/OrderBar.tsx's own
    // DOM-event+timeout pattern) in case `transitionend` never fires —
    // a hidden tab, a removed element, or an unusual browser quirk.
    window.setTimeout(remove, 900);
  } catch {
    // Never let a purely cosmetic animation break the real add-to-cart flow.
  }
}
