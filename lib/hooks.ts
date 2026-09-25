'use client';

import { useEffect } from 'react';

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
