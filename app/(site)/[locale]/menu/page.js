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

export default async function MenuPage({ params }) {
  // See app/(site)/[locale]/page.js for why this is wrapped — same fix,
  // same reasoning (bug-fix, bilingual-site crash, Sept 2026).
  let initialData = null;
  try {
    const { env } = await getCloudflareContext({ async: true });
    initialData = await loadMenuData(env);
  } catch (err) {
    console.error(`[/${params?.locale}/menu] failed to load SSR menu data:`, err);
  }

  return <MenuPageClient initialData={initialData} />;
}
