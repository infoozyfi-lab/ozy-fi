'use client';

import Link from 'next/link';
import { useStore } from '@/context/StoreContext';
import { useTranslations, useLocalePath } from '@/lib/i18n';

export default function ConfirmModal() {
  const { confirmedOrder, closeConfirm } = useStore();
  const t = useTranslations();
  const lp = useLocalePath();
  const open = !!confirmedOrder;

  return (
    <div className={`modal-overlay${open ? ' open' : ''}`}>
      <div className="modal-box">
        <button className="modal-close" type="button" onClick={closeConfirm}>×</button>
        {confirmedOrder && (
          <div className="confirm-box">
            <div className="confirm-check">✓</div>
            <p className="eyebrow" style={{ marginBottom: 6 }}>{t.confirm.eyebrow}</p>
            <div className="big">{confirmedOrder.orderNum}</div>
            <p>{t.confirm.thanks(confirmedOrder.customer?.name)}</p>
            <p className="confirm-eta">{t.confirm.eta}</p>
            {confirmedOrder.discountAmount > 0 && (
              <p style={{ color: 'var(--ember, #d97706)', fontSize: '0.9rem', margin: '4px 0 0' }}>
                {t.confirm.couponApplied(`${confirmedOrder.discountAmount.toFixed(2)} €`)}
              </p>
            )}
            <div className="cod-note">
              <span style={{ fontSize: '1.3rem' }}>💵</span>
              <span>{t.confirm.codNote(`${confirmedOrder.total.toFixed(2)} €`)}</span>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 14 }}>
              {t.confirm.saveOrderNumber(
                <Link href={lp('/track')} style={{ color: 'var(--ember)', textDecoration: 'underline' }}>{t.confirm.trackLinkText}</Link>
              )}
            </p>
            <button type="button" className="btn-primary" onClick={closeConfirm}>
              {t.confirm.continueShopping}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
