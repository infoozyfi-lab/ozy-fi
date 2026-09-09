'use client';

import { useEffect, useMemo, useState, Fragment } from 'react';
import ResourceManager from '@/components/admin/ResourceManager';
import BundleManager from '@/components/admin/BundleManager';
import OrderKanban from '@/components/admin/OrderKanban';
import StatTile from '@/components/admin/charts/StatTile';
import AreaTrendChart from '@/components/admin/charts/AreaTrendChart';
import BarChart from '@/components/admin/charts/BarChart';
import ColumnChart from '@/components/admin/charts/ColumnChart';
import StatusMixBar from '@/components/admin/charts/StatusMixBar';
import StatusPill, { STATUS_LABELS as STATUS_LABELS_LOCAL } from '@/components/admin/charts/StatusPill';
import { CATEGORICAL, BRAND, GOLD, formatCurrency, formatCompactCurrency, formatNumber, percentChange } from '@/components/admin/charts/colors';

const ORDER_STATUSES = ['received', 'preparing', 'on_the_way', 'delivered', 'cancelled'];
const STATUS_LABELS = {
  received: 'Received',
  preparing: 'Preparing',
  on_the_way: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const box = {
  background: 'var(--bg-card)',
  padding: '24px',
  borderRadius: '14px',
  border: '1px solid var(--line)',
  marginBottom: '24px',
  color: 'var(--cream)',
};

const card = {
  background: 'var(--bg-card)',
  padding: '20px 22px',
  borderRadius: '14px',
  border: '1px solid var(--line)',
  color: 'var(--cream)',
};

const cardTitle = { margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--cream)' };

const tabBtn = (active) => ({
  padding: '10px 18px',
  border: '1px solid var(--line)',
  borderBottom: active ? '2px solid var(--ember)' : '1px solid var(--line)',
  borderRadius: '8px 8px 0 0',
  background: active ? 'var(--bg-card)' : 'var(--bg-alt)',
  color: active ? 'var(--cream)' : 'var(--muted)',
  cursor: 'pointer',
  fontWeight: active ? 700 : 400,
});

const inputStyle = {
  width: '100%',
  padding: '10px',
  marginTop: '4px',
  boxSizing: 'border-box',
  border: '1px solid var(--line)',
  borderRadius: '8px',
  fontSize: 14,
  background: 'var(--bg-alt)',
  color: 'var(--cream)',
};

const btn = {
  padding: '8px 14px',
  border: '1px solid var(--line)',
  borderRadius: '8px',
  background: 'var(--bg-alt)',
  color: 'var(--cream)',
  cursor: 'pointer',
  fontSize: 13,
  marginRight: 8,
};
const btnPrimary = { ...btn, background: 'var(--ember)', color: '#1A0D06', border: 'none', fontWeight: 700 };
const btnDanger = { ...btn, background: '#FF6A5C', color: '#1A0D06', border: 'none', fontWeight: 700 };

const th = { textAlign: 'left', padding: '10px', color: 'var(--muted)', fontSize: 12.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' };
const td = { padding: '12px 10px', borderTop: '1px solid var(--line)', fontSize: 13.5 };

/* ---------------- Shared data hooks ---------------- */

function useOrders(token) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/orders', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  return { orders, setOrders, loading, reload: load };
}

// Single fetch backing every chart & KPI on Overview + Reports — one
// server-side aggregation pass instead of each tab pulling the full order
// list and re-computing it in the browser.
function useAnalytics(token) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    if (!token) return; // not signed in yet — the real fetch fires once the token lands
    setLoading(true);
    setError('');
    fetch('/api/admin/analytics', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) throw new Error('Could not load analytics.');
        return res.json();
      })
      .then(setData)
      .catch(() => setError('Could not load analytics.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  return { data, loading, error, reload: load };
}

// Fills gaps in the server's day-grouped revenue rows so the trend chart
// always draws a full, evenly-spaced 30-day line instead of skipping
// zero-order days.
function fillDailyRevenue(rows, days = 30) {
  const byDay = {};
  (rows || []).forEach((r) => { byDay[r.day] = r; });
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push(byDay[key] || { day: key, revenue: 0, orders: 0 });
  }
  return out;
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => `${h}`.padStart(2, '0'));

function fillHourly(rows) {
  const byHour = {};
  (rows || []).forEach((r) => { byHour[r.hour] = r.count; });
  return HOUR_LABELS.map((label, h) => ({ label, value: byHour[h] || 0 }));
}

/* ---------------- Overview (Dashboard home) ---------------- */

