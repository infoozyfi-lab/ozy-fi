'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/context/StoreContext';
import { useTranslations, useLocalePath } from '@/lib/i18n';
import { findFuzzyMatch, fuzzyContains, suggestClosestName, type FuzzyMatch } from '@/lib/fuzzyMatch';
import { getRecentSearches, addRecentSearch } from '@/lib/recentSearches';

// Search-improvements brief, item 2 — wraps the matched portion of
// `text` in a <mark>, using the {start,end} span findFuzzyMatch already
// computed against this SAME text (lowercased) — never re-searches here,
// so the highlight can never disagree with why a result matched. Renders
// plain text unchanged when there's no match to show (a query that only
// matched a DIFFERENT field, e.g. the other locale's name — see this
// component's own comment below on that pre-existing, unchanged edge
// case — or no query at all).
function Highlight({ text, match }: { text: string; match: FuzzyMatch | null }) {
  if (!match) return <>{text}</>;
  return (
    <>
      {text.slice(0, match.start)}
      <mark className="search-hl">{text.slice(match.start, match.end)}</mark>
      {text.slice(match.end)}
    </>
  );
}

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

export default function MenuSection({
  onlyCategory = null,
  // Round-2 fixes brief, Part 2 — this component's own "Full menu"
  // heading was previously always an <h2>, identically on the homepage,
  // the plain /menu page, and every /menu/[category] page, and no page in
  // that set had an <h1> at all. Callers now say what they need:
  // - Homepage (components/HomePageClient.tsx) doesn't pass either prop —
  //   unchanged <h2>, exactly as before this brief.
  // - The plain /menu page (via MenuPageClient.tsx) passes headingTag="h1"
  //   — "Full menu" genuinely is this page's own heading.
  // - A /menu/[category] page passes hideHeading — MenuPageClient.tsx
  //   renders a real, category-specific <h1> of its own instead (from the
  //   category's actual title, not this generic text), so keeping this
  //   generic "Full menu" heading here too would be a redundant H1
  //   immediately followed by a near-identical, misleading H2 (this
  //   isn't "the full menu", it's one category of it).
  hideHeading = false,
  headingTag = 'h2',
}: {
  onlyCategory?: string | null;
  hideHeading?: boolean;
  headingTag?: 'h1' | 'h2';
}) {
  const HeadingTag = headingTag;
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

  // Priority-fixes brief (roadmap gap analysis), Bundle 1 Task 2 — menu
  // search. Client-side only, against the already-loaded `items` — no new
  // API endpoint, matches the brief. Matched against Product.searchText
  // (lib/menu-i18n.ts's normalizeProducts), which carries both locales'
  // name/description already lowercased, so a query typed in either
  // language finds a match regardless of which locale is currently shown.
  //
  // Search-improvements brief, item 1 — `fuzzyContains` (lib/
  // fuzzyMatch.ts) replaces the old plain `.includes(query)` substring
  // check with the same exact-substring fast path PLUS a small
  // Levenshtein-based tolerance for a 1-2 character typo (e.g. "bologna"
  // still finds "Bolognese" — see that file's own test harness for the
  // worked example against this project's real menu data). Item 3
  // ("search ingredient/description text too") needs no separate change
  // here at all: `searchText` already concatenates name + description in
  // both locales (see normalizeProducts's own comment) — it was already
  // being searched, just via plain substring matching; it's now searched
  // with the same typo tolerance as the name.
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const matchesSearch = (item: (typeof items)[number]) => !query || fuzzyContains(item.searchText || '', query);
  const totalMatches = query ? items.filter(matchesSearch).length : items.length;

  // Search-improvements brief, item 4 — recent searches (localStorage,
  // per-visitor UI convenience — see lib/recentSearches.ts's own
  // comment). Loaded once on mount (a plain array in state, not read
  // fresh from storage on every render) and updated locally whenever a
  // search is recorded, so this component never needs to re-read
  // localStorage mid-session.
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);
  // Item 4 — shown only "when the search input is focused and empty"
  // (the brief's own wording), so this needs to track focus separately
  // from the search text itself.
  const [searchFocused, setSearchFocused] = useState(false);
  const recordSearch = () => {
    if (search.trim()) setRecentSearches(addRecentSearch(search));
  };

  // Search-improvements brief, item 5 — "did you mean". Only computed
  // (and only ever shown) once a search has genuinely come up with zero
  // results — reuses the exact same fuzzy-match module as item 1, just
  // against the full catalog of real product names instead of one
  // product's own searchText. useMemo'd since this runs the (still
  // small, but non-trivial) full-catalog scan — no need to redo it on
  // every render while typing continues to match something, or while
  // nothing has changed.
  const didYouMean = useMemo(
    () => (query && totalMatches === 0 ? suggestClosestName(query, items.map((i) => i.name)) : null),
    [query, totalMatches, items]
  );

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
            {!hideHeading && <HeadingTag>{t.menuSection.heading}</HeadingTag>}
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
            {!hideHeading && <HeadingTag>{t.menuSection.heading}</HeadingTag>}
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

          {!hideHeading && <HeadingTag>{t.menuSection.heading}</HeadingTag>}

          <p>
            {t.menuSection.description}
          </p>

          {/* Priority-fixes brief (roadmap gap analysis), Bundle 1 Task 2 —
              menu search input. Placed in section-head (above the
              sticky cat-tabs bar) so it's reachable at a glance and
              stays out of the sticky-header height measurement above. */}
          <div className="menu-search">
            <input
              type="search"
              className="menu-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              // Search-improvements brief, item 4 — a search is "recorded"
              // once the customer is done typing it (blur), not on every
              // keystroke; recordSearch() itself no-ops on an empty value.
              // The recent-searches dropdown below is what would normally
              // disappear on this same blur before a tap on one of its
              // buttons can register — each of those buttons uses
              // onMouseDown+preventDefault (see below) specifically to
              // avoid that race, a standard, well-known fix for this exact
              // input-blur-vs-dropdown-click interaction.
              onBlur={() => { setSearchFocused(false); recordSearch(); }}
              placeholder={t.menuSection.searchPlaceholder}
              aria-label={t.menuSection.searchLabel}
            />
            {search && (
              <button
                type="button"
                className="menu-search-clear"
                onClick={() => setSearch('')}
                aria-label={t.menuSection.clearSearch}
              >
                ×
              </button>
            )}
            {/* Search-improvements brief, item 4 — recent searches, shown
                only while the input is focused AND empty (the brief's own
                condition), as quick-tap suggestions. */}
            {searchFocused && !search && recentSearches.length > 0 && (
              <div className="menu-search-recent" role="listbox" aria-label={t.menuSection.recentSearchesHeading}>
                <p className="menu-search-recent-heading">{t.menuSection.recentSearchesHeading}</p>
                {recentSearches.map((q) => (
                  <button
                    type="button"
                    key={q}
                    className="menu-search-recent-item"
                    // Keeps the input focused through the click so this
                    // isn't wiped by onBlur before onClick ever fires —
                    // see this input's own onBlur comment above.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setSearch(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
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

        {/* Priority-fixes brief (roadmap gap analysis), Bundle 1 Task 2 —
            while a search is active, a category with zero matches is
            skipped entirely (rather than rendered with an empty item
            list) so the results read as "here's what matched", not a
            page of empty category headers. */}
        {query && totalMatches === 0 && (
          <div className="menu-search-empty">
            <p className="menu-search-empty-heading">{t.menuSection.noResultsHeading}</p>
            <p>{t.menuSection.noResults(search.trim())}</p>
            {/* Search-improvements brief, item 5 — "did you mean". Tapping
                it re-runs the search as a normal typed query (not a
                separate code path), so every existing behavior (fuzzy
                matching, highlighting, category filtering) applies to it
                identically. */}
            {didYouMean && (
              <button
                type="button"
                className="menu-search-suggestion"
                onClick={() => setSearch(didYouMean)}
              >
                {t.menuSection.didYouMean(didYouMean)}
              </button>
            )}
          </div>
        )}

        {categories
          .filter((cat) => !onlyCategory || cat.id === onlyCategory)
          .map((cat) => ({ cat, catItems: items.filter((item) => item.cat === cat.id && matchesSearch(item)) }))
          .filter(({ catItems }) => !query || catItems.length > 0)
          .map(({ cat, catItems }) => (
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

            {catItems
              .map((item) => {
                // Search-improvements brief, item 2 — computed per
                // displayed field (name, description), independently,
                // against that field's OWN text — never derived from the
                // combined searchText match used for filtering above,
                // since searchText mixes in the other locale's name/
                // description too. A query that only matched, say, the
                // Finnish name while the English UI is showing still
                // surfaces the product (unchanged, pre-existing bilingual
                // search behavior — see normalizeProducts's own comment)
                // but simply shows no highlight, since the actual matching
                // text isn't visible on screen to highlight. `null` (no
                // query, or no match in this particular field) renders as
                // plain unhighlighted text — see Highlight's own comment.
                const nameMatch = query ? findFuzzyMatch(item.name.toLowerCase(), query) : null;
                const descMatch = query && item.desc ? findFuzzyMatch(item.desc.toLowerCase(), query) : null;
                return (
                <Link
                  key={item.id}
                  href={lp(`/product/${item.id}`)}
                  className="menu-item"
                >
                  <span className="menu-item-info">

                    <span className="name-row">
                      <h3><Highlight text={item.name} match={nameMatch} /></h3>

                      {item.tag && (
                        <span className="tag">
                          {item.tag}
                        </span>
                      )}
                    </span>

                    {item.desc && (
                      <p className="desc">
                        <Highlight text={item.desc} match={descMatch} />
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
                );
              })}
          </div>
        ))}

        <p className="menu-note">
          {t.menuSection.note}
        </p>

      </div>
    </section>
  );
}
