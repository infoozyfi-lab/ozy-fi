'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { useTranslations } from '@/lib/i18n';

// Bundle 1 Task 5 — story banner slider. Auto-advances every 3.5s (a
// specific value in the brief's requested 3-4s range) with a cross-fade
// transition (never a slide/push — the brief specifically asked for a
// fade, "more elegant... fits this section's tone"). The first image
// gets the FULL interval before the first auto-advance (setInterval's
// own first tick already only fires after the full delay has elapsed —
// nothing here shortens that), plus manual dot/arrow controls so a
// visitor isn't stuck waiting on the timer.
const AUTO_ADVANCE_MS = 3500;

function StoryBannerSlider({ images }: { images: { url: string; alt: string }[] }) {
  const t = useTranslations();
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Respect prefers-reduced-motion for the AUTO-ADVANCE behavior
  // specifically (app/globals.css's existing global `@media
  // (prefers-reduced-motion: reduce)` rule already makes the cross-fade
  // itself instant instead of animated — this is the separate JS-level
  // check the brief also asks for: no automatic timer-driven advancing
  // at all, while manual controls keep working exactly the same).
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Reset to the first slide if the configured image list itself changes
  // shape (e.g. the admin removes images while a visitor's tab is open) —
  // avoids `index` ever pointing past the end of a shorter new list.
  useEffect(() => {
    setIndex(0);
  }, [images.length]);

  useEffect(() => {
    if (reducedMotion || images.length < 2) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
    // Re-armed whenever `index` changes (including from a manual
    // dot/arrow click) so a visitor who just manually advanced gets the
    // FULL interval again before the next auto-advance, rather than the
    // timer firing again almost immediately.
  }, [reducedMotion, images.length, index]);

  if (!images.length) {
    // No third-party network dependency, ever — a plain on-brand block
    // instead (see this component's header comment / the brief).
    return <div className="story-placeholder" aria-hidden="true" />;
  }

  const goTo = (next: number) => setIndex(((next % images.length) + images.length) % images.length);

  return (
    <>
      {images.map((img, i) => (
        <div key={img.url + i} className={`story-slide${i === index ? ' is-active' : ''}`} aria-hidden={i !== index}>
          <img src={img.url} alt={img.alt || t.story.bannerAltFallback(i)} loading={i === 0 ? 'eager' : 'lazy'} />
        </div>
      ))}
      {images.length > 1 && (
        <>
          <button type="button" className="story-arrow prev" onClick={() => goTo(index - 1)} aria-label={t.story.bannerPrev}>
            ‹
          </button>
          <button type="button" className="story-arrow next" onClick={() => goTo(index + 1)} aria-label={t.story.bannerNext}>
            ›
          </button>
          <div className="story-dots">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`story-dot${i === index ? ' is-active' : ''}`}
                onClick={() => goTo(i)}
                aria-label={t.story.bannerGoTo(i)}
                aria-current={i === index}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function Story() {
  const t = useTranslations();
  const { storyBannerImages } = useStore();

  return (
    <section className="story" id="story">
      <div className="wrap story-grid">
        <div className="story-figure">
          <StoryBannerSlider images={storyBannerImages} />
        </div>
        <div className="story-text">
          {/* Round-2 fixes brief, Part 6 (item 3) — t.story.p1/p2/p3 used to
              confidently tell a generic founding story with no real
              specifics behind it, while /about's own story section
              honestly labels itself a placeholder needing real content.
              Rather than inventing a story to paper over that
              inconsistency, this reuses the exact same
              .placeholder-block treatment (and the same
              t.about.storyPlaceholder copy) that /about already shows —
              so the homepage stops asserting a story that doesn't exist
              yet. If real story content is ever supplied, it should
              replace the placeholder in both places. */}
          <div className="placeholder-block">
            <span className="placeholder-eyebrow">{t.common.placeholderLabel}</span>
            <p>{t.about.storyPlaceholder}</p>
          </div>
          <div className="story-stats">
            <div><span className="num">100%</span><span className="lbl">{t.story.stat1Label}</span></div>
            <div><span className="num">60+</span><span className="lbl">{t.story.stat2Label}</span></div>
            <div><span className="num">7</span><span className="lbl">{t.story.stat3Label}</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
