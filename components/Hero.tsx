'use client';

import { useTranslations } from '@/lib/i18n';
import { useStore } from '@/context/StoreContext';
import { isOpenNow } from '@/lib/openingHours';

export default function Hero() {
  const t = useTranslations();
  // Round-2 fixes brief, Part 6 (item 2) — real open/closed state, not a
  // hardcoded "Open now". See lib/openingHours.ts for what this actually
  // checks (the manual store_closed override plus today's real
  // configured hours).
  const { storeClosed, openingHours } = useStore();
  const openNow = isOpenNow(openingHours, storeClosed);

  const QUICK_CATEGORIES = [
    { id: 'pizzat', label: t.categories.pizza, icon: '🍕' },
    { id: 'kebab', label: t.categories.kebab, icon: '🥙' },
    { id: 'burgerit', label: t.categories.burgers, icon: '🍔' },
  ];

  const goToCategory = (id: string) => {
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
          {/* Round-2 fixes brief, Part 6 (item 1) — "★ 4.8 · 320+ reviews"
              was hardcoded with no backing data anywhere (no reviews
              table, no AggregateRating structured data) — removed rather
              than inventing a review system to "back" it. */}
          <span className={`open${openNow ? '' : ' closed'}`}>● {openNow ? t.hero.openNow : t.hero.closedNow}</span>
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
