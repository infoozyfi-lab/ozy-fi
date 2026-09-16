'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ChangeEvent } from 'react';
import { formatCurrency } from '@/components/admin/charts/colors';
import type { OrderRow, OrderItemRow, OrderStatus } from '@/lib/types';

interface KanbanColumn {
  status: OrderStatus;
  title: string;
  next: OrderStatus | null;
  nextLabel: string | null;
}

const COLUMNS: KanbanColumn[] = [
  { status: 'received', title: 'New', next: 'preparing', nextLabel: 'Start preparing →' },
  { status: 'preparing', title: 'Preparing', next: 'on_the_way', nextLabel: 'Send out →' },
  { status: 'on_the_way', title: 'Out for delivery', next: 'delivered', nextLabel: 'Mark delivered →' },
  { status: 'delivered', title: 'Delivered', next: null, nextLabel: null },
];

const POLL_MS = 15000;

function minutesAgo(createdAt: string): number {
  // D1's CURRENT_TIMESTAMP is UTC without a "Z" suffix — without it, Safari/JS
  // parses the string as local time and gets the age wrong by several hours.
  const iso = createdAt.includes('T') ? createdAt : `${createdAt.replace(' ', 'T')}Z`;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 60000));
}

function ageColor(mins: number): string {
  if (mins >= 20) return '#FF6A5C';
  if (mins >= 10) return '#E3A73B';
  return '#7CB86A';
}

// The admin order-detail fetch (/api/admin/orders/:id) returns the order row
// plus its line items — a narrower shape than the full OrderRow (only the
// fields this modal actually displays).
interface OrderDetail {
  customer_name: string;
  phone: string;
  address: string;
  notes?: string | null;
  driver_name?: string | null;
  items: OrderItemRow[];
}

