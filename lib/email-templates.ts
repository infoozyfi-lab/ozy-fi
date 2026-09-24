// Priority-fixes brief (roadmap gap analysis), Bundle 1 Task 1 — email
// notifications. This file is the only place that knows what any
// transactional email actually SAYS — every call site (order creation,
// the Stripe webhook, admin order-status changes, refunds) builds its
// message here and hands the result straight to lib/email.ts's
// sendEmailSafe(), never constructing subject/html/text inline itself.
//
// Bilingual per this task's brief ("a customer's email language should
// match whichever locale they were ordering in") — kept as its own small
// EN/FI dictionary rather than importing lib/i18n/en.tsx / fi.tsx: those
// dictionaries are written for on-screen UI copy (short labels, JSX-
// friendly), while an email needs full sentences, a subject line, and a
// plain-text fallback for every string — different enough content that
// forking a dedicated dictionary here is clearer than bolting email-only
// strings onto the UI ones. Admin notification emails (new order, failed
// payment, refund, cancellation) are English-only by design: the entire
// admin panel this project already ships (dashboard, Kanban, staff
// management) is English-only with no locale switching of its own, so
// matching that is consistent rather than picking a language for the
// business owner.
import type { Locale, OrderType } from './types';
import type { EmailMessage } from './email';

const SITE_URL = 'https://ozy.fi';

function trackUrl(locale: Locale): string {
  return `${SITE_URL}/${locale}/track`;
}

function formatEuros(amount: number): string {
  return `${amount.toFixed(2)} €`;
}

