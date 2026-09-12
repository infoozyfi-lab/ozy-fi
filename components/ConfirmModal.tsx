'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { useTranslations, useLocalePath } from '@/lib/i18n';

// Feature 3 — stamp card / loyalty. Every 5th (non-cancelled) order earns
// a reward — see app/api/orders/route.ts. This interval is fixed by the
// brief ("every 5th order"), not admin-configurable like the reward
// amount itself (stamp_card_reward_percent), so it's a plain constant
// here rather than something threaded through from settings.
const STAMP_INTERVAL = 5;

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
  const lp = useLocalePath();
  const open = !!confirmedOrder;
  const loyalty = confirmedOrder?.loyalty;
  const remainingForReward = loyalty ? (STAMP_INTERVAL - (loyalty.orderCount % STAMP_INTERVAL)) % STAMP_INTERVAL : 0;

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
                {confirmedOrder.welcomeDiscountApplied
                  ? t.confirm.welcomeDiscountApplied(`${confirmedOrder.discountAmount.toFixed(2)} €`)
                  : confirmedOrder.scheduledOfferApplied
                    ? t.confirm.scheduledOfferApplied(confirmedOrder.scheduledOfferApplied.label, `${confirmedOrder.discountAmount.toFixed(2)} €`)
                    : t.confirm.couponApplied(`${confirmedOrder.discountAmount.toFixed(2)} €`)}
              </p>
            )}
            <div className="cod-note">
              <span style={{ fontSize: '1.3rem' }}>💵</span>
              <span>{t.confirm.codNote(`${confirmedOrder.total.toFixed(2)} €`)}</span>
            </div>
            {loyalty && loyalty.rewardCode ? (
              <div style={{ margin: '14px 0 0', padding: '12px 14px', borderRadius: 10, background: 'rgba(227,167,59,0.14)', color: 'var(--gold, #E3A73B)' }}>
                <p style={{ margin: '0 0 8px', fontWeight: 700 }}>{t.confirm.loyaltyReward(loyalty.orderCount)}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <code style={{ fontSize: 15, fontWeight: 700 }}>{loyalty.rewardCode}</code>
                  <CopyCodeButton code={loyalty.rewardCode} copyLabel={t.confirm.copyCode} copiedLabel={t.confirm.codeCopied} />
                </div>
              </div>
            ) : loyalty && remainingForReward > 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '14px 0 0' }}>
                {t.confirm.loyaltyProgress(loyalty.orderCount, remainingForReward)}
              </p>
            ) : null}
            {/* Growth features batch 2 (Feature 6 — "Ozy Wow Moment") —
                a SEPARATE block from the loyalty one above (not another
                branch of the same condition), deliberately styled with a
                different color/icon/border so the two can render
                simultaneously (5th order AND a lucky roll) without
                looking like the same message repeated or overwriting
                each other. */}
            {confirmedOrder.wowMomentRewardCode && (
              <div
                style={{
                  margin: '14px 0 0', padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(168,85,247,0.14)', border: '1px solid rgba(168,85,247,0.4)', color: '#c084fc',
                }}
              >
                <p style={{ margin: '0 0 8px', fontWeight: 700 }}>{t.confirm.wowMomentReward}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <code style={{ fontSize: 15, fontWeight: 700 }}>{confirmedOrder.wowMomentRewardCode}</code>
                  <CopyCodeButton code={confirmedOrder.wowMomentRewardCode} copyLabel={t.confirm.copyCode} copiedLabel={t.confirm.codeCopied} />
                </div>
              </div>
            )}
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
