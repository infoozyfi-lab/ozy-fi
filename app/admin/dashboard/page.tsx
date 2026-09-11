'use client';

import React, { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ChangeEvent, type MouseEvent } from 'react';
import ResourceManager from '@/components/admin/ResourceManager';
import BundleManager from '@/components/admin/BundleManager';
import OrderKanban from '@/components/admin/OrderKanban';
import MyAccountModal from '@/components/admin/MyAccountModal';
import StatTile from '@/components/admin/charts/StatTile';
import AreaTrendChart from '@/components/admin/charts/AreaTrendChart';
import BarChart from '@/components/admin/charts/BarChart';
import ColumnChart from '@/components/admin/charts/ColumnChart';
import StatusMixBar from '@/components/admin/charts/StatusMixBar';
import StatusPill, { STATUS_LABELS as STATUS_LABELS_LOCAL } from '@/components/admin/charts/StatusPill';
import { CATEGORICAL, BRAND, GOLD, formatCurrency, formatCompactCurrency, formatNumber, percentChange } from '@/components/admin/charts/colors';
import type {
  OrderStatus,
  OrderRow,
  OrderItemRow,
  StaffRole,
  RawCategory,
  RawOptionGroup,
  RawProduct,
  RawSettings,
  ResourceField,
  OpeningHoursDay,
  AuditLogRow,
  CouponRow as CouponRowType,
  StaffRow as StaffRowType,
} from '@/lib/types';

