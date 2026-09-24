// Priority-fixes brief (roadmap gap analysis), Bundle 1 Task 1 — email
// notifications. This is the one place that actually talks to the
// email-sending provider; every call site (order creation, the Stripe
// webhook, admin status changes, refunds) builds a message with
// lib/email-templates.ts and hands it to sendEmailSafe() here, the same
// "one shared low-level sender, many call sites" shape lib/stripe.ts and
// lib/server-tracking.ts already use for their own external services.
//
// Provider choice: Resend, called directly via its plain HTTP+JSON API
// (https://resend.com/docs/api-reference/emails/send-email) with fetch —
// deliberately NOT the `resend` npm package. Reasoning:
//   1. This project's runtime (Cloudflare Workers via OpenNext) has no
//      Node APIs and no SMTP support — the same constraint that shaped
//      the Stripe integration (see lib/stripe.ts's comment on why
//      Stripe's SDK specifically needs its fetch-based HTTP client
//      option) and lib/server-tracking.ts's Meta/TikTok/GA4 calls (all
//      plain `fetch()`, no SDK at all). Resend's API is a single POST
//      endpoint with a Bearer token — calling it directly with fetch
//      sidesteps any question of whether a given npm SDK's bundle
//      actually works unmodified in Workers, and adds zero new
//      dependencies.
//   2. Resend, Postmark, and similar HTTP-API-based providers were all
//      viable per the brief; Resend was chosen specifically for its
//      plain Bearer-token auth (matching the shape this codebase's other
//      server-to-server API calls already use — see server-tracking.ts's
//      Access-Token/access_token patterns), a free tier that comfortably
//      covers this business's order volume, and same-day sender-domain
//      verification via a few DNS records, which suits a small
//      restaurant's setup.
// This could NOT be verified against a real Resend account/API key in
// this environment (no such account exists yet) — the request shape
// below matches Resend's published API reference exactly, but treat the
// actual send as unverified until tested with a real RESEND_API_KEY (see
// this task's delivery report for the exact verification steps).

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// A clearly-fake placeholder — sending will fail (loudly, in Worker
// logs, never towards the customer/order flow — see sendEmailSafe below)
// until the business owner sets a real EMAIL_FROM matching a domain
// they've actually verified in Resend. Never silently substituted for a
// real address in any UI-facing text.
export const EMAIL_FROM_FALLBACK = 'ozy.fi <onboarding@resend.dev>';

async function sendEmail(env: CloudflareEnv, message: EmailMessage): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    // Never blocks anything that calls this (this task's "fire-and-
    // forget" standing rule) — just logged so a missing/forgotten secret
    // is visible in Worker logs instead of emails silently never being
    // sent with no trace anywhere.
    console.error('[email] RESEND_API_KEY is not set — skipping email to', message.to);
    return;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM || EMAIL_FROM_FALLBACK,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    // fetch() only rejects on a network-level failure — a bad API key or
    // unverified sender domain comes back as a normal non-2xx response,
    // which the try/catch alone would silently swallow (same lesson
    // already applied to lib/server-tracking.ts's Meta/TikTok/GA4 calls).
    if (!res.ok) {
      console.error('[email] Resend API non-OK response:', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('[email] Resend API error:', err);
  }
}

// The single entry point every call site uses. Swallows a missing
// recipient (a guest checkout skipped the optional email field — see
// app/api/orders/route.ts) and a null message (a template builder
// declining to send, e.g. an order with no email on file) the same
// way — quietly, never as an error — so callers never need their own
// "is there anything to send" branch before calling this.
export async function sendEmailSafe(env: CloudflareEnv, message: EmailMessage | null | undefined): Promise<void> {
  if (!message || !message.to) return;
  await sendEmail(env, message);
}

// Admin notification recipient — reuses admin_settings.email, the
// business's own configured contact address (the exact same column
// lib/site-settings.ts's getPublicSettings and app/(site)/[locale]/
// layout.tsx's getRestaurantSchema already read), never a hardcoded
// address, per this task's brief. Returns null (skip, don't guess) if
// it's unset — same "degrade gracefully, never throw" spirit as this
// file's sendEmail above.
export async function getAdminNotificationEmail(env: CloudflareEnv): Promise<string | null> {
  try {
    const row = await env.DB.prepare(`SELECT value FROM admin_settings WHERE key = 'email'`).first<{ value: string }>();
    const email = row?.value ? String(row.value).trim() : '';
    return email || null;
  } catch (err) {
    console.error('[email] failed to load admin notification email:', err);
    return null;
  }
}
