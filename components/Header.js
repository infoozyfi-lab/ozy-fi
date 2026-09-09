'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '@/context/StoreContext';

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { goToCheckoutDirect, cart, storeClosed } = useStore();
  const pathname = usePathname();
  const navRef = useRef(null);
  const itemCount = cart.reduce((sum, line) => sum + line.qty, 0);

  // Belt-and-suspenders: whichever link was tapped, once the route
  // actually changes, make sure the mobile menu is closed.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Tapping anywhere outside the open mobile menu closes it.
  useEffect(() => {
    if (!mobileOpen) return;

    const handleOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [mobileOpen]);

  const scrollTo = (id) => (e) => {
    e.preventDefault();
    setMobileOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollTop = (e) => {
    e.preventDefault();
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header>
      {storeClosed && (
        <div className="store-closed-banner">
          We&apos;re temporarily closed and not taking new orders right now.
        </div>
      )}
      <nav className="nav wrap" ref={navRef}>
        {pathname === '/' ? (
          <button className="logo" onClick={scrollTop} type="button">
            ozy<span>.fi</span>
          </button>
        ) : (
          <Link className="logo" href="/" onClick={() => setMobileOpen(false)}>
            ozy<span>.fi</span>
          </Link>
        )}
        <ul className="nav-links">
          {pathname === '/' ? (
            <>
              <li><a href="#menu" onClick={scrollTo('menu')}>Menu</a></li>
              <li><a href="#story" onClick={scrollTo('story')}>Offers</a></li>
              <li><a href="#visit" onClick={scrollTo('visit')}>Gift cards</a></li>
            </>
          ) : (
            <>
              <li><Link href="/menu">Menu</Link></li>
              <li><Link href="/#story">Offers</Link></li>
              <li><Link href="/#visit">Gift cards</Link></li>
            </>
          )}
          <li><a href="/track">Track order</a></li>
        </ul>
        <div className="nav-order">
          <button className="cart-icon-btn" type="button" aria-label="Cart" onClick={goToCheckoutDirect}>
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
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          type="button"
        >
          <span></span><span></span><span></span>
        </button>
        <div className={`mobile-nav${mobileOpen ? ' open' : ''}`}>
          {pathname === '/' ? (
            <>
              <a href="#menu" onClick={scrollTo('menu')}>Menu</a>
              <a href="#story" onClick={scrollTo('story')}>Offers</a>
              <a href="#visit" onClick={scrollTo('visit')}>Gift cards</a>
            </>
          ) : (
            <>
              <Link href="/menu" onClick={() => setMobileOpen(false)}>Menu</Link>
              <Link href="/#story" onClick={() => setMobileOpen(false)}>Offers</Link>
              <Link href="/#visit" onClick={() => setMobileOpen(false)}>Gift cards</Link>
            </>
          )}
          <a href="/track" onClick={() => setMobileOpen(false)}>Track order</a>
        </div>
      </nav>
    </header>
  );
}
