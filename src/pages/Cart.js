import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import { useCart } from '../context/CartContext';
import { PAYPAL_OPTIONS, PAYPAL_API } from '../config/paypal';

export default function Cart() {
  const { cart, removeFromCart, updateQty, clearCart, cartCount, cartTotal } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const [orderDone, setOrderDone] = useState(false);

  return (
    <PayPalScriptProvider options={PAYPAL_OPTIONS}>
      <div style={{ minHeight: '80vh', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', letterSpacing: '0.2em', color: '#7F77DD', marginBottom: '0.5rem' }}>🌴 ISLAND STORE</div>
            <h1 style={{ fontSize: '2rem', color: '#FFD700', margin: 0 }}>Your Cart</h1>
            <p style={{ color: '#888', marginTop: '0.5rem' }}>{cartCount} item{cartCount !== 1 ? 's' : ''}</p>
          </div>
          <Link to="/shop" style={{ color: '#7F77DD', textDecoration: 'none', border: '1px solid #7F77DD', borderRadius: 8, padding: '8px 16px', fontSize: '0.9rem' }}>
            ← Continue shopping
          </Link>
        </div>

        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#0d1520', borderRadius: 16, border: '1px solid #1a2a3a' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛒</div>
            <p style={{ color: '#888', marginBottom: '1.5rem' }}>Your cart is empty — time for an island adventure!</p>
            <Link to="/shop" style={{ display: 'inline-block', background: '#7F77DD', color: '#000', padding: '12px 24px', borderRadius: 8, textDecoration: 'none', fontWeight: 'bold' }}>
              Enter the Shop
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(280px, 360px)', gap: '2rem', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {cart.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', background: '#0d1520', borderRadius: 12, border: '1px solid #1a2a3a' }}>
                    <span style={{ fontSize: '2.5rem' }}>{item.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{item.name}</div>
                      <div style={{ color: '#888', fontSize: '0.85rem', marginTop: 4 }}>€{item.price.toFixed(2)} each</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button onClick={() => updateQty(item.id, item.qty - 1)} style={qtyBtn}>−</button>
                      <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 'bold' }}>{item.qty}</span>
                      <button onClick={() => updateQty(item.id, item.qty + 1)} style={qtyBtn}>+</button>
                    </div>
                    <div style={{ fontWeight: 900, color: '#FFD700', minWidth: 72, textAlign: 'right' }}>
                      €{(item.price * item.qty).toFixed(2)}
                    </div>
                    <button onClick={() => removeFromCart(item.id)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: '1.2rem' }} title="Remove">✕</button>
                  </div>
                ))}
            </div>

            <div style={{ background: '#0d1520', borderRadius: 16, border: '1px solid #1a2a3a', padding: '1.5rem', position: 'sticky', top: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#fff' }}>Order summary</h2>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#888' }}>
                <span>Subtotal ({cartCount} items)</span>
                <span>€{cartTotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #1a2a3a', fontWeight: 900, fontSize: '1.2rem' }}>
                <span>Total</span>
                <span style={{ color: '#FFD700' }}>€{cartTotal.toFixed(2)}</span>
              </div>

              {orderDone ? (
                <div style={{ color: '#1D9E75', textAlign: 'center', fontWeight: 'bold', padding: '1rem' }}>
                  🎉 Order confirmed!<br />Check your email!
                </div>
              ) : checkingOut ? (
                <PayPalButtons
                  fundingSource={undefined}
                  style={{ layout: 'vertical', shape: 'rect', label: 'pay' }}
                  createOrder={async () => {
                    const r = await fetch(`${PAYPAL_API}/create-order`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ cartItems: cart.map(c => ({ name: c.name, price: Number(c.price), quantity: c.qty })) }),
                    });
                    const d = await r.json();
                    return d.id;
                  }}
                  onApprove={async (data) => {
                    const r = await fetch(`${PAYPAL_API}/capture-order`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ orderID: data.orderID, cartItems: cart }),
                    });
                    const res = await r.json();
                    if (res.success) { clearCart(); setOrderDone(true); setCheckingOut(false); }
                  }}
                  onError={() => alert('Payment failed.')}
                />
              ) : (
                <button onClick={() => setCheckingOut(true)} style={{ width: '100%', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 10, padding: '1rem', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>
                  Checkout with PayPal →
                </button>
              )}

              <button onClick={clearCart} style={{ width: '100%', marginTop: '0.75rem', background: 'transparent', color: '#666', border: '1px solid #333', borderRadius: 8, padding: '0.6rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                Clear cart
              </button>
            </div>
          </div>
        )}
      </div>
    </PayPalScriptProvider>
  );
}

const qtyBtn = {
  background: '#1a2a3a',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  width: 32,
  height: 32,
  cursor: 'pointer',
  fontSize: '1.1rem',
  fontWeight: 'bold',
};
