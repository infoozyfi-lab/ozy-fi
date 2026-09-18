'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useTranslations, useLocalePath } from '@/lib/i18n';

// Part A (order confirmation screen) / Part B (Stripe redirect handling) —
// the actual "you're done, here's your order" card, extracted out of
// ConfirmModal.tsx so the exact same visual identity and copy can be reused
// in two places: ConfirmModal itself (the normal, no-redirect checkout
// flow, still driven by StoreContext's confirmedOrder / cart in memory) and
// the new /checkout-return landing page (Part B — where a redirect-based
// payment method sends the customer back after a full page reload, which
// loses that in-memory state; all this component gets there is what
// Stripe's own PaymentIntent can tell us: the order number and amount from
// its metadata, nothing about cart contents, discounts, or loyalty
// progress). `discountBlock`/`rewardsBlock` are optional slots so
// ConfirmModal can still show its extra discount/stamp-card/Wow-Moment
// messaging (data /checkout-return simply doesn't have) without this shared
// component needing to know anything about those features itself.
export interface OrderConfirmationCardProps {
  orderNum: string; // already formatted with a leading '#', e.g. "#AB123456"
  total: number;
  paymentMethod: 'cod' | 'card';
  customerName?: string;
  onDismiss: () => void;
  dismissLabel?: ReactNode; // defaults to t.confirm.continueShopping
  discountBlock?: ReactNode;
  rewardsBlock?: ReactNode;
}

export default function OrderConfirmationCard({
  orderNum,
  total,
  paymentMethod,
  customerName,
  onDismiss,
  dismissLabel,
  discountBlock,
  rewardsBlock,
}: OrderConfirmationCardProps) {
  const t = useTranslations();
  const lp = useLocalePath();

  return (
    <div className="confirm-box">
      <div className="confirm-check">✓</div>
      <p className="eyebrow" style={{ marginBottom: 6 }}>{t.confirm.eyebrow}</p>
      <div className="big">{orderNum}</div>
      <p>{t.confirm.thanks(customerName)}</p>
      <p className="confirm-eta">{t.confirm.eta}</p>
      {discountBlock}
      {/* Payment-method-appropriate message (Part A) — a card order that
          already succeeded says so and shows what was charged; a COD order
          is told to have cash ready. Never the same generic text for both. */}
      <div className="cod-note">
        <span style={{ fontSize: '1.3rem' }}>{paymentMethod === 'card' ? '✅' : '💵'}</span>
        <span>
          {paymentMethod === 'card'
            ? t.confirm.cardPaidNote(`${total.toFixed(2)} €`)
            : t.confirm.codNote(`${total.toFixed(2)} €`)}
        </span>
      </div>
      {rewardsBlock}
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 14 }}>
        {t.confirm.saveOrderNumber(
          <Link href={lp('/track')} style={{ color: 'var(--ember)', textDecoration: 'underline' }}>{t.confirm.trackLinkText}</Link>
        )}
      </p>
      <button type="button" className="btn-primary" onClick={onDismiss}>
        {dismissLabel ?? t.confirm.continueShopping}
      </button>
    </div>
  );
}
