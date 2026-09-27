'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/context/StoreContext';

// Add-to-cart-improvements brief, item 8 — small "Added!" confirmation
// toast, shown in addition to (not instead of) the flying-to-cart
// animation and the cart-count update. No existing toast/snackbar pattern
// exists anywhere else in this codebase (checked components/, app/,
// lib/), so this is a small new one, styled to match the site's existing
// pill-shaped, ember-accented visual language (see .added-toast in
// app/globals.css) rather than inventing a new look.
//
// Reads `addedNotice` from StoreContext, which every real cart-mutating
// action sets (see StoreContext.tsx's notifyItemAdded) — this component
// itself has no cart logic at all, it's purely the visual.
export default function AddedToast() {
  const { addedNotice } = useStore();
  const [visibleKey, setVisibleKey] = useState<number | null>(null);

  // A separate `show` boolean (rather than just "is addedNotice non-null")
  // is what lets the toast animate: mount off-screen/transparent first,
  // then flip to `.show` on the next frame so the CSS transition actually
  // runs, instead of the element appearing already in its final state.
  useEffect(() => {
    if (!addedNotice) return;
    const id = requestAnimationFrame(() => setVisibleKey(addedNotice.key));
    return () => cancelAnimationFrame(id);
  }, [addedNotice]);

  if (!addedNotice) return null;

  return (
    <div className={`added-toast${visibleKey === addedNotice.key ? ' show' : ''}`} role="status" aria-live="polite">
      {addedNotice.message}
    </div>
  );
}
