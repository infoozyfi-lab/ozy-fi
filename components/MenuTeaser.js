'use client';

import Bundles from '@/components/Bundles';
import PopularNow from '@/components/PopularNow';
import { useTranslations } from '@/lib/i18n';

export default function MenuTeaser() {
  const t = useTranslations();

  const QUICK_CATEGORIES = [
    { id: 'pizzat', label: t.categories.pizza },
    { id: 'kebab', label: t.categories.kebab },
    { id: 'burgerit', label: t.categories.burgers },
  ];

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
          <p className="eyebrow">{t.menuTeaser.eyebrow}</p>
          <h2>{t.menuTeaser.heading}</h2>
        </div>
        <a href="#menu" className="btn-primary" onClick={goToMenu}>{t.menuTeaser.seeFullMenu}</a>
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
