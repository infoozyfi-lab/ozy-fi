'use client';

import Bundles from '@/components/Bundles';
import PopularNow from '@/components/PopularNow';

const QUICK_CATEGORIES = [
  { id: 'pizzat', label: 'Pizza' },
  { id: 'kebab', label: 'Kebab' },
  { id: 'burgerit', label: 'Burgers' },
];

export default function MenuTeaser() {
  const goToMenu = (e) => {
    e.preventDefault();
    document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const goToCategory = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="menu-teaser">
      <div className="wrap">
        <div className="section-head">
          <p className="eyebrow">HUNGRY ALREADY?</p>
          <h2>Fresh pizza, kebab and burgers</h2>
        </div>
        <a href="#menu" className="btn-primary" onClick={goToMenu}>See full menu</a>
        <div className="teaser-cats">
          {QUICK_CATEGORIES.map((cat) => (
            <button key={cat.id} type="button" className="cat-tab" onClick={() => goToCategory(cat.id)}>
              {cat.label}
            </button>
          ))}
        </div>
        <PopularNow />
      </div>
      <Bundles />
    </section>
  );
}
