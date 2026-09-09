'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '@/components/admin/charts/colors';

const COLUMNS = [
  { status: 'received', title: 'New', next: 'preparing', nextLabel: 'Start preparing →' },
  { status: 'preparing', title: 'Preparing', next: 'on_the_way', nextLabel: 'Send out →' },
  { status: 'on_the_way', title: 'Out for delivery', next: 'delivered', nextLabel: 'Mark delivered →' },
  { status: 'delivered', title: 'Delivered', next: null, nextLabel: null },
];

const POLL_MS = 15000;

function minutesAgo(createdAt) {
  // D1's CURRENT_TIMESTAMP is UTC without a "Z" suffix — without it, Safari/JS
  // parses the string as local time and gets the age wrong by several hours.
  const iso = createdAt.includes('T') ? createdAt : `${createdAt.replace(' ', 'T')}Z`;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 60000));
}

function ageColor(mins) {
  if (mins >= 20) return '#FF6A5C';
  if (mins >= 10) return '#E3A73B';
  return '#7CB86A';
}

function OrderDetailModal({ token, order, onClose, onAdvance, onCancel, movingId }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/orders/${order.id}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, order.id]);

  const col = COLUMNS.find((c) => c.status === order.status);
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
        onClick={(e) => e.stopPropagation()}
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
              {col && col.next && (
                <button
                  type="button"
                  disabled={movingId === order.id}
                  onClick={() => onAdvance(order, col.next)}
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

function EtaPromptModal({ token, order, onConfirm, onClose }) {
  const [custom, setCustom] = useState('');
  const [items, setItems] = useState(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const presets = [15, 20, 25, 30, 45];

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/orders/${order.id}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setItems(d.items || []); })
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
        onClick={(e) => e.stopPropagation()}
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
            onChange={(e) => setCustom(e.target.value)}
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

export default function OrderKanban({ token, size = 'normal' }) {
  const large = size === 'large';
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState(null);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [etaOrder, setEtaOrder] = useState(null); // order currently being accepted (ETA prompt open)
  const [soundOn, setSoundOn] = useState(true);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [flash, setFlash] = useState(false);
  const [, forceTick] = useState(0);

  const seenIds = useRef(null); // null until first load completes
  const audioRef = useRef(null);

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
          seenIds.current = new Set(data.map((o) => o.id));
        } else {
          const newOnes = data.filter((o) => !seenIds.current.has(o.id));
          if (newOnes.length > 0) {
            seenIds.current = new Set(data.map((o) => o.id));
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
  const advance = async (order, nextStatus, etaMinutes) => {
    setMovingId(order.id);
    try {
      const body = { status: nextStatus };
      if (etaMinutes) body.estimated_minutes = etaMinutes;
      await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o)));
      if (seenIds.current) seenIds.current.add(order.id);
    } finally {
      setMovingId(null);
    }
  };

  // "Start preparing" on a brand-new order means accepting it — ask for an
  // ETA first instead of advancing immediately, so the customer can see it
  // on /track. Any other column's "next" action advances right away.
  const handleAdvanceClick = (order, nextStatus) => {
    if (order.status === 'received' && nextStatus === 'preparing') {
      setEtaOrder(order);
    } else {
      advance(order, nextStatus);
    }
  };

  const cancelOrder = async (order) => {
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
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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
            <input type="checkbox" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} style={large ? { width: 20, height: 20 } : undefined} />
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
                .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

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

                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {col.next && (
                              <button
                                type="button"
                                disabled={movingId === order.id}
                                onClick={() => handleAdvanceClick(order, col.next)}
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
