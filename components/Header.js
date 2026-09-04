'use client';

import { useState } from 'react';
import { useStore } from '@/context/StoreContext';

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { cartTotal, setCartOpen } = useStore();

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
      <nav className="nav wrap">
        <button className="logo" onClick={scrollTop} type="button">
          ozy<span>.fi</span>
        </button>
        <ul className="nav-links">
          <li><a href="#menu" onClick={scrollTo('menu')}>Menu</a></li>
          <li><a href="#story" onClick={scrollTo('story')}>Offers</a></li>
          <li><a href="#visit" onClick={scrollTo('visit')}>Gift cards</a></li>
        </ul>
        <div className="nav-order">
          <button className="cart-btn" type="button" onClick={() => setCartOpen(true)}>
            🛒 Cart <span>{cartTotal.toFixed(2)} €</span>
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
          <a href="#menu" onClick={scrollTo('menu')}>Menu</a>
          <a href="#story" onClick={scrollTo('story')}>Offers</a>
          <a href="#visit" onClick={scrollTo('visit')}>Gift cards</a>
        </div>
      </nav>
    </header>
  );
}
