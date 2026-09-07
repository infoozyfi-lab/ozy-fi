function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function getAdminSecretKey(env) {
  const secret = `${env.ADMIN_EMAIL}:${env.ADMIN_PASSWORD}`;
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createAdminToken(env) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `ozy-admin:${timestamp}`;
  const key = await getAdminSecretKey(env);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${bytesToBase64Url(new TextEncoder().encode(payload))}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function isAdmin(request, env) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  try {
    const payload = new TextDecoder().decode(base64UrlToBytes(parts[0]));
    const [prefix, timestamp] = payload.split(':');
    if (prefix !== 'ozy-admin') return false;

    const tokenTime = Number(timestamp);
    if (!Number.isFinite(tokenTime)) return false;

    const now = Math.floor(Date.now() / 1000);
    // Token valid for 24 hours.
    if (now - tokenTime < 0 || now - tokenTime > 86400) return false;

    const key = await getAdminSecretKey(env);
    const signature = base64UrlToBytes(parts[1]);
    return await crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(payload));
  } catch {
    return false;
  }
}

// Call at the top of any protected route handler:
//   const denied = await requireAdmin(request, env);
//   if (denied) return denied;
export async function requireAdmin(request, env) {
  if (!(await isAdmin(request, env))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json;charset=UTF-8' },
    });
  }
  return null;
}
