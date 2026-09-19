'use client';

import { useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { useTranslations } from '@/lib/i18n';
import OrderConfirmationCard from '@/components/OrderConfirmationCard';

function CopyCodeButton({ code, copyLabel, copiedLabel }: { code: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable/denied — the code is still shown as
      // plain text right next to this button either way.
    }
  };
  return (
    <button type="button" className="btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={copy}>
      {copied ? copiedLabel : copyLabel}
    </button>
  );
}

export default function ConfirmModal() {
  const { confirmedOrder, closeConfirm } = useStore();
  const t = useTranslations();
  const open = !!confirmedOrder;
  const loyalty = confirmedOrder?.loyalty;
  // Rewards dashboard consolidation — the "every Nth order" threshold is
  // now admin-configurable (stamp_card_every_n_orders), so it's read from
  // this order's own response (loyalty.everyNOrders) rather than a
  // hardcoded constant here — see app/api/orders/route.ts.
  const everyN = loyalty?.everyNOrders || 5;
  const remainingForReward = loyalty ? (everyN - (loyalty.orderCount % everyN)) % everyN : 0;

  // Part A / Part B (order confirmation screen, Stripe redirect handling) —
  // the actual card markup (order number, payment-method-appropriate
  // message, total, dismiss button) now lives in the shared
  // OrderConfirmationCard component, reused as-is by the /checkout-return
  // landing page (Part B) for the redirect-return case. This component
  // still owns the modal chrome (overlay/box/close button) and everything
  // that depends on live StoreContext state — cart-derived discount
  // messaging, loyalty/stamp-card progress, Wow Moment — none of which
  // exists anymore after a full page reload, which is exactly why
  // /checkout-return can't just reuse ConfirmModal itself.
  const discountBlock = confirmedOrder && confirmedOrder.discountAmount > 0 && (
    <p style={{ color: 'var(--ember-dark, #C14815)', fontSize: '0.9rem', margin: '4px 0 0' }}>
      {confirmedOrder.welcomeDiscountApplied
        ? t.confirm.welcomeDiscountApplied(`${confirmedOrder.discountAmount.toFixed(2)} €`)
        : confirmedOrder.scheduledOfferApplied
          ? t.confirm.scheduledOfferApplied(confirmedOrder.scheduledOfferApplied.label, `${confirmedOrder.discountAmount.toFixed(2)} €`)
          : confirmedOrder.discountSource === 'stamp_card'
            ? t.confirm.stampCardApplied(`${confirmedOrder.discountAmount.toFixed(2)} €`)
            : t.confirm.couponApplied(`${confirmedOrder.discountAmount.toFixed(2)} €`)}
    </p>
  );

  const rewardsBlock = confirmedOrder && (
    <>
      {/* Stamp-card redesign — the reward is applied directly to the
          order's own total (or banked as a pending reward for a future
          one) rather than minted as a coupon, so there's no code to
          show/copy here anymore — see app/api/orders/route.ts and
          worker/migrations/010_stamp_card_redesign_and_source_tracking.sql. */}
      {loyalty && confirmedOrder.discountSource === 'stamp_card' ? (
        <div style={{ margin: '14px 0 0', padding: '12px 14px', borderRadius: 10, background: 'rgba(125,90,22,0.14)', color: 'var(--gold, #7D5A16)' }}>
          <p style={{ margin: 0, fontWeight: 700 }}>{t.confirm.stampCardRewardApplied}</p>
        </div>
      ) : loyalty && loyalty.pendingRewardCreated ? (
        <div style={{ margin: '14px 0 0', padding: '12px 14px', borderRadius: 10, background: 'rgba(125,90,22,0.14)', color: 'var(--gold, #7D5A16)' }}>
          <p style={{ margin: 0, fontWeight: 700 }}>{t.confirm.stampCardPendingEarned(loyalty.orderCount)}</p>
        </div>
      ) : loyalty && remainingForReward > 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '14px 0 0' }}>
          {t.confirm.loyaltyProgress(loyalty.orderCount, remainingForReward)}
        </p>
      ) : null}
      {/* Growth features batch 2 (Feature 6 — "Ozy Wow Moment") — a
          SEPARATE block from the loyalty one above (not another branch of
          the same condition), deliberately styled with a different
          color/icon/border so the two can render simultaneously (5th order
          AND a lucky roll) without looking like the same message repeated
          or overwriting each other. */}
      {confirmedOrder.wowMomentRewardCode && (
        <div
          style={{
            margin: '14px 0 0', padding: '12px 14px', borderRadius: 10,
            background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.35)', color: 'var(--wow-accent, #7C3AED)',
          }}
        >
          <p style={{ margin: '0 0 8px', fontWeight: 700 }}>{t.confirm.wowMomentReward}</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <code style={{ fontSize: 15, fontWeight: 700 }}>{confirmedOrder.wowMomentRewardCode}</code>
            <CopyCodeButton code={confirmedOrder.wowMomentRewardCode} copyLabel={t.confirm.copyCode} copiedLabel={t.confirm.codeCopied} />
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className={`modal-overlay${open ? ' open' : ''}`}>
      <div className="modal-box">
        <button className="modal-close" type="button" onClick={closeConfirm}>×</button>
        {confirmedOrder && (
          <OrderConfirmationCard
            orderNum={confirmedOrder.orderNum}
            total={confirmedOrder.total}
            paymentMethod={confirmedOrder.paymentMethod}
            customerName={confirmedOrder.customer?.name}
            onDismiss={closeConfirm}
            discountBlock={discountBlock}
            rewardsBlock={rewardsBlock}
            orderType={confirmedOrder.orderType}
          />
        )}
      </div>
    </div>
  );
}
