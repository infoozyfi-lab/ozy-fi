'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { formatCurrency } from '@/components/admin/charts/colors';
import PaymentStatusPill from '@/components/admin/charts/PaymentStatusPill';
import { getDictionary } from '@/lib/i18n/locales';
import type { OrderRow, OrderItemRow } from '@/lib/types';

// Per-order invoice — a printable page, not a client-rendered PDF. See this
// feature's delivery report for why: this project's Cloudflare Workers
// runtime (via OpenNext) has already bitten this codebase once on a
// package that assumed a Node-ish environment (this exact standing rule
// — "check Workers compatibility before committing to a new package" —
// exists because of the Stripe integration's own history), and this
// sandbox can't actually deploy-test a new dependency to confirm it bundles
// cleanly. A styled HTML page with `@media print` rules needs zero new
// dependencies and is guaranteed to render — the business owner's browser
// does the "save as PDF" step via its own native print dialog.
//
// Bilingual (fi/en) — unlike the rest of the (deliberately English-only)
// admin panel, this is the one admin surface that might get handed
// straight to a customer, so it follows lib/i18n's dictionary pattern
// (lib/i18n/locales.ts's getDictionary(), not the useTranslations() hook,
// since this route isn't nested under app/(site)/[locale] and has no
// [locale] segment to read a locale from — the toggle below is just local
// component state instead).

interface InvoiceData {
  order: OrderRow;
  items: OrderItemRow[];
}

