import PrivacyPageClient from '@/components/PrivacyPageClient';
import { getDictionary, hreflangAlternates } from '@/lib/i18n/locales';

export function generateMetadata({ params }: { params: { locale: string } }) {
  const { locale } = params;
  const t = getDictionary(locale);

  return {
    title: t.privacy.metaTitle,
    description: t.privacy.intro,
    alternates: {
      canonical: `/${locale}/privacy`,
      languages: hreflangAlternates('/privacy'),
    },
  };
}

export default function PrivacyPage() {
  return <PrivacyPageClient />;
}
