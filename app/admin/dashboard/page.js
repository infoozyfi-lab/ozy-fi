'use client';

import { useEffect, useState } from 'react';

export default function AdminDashboard() {
  const [email, setEmail] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('ozy_admin_token');
    const adminEmail = sessionStorage.getItem('ozy_admin_email');

    if (!token) {
      window.location.href = '/admin';
      return;
    }

    setEmail(adminEmail || '');

    fetch('/api/admin/orders', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (res.status === 401) {
          sessionStorage.removeItem('ozy_admin_token');
          sessionStorage.removeItem('ozy_admin_email');
          window.location.href = '/admin';
          return null;
        }

        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setOrders(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const logout = () => {
    sessionStorage.removeItem('ozy_admin_token');
    sessionStorage.removeItem('ozy_admin_email');
    window.location.href = '/admin';
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f6f6f6',
        padding: '30px',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '30px',
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>
              OZY Admin Dashboard
            </h1>

            <p style={{ color: '#666' }}>
              {email}
            </p>
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

        <section
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '30px',
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: '24px',
              borderRadius: '12px',
              border: '1px solid #ddd',
            }}
          >
            <h3>Total Orders</h3>
            <strong style={{ fontSize: '32px' }}>
              {orders.length}
            </strong>
          </div>

          <div
            style={{
              background: '#fff',
              padding: '24px',
              borderRadius: '12px',
              border: '1px solid #ddd',
            }}
          >
            <h3>Restaurant</h3>
            <strong>OZY</strong>
          </div>

          <div
            style={{
              background: '#fff',
              padding: '24px',
              borderRadius: '12px',
              border: '1px solid #ddd',
            }}
          >
            <h3>Status</h3>
            <strong>Online</strong>
          </div>
        </section>

        <section
          style={{
            background: '#fff',
            padding: '24px',
            borderRadius: '12px',
            border: '1px solid #ddd',
          }}
        >
          <h2>Recent Orders</h2>

          {loading ? (
            <p>Loading orders...</p>
          ) : orders.length === 0 ? (
            <p>No orders yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                }}
              >
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px' }}>
                      Order
                    </th>
                    <th style={{ textAlign: 'left', padding: '12px' }}>
                      Customer
                    </th>
                    <th style={{ textAlign: 'left', padding: '12px' }}>
                      Total
                    </th>
                    <th style={{ textAlign: 'left', padding: '12px' }}>
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td style={{ padding: '12px' }}>
                        {order.order_num}
                      </td>

                      <td style={{ padding: '12px' }}>
                        {order.customer_name}
                      </td>

                      <td style={{ padding: '12px' }}>
                        €{Number(order.total || 0).toFixed(2)}
                      </td>

                      <td style={{ padding: '12px' }}>
                        {order.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
