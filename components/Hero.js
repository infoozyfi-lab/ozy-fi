'use client';

import { useTranslations } from '@/lib/i18n';

export default function Hero() {
  const t = useTranslations();

  const QUICK_CATEGORIES = [
    { id: 'pizzat', label: t.categories.pizza, icon: '🍕' },
    { id: 'kebab', label: t.categories.kebab, icon: '🥙' },
    { id: 'burgerit', label: t.categories.burgers, icon: '🍔' },
  ];

  const goToCategory = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="hero">
      <div className="wrap">
        <p className="eyebrow">{t.hero.eyebrow}</p>
        <h1 className="hero-title display">
          {t.hero.titleStart} <em>{t.hero.titleEm}</em>
        </h1>
        <p className="hero-meta">
          <span className="stars">★ 4.8</span>
          <span>{t.hero.reviews}</span>
          <span className="sep">|</span>
          <span className="open">● {t.hero.openNow}</span>
          <span className="sep">|</span>
          <span>{t.hero.etaRange}</span>
        </p>
        <p className="hero-sub">
          {t.hero.subtitle}
        </p>
        <div className="hero-cats">
          {QUICK_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className="hero-cat"
              onClick={() => goToCategory(cat.id)}
            >
              <div className="hero-cat-icon">{cat.icon}</div>
              <div className="hero-cat-label">{cat.label}</div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
