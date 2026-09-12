'use client';

import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { StoreProvider } from '@/context/StoreContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useTranslations, useLocale, useLocalePath } from '@/lib/i18n';
import type {
  OrderStatus,
  OrderTrackingResult,
  OrderPhoneMatch,
  RecentOrder,
  CartLine,
} from '@/lib/types';

interface Step {
  key: string;
  label: string;
}

function stepIndex(status: OrderStatus, STEPS: Step[]) {
  const i = STEPS.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i + 1;
}

function OrderTimeline({ status, t }: { status: OrderStatus; t: any }) {
  const STEPS: Step[] = [
    { key: 'received', label: t.track.stepReceived },
    { key: 'preparing', label: t.track.stepPreparing },
    { key: 'on_the_way', label: t.track.stepOnTheWay },
    { key: 'delivered', label: t.track.stepDelivered },
  ];

  if (status === 'cancelled') {
    return (
      <div className="track-cancelled">
        <span style={{ fontSize: '1.3rem' }}>⚠️</span>
        <span>{t.track.cancelledNotice}</span>
      </div>
    );
  }

  const current = stepIndex(status, STEPS);

  return (
    <div className="checkout-steps" style={{ marginTop: 20 }}>
      {STEPS.map((s, i) => {
        const n = i + 1;
        const isActive = current === n;
        const isDone = current > n;
        return (
          <div key={s.key} style={{ display: 'contents' }}>
            <div className="checkout-step">
              <div className={`checkout-step-dot${isActive ? ' active' : isDone ? ' done' : ''}`}>
                {isDone ? '✓' : n}
              </div>
              <span className={`checkout-step-label${isActive ? ' active' : ''}`}>{s.label}</span>
            </div>
            {n < STEPS.length && (
              <div className={`checkout-step-line${current > n ? ' done' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function parseDetails(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const d = JSON.parse(raw);
    return Array.isArray(d) ? d : [];
  } catch {
    return [];
  }
}

// Date/time formatting stays locale-aware via Intl (toLocaleString), not
// the UI dictionary — 'fi-FI' gives Finnish month names/24h time, 'en-IE'
// keeps the existing English formatting this page already used.
function formatDate(iso: string | null | undefined, locale: string) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale === 'fi' ? 'fi-FI' : 'en-IE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatTime(iso: string | null | undefined, locale: string) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(locale === 'fi' ? 'fi-FI' : 'en-IE', { hour: '2-digit', minute: '2-digit' });
}

// Phase 7 remainder, part 6 — a live "X min left" alongside the existing
// fixed clock-time ETA (formatTime above), not replacing it. Re-renders
// once a minute via setInterval, which is precise enough for a minutes-
// level estimate — no point re-rendering every second for this.
function minutesRemainingLabel(etaIso: string | null | undefined, nowMs: number, t: any) {
  if (!etaIso) return null;
  const d = new Date(etaIso.includes('T') ? etaIso : `${etaIso.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return null;

  const diffMinutes = Math.round((d.getTime() - nowMs) / 60000);

  // The kitchen can run behind — an order still "preparing"/"on_the_way"
  // past its original ETA shouldn't show a confusing "-3 min left".
  if (diffMinutes <= 0) return t.track.minutesLeftSoon;
  if (diffMinutes === 1) return t.track.minutesLeftOne;
  return t.track.minutesLeft(diffMinutes);
}

function EtaCountdown({ etaIso, t, locale }: { etaIso?: string | null; t: any; locale: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const remaining = minutesRemainingLabel(etaIso, now, t);

  return (
    <p className="track-eta">
      ⏱ {t.track.estimatedReadyBy(formatTime(etaIso, locale))}
      {/* estimatedReadyBy returns JSX (bolds the time) — see lib/i18n/*.js */}
      {remaining && <span className="track-eta-remaining"> ({remaining})</span>}
    </p>
  );
}

function RecentOrderShortcut({ onPick, t }: { onPick: (o: RecentOrder) => void; t: any }) {
  const [recent, setRecent] = useState<RecentOrder[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ozy_recent_orders') || '[]');
      setRecent(Array.isArray(saved) ? saved.slice(0, 3) : []);
    } catch {
      setRecent([]);
    }
  }, []);

  if (recent.length === 0) return null;

  return (
    <div className="track-recent">
      <p className="track-recent-title">{t.track.recentOrdersHint}</p>
      {recent.map((o) => (
        <button key={o.orderNum} type="button" className="track-recent-btn" onClick={() => onPick(o)}>
          {o.orderNum} <span>→</span>
        </button>
      ))}
    </div>
  );
}

function PhoneLookup({ onFound, t, locale }: { onFound: (orderNum: string, phone: string) => void; t: any; locale: string }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [matches, setMatches] = useState<OrderPhoneMatch[] | null>(null);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    setError('');
    setMatches(null);
    try {
      const res = await fetch(`/api/orders/by-phone?phone=${encodeURIComponent(phone.trim())}`);
      // res.json() resolves to `unknown` under real fetch typings — cast to
      // this endpoint's actual response shape.
      const data = (await res.json()) as { error?: string; orders?: OrderPhoneMatch[] };
      if (!res.ok) {
        setError(data.error || t.track.genericError);
        return;
      }
      if (!data.orders || data.orders.length === 0) {
        setError(t.track.noPhoneMatches);
        return;
      }
      setMatches(data.orders);
    } catch {
      setError(t.track.genericError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="track-phone-lookup">
      <form onSubmit={search} className="track-form" style={{ marginBottom: matches ? 16 : 0 }}>
        <label>
          {t.track.phoneLabel}
          <input
            type="tel"
            value={phone}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
            placeholder={t.track.phonePlaceholder}
          />
        </label>
        <button type="submit" className={`btn-primary${loading ? ' is-loading' : ''}`} disabled={loading}>
          {loading ? t.track.searching : t.track.findMyOrders}
        </button>
        {error && <span className="field-error">{error}</span>}
      </form>

      {matches && (
        <div className="track-recent">
          <p className="track-recent-title">{t.track.recentOrdersForNumber}</p>
          {matches.map((o) => (
            <button
              key={o.orderNum}
              type="button"
              className="track-recent-btn"
              onClick={() => onFound(o.orderNum, phone.trim())}
            >
              {o.orderNum} <span className="track-recent-meta">{formatDate(o.createdAt, locale)}</span> <span>→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Feature 1 — "Reorder this". Two-step by design: fetching the reorder
// data first (so any "N items skipped" notice is visible on THIS page,
// before leaving it) and only navigating to checkout once the customer
// explicitly continues — matches the brief's "lands the customer on
// checkout with the cart already filled — not an auto-submitted order
// (they should still review before confirming)".
function ReorderButton({ orderNum, phone, t }: { orderNum: string; phone: string; t: any }) {
  const router = useRouter();
  const lp = useLocalePath();
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ cart: CartLine[]; skippedCount: number; addedCount: number } | null>(null);

  const fetchReorder = async () => {
    setStatus('loading');
    setError('');
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderNum)}/reorder?phone=${encodeURIComponent(phone)}`);
      // res.json() resolves to `unknown` under real fetch typings — cast to
      // this endpoint's actual response shape.
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        cart?: CartLine[];
        skippedCount?: number;
        addedCount?: number;
      };
      if (!res.ok || !data.cart) {
        setError(data.error || t.track.reorderGenericError);
        setStatus('error');
        return;
      }
      setResult({ cart: data.cart, skippedCount: data.skippedCount || 0, addedCount: data.addedCount || data.cart.length });
      setStatus('ready');
    } catch {
      setError(t.track.reorderGenericError);
      setStatus('error');
    }
  };

  // Writes into the SAME sessionStorage keys StoreContext.tsx's cart-
  // persistence effect and one-shot checkout-open effect already read on
  // mount (see that file's header comment on why this is the only way to
  // hand off state to a different page's StoreProvider instance) — this
  // page never imports StoreContext itself for cart state.
  const continueToCheckout = () => {
    if (!result) return;
    try {
      sessionStorage.setItem('ozy_cart', JSON.stringify(result.cart));
      sessionStorage.setItem('ozy_open_checkout', '1');
    } catch {
      // Storage unavailable — still navigate; the customer just lands on
      // an empty cart instead of a pre-filled one, same degraded
      // experience session storage being unavailable already causes
      // elsewhere in this app.
    }
    router.push(lp('/menu'));
  };

  if (status === 'ready' && result) {
    return (
      <div className="track-recent" style={{ marginTop: 16 }}>
        <p className="track-recent-title">
          {result.skippedCount > 0
            ? t.track.reorderSkippedNotice(result.skippedCount)
            : t.track.reorderReadyNotice(result.addedCount)}
        </p>
        <button type="button" className="btn-primary" onClick={continueToCheckout}>
          {t.track.reorderContinue}
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <button type="button" className="btn-primary" onClick={fetchReorder} disabled={status === 'loading'}>
        {status === 'loading' ? t.track.reorderLoading : t.track.reorderButton}
      </button>
      {status === 'error' && <p className="field-error" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}

function TrackForm({ t, locale }: { t: any; locale: string }) {
  const [orderNum, setOrderNum] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<OrderTrackingResult | null>(null);
  const [lostOrderNum, setLostOrderNum] = useState(false);

  const lookup = async (num: string, ph: string) => {
    setLoading(true);
    setError('');
    setOrder(null);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(num.trim())}?phone=${encodeURIComponent(ph.trim())}`
      );
      if (!res.ok) {
        setError(t.track.notFoundError);
        return;
      }
      const data = (await res.json()) as OrderTrackingResult;
      setOrder(data);
      setOrderNum(num);
      setPhone(ph);
      setLostOrderNum(false);
    } catch {
      setError(t.track.genericError);
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!orderNum.trim() || !phone.trim()) {
      setError(t.track.fillBothFields);
      return;
    }
    lookup(orderNum, phone);
  };

  return (
    <>
      {!order && !lostOrderNum && (
        <RecentOrderShortcut onPick={(o) => lookup(o.orderNum, o.phone)} t={t} />
      )}

      {!order && !lostOrderNum && (
        <>
          <form className="track-form" onSubmit={submit}>
            <label>
              {t.track.orderNumberLabel}
              <input
                type="text"
                value={orderNum}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setOrderNum(e.target.value)}
                placeholder={t.track.orderNumberPlaceholder}
                autoCapitalize="characters"
              />
            </label>
            <label>
              {t.track.phoneLabel}
              <input
                type="tel"
                value={phone}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                placeholder={t.track.phonePlaceholder}
              />
            </label>
            <button type="submit" className={`btn-primary${loading ? ' is-loading' : ''}`} disabled={loading}>
              {loading ? t.track.lookingUp : t.track.trackOrderBtn}
            </button>
            {error && <span className="field-error">{error}</span>}
          </form>
          <button type="button" className="track-lost-link" onClick={() => { setLostOrderNum(true); setError(''); }}>
            {t.track.dontHaveOrderNumber}
          </button>
        </>
      )}

      {!order && lostOrderNum && (
        <>
          <PhoneLookup onFound={(num, ph) => lookup(num, ph)} t={t} locale={locale} />
          <button type="button" className="track-lost-link" onClick={() => { setLostOrderNum(false); setError(''); }}>
            {t.track.backToOrderNumber}
          </button>
        </>
      )}

      {order && (
        <div className="track-result">
          <div className="track-result-head">
            <div>
              <div className="track-order-num">{order.order_num}</div>
              <div className="track-placed-at">{t.track.placedAt(formatDate(order.created_at, locale))}</div>
            </div>
          </div>

          {order.estimated_ready_at && ['preparing', 'on_the_way'].includes(order.status) && (
            <EtaCountdown etaIso={order.estimated_ready_at} t={t} locale={locale} />
          )}

          <OrderTimeline status={order.status} t={t} />

          <div className="track-items">
            {(order.items || []).map((item) => {
              const details = parseDetails(item.details);
              return (
                <div className="track-item-row" key={item.id}>
                  <div>
                    <div className="track-item-name">{item.qty}× {item.name}</div>
                    {details.length > 0 && <div className="track-item-meta">{details.join(', ')}</div>}
                  </div>
                  <span className="cs-price">{Number(item.line_total).toFixed(2)} €</span>
                </div>
              );
            })}
            <div className="track-total-row">
              <span>{t.checkout.total}</span>
              <span>{Number(order.total).toFixed(2)} €</span>
            </div>
          </div>

          <p className="track-address">
            {t.track.deliveringTo(order.address, order.payment_method === 'cod' ? t.track.codPaymentLabel : order.payment_method)}
          </p>

          <ReorderButton orderNum={order.order_num} phone={phone} t={t} />

          <button type="button" className="track-lost-link" onClick={() => setOrder(null)}>
            {t.track.trackDifferentOrder}
          </button>
        </div>
      )}
    </>
  );
}

export default function TrackPageClient() {
  const t = useTranslations();
  // useLocale() is typed (via next/navigation's useParams()) as
  // string | string[] since lib/i18n/index.js stays a plain .js module —
  // it only ever returns a single locale string ('fi' | 'en') at runtime.
  // Same cast as context/StoreContext.tsx.
  const locale = useLocale() as string;

  return (
    <StoreProvider>
      <Header />
      <main className="wrap track-page">
        <p className="eyebrow">{t.track.eyebrow}</p>
        <h1>{t.track.heading}</h1>
        <p className="desc">
          {t.track.desc}
        </p>
        <TrackForm t={t} locale={locale} />
      </main>
      <Footer />
    </StoreProvider>
  );
}
