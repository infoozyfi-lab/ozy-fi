'use client';

import Link from 'next/link';
import { useState, type ChangeEvent, type FormEvent, type MouseEvent } from 'react';
import { useTranslations, useLocalePath } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

// Feature 4 — referral program (Phase 1: on-screen code only, no email
// sent — see this feature's brief). A second submission from the same
// email returns the SAME code (POST /api/referral checks by
// coupons.referral_email) rather than minting a new one each time.
function ReferralForm() {
  const t = useTranslations();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [alreadyHad, setAlreadyHad] = useState(false);
  const [copied, setCopied] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status === 'loading') return;
    setStatus('loading');
    setError('');
    try {
      const res = await fetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      // res.json() resolves to `unknown` under real fetch typings — cast to
      // this endpoint's actual response shape.
      const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string; alreadyHad?: boolean };
      if (!res.ok || !data.code) {
        setError(data.error || t.footer.referralError);
        setStatus('error');
        return;
      }
      setCode(data.code);
      setAlreadyHad(Boolean(data.alreadyHad));
      setStatus('done');
    } catch {
      setError(t.footer.referralError);
      setStatus('error');
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable/denied — the code is still shown as
      // plain text right next to this button either way.
    }
  };

  if (status === 'done') {
    return (
      <div style={{ marginTop: 10 }}>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>
          {alreadyHad ? t.footer.referralAlreadyHad : t.footer.referralSuccess}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <code style={{ fontWeight: 700 }}>{code}</code>
          <button type="button" className="btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={copyCode}>
            {copied ? t.footer.referralCopied : t.footer.referralCopy}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: '32ch' }}>
      <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>{t.footer.referralHeading}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="email"
          value={email}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          placeholder={t.footer.referralEmailPlaceholder}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap' }} disabled={status === 'loading' || !email.trim()}>
          {status === 'loading' ? t.footer.referralSubmitting : t.footer.referralSubmit}
        </button>
      </div>
      {status === 'error' && <span className="field-error">{error}</span>}
    </form>
  );
}

export default function Footer() {
  const t = useTranslations();
  const lp = useLocalePath();

  const scrollTop = (e: MouseEvent) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const scrollTo = (id: string) => (e: MouseEvent) => {
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
          <div>
            <h4>{t.footer.referralColumnHeading}</h4>
            <ReferralForm />
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
