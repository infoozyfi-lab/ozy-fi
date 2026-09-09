export const dynamic = 'force-dynamic';

export async function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      // Max-Age=0 deletes the cookie immediately.
      'set-cookie': 'ozy_admin_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
    },
  });
}