function OrderDetailModal({
  token,
  order,
  onClose,
  onAdvance,
  onCancel,
  movingId,
}: {
  token: string | null;
  order: OrderRow;
  onClose: () => void;
  onAdvance: (order: OrderRow, next: OrderStatus) => void;
  onCancel: (order: OrderRow) => void;
  movingId: number | null;
}) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/orders/${order.id}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setDetail(d as OrderDetail); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, order.id]);

  const col = COLUMNS.find((c) => c.status === order.status);
  // Captured as a plain local rather than read as `col.next` inside the
  // onClick below — a nested closure doesn't reliably keep TypeScript's
  // narrowing of an *optional property read*, only of a plain const like
  // this one. Same truth value as the original `col && col.next` check.
  const nextStatus = col?.next ?? null;
  const mins = minutesAgo(order.created_at);

  return (
    <div
      role="dialog"
      aria-label={`Order ${order.order_num}`}
      style={{
        position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(10,6,4,0.85)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto',
          borderRadius: '16px 16px 0 0', border: '1px solid var(--line)', borderBottom: 'none',
          padding: '20px 18px 28px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>{order.order_num}</h2>
            <span
              style={{
                display: 'inline-block', marginTop: 6, fontSize: 12, fontWeight: 700, color: '#1A0D06',
                background: ageColor(mins), borderRadius: 999, padding: '3px 10px',
              }}
            >
              {mins} min ago
            </span>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 28, lineHeight: 1, cursor: 'pointer', padding: 4 }}>
            ×
          </button>
        </div>

        {loading ? (
          <p style={{ marginTop: 20 }}>Loading order details…</p>
        ) : !detail ? (
          <p style={{ marginTop: 20 }}>Could not load order details.</p>
        ) : (
          <>
            <div style={{ marginTop: 18, padding: 14, background: 'var(--bg-alt)', borderRadius: 10 }}>
              <p style={{ margin: '0 0 4px', color: 'var(--muted)', fontSize: 12 }}>CUSTOMER</p>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{detail.customer_name}</p>
              <p style={{ margin: '6px 0 0', fontSize: 16 }}>📞 {detail.phone}</p>
              <p style={{ margin: '4px 0 0', fontSize: 15, color: 'var(--cream)' }}>📍 {detail.address}</p>
              {detail.notes && (
                <p style={{ margin: '10px 0 0', fontSize: 14, color: '#E3A73B' }}>📝 {detail.notes}</p>
              )}
              {detail.driver_name && (
                <p style={{ margin: '10px 0 0', fontSize: 14 }}>🛵 Driver: <strong>{detail.driver_name}</strong></p>
              )}
            </div>

            <div style={{ marginTop: 18 }}>
              <p style={{ margin: '0 0 8px', color: 'var(--muted)', fontSize: 12 }}>ITEMS</p>
              {(detail.items || []).map((item) => (
                <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
                    <strong>{item.qty}× {item.name}</strong>
                    <span>{formatCurrency(item.line_total)}</span>
                  </div>
                  {item.details && (() => {
                    try {
                      const d = JSON.parse(item.details);
                      return d.length ? <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 3 }}>{d.join(', ')}</div> : null;
                    } catch {
                      return null;
                    }
                  })()}
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, fontSize: 18, fontWeight: 700 }}>
                <span>Total</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              {col && nextStatus && (
                <button
                  type="button"
                  disabled={movingId === order.id}
                  onClick={() => onAdvance(order, nextStatus)}
                  style={{
                    flex: 1, background: 'var(--ember)', color: '#1A0D06', border: 'none',
                    borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {movingId === order.id ? 'Updating…' : col.nextLabel}
                </button>
              )}
              {order.status !== 'delivered' && order.status !== 'cancelled' && (
                <button
                  type="button"
                  disabled={movingId === order.id}
                  onClick={() => onCancel(order)}
                  style={{
                    background: 'none', color: '#FF8A75', border: '1px solid #5A2A1F',
                    borderRadius: 10, padding: '14px 16px', fontSize: 14, cursor: 'pointer',
                  }}
                >
                  Cancel order
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EtaPromptModal({
  token,
  order,
  onConfirm,
  onClose,
}: {
  token: string | null;
  order: OrderRow;
  onConfirm: (minutes: number) => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState('');
  const [items, setItems] = useState<OrderItemRow[] | null>(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const presets = [15, 20, 25, 30, 45];

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/orders/${order.id}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setItems((d as { items?: OrderItemRow[] }).items || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingItems(false); });
    return () => { cancelled = true; };
  }, [token, order.id]);

  return (
    <div
      role="dialog"
      aria-label="How long will this take?"
      style={{ position: 'fixed', inset: 0, zIndex: 950, background: 'rgba(10,6,4,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
        style={{ background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 14, padding: 22, width: '100%', maxWidth: 380, maxHeight: '85vh', overflowY: 'auto' }}
      >
        <h3 style={{ margin: '0 0 4px' }}>Accept {order.order_num}</h3>

        <div style={{ margin: '12px 0 16px', padding: 12, background: 'var(--bg-alt)', borderRadius: 8 }}>
          {loadingItems ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Loading order items…</p>
          ) : items && items.length > 0 ? (
            items.map((item) => (
              <div key={item.id} style={{ fontSize: 14, padding: '4px 0' }}>
                <strong>{item.qty}×</strong> {item.name}
              </div>
            ))
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Could not load items.</p>
          )}
        </div>

        <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: 14 }}>How long will this take?</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          {presets.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onConfirm(m)}
              style={{ background: 'var(--bg-alt)', color: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 8, padding: '12px 6px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
            >
              {m} min
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="number"
            min="1"
            placeholder="Custom minutes"
            value={custom}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setCustom(e.target.value)}
            style={{ flex: 1, padding: 12, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-alt)', color: 'var(--cream)', fontSize: 15 }}
          />
          <button
            type="button"
            disabled={!custom || Number(custom) <= 0}
            onClick={() => onConfirm(Number(custom))}
            style={{ background: 'var(--ember)', color: '#1A0D06', border: 'none', borderRadius: 8, padding: '12px 18px', fontWeight: 700, cursor: 'pointer' }}
          >
            Confirm
          </button>
        </div>

        <button type="button" onClick={onClose} style={{ marginTop: 14, background: 'none', border: 'none', color: 'var(--muted)', textDecoration: 'underline', fontSize: 13, cursor: 'pointer', padding: 0 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// Phase 7.1 — shown when sending an order out ("on_the_way"), mirroring
// EtaPromptModal's UX above (same overlay/card shape, same "quick presets
// + free entry" pattern — recent driver names instead of minute presets).
// Skippable: nobody's forced to name a driver before the order can move,
// since a small team might not always have that info handy at send-out
// time.
function DriverPromptModal({
  order,
  recentDrivers,
  onConfirm,
  onSkip,
  onClose,
}: {
  order: OrderRow;
  recentDrivers: string[];
  onConfirm: (name: string) => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');

  return (
    <div
      role="dialog"
      aria-label="Who's delivering this?"
      style={{ position: 'fixed', inset: 0, zIndex: 950, background: 'rgba(10,6,4,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
        style={{ background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 14, padding: 22, width: '100%', maxWidth: 380, maxHeight: '85vh', overflowY: 'auto' }}
      >
        <h3 style={{ margin: '0 0 4px' }}>Send out {order.order_num}</h3>
        <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: 14 }}>Who's delivering this?</p>

        {recentDrivers.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {recentDrivers.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onConfirm(d)}
                style={{ background: 'var(--bg-alt)', color: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 999, padding: '8px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                {d}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Driver name"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            style={{ flex: 1, padding: 12, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-alt)', color: 'var(--cream)', fontSize: 15 }}
          />
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => onConfirm(name.trim())}
            style={{ background: 'var(--ember)', color: '#1A0D06', border: 'none', borderRadius: 8, padding: '12px 18px', fontWeight: 700, cursor: 'pointer' }}
          >
            Confirm
          </button>
        </div>

        <button type="button" onClick={onSkip} style={{ marginTop: 14, background: 'none', border: 'none', color: 'var(--muted)', textDecoration: 'underline', fontSize: 13, cursor: 'pointer', padding: 0 }}>
          Send without a driver
        </button>
      </div>
    </div>
  );
}

export default function OrderKanban({ token, size = 'normal' }: { token: string | null; size?: 'normal' | 'large' }) {
  const large = size === 'large';
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [viewingOrder, setViewingOrder] = useState<OrderRow | null>(null);
  const [etaOrder, setEtaOrder] = useState<OrderRow | null>(null); // order currently being accepted (ETA prompt open)
  const [driverOrder, setDriverOrder] = useState<OrderRow | null>(null); // order currently being sent out (driver prompt open)
  const [soundOn, setSoundOn] = useState(true);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [flash, setFlash] = useState(false);
  const [, forceTick] = useState(0);

  const seenIds = useRef<Set<number> | null>(null); // null until first load completes
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Re-render every 30s just to keep the age badges/colors moving forward
  // even when no new order has arrived.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // `token` is kept as a plain "are we ready to load yet" flag from the
    // parent (AdminDashboard / KitchenPage) — as of phase 5b it's not a
    // real secret and isn't sent anywhere; every fetch() below relies on
    // the httpOnly admin cookie instead, sent automatically same-origin.
    if (!token) return undefined;

    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/admin/orders');
        const data = await res.json();
        if (cancelled || !Array.isArray(data)) return;

        if (seenIds.current === null) {
          // First load — just remember what's already there, don't alert.
          seenIds.current = new Set(data.map((o: OrderRow) => o.id));
        } else {
          // Captured to a local const: a property read like `seenIds.current`
          // doesn't reliably keep its non-null narrowing inside the nested
          // closure passed to filter() below, even though it's already been
          // checked non-null on this branch.
          const seen = seenIds.current;
          const newOnes = data.filter((o: OrderRow) => !seen.has(o.id));
          if (newOnes.length > 0) {
            seenIds.current = new Set(data.map((o: OrderRow) => o.id));
            setFlash(true);
            setTimeout(() => setFlash(false), 4000);
          }
        }

        setOrders(data);
      } catch {
        // Keep showing the last good list rather than clearing it on a
        // transient network hiccup.
      } finally {
        setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  // Sound keeps looping for as long as there's at least one order sitting
  // in "New" (unaccepted) — not just a one-off ping — so a busy kitchen
  // can't miss it. Stops the moment every new order has been accepted.
  const pendingCount = orders.filter((o) => o.status === 'received').length;
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.loop = true;
    if (soundOn && soundUnlocked && pendingCount > 0) {
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Still blocked for some reason — the visual flash still works.
      });
    } else {
      audio.pause();
    }
  }, [soundOn, soundUnlocked, pendingCount]);

  // Browsers block audio.play() from firing on its own — it only works
  // right after a real tap/click. This one-time tap "unlocks" it for the
  // rest of the session, so the loop above can then start itself freely
  // whenever a new order actually arrives.
  const unlockSound = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
      }).catch(() => {});
    }
    setSoundUnlocked(true);
  };
  const advance = async (order: OrderRow, nextStatus: OrderStatus, etaMinutes?: number | null, driverName?: string | null) => {
    setMovingId(order.id);
    try {
      const body: { status: OrderStatus; estimated_minutes?: number; driver_name?: string } = { status: nextStatus };
      if (etaMinutes) body.estimated_minutes = etaMinutes;
      if (driverName) body.driver_name = driverName;
      await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, status: nextStatus, ...(driverName ? { driver_name: driverName } : {}) } : o)));
      if (seenIds.current) seenIds.current.add(order.id);
    } finally {
      setMovingId(null);
    }
  };

  // Recently-used driver names (most recent first, deduped) — shown as
  // quick-pick buttons in DriverPromptModal so the same few drivers don't
  // need retyping order after order. Derived from whatever's already
  // loaded (no extra request).
  const recentDrivers = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    orders
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .forEach((o) => {
        if (o.driver_name && !seen.has(o.driver_name)) {
          seen.add(o.driver_name);
          out.push(o.driver_name);
        }
      });
    return out.slice(0, 6);
  }, [orders]);

  // "Start preparing" on a brand-new order means accepting it — ask for an
  // ETA first instead of advancing immediately, so the customer can see it
  // on /track. "Send out" (→ on_the_way) similarly asks who's delivering
  // (Phase 7.1) — skippable, see DriverPromptModal. Any other column's
  // "next" action advances right away.
  const handleAdvanceClick = (order: OrderRow, nextStatus: OrderStatus) => {
    if (order.status === 'received' && nextStatus === 'preparing') {
      setEtaOrder(order);
    } else if (order.status === 'preparing' && nextStatus === 'on_the_way') {
      setDriverOrder(order);
    } else {
      advance(order, nextStatus);
    }
  };

  const cancelOrder = async (order: OrderRow) => {
    if (!window.confirm(`Cancel order ${order.order_num}?`)) return;
    setMovingId(order.id);
    try {
      await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, status: 'cancelled' } : o)));
    } finally {
      setMovingId(null);
    }
  };

  const activeOrders = orders.filter((o) => o.status !== 'cancelled');
  const cancelledOrders = orders
    .filter((o) => o.status === 'cancelled')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const cancelledCount = cancelledOrders.length;

  return (
    <div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src="/notification.wav" preload="auto" />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: large ? 20 : 14, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: large ? 28 : undefined }}>Orders {flash && <span style={{ color: '#FF6A3D' }}>● New!</span>}</h2>
        {!soundUnlocked ? (
          <button
            type="button"
            onClick={unlockSound}
            style={{
              background: 'var(--ember)', color: '#1A0D06', border: 'none', borderRadius: 8,
              padding: large ? '12px 18px' : '8px 14px', fontSize: large ? 16 : 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            🔔 Tap to enable sound alerts
          </button>
        ) : (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: large ? 16 : 13, color: 'var(--muted)' }}>
            <input type="checkbox" checked={soundOn} onChange={(e: ChangeEvent<HTMLInputElement>) => setSoundOn(e.target.checked)} style={large ? { width: 20, height: 20 } : undefined} />
            Sound alert for new orders
          </label>
        )}
      </div>

      {loading ? (
        <p>Loading orders…</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${large ? 280 : 240}px, 1fr))`, gap: large ? 18 : 14 }}>
            {COLUMNS.map((col) => {
              const colOrders = activeOrders
                .filter((o) => o.status === col.status)
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
              // Same reasoning as OrderDetailModal above: captured to a plain
              // local so the onClick closures below keep the narrowing.
              const nextStatus = col.next;

              return (
                <div key={col.status} style={{ background: 'var(--bg-alt)', borderRadius: 10, border: '1px solid var(--line)', padding: large ? 16 : 12, minHeight: 120 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: large ? 14 : 10 }}>
                    <strong style={{ fontSize: large ? 20 : 14 }}>{col.title}</strong>
                    <span style={{ fontSize: large ? 16 : 12, color: 'var(--muted)', background: 'var(--bg)', borderRadius: 999, padding: large ? '4px 12px' : '2px 8px' }}>
                      {colOrders.length}
                    </span>
                  </div>

                  {colOrders.length === 0 && (
                    <p style={{ fontSize: large ? 16 : 13, color: 'var(--muted)', margin: 0 }}>Nothing here.</p>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: large ? 12 : 8 }}>
                    {colOrders.map((order) => {
                      const mins = minutesAgo(order.created_at);
                      return (
                        <div
                          key={order.id}
                          style={{ background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 8, padding: large ? 16 : 10 }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => setViewingOrder(order)}
                              style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'var(--cream)' }}
                            >
                              <strong style={{ fontSize: large ? 20 : 13 }}>{order.order_num}</strong>
                              <div style={{ fontSize: large ? 17 : 12, color: 'var(--muted)' }}>{order.customer_name}</div>
                            </button>
                            <span
                              title={`${mins} min ago`}
                              style={{
                                fontSize: large ? 15 : 11, fontWeight: 700, color: '#1A0D06', background: ageColor(mins),
                                borderRadius: 999, padding: large ? '4px 10px' : '2px 7px', flexShrink: 0,
                              }}
                            >
                              {mins}m
                            </span>
                          </div>

                          <div style={{ fontSize: large ? 19 : 13, fontWeight: 700, margin: large ? '10px 0' : '6px 0' }}>
                            {formatCurrency(order.total)}
                          </div>

                          {order.driver_name && (
                            <div style={{ fontSize: large ? 14 : 11.5, color: 'var(--muted)', marginBottom: large ? 8 : 4 }}>
                              🛵 {order.driver_name}
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {nextStatus && (
                              <button
                                type="button"
                                disabled={movingId === order.id}
                                onClick={() => handleAdvanceClick(order, nextStatus)}
                                style={{
                                  flex: 1, minWidth: large ? 140 : 100, background: 'var(--ember)', color: '#1A0D06', border: 'none',
                                  borderRadius: 6, padding: large ? '14px 10px' : '7px 8px', fontSize: large ? 16 : 12, fontWeight: 700, cursor: 'pointer',
                                }}
                              >
                                {movingId === order.id ? '…' : col.nextLabel}
                              </button>
                            )}
                            {col.status !== 'delivered' && (
                              <button
                                type="button"
                                disabled={movingId === order.id}
                                onClick={() => cancelOrder(order)}
                                style={{
                                  background: 'none', color: '#FF8A75', border: '1px solid #5A2A1F',
                                  borderRadius: 6, padding: large ? '14px 12px' : '7px 8px', fontSize: large ? 15 : 12, cursor: 'pointer',
                                }}
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {cancelledCount > 0 && (
            <div style={{ marginTop: 20, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <button
                type="button"
                onClick={() => setShowCancelled((v) => !v)}
                style={{
                  background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13,
                  cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {showCancelled ? '▾' : '▸'} {cancelledCount} cancelled order{cancelledCount === 1 ? '' : 's'}
              </button>

              {showCancelled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {cancelledOrders.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => setViewingOrder(order)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: 'var(--bg-alt)', border: '1px solid var(--line)', borderRadius: 8,
                        padding: '10px 12px', cursor: 'pointer', textAlign: 'left', opacity: 0.75,
                      }}
                    >
                      <span>
                        <strong style={{ fontSize: 13 }}>{order.order_num}</strong>
                        <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>{order.customer_name}</span>
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{formatCurrency(order.total)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {etaOrder && (
        <EtaPromptModal
          token={token}
          order={etaOrder}
          onClose={() => setEtaOrder(null)}
          onConfirm={(minutes) => {
            advance(etaOrder, 'preparing', minutes);
            setEtaOrder(null);
          }}
        />
      )}

      {driverOrder && (
        <DriverPromptModal
          order={driverOrder}
          recentDrivers={recentDrivers}
          onClose={() => setDriverOrder(null)}
          onConfirm={(name) => {
            advance(driverOrder, 'on_the_way', null, name);
            setDriverOrder(null);
          }}
          onSkip={() => {
            advance(driverOrder, 'on_the_way');
            setDriverOrder(null);
          }}
        />
      )}

      {viewingOrder && (
        <OrderDetailModal
          token={token}
          order={orders.find((o) => o.id === viewingOrder.id) || viewingOrder}
          movingId={movingId}
          onClose={() => setViewingOrder(null)}
          onAdvance={async (order, next) => {
            setViewingOrder(null);
            handleAdvanceClick(order, next);
          }}
          onCancel={async (order) => {
            await cancelOrder(order);
            setViewingOrder(null);
          }}
        />
      )}
    </div>
  );
}
