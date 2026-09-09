export const dynamic = 'force-dynamic';

export async function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json;charset=UTF-8' },
  });
}
