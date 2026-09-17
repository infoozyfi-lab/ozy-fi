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
          <p>{t.story.p1}</p>
          <p>{t.story.p2}</p>
          <p>{t.story.p3}</p>
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
