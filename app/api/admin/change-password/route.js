import { json } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function POST() {
  return json({ error: 'Admin password is managed through Cloudflare Secrets.' }, 403);
}
