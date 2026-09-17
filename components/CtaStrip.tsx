'use client';

import { type MouseEvent } from 'react';
import { useTranslations } from '@/lib/i18n';

export default function CtaStrip() {
  const t = useTranslations();
  const goToMenu = (e: MouseEvent) => {
    e.preventDefault();
    document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <section className="cta-strip">
      <h2 className="display">{t.ctaStrip.heading}</h2>
      <p>{t.ctaStrip.text}</p>
      <a href="#menu" className="btn-primary" onClick={goToMenu}>{t.ctaStrip.cta}</a>
    </section>
  );
}
