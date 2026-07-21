import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { useCart } from '../context/CartContext';
import { PAYPAL_API } from '../config/paypal';

const THEMES = {
  modern: {
    panel: { width: 340, background: '#0d1520', borderLeft: '2px solid #1a2a3a', color: '#fff' },
    title: { fontSize: '1.1rem', fontWeight: 'bold' },
    empty: { color: '#555', fontSize: '0.9rem' },
    item: { background: '#0a1018', borderRadius: 10, border: '1px solid #1a2a3a', fontSize: '0.85rem' },
    total: { color: '#FFD700', fontSize: '1.2rem' },
    checkout: { background: '#1D9E75', color: '#fff', borderRadius: 10, fontSize: '1rem' },
    close: { background: 'transparent', border: 'none', color: '#888' },
    closeBtn: null,
    font: 'system-ui, sans-serif',
    success: '#1D9E75',
  },
  pixel: {
    panel: { width: 300, background: '#fff', borderLeft: '4px solid #26215C', color: '#26215C' },
    title: { fontSize: 11, fontFamily: "'Press Start 2P', monospace" },
    empty: { fontSize: 8, color: '#888' },
    item: { borderBottom: '1px solid #eee', fontSize: 8, lineHeight: 1.8 },
    total: { fontSize: 10 },
    checkout: { background: '#1D9E75', color: '#fff', border: '2px solid #085041', fontSize: 8, fontFamily: "'Press Start 2P', monospace" },
    close: { background: 'transparent', border: 'none', color: '#888', fontSize: '1.3rem' },
    closeBtn: { background: '#26215C', color: '#fff', border: '2px solid #7F77DD', fontSize: 8, fontFamily: "'Press Start 2P', monospace" },
    font: "'Press Start 2P', monospace",
    success: '#1D9E75',
  },
};

export default function CartPanel({ open, onClose, variant = 'modern', closeLabel = 'Close' }) {
  const { cart, removeFromCart, clearCart, cartTotal } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const [orderDone, setOrderDone] = useState(false);
  const t = THEMES[variant] || THEMES.modern;

  if (!open) return null;

  const handleClose = () => {
    setCheckingOut(false);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      ...t.panel,
      zIndex: 200, padding: variant === 'pixel' ? 20 : '1.5rem',
      overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: variant === 'pixel' ? 12 : '1rem',
      fontFamily: t.font,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={t.title}>🛒 {variant === 'pixel' ? 'YOUR CART' : 'Your Cart'}</span>
        <button onClick={handleClose} style={{ ...t.close, cursor: 'pointer' }}>✕</button>
      </div>

      {cart.length === 0 ? (
        <div style={{ ...t.empty, marginTop: variant === 'modern' ? '2rem' : 0, textAlign: 'center' }}>
          {variant === 'modern' ? <>Your cart is empty!<br />Go grab something nice 🌴</> : 'No items yet!'}
        </div>
      ) : (
        cart.map(item => (
          <div key={item.id} style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: variant === 'modern' ? '0.75rem' : '0 0 8px 0',
            ...t.item,
          }}>
            <span style={{ fontSize: variant === 'modern' ? '1.8rem' : 'inherit' }}>{item.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: variant === 'modern' ? 600 : 'inherit', color: variant === 'modern' ? '#fff' : 'inherit' }}>
                {item.name}
              </div>
              <div style={{ color: variant === 'modern' ? '#888' : '#D85A30', fontSize: variant === 'modern' ? '0.75rem' : 'inherit' }}>
                x{item.qty} · €{(item.price * item.qty).toFixed(2)}
              </div>
            </div>
            <button onClick={() => removeFromCart(item.id)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
          </div>
        ))
      )}

      {cart.length > 0 && (
        <>
          <div style={{
            borderTop: variant === 'modern' ? '1px solid #1a2a3a' : 'none',
            paddingTop: variant === 'modern' ? '1rem' : 0,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: t.total.fontSize, color: variant === 'modern' ? undefined : '#26215C', marginTop: variant === 'pixel' ? 8 : 0,
          }}>
            <span style={{ fontWeight: 'bold', color: variant === 'modern' ? '#fff' : '#26215C' }}>
              {variant === 'pixel' ? 'TOTAL:' : 'Total'}
            </span>
            <span style={{ color: '#FFD700', fontWeight: 900, ...t.total }}>€{cartTotal.toFixed(2)}</span>
          </div>

          {!orderDone && (checkingOut ? (
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
                if (res.success) { clearCart(); setOrderDone(true); }
              }}
              onError={() => alert('Payment failed.')}
            />
          ) : (
            <button
              onClick={() => setCheckingOut(true)}
              style={{ ...t.checkout, border: t.checkout.border || 'none', padding: variant === 'pixel' ? 10 : '0.9rem', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}
            >
              {variant === 'pixel' ? 'CHECKOUT via PayPal' : 'Checkout →'}
            </button>
          ))}

          {orderDone && (
            <div style={{ color: t.success, textAlign: 'center', fontWeight: 'bold', padding: '1rem', fontSize: variant === 'pixel' ? 9 : 'inherit' }}>
              {variant === 'pixel' ? 'ORDER CONFIRMED! Check your email!' : <>🎉 Order confirmed!<br />Check your email!</>}
            </div>
          )}
        </>
      )}

      {variant === 'modern' && cart.length > 0 && (
        <Link to="/cart" onClick={handleClose} style={{ color: '#7F77DD', fontSize: '0.85rem', textAlign: 'center' }}>
          View full cart →
        </Link>
      )}

      {t.closeBtn && (
        <button onClick={handleClose} style={{ ...t.closeBtn, padding: 10, cursor: 'pointer', marginTop: 'auto' }}>
          {closeLabel}
        </button>
      )}
    </div>
  );
}
