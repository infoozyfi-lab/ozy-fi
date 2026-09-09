import { getCloudflareContext } from '@opennextjs/cloudflare';
import MenuPageClient from '@/components/MenuPageClient';
import { loadMenuData } from '@/lib/menu-data';
import { hreflangAlternates } from '@/lib/i18n/locales';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params }) {
  const { locale } = params;
  const title = locale === 'fi'
    ? 'Koko ruokalista — Pizzaa, kebabia ja hampurilaisia | ozy.fi'
    : 'Full Menu — Pizza, Kebab & Burgers | ozy.fi';
  const description = locale === 'fi'
    ? 'Selaa koko ozy.fi-ruokalistaa — pizzaa, kebabia, hampurilaisia, salaatteja ja juomia. Tilaa verkosta kotiinkuljetuksena tai noutona.'
    : 'Browse the full ozy.fi menu — pizza, kebab, burgers, salads, drinks and more. Order online for delivery or pickup.';

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/menu`,
      languages: hreflangAlternates('/menu'),
    },
    openGraph: { title, description, url: `https://ozy.fi/${locale}/menu`, locale: locale === 'fi' ? 'fi_FI' : 'en_US', type: 'website' },
  };
}

export default async function MenuPage() {
  const { env } = await getCloudflareContext({ async: true });
  const initialData = await loadMenuData(env);

  return <MenuPageClient initialData={initialData} />;
}