// Minimal shared HTML shell — inline styles only (email clients strip
// <style> blocks and external stylesheets), matches this project's
// Daylight Ember accent (app/globals.css's --ember) without pulling in
// any of that stylesheet itself.
function wrapHtml(title: string, bodyHtml: string, footerText: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#2a231d;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#e8622a;padding:20px 28px;">
                <span style="font-size:20px;font-weight:bold;color:#ffffff;letter-spacing:0.02em;">ozy.fi</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 16px;font-size:20px;color:#2a231d;">${title}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f6f3ee;font-size:12px;color:#8a7f74;">
                ${footerText}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// ---------------------------------------------------------------------
// Customer-facing dictionary (bilingual — see this file's header).
// ---------------------------------------------------------------------
const CUSTOMER_DICT = {
  en: {
    footer: 'ozy.fi — this is an automated message, please don\'t reply directly to it.',
    orderReceived: {
      subject: (orderNum: string) => `Order ${orderNum} received — ozy.fi`,
      heading: 'Thanks for your order!',
      intro: (orderNum: string) => `Hi, we've received your order <strong>${orderNum}</strong> and the kitchen will get started on it shortly.`,
      itemsHeading: 'Order summary',
      total: 'Total',
      cod: 'You\'ll pay in cash when your order arrives.',
      cardPending: 'Your card payment is being processed — you\'ll get a separate email once it\'s confirmed.',
      pickup: 'We\'ll text you when it\'s ready to collect.',
      delivery: 'We\'ll text you when it\'s on its way.',
      track: (url: string) => `You can check your order's status any time at <a href="${url}" style="color:#e8622a;">${url}</a>.`,
    },
    paymentSuccessful: {
      subject: (orderNum: string) => `Payment confirmed for order ${orderNum} — ozy.fi`,
      heading: 'Payment received',
      body: (orderNum: string, total: string) => `Your payment of <strong>${total}</strong> for order <strong>${orderNum}</strong> went through successfully. Thank you!`,
    },
    status: {
      subject: (orderNum: string, label: string) => `Order ${orderNum}: ${label} — ozy.fi`,
      body: (orderNum: string, label: string) => `Your order <strong>${orderNum}</strong> is now: <strong>${label}</strong>.`,
      eta: (time: string) => `Estimated ready time: around ${time}.`,
      driver: (name: string) => `Your driver: ${name}.`,
      labels: {
        preparing: 'Preparing',
        ready_delivery: 'Ready — the driver will be on their way shortly',
        ready_pickup: 'Ready for pickup',
        on_the_way: 'On the way',
        delivered_delivery: 'Delivered',
        delivered_pickup: 'Picked up',
      },
    },
    refund: {
      subject: (orderNum: string) => `Refund processed for order ${orderNum} — ozy.fi`,
      heading: 'Refund processed',
      full: (orderNum: string, amount: string) => `We've refunded <strong>${amount}</strong> for order <strong>${orderNum}</strong> in full.`,
      partial: (orderNum: string, amount: string) => `We've refunded <strong>${amount}</strong> for order <strong>${orderNum}</strong>.`,
      note: 'Refunds to a card typically take a few business days to appear on your statement.',
    },
  },
  fi: {
    footer: 'ozy.fi — tämä on automaattinen viesti, älä vastaa tähän suoraan.',
    orderReceived: {
      subject: (orderNum: string) => `Tilaus ${orderNum} vastaanotettu — ozy.fi`,
      heading: 'Kiitos tilauksestasi!',
      intro: (orderNum: string) => `Hei, olemme vastaanottaneet tilauksesi <strong>${orderNum}</strong> ja keittiö aloittaa sen valmistamisen pian.`,
      itemsHeading: 'Tilauksen yhteenveto',
      total: 'Yhteensä',
      cod: 'Maksat käteisellä, kun tilaus saapuu.',
      cardPending: 'Korttimaksuasi käsitellään — saat erillisen viestin, kun se on vahvistettu.',
      pickup: 'Lähetämme tekstiviestin, kun tilaus on noudettavissa.',
      delivery: 'Lähetämme tekstiviestin, kun tilaus on matkalla.',
      track: (url: string) => `Voit seurata tilauksesi tilaa milloin tahansa osoitteessa <a href="${url}" style="color:#e8622a;">${url}</a>.`,
    },
    paymentSuccessful: {
      subject: (orderNum: string) => `Maksu vahvistettu tilaukselle ${orderNum} — ozy.fi`,
      heading: 'Maksu vastaanotettu',
      body: (orderNum: string, total: string) => `Maksusi <strong>${total}</strong> tilauksesta <strong>${orderNum}</strong> onnistui. Kiitos!`,
    },
    status: {
      subject: (orderNum: string, label: string) => `Tilaus ${orderNum}: ${label} — ozy.fi`,
      body: (orderNum: string, label: string) => `Tilauksesi <strong>${orderNum}</strong> tila on nyt: <strong>${label}</strong>.`,
      eta: (time: string) => `Arvioitu valmistumisaika: noin ${time}.`,
      driver: (name: string) => `Kuljettajasi: ${name}.`,
      labels: {
        preparing: 'Valmistetaan',
        ready_delivery: 'Valmis — kuljettaja lähtee pian matkaan',
        ready_pickup: 'Valmis noudettavaksi',
        on_the_way: 'Matkalla',
        delivered_delivery: 'Toimitettu',
        delivered_pickup: 'Noudettu',
      },
    },
    refund: {
      subject: (orderNum: string) => `Hyvitys käsitelty tilaukselle ${orderNum} — ozy.fi`,
      heading: 'Hyvitys käsitelty',
      full: (orderNum: string, amount: string) => `Olemme hyvittäneet <strong>${amount}</strong> tilauksesta <strong>${orderNum}</strong> kokonaisuudessaan.`,
      partial: (orderNum: string, amount: string) => `Olemme hyvittäneet <strong>${amount}</strong> tilauksesta <strong>${orderNum}</strong>.`,
      note: 'Kortille tehty hyvitys näkyy tiliotteella yleensä muutaman arkipäivän kuluessa.',
    },
  },
} as const;

function dict(locale: Locale) {
  return CUSTOMER_DICT[locale] || CUSTOMER_DICT.en;
}

// ---------------------------------------------------------------------
// Customer emails
// ---------------------------------------------------------------------

export interface OrderEmailItem {
  name: string;
  qty: number;
  lineTotal: number;
}

export interface OrderReceivedInput {
  orderNum: string;
  email: string;
  total: number;
  orderType: OrderType;
  paymentMethod: 'cod' | 'card';
  locale: Locale;
  items: OrderEmailItem[];
}

export function orderReceivedCustomerEmail(input: OrderReceivedInput): EmailMessage {
  const d = dict(input.locale).orderReceived;
  const itemsRows = input.items
    .map((i) => `<tr><td style="padding:4px 0;">${i.qty} × ${i.name}</td><td style="padding:4px 0;text-align:right;">${formatEuros(i.lineTotal)}</td></tr>`)
    .join('');
  const itemsText = input.items.map((i) => `  ${i.qty} × ${i.name} — ${formatEuros(i.lineTotal)}`).join('\n');
  const fulfillmentNote = input.orderType === 'pickup' ? d.pickup : d.delivery;
  const paymentNote = input.paymentMethod === 'card' ? d.cardPending : d.cod;
  const url = trackUrl(input.locale);

  const html = wrapHtml(
    d.heading,
    `<p style="margin:0 0 16px;line-height:1.5;">${d.intro(input.orderNum)}</p>
     <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.04em;color:#8a7f74;margin:0 0 8px;">${d.itemsHeading}</h2>
     <table role="presentation" width="100%" style="font-size:14px;border-top:1px solid #eee;border-bottom:1px solid #eee;margin:0 0 12px;">${itemsRows}
       <tr><td style="padding:8px 0 0;font-weight:bold;">${d.total}</td><td style="padding:8px 0 0;text-align:right;font-weight:bold;">${formatEuros(input.total)}</td></tr>
     </table>
     <p style="margin:0 0 8px;line-height:1.5;">${paymentNote}</p>
     <p style="margin:0 0 16px;line-height:1.5;">${fulfillmentNote}</p>
     <p style="margin:0;line-height:1.5;">${d.track(url)}</p>`,
    dict(input.locale).footer
  );

  const text = [
    d.heading,
    '',
    d.intro(input.orderNum).replace(/<\/?strong>/g, ''),
    '',
    d.itemsHeading + ':',
    itemsText,
    `${d.total}: ${formatEuros(input.total)}`,
    '',
    paymentNote,
    fulfillmentNote,
    '',
    `${url}`,
  ].join('\n');

  return { to: input.email, subject: d.subject(input.orderNum), html, text };
}

export interface PaymentSuccessfulInput {
  orderNum: string;
  email: string;
  total: number;
  locale: Locale;
}

export function paymentSuccessfulCustomerEmail(input: PaymentSuccessfulInput): EmailMessage {
  const d = dict(input.locale).paymentSuccessful;
  const bodyHtml = d.body(input.orderNum, formatEuros(input.total));
  const html = wrapHtml(d.heading, `<p style="margin:0;line-height:1.5;">${bodyHtml}</p>`, dict(input.locale).footer);
  const text = `${d.heading}\n\n${bodyHtml.replace(/<\/?strong>/g, '')}`;
  return { to: input.email, subject: d.subject(input.orderNum), html, text };
}

// The exact backend OrderStatus values this email fires for — a subset
// of the full type (see lib/types.ts's OrderStatus): 'received' (already
// covered by orderReceivedCustomerEmail above), 'accepted' (an internal
// kitchen-side step with nothing new to tell the customer that "order
// received" didn't already say), and 'cancelled' (deliberately admin-
// only — see this task's delivery report for that scope decision) are
// not included here, matching the brief's own trigger list verbatim
// ("preparing, ready, dispatched/picked-up, completed").
export type CustomerFacingStatus = 'preparing' | 'ready' | 'on_the_way' | 'delivered';

export interface OrderStatusInput {
  orderNum: string;
  email: string;
  status: CustomerFacingStatus;
  orderType: OrderType;
  locale: Locale;
  estimatedReadyAt?: string | null;
  driverName?: string | null;
}

export function orderStatusCustomerEmail(input: OrderStatusInput): EmailMessage {
  const d = dict(input.locale).status;
  const isPickup = input.orderType === 'pickup';
  // Same pickup-vs-delivery label split already established by
  // components/TrackPageClient.tsx's OrderTimeline and components/admin/
  // OrderKanban.tsx's nextLabelFor — "ready"/"delivered" mean something
  // different for each fulfillment type, so the wording here matches
  // exactly rather than sending a delivery-flavored message to a pickup
  // customer or vice versa.
  const labelKey =
    input.status === 'ready' ? (isPickup ? 'ready_pickup' : 'ready_delivery')
    : input.status === 'delivered' ? (isPickup ? 'delivered_pickup' : 'delivered_delivery')
    : input.status; // 'preparing' | 'on_the_way' — same wording either way
  const label = d.labels[labelKey as keyof typeof d.labels];

  const extraLines: string[] = [];
  if (input.estimatedReadyAt) {
    const time = new Date(input.estimatedReadyAt).toLocaleTimeString(input.locale === 'fi' ? 'fi-FI' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Helsinki',
    });
    extraLines.push(d.eta(time));
  }
  if (input.driverName) {
    extraLines.push(d.driver(input.driverName));
  }

  const bodyHtml = d.body(input.orderNum, label);
  const html = wrapHtml(
    label,
    `<p style="margin:0 0 12px;line-height:1.5;">${bodyHtml}</p>${extraLines
      .map((l) => `<p style="margin:0 0 8px;line-height:1.5;">${l}</p>`)
      .join('')}`,
    dict(input.locale).footer
  );
  const text = [bodyHtml.replace(/<\/?strong>/g, ''), ...extraLines].join('\n');

  return { to: input.email, subject: d.subject(input.orderNum, label), html, text };
}

