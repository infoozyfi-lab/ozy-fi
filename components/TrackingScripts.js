'use client';

import { useEffect, useState } from 'react';

// Note: this component lives in the root layout, outside any
// <StoreProvider> (each page mounts its own separately) — so it fetches
// /api/menu itself for the public tracking IDs rather than using
// useStore(). This reuses the same cached response every other part of
// the site already fetches, so it's not an extra real network cost.

function loadGA4(id) {
  if (!id || window.__ga4Loaded) return;
  window.__ga4Loaded = true;

  const s = document.createElement('script');
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  s.async = true;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id);
}

function loadMetaPixel(id) {
  if (!id || window.__metaPixelLoaded) return;
  window.__metaPixelLoaded = true;

  /* eslint-disable */
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
    };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
    n.queue = []; t = b.createElement(e); t.async = !0;
    t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s)
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  window.fbq('init', id);
  window.fbq('track', 'PageView');
}

function loadTikTokPixel(id) {
  if (!id || window.__ttqLoaded) return;
  window.__ttqLoaded = true;

  /* eslint-disable */
  !function (w, d, t) {
    w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || []; ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
    ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } };
    for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
    ttq.load = function (e, n) {
      var i = "https://analytics.tiktok.com/i18n/pixel/events.js"; ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = i; ttq._t = ttq._t || {}; ttq._t[e] = +new Date; ttq._o = ttq._o || {}; ttq._o[e] = n || {};
      var o = d.createElement("script"); o.type = "text/javascript"; o.async = !0; o.src = i + "?sdkid=" + e + "&lib=" + t;
      var a = d.getElementsByTagName("script")[0]; a.parentNode.insertBefore(o, a)
    };
    ttq.load(id); ttq.page();
  }(window, document, 'ttq');
  /* eslint-enable */
}

function loadClarity(id) {
  if (!id || window.__clarityLoaded) return;
  window.__clarityLoaded = true;

  /* eslint-disable */
  (function (c, l, a, r, i, t, y) {
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
  const [config, setConfig] = useState(null);

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
        const s = data.settings || {};
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
