import { getCloudflareContext } from '@opennextjs/cloudflare';
import HomePageClient from '@/components/HomePageClient';
import { loadMenuData } from '@/lib/menu-data';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { env } = await getCloudflareContext({ async: true });
  const initialData = await loadMenuData(env);

  return <HomePageClient initialData={initialData} />;
}
