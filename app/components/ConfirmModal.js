'use client';

import { useStore } from '@/context/StoreContext';

export default function ConfirmModal() {
  const { confirmedOrder, setConfirmedOrder } = useStore();
  const open = !!confirmedOrder;

  return (
    <div className={`modal-overlay${open ? ' open' : ''}`}>
      <div className="modal-box">
        <button className="modal-close" type="button" onClick={() => setConfirmedOrder(null)}>×</button>
        {confirmedOrder && (
          <div className="confirm-box">
            <p className="eyebrow" style={{ marginBottom: 6 }}>Order placed</p>
            <div className="big">{confirmedOrder.orderNum}</div>
            <p>Thanks{confirmedOrder.customer?.name ? `, ${confirmedOrder.customer.name}` : ''}! Your order is on its way.</p>
            <div className="cod-note">
              <span style={{ fontSize: '1.3rem' }}>💵</span>
              <span>Pay <b>{confirmedOrder.total.toFixed(2)} €</b> by cash on delivery when your order arrives.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
