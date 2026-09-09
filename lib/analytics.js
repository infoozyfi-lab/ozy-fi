// GA4 standard ecommerce dataLayer helper.
//
// Safe to call at any time, with or without GTM/GA4 actually installed —
// this only pushes onto window.dataLayer (a plain array). Until a GTM
// container script is added to app/layout.js, nothing reads this array;
// it's inert. Once GTM is added, every one of these events is already
// wired up and ready — no code changes needed at that point, just GTM
// tag configuration.

function pushEvent(eventName, ecommerce) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  // GA4 convention: clear the previous ecommerce object first, so old
  // item arrays don't bleed into the next event.
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({ event: eventName, ecommerce });
}

// A cart line (StoreContext's `cart` array) → one GA4 item object.
function cartLineToItem(line) {
  return {
    item_id: line.productId || line.key,
    item_name: line.name,
    item_variant: Array.isArray(line.details) && line.details.length ? line.details.join(', ') : undefined,
    price: line.unitPrice,
    quantity: line.qty,
  };
}

export function trackViewItem(product) {
  pushEvent('view_item', {
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
}

export function trackAddToCart(line) {
  pushEvent('add_to_cart', {
    currency: 'EUR',
    value: line.lineTotal,
    items: [cartLineToItem(line)],
  });
}

export function trackViewCart(cart, cartTotal) {
  pushEvent('view_cart', {
    currency: 'EUR',
    value: cartTotal,
    items: cart.map(cartLineToItem),
  });
}

export function trackBeginCheckout(cart, cartTotal) {
  pushEvent('begin_checkout', {
    currency: 'EUR',
    value: cartTotal,
    items: cart.map(cartLineToItem),
  });
}

export function trackPurchase(orderNum, cart, total) {
  pushEvent('purchase', {
    // Same id used for the server-side Conversions/Events API call —
    // this is what lets Meta/TikTok/GA4 de-duplicate the two signals
    // into a single counted event instead of two.
    transaction_id: orderNum,
    currency: 'EUR',
    value: total,
    shipping: 0,
    items: cart.map(cartLineToItem),
  });
}
