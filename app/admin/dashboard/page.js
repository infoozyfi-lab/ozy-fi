'use client';

import { useEffect, useMemo, useState, Fragment } from 'react';
import ResourceManager from '@/components/admin/ResourceManager';

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
  borderRadius: '12px',
  border: '1px solid var(--line)',
  marginBottom: '24px',
  color: 'var(--cream)',
};

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

function statCard(label, value) {
  return (
    <div style={box}>
      <h3 style={{ marginTop: 0, color: 'var(--muted)', fontSize: 14 }}>{label}</h3>
      <strong style={{ fontSize: '30px' }}>{value}</strong>
    </div>
  );
}

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

/* ---------------- Overview ---------------- */

function OverviewTab({ token }) {
  const { orders, loading } = useOrders(token);
  const [productCount, setProductCount] = useState(null);

  useEffect(() => {
    fetch('/api/admin/products', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setProductCount(Array.isArray(d) ? d.length : null))
      .catch(() => {});
  }, [token]);

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todaysOrders = orders.filter((o) => (o.created_at || '').slice(0, 10) === todayStr);
    const todaysSales = todaysOrders.reduce((s, o) => s + Number(o.total || 0), 0);
    const pending = orders.filter((o) => o.status === 'received' || o.status === 'preparing' || o.status === 'on_the_way').length;
    const completed = orders.filter((o) => o.status === 'delivered').length;
    return { todaysOrders: todaysOrders.length, todaysSales, pending, completed };
  }, [orders]);

  if (loading) return <p>Loading…</p>;

  return (
    <>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 8 }}>
        {statCard("Today's Orders", stats.todaysOrders)}
        {statCard("Today's Sales", `€${stats.todaysSales.toFixed(2)}`)}
        {statCard('Pending Orders', stats.pending)}
        {statCard('Completed Orders', stats.completed)}
        {statCard('Total Products', productCount === null ? '…' : productCount)}
      </section>

      <div style={box}>
        <h2 style={{ marginTop: 0 }}>Recent Orders</h2>
        {orders.length === 0 ? (
          <p>No orders yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 10, color: 'var(--muted)' }}>Order</th>
                  <th style={{ textAlign: 'left', padding: 10, color: 'var(--muted)' }}>Customer</th>
                  <th style={{ textAlign: 'left', padding: 10, color: 'var(--muted)' }}>Total</th>
                  <th style={{ textAlign: 'left', padding: 10, color: 'var(--muted)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 8).map((o) => (
                  <tr key={o.id}>
                    <td style={{ padding: 10, borderTop: '1px solid var(--line)' }}>{o.order_num}</td>
                    <td style={{ padding: 10, borderTop: '1px solid var(--line)' }}>{o.customer_name}</td>
                    <td style={{ padding: 10, borderTop: '1px solid var(--line)' }}>€{Number(o.total || 0).toFixed(2)}</td>
                    <td style={{ padding: 10, borderTop: '1px solid var(--line)' }}>{STATUS_LABELS[o.status] || o.status}</td>
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
                  <strong>{item.qty}× {item.name}</strong> — €{Number(item.line_total).toFixed(2)}
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

  return (
    <div style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Orders</h2>
        <button type="button" style={btn} onClick={reload}>Refresh</button>
      </div>
      {loading ? (
        <p>Loading orders...</p>
      ) : orders.length === 0 ? (
        <p>No orders yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 10, color: 'var(--muted)' }}>Order</th>
                <th style={{ textAlign: 'left', padding: 10, color: 'var(--muted)' }}>Customer</th>
                <th style={{ textAlign: 'left', padding: 10, color: 'var(--muted)' }}>Total</th>
                <th style={{ textAlign: 'left', padding: 10, color: 'var(--muted)' }}>Status</th>
                <th style={{ textAlign: 'left', padding: 10, color: 'var(--muted)' }}></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <Fragment key={order.id}>
                  <tr>
                    <td style={{ padding: 10, borderTop: '1px solid var(--line)' }}>{order.order_num}</td>
                    <td style={{ padding: 10, borderTop: '1px solid var(--line)' }}>{order.customer_name}</td>
                    <td style={{ padding: 10, borderTop: '1px solid var(--line)' }}>€{Number(order.total || 0).toFixed(2)}</td>
                    <td style={{ padding: 10, borderTop: '1px solid var(--line)' }}>
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
                    <td style={{ padding: 10, borderTop: '1px solid var(--line)' }}>
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
                <th style={{ textAlign: 'left', padding: 10, color: 'var(--muted)' }}>Name</th>
                <th style={{ textAlign: 'left', padding: 10, color: 'var(--muted)' }}>Phone</th>
                <th style={{ textAlign: 'left', padding: 10, color: 'var(--muted)' }}>Email</th>
                <th style={{ textAlign: 'left', padding: 10, color: 'var(--muted)' }}>Orders</th>
                <th style={{ textAlign: 'left', padding: 10, color: 'var(--muted)' }}>Total spent</th>
                <th style={{ textAlign: 'left', padding: 10, color: 'var(--muted)' }}>Last order</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => (
                <tr key={i}>
                  <td style={{ padding: 10, borderTop: '1px solid var(--line)' }}>{c.name}</td>
                  <td style={{ padding: 10, borderTop: '1px solid var(--line)' }}>{c.phone}</td>
                  <td style={{ padding: 10, borderTop: '1px solid var(--line)' }}>{c.email}</td>
                  <td style={{ padding: 10, borderTop: '1px solid var(--line)' }}>{c.totalOrders}</td>
                  <td style={{ padding: 10, borderTop: '1px solid var(--line)' }}>€{c.totalSpent.toFixed(2)}</td>
                  <td style={{ padding: 10, borderTop: '1px solid var(--line)' }}>{c.lastOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Reports ---------------- */

function ReportsTab({ token }) {
  const { orders, loading } = useOrders(token);

  const report = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const sumSince = (since) =>
      orders
        .filter((o) => new Date(o.created_at) >= since)
        .reduce((s, o) => s + Number(o.total || 0), 0);

    const countSince = (since) => orders.filter((o) => new Date(o.created_at) >= since).length;

    const totalRevenue = orders.reduce((s, o) => s + Number(o.total || 0), 0);
    const avgOrder = orders.length ? totalRevenue / orders.length : 0;

    return {
      daily: sumSince(startOfDay),
      weekly: sumSince(startOfWeek),
      monthly: sumSince(startOfMonth),
      dailyCount: countSince(startOfDay),
      weeklyCount: countSince(startOfWeek),
      monthlyCount: countSince(startOfMonth),
      avgOrder,
      totalOrders: orders.length,
    };
  }, [orders]);

  if (loading) return <p>Loading…</p>;

  return (
    <>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {statCard('Sales Today', `€${report.daily.toFixed(2)}`)}
        {statCard('Sales This Week', `€${report.weekly.toFixed(2)}`)}
        {statCard('Sales This Month', `€${report.monthly.toFixed(2)}`)}
        {statCard('Total Orders', report.totalOrders)}
        {statCard('Average Order Value', `€${report.avgOrder.toFixed(2)}`)}
      </section>
      <div style={{ ...box, marginTop: 8 }}>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
          Best-selling products &amp; category breakdowns aren't available yet — that needs per-order item aggregation, planned for a later update.
        </p>
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

function SettingsTab({ token }) {
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setValues(d || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const setField = (key, val) => {
    setValues((v) => ({ ...v, [key]: val }));
    setSaved(false);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(values),
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
        Note: these are informational/display settings and delivery-fee math the checkout can read later — the login email/password are separate Cloudflare secrets and aren't changed here.
      </p>
    </div>
  );
}

/* ---------------- Menu & Pricing (Categories/Products/Options/Add-ons) ---------------- */

function MenuTabs({ token }) {
  const [categories, setCategories] = useState([]);
  const [optionGroups, setOptionGroups] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadRefs = () => {
    const headers = { Authorization: `Bearer ${token}` };
    fetch('/api/admin/categories', { headers }).then((r) => r.json()).then((d) => setCategories(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/admin/option_groups', { headers }).then((r) => r.json()).then((d) => setOptionGroups(Array.isArray(d) ? d : [])).catch(() => {});
  };

  useEffect(loadRefs, [token, refreshKey]);
  const bump = () => setRefreshKey((k) => k + 1);
  const [tab, setTab] = useState('categories');

  const categoryFields = [
    { key: 'id', label: 'ID (slug)', type: 'text', required: true, placeholder: 'e.g. pizzat' },
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'sub', label: 'Subtitle', type: 'text' },
    { key: 'image', label: 'Image URL', type: 'text' },
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
    { key: 'image', label: 'Image URL', type: 'text' },
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
    { key: 'image', label: 'Image URL', type: 'text' },
    { key: 'active', label: 'Active', type: 'checkbox', default: true },
    { key: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
  ];

  const TABS = [
    { id: 'categories', label: 'Categories' },
    { id: 'products', label: 'Products' },
    { id: 'options', label: 'Options' },
    { id: 'addons', label: 'Add-ons' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: -1 }}>
        {TABS.map((t) => (
          <button key={t.id} type="button" style={tabBtn(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

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
    if (!t) {
      window.location.href = '/admin';
      return;
    }
    setToken(t);
    setEmail(adminEmail || '');
    setReady(true);
  }, []);

  const logout = () => {
    sessionStorage.removeItem('ozy_admin_token');
    sessionStorage.removeItem('ozy_admin_email');
    window.location.href = '/admin';
  };

  if (!ready) return null;

  const TOP_TABS = [
    { id: 'overview', label: '🏠 Dashboard' },
    { id: 'orders', label: '📦 Orders' },
    { id: 'menu', label: '🍕 Menu & Pricing' },
    { id: 'customers', label: '👥 Customers' },
    { id: 'reports', label: '📊 Reports' },
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
            <button key={t.id} type="button" style={tabBtn(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {tab === 'overview' && <OverviewTab token={token} />}
        {tab === 'orders' && <OrdersTab token={token} />}
        {tab === 'menu' && <MenuTabs token={token} />}
        {tab === 'customers' && <CustomersTab token={token} />}
        {tab === 'reports' && <ReportsTab token={token} />}
        {tab === 'settings' && <SettingsTab token={token} />}
      </div>
    </main>
  );
}
