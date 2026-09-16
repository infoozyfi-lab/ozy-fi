import FaqPageClient from '@/components/FaqPageClient';
import { getDictionary, hreflangAlternates } from '@/lib/i18n/locales';

export function generateMetadata({ params }: { params: { locale: string } }) {
  const { locale } = params;
  const t = getDictionary(locale);

  return {
    title: t.faq.metaTitle,
    description: t.faq.intro,
    alternates: {
      canonical: `/${locale}/help`,
      languages: hreflangAlternates('/help'),
    },
  };
}

export default function FaqPage({ params }: { params: { locale: string } }) {
  const t = getDictionary(params.locale);

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <FaqPageClient />
    </>
  );
}