export interface RefundCustomerInput {
  orderNum: string;
  email: string;
  amount: number;
  isFull: boolean;
  locale: Locale;
}

export function refundCustomerEmail(input: RefundCustomerInput): EmailMessage {
  const d = dict(input.locale).refund;
  const bodyHtml = input.isFull ? d.full(input.orderNum, formatEuros(input.amount)) : d.partial(input.orderNum, formatEuros(input.amount));
  const html = wrapHtml(
    d.heading,
    `<p style="margin:0 0 12px;line-height:1.5;">${bodyHtml}</p><p style="margin:0;line-height:1.5;color:#8a7f74;font-size:13px;">${d.note}</p>`,
    dict(input.locale).footer
  );
  const text = `${bodyHtml.replace(/<\/?strong>/g, '')}\n\n${d.note}`;
  return { to: input.email, subject: d.subject(input.orderNum), html, text };
}

// ---------------------------------------------------------------------
// Admin notification emails — English-only, see this file's header.
// ---------------------------------------------------------------------

function adminWrap(title: string, bodyHtml: string): string {
  return wrapHtml(title, bodyHtml, 'ozy.fi admin notification — sent to the address configured in Settings.');
}

export interface NewOrderAdminInput {
  adminEmail: string;
  orderNum: string;
  customerName: string;
  phone: string;
  total: number;
  orderType: OrderType;
  paymentMethod: 'cod' | 'card';
  items: OrderEmailItem[];
}

