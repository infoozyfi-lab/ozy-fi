'use client';

import { useEffect, useState } from 'react';
import { StoreProvider } from '@/context/StoreContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const STEPS = [
  { key: 'received', label: 'Order received' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'on_the_way', label: 'On the way' },
  { key: 'delivered', label: 'Delivered' },
];

function stepIndex(status) {
  const i = STEPS.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i + 1;
}

function OrderTimeline({ status }) {
  if (status === 'cancelled') {
    return (
      <div className="track-cancelled">
        <span style={{ fontSize: '1.3rem' }}>⚠️</span>
        <span>This order was cancelled. If that&apos;s unexpected, please call us.</span>
      </div>
    );
  }

  const current = stepIndex(status);

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

function parseDetails(raw) {
  if (!raw) return [];
  try {
    const d = JSON.parse(raw);
    return Array.isArray(d) ? d : [];
  } catch {
    return [];
  }
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function TrackForm() {
  const [orderNum, setOrderNum] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!orderNum.trim() || !phone.trim()) {
      setError('Please enter both your order number and phone number.');
      return;
    }
    setLoading(true);
    setError('');
    setOrder(null);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderNum.trim())}?phone=${encodeURIComponent(phone.trim())}`
      );
      if (!res.ok) {
        setError("We couldn't find an order matching that number and phone. Double-check both and try again.");
        return;
      }
      const data = await res.json();
      setOrder(data);
    } catch {
      setError('Something went wrong. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form className="track-form" onSubmit={submit}>
        <label>
          Order number
          <input
            type="text"
            value={orderNum}
            onChange={(e) => setOrderNum(e.target.value)}
            placeholder="e.g. OZY-AB123456"
            autoCapitalize="characters"
          />
        </label>
        <label>
          Phone number
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="The number you used at checkout"
          />
        </label>
        <button type="submit" className={`btn-primary${loading ? ' is-loading' : ''}`} disabled={loading}>
          {loading ? 'Looking up your order…' : 'Track order'}
        </button>
        {error && <span className="field-error">{error}</span>}
      </form>

      {order && (
        <div className="track-result">
          <div className="track-result-head">
            <div>
              <div className="track-order-num">{order.order_num}</div>
              <div className="track-placed-at">Placed {formatDate(order.created_at)}</div>
            </div>
          </div>

          <OrderTimeline status={order.status} />

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
              <span>Total</span>
              <span>{Number(order.total).toFixed(2)} €</span>
            </div>
          </div>

          <p className="track-address">
            Delivering to {order.address} · {order.payment_method === 'cod' ? 'Cash on delivery' : order.payment_method}
          </p>
        </div>
      )}
    </>
  );
}

export default function TrackPage() {
  useEffect(() => {
    document.title = 'Track your order — ozy.fi';
  }, []);

  return (
    <StoreProvider>
      <Header />
      <main className="wrap track-page">
        <p className="eyebrow">Order status</p>
        <h1>Track your order</h1>
        <p className="desc">
          Enter your order number (from your confirmation) and the phone number you used at checkout.
        </p>
        <TrackForm />
      </main>
      <Footer />
    </StoreProvider>
  );
}
