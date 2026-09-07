'use client';

import Bundles from '@/components/Bundles';

export default function MenuTeaser() {
  const goToMenu = (e) => {
    e.preventDefault();
    document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="menu-teaser">
      <div className="wrap">
        <div className="section-head">
          <p className="eyebrow">HUNGRY ALREADY?</p>
          <h2>Fresh pizza, kebab and burgers</h2>
        </div>
        <a href="#menu" className="btn-primary" onClick={goToMenu}>See full menu</a>
      </div>
      <Bundles />
    </section>
  );
}