export function newOrderAdminEmail(input: NewOrderAdminInput): EmailMessage {
  const itemsRows = input.items
    .map((i) => `<tr><td style="padding:4px 0;">${i.qty} × ${i.name}</td><td style="padding:4px 0;text-align:right;">${formatEuros(i.lineTotal)}</td></tr>`)
    .join('');
  const itemsText = input.items.map((i) => `  ${i.qty} × ${i.name} — ${formatEuros(i.lineTotal)}`).join('\n');
  const html = adminWrap(
    `New order — ${input.orderNum}`,
    `<p style="margin:0 0 8px;">${input.customerName} · ${input.phone}</p>
     <p style="margin:0 0 12px;">${input.orderType === 'pickup' ? 'Pickup' : 'Delivery'} · ${input.paymentMethod === 'card' ? 'Card' : 'Cash on delivery'}</p>
     <table role="presentation" width="100%" style="font-size:14px;border-top:1px solid #eee;border-bottom:1px solid #eee;margin:0 0 12px;">${itemsRows}
       <tr><td style="padding:8px 0 0;font-weight:bold;">Total</td><td style="padding:8px 0 0;text-align:right;font-weight:bold;">${formatEuros(input.total)}</td></tr>
     </table>`
  );
  const text = [
    `New order — ${input.orderNum}`,
    `${input.customerName} · ${input.phone}`,
    `${input.orderType === 'pickup' ? 'Pickup' : 'Delivery'} · ${input.paymentMethod === 'card' ? 'Card' : 'Cash on delivery'}`,
    '',
    itemsText,
    `Total: ${formatEuros(input.total)}`,
  ].join('\n');
  return { to: input.adminEmail, subject: `New order ${input.orderNum} — ${formatEuros(input.total)}`, html, text };
}

export interface FailedPaymentAdminInput {
  adminEmail: string;
  orderNum: string;
  customerName: string;
  total: number;
}

export function failedPaymentAdminEmail(input: FailedPaymentAdminInput): EmailMessage {
  const bodyHtml = `Order <strong>${input.orderNum}</strong> (${input.customerName}, ${formatEuros(input.total)}) — the customer's card payment failed. The order is still on file with payment_status "failed"; the customer sees a normal error and can retry.`;
  const html = adminWrap(`Payment failed — ${input.orderNum}`, `<p style="margin:0;">${bodyHtml}</p>`);
  return { to: input.adminEmail, subject: `Payment failed — order ${input.orderNum}`, html, text: bodyHtml.replace(/<\/?strong>/g, '') };
}

export interface RefundAdminInput {
  adminEmail: string;
  orderNum: string;
  amount: number;
  isFull: boolean;
}

export function refundAdminEmail(input: RefundAdminInput): EmailMessage {
  const bodyHtml = `${input.isFull ? 'Full' : 'Partial'} refund of <strong>${formatEuros(input.amount)}</strong> processed for order <strong>${input.orderNum}</strong>.`;
  const html = adminWrap(`Refund processed — ${input.orderNum}`, `<p style="margin:0;">${bodyHtml}</p>`);
  return { to: input.adminEmail, subject: `Refund processed — order ${input.orderNum}`, html, text: bodyHtml.replace(/<\/?strong>/g, '') };
}

export interface CancellationAdminInput {
  adminEmail: string;
  orderNum: string;
  customerName: string;
}

export function cancellationAdminEmail(input: CancellationAdminInput): EmailMessage {
  const bodyHtml = `Order <strong>${input.orderNum}</strong> (${input.customerName}) was cancelled.`;
  const html = adminWrap(`Order cancelled — ${input.orderNum}`, `<p style="margin:0;">${bodyHtml}</p>`);
  return { to: input.adminEmail, subject: `Order cancelled — ${input.orderNum}`, html, text: bodyHtml.replace(/<\/?strong>/g, '') };
}