function formatOrderDate(createdAt: string, locale: 'fi' | 'en'): string {
  // Same UTC-without-"Z" fix as components/admin/OrderKanban.tsx's
  // minutesAgo() — D1's CURRENT_TIMESTAMP has no timezone suffix, so
  // without this browsers parse it as local time and the date/time shown
  // on the invoice would be wrong by several hours.
  const iso = createdAt.includes('T') ? createdAt : `${createdAt.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return createdAt;
  return date.toLocaleString(locale === 'fi' ? 'fi-FI' : 'en-GB', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// A line's customization notes (details) — same JSON-encoded string[]
// shape and same defensive parse already used in every other order-detail
// view in this codebase (OrderKanban.tsx, app/admin/dashboard/page.tsx).
function parseDetails(details: string | null | undefined): string[] {
  if (!details) return [];
  try {
    const parsed = JSON.parse(details);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function InvoicePage() {
  const params = useParams();
  const orderId = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';

  const [lang, setLang] = useState<'fi' | 'en'>('fi');
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [data, setData] = useState<InvoiceData | null>(null);
  const [errorKind, setErrorKind] = useState<'forbidden' | 'not-found' | 'network' | null>(null);

  const t = getDictionary(lang).invoice as {
    documentTitle: string; orderNumber: string; orderDate: string; customer: string; itemsHeading: string;
    columnItem: string; columnQty: string; columnUnitPrice: string; columnLineTotal: string; subtotal: string;
    discount: string; adjustment: string; total: string; paymentMethod: string; paymentStatus: string;
    vatNote: string; printButton: string; backToOrder: string; loading: string; notFound: string;
    forbidden: string; signInRequired: string; pickupLabel: string;
    discountSourceLabel: Record<string, string>; paymentMethodLabel: Record<string, string>;
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const meRes = await fetch('/api/admin/me');
        const me = (await meRes.json().catch(() => ({ authenticated: false }))) as { authenticated?: boolean };
        if (cancelled) return;
        if (!me.authenticated) {
          setAuthenticated(false);
          setChecking(false);
          return;
        }
        setAuthenticated(true);

        const res = await fetch(`/api/admin/orders/${orderId}/invoice`);
        if (cancelled) return;
        if (res.status === 403) {
          setErrorKind('forbidden');
        } else if (res.status === 404) {
          setErrorKind('not-found');
        } else if (!res.ok) {
          setErrorKind('network');
        } else {
          const json = (await res.json()) as InvoiceData;
          setData(json);
        }
      } catch {
        if (!cancelled) setErrorKind('network');
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    if (orderId) load();
    return () => { cancelled = true; };
  }, [orderId]);

  const totals = useMemo(() => {
    if (!data) return null;
    const itemsSubtotal = data.items.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
    const discount = Number(data.order.discount_amount || 0);
    const total = Number(data.order.total || 0);
    // Whatever's left after items minus discount should equal the stored
    // total — this project doesn't track a separate delivery-fee column
    // (worker/schema.sql's orders table has none), so any gap here is
    // either an untracked delivery fee or a rounding difference. Shown
    // explicitly rather than silently absorbed, so the printed numbers
    // always add up to the real total a customer was actually charged.
    const adjustment = total - (itemsSubtotal - discount);
    return { itemsSubtotal, discount, adjustment, total };
  }, [data]);

  if (checking) {
    return <main style={{ padding: 40, color: 'var(--cream)' }}>…</main>;
  }

  if (!authenticated) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--cream)', marginBottom: 16 }}>{t.signInRequired}</p>
          <a href="/admin" style={{ color: 'var(--ember)' }}>{t.backToOrder}</a>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg, #F7F4EF)', padding: '24px 16px 60px' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .invoice-card { box-shadow: none !important; border: none !important; margin: 0 !important; }
        }
      `}</style>

      <div className="no-print" style={{ maxWidth: 780, margin: '0 auto 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <a href="/admin/dashboard" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none' }}>
          {t.backToOrder}
        </a>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setLang('fi')}
              style={{ padding: '6px 12px', fontSize: 13, cursor: 'pointer', border: 'none', background: lang === 'fi' ? 'var(--ember)' : 'var(--bg-card)', color: lang === 'fi' ? 'var(--text-on-accent)' : 'var(--muted)' }}
            >
              Suomi
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              style={{ padding: '6px 12px', fontSize: 13, cursor: 'pointer', border: 'none', background: lang === 'en' ? 'var(--ember)' : 'var(--bg-card)', color: lang === 'en' ? 'var(--text-on-accent)' : 'var(--muted)' }}
            >
              English
            </button>
          </div>
          {data && (
            <button
              type="button"
              onClick={() => window.print()}
              style={{ padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', borderRadius: 8, background: 'var(--ember)', color: 'var(--text-on-accent)' }}
            >
              {t.printButton}
            </button>
          )}
        </div>
      </div>

      {errorKind === 'forbidden' && (
        <p style={{ maxWidth: 780, margin: '40px auto', textAlign: 'center', color: 'var(--danger)' }}>{t.forbidden}</p>
      )}
      {errorKind === 'not-found' && (
        <p style={{ maxWidth: 780, margin: '40px auto', textAlign: 'center', color: 'var(--muted)' }}>{t.notFound}</p>
      )}
      {errorKind === 'network' && (
        <p style={{ maxWidth: 780, margin: '40px auto', textAlign: 'center', color: 'var(--muted)' }}>{t.notFound}</p>
      )}

      {!errorKind && !data && (
        <p style={{ maxWidth: 780, margin: '40px auto', textAlign: 'center', color: 'var(--muted)' }}>{t.loading}</p>
      )}

      {data && totals && (
        <div
          className="invoice-card"
          style={{
            maxWidth: 780, margin: '0 auto', background: '#fff', color: '#231D19',
            border: '1px solid var(--line)', borderRadius: 14, padding: '40px 44px',
            boxShadow: '0 10px 30px rgba(35,29,25,0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20, borderBottom: '2px solid #231D19', paddingBottom: 20, marginBottom: 24 }}>
            <div>
              <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 26 }}>
                ozy<span style={{ color: '#E8622A' }}>.fi</span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#5B5148' }}>hello@ozy.fi</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#5B5148' }}>040 000 0000</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h1 style={{ margin: 0, fontSize: 22, letterSpacing: '0.02em' }}>{t.documentTitle}</h1>
              <p style={{ margin: '8px 0 0', fontSize: 14 }}>
                <strong>{t.orderNumber}:</strong> {data.order.order_num}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 14 }}>
                <strong>{t.orderDate}:</strong> {formatOrderDate(data.order.created_at, lang)}
              </p>
            </div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#8A8073' }}>{t.customer}</p>
            <p style={{ margin: 0, fontWeight: 700 }}>{data.order.customer_name}</p>
            {/* Round-2 fixes brief, Part 5 — data.order.address is a
                sentinel string (never a real address) for a pickup order;
                shown as a clear label instead so a printed/saved invoice
                never reads as if a driver needs to find that address. */}
            {data.order.order_type === 'pickup' ? (
              <p style={{ margin: '2px 0 0', fontStyle: 'italic' }}>{t.pickupLabel}</p>
            ) : (
              <p style={{ margin: '2px 0 0' }}>{data.order.address}</p>
            )}
            <p style={{ margin: '2px 0 0' }}>{data.order.phone}</p>
            {data.order.email && <p style={{ margin: '2px 0 0' }}>{data.order.email}</p>}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E7E1D6' }}>
                <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#8A8073' }}>{t.columnItem}</th>
                <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#8A8073' }}>{t.columnQty}</th>
                <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#8A8073' }}>{t.columnUnitPrice}</th>
                <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#8A8073' }}>{t.columnLineTotal}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => {
                const notes = parseDetails(item.details);
                const unitPrice = item.qty > 0 ? Number(item.line_total || 0) / item.qty : Number(item.line_total || 0);
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #F1ECE3' }}>
                    <td style={{ padding: '10px 4px' }}>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      {notes.length > 0 && (
                        <div style={{ fontSize: 12.5, color: '#8A8073', marginTop: 2 }}>{notes.join(', ')}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 4px', textAlign: 'right' }}>{item.qty}</td>
                    <td style={{ padding: '10px 4px', textAlign: 'right' }}>{formatCurrency(unitPrice)}</td>
                    <td style={{ padding: '10px 4px', textAlign: 'right' }}>{formatCurrency(item.line_total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
            <div style={{ width: 280 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14 }}>
                <span>{t.subtotal}</span>
                <span>{formatCurrency(totals.itemsSubtotal)}</span>
              </div>
              {totals.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14 }}>
                  <span>
                    {t.discount}
                    {data.order.discount_source && t.discountSourceLabel[data.order.discount_source] && (
                      <span style={{ color: '#8A8073' }}> ({t.discountSourceLabel[data.order.discount_source]}{data.order.coupon_code ? `: ${data.order.coupon_code}` : ''})</span>
                    )}
                  </span>
                  <span>-{formatCurrency(totals.discount)}</span>
                </div>
              )}
              {Math.abs(totals.adjustment) >= 0.01 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14 }}>
                  <span>{t.adjustment}</span>
                  <span>{formatCurrency(totals.adjustment)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', marginTop: 6, borderTop: '2px solid #231D19', fontSize: 17, fontWeight: 700 }}>
                <span>{t.total}</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', borderTop: '1px solid #E7E1D6', paddingTop: 18, marginBottom: 18 }}>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A8073' }}>{t.paymentMethod}</p>
              <p style={{ margin: 0, fontWeight: 600 }}>{t.paymentMethodLabel[data.order.payment_method] || data.order.payment_method}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A8073' }}>{t.paymentStatus}</p>
              <PaymentStatusPill status={data.order.payment_status} />
            </div>
          </div>

          <p style={{ margin: 0, fontSize: 12, color: '#8A8073' }}>{t.vatNote}</p>
        </div>
      )}
    </main>
  );
}
