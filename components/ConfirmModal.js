'use client';

import { useStore } from '@/context/StoreContext';

export default function ConfirmModal() {
  const { confirmedOrder, closeConfirm } = useStore();
  const open = !!confirmedOrder;

  return (
    <div className={`modal-overlay${open ? ' open' : ''}`}>
      <div className="modal-box">
        <button className="modal-close" type="button" onClick={closeConfirm}>×</button>
        {confirmedOrder && (
          <div className="confirm-box">
            <div className="confirm-check">✓</div>
            <p className="eyebrow" style={{ marginBottom: 6 }}>Order placed</p>
            <div className="big">{confirmedOrder.orderNum}</div>
            <p>Thanks{confirmedOrder.customer?.name ? `, ${confirmedOrder.customer.name}` : ''}! Your order is on its way.</p>
            <p className="confirm-eta">Estimated ready time: 25–35 minutes</p>
            <div className="cod-note">
              <span style={{ fontSize: '1.3rem' }}>💵</span>
              <span>Pay <b>{confirmedOrder.total.toFixed(2)} €</b> by cash on delivery when your order arrives.</span>
            </div>
            <button type="button" className="btn-primary" onClick={closeConfirm}>
              Continue shopping
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
