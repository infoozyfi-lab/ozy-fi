'use client';

import { useStore } from '@/context/StoreContext';

export default function CartDrawer() {
  const { cart, cartTotal, isCartOpen, setCartOpen, removeFromCart, goToCheckout } = useStore();

  return (
    <>
      <div className={`cart-overlay${isCartOpen ? ' open' : ''}`} onClick={() => setCartOpen(false)} />
      <aside className={`cart-drawer${isCartOpen ? ' open' : ''}`}>
        <div className="cart-header">
          <h3>Your order</h3>
          <button type="button" onClick={() => setCartOpen(false)}>×</button>
        </div>
        <div className="cart-items">
          {cart.length === 0 ? (
            <p className="cart-empty">Your cart is empty.</p>
          ) : (
            cart.map((line) => (
              <div className="cart-line" key={line.key}>
                <img src={line.image} alt={line.name} />
                <div className="cart-line-body">
                  <div className="cart-line-top">
                    <h4>{line.qty} × {line.name}</h4>
                    <span className="line-price">{line.lineTotal.toFixed(2)} €</span>
                  </div>
                  {line.details.length > 0 && (
                    <div className="line-meta">+ {line.details.join(', ')}</div>
                  )}
                  <button className="remove-btn" type="button" onClick={() => removeFromCart(line.key)}>
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="cart-footer">
          <div className="cart-total-row">
            <span>Total</span>
            <span>{cartTotal.toFixed(2)} €</span>
          </div>
          <button
            className="btn-primary"
            type="button"
            style={{ width: '100%' }}
            disabled={cart.length === 0}
            onClick={goToCheckout}
          >
            Checkout
          </button>
        </div>
      </aside>
    </>
  );
}
