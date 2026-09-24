'use client';

import { useTranslations } from '@/lib/i18n';
import { useStore } from '@/context/StoreContext';
import { isOpenNow, getNextTransition } from '@/lib/openingHours';

export default function Hero() {
  const t = useTranslations();
  // Round-2 fixes brief, Part 6 (item 2) — real open/closed state, not a
  // hardcoded "Open now". See lib/openingHours.ts for what this actually
  // checks (the manual store_closed override plus today's real
  // configured hours).
  const { storeClosed, openingHours, specialHours } = useStore();
  // Computed from a single `now` so isOpenNow/getNextTransition can never
  // read either side of a minute boundary and disagree with each other.
  const now = new Date();
  const openNow = isOpenNow(openingHours, storeClosed, now, specialHours);

  // Priority-fixes brief (roadmap gap analysis), Part 5 — "next opening/
  // closing time" messaging, e.g. "Closed — opens at 11:00" instead of a
  // bare "Closed now". Falls back to the plain openNow/closedNow copy
  // whenever getNextTransition() has nothing specific to say (manual
  // store_closed override on, no configured hours at all, or the next
  // opening is more than a day out — where naming a weekday further away
  // would need Finnish grammatical inflection this codebase has no
  // existing translation table for, so it's left as a plain "Closed"
  // rather than guessing).
  const transition = getNextTransition(openingHours, storeClosed, now, specialHours);
  let statusText = openNow ? t.hero.openNow : t.hero.closedNow;
  if (transition) {
    if (transition.isOpen) {
      statusText = t.hero.openClosesAt(transition.time);
    } else if (transition.daysAhead === 0) {
      statusText = t.hero.closedOpensAt(transition.time);
    } else if (transition.daysAhead === 1) {
      statusText = t.hero.closedOpensAtDay(t.hero.tomorrow, transition.time);
    }
  }

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
          <span className={`open${openNow ? '' : ' closed'}`}>● {statusText}</span>
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
