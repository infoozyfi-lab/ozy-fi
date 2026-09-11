import type { TrackingSettings, TrackingOrder } from '@/lib/types';

// Server-side conversion tracking (Meta Conversions API, TikTok Events
// API, GA4 Measurement Protocol) — sent directly from our own Worker,
// no separate server-side GTM/Stape.io hosting needed.
//
// All IDs/tokens come from the admin_settings table (set via the admin
// panel's Tracking & Analytics section), not environment variables —
// so changing them never needs a redeploy. Every function below checks
// for its own settings first and returns immediately if they're
// missing, so this file is safe to call right now, before any ad
// accounts exist.

export async function loadTrackingSettings(env: any): Promise<TrackingSettings> {
  const rows = await env.DB.prepare(
    `SELECT key, value FROM admin_settings WHERE key IN (
      'ga4_measurement_id', 'secret_ga4_api_secret', 'ga4_debug_mode',
      'meta_pixel_id', 'secret_meta_access_token', 'meta_test_event_code',
      'tiktok_pixel_id', 'secret_tiktok_access_token', 'tiktok_test_event_code'
    )`
  ).all<{ key: string; value: string }>();
  const s: Record<string, string> = {};
  for (const row of rows.results) s[row.key] = row.value;
  return {
    ga4MeasurementId: s.ga4_measurement_id || null,
    ga4ApiSecret: s.secret_ga4_api_secret || null,
    // GA4's debug endpoint validates the payload and shows it in
    // GA4's DebugView instead of actually recording it as real data.
    ga4DebugMode: s.ga4_debug_mode === '1',
    metaPixelId: s.meta_pixel_id || null,
    metaAccessToken: s.secret_meta_access_token || null,
    // From Meta Events Manager → Test Events tab. Only fill this in
    // while verifying setup — leave blank for real customer events, so
    // test traffic never mixes into real ad-campaign data.
    metaTestEventCode: s.meta_test_event_code || null,
    tiktokPixelId: s.tiktok_pixel_id || null,
    tiktokAccessToken: s.secret_tiktok_access_token || null,
    // Same idea as Meta's — from TikTok Events Manager's test tool.
    tiktokTestEventCode: s.tiktok_test_event_code || null,
  };
}

