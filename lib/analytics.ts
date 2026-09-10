// Fires GA4, Meta Pixel, and TikTok Pixel events directly — NOT via a
// GTM dataLayer push. Earlier version pushed GTM-style objects onto
// window.dataLayer, but components/TrackingScripts.js loads gtag.js,
// fbq, and ttq directly (no GTM container in between), and none of
// those three read a GTM-shaped dataLayer push — gtag.js only acts on
// its own gtag(...) calls, fbq/ttq only act on their own fbq(...)/
// ttq.track(...) calls. That meant every function below was a complete
// no-op in production — nothing ever reached any platform. Calling
// each platform's real function directly fixes that.
//
// Every call here is a safe no-op if a given platform isn't loaded yet
// (ID not configured in the admin panel, or consent not yet given —
// see components/TrackingScripts.js, which only defines window.gtag/
// fbq/ttq once both are true) — checked via typeof before every call.
import type { CartLineLike, Product } from './types';

function fireGA4(eventName: string, params: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', eventName, params);
}

function fireMeta(eventName: string, params: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  window.fbq('track', eventName, params);
}

function fireTikTok(eventName: string, params: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof window.ttq === 'undefined' || typeof window.ttq.track !== 'function') return;
  window.ttq.track(eventName, params);
}

// A cart line (StoreContext's `cart` array) → one GA4 item object.
function cartLineToItem(line: CartLineLike) {
  return {
    item_id: line.productId || line.key,
    item_name: line.name,
    item_variant: Array.isArray(line.details) && line.details.length ? line.details.join(', ') : undefined,
    price: line.unitPrice,
    quantity: line.qty,
  };
}

// Meta/TikTok's "content" shape is different enough from GA4's "item"
// shape (id/name key names, no nested items array) that it's built
// separately here rather than reusing cartLineToItem's GA4-specific keys.
function cartLineToContent(line: CartLineLike) {
  return {
    content_id: line.productId || line.key,
    content_name: line.name,
    quantity: line.qty,
    price: line.unitPrice,
  };
}

export function trackViewItem(product: Product) {
  fireGA4('view_item', {
    currency: 'EUR',
    value: product.price,
    items: [{
      item_id: product.id,
      item_name: product.name,
      item_category: product.cat || product.category_id,
      price: product.price,
      quantity: 1,
    }],
  });
  fireMeta('ViewContent', {
    currency: 'EUR', value: product.price,
    content_ids: [product.id], content_name: product.name, content_type: 'product',
  });
  fireTikTok('ViewContent', {
    currency: 'EUR', value: product.price,
    contents: [{ content_id: product.id, content_name: product.name, price: product.price, quantity: 1 }],
  });
}

export function trackAddToCart(line: CartLineLike) {
  fireGA4('add_to_cart', {
    currency: 'EUR', value: line.lineTotal, items: [cartLineToItem(line)],
  });
  fireMeta('AddToCart', {
    currency: 'EUR', value: line.lineTotal,
    content_ids: [line.productId || line.key], content_name: line.name, content_type: 'product',
  });
  fireTikTok('AddToCart', {
    currency: 'EUR', value: line.lineTotal, contents: [cartLineToContent(line)],
  });
}

export function trackViewCart(cart: CartLineLike[], cartTotal: number) {
  fireGA4('view_cart', {
    currency: 'EUR', value: cartTotal, items: cart.map(cartLineToItem),
  });
  // No strong Meta/TikTok standard-event equivalent for "viewed the cart"
  // (as opposed to AddToCart/InitiateCheckout, which they do define) —
  // GA4 only, matches how this event is generally used across platforms.
}

export function trackBeginCheckout(cart: CartLineLike[], cartTotal: number) {
  fireGA4('begin_checkout', {
    currency: 'EUR', value: cartTotal, items: cart.map(cartLineToItem),
  });
  fireMeta('InitiateCheckout', {
    currency: 'EUR', value: cartTotal,
    content_ids: cart.map((l) => l.productId || l.key), num_items: cart.length,
  });
  fireTikTok('InitiateCheckout', {
    currency: 'EUR', value: cartTotal, contents: cart.map(cartLineToContent),
  });
}

export function trackPurchase(orderNum: string, cart: CartLineLike[], total: number) {
  // Same id used for the server-side Conversions/Events API call — this
  // is what lets Meta/TikTok/GA4 de-duplicate the two signals into a
  // single counted event instead of two (see lib/server-tracking.js).
  fireGA4('purchase', {
    transaction_id: orderNum, currency: 'EUR', value: total, shipping: 0, items: cart.map(cartLineToItem),
  });
  fireMeta('Purchase', {
    currency: 'EUR', value: total,
    content_ids: cart.map((l) => l.productId || l.key), eventID: orderNum,
  });
  fireTikTok('CompletePayment', {
    currency: 'EUR', value: total, contents: cart.map(cartLineToContent), event_id: orderNum,
  });
}
