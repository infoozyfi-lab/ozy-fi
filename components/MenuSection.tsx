'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/context/StoreContext';
import { useTranslations, useLocalePath } from '@/lib/i18n';

// Audit-fixes brief, Part 6.6 — this used to be a single hardcoded
// constant (132px), sized to cover the sticky <header> (components/
// Header.tsx) plus this file's own sticky .cat-tabs bar at their normal,
// no-banner heights. Header.tsx can also show a store-closed or
// scheduled-offer banner above its nav (same sticky header element, just
// taller) — when it does, everything below this offset was previously
// wrong: scrollToCat() undershot its target (leaving the top of a
// category hidden behind the now-taller sticky header) and the scroll-spy
// below flipped the active tab a bit early/late. FALLBACK_SCROLLSPY_OFFSET
// is only what renders before the effect below has measured the real
// layout at least once (matches this component's old fixed behavior for
// that brief instant, and is a safe floor if ResizeObserver is ever
// unavailable).
const FALLBACK_SCROLLSPY_OFFSET = 132;

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
  const tabsBarRef = useRef<HTMLDivElement | null>(null);

  // Audit-fixes brief, Part 6.6 — measured at runtime (see the effect
  // below) rather than assumed, so a store-closed/scheduled-offer banner
  // appearing or disappearing — or anything else that changes the sticky
  // header's real height (a long banner message wrapping to two lines on
  // a narrow phone, a locale switch to longer text, a browser font/zoom
  // difference) — is reflected automatically instead of needing another
  // hardcoded number for every case.
  const [headerHeight, setHeaderHeight] = useState(65);
  const [scrollspyOffset, setScrollspyOffset] = useState(FALLBACK_SCROLLSPY_OFFSET);

  useEffect(() => {
    const header = document.querySelector('header');
    const tabsBar = tabsBarRef.current;

    const measure = () => {
      const headerH = header ? header.getBoundingClientRect().height : 65;
      const tabsH = tabsBar ? tabsBar.getBoundingClientRect().height : 67;
      setHeaderHeight(Math.round(headerH));
      setScrollspyOffset(Math.round(headerH + tabsH));
    };

    measure();

    // ResizeObserver (not just a window "resize" listener) catches height
    // changes that don't come from the viewport resizing at all — the
    // store-closed/scheduled-offer banner appearing after /api/menu
    // resolves (this component can render before that fetch finishes),
    // or the menu data's locale/store-status flipping the banner on or
    // off later without any resize event ever firing.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro && header) ro.observe(header);
    if (ro && tabsBar) ro.observe(tabsBar);
    window.addEventListener('resize', measure);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
    // Re-attached whenever the category list changes shape, since that's
    // also when .cat-tabs itself is most likely to have just been added/
    // removed/resized (categories.length flips it between rendered and
    // not, onlyCategory switches it into per-category Link mode, etc.).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.length, onlyCategory]);

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
      scrollspyOffset;

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
            scrollspyOffset <=
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
    // scrollspyOffset included so this listener's `update()` closure never
    // runs against a stale offset captured from before the header's real
    // height was measured (see the offset-measuring effect above).
  }, [categories, scrollspyOffset]);

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

        {/* Audit-fixes brief, Part 6.6 — `top` here overrides globals.css's
            static `top: 65px` fallback with the header's actual measured
            height (see the effect above), so this bar sticks right below
            the real sticky header at whatever height it currently is,
            banner or no banner. */}
        <div className="cat-tabs" ref={tabsBarRef} style={{ top: headerHeight }}>
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
