// Name of the httpOnly cookie that carries the admin token — the only
// place the token lives as of phase 5b. Phase 5a briefly also accepted
// `Authorization: Bearer <token>` as a fallback while ~27 call sites still
// sent it from sessionStorage; that dual-support is gone now that those
// call sites (and sessionStorage itself) no longer send a token at all.
export const ADMIN_COOKIE_NAME = 'ozy_admin_token';

// Cookie attributes shared by login (set) and logout (clear) so the two
// can never drift out of sync — a mismatched `path`/`sameSite` between
// the Set-Cookie that creates the cookie and the one that's supposed to
// clear it is a classic way for "logout" to silently not log anyone out.
export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
};

// Plain Web-standard `Request.headers.get('cookie')` parsing — deliberately
// NOT using next/headers' cookies() here. That API reads/writes through
// Next's per-request AsyncLocalStorage context, and this project has
// already hit a case where that context didn't survive OpenNext's
// Cloudflare Workers adaptation cleanly (see the login/logout routes for
// the full note). Reading the raw `cookie` header is a plain string
// operation with no framework machinery involved, so there's nothing
// version- or platform-specific left for it to break on.
function readCookie(request, name) {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return part.slice(eq + 1).trim();
      }
    }
  }
  return null;
}

// Cookie-only as of phase 5b — no more Authorization-header fallback.
// Same-origin fetch() calls send cookies automatically, so every admin
// fetch() (dashboard, ResourceManager, OrderKanban, BundleManager) already
// works without attaching a header at all.
function readToken(request) {
  return readCookie(request, ADMIN_COOKIE_NAME) || '';
}

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
  const token = readToken(request);
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
