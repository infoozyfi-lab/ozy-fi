'use client';

import { useTranslations } from '@/lib/i18n';

export default function Story() {
  const t = useTranslations();
  return (
    <section className="story" id="story">
      <div className="wrap story-grid">
        <div className="story-figure">
          <img
            src="https://www.sourcesplash.com/i/random?q=pizza%20oven%20kitchen&w=700&h=875"
            alt="Fresh pizza coming out of the oven at ozy.fi"
            loading="lazy"
          />
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
