import type { StaffRole, StaffSession, StaffTokenInput } from '@/lib/types';

// ---------------------------------------------------------------------
// Cookie plumbing (unchanged since phase 5b) — see readToken below for
// what's new in this file.
// ---------------------------------------------------------------------

// Name of the httpOnly cookie that carries the signed session token.
export const ADMIN_COOKIE_NAME = 'ozy_admin_token';

// Cookie attributes shared by login (set) and logout (clear) so the two
// can never drift out of sync — a mismatched `path`/`sameSite` between
// the Set-Cookie that creates the cookie and the one that's supposed to
// clear it is a classic way for "logout" to silently not log anyone out.
export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
};

// Plain Web-standard `Request.headers.get('cookie')` parsing — deliberately
// NOT using next/headers' cookies() here. That API reads/writes through
// Next's per-request AsyncLocalStorage context, and this project hit a
// case where that context didn't survive OpenNext's Cloudflare Workers
// adaptation cleanly (see the login/logout routes for the full note).
// Reading the raw `cookie` header is a plain string operation with no
// framework machinery involved, so there's nothing version- or
// platform-specific left for it to break on.
function readCookie(request: Request, name: string): string | null {
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

function readToken(request: Request): string {
  return readCookie(request, ADMIN_COOKIE_NAME) || '';
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

// ---------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------

export const ROLES: StaffRole[] = ['kitchen', 'manager', 'owner'];

// ---------------------------------------------------------------------
// Password hashing (staff accounts) — PBKDF2 via Web Crypto, available
// natively in the Workers runtime, no external dependency. This is only
// for staff.password_hash (real user-supplied secrets at rest in D1).
// The legacy ADMIN_EMAIL/ADMIN_PASSWORD pair stays a direct Cloudflare
// Secret comparison (see login/route.js) — it was never at-rest data in
// a database, so it was never in scope for hashing.
//
// Stored format: "<saltB64url>:<iterations>:<hashB64url>" — keeping the
// iteration count alongside the hash means it can be raised later
// (Workers CPU budgets allowing) without breaking verification of
// passwords hashed under the old count.
// ---------------------------------------------------------------------

const PBKDF2_ITERATIONS = 100000;

async function pbkdf2(password: string, saltBytes: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `${bytesToBase64Url(salt)}:${PBKDF2_ITERATIONS}:${bytesToBase64Url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = String(stored || '').split(':');
  if (parts.length !== 3) return false;
  const [saltB64, iterStr, hashB64] = parts;
  const iterations = Number(iterStr);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  try {
    const salt = base64UrlToBytes(saltB64);
    const expected = base64UrlToBytes(hashB64);
    const computed = await pbkdf2(password, salt, iterations);
    if (computed.length !== expected.length) return false;
    // Constant-time compare — a length/early-exit-based comparison here
    // would leak how many leading bytes matched via response timing.
    let diff = 0;
    for (let i = 0; i < computed.length; i++) diff |= computed[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------
// Session tokens
//
// Payload shape: `ozy-staff:<id>:<role>:<timestamp>:<base64url(name)>`
//   - <id> is either a staff.id (integer) or the literal string
//     "legacy" for a session issued via the fallback ADMIN_EMAIL/
//     ADMIN_PASSWORD path (see login/route.js) that isn't backed by a
//     staff row at all.
//   - <role> is one of ROLES.
//   - name is base64url-encoded so it can't collide with the ':'
//     delimiter (a staff member's display name is free text).
// Embedding role (and name) directly in the signed payload means every
// requireRole() check below is a pure signature-verify — no D1 read per
// request just to find out who's asking.
//
// Signed with a dedicated SESSION_SECRET (a new Cloudflare Secret — see
// this feature's summary for how to set it), NOT derived from any
// individual staff member's password. That's a deliberate change from
// the previous single-admin design, where the HMAC key was derived from
// ADMIN_EMAIL:ADMIN_PASSWORD: with per-staff hashed passwords there's no
// longer one shared credential to derive a signing key from, and
// deriving it from a specific staff member's password would mean every
// verification needs a DB lookup first (defeating the point above) and
// would invalidate every OTHER staff member's sessions whenever any one
// person changes their password. One dedicated secret avoids both.
// ---------------------------------------------------------------------

const TOKEN_LIFETIME_SECONDS = 86400; // 24h

async function getSessionSecretKey(env: any): Promise<CryptoKey> {
  if (!env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is not configured');
  }
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signPayload(env: any, payload: string): Promise<string> {
  const key = await getSessionSecretKey(env);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${bytesToBase64Url(new TextEncoder().encode(payload))}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

// staff: { id: number, role: 'kitchen'|'manager'|'owner', name: string }
export async function createStaffToken(env: any, staff: StaffTokenInput): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const nameB64 = bytesToBase64Url(new TextEncoder().encode(staff.name || ''));
  const payload = `ozy-staff:${staff.id}:${staff.role}:${timestamp}:${nameB64}`;
  return signPayload(env, payload);
}

// Fallback session for the transition period — see login/route.js. Not
// backed by a staff row, always role 'owner' (matches what the shared
// ADMIN_EMAIL/ADMIN_PASSWORD login always was: full access).
export async function createLegacyOwnerToken(env: any, displayName?: string | null): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const nameB64 = bytesToBase64Url(new TextEncoder().encode(displayName || 'Owner'));
  const payload = `ozy-staff:legacy:owner:${timestamp}:${nameB64}`;
  return signPayload(env, payload);
}

// Returns { staffId: number|null, role, name, isLegacy } or null.
// staffId is null exactly when isLegacy is true (see the payload note
// above) — callers writing to audit_log should store NULL for staff_id
// in that case (there's no real staff row to reference) and fall back to
// the name for staff_name.
export async function getSession(request: Request, env: any): Promise<StaffSession | null> {
  const token = readToken(request);
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  try {
    const payload = new TextDecoder().decode(base64UrlToBytes(parts[0]));
    const segments = payload.split(':');
    if (segments.length !== 5) return null;
    const [prefix, idPart, role, timestampStr, nameB64] = segments;

    if (prefix !== 'ozy-staff') return null;
    if (!ROLES.includes(role as StaffRole)) return null;

    const tokenTime = Number(timestampStr);
    if (!Number.isFinite(tokenTime)) return null;
    const now = Math.floor(Date.now() / 1000);
    if (now - tokenTime < 0 || now - tokenTime > TOKEN_LIFETIME_SECONDS) return null;

    const key = await getSessionSecretKey(env);
    const signature = base64UrlToBytes(parts[1]);
    const valid = await crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(payload));
    if (!valid) return null;

    const isLegacy = idPart === 'legacy';
    if (!isLegacy && !/^\d+$/.test(idPart)) return null;

    let name = '';
    try {
      name = new TextDecoder().decode(base64UrlToBytes(nameB64));
    } catch {
      name = '';
    }

    return {
      staffId: isLegacy ? null : Number(idPart),
      role: role as StaffRole,
      name,
      isLegacy,
    };
  } catch {
    return null;
  }
}

export async function isAdmin(request: Request, env: any): Promise<boolean> {
  return (await getSession(request, env)) !== null;
}

// ---------------------------------------------------------------------
// Pending-2FA tokens (Phase 7.9)
//
// This project's auth is fully stateless — no server-side session store,
// signed tokens only (see the block above). That means the two-step
// "password OK, now enter your 6-digit code" login flow can't just stash
// "staff #4 passed step 1" in memory somewhere between the two requests;
// it has to travel back to the browser as its own short-lived signed
// token, the same way the real session token does, then come right back
// on the /api/admin/login/verify-2fa call.
//
// Reuses signPayload/getSessionSecretKey/base64UrlToBytes above — same
// signing key as real session tokens (SESSION_SECRET), just a different
// payload prefix and a much shorter lifetime, since all this token proves
// is "this staff ID already gave the right password within the last
// few minutes", never enough on its own to act as a session.
// ---------------------------------------------------------------------

const PENDING_2FA_LIFETIME_SECONDS = 300; // 5 minutes to enter the code

export async function createPending2faToken(env: any, staffId: number): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `ozy-2fa-pending:${staffId}:${timestamp}`;
  return signPayload(env, payload);
}

// Returns the staffId (number) the token was issued for, or null if the
// token is missing, malformed, expired, or fails signature verification.
export async function verifyPending2faToken(env: any, token?: string | null): Promise<number | null> {
  if (!token) return null;

  const parts = String(token).split('.');
  if (parts.length !== 2) return null;

  try {
    const payload = new TextDecoder().decode(base64UrlToBytes(parts[0]));
    const segments = payload.split(':');
    if (segments.length !== 3) return null;
    const [prefix, idPart, timestampStr] = segments;

    if (prefix !== 'ozy-2fa-pending') return null;
    if (!/^\d+$/.test(idPart)) return null;

    const tokenTime = Number(timestampStr);
    if (!Number.isFinite(tokenTime)) return null;
    const now = Math.floor(Date.now() / 1000);
    if (now - tokenTime < 0 || now - tokenTime > PENDING_2FA_LIFETIME_SECONDS) return null;

    const key = await getSessionSecretKey(env);
    const signature = base64UrlToBytes(parts[1]);
    const valid = await crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(payload));
    if (!valid) return null;

    return Number(idPart);
  } catch {
    return null;
  }
}

// Call at the top of any protected route handler:
//   const denied = await requireAdmin(request, env);
//   if (denied) return denied;
// Accepts any signed-in staff member regardless of role — equivalent to
// requireRole(request, env, ROLES). Kept as a separate name because most
// existing routes already call it and "any authenticated staff" is a
// perfectly valid access level for some endpoints (e.g. GET /api/admin/me
// doesn't even use this, but things like the orders list do want "any
// role" without spelling out the full ROLES array at every call site).
export async function requireAdmin(request: Request, env: any): Promise<Response | null> {
  return requireRole(request, env, ROLES);
}

// Call at the top of any protected route handler:
//   const denied = await requireRole(request, env, ['manager', 'owner']);
//   if (denied) return denied;
// Returns a 401 if there's no valid session at all, a 403 if there is one
// but its role isn't in `allowedRoles`, or null if the request should
// proceed. Deliberately distinguishes 401 vs 403 — the client-side tab
// filtering (app/admin/dashboard/page.js's TOP_TABS) is a UX nicety, not
// the actual access control; a role-appropriate 403 here is what the
// brief's verification step 2 checks for when hitting a restricted API
// directly.
//
// `allowedRoles` is typed against StaffRole (not string[]) so that a
// typo'd role name in any call site (e.g. "onwer") is a compile error
// here rather than a silent "nobody with that exact typo'd role can ever
// pass this check" bug at runtime.
export async function requireRole(request: Request, env: any, allowedRoles: StaffRole[]): Promise<Response | null> {
  const session = await getSession(request, env);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json;charset=UTF-8' },
    });
  }

  if (!allowedRoles.includes(session.role)) {
    return new Response(JSON.stringify({ error: 'Forbidden — your role does not have access to this.' }), {
      status: 403,
      headers: { 'content-type': 'application/json;charset=UTF-8' },
    });
  }

  return null;
}
