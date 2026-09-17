'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocalePath } from '@/lib/i18n';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const t = useTranslations();
  const lp = useLocalePath();

  useEffect(() => {
    try {
      if (!localStorage.getItem('ozy_cookie_consent')) {
        setVisible(true);
      }
    } catch {
      // Storage unavailable — just don't show the banner rather than error.
    }
  }, []);

  const saveConsent = (value: 'necessary' | 'all') => {
    setVisible(false);
    setSettingsOpen(false);
    try {
      localStorage.setItem('ozy_cookie_consent', value);
      localStorage.setItem('ozy_cookie_consent_date', new Date().toISOString());
    } catch {
      // Nothing to do — worst case it shows again next visit.
    }
    // Lets TrackingScripts load (or not) immediately, without needing a
    // page reload, the moment the customer makes a choice.
    window.dispatchEvent(new Event('ozy-consent-updated'));
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label={t.cookieBanner.dialogAriaLabel}>
      <div className="cookie-banner-main">
        <p>
          {t.cookieBanner.message(
            <Link href={lp('/privacy')}>{t.cookieBanner.privacyPolicyLinkText}</Link>
          )}
        </p>
        <div className="cookie-banner-actions">
          <button type="button" className="cookie-btn cookie-btn-ghost" onClick={() => setSettingsOpen((v) => !v)}>
            {t.cookieBanner.cookieSettings}
          </button>
          <button type="button" className="cookie-btn cookie-btn-outline" onClick={() => saveConsent('necessary')}>
            {t.cookieBanner.necessaryOnly}
          </button>
          <button type="button" className="cookie-btn cookie-btn-primary" onClick={() => saveConsent('all')}>
            {t.cookieBanner.acceptAll}
          </button>
        </div>
      </div>

      {settingsOpen && (
        <div className="cookie-settings">
          <div className="cookie-settings-row">
            <div>
              <p className="cookie-settings-title">{t.cookieBanner.necessaryTitle}</p>
              <p className="cookie-settings-desc">
                {t.cookieBanner.necessaryDesc}
              </p>
            </div>
            <input type="checkbox" checked disabled aria-label={t.cookieBanner.necessaryAriaLabel} />
          </div>
          <div className="cookie-settings-row">
            <div>
              <p className="cookie-settings-title">{t.cookieBanner.adsTitle}</p>
              <p className="cookie-settings-desc">
                {t.cookieBanner.adsDesc}
              </p>
            </div>
            <input type="checkbox" disabled aria-label={t.cookieBanner.adsAriaLabel} />
          </div>
        </div>
      )}
    </div>
  );
}
