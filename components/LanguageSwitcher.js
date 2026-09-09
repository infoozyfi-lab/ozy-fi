'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LOCALES, useLocale, useTranslations, swapLocaleInPath } from '@/lib/i18n';

// Visible fi/en toggle — required by the bilingual-site brief to link to
// the EQUIVALENT page in the other language, not just the homepage.
// swapLocaleInPath() (lib/i18n/locales.js) keeps the rest of the current
// URL (a category page, a product page, /track, …) and only swaps the
// leading /fi or /en segment, so e.g. /fi/menu/pizzat -> /en/menu/pizzat.
export default function LanguageSwitcher({ className = '' }) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations();

  return (
    <div className={`lang-switcher ${className}`.trim()} role="group" aria-label={t.languageSwitcher.ariaLabel}>
      {LOCALES.map((l) => (
        <Link
          key={l}
          href={swapLocaleInPath(pathname, l)}
          className={`lang-switcher-opt${l === locale ? ' active' : ''}`}
          aria-current={l === locale ? 'true' : undefined}
          hrefLang={l}
        >
          {t.languageSwitcher[l]}
        </Link>
      ))}
    </div>
  );
}
