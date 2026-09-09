'use client';

import Link from 'next/link';
import { useTranslations, useLocalePath } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function Footer() {
  const t = useTranslations();
  const lp = useLocalePath();

  const scrollTop = (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const scrollTo = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <footer>
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <a href="#top" className="logo" onClick={scrollTop}>ozy<span>.fi</span></a>
            <p style={{ color: 'var(--muted)', marginTop: 14, maxWidth: '32ch' }}>
              {t.footer.tagline}
            </p>
            <LanguageSwitcher />
          </div>
          <div>
            <h4>{t.footer.pagesHeading}</h4>
            <a href="#menu" onClick={scrollTo('menu')}>{t.header.menu}</a>
            <a href="#story" onClick={scrollTo('story')}>{t.footer.ourStory}</a>
            <a href="#visit" onClick={scrollTo('visit')}>{t.footer.findUs}</a>
            <Link href={lp('/track')}>{t.header.trackOrder}</Link>
            <Link href={lp('/privacy')}>{t.footer.privacyPolicy}</Link>
            <Link href={lp('/terms')}>{t.footer.terms}</Link>
          </div>
          <div>
            <h4>{t.footer.contactHeading}</h4>
            <a href="mailto:hello@ozy.fi">hello@ozy.fi</a>
            <a href="tel:0400000000">040 000 0000</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>{t.footer.rights(new Date().getFullYear())}</span>
          <span>{t.footer.demoNotice}</span>
        </div>
      </div>
    </footer>
  );
}