function OverviewTab({ token, analytics, analyticsLoading, reloadAnalytics }) {
  const { orders, loading: ordersLoading } = useOrders(token);
  const [productCount, setProductCount] = useState(null);

  useEffect(() => {
    fetch('/api/admin/products', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setProductCount(Array.isArray(d) ? d.length : null))
      .catch(() => {});
  }, [token]);

  if (analyticsLoading || !analytics) return <p>Loading dashboard…</p>;

  const { summary, revenueByDay, bestSellers, categoryBreakdown, statusBreakdown, hourlyDistribution } = analytics;

  const revenueTrend = fillDailyRevenue(revenueByDay, 30);
  const last7Sparkline = revenueTrend.slice(-7).map((d) => d.revenue);
  const hourlyData = fillHourly(hourlyDistribution);
  const statusCounts = Object.fromEntries((statusBreakdown || []).map((s) => [s.status, s.count]));

  const revenueDelta = percentChange(summary.today.revenue, summary.yesterday.revenue);
  const ordersDelta = percentChange(summary.today.orders, summary.yesterday.orders);
  const weekDelta = percentChange(summary.last7Days.revenue, summary.prev7Days.revenue);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13.5 }}>Last 30 days, updated live from your orders.</p>
        <button type="button" style={btn} onClick={reloadAnalytics}>Refresh</button>
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 20 }}>
        <StatTile
          label="Today's Sales"
          value={formatCurrency(summary.today.revenue)}
          delta={revenueDelta}
          deltaLabel="vs yesterday"
          accent={BRAND}
          sparkline={last7Sparkline}
        />
        <StatTile label="Today's Orders" value={formatNumber(summary.today.orders)} delta={ordersDelta} deltaLabel="vs yesterday" accent={GOLD} />
        <StatTile label="Sales, Last 7 Days" value={formatCurrency(summary.last7Days.revenue)} delta={weekDelta} deltaLabel="vs prior 7 days" accent={CATEGORICAL[0]} />
        <StatTile label="Pending Orders" value={formatNumber(summary.pendingOrders)} sublabel="in the kitchen or on the way" goodDirection="down" />
        <StatTile label="Avg Order Value" value={formatCurrency(summary.avgOrderValue)} sublabel="all-time" />
        <StatTile label="Total Products" value={productCount === null ? '…' : formatNumber(productCount)} sublabel="active in menu" />
      </section>

      <div style={{ ...card, marginBottom: 20 }}>
        <h2 style={cardTitle}>Revenue — last 30 days</h2>
        <AreaTrendChart data={revenueTrend} color={BRAND} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 20 }}>
        <div style={card}>
          <h2 style={cardTitle}>Best sellers</h2>
          <BarChart
            items={bestSellers.map((p) => ({ label: p.name, value: p.qty, sublabel: formatCurrency(p.revenue) }))}
            color={BRAND}
            valueFormatter={(v) => `${formatNumber(v)}×`}
            emptyMessage="No items sold yet."
          />
        </div>
        <div style={card}>
          <h2 style={cardTitle}>Revenue by category</h2>
          <BarChart
            items={categoryBreakdown.slice(0, 8).map((c) => ({ label: c.category, value: c.revenue, sublabel: `${formatNumber(c.qty)} sold` }))}
            color={(i) => CATEGORICAL[i % CATEGORICAL.length]}
            valueFormatter={formatCompactCurrency}
            emptyMessage="No sales yet."
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 20 }}>
        <div style={card}>
          <h2 style={cardTitle}>Order status mix (30d)</h2>
          <StatusMixBar counts={statusCounts} />
        </div>
        <div style={card}>
          <h2 style={cardTitle}>Peak ordering hours (30d)</h2>
          <ColumnChart data={hourlyData} color={BRAND} />
        </div>
      </div>

      <div style={box}>
        <h2 style={{ marginTop: 0 }}>Recent Orders</h2>
        {ordersLoading ? (
          <p>Loading…</p>
        ) : orders.length === 0 ? (
          <p>No orders yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Order</th>
                  <th style={th}>Customer</th>
                  <th style={th}>Total</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 8).map((o) => (
                  <tr key={o.id}>
                    <td style={td}>{o.order_num}</td>
                    <td style={td}>{o.customer_name}</td>
                    <td style={td}>{formatCurrency(o.total)}</td>
                    <td style={td}><StatusPill status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* ---------------- Orders (with detail + status) ---------------- */

function OrderDetailRow({ token, order }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/orders/${order.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, order.id]);

  return (
    <tr>
      <td colSpan={5} style={{ padding: 16, background: 'var(--bg-alt)', borderTop: '1px solid var(--line)' }}>
        {loading ? (
          <p style={{ margin: 0 }}>Loading details…</p>
        ) : !detail ? (
          <p style={{ margin: 0 }}>Could not load order details.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
            <div>
              <p style={{ margin: '0 0 4px', color: 'var(--muted)', fontSize: 13 }}>Customer</p>
              <p style={{ margin: 0 }}>{detail.customer_name}</p>
              <p style={{ margin: 0 }}>{detail.phone}</p>
              <p style={{ margin: 0 }}>{detail.email}</p>
              <p style={{ margin: 0 }}>{detail.address}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px', color: 'var(--muted)', fontSize: 13 }}>Order info</p>
              <p style={{ margin: 0 }}>Placed: {detail.created_at}</p>
              <p style={{ margin: 0 }}>Payment: {detail.payment_method}</p>
              {detail.notes && <p style={{ margin: 0 }}>Notes: {detail.notes}</p>}
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <p style={{ margin: '0 0 4px', color: 'var(--muted)', fontSize: 13 }}>Items</p>
              {(detail.items || []).map((item) => (
                <div key={item.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <strong>{item.qty}× {item.name}</strong> — {formatCurrency(item.line_total)}
                  {item.details && (() => {
                    try {
                      const d = JSON.parse(item.details);
                      return d.length ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>{d.join(', ')}</div> : null;
                    } catch {
                      return null;
                    }
                  })()}
                </div>
              ))}
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

function OrdersTab({ token }) {
  const { orders, setOrders, loading, reload } = useOrders(token);
  const [updatingId, setUpdatingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView] = useState('board');

  const changeStatus = async (order, status) => {
    setUpdatingId(order.id);
    try {
      await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, status } : o)));
    } finally {
      setUpdatingId(null);
    }
  };

  const visibleOrders = statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter);

  if (view === 'board') {
    return (
      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <a
            href="/admin/kitchen"
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-block' }}
          >
            Open Kitchen Display ↗
          </a>
          <button type="button" style={btn} onClick={() => setView('list')}>Switch to list view</button>
        </div>
        <OrderKanban token={token} />
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0 }}>Orders</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" style={btn} onClick={() => setView('board')}>Switch to board view</button>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', marginTop: 0, padding: '8px 10px' }}>
            <option value="all">All statuses</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <button type="button" style={btn} onClick={reload}>Refresh</button>
        </div>
      </div>
      {loading ? (
        <p>Loading orders...</p>
      ) : visibleOrders.length === 0 ? (
        <p>No orders {statusFilter === 'all' ? 'yet' : `with status "${STATUS_LABELS[statusFilter]}"`}.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Order</th>
                <th style={th}>Customer</th>
                <th style={th}>Total</th>
                <th style={th}>Status</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => (
                <Fragment key={order.id}>
                  <tr>
                    <td style={td}>{order.order_num}</td>
                    <td style={td}>{order.customer_name}</td>
                    <td style={td}>{formatCurrency(order.total)}</td>
                    <td style={td}>
                      <select
                        value={order.status}
                        disabled={updatingId === order.id}
                        onChange={(e) => changeStatus(order, e.target.value)}
                        style={{ ...inputStyle, width: 'auto', padding: '6px 8px', marginTop: 0 }}
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td style={td}>
                      <button type="button" style={btn} onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}>
                        {expandedId === order.id ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === order.id && <OrderDetailRow token={token} order={order} />}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Customers (derived from orders) ---------------- */

function CustomersTab({ token }) {
  const { orders, loading } = useOrders(token);

  const customers = useMemo(() => {
    const byEmail = {};
    orders.forEach((o) => {
      const key = o.email || o.phone || o.customer_name;
      if (!byEmail[key]) {
        byEmail[key] = {
          name: o.customer_name,
          email: o.email,
          phone: o.phone,
          address: o.address,
          totalOrders: 0,
          totalSpent: 0,
          lastOrder: o.created_at,
        };
      }
      byEmail[key].totalOrders += 1;
      byEmail[key].totalSpent += Number(o.total || 0);
      if (o.created_at > byEmail[key].lastOrder) byEmail[key].lastOrder = o.created_at;
    });
    return Object.values(byEmail).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [orders]);

  return (
    <div style={box}>
      <h2 style={{ marginTop: 0 }}>Customers</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -8 }}>Derived from order history — not a separate customer database.</p>
      {loading ? (
        <p>Loading…</p>
      ) : customers.length === 0 ? (
        <p>No customers yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Phone</th>
                <th style={th}>Email</th>
                <th style={th}>Orders</th>
                <th style={th}>Total spent</th>
                <th style={th}>Last order</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => (
                <tr key={i}>
                  <td style={td}>{c.name}</td>
                  <td style={td}>{c.phone}</td>
                  <td style={td}>{c.email}</td>
                  <td style={td}>{c.totalOrders}</td>
                  <td style={td}>{formatCurrency(c.totalSpent)}</td>
                  <td style={td}>{c.lastOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Reports (KPI comparisons + table view) ---------------- */

function ReportsTab({ analytics, loading }) {
  if (loading || !analytics) return <p>Loading…</p>;

  const { summary, bestSellers, todayBestSellers = [], todayStatusBreakdown = [], categoryBreakdown, statusBreakdown } = analytics;
  const totalCategoryRevenue = categoryBreakdown.reduce((s, c) => s + c.revenue, 0) || 1;
  const totalStatusCount = statusBreakdown.reduce((s, st) => s + st.count, 0) || 1;

  const weekDelta = percentChange(summary.last7Days.revenue, summary.prev7Days.revenue);
  const monthDelta = percentChange(summary.last30Days.revenue, summary.prev30Days.revenue);

  const todayDelivered = todayStatusBreakdown.find((s) => s.status === 'delivered')?.count || 0;
  const todayCancelled = todayStatusBreakdown.find((s) => s.status === 'cancelled')?.count || 0;
  const todayInProgress = todayStatusBreakdown
    .filter((s) => ['received', 'preparing', 'on_the_way'].includes(s.status))
    .reduce((sum, s) => sum + s.count, 0);

  return (
    <>
      <div style={{ ...card, marginBottom: 20, border: `1px solid ${BRAND}` }}>
        <h2 style={cardTitle}>📋 Today&apos;s Closing Summary</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 18 }}>
          <StatTile label="Today's Revenue" value={formatCurrency(summary.today.revenue)} accent={BRAND} />
          <StatTile label="Today's Orders" value={formatNumber(summary.today.orders)} />
          <StatTile label="Delivered" value={formatNumber(todayDelivered)} />
          <StatTile label="Still in progress" value={formatNumber(todayInProgress)} />
          <StatTile label="Cancelled" value={formatNumber(todayCancelled)} goodDirection="down" />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--muted)' }}>Today&apos;s best sellers</h3>
        {todayBestSellers.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>No sales yet today.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Item</th>
                <th style={th}>Qty sold</th>
                <th style={th}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {todayBestSellers.map((p) => (
                <tr key={p.name}>
                  <td style={td}>{p.name}</td>
                  <td style={td}>{formatNumber(p.qty)}</td>
                  <td style={td}>{formatCurrency(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <StatTile label="Sales, Last 7 Days" value={formatCurrency(summary.last7Days.revenue)} delta={weekDelta} deltaLabel="vs the 7 days before" accent={BRAND} />
        <StatTile label="Sales, Last 30 Days" value={formatCurrency(summary.last30Days.revenue)} delta={monthDelta} deltaLabel="vs the 30 days before" accent={GOLD} />
        <StatTile label="All-Time Revenue" value={formatCurrency(summary.totalRevenue)} sublabel={`${formatNumber(summary.totalOrders)} orders`} />
        <StatTile label="Average Order Value" value={formatCurrency(summary.avgOrderValue)} sublabel="all-time" />
        <StatTile label="Cancelled Orders" value={formatNumber(summary.cancelledOrders)} sublabel="all-time" goodDirection="down" />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        <div style={card}>
          <h2 style={cardTitle}>Best sellers — table view</h2>
          {bestSellers.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No items sold yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Item</th>
                  <th style={th}>Qty sold</th>
                  <th style={th}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {bestSellers.map((p) => (
                  <tr key={p.name}>
                    <td style={td}>{p.name}</td>
                    <td style={td}>{formatNumber(p.qty)}</td>
                    <td style={td}>{formatCurrency(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={card}>
          <h2 style={cardTitle}>Revenue by category — table view</h2>
          {categoryBreakdown.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No sales yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Category</th>
                  <th style={th}>Revenue</th>
                  <th style={th}>Share</th>
                </tr>
              </thead>
              <tbody>
                {categoryBreakdown.map((c) => (
                  <tr key={c.category}>
                    <td style={td}>{c.category}</td>
                    <td style={td}>{formatCurrency(c.revenue)}</td>
                    <td style={td}>{((c.revenue / totalCategoryRevenue) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={card}>
          <h2 style={cardTitle}>Order status — last 30 days</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Status</th>
                <th style={th}>Orders</th>
                <th style={th}>Share</th>
              </tr>
            </thead>
            <tbody>
              {ORDER_STATUSES.map((s) => {
                const row = statusBreakdown.find((st) => st.status === s);
                const count = row ? row.count : 0;
                return (
                  <tr key={s}>
                    <td style={td}><StatusPill status={s} /></td>
                    <td style={td}>{formatNumber(count)}</td>
                    <td style={td}>{((count / totalStatusCount) * 100).toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ---------------- Settings ---------------- */

const SETTINGS_FIELDS = [
  { key: 'restaurant_name', label: 'Restaurant name' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Address' },
  { key: 'opening_hours', label: 'Opening hours', textarea: true },
  { key: 'minimum_order', label: 'Minimum order (€)', number: true },
  { key: 'delivery_fee', label: 'Delivery fee (€)', number: true },
];

// Shared by all three settings sections below — each one loads the full
// settings object (cheap: it's one small key/value table) but only ever
// PUTs back the handful of keys it actually owns, so the three sections
// can never clobber each other's data.
function useSettingsValues(token) {
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setValues(d || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return { values, setValues, loading };
}

function SettingsTab({ token }) {
  return <RestaurantInfoSettings token={token} />;
}

/* ---------------- Settings: Restaurant Info ---------------- */

function RestaurantInfoSettings({ token }) {
  const { values, setValues, loading } = useSettingsValues(token);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const setField = (key, val) => {
    setValues((v) => ({ ...v, [key]: val }));
    setSaved(false);
  };

  const isClosed = values.store_closed === '1';

  const toggleStoreClosed = async () => {
    const next = isClosed ? '0' : '1';
    setField('store_closed', next);
    await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ store_closed: next }),
    });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {};
      SETTINGS_FIELDS.forEach((f) => { body[f.key] = values[f.key] || ''; });
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading…</p>;

  return (
    <div style={box}>
      <h2 style={{ marginTop: 0 }}>Restaurant Settings</h2>

      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
          padding: 16, marginBottom: 24, borderRadius: 10,
          background: isClosed ? 'rgba(255,106,92,0.12)' : 'var(--bg-alt)',
          border: `1px solid ${isClosed ? '#5A2A1F' : 'var(--line)'}`,
        }}
      >
        <div>
          <strong style={{ color: isClosed ? '#FF6A5C' : 'var(--cream)' }}>
            {isClosed ? '🔴 Store is closed — not taking orders' : '🟢 Store is open — taking orders normally'}
          </strong>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            For emergencies (kitchen issue, fully booked, closing early). Takes effect immediately.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleStoreClosed}
          style={isClosed ? btnPrimary : btnDanger}
        >
          {isClosed ? 'Reopen store' : 'Close store now'}
        </button>
      </div>

      <form onSubmit={save}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {SETTINGS_FIELDS.map((f) => (
            <label key={f.key} style={f.textarea ? { gridColumn: '1 / -1' } : undefined}>
              {f.label}
              {f.textarea ? (
                <textarea
                  style={{ ...inputStyle, minHeight: 70 }}
                  value={values[f.key] || ''}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              ) : (
                <input
                  style={inputStyle}
                  type={f.number ? 'number' : 'text'}
                  step={f.number ? '0.1' : undefined}
                  value={values[f.key] || ''}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              )}
            </label>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <button type="submit" style={btnPrimary} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
          {saved && <span style={{ marginLeft: 12, color: 'var(--gold)' }}>Saved ✓</span>}
        </div>
      </form>
      <p style={{ marginTop: 16, color: 'var(--muted)', fontSize: 13 }}>
        Note: the login email/password are separate Cloudflare secrets and aren&apos;t changed here.
      </p>
    </div>
  );
}

/* ---------------- Settings: Homepage Display (featured card + popular products) ---------------- */

function HomepageDisplaySettings({ token }) {
  const { values, setValues, loading } = useSettingsValues(token);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [products, setProducts] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    fetch('/api/admin/products', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setProducts(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [token]);

  const setField = (key, val) => {
    setValues((v) => ({ ...v, [key]: val }));
    setSaved(false);
  };

  let popularIds = [];
  try { popularIds = JSON.parse(values.popular_product_ids || '[]'); } catch { popularIds = []; }

  const togglePopular = (id) => {
    const has = popularIds.includes(id);
    let next;
    if (has) {
      next = popularIds.filter((p) => p !== id);
    } else {
      if (popularIds.length >= 3) return; // cap at 3 — matches the homepage grid
      next = [...popularIds, id];
    }
    setField('popular_product_ids', JSON.stringify(next));
  };

  const uploadBannerImage = async (file) => {
    setUploading(true);
    setUploadError('');
    try {
      const body = new FormData();
      body.append('file', file, file.name || 'upload.jpg');
      const res = await fetch('/api/admin/upload', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed.');
      setField('featured_banner_image', data.url);
    } catch (err) {
      setUploadError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        featured_type: values.featured_type || 'none',
        featured_product_id: values.featured_product_id || '',
        featured_banner_title: values.featured_banner_title || '',
        featured_banner_price: values.featured_banner_price || '',
        featured_banner_image: values.featured_banner_image || '',
        popular_product_ids: values.popular_product_ids || '[]',
      };
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading…</p>;

  const featuredType = values.featured_type || 'none';

  return (
    <div style={box}>
      <h2 style={{ marginTop: 0 }}>Homepage Display</h2>

      <form onSubmit={save}>
        <h3 style={{ marginBottom: 4 }}>Homepage featured card</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
          Shown on the homepage, right below the hero. Pick a real product — its
          photo/name/price stay in sync automatically — or a custom banner. (Bundles have
          their own &quot;Combo deals&quot; section further down, so they&apos;re not offered here.)
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
          <label>
            Card type
            <select style={inputStyle} value={featuredType} onChange={(e) => setField('featured_type', e.target.value)}>
              <option value="none">None (hidden)</option>
              <option value="product">Real product</option>
              <option value="banner">Custom banner</option>
            </select>
          </label>

          {featuredType === 'product' && (
            <label>
              Featured product
              <select style={inputStyle} value={values.featured_product_id || ''} onChange={(e) => setField('featured_product_id', e.target.value)}>
                <option value="">Select…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {formatCurrency(p.price)}</option>)}
              </select>
            </label>
          )}

          {featuredType === 'banner' && (
            <>
              <label>Banner title<input style={inputStyle} value={values.featured_banner_title || ''} onChange={(e) => setField('featured_banner_title', e.target.value)} /></label>
              <label>Banner price text (optional)<input style={inputStyle} value={values.featured_banner_price || ''} onChange={(e) => setField('featured_banner_price', e.target.value)} placeholder="e.g. From €9.90" /></label>
              <label style={{ gridColumn: '1 / -1' }}>
                Banner image
                <input
                  style={inputStyle}
                  value={values.featured_banner_image || ''}
                  onChange={(e) => setField('featured_banner_image', e.target.value)}
                  placeholder="Upload below, or paste an image URL"
                />
                <input
                  type="file"
                  accept="image/*"
                  style={{ marginTop: 8, color: 'var(--cream)' }}
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files && e.target.files[0];
                    if (f) uploadBannerImage(f);
                    e.target.value = '';
                  }}
                />
                {uploading && <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>Uploading…</p>}
                {uploadError && <p style={{ fontSize: 12, color: '#FF8A75', margin: '4px 0 0' }}>{uploadError}</p>}
                {values.featured_banner_image && (
                  <img
                    src={values.featured_banner_image}
                    alt="Banner preview"
                    style={{ marginTop: 8, maxWidth: 200, borderRadius: 8, border: '1px solid var(--line)' }}
                  />
                )}
              </label>
            </>
          )}
        </div>

        <h3 style={{ marginBottom: 4 }}>Popular right now</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -2, marginBottom: 14 }}>
          Shown on the homepage, right below the category shortcuts. Pick up to 3 products.
        </p>
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginBottom: 24,
          padding: 12, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-alt)',
        }}>
          {products.map((p) => {
            const checked = popularIds.includes(p.id);
            const disabled = !checked && popularIds.length >= 3;
            return (
              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, opacity: disabled ? 0.5 : 1 }}>
                <input type="checkbox" checked={checked} disabled={disabled} onChange={() => togglePopular(p.id)} />
                {p.name}
              </label>
            );
          })}
        </div>

        <div style={{ marginTop: 16 }}>
          <button type="submit" style={btnPrimary} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
          {saved && <span style={{ marginLeft: 12, color: 'var(--gold)' }}>Saved ✓</span>}
        </div>
      </form>
    </div>
  );
}

/* ---------------- Settings: Tracking & Analytics ---------------- */

function TrackingAnalyticsSettings({ token }) {
  const { values, setValues, loading } = useSettingsValues(token);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const setField = (key, val) => {
    setValues((v) => ({ ...v, [key]: val }));
    setSaved(false);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const keys = [
        'ga4_measurement_id', 'secret_ga4_api_secret', 'ga4_debug_mode',
        'meta_pixel_id', 'secret_meta_access_token', 'meta_test_event_code',
        'tiktok_pixel_id', 'secret_tiktok_access_token', 'tiktok_test_event_code',
        'clarity_id',
      ];
      const body = {};
      keys.forEach((k) => { body[k] = values[k] || ''; });
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading…</p>;

  return (
    <div style={box}>
      <h2 style={{ marginTop: 0 }}>Tracking &amp; Analytics</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
        Optional — only fill these in once you&apos;ve created the matching ad/analytics
        accounts. Leaving a field blank means that platform stays completely off; nothing
        fires until its ID (and, for Meta/TikTok, its access token) is set here. Takes
        effect immediately on save — no redeploy needed.
      </p>

      <form onSubmit={save}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 12 }}>
          <label>
            GA4 Measurement ID
            <input style={inputStyle} type="text" placeholder="G-XXXXXXXXXX" value={values.ga4_measurement_id || ''} onChange={(e) => setField('ga4_measurement_id', e.target.value)} />
          </label>
          <label>
            GA4 API Secret
            <input style={inputStyle} type="password" placeholder="For server-side purchase/refund events" value={values.secret_ga4_api_secret || ''} onChange={(e) => setField('secret_ga4_api_secret', e.target.value)} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22 }}>
            <input type="checkbox" checked={values.ga4_debug_mode === '1'} onChange={(e) => setField('ga4_debug_mode', e.target.checked ? '1' : '0')} />
            <span>GA4 Debug Mode <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(shows in DebugView, doesn&apos;t count as real data — turn off once verified)</span></span>
          </label>
          <label>
            Meta (Facebook/Instagram) Pixel ID
            <input style={inputStyle} type="text" placeholder="e.g. 123456789012345" value={values.meta_pixel_id || ''} onChange={(e) => setField('meta_pixel_id', e.target.value)} />
          </label>
          <label>
            Meta Conversions API Access Token
            <input style={inputStyle} type="password" value={values.secret_meta_access_token || ''} onChange={(e) => setField('secret_meta_access_token', e.target.value)} />
          </label>
          <label>
            Meta Test Event Code <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(from Events Manager → Test Events — leave blank once verified)</span>
            <input style={inputStyle} type="text" placeholder="e.g. TEST12345" value={values.meta_test_event_code || ''} onChange={(e) => setField('meta_test_event_code', e.target.value)} />
          </label>
          <label>
            TikTok Pixel ID
            <input style={inputStyle} type="text" value={values.tiktok_pixel_id || ''} onChange={(e) => setField('tiktok_pixel_id', e.target.value)} />
          </label>
          <label>
            TikTok Events API Access Token
            <input style={inputStyle} type="password" value={values.secret_tiktok_access_token || ''} onChange={(e) => setField('secret_tiktok_access_token', e.target.value)} />
          </label>
          <label>
            TikTok Test Event Code <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(from TikTok Events Manager — leave blank once verified)</span>
            <input style={inputStyle} type="text" value={values.tiktok_test_event_code || ''} onChange={(e) => setField('tiktok_test_event_code', e.target.value)} />
          </label>
          <label>
            Microsoft Clarity Project ID
            <input style={inputStyle} type="text" placeholder="e.g. abcd1234ef" value={values.clarity_id || ''} onChange={(e) => setField('clarity_id', e.target.value)} />
          </label>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 0 }}>
          🔒 The two Pixel IDs, Measurement ID, and Clarity ID are visible in the site&apos;s
          public data (this is normal — every site&apos;s pixel ID is visible in its own page
          source). The Access Token/API Secret fields are never exposed publicly — they&apos;re
          only used from the server when sending order events.
        </p>
        <div style={{ marginTop: 16 }}>
          <button type="submit" style={btnPrimary} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
          {saved && <span style={{ marginLeft: 12, color: 'var(--gold)' }}>Saved ✓</span>}
        </div>
      </form>
    </div>
  );
}


/* ---------------- Menu & Pricing (Categories/Products/Options/Add-ons) ---------------- */

function MenuTabs({ token }) {
  const [categories, setCategories] = useState([]);
  const [optionGroups, setOptionGroups] = useState([]);
  const [products, setProducts] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadRefs = () => {
    const headers = { Authorization: `Bearer ${token}` };
    fetch('/api/admin/categories', { headers }).then((r) => r.json()).then((d) => setCategories(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/admin/option_groups', { headers }).then((r) => r.json()).then((d) => setOptionGroups(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/admin/products', { headers }).then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : [])).catch(() => {});
  };

  useEffect(loadRefs, [token, refreshKey]);
  const bump = () => setRefreshKey((k) => k + 1);
  const [tab, setTab] = useState(null); // null = show the landing page of big option cards

  const categoryFields = [
    { key: 'id', label: 'ID (slug)', type: 'text', required: true, placeholder: 'e.g. pizzat' },
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'sub', label: 'Subtitle', type: 'text' },
    { key: 'image', label: 'Image', type: 'image' },
    { key: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
  ];

  const optionGroupFields = [
    { key: 'id', label: 'ID (slug)', type: 'text', required: true, placeholder: 'e.g. base' },
    { key: 'title', label: 'Title', type: 'text', required: true },
    {
      key: 'kind', label: 'Kind', type: 'select', required: true,
      options: [
        { value: 'base', label: 'Base' }, { value: 'sauce', label: 'Sauce' }, { value: 'cheese', label: 'Cheese' },
        { value: 'sauce_stripe', label: 'Sauce stripe' }, { value: 'dip', label: 'Dip' },
        { value: 'topping', label: 'Topping (checkbox list)' }, { value: 'filling', label: 'Filling category' },
      ],
    },
    { key: 'icon', label: 'Icon (emoji, optional)', type: 'text' },
    { key: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
  ];

  const optionFields = [
    { key: 'id', label: 'ID (slug)', type: 'text', required: true, placeholder: 'e.g. base-classic' },
    { key: 'group_id', label: 'Option group', type: 'select', required: true, options: optionGroups.map((g) => ({ value: g.id, label: `${g.title} (${g.id})` })) },
    { key: 'label', label: 'Label', type: 'text', required: true },
    { key: 'price_delta', label: 'Price delta (€)', type: 'number', step: '0.1', default: 0 },
    { key: 'color', label: 'Color (hex, optional)', type: 'text', placeholder: '#c0392b' },
    { key: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
  ];

  const productFields = [
    { key: 'id', label: 'ID (slug)', type: 'text', required: true },
    { key: 'category_id', label: 'Category', type: 'select', required: true, options: categories.map((c) => ({ value: c.id, label: c.title })) },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'price', label: 'Price (€)', type: 'number', step: '0.1', required: true },
    { key: 'offer_price', label: 'Offer price (€, optional)', type: 'number', step: '0.1' },
    { key: 'image', label: 'Image', type: 'image' },
    { key: 'tag', label: 'Tag (optional, e.g. Spicy)', type: 'text' },
    { key: 'has_toppings', label: 'Customizable (pizza-style toppings)', type: 'checkbox' },
    { key: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
    { key: 'active', label: 'Active (visible on site)', type: 'checkbox', default: true },
  ];

  const addonFields = [
    { key: 'id', label: 'ID (slug)', type: 'text', required: true },
    { key: 'type', label: 'Type', type: 'select', required: true, options: [{ value: 'drink', label: 'Drink' }, { value: 'dip', label: 'Dip' }, { value: 'snack', label: 'Snack' }] },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'price', label: 'Price (€)', type: 'number', step: '0.1', required: true },
    { key: 'image', label: 'Image', type: 'image' },
    { key: 'active', label: 'Active', type: 'checkbox', default: true },
    { key: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
  ];

  const TABS = [
    { id: 'products', label: 'Products', icon: '🍕', desc: 'Add, edit, price, and manage every menu item' },
    { id: 'categories', label: 'Categories', icon: '📁', desc: 'Organize the menu into sections like Pizza, Kebab, Burgers' },
    { id: 'options', label: 'Options & Toppings', icon: '🧀', desc: 'Bases, sauces, cheese, toppings, and filling choices' },
    { id: 'addons', label: 'Add-ons', icon: '🥤', desc: 'Drinks, dips, and snacks customers can add to their order' },
    { id: 'bundles', label: 'Bundles', icon: '🎁', desc: 'Combo deals and multi-item meal bundles' },
  ];

  if (!tab) {
    return (
      <div>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>Product Management</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                textAlign: 'left', background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 12,
                padding: 20, cursor: 'pointer', color: 'var(--cream)',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{t.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{t.label}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t.desc}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button type="button" style={{ ...btn, marginBottom: 16 }} onClick={() => setTab(null)}>← Back to Product Management</button>

      {tab === 'categories' && (
        <ResourceManager token={token} table="categories" title="Categories" fields={categoryFields} displayCols={['id', 'title', 'sub', 'sort_order']} onChanged={bump} />
      )}
      {tab === 'products' && (
        <ResourceManager token={token} table="products" title="Products" fields={productFields} displayCols={['id', 'category_id', 'name', 'price', 'active']} onChanged={bump} />
      )}
      {tab === 'options' && (
        <>
          <div style={{ ...box, marginBottom: 16, padding: 16 }}>
            <strong>Option groups</strong> (Base, Sauce, Cheese, Toppings, Fillings…)
          </div>
          <ResourceManager token={token} table="option_groups" title="Option Groups" fields={optionGroupFields} displayCols={['id', 'title', 'kind', 'sort_order']} onChanged={bump} />
          <ResourceManager token={token} table="options" title="Options (individual choices within a group)" fields={optionFields} displayCols={['id', 'group_id', 'label', 'price_delta']} onChanged={bump} />
        </>
      )}
      {tab === 'addons' && (
        <ResourceManager token={token} table="addons" title="Add-ons (drinks, dips, snacks)" fields={addonFields} displayCols={['id', 'type', 'name', 'price', 'active']} onChanged={bump} />
      )}
      {tab === 'bundles' && (
        <BundleManager token={token} categories={categories} products={products} onChanged={bump} />
      )}
    </div>
  );
}

/* ---------------- Root ---------------- */

export default function AdminDashboard() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    const t = sessionStorage.getItem('ozy_admin_token');
    const adminEmail = sessionStorage.getItem('ozy_admin_email');
    if (t) {
      setToken(t);
      setEmail(adminEmail || '');
      setReady(true);
      return;
    }

    // No token in this tab's sessionStorage (e.g. a fresh tab) — but the
    // httpOnly session cookie from login may still be valid. Check
    // before bouncing to the login screen, so a second tab doesn't look
    // logged out when it isn't.
    fetch('/api/admin/me')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        // extractToken() checks the cookie before this header, so the
        // exact value here doesn't matter for auth — it just needs to
        // be non-empty for the admin fetch calls that still attach it.
        setToken('cookie-session');
        setEmail(data.email || '');
        setReady(true);
      })
      .catch(() => {
        window.location.href = '/admin';
      });
  }, []);

  const { data: analytics, loading: analyticsLoading, reload: reloadAnalytics } = useAnalytics(token || null);

  const logout = () => {
    sessionStorage.removeItem('ozy_admin_token');
    sessionStorage.removeItem('ozy_admin_email');
    fetch('/api/admin/logout', { method: 'POST' }).finally(() => {
      window.location.href = '/admin';
    });
  };

  if (!ready) return null;

  const pendingCount = analytics ? analytics.summary.pendingOrders : null;

  const TOP_TABS = [
    { id: 'overview', label: '🏠 Dashboard' },
    { id: 'orders', label: '📦 Orders', badge: pendingCount },
    { id: 'menu', label: '🍕 Menu & Pricing' },
    { id: 'homepage', label: '🖼️ Homepage Display' },
    { id: 'customers', label: '👥 Customers' },
    { id: 'reports', label: '📊 Reports' },
    { id: 'tracking', label: '📈 Tracking & Analytics' },
    { id: 'settings', label: '⚙️ Settings' },
  ];

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', padding: '30px', color: 'var(--cream)', fontFamily: "'Work Sans', sans-serif" }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ margin: 0, color: 'var(--cream)' }}>OZY Admin Dashboard</h1>
            <p style={{ color: 'var(--muted)' }}>{email}</p>
          </div>
          <button onClick={logout} style={btn}>Logout</button>
        </header>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {TOP_TABS.map((t) => (
            <button key={t.id} type="button" style={tabBtn(tab === t.id)} onClick={() => setTab(t.id)}>
              {t.label}
              {!!t.badge && (
                <span
                  style={{
                    marginLeft: 8,
                    background: 'var(--ember)',
                    color: '#1A0D06',
                    borderRadius: 999,
                    padding: '1px 7px',
                    fontSize: 11.5,
                    fontWeight: 800,
                  }}
                >
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <OverviewTab token={token} analytics={analytics} analyticsLoading={analyticsLoading} reloadAnalytics={reloadAnalytics} />
        )}
        {tab === 'orders' && <OrdersTab token={token} />}
        {tab === 'menu' && <MenuTabs token={token} />}
        {tab === 'homepage' && <HomepageDisplaySettings token={token} />}
        {tab === 'customers' && <CustomersTab token={token} />}
        {tab === 'reports' && <ReportsTab analytics={analytics} loading={analyticsLoading} />}
        {tab === 'tracking' && <TrackingAnalyticsSettings token={token} />}
        {tab === 'settings' && <SettingsTab token={token} />}
      </div>
    </main>
  );
}
