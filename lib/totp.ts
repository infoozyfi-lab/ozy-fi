// TOTP (RFC 6238, on top of HOTP / RFC 4226) via Web Crypto — no external
// npm package, same approach this project already takes for password
// hashing (lib/adminAuth.js's PBKDF2) and session signing (HMAC-SHA256).
// Google Authenticator / Authy / most TOTP apps all default to
// HMAC-SHA1, 6 digits, 30-second steps — that's what's implemented here,
// no configurable algorithm/digit-count, since nothing in this project
// needs anything else.

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIOD_SECONDS = 30;
const DIGITS = 6;

// ---------------------------------------------------------------------
// Base32 (RFC 4648) — TOTP secrets are conventionally shared with
// authenticator apps as base32 text (what you'd type in for "manual
// entry"), not raw bytes or base64.
// ---------------------------------------------------------------------

function base32Encode(bytes: Uint8Array): string {
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let output = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  const remainder = bits.length % 5;
  if (remainder !== 0) {
    const last = bits.slice(bits.length - remainder).padEnd(5, '0');
    output += BASE32_ALPHABET[parseInt(last, 2)];
  }
  return output;
}

function base32Decode(str: string): Uint8Array {
  const clean = String(str || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const char of clean) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

// ---------------------------------------------------------------------
// Secret generation
// ---------------------------------------------------------------------

// 20 raw bytes (160 bits) — the RFC 4226 recommended HOTP secret length,
// and what every mainstream authenticator app expects.
export function generateTotpSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return base32Encode(bytes);
}

// otpauth:// URI — the standard format authenticator apps scan from a QR
// code or accept as a pasted link. This project shows it as manual-entry
// text (the base32 secret) rather than rendering an actual QR image — see
// this feature's summary for why (no QR-encoding library, and pulling one
// in couldn't be verified end-to-end in this environment) — but the URI
// is included too since some authenticator apps also accept pasting a
// full otpauth:// link directly, not just the bare secret.
export function buildOtpAuthUri(secretBase32: string, accountLabel: string, issuer = 'ozy.fi'): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ---------------------------------------------------------------------
// HOTP / TOTP code generation + verification
// ---------------------------------------------------------------------

function counterToBytes(counter: number): Uint8Array {
  // Big-endian 8-byte counter per RFC 4226. `counter` (unix time / 30)
  // comfortably fits in the low 32 bits for millennia — no need for
  // 64-bit arithmetic, just zero the high word.
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, 0, false);
  view.setUint32(4, counter, false);
  return new Uint8Array(buf);
}

async function hotp(secretBase32: string, counter: number): Promise<string> {
  const keyBytes = base32Decode(secretBase32);
  // Real DOM + @types/node lib combo types Uint8Array with a stricter
  // ArrayBufferLike parameter than Web Crypto's BufferSource expects —
  // cast rather than restructure the (already-correct, runtime-safe)
  // Uint8Array values these helpers produce.
  const key = await crypto.subtle.importKey('raw', keyBytes as BufferSource, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterToBytes(counter) as BufferSource));

  // Dynamic truncation (RFC 4226 §5.3).
  const offset = signature[signature.length - 1] & 0x0f;
  const binCode =
    ((signature[offset] & 0x7f) << 24) |
    ((signature[offset + 1] & 0xff) << 16) |
    ((signature[offset + 2] & 0xff) << 8) |
    (signature[offset + 3] & 0xff);

  const code = binCode % 10 ** DIGITS;
  return String(code).padStart(DIGITS, '0');
}

export async function generateTotpCode(secretBase32: string, atTimeMs: number = Date.now()): Promise<string> {
  const counter = Math.floor(atTimeMs / 1000 / PERIOD_SECONDS);
  return hotp(secretBase32, counter);
}

// Accepts the current 30s step and one step on either side (±30s) to
// tolerate normal clock drift between the staff member's phone and this
// Worker — standard practice for TOTP verification, per RFC 6238 §6.
export async function verifyTotpCode(secretBase32: string, code: unknown, atTimeMs: number = Date.now()): Promise<boolean> {
  const submitted = String(code || '').trim();
  if (!/^\d{6}$/.test(submitted)) return false;

  const counter = Math.floor(atTimeMs / 1000 / PERIOD_SECONDS);
  for (const drift of [0, -1, 1]) {
    const expected = await hotp(secretBase32, counter + drift);
    // Constant-time-ish compare — codes are short (6 digits) so the
    // information-leak surface here is minor either way, but matches
    // this project's existing convention (lib/adminAuth.js) of not doing
    // a plain `===` on anything secret-derived.
    if (expected.length === submitted.length) {
      let diff = 0;
      for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ submitted.charCodeAt(i);
      if (diff === 0) return true;
    }
  }
  return false;
}
