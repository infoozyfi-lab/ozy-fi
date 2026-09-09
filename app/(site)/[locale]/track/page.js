import TrackPageClient from '@/components/TrackPageClient';
import { getDictionary, hreflangAlternates } from '@/lib/i18n/locales';

// Thin Server Component wrapper — generateMetadata (canonical + hreflang)
// needs a Server Component; the actual page (order lookup, live ETA
// countdown, etc.) is genuinely interactive so it stays a Client
// Component (components/TrackPageClient.js).
export function generateMetadata({ params }) {
  const { locale } = params;
  const t = getDictionary(locale);
  const title = `${t.track.heading} — ozy.fi`;

  return {
    title,
    description: t.track.desc,
    alternates: {
      canonical: `/${locale}/track`,
      languages: hreflangAlternates('/track'),
    },
  };
}

export default function TrackPage() {
  return <TrackPageClient />;
}
