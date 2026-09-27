'use client';

import { useEffect, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';

// A simple module-level counter rather than per-hook-instance state — this
// is what makes nested/simultaneous modals (e.g. a ConfirmModal opened from
// inside CheckoutModal) work correctly: the background only unlocks once
// EVERY currently-open modal using this hook has closed, not as soon as the
// first of several does. `overflow: hidden` is idempotent (setting it twice
// changes nothing), so the actual DOM write only needs to happen on the
// 0->1 and 1->0 transitions — tracked here with the counter.
let lockCount = 0;
let previousOverflow: string | null = null;

function lock() {
  if (typeof document === 'undefined') return;
  lockCount += 1;
  if (lockCount === 1) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
}

function unlock() {
  if (typeof document === 'undefined') return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = previousOverflow ?? '';
    previousOverflow = null;
  }
}

/**
 * Locks background page scroll while `isOpen` is true — used by every
 * modal/overlay in this app (CheckoutModal, ProductPage, BundleModal,
 * ConfirmModal, DrinkUpsellModal, admin's MyAccountModal) so the page
 * behind an open modal never scrolls or visibly shifts. Safe to use in
 * several components at once (see the module-level counter above) and
 * cleans up correctly on unmount even if the component never transitions
 * `isOpen` back to false itself (e.g. a modal that's only ever unmounted,
 * never explicitly "closed" first).
 */
export function useBodyScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;
    lock();
    return () => {
      unlock();
    };
  }, [isOpen]);
}

export interface HoldRepeatOptions {
  /** Delay (ms) before the first repeated fire after pressing down. Default 500. */
  delay?: number;
  /** Interval (ms) between repeated fires once repeating has started. Default 120. */
  interval?: number;
}

export interface HoldRepeatHandlers {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
  onPointerLeave: (e: ReactPointerEvent) => void;
  onPointerCancel: (e: ReactPointerEvent) => void;
  onClick: (e: ReactMouseEvent) => void;
}

/**
 * Add-to-cart-improvements brief, item 7 — "hold to increase quantity".
 * Wraps a qty stepper's +/- button so holding it (not just tapping) fires
 * `onFire` continuously: after an initial `delay` (default 500ms), then
 * every `interval`ms (default 120ms) until released.
 *
 * Deliberately does NOT fire on `pointerdown` itself — only a plain tap
 * (a real `click` event) fires `onFire` once, exactly like before this
 * hook existed. This matters for two reasons: (1) it avoids double-firing
 * a tap (one pointerdown fire + one click fire), and (2) keyboard and
 * screen-reader activation only ever dispatches a `click` event, never
 * pointer events at all — routing the single-fire case through the
 * button's native `onClick` (not a synthetic call inside this hook) is
 * what keeps that accessible path working unchanged.
 *
 * When a hold DID repeat, the click that still fires on release (browsers
 * dispatch `click` after `pointerup` regardless of how long the press
 * was) is suppressed via `didRepeatRef`, so releasing after a long hold
 * doesn't also fire one extra "normal" tap on top of the repeats.
 *
 * The underlying callbacks this is used with (setQty/updateCartQty/
 * setFillingQty) already self-clamp at their own bounds, so this hook has
 * no clamping logic of its own — it only decides *when* to call `onFire`.
 */
export function useHoldRepeat(onFire: () => void, options?: HoldRepeatOptions): HoldRepeatHandlers {
  const { delay = 500, interval = 120 } = options ?? {};
  const onFireRef = useRef(onFire);
  onFireRef.current = onFire;

  const delayTimerRef = useRef<number | null>(null);
  const intervalTimerRef = useRef<number | null>(null);
  const didRepeatRef = useRef(false);

  const clearTimers = () => {
    if (delayTimerRef.current != null) {
      window.clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    if (intervalTimerRef.current != null) {
      window.clearInterval(intervalTimerRef.current);
      intervalTimerRef.current = null;
    }
  };

  const onPointerDown: HoldRepeatHandlers['onPointerDown'] = () => {
    didRepeatRef.current = false;
    clearTimers();
    delayTimerRef.current = window.setTimeout(() => {
      didRepeatRef.current = true;
      onFireRef.current();
      intervalTimerRef.current = window.setInterval(() => {
        onFireRef.current();
      }, interval);
    }, delay);
  };

  const stop = () => {
    clearTimers();
  };

  // Cleanup if the component unmounts mid-hold (e.g. the cart line this
  // stepper belongs to gets removed by the very repeat it's mid-firing).
  useEffect(() => stop, []);

  return {
    onPointerDown,
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onClick: (e) => {
      if (didRepeatRef.current) {
        // A hold already fired one or more repeats — swallow the trailing
        // click so releasing doesn't also count as one more plain tap.
        e.preventDefault();
        didRepeatRef.current = false;
        return;
      }
      onFireRef.current();
    },
  };
}
