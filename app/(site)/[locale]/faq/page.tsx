import FaqPageClient from '@/components/FaqPageClient';
import { getDictionary, hreflangAlternates } from '@/lib/i18n/locales';

export function generateMetadata({ params }: { params: { locale: string } }) {
  const { locale } = params;
  const t = getDictionary(locale);

  return {
    title: t.faq.metaTitle,
    description: t.faq.intro,
    alternates: {
      canonical: `/${locale}/faq`,
      languages: hreflangAlternates('/faq'),
    },
  };
}

export default function FaqPage({ params }: { params: { locale: string } }) {
  const t = getDictionary(params.locale);

  // Schema.org FAQPage — built from the exact same t.faq.items the page
  // itself renders (see components/FaqPageClient.tsx), so the structured
  // data handed to Google/AI answer engines can never drift out of sync
  // with what a visitor actually reads on the page.
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: t.faq.items.map((item: { q: string; a: string }) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <FaqPageClient />
    </>
  );
}
