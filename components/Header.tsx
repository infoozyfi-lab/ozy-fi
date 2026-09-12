'use client';

import { useState, useEffect, useRef, type MouseEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '@/context/StoreContext';
import { useTranslations, useLocalePath } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { goToCheckoutDirect, cart, storeClosed, activeScheduledOffer } = useStore();
  const pathname = usePathname();
  const t = useTranslations();
  const lp = useLocalePath();
  const navRef = useRef<HTMLElement>(null);
  const itemCount = cart.reduce((sum, line) => sum + line.qty, 0);

  // The homepage is now /fi or /en (not just "/") — this is what the
  // header uses to decide between "scroll to section on this page" links
  // and real cross-page <Link>s to the homepage's anchors.
  const isHome = pathname === lp('/');

  // Belt-and-suspenders: whichever link was tapped, once the route
  // actually changes, make sure the mobile menu is closed.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Tapping anywhere outside the open mobile menu closes it.
  useEffect(() => {
    if (!mobileOpen) return;

    const handleOutside = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [mobileOpen]);

  const scrollTo = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    setMobileOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollTop = (e: MouseEvent) => {
    e.preventDefault();
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header>
      {storeClosed && (
        <div className="store-closed-banner">
          {t.header.storeClosedBanner}
        </div>
      )}
      {/* Growth features batch 2 (Feature 5) — homepage banner for
          whichever scheduled offer is active right now. Hidden whenever
          storeClosed is also true — advertising a discount while not
          taking orders would be misleading. Reuses the exact same
          site-wide-banner slot/pattern as storeClosed above (this
          Header renders on every page via StoreProvider); a SEPARATE
          banner is added inside CheckoutModal.tsx for "shown ... in
          checkout" (the checkout overlay is a full-screen takeover that
          covers this Header entirely — see app/globals.css's
          .checkout-page). */}
      {!storeClosed && activeScheduledOffer && (
        <div className="store-closed-banner scheduled-offer-banner">
          {t.header.scheduledOfferBanner(activeScheduledOffer.label, activeScheduledOffer.discountPercent)}
        </div>
      )}
      <nav className="nav wrap" ref={navRef}>
        {isHome ? (
          <button className="logo" onClick={scrollTop} type="button">
            ozy<span>.fi</span>
          </button>
        ) : (
          <Link className="logo" href={lp('/')} onClick={() => setMobileOpen(false)}>
            ozy<span>.fi</span>
          </Link>
        )}
        <ul className="nav-links">
          {isHome ? (
            <>
              <li><a href="#menu" onClick={scrollTo('menu')}>{t.header.menu}</a></li>
              <li><a href="#story" onClick={scrollTo('story')}>{t.header.offers}</a></li>
              <li><a href="#visit" onClick={scrollTo('visit')}>{t.header.giftCards}</a></li>
            </>
          ) : (
            <>
              <li><Link href={lp('/menu')}>{t.header.menu}</Link></li>
              <li><Link href={lp('/#story')}>{t.header.offers}</Link></li>
              <li><Link href={lp('/#visit')}>{t.header.giftCards}</Link></li>
            </>
          )}
          <li><Link href={lp('/track')}>{t.header.trackOrder}</Link></li>
        </ul>
        <div className="nav-order">
          <LanguageSwitcher />
          <button className="cart-icon-btn" type="button" aria-label={t.header.cartAriaLabel} onClick={goToCheckoutDirect}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M7 8V6.5C7 4.01472 9.01472 2 11.5 2H12.5C14.9853 2 17 4.01472 17 6.5V8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M5.5 8H18.5L19.3 20.2C19.393 21.601 18.283 22.79 16.879 22.79H7.121C5.717 22.79 4.607 21.601 4.7 20.2L5.5 8Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
            {itemCount > 0 && <span className="cart-icon-badge">{itemCount}</span>}
          </button>
        </div>
        <button
          className="burger"
          aria-label={t.header.openMenuAriaLabel}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          type="button"
        >
          <span></span><span></span><span></span>
        </button>
        <div className={`mobile-nav${mobileOpen ? ' open' : ''}`}>
          {isHome ? (
            <>
              <a href="#menu" onClick={scrollTo('menu')}>{t.header.menu}</a>
              <a href="#story" onClick={scrollTo('story')}>{t.header.offers}</a>
              <a href="#visit" onClick={scrollTo('visit')}>{t.header.giftCards}</a>
            </>
          ) : (
            <>
              <Link href={lp('/menu')} onClick={() => setMobileOpen(false)}>{t.header.menu}</Link>
              <Link href={lp('/#story')} onClick={() => setMobileOpen(false)}>{t.header.offers}</Link>
              <Link href={lp('/#visit')} onClick={() => setMobileOpen(false)}>{t.header.giftCards}</Link>
            </>
          )}
          <Link href={lp('/track')} onClick={() => setMobileOpen(false)}>{t.header.trackOrder}</Link>
          <LanguageSwitcher className="mobile-nav-lang" />
        </div>
      </nav>
    </header>
  );
}
