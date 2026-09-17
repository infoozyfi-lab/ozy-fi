'use client';

import { useEffect, useState } from 'react';

// Note: this component lives in the root layout, outside any
// <StoreProvider> (each page mounts its own separately) — so it fetches
// /api/menu itself for the public tracking IDs rather than using
// useStore(). This reuses the same cached response every other part of
// the site already fetches, so it's not an extra real network cost.

interface TrackingConfig {
  ga4Id: string | null;
  metaPixelId: string | null;
  tiktokPixelId: string | null;
  clarityId: string | null;
}

function loadGA4(id: string | null) {
  if (!id || window.__ga4Loaded) return;
  window.__ga4Loaded = true;

  const s = document.createElement('script');
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  s.async = true;
  document.head.appendChild(s);

  // Captured to a local const — same closure-narrowing reason as elsewhere
  // in this migration: a global property read inside a nested function
  // (the gtag() below) doesn't keep the non-null narrowing from this
  // assignment under strict mode.
  const dataLayer = (window.dataLayer = window.dataLayer || []);
  window.gtag = function gtag() { dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id);
}

function loadMetaPixel(id: string | null) {
  if (!id || window.__metaPixelLoaded) return;
  window.__metaPixelLoaded = true;

  /* eslint-disable */
  // TS parses a leading "!" before an IIFE as testing the call's return
  // value for truthiness (TS1345 — that value is always void here), even
  // though the "!" is only the standard ASI-safety idiom, not real logic.
  // Wrapping the function expression in parens instead (same style
  // loadClarity below already uses) is the same IIFE, invoked the same
  // way, with no behavior change — just a syntax TS is comfortable with.
  (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
    if (f.fbq) return; n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
    };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
    n.queue = []; t = b.createElement(e); t.async = !0;
    t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s)
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  window.fbq!('init', id);
  window.fbq!('track', 'PageView');
}

function loadTikTokPixel(id: string | null) {
  if (!id || window.__ttqLoaded) return;
  window.__ttqLoaded = true;

  /* eslint-disable */
  // Same TS1345 fix as loadMetaPixel above — parens instead of a leading
  // "!", same IIFE, no behavior change.
  (function (w: any, d: any, t: any) {
    w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || []; ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
    ttq.setAndDefer = function (t: any, e: any) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } };
    for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
    ttq.load = function (e: any, n: any) {
      var i = "https://analytics.tiktok.com/i18n/pixel/events.js"; ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = i; ttq._t = ttq._t || {}; ttq._t[e] = +new Date; ttq._o = ttq._o || {}; ttq._o[e] = n || {};
      var o = d.createElement("script"); o.type = "text/javascript"; o.async = !0; o.src = i + "?sdkid=" + e + "&lib=" + t;
      var a = d.getElementsByTagName("script")[0]; a.parentNode.insertBefore(o, a)
    };
    ttq.load(id); ttq.page();
  })(window, document, 'ttq');
  /* eslint-enable */
}

function loadClarity(id: string | null) {
  if (!id || window.__clarityLoaded) return;
  window.__clarityLoaded = true;

  /* eslint-disable */
  (function (c: any, l: any, a: any, r: any, i: any, t?: any, y?: any) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) };
    t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y)
  })(window, document, 'clarity', 'script', id);
  /* eslint-enable */
}

function hasMarketingConsent() {
  try {
    return localStorage.getItem('ozy_cookie_consent') === 'all';
  } catch {
    return false;
  }
}

export default function TrackingScripts() {
  const [consented, setConsented] = useState(false);
  const [config, setConfig] = useState<TrackingConfig | null>(null);

  useEffect(() => {
    setConsented(hasMarketingConsent());
    const onConsentChange = () => setConsented(hasMarketingConsent());
    window.addEventListener('ozy-consent-updated', onConsentChange);
    return () => window.removeEventListener('ozy-consent-updated', onConsentChange);
  }, []);

  useEffect(() => {
    fetch('/api/menu')
      .then((r) => r.json())
      .then((data) => {
        const s = (data as { settings?: Record<string, string> }).settings || {};
        setConfig({
          ga4Id: s.ga4_measurement_id || null,
          metaPixelId: s.meta_pixel_id || null,
          tiktokPixelId: s.tiktok_pixel_id || null,
          clarityId: s.clarity_id || null,
        });
      })
      .catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    if (!consented || !config) return;
    loadGA4(config.ga4Id);
    loadMetaPixel(config.metaPixelId);
    loadTikTokPixel(config.tiktokPixelId);
    loadClarity(config.clarityId);
  }, [consented, config]);

  return null;
}
