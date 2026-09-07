'use client';

import { useState } from 'react';
import { useStore } from '@/context/StoreContext';

function money(n) {
  return `${n.toFixed(2)} €`;
}

export default function BundleModal() {
  const {
    activeBundle,
    bundleSlots,
    isBundleModalOpen,
    closeBundleModal,
    removeBundleSlotItem,
    bundleReady,
    bundleTotal,
    addBundleToCart,
    products,
    openProduct,
  } = useStore();

  const [pickerSlotIndex, setPickerSlotIndex] = useState(null);

  if (!activeBundle) {
    return <div className="bundle-modal" aria-hidden="true" />;
  }

  const pickerSlot = pickerSlotIndex != null ? bundleSlots[pickerSlotIndex] : null;
  const pickerCategoryIds = pickerSlot
    ? (pickerSlot.categoryIds && pickerSlot.categoryIds.length
      ? pickerSlot.categoryIds
      : (pickerSlot.categoryId ? [pickerSlot.categoryId] : []))
    : [];
  const pickerProducts = pickerSlot ? products.filter((p) => pickerCategoryIds.includes(p.cat)) : [];

  return (
    <div className={`bundle-modal${isBundleModalOpen ? ' open' : ''}`}>
      <div className="pp-topbar">
        <button className="pp-back" type="button" aria-label="Back" onClick={closeBundleModal}>←</button>
        <span className="pp-topbar-title">ozy<span>.fi</span></span>
        <span style={{ width: 40 }} />
      </div>

      <div className="pp-scroll">
        {pickerSlot ? (
          <div className="wrap bundle-picker">
            <button type="button" className="change-btn" onClick={() => setPickerSlotIndex(null)}>
              ← back to bundle
            </button>
            <p className="pp-heading">{pickerSlot.label || 'Choose an item'}</p>
            {pickerProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                className="menu-item"
                onClick={() => {
                  setPickerSlotIndex(null);
                  openProduct(p, pickerSlotIndex);
                }}
              >
                <span className="menu-item-info">
                  <span className="name-row"><h3>{p.name}</h3></span>
                  <span className="price">{p.price.toFixed(2)} €</span>
                </span>
                <span className="menu-item-thumb">
                  <img src={p.image} alt={p.name} loading="lazy" />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="pp-hero">
              <img className="pp-hero-img" src={activeBundle.image} alt={activeBundle.title} />
              <div className="pp-price-badge">
                <div className="pp-price-row">
                  <span>{bundleTotal.toFixed(2)}</span>
                  <span className="pp-price-eur"> €</span>
                </div>
              </div>
            </div>

            <div className="pp-body wrap">
              <h1 className="pp-name">{activeBundle.title}</h1>
              {activeBundle.description && <p className="pp-desc">{activeBundle.description}</p>}

              {bundleSlots.map((slot, idx) => (
                <div className="pp-section" key={idx}>
                  <p className="pp-label">
                    {slot.label || (slot.kind === 'fixed' ? 'Included' : 'Choose')} ({slot.filled.length}/{slot.qty || 1})
                  </p>

                  {slot.filled.length > 0 && (
                    <div className="pp-fillings-list">
                      {slot.filled.map((item) => (
                        <div className="pp-filling-row active" key={item.key}>
                          <span className="fname">
                            {item.name}
                            {item.details.length > 0 && (
                              <span style={{ display: 'block', fontSize: 12, opacity: 0.7 }}>
                                {item.details.join(', ')}
                              </span>
                            )}
                          </span>
                          {slot.kind !== 'fixed' && (
                            <button
                              type="button"
                              className="change-btn"
                              onClick={() => removeBundleSlotItem(idx, item.key)}
                            >
                              remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {slot.kind !== 'fixed' && slot.filled.length < (slot.qty || 1) && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setPickerSlotIndex(idx)}
                    >
                      + Choose {slot.label || 'item'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {!pickerSlot && (
        <div className="pp-footer">
          <button
            className="btn-primary pp-add-btn"
            type="button"
            disabled={!bundleReady}
            onClick={addBundleToCart}
          >
            {bundleReady ? `Add bundle to order — ${money(bundleTotal)}` : 'Fill every slot to continue'}
          </button>
        </div>
      )}
    </div>
  );
}
