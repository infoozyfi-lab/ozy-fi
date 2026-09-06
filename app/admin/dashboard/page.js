'use client';

import { useEffect, useState } from 'react';
import ResourceManager from '@/components/admin/ResourceManager';

const ORDER_STATUSES = ['received', 'preparing', 'on_the_way', 'delivered', 'cancelled'];

const box = {
  background: '#fff',
  padding: '24px',
  borderRadius: '12px',
  border: '1px solid #ddd',
  marginBottom: '24px',
};

const tabBtn = (active) => ({
  padding: '10px 18px',
  border: '1px solid #ccc',
  borderBottom: active ? '2px solid #111' : '1px solid #ccc',
  borderRadius: '8px 8px 0 0',
  background: active ? '#fff' : '#f2f2f2',
  cursor: 'pointer',
  fontWeight: active ? 700 : 400,
});

function OrdersTab({ token }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/orders', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  const changeStatus = async (order, status) => {
    setUpdatingId(order.id);
    try {
      await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, status } : o)));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <>
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div style={box}>
          <h3 style={{ marginTop: 0 }}>Total Orders</h3>
          <strong style={{ fontSize: '32px' }}>{orders.length}</strong>
        </div>
        <div style={box}>
          <h3 style={{ marginTop: 0 }}>Restaurant</h3>
          <strong>OZY</strong>
        </div>
        <div style={box}>
          <h3 style={{ marginTop: 0 }}>Status</h3>
          <strong>Online</strong>
        </div>
      </section>

      <div style={box}>
        <h2 style={{ marginTop: 0 }}>Recent Orders</h2>
        {loading ? (
          <p>Loading orders...</p>
        ) : orders.length === 0 ? (
          <p>No orders yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px' }}>Order</th>
                  <th style={{ textAlign: 'left', padding: '12px' }}>Customer</th>
                  <th style={{ textAlign: 'left', padding: '12px' }}>Total</th>
                  <th style={{ textAlign: 'left', padding: '12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td style={{ padding: '12px' }}>{order.order_num}</td>
                    <td style={{ padding: '12px' }}>{order.customer_name}</td>
                    <td style={{ padding: '12px' }}>€{Number(order.total || 0).toFixed(2)}</td>
                    <td style={{ padding: '12px' }}>
                      <select
                        value={order.status}
                        disabled={updatingId === order.id}
                        onChange={(e) => changeStatus(order, e.target.value)}
                        style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #ccc' }}
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </td>
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

function MenuTabs({ token }) {
  const [categories, setCategories] = useState([]);
  const [optionGroups, setOptionGroups] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadRefs = () => {
    const headers = { Authorization: `Bearer ${token}` };
    fetch('/api/admin/categories', { headers })
      .then((r) => r.json())
      .then((d) => setCategories(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch('/api/admin/option_groups', { headers })
      .then((r) => r.json())
      .then((d) => setOptionGroups(Array.isArray(d) ? d : []))
      .catch(() => {});
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
      key: 'kind',
      label: 'Kind',
      type: 'select',
      required: true,
      options: [
        { value: 'base', label: 'Base' },
        { value: 'sauce', label: 'Sauce' },
        { value: 'cheese', label: 'Cheese' },
        { value: 'sauce_stripe', label: 'Sauce stripe' },
        { value: 'dip', label: 'Dip' },
        { value: 'topping', label: 'Topping (checkbox list)' },
        { value: 'filling', label: 'Filling category' },
      ],
    },
    { key: 'icon', label: 'Icon (emoji, optional)', type: 'text' },
    { key: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
  ];

  const optionFields = [
    { key: 'id', label: 'ID (slug)', type: 'text', required: true, placeholder: 'e.g. base-classic' },
    {
      key: 'group_id',
      label: 'Option group',
      type: 'select',
      required: true,
      options: optionGroups.map((g) => ({ value: g.id, label: `${g.title} (${g.id})` })),
    },
    { key: 'label', label: 'Label', type: 'text', required: true },
    { key: 'price_delta', label: 'Price delta (€)', type: 'number', step: '0.1', default: 0 },
    { key: 'color', label: 'Color (hex, optional)', type: 'text', placeholder: '#c0392b' },
    { key: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
  ];

  const productFields = [
    { key: 'id', label: 'ID (slug)', type: 'text', required: true },
    {
      key: 'category_id',
      label: 'Category',
      type: 'select',
      required: true,
      options: categories.map((c) => ({ value: c.id, label: c.title })),
    },
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
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      required: true,
      options: [
        { value: 'drink', label: 'Drink' },
        { value: 'dip', label: 'Dip' },
        { value: 'snack', label: 'Snack' },
      ],
    },
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
          <button key={t.id} type="button" style={tabBtn(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'categories' && (
        <ResourceManager
          token={token}
          table="categories"
          title="Categories"
          fields={categoryFields}
          displayCols={['id', 'title', 'sub', 'sort_order']}
          onChanged={bump}
        />
      )}

      {tab === 'products' && (
        <ResourceManager
          token={token}
          table="products"
          title="Products"
          fields={productFields}
          displayCols={['id', 'category_id', 'name', 'price', 'active']}
          onChanged={bump}
        />
      )}

      {tab === 'options' && (
        <>
          <div style={{ ...box, marginBottom: 16, padding: 16 }}>
            <strong>Option groups</strong> (Base, Sauce, Cheese, Toppings, Fillings…)
          </div>
          <ResourceManager
            token={token}
            table="option_groups"
            title="Option Groups"
            fields={optionGroupFields}
            displayCols={['id', 'title', 'kind', 'sort_order']}
            onChanged={bump}
          />
          <ResourceManager
            token={token}
            table="options"
            title="Options (individual choices within a group)"
            fields={optionFields}
            displayCols={['id', 'group_id', 'label', 'price_delta']}
            onChanged={bump}
          />
        </>
      )}

      {tab === 'addons' && (
        <ResourceManager
          token={token}
          table="addons"
          title="Add-ons (drinks, dips, snacks)"
          fields={addonFields}
          displayCols={['id', 'type', 'name', 'price', 'active']}
          onChanged={bump}
        />
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('orders');

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
    { id: 'orders', label: 'Orders' },
    { id: 'menu', label: 'Menu & Pricing' },
  ];

  return (
    <main style={{ minHeight: '100vh', background: '#f6f6f6', padding: '30px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>OZY Admin Dashboard</h1>
            <p style={{ color: '#666' }}>{email}</p>
          </div>
          <button
            onClick={logout}
            style={{
              padding: '10px 18px',
              border: '1px solid #ccc',
              borderRadius: '8px',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </header>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {TOP_TABS.map((t) => (
            <button key={t.id} type="button" style={tabBtn(tab === t.id)} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'orders' && <OrdersTab token={token} />}
        {tab === 'menu' && <MenuTabs token={token} />}
      </div>
    </main>
  );
}