const ORDER_STATUSES: OrderStatus[] = ['received', 'preparing', 'on_the_way', 'delivered', 'cancelled'];
const STATUS_LABELS: Record<OrderStatus, string> = {
  received: 'Received',
  preparing: 'Preparing',
  on_the_way: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const box: CSSProperties = {
  background: 'var(--bg-card)',
  padding: '24px',
  borderRadius: '14px',
  border: '1px solid var(--line)',
  marginBottom: '24px',
  color: 'var(--cream)',
};

const card: CSSProperties = {
  background: 'var(--bg-card)',
  padding: '20px 22px',
  borderRadius: '14px',
  border: '1px solid var(--line)',
  color: 'var(--cream)',
};

const cardTitle: CSSProperties = { margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--cream)' };

const tabBtn = (active: boolean): CSSProperties => ({
  padding: '10px 18px',
  border: '1px solid var(--line)',
  borderBottom: active ? '2px solid var(--ember)' : '1px solid var(--line)',
  borderRadius: '8px 8px 0 0',
  background: active ? 'var(--bg-card)' : 'var(--bg-alt)',
  color: active ? 'var(--cream)' : 'var(--muted)',
  cursor: 'pointer',
  fontWeight: active ? 700 : 400,
});

const inputStyle: CSSProperties = {
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

const btn: CSSProperties = {
  padding: '8px 14px',
  border: '1px solid var(--line)',
  borderRadius: '8px',
  background: 'var(--bg-alt)',
  color: 'var(--cream)',
  cursor: 'pointer',
  fontSize: 13,
  marginRight: 8,
};
const btnPrimary: CSSProperties = { ...btn, background: 'var(--ember)', color: '#1A0D06', border: 'none', fontWeight: 700 };
const btnDanger: CSSProperties = { ...btn, background: '#FF6A5C', color: '#1A0D06', border: 'none', fontWeight: 700 };

const th: CSSProperties = { textAlign: 'left', padding: '10px', color: 'var(--muted)', fontSize: 12.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' };
const td: CSSProperties = { padding: '12px 10px', borderTop: '1px solid var(--line)', fontSize: 13.5 };

/* ---------------- Analytics response shape (GET /api/admin/analytics) ---------------- */
// Page-local: this is the one server-side aggregation pass backing every
// chart & KPI on Overview + Reports, not a raw D1 row — see useAnalytics().

interface AnalyticsPeriod {
  revenue: number;
  orders: number;
}

interface AnalyticsSummary {
  today: AnalyticsPeriod;
  yesterday: AnalyticsPeriod;
  last7Days: AnalyticsPeriod;
  prev7Days: AnalyticsPeriod;
  last30Days: AnalyticsPeriod;
  prev30Days: AnalyticsPeriod;
  pendingOrders: number;
  avgOrderValue: number;
  totalRevenue: number;
  totalOrders: number;
  cancelledOrders: number;
}

interface DailyRevenueRow {
  day: string;
  revenue: number;
  orders: number;
}

interface BestSellerRow {
  name: string;
  qty: number;
  revenue: number;
}

interface CategoryBreakdownRow {
  category: string;
  revenue: number;
  qty: number;
}

interface StatusBreakdownRow {
  status: OrderStatus;
  count: number;
}

interface HourlyRow {
  hour: number;
  count: number;
}

interface AnalyticsData {
  summary: AnalyticsSummary;
  revenueByDay: DailyRevenueRow[];
  bestSellers: BestSellerRow[];
  todayBestSellers?: BestSellerRow[];
  categoryBreakdown: CategoryBreakdownRow[];
  statusBreakdown: StatusBreakdownRow[];
  todayStatusBreakdown?: StatusBreakdownRow[];
  hourlyDistribution: HourlyRow[];
}

/* ---------------- Shared data hooks ---------------- */

function useOrders(token: string) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/orders')
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
function useAnalytics(token: string | null) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    if (!token) return; // not signed in yet — the real fetch fires once the token lands
    setLoading(true);
    setError('');
    fetch('/api/admin/analytics')
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
function fillDailyRevenue(rows: DailyRevenueRow[] | undefined | null, days = 30): DailyRevenueRow[] {
  const byDay: Record<string, DailyRevenueRow> = {};
  (rows || []).forEach((r) => { byDay[r.day] = r; });
  const out: DailyRevenueRow[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push(byDay[key] || { day: key, revenue: 0, orders: 0 });
  }
  return out;
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => `${h}`.padStart(2, '0'));

function fillHourly(rows: HourlyRow[] | undefined | null): { label: string; value: number }[] {
  const byHour: Record<number, number> = {};
  (rows || []).forEach((r) => { byHour[r.hour] = r.count; });
  return HOUR_LABELS.map((label, h) => ({ label, value: byHour[h] || 0 }));
}

/* ---------------- Overview (Dashboard home) ---------------- */

function OverviewTab({
  token,
  analytics,
  analyticsLoading,
  reloadAnalytics,
}: {
  token: string;
  analytics: AnalyticsData | null;
  analyticsLoading: boolean;
  reloadAnalytics: () => void;
}) {
  const { orders, loading: ordersLoading } = useOrders(token);
  const [productCount, setProductCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/admin/products')
      .then((r) => r.json())
      .then((d) => setProductCount(Array.isArray(d) ? d.length : null))
      .catch(() => {});
  }, [token]);

  if (analyticsLoading || !analytics) return <p>Loading dashboard…</p>;

  const { summary, revenueByDay, bestSellers, categoryBreakdown, statusBreakdown, hourlyDistribution } = analytics;

  const revenueTrend = fillDailyRevenue(revenueByDay, 30);
  const last7Sparkline = revenueTrend.slice(-7).map((d) => d.revenue);
  const hourlyData = fillHourly(hourlyDistribution);
  const statusCounts: Partial<Record<OrderStatus, number>> = Object.fromEntries((statusBreakdown || []).map((s) => [s.status, s.count]));

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

// The admin order-detail fetch (/api/admin/orders/:id) returns the order
// row plus its line items — a narrower shape than the full OrderRow (only
// the fields this row actually displays).
interface OrderDetailData {
  customer_name: string;
  phone: string;
  email?: string | null;
  address: string;
  created_at: string;
  payment_method: string;
  notes?: string | null;
  driver_name?: string | null;
  items: OrderItemRow[];
}

function OrderDetailRow({ token, order }: { token: string; order: OrderRow }) {
  const [detail, setDetail] = useState<OrderDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/orders/${order.id}`)
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
              <p style={{ margin: 0, color: detail.email ? undefined : 'var(--muted)' }}>{detail.email || 'No email provided'}</p>
              <p style={{ margin: 0 }}>{detail.address}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px', color: 'var(--muted)', fontSize: 13 }}>Order info</p>
              <p style={{ margin: 0 }}>Placed: {detail.created_at}</p>
              <p style={{ margin: 0 }}>Payment: {detail.payment_method}</p>
              {detail.notes && <p style={{ margin: 0 }}>Notes: {detail.notes}</p>}
              {detail.driver_name && <p style={{ margin: 0 }}>🛵 Driver: {detail.driver_name}</p>}
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

function OrdersTab({ token }: { token: string }) {
  const { orders, setOrders, loading, reload } = useOrders(token);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [view, setView] = useState<'board' | 'list'>('board');

  const changeStatus = async (order: OrderRow, status: OrderStatus) => {
    setUpdatingId(order.id);
    try {
      await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
          <select value={statusFilter} onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value as OrderStatus | 'all')} style={{ ...inputStyle, width: 'auto', marginTop: 0, padding: '8px 10px' }}>
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
                <React.Fragment key={order.id}>
                  <tr>
                    <td style={td}>{order.order_num}</td>
                    <td style={td}>{order.customer_name}</td>
                    <td style={td}>{formatCurrency(order.total)}</td>
                    <td style={td}>
                      <select
                        value={order.status}
                        disabled={updatingId === order.id}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => changeStatus(order, e.target.value as OrderStatus)}
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
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Customers (derived from orders) ---------------- */

// Derived, client-computed shape (grouped/aggregated from OrderRow) — not
// a DB row, and unrelated to lib/types.ts's checkout-flow `Customer`
// shape, so kept as its own page-local interface with a distinct name.
interface CustomerSummary {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  totalOrders: number;
  totalSpent: number;
  lastOrder: string;
}

function CustomersTab({ token }: { token: string }) {
  const { orders, loading } = useOrders(token);

  const customers = useMemo(() => {
    const byEmail: Record<string, CustomerSummary> = {};
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
                  <td style={td}>{c.email || '—'}</td>
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

function ReportsTab({ analytics, loading }: { analytics: AnalyticsData | null; loading: boolean }) {
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

interface SettingsField {
  key: string;
  label: string;
  number?: boolean;
  textarea?: boolean;
}

const SETTINGS_FIELDS: SettingsField[] = [
  { key: 'restaurant_name', label: 'Restaurant name' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Address' },
  { key: 'minimum_order', label: 'Minimum order (€)', number: true },
  { key: 'delivery_fee', label: 'Delivery fee (€)', number: true },
];

// Phase 7.7 — per-day opening hours, replacing the old single free-text
// `opening_hours` field. Same settings key, new value shape: a JSON array
// of 7 {day, open, close, closed} objects instead of a free-text string —
// see this change's summary for why the same key was reused and what
// reads it (nothing did publicly before this — components/Visit.js was
// hardcoded placeholder content; it's now wired to this).
const OPENING_HOURS_DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

function defaultOpeningHours(): OpeningHoursDay[] {
  return OPENING_HOURS_DAYS.map((d) => ({ day: d.key, open: '11:00', close: '22:00', closed: false }));
}

// Returns a valid 7-day array, or null if `raw` is empty/missing, or is
// the OLD free-text value from before this change (plain JSON.parse
// failure — that old value can't be auto-converted into structured
// open/close times, so the admin form falls back to defaults and the
// person re-enters their real hours once, rather than the page crashing
// on an unparseable settings value).
function parseOpeningHours(raw: string | undefined | null): OpeningHoursDay[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === OPENING_HOURS_DAYS.length) return parsed;
  } catch {
    // Old free-text value, or corrupt — treated the same as "unset".
  }
  return null;
}

// Shared by all three settings sections below — each one loads the full
// settings object (cheap: it's one small key/value table) but only ever
// PUTs back the handful of keys it actually owns, so the three sections
// can never clobber each other's data.
function useSettingsValues(token: string) {
  const [values, setValues] = useState<RawSettings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      // r.json() resolves to `unknown` under real @types/node fetch typings;
      // cast to RawSettings (the shape the settings API always returns) so
      // this is assignable to setValues' state type — same fallback-to-{}
      // behavior as before.
      .then((d) => setValues((d as RawSettings) || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return { values, setValues, loading };
}

function SettingsTab({ token }: { token: string }) {
  return <RestaurantInfoSettings token={token} />;
}

/* ---------------- Settings: Restaurant Info ---------------- */

function RestaurantInfoSettings({ token }: { token: string }) {
  const { values, setValues, loading } = useSettingsValues(token);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hours, setHours] = useState<OpeningHoursDay[]>(defaultOpeningHours());
  const [hoursWasFreeText, setHoursWasFreeText] = useState(false);
  const hoursInitialized = useRef(false);

  // Initialize the structured-hours editor once, the first time settings
  // finish loading — not on every `values` change, or typing in any other
  // Restaurant Settings field would keep resetting whatever the person
  // just edited here.
  useEffect(() => {
    if (loading || hoursInitialized.current) return;
    hoursInitialized.current = true;
    const parsed = parseOpeningHours(values.opening_hours);
    if (parsed) {
      setHours(parsed);
    } else {
      setHours(defaultOpeningHours());
      // Distinguish "never set anything" from "there's an old free-text
      // value that couldn't convert" — only the second case needs a note,
      // so the person knows their old hours text didn't just vanish
      // silently, it needs re-entering in the new day-by-day form.
      setHoursWasFreeText(!!values.opening_hours);
    }
  }, [loading, values.opening_hours]);

  const setField = (key: string, val: string) => {
    setValues((v) => ({ ...v, [key]: val }));
    setSaved(false);
  };

  const setDay = (dayKey: string, patch: Partial<OpeningHoursDay>) => {
    setHours((h) => h.map((d) => (d.day === dayKey ? { ...d, ...patch } : d)));
    setSaved(false);
  };

  const isClosed = values.store_closed === '1';

  const toggleStoreClosed = async () => {
    const next = isClosed ? '0' : '1';
    setField('store_closed', next);
    await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_closed: next }),
    });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      SETTINGS_FIELDS.forEach((f) => { body[f.key] = values[f.key] || ''; });
      body.opening_hours = JSON.stringify(hours);
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setHoursWasFreeText(false);
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
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setField(f.key, e.target.value)}
                />
              ) : (
                <input
                  style={inputStyle}
                  type={f.number ? 'number' : 'text'}
                  step={f.number ? '0.1' : undefined}
                  value={values[f.key] || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setField(f.key, e.target.value)}
                />
              )}
            </label>
          ))}
        </div>

        <h3 style={{ margin: '24px 0 4px', fontSize: 15 }}>Opening hours</h3>
        {hoursWasFreeText && (
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#E3A73B' }}>
            Your previous opening-hours text couldn't be converted automatically — filled in with placeholder times below, please set each day correctly and save.
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {OPENING_HOURS_DAYS.map((d) => {
            const row = hours.find((h) => h.day === d.key) || { open: '11:00', close: '22:00', closed: false };
            return (
              <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ width: 96, fontSize: 13.5 }}>{d.label}</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
                  <input
                    type="checkbox"
                    checked={row.closed}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setDay(d.key, { closed: e.target.checked })}
                  />
                  Closed all day
                </label>
                {!row.closed && (
                  <>
                    <input
                      type="time"
                      value={row.open}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setDay(d.key, { open: e.target.value })}
                      style={{ ...inputStyle, width: 'auto', marginTop: 0 }}
                    />
                    <span style={{ color: 'var(--muted)' }}>–</span>
                    <input
                      type="time"
                      value={row.close}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setDay(d.key, { close: e.target.value })}
                      style={{ ...inputStyle, width: 'auto', marginTop: 0 }}
                    />
                  </>
                )}
              </div>
            );
          })}
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

function HomepageDisplaySettings({ token }: { token: string }) {
  const { values, setValues, loading } = useSettingsValues(token);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [products, setProducts] = useState<RawProduct[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    fetch('/api/admin/products')
      .then((r) => r.json())
      .then((d) => setProducts(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [token]);

  const setField = (key: string, val: string) => {
    setValues((v) => ({ ...v, [key]: val }));
    setSaved(false);
  };

  let popularIds: string[] = [];
  try { popularIds = JSON.parse(values.popular_product_ids || '[]'); } catch { popularIds = []; }

  const togglePopular = (id: string) => {
    const has = popularIds.includes(id);
    let next: string[];
    if (has) {
      next = popularIds.filter((p) => p !== id);
    } else {
      if (popularIds.length >= 3) return; // cap at 3 — matches the homepage grid
      next = [...popularIds, id];
    }
    setField('popular_product_ids', JSON.stringify(next));
  };

  const uploadBannerImage = async (file: File) => {
    setUploading(true);
    setUploadError('');
    try {
      const body = new FormData();
      body.append('file', file, file.name || 'upload.jpg');
      const res = await fetch('/api/admin/upload', {
        method: 'POST', body,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; url?: string };
      if (!res.ok) throw new Error(data.error || 'Upload failed.');
      setField('featured_banner_image', data.url || '');
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const save = async (e: FormEvent) => {
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
        headers: { 'Content-Type': 'application/json' },
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
            <select style={inputStyle} value={featuredType} onChange={(e: ChangeEvent<HTMLSelectElement>) => setField('featured_type', e.target.value)}>
              <option value="none">None (hidden)</option>
              <option value="product">Real product</option>
              <option value="banner">Custom banner</option>
            </select>
          </label>

          {featuredType === 'product' && (
            <label>
              Featured product
              <select style={inputStyle} value={values.featured_product_id || ''} onChange={(e: ChangeEvent<HTMLSelectElement>) => setField('featured_product_id', e.target.value)}>
                <option value="">Select…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {formatCurrency(p.price)}</option>)}
              </select>
            </label>
          )}

          {featuredType === 'banner' && (
            <>
              <label>Banner title<input style={inputStyle} value={values.featured_banner_title || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('featured_banner_title', e.target.value)} /></label>
              <label>Banner price text (optional)<input style={inputStyle} value={values.featured_banner_price || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('featured_banner_price', e.target.value)} placeholder="e.g. From €9.90" /></label>
              <label style={{ gridColumn: '1 / -1' }}>
                Banner image
                <input
                  style={inputStyle}
                  value={values.featured_banner_image || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setField('featured_banner_image', e.target.value)}
                  placeholder="Upload below, or paste an image URL"
                />
                <input
                  type="file"
                  accept="image/*"
                  style={{ marginTop: 8, color: 'var(--cream)' }}
                  disabled={uploading}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
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

function TrackingAnalyticsSettings({ token }: { token: string }) {
  const { values, setValues, loading } = useSettingsValues(token);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const setField = (key: string, val: string) => {
    setValues((v) => ({ ...v, [key]: val }));
    setSaved(false);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const keys = [
        'ga4_measurement_id', 'secret_ga4_api_secret', 'ga4_debug_mode',
        'meta_pixel_id', 'secret_meta_access_token', 'meta_test_event_code',
        'tiktok_pixel_id', 'secret_tiktok_access_token', 'tiktok_test_event_code',
        'clarity_id',
      ];
      const body: Record<string, string> = {};
      keys.forEach((k) => { body[k] = values[k] || ''; });
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
            <input style={inputStyle} type="text" placeholder="G-XXXXXXXXXX" value={values.ga4_measurement_id || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('ga4_measurement_id', e.target.value)} />
          </label>
          <label>
            GA4 API Secret
            <input style={inputStyle} type="password" placeholder="For server-side purchase/refund events" value={values.secret_ga4_api_secret || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('secret_ga4_api_secret', e.target.value)} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22 }}>
            <input type="checkbox" checked={values.ga4_debug_mode === '1'} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('ga4_debug_mode', e.target.checked ? '1' : '0')} />
            <span>GA4 Debug Mode <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(shows in DebugView, doesn&apos;t count as real data — turn off once verified)</span></span>
          </label>
          <label>
            Meta (Facebook/Instagram) Pixel ID
            <input style={inputStyle} type="text" placeholder="e.g. 123456789012345" value={values.meta_pixel_id || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('meta_pixel_id', e.target.value)} />
          </label>
          <label>
            Meta Conversions API Access Token
            <input style={inputStyle} type="password" value={values.secret_meta_access_token || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('secret_meta_access_token', e.target.value)} />
          </label>
          <label>
            Meta Test Event Code <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(from Events Manager → Test Events — leave blank once verified)</span>
            <input style={inputStyle} type="text" placeholder="e.g. TEST12345" value={values.meta_test_event_code || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('meta_test_event_code', e.target.value)} />
          </label>
          <label>
            TikTok Pixel ID
            <input style={inputStyle} type="text" value={values.tiktok_pixel_id || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('tiktok_pixel_id', e.target.value)} />
          </label>
          <label>
            TikTok Events API Access Token
            <input style={inputStyle} type="password" value={values.secret_tiktok_access_token || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('secret_tiktok_access_token', e.target.value)} />
          </label>
          <label>
            TikTok Test Event Code <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(from TikTok Events Manager — leave blank once verified)</span>
            <input style={inputStyle} type="text" value={values.tiktok_test_event_code || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('tiktok_test_event_code', e.target.value)} />
          </label>
          <label>
            Microsoft Clarity Project ID
            <input style={inputStyle} type="text" placeholder="e.g. abcd1234ef" value={values.clarity_id || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('clarity_id', e.target.value)} />
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

/* ---------------- Options & Toppings — grouped landing page ---------------- */
// Previously this screen just stacked two flat tables (all option groups,
// then every single option from every group mixed together in one long
// list) — confusing once there were more than a couple of groups, since
// Base/Sauce/Cheese/Topping/Dip choices all ran together. This groups
// them the same way Product Management does: pick a group first (as a
// card), then see only that group's choices.
// Maps each option group's `kind` to the exact heading text a customer
// actually sees on the product customization page (components/
// ProductPage.js) — so the admin card for, say, the "toppings" group
// shows the same "Finish — tap to add toppings" wording the customer
// sees, instead of only the internal group name. Base/Sauce/Cheese
// don't have their own on-page heading (they show as a collapsed row
// that just displays whichever choice is currently selected), so those
// three get a short plain description instead of a quoted heading.
const GROUP_KIND_CUSTOMER_VIEW: Record<string, string> = {
  base: 'Shown on the site as: a "Bottom" row — tap to change the crust',
  sauce: 'Shown on the site as: a "Sauce" row — tap to change the sauce',
  cheese: 'Shown on the site as: a "Cheese" row — tap to change the cheese',
  sauce_stripe: 'Shown on the site as: "Finish with sauce stripes"',
  dip: 'Shown on the site as: "Dip the edges"',
  topping: 'Shown on the site as: "Finish — tap to add toppings"',
  filling: 'Shown on the site as: "Fillings"',
};

// A pricing rule that applies across products (not tied to any one
// category/product/option), so it lives here on the Product Management
// landing page — the more natural home for "a rule that affects
// pricing" than Settings, which is otherwise just restaurant contact
// info. Was originally added under Settings; moved here per the
// business owner's feedback.
function PricingRulesBox({ token }: { token: string }) {
  const { values, setValues, loading } = useSettingsValues(token);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size_large_upcharge: values.size_large_upcharge || '' }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div style={{ ...box, marginBottom: 20, padding: 16 }}>
      <h3 style={{ marginTop: 0, marginBottom: 4 }}>Pricing rules</h3>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
        Rules that apply across every product, rather than one product at a time.
      </p>
      <form onSubmit={save} style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ minWidth: 240 }}>
          Large size upcharge (€) — added to any pizza when a customer picks Large instead of Medium
          <input
            style={inputStyle}
            type="number" step="0.1"
            value={values.size_large_upcharge || ''}
            onChange={(e: ChangeEvent<HTMLInputElement>) => { setValues((v) => ({ ...v, size_large_upcharge: e.target.value })); setSaved(false); }}
          />
        </label>
        <button type="submit" style={btnPrimary} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        {saved && <span style={{ color: 'var(--gold)' }}>Saved ✓</span>}
      </form>
    </div>
  );
}

function OptionsManager({
  optionGroupFields,
  optionFields,
  onChanged,
}: {
  optionGroupFields: ResourceField[];
  optionFields: ResourceField[];
  onChanged?: () => void;
}) {
  const [groups, setGroups] = useState<RawOptionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<RawOptionGroup | null>(null); // null = show the group picker

  const loadGroups = () => {
    setLoading(true);
    setError('');
    fetch('/api/admin/option_groups')
      .then((res) => res.json())
      .then((data) => setGroups(Array.isArray(data) ? data : []))
      .catch(() => setError('Could not load option groups.'))
      .finally(() => setLoading(false));
  };

  useEffect(loadGroups, []);

  // Bump both this screen's own group list (in case a group was renamed/
  // added/removed) and the parent Menu & Pricing screen's shared reload
  // trigger (other tabs, like Products, also read option groups).
  const handleChanged = () => {
    loadGroups();
    if (onChanged) onChanged();
  };

  if (selectedGroup) {
    return (
      <div>
        <button type="button" style={{ ...btn, marginBottom: 16 }} onClick={() => setSelectedGroup(null)}>
          ← Back to Options & Toppings
        </button>
        <ResourceManager
          table="options"
          title={`${selectedGroup.title} — choices`}
          fields={optionFields}
          displayCols={['id', 'label', 'label_fi', 'price_delta']}
          onChanged={handleChanged}
          parentFilter={{ field: 'group_id', value: selectedGroup.id }}
        />
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: 4 }}>Options & Toppings</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 0, marginBottom: 16 }}>
        Pick a group below to see and edit just its choices (e.g. only the toppings, not the sauces mixed in too).
      </p>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: '#FF8A75' }}>{error}</p>}

      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 28 }}>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedGroup(g)}
              style={{
                textAlign: 'left', background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 12,
                padding: 16, cursor: 'pointer', color: 'var(--cream)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{g.title}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {GROUP_KIND_CUSTOMER_VIEW[g.kind] || g.kind}
              </div>
            </button>
          ))}
          {groups.length === 0 && <p style={{ color: 'var(--muted)' }}>No option groups yet — add one below.</p>}
        </div>
      )}

      <h3 style={{ marginBottom: 8 }}>Option groups</h3>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
        The categories themselves (Base, Sauce, Cheese, Toppings, Fillings…) — add or rename a group here, then click its card above to manage its individual choices.
      </p>
      <ResourceManager
        table="option_groups"
        title="Option Groups"
        fields={optionGroupFields}
        displayCols={['id', 'title', 'kind', 'sort_order']}
        onChanged={handleChanged}
      />
    </div>
  );
}


function MenuTabs({ token }: { token: string }) {
  const [categories, setCategories] = useState<RawCategory[]>([]);
  const [optionGroups, setOptionGroups] = useState<RawOptionGroup[]>([]);
  const [products, setProducts] = useState<RawProduct[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadRefs = () => {
    fetch('/api/admin/categories').then((r) => r.json()).then((d) => setCategories(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/admin/option_groups').then((r) => r.json()).then((d) => setOptionGroups(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/admin/products').then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : [])).catch(() => {});
  };

  useEffect(loadRefs, [token, refreshKey]);
  const bump = () => setRefreshKey((k) => k + 1);
  const [tab, setTab] = useState<string | null>(null); // null = show the landing page of big option cards

  // Phase: bilingual site — every `_fi` field below is optional; the
  // storefront falls back to the English/default field next to it when
  // empty (see lib/menu-i18n.js). Placed directly after its English
  // counterpart in each list so the two are easy to compare while editing.
  const categoryFields: ResourceField[] = [
    { key: 'id', label: 'ID (slug)', type: 'text', required: true, placeholder: 'e.g. pizzat' },
    { key: 'title', label: 'Title (English)', type: 'text', required: true },
    { key: 'title_fi', label: 'Title (Finnish, optional)', type: 'text' },
    { key: 'sub', label: 'Subtitle (English)', type: 'text' },
    { key: 'sub_fi', label: 'Subtitle (Finnish, optional)', type: 'text' },
    { key: 'image', label: 'Image', type: 'image' },
    { key: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
  ];

  const optionGroupFields: ResourceField[] = [
    { key: 'id', label: 'ID (slug)', type: 'text', required: true, placeholder: 'e.g. base' },
    { key: 'title', label: 'Title (English)', type: 'text', required: true },
    { key: 'title_fi', label: 'Title (Finnish, optional)', type: 'text' },
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

  const optionFields: ResourceField[] = [
    { key: 'id', label: 'ID (slug)', type: 'text', required: true, placeholder: 'e.g. base-classic' },
    { key: 'group_id', label: 'Option group', type: 'select', required: true, options: optionGroups.map((g) => ({ value: g.id, label: `${g.title} (${g.id})` })) },
    { key: 'label', label: 'Label (English)', type: 'text', required: true },
    { key: 'label_fi', label: 'Label (Finnish, optional)', type: 'text' },
    { key: 'price_delta', label: 'Price delta (€)', type: 'number', step: '0.1', default: 0 },
    { key: 'color', label: 'Color (hex, optional)', type: 'text', placeholder: '#c0392b' },
    { key: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
  ];

  const productFields: ResourceField[] = [
    { key: 'id', label: 'ID (slug)', type: 'text', required: true },
    { key: 'category_id', label: 'Category', type: 'select', required: true, options: categories.map((c) => ({ value: c.id, label: c.title })) },
    { key: 'name', label: 'Name (English)', type: 'text', required: true },
    { key: 'name_fi', label: 'Name (Finnish, optional)', type: 'text' },
    { key: 'description', label: 'Description (English)', type: 'textarea' },
    { key: 'description_fi', label: 'Description (Finnish, optional)', type: 'textarea' },
    { key: 'price', label: 'Price (€)', type: 'number', step: '0.1', required: true },
    { key: 'offer_price', label: 'Offer price (€, optional)', type: 'number', step: '0.1' },
    { key: 'image', label: 'Image', type: 'image' },
    { key: 'tag', label: 'Tag (optional, e.g. Spicy)', type: 'text' },
    { key: 'has_toppings', label: 'Customizable (pizza-style toppings)', type: 'checkbox' },
    { key: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
    { key: 'active', label: 'Active (visible on site)', type: 'checkbox', default: true },
  ];

  const addonFields: ResourceField[] = [
    { key: 'id', label: 'ID (slug)', type: 'text', required: true },
    { key: 'type', label: 'Type', type: 'select', required: true, options: [{ value: 'drink', label: 'Drink' }, { value: 'dip', label: 'Dip' }, { value: 'snack', label: 'Snack' }] },
    { key: 'name', label: 'Name (English)', type: 'text', required: true },
    { key: 'name_fi', label: 'Name (Finnish, optional)', type: 'text' },
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
        <PricingRulesBox token={token} />
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
        <ResourceManager table="categories" title="Categories" fields={categoryFields} displayCols={['id', 'title', 'sub', 'sort_order']} onChanged={bump} />
      )}
      {tab === 'products' && (
        <ResourceManager table="products" title="Products" fields={productFields} displayCols={['id', 'category_id', 'name', 'price', 'active']} onChanged={bump} />
      )}
      {tab === 'options' && (
        <OptionsManager optionGroupFields={optionGroupFields} optionFields={optionFields} onChanged={bump} />
      )}
      {tab === 'addons' && (
        <ResourceManager table="addons" title="Add-ons (drinks, dips, snacks)" fields={addonFields} displayCols={['id', 'type', 'name', 'price', 'active']} onChanged={bump} />
      )}
      {tab === 'bundles' && (
        <BundleManager token={token} categories={categories} products={products} onChanged={bump} />
      )}
    </div>
  );
}

/* ---------------- Staff Management (Owner-only) ---------------- */

const ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'manager', label: 'Manager' },
  { value: 'owner', label: 'Owner' },
];

function useStaffList(token: string) {
  const [staff, setStaff] = useState<StaffRowType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    if (!token) return;
    setLoading(true);
    setError('');
    fetch('/api/admin/staff')
      .then((res) => {
        if (!res.ok) throw new Error('Could not load staff.');
        return res.json();
      })
      .then((data) => setStaff(Array.isArray(data) ? data : []))
      .catch(() => setError('Could not load staff.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  return { staff, loading, error, reload: load };
}

function AddStaffForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole>('kitchen');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setName(''); setEmail(''); setPassword(''); setRole('kitchen'); setError('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not create staff account.');
      reset();
      setOpen(false);
      onAdded();
    } catch (err: any) {
      setError(err.message || 'Could not create staff account.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return <button type="button" style={btnPrimary} onClick={() => setOpen(true)}>+ Add staff account</button>;
  }

  return (
    <form onSubmit={submit} style={{ ...card, marginBottom: 20 }}>
      <h3 style={cardTitle}>New staff account</h3>
      {error && <p style={{ color: '#FF8A75', marginTop: 0 }}>{error}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <label>Name<input style={inputStyle} value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} required /></label>
        <label>Email<input style={inputStyle} type="email" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} required /></label>
        <label>Temporary password<input style={inputStyle} type="text" value={password} onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} minLength={8} required /></label>
        <label>
          Role
          <select style={inputStyle} value={role} onChange={(e: ChangeEvent<HTMLSelectElement>) => setRole(e.target.value as StaffRole)}>
            {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>
        Give this password to the staff member directly — there's no email-invite flow yet, so share it out of band (in person, a call, etc.), not over an insecure channel.
      </p>
      <div style={{ marginTop: 8 }}>
        <button type="submit" style={btnPrimary} disabled={saving}>{saving ? 'Creating…' : 'Create account'}</button>
        <button type="button" style={btn} onClick={() => { reset(); setOpen(false); }}>Cancel</button>
      </div>
    </form>
  );
}

// Body shape sent to PATCH /api/admin/staff/:id — only ever one of these
// fields at a time in this file, but modeled as one loose optional-field
// shape (matching the API route's own partial-patch handling) rather than
// three separate patch functions.
interface StaffPatchBody {
  role?: StaffRole;
  active?: number;
  disable2fa?: boolean;
}

function StaffRow({ member, onChanged }: { member: StaffRowType; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const patch = async (body: StaffPatchBody) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/staff/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Update failed.');
      onChanged();
    } catch (err: any) {
      setError(err.message || 'Update failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr>
      <td style={td}>{member.name}</td>
      <td style={td}>{member.email}</td>
      <td style={td}>
        <select
          style={{ ...inputStyle, marginTop: 0, width: 'auto' }}
          value={member.role}
          disabled={busy}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => patch({ role: e.target.value as StaffRole })}
        >
          {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </td>
      <td style={td}>{member.active ? '🟢 Active' : '⚪ Inactive'}</td>
      <td style={td}>
        {member.totp_enabled ? (
          <button
            type="button"
            style={{ ...btn, fontSize: 12, padding: '5px 10px' }}
            disabled={busy}
            onClick={() => {
              // Phase 7.9 lockout recovery — see this feature's summary
              // for why this exists: without it, a staff member who
              // loses their authenticator device has no way back in.
              if (window.confirm(`Force-disable 2FA on ${member.name}'s account? They'll be able to log in with just their password again.`)) {
                patch({ disable2fa: true });
              }
            }}
          >
            🔒 On — force off
          </button>
        ) : '—'}
      </td>
      <td style={td}>
        <button
          type="button"
          style={member.active ? btnDanger : btnPrimary}
          disabled={busy}
          onClick={() => patch({ active: member.active ? 0 : 1 })}
        >
          {member.active ? 'Deactivate' : 'Reactivate'}
        </button>
        {error && <div style={{ color: '#FF8A75', fontSize: 12, marginTop: 4 }}>{error}</div>}
      </td>
    </tr>
  );
}

function StaffManagementTab({ token }: { token: string }) {
  const { staff, loading, error, reload } = useStaffList(token);

  return (
    <div style={box}>
      <h2 style={{ marginTop: 0 }}>Staff</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>
        Kitchen role: Orders board only. Manager: Orders, Menu &amp; Pricing, Homepage Display, Customers, Reports.
        Owner: everything, including this page. There's always at least one Owner account — the last one can't be deactivated or demoted.
      </p>
      <div style={{ marginBottom: 20 }}>
        <AddStaffForm onAdded={reload} />
      </div>
      {loading ? <p>Loading…</p> : error ? <p style={{ color: '#FF8A75' }}>{error}</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Email</th>
                <th style={th}>Role</th>
                <th style={th}>Status</th>
                <th style={th}>2FA</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((m) => <StaffRow key={m.id} member={m} onChanged={reload} />)}
              {!staff.length && (
                <tr><td style={td} colSpan={6}>No staff accounts yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Activity Log (Owner-only) ---------------- */

function ActivityLogTab({ token }: { token: string }) {
  const [entries, setEntries] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError('');
    fetch('/api/admin/activity')
      .then((res) => {
        if (!res.ok) throw new Error('Could not load activity.');
        return res.json();
      })
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .catch(() => setError('Could not load activity.'))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div style={box}>
      <h2 style={{ marginTop: 0 }}>Activity Log</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>
        Recent order status changes, menu/price edits, settings changes and staff account changes, most recent first.
      </p>
      {loading ? <p>Loading…</p> : error ? <p style={{ color: '#FF8A75' }}>{error}</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>When</th>
                <th style={th}>Who</th>
                <th style={th}>Action</th>
                <th style={th}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td style={td}>{new Date(`${e.created_at}Z`).toLocaleString()}</td>
                  <td style={td}>{e.staff_name}</td>
                  <td style={td}>{e.action}</td>
                  <td style={td}>{e.detail}</td>
                </tr>
              ))}
              {!entries.length && (
                <tr><td style={td} colSpan={4}>Nothing logged yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Coupons (Phase 7.6, Manager+Owner) ---------------- */

function useCoupons(token: string) {
  const [coupons, setCoupons] = useState<CouponRowType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    if (!token) return;
    setLoading(true);
    setError('');
    fetch('/api/admin/coupons')
      .then((res) => {
        if (!res.ok) throw new Error('Could not load coupons.');
        return res.json();
      })
      .then((data) => setCoupons(Array.isArray(data) ? data : []))
      .catch(() => setError('Could not load coupons.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  return { coupons, loading, error, reload: load };
}

function AddCouponForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setCode(''); setDiscountType('percent'); setDiscountValue('');
    setExpiresAt(''); setMinOrderAmount(''); setUsageLimit(''); setError('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          discount_type: discountType,
          discount_value: Number(discountValue),
          expires_at: expiresAt || null,
          min_order_amount: minOrderAmount === '' ? null : Number(minOrderAmount),
          usage_limit: usageLimit === '' ? null : Number(usageLimit),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not create coupon.');
      reset();
      setOpen(false);
      onAdded();
    } catch (err: any) {
      setError(err.message || 'Could not create coupon.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return <button type="button" style={btnPrimary} onClick={() => setOpen(true)}>+ New coupon</button>;
  }

  return (
    <form onSubmit={submit} style={{ ...card, marginBottom: 20 }}>
      <h3 style={cardTitle}>New coupon</h3>
      {error && <p style={{ color: '#FF8A75', marginTop: 0 }}>{error}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <label>
          Code
          <input style={inputStyle} value={code} onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value.toUpperCase())} placeholder="SAVE10" required />
        </label>
        <label>
          Type
          <select style={inputStyle} value={discountType} onChange={(e: ChangeEvent<HTMLSelectElement>) => setDiscountType(e.target.value as 'percent' | 'amount')}>
            <option value="percent">Percent off</option>
            <option value="amount">Amount off (€)</option>
          </select>
        </label>
        <label>
          Value {discountType === 'percent' ? '(%)' : '(€)'}
          <input style={inputStyle} type="number" min="0.01" step="0.01" value={discountValue} onChange={(e: ChangeEvent<HTMLInputElement>) => setDiscountValue(e.target.value)} required />
        </label>
        <label>
          Expires (optional)
          <input style={inputStyle} type="date" value={expiresAt} onChange={(e: ChangeEvent<HTMLInputElement>) => setExpiresAt(e.target.value)} />
        </label>
        <label>
          Minimum order € (optional)
          <input style={inputStyle} type="number" min="0" step="0.01" value={minOrderAmount} onChange={(e: ChangeEvent<HTMLInputElement>) => setMinOrderAmount(e.target.value)} />
        </label>
        <label>
          Usage limit (optional)
          <input style={inputStyle} type="number" min="1" step="1" value={usageLimit} onChange={(e: ChangeEvent<HTMLInputElement>) => setUsageLimit(e.target.value)} placeholder="Unlimited" />
        </label>
      </div>
      <div style={{ marginTop: 8 }}>
        <button type="submit" style={btnPrimary} disabled={saving}>{saving ? 'Creating…' : 'Create coupon'}</button>
        <button type="button" style={btn} onClick={() => { reset(); setOpen(false); }}>Cancel</button>
      </div>
    </form>
  );
}

function CouponRow({ coupon, onChanged }: { coupon: CouponRowType; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggleActive = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/coupons/${coupon.code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: coupon.active ? 0 : 1 }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Update failed.');
      onChanged();
    } catch (err: any) {
      setError(err.message || 'Update failed.');
    } finally {
      setBusy(false);
    }
  };

  const valueLabel = coupon.discount_type === 'percent' ? `${coupon.discount_value}%` : `${Number(coupon.discount_value).toFixed(2)} €`;
  const usageLabel = coupon.usage_limit != null ? `${coupon.times_used} / ${coupon.usage_limit}` : `${coupon.times_used}`;
  const expiredAlready = coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now() - 24 * 60 * 60 * 1000;

  return (
    <tr>
      <td style={td}><strong>{coupon.code}</strong></td>
      <td style={td}>{valueLabel}</td>
      <td style={td}>{coupon.min_order_amount != null ? `${Number(coupon.min_order_amount).toFixed(2)} €` : '—'}</td>
      <td style={td}>{usageLabel}</td>
      <td style={td}>{coupon.expires_at || '—'}{expiredAlready ? ' (expired)' : ''}</td>
      <td style={td}>{coupon.active ? '🟢 Active' : '⚪ Inactive'}</td>
      <td style={td}>
        <button
          type="button"
          style={coupon.active ? btnDanger : btnPrimary}
          disabled={busy}
          onClick={toggleActive}
        >
          {coupon.active ? 'Deactivate' : 'Reactivate'}
        </button>
        {error && <div style={{ color: '#FF8A75', fontSize: 12, marginTop: 4 }}>{error}</div>}
      </td>
    </tr>
  );
}

function CouponsTab({ token }: { token: string }) {
  const { coupons, loading, error, reload } = useCoupons(token);

  return (
    <div style={box}>
      <h2 style={{ marginTop: 0 }}>Coupons</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>
        Customers enter a code at checkout — every code is re-checked (validity, expiry, minimum order, usage limit)
        and the discount recalculated on our server when the order is actually placed, never trusted from the browser.
      </p>
      <div style={{ marginBottom: 20 }}>
        <AddCouponForm onAdded={reload} />
      </div>
      {loading ? <p>Loading…</p> : error ? <p style={{ color: '#FF8A75' }}>{error}</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Code</th>
                <th style={th}>Discount</th>
                <th style={th}>Min. order</th>
                <th style={th}>Used</th>
                <th style={th}>Expires</th>
                <th style={th}>Status</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => <CouponRow key={c.code} coupon={c} onChanged={reload} />)}
              {!coupons.length && (
                <tr><td style={td} colSpan={7}>No coupons yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Root ---------------- */

// Which top-level tabs each role can see — mirrors the requireRole()
// checks the underlying APIs already enforce (lib/adminAuth.js and each
// app/api/admin/**/route.js), so a role never sees a tab whose API call
// would 403 anyway. This list is the UX nicety on top of that real
// enforcement, not a substitute for it.
const ROLE_TABS: Record<StaffRole, string[]> = {
  kitchen: ['orders'],
  manager: ['overview', 'orders', 'menu', 'coupons', 'homepage', 'customers', 'reports'],
  owner: ['overview', 'orders', 'menu', 'coupons', 'homepage', 'customers', 'reports', 'tracking', 'settings', 'staff', 'activity'],
};

export default function AdminDashboard() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole | null>(null);
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<string | null>(null); // set once we know the role — see checkSession below
  const [showMyAccount, setShowMyAccount] = useState(false); // Phase 7.9 — visible to every role

  // See app/admin/page.js for the matching check on the login page, and
  // why it's written to always resolve `ready` one way or another instead
  // of ever leaving this page stuck blank.
  //
  // Phase 5b: cookie-only, no sessionStorage fast path anymore — every
  // load asks /api/admin/me. `token` here is kept as a plain "are we
  // authenticated" flag (not a real secret — there is no token string
  // available to client JS at all now) purely so the many child
  // components below that gate on `if (!token) return` / depend on it in
  // a `useEffect([token])` keep working unchanged; none of them send it
  // anywhere anymore (the `Authorization` headers were removed before
  // staff roles existed — auth now travels solely via the httpOnly
  // cookie, sent automatically on every same-origin fetch()).
  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const res = await fetch('/api/admin/me');
        // res.json() resolves to `unknown` under real fetch typings — cast
        // to the small shape this endpoint actually returns.
        const data = (await res.json().catch(() => ({ authenticated: false }))) as {
          authenticated?: boolean;
          email?: string;
          name?: string;
          role?: StaffRole;
        };
        if (cancelled) return;
        if (data.authenticated) {
          setToken('cookie-session');
          setEmail(data.email || '');
          setName(data.name || '');
          setRole(data.role || null);
          // Kitchen never sees the Overview/Dashboard tab — land them
          // straight on the one tab they do have (Orders) instead of a
          // tab list that would render empty for a beat.
          setTab((ROLE_TABS[data.role as StaffRole] || []).includes('overview') ? 'overview' : (ROLE_TABS[data.role as StaffRole] || ['orders'])[0]);
          setReady(true);
        } else {
          window.location.href = '/admin';
        }
      } catch {
        // Couldn't verify the session — send them back to login rather
        // than leaving the dashboard hanging on nothing.
        if (!cancelled) window.location.href = '/admin';
      }
    }

    checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  // Kitchen's role has no access to GET /api/admin/analytics (403) — skip
  // the request entirely rather than firing it and discarding the error,
  // same as the pre-signed-in case this hook already handles via `token`.
  const canSeeAnalytics = role === 'manager' || role === 'owner';
  const { data: analytics, loading: analyticsLoading, reload: reloadAnalytics } = useAnalytics(canSeeAnalytics ? token || null : null);

  const logout = () => {
    // Clears the httpOnly cookie server-side — client JS has no way to
    // read or delete it directly, and there's nothing left in
    // sessionStorage to clean up on this end (phase 5b: cookie is the
    // only session state). Fire-and-redirect: even if this request fails
    // outright, the cookie still expires on its own (24h) — worst case is
    // a stale device staying signed in a little longer, not this tab
    // failing to leave.
    fetch('/api/admin/logout', { method: 'POST' }).finally(() => {
      window.location.href = '/admin';
    });
  };

  if (!ready || !tab) return null;

  const pendingCount = analytics ? analytics.summary.pendingOrders : null;

  const ALL_TABS = [
    { id: 'overview', label: '🏠 Dashboard' },
    { id: 'orders', label: '📦 Orders', badge: pendingCount },
    { id: 'menu', label: '🍕 Menu & Pricing' },
    { id: 'coupons', label: '🏷️ Coupons' },
    { id: 'homepage', label: '🖼️ Homepage Display' },
    { id: 'customers', label: '👥 Customers' },
    { id: 'reports', label: '📊 Reports' },
    { id: 'tracking', label: '📈 Tracking & Analytics' },
    { id: 'settings', label: '⚙️ Settings' },
    { id: 'staff', label: '🧑‍🍳 Staff' },
    { id: 'activity', label: '📝 Activity Log' },
  ];
  // The real enforcement is server-side (requireRole in every
  // app/api/admin/**/route.js) — this filter just keeps a role from
  // seeing a tab whose API calls would 403 anyway. Falls back to showing
  // nothing extra for an unrecognized role rather than guessing broad.
  const TOP_TABS = ALL_TABS.filter((t) => (role ? ROLE_TABS[role] : []).includes(t.id));

  const ROLE_LABEL: Record<StaffRole, string> = { kitchen: 'Kitchen', manager: 'Manager', owner: 'Owner' };

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', padding: '30px', color: 'var(--cream)', fontFamily: "'Work Sans', sans-serif" }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ margin: 0, color: 'var(--cream)' }}>OZY Admin Dashboard</h1>
            <p style={{ color: 'var(--muted)' }}>
              {name || email}
              {role && <span style={{ marginLeft: 8, opacity: 0.7 }}>· {ROLE_LABEL[role] || role}</span>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowMyAccount(true)} style={btn}>My Account</button>
            <button onClick={logout} style={btn}>Logout</button>
          </div>
        </header>

        {showMyAccount && <MyAccountModal onClose={() => setShowMyAccount(false)} />}

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
        {tab === 'coupons' && <CouponsTab token={token} />}
        {tab === 'homepage' && <HomepageDisplaySettings token={token} />}
        {tab === 'customers' && <CustomersTab token={token} />}
        {tab === 'reports' && <ReportsTab analytics={analytics} loading={analyticsLoading} />}
        {tab === 'tracking' && <TrackingAnalyticsSettings token={token} />}
        {tab === 'settings' && <SettingsTab token={token} />}
        {tab === 'staff' && <StaffManagementTab token={token} />}
        {tab === 'activity' && <ActivityLogTab token={token} />}
      </div>
    </main>
  );
}
