import { getCloudflareContext } from '@opennextjs/cloudflare';
import MenuPageClient from '@/components/MenuPageClient';
import { loadMenuData } from '@/lib/menu-data';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Full Menu — Pizza, Kebab & Burgers | ozy.fi',
  description:
    'Browse the full ozy.fi menu — pizza, kebab, burgers, salads, drinks and more. Order online for delivery or pickup.',
  alternates: {
    canonical: '/menu',
  },
};

export default async function MenuPage() {
  const { env } = await getCloudflareContext({ async: true });
  const initialData = await loadMenuData(env);

  return <MenuPageClient initialData={initialData} />;
}
