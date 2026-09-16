'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useStore } from '@/context/StoreContext';
import { useTranslations, useLocalePath } from '@/lib/i18n';

const SCROLLSPY_OFFSET = 132;

export default function MenuSection({ onlyCategory = null }: { onlyCategory?: string | null }) {
  const {
    categories,
    products: items,
    menuLoading: loading,
    menuError: error,
  } = useStore();
  const t = useTranslations();
  const lp = useLocalePath();

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const activeTabRef = useRef<string | null>(null);

  useEffect(() => {
    if (categories.length > 0 && !activeTabRef.current) {
      activeTabRef.current = categories[0].id;
    }
  }, [categories]);

  const scrollToCat = (id: string) => {
    const el = sectionRefs.current[id];

    if (!el) return;

    const targetY =
      el.getBoundingClientRect().top +
      window.pageYOffset -
      SCROLLSPY_OFFSET;

    window.scrollTo({
      top: Math.max(0, targetY),
      behavior: 'smooth',
    });
  };

  const setActiveTab = (cat: string) => {
    if (activeTabRef.current === cat) return;

    // Original indexed tabRefs.current[null] when nothing was active yet —
    // in JS that coerces to the string key "null", which is never a real
    // category id, so `prev` ended up undefined either way. This ternary
    // reaches the same undefined result explicitly instead of relying on
    // that coercion, which strict mode's index-signature typing disallows.
    const prev = activeTabRef.current !== null ? tabRefs.current[activeTabRef.current] : undefined;

    if (prev) {
      prev.classList.remove('active');
    }

    const next = tabRefs.current[cat];

    if (next) {
      next.classList.add('active');

      next.scrollIntoView({
        behavior: 'auto',
        block: 'nearest',
        inline: 'center',
      });
    }

    activeTabRef.current = cat;
  };

  useEffect(() => {
    if (!categories.length) return;

    let ticking = false;

    const update = () => {
      ticking = false;

      let active = categories[0].id;

      for (const cat of categories) {
        const el = sectionRefs.current[cat.id];

        if (!el) continue;

        if (
          el.getBoundingClientRect().top -
            SCROLLSPY_OFFSET <=
          0
        ) {
          active = cat.id;
        } else {
          break;
        }
      }

      setActiveTab(active);
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    window.addEventListener('scroll', onScroll, {
      passive: true,
    });

    update();

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [categories]);

  if (loading) {
    return (
      <section id="menu">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">{t.menuSection.eyebrow}</p>
            <h2>{t.menuSection.heading}</h2>
            <p>{t.menuSection.loading}</p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section id="menu">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">{t.menuSection.eyebrow}</p>
            <h2>{t.menuSection.heading}</h2>
            <p>{error}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="menu">
      <div className="wrap">

        <div className="section-head">
          <p className="eyebrow">{t.menuSection.eyebrow}</p>

          <h2>{t.menuSection.heading}</h2>

          <p>
            {t.menuSection.description}
          </p>
        </div>

        <div className="cat-tabs">
          {categories.map((cat) => (
            onlyCategory ? (
              <Link
                key={cat.id}
                href={lp(`/menu/${cat.id}`)}
                className={`cat-tab${cat.id === onlyCategory ? ' active' : ''}`}
              >
                {cat.title}
              </Link>
            ) : (
              <button
                key={cat.id}
                type="button"
                ref={(el: HTMLButtonElement | null) => {
                  tabRefs.current[cat.id] = el;
                }}
                className={`cat-tab${
                  cat.id === categories[0]?.id
                    ? ' active'
                    : ''
                }`}
                onClick={() => scrollToCat(cat.id)}
              >
                {cat.title}
              </button>
            )
          ))}
        </div>

        {categories
          .filter((cat) => !onlyCategory || cat.id === onlyCategory)
          .map((cat) => (
          <div
            key={cat.id}
            id={cat.id}
            className="menu-category"
            ref={(el: HTMLDivElement | null) => {
              sectionRefs.current[cat.id] = el;
            }}
          >
            <h3 className="cat-title">
              {cat.title}
            </h3>

            <p className="cat-sub">
              {cat.sub}
            </p>

            {items
              .filter((item) => item.cat === cat.id)
              .map((item) => (
                <Link
                  key={item.id}
                  href={lp(`/product/${item.id}`)}
                  className="menu-item"
                >
                  <span className="menu-item-info">

                    <span className="name-row">
                      <h3>{item.name}</h3>

                      {item.tag && (
                        <span className="tag">
                          {item.tag}
                        </span>
                      )}
                    </span>

                    {item.desc && (
                      <p className="desc">
                        {item.desc}
                      </p>
                    )}

                    {/* price is typed optional (Product.price?) but always populated
                        for a real menu item — non-null assertion is a no-op fix
                        under strict mode. */}
                    <span className="price">
                      {item.price!.toFixed(2)} €
                    </span>

                  </span>

                  <span className="menu-item-thumb">

                    <img
                      src={item.image ?? undefined}
                      alt={item.name}
                      loading="lazy"
                    />

                    <span
                      className="add-btn"
                      aria-hidden="true"
                    >
                      +
                    </span>

                  </span>
                </Link>
              ))}
          </div>
        ))}

        <p className="menu-note">
          {t.menuSection.note}
        </p>

      </div>
    </section>
  );
}