async function sha256Hex(value: unknown): Promise<string> {
  const data = new TextEncoder().encode(String(value).trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function clientMeta(request: Request): { ip?: string; userAgent?: string } {
  return {
    ip: request.headers.get('cf-connecting-ip') || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  };
}

// ---------- Meta (Facebook/Instagram) Conversions API ----------

interface SendEventArgs {
  eventName: string;
  eventId: string;
  order: TrackingOrder;
  request: Request;
  isRefund?: boolean;
}

async function sendMetaEvent(settings: TrackingSettings, { eventName, eventId, order, request, isRefund = false }: SendEventArgs): Promise<void> {
  if (!settings.metaPixelId || !settings.metaAccessToken) return;

  try {
    const [hashedEmail, hashedPhone] = await Promise.all([
      order.email ? sha256Hex(order.email) : null,
      order.phone ? sha256Hex(order.phone.replace(/\D/g, '')) : null,
    ]);
    const { ip, userAgent } = clientMeta(request);

    const payload = {
      data: [{
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        event_source_url: 'https://ozy.fi/order-confirmed',
        user_data: {
          ...(hashedEmail ? { em: [hashedEmail] } : {}),
          ...(hashedPhone ? { ph: [hashedPhone] } : {}),
          ...(ip ? { client_ip_address: ip } : {}),
          ...(userAgent ? { client_user_agent: userAgent } : {}),
        },
        custom_data: {
          currency: 'EUR',
          value: order.total,
          ...(isRefund ? {} : { contents: (order.items || []).map((i) => ({ id: i.productId, quantity: i.qty })) }),
        },
      }],
      // Only present while a Test Event Code is set in admin Settings —
      // Meta's Test Events tool needs this to show the event; leaving it
      // out (the normal case) sends the event as real, live data.
      ...(settings.metaTestEventCode ? { test_event_code: settings.metaTestEventCode } : {}),
    };

    const res = await fetch(`https://graph.facebook.com/v21.0/${settings.metaPixelId}/events?access_token=${settings.metaAccessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // fetch() only rejects on a network-level failure — a bad/expired
    // access token or malformed payload comes back as a normal (non-2xx)
    // response, which this try/catch alone would silently swallow. Audit
    // fix: log the body on non-2xx so a misconfigured token shows up in
    // Worker logs instead of just quietly never reaching Meta.
    if (!res.ok) {
      console.error('Meta Conversions API non-OK response:', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('Meta Conversions API error:', err);
  }
}

function sendMetaPurchase(settings: TrackingSettings, order: TrackingOrder, request: Request) {
  return sendMetaEvent(settings, { eventName: 'Purchase', eventId: order.orderNum, order, request });
}

function sendMetaRefund(settings: TrackingSettings, order: TrackingOrder, request: Request) {
  return sendMetaEvent(settings, { eventName: 'RefundOrderCancelled', eventId: `${order.orderNum}-refund`, order, request, isRefund: true });
}

// ---------- TikTok Events API ----------
//
// Audit fix (see this feature's audit report): the payload shape here was
// previously a flat { pixel_code, event, event_id, timestamp, context,
// properties } object — that's TikTok's OLD (pre-2.0) schema. The URL
// below was already pointed at v1.3 ("Events API 2.0"), which uses a
// different, nested shape: a top-level { event_source, event_source_id,
// data: [...], test_event_code } envelope, with each event's own
// event/event_time/event_id/user/page/properties nested inside one entry
// of the `data` array. Rewritten to match that shape, based on TikTok's
// v1.3 field documentation (event_source_id = pixel code, event_time in
// **whole seconds** not an ISO string, user/page split out instead of one
// combined "context" object). This could not be independently confirmed
// against a live TikTok test event in this environment (no TikTok ad
// account/pixel exists yet per this project's current state) — verify
// with TikTok's Test Events tool (using tiktok_test_event_code in admin
// Settings) before relying on this for a real campaign.
async function sendTikTokEvent(settings: TrackingSettings, { eventName, eventId, order, request, isRefund = false }: SendEventArgs): Promise<void> {
  if (!settings.tiktokPixelId || !settings.tiktokAccessToken) return;

  try {
    const [hashedEmail, hashedPhone] = await Promise.all([
      order.email ? sha256Hex(order.email) : null,
      order.phone ? sha256Hex(order.phone.replace(/\D/g, '')) : null,
    ]);
    const { ip, userAgent } = clientMeta(request);

    const payload = {
      event_source: 'web',
      event_source_id: settings.tiktokPixelId,
      data: [{
        event: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        user: {
          ...(hashedEmail ? { email: hashedEmail } : {}),
          ...(hashedPhone ? { phone: hashedPhone } : {}),
          ...(ip ? { ip } : {}),
          ...(userAgent ? { user_agent: userAgent } : {}),
        },
        page: {
          url: 'https://ozy.fi/order-confirmed',
        },
        properties: {
          currency: 'EUR',
          value: order.total,
          ...(isRefund ? {} : { contents: (order.items || []).map((i) => ({ content_id: i.productId, quantity: i.qty })) }),
        },
      }],
      // Only present while a Test Event Code is set in admin Settings —
      // top-level, per TikTok's v1.3 docs (same level as event_source),
      // not inside the data[0] entry.
      ...(settings.tiktokTestEventCode ? { test_event_code: settings.tiktokTestEventCode } : {}),
    };

    const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Access-Token': settings.tiktokAccessToken },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('TikTok Events API non-OK response:', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('TikTok Events API error:', err);
  }
}

// 'Purchase' — TikTok's currently-documented standard event name for a
// completed order (audit note: older TikTok integrations/blog posts refer
// to this same standard event as "CompletePayment"; TikTok's own
// standard-events reference now lists "Purchase". Re-verify against a
// live Test Event before going live — see the audit report for what
// could and couldn't be confirmed from documentation alone).
function sendTikTokPurchase(settings: TrackingSettings, order: TrackingOrder, request: Request) {
  return sendTikTokEvent(settings, { eventName: 'Purchase', eventId: order.orderNum, order, request });
}

// TikTok has no official standard "refund" event (its standard-events
// list doesn't include one), so this is deliberately sent as a custom
// event name — TikTok will accept it, but it won't feed TikTok's
// automatic ad-optimization the way a standard event does. That's an
// accepted limitation, not a bug: there's no standard event to map this
// to instead.
function sendTikTokRefund(settings: TrackingSettings, order: TrackingOrder, request: Request) {
  return sendTikTokEvent(settings, { eventName: 'Refund', eventId: `${order.orderNum}-refund`, order, request, isRefund: true });
}

// ---------- GA4 Measurement Protocol ----------
// Server-side GA4 needs a client_id — since we don't have the browser's
// GA cookie value from a server route, we derive a stable one from the
// order number. This means server-side GA4 events land as their own
// "session" rather than merging into the customer's browsing session —
// an accepted trade-off for order-completion events specifically.

async function sendGA4Event(settings: TrackingSettings, { eventName, order }: { eventName: string; order: TrackingOrder }): Promise<void> {
  if (!settings.ga4MeasurementId || !settings.ga4ApiSecret) return;

  try {
    const payload = {
      client_id: `order.${order.orderNum}`,
      events: [{
        name: eventName,
        params: {
          transaction_id: order.orderNum,
          currency: 'EUR',
          value: order.total,
          ...(eventName === 'purchase'
            ? { items: (order.items || []).map((i) => ({ item_id: i.productId, item_name: i.name, quantity: i.qty, price: i.unitPrice })) }
            : {}),
        },
      }],
    };

    // Debug mode hits GA4's validation endpoint (shows up in DebugView,
    // never recorded as real data) instead of the normal collect
    // endpoint — controlled by the "GA4 Debug Mode" checkbox in admin
    // Settings. Leave it off for real customer events.
    const endpoint = settings.ga4DebugMode ? 'debug/mp/collect' : 'mp/collect';
    const res = await fetch(
      `https://www.google-analytics.com/${endpoint}?measurement_id=${settings.ga4MeasurementId}&api_secret=${settings.ga4ApiSecret}`,
      { method: 'POST', body: JSON.stringify(payload) }
    );
    // The normal (non-debug) collect endpoint always returns 204 with an
    // empty body even when the payload is malformed — GA4 doesn't
    // validate synchronously outside of DebugView, so this check mainly
    // catches the debug endpoint's validation errors and any transport-
    // level non-2xx (e.g. a temporarily invalid api_secret).
    if (!res.ok) {
      console.error('GA4 Measurement Protocol non-OK response:', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('GA4 Measurement Protocol error:', err);
  }
}

function sendGA4Purchase(settings: TrackingSettings, order: TrackingOrder) {
  return sendGA4Event(settings, { eventName: 'purchase', order });
}

function sendGA4Refund(settings: TrackingSettings, order: TrackingOrder) {
  return sendGA4Event(settings, { eventName: 'refund', order });
}

// ---------- Combined helpers ----------
// One call each from the order routes — fires whichever platforms have
// their settings configured, ignores the rest, and never lets one
// platform's failure block another's (Promise.allSettled).

export async function trackPurchaseServerSide(env: any, order: TrackingOrder, request: Request) {
  const settings = await loadTrackingSettings(env);
  return Promise.allSettled([
    sendMetaPurchase(settings, order, request),
    sendTikTokPurchase(settings, order, request),
    sendGA4Purchase(settings, order),
  ]);
}

export async function trackRefundServerSide(env: any, order: TrackingOrder, request: Request) {
  const settings = await loadTrackingSettings(env);
  return Promise.allSettled([
    sendMetaRefund(settings, order, request),
    sendTikTokRefund(settings, order, request),
    sendGA4Refund(settings, order),
  ]);
}
