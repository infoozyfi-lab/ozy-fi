'use client';

import { useEffect, useState } from 'react';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem('ozy_cookie_consent')) {
        setVisible(true);
      }
    } catch {
      // Storage unavailable — just don't show the banner rather than error.
    }
  }, []);

  const saveConsent = (value) => {
    setVisible(false);
    setSettingsOpen(false);
    try {
      localStorage.setItem('ozy_cookie_consent', value);
      localStorage.setItem('ozy_cookie_consent_date', new Date().toISOString());
    } catch {
      // Nothing to do — worst case it shows again next visit.
    }
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie consent">
      <div className="cookie-banner-main">
        <p>
          We use cookies and similar technical storage to run this site and
          keep items in your cart while you order. We don&apos;t use
          advertising or tracking cookies. See our{' '}
          <a href="/privacy">Privacy Policy</a> for details.
        </p>
        <div className="cookie-banner-actions">
          <button type="button" className="cookie-btn cookie-btn-ghost" onClick={() => setSettingsOpen((v) => !v)}>
            Cookie settings
          </button>
          <button type="button" className="cookie-btn cookie-btn-outline" onClick={() => saveConsent('necessary')}>
            Necessary only
          </button>
          <button type="button" className="cookie-btn cookie-btn-primary" onClick={() => saveConsent('all')}>
            Accept all
          </button>
        </div>
      </div>

      {settingsOpen && (
        <div className="cookie-settings">
          <div className="cookie-settings-row">
            <div>
              <p className="cookie-settings-title">Necessary</p>
              <p className="cookie-settings-desc">
                Required for the site to work — keeping items in your cart
                and logging in as admin. Always on, can&apos;t be switched
                off.
              </p>
            </div>
            <input type="checkbox" checked disabled aria-label="Necessary storage — always on" />
          </div>
          <div className="cookie-settings-row">
            <div>
              <p className="cookie-settings-title">Advertising &amp; analytics</p>
              <p className="cookie-settings-desc">
                Not used on this site — there is nothing here to enable or
                disable.
              </p>
            </div>
            <input type="checkbox" disabled aria-label="Advertising and analytics — not used" />
          </div>
        </div>
      )}
    </div>
  );
}
