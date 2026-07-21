import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { useCart } from '../context/CartContext';
import { seededColor, seededLightColor } from '../utils/colors';
import { PAYPAL_OPTIONS } from '../config/paypal';
import CartPanel from '../components/CartPanel';

export default function QuickShop({ products, onBack }) {
  const { addToCart, cartCount, cartTotal } = useCart();
  const [showCart, setShowCart] = useState(false);
  const [hovered, setHovered] = useState(null);

  return (
    <PayPalScriptProvider options={PAYPAL_OPTIONS}>
      <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: 'system-ui,sans-serif', color: '#fff' }}>
        <div style={{ background: '#0d1520', borderBottom: '2px solid #1a2a3a', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={onBack} style={{ background: 'transparent', border: '1px solid #333', color: '#888', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem' }}>← Back</button>
            <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#FFD700' }}>🌴 Island Store</span>
            <span style={{ background: '#1D9E75', color: '#000', fontSize: '0.65rem', fontWeight: 'bold', padding: '3px 10px', borderRadius: 20 }}>QUICK SHOP</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Link to="/cart" style={{ color: '#888', fontSize: '0.8rem', textDecoration: 'none' }}>Full cart</Link>
            <button onClick={() => setShowCart(true)} style={{ background: cartCount > 0 ? '#FFD700' : '#1a2a3a', color: cartCount > 0 ? '#000' : '#555', border: 'none', borderRadius: 20, padding: '8px 20px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s' }}>
              🛒 {cartCount} · €{cartTotal.toFixed(2)}
            </button>
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '3rem 2rem 2rem', background: 'linear-gradient(180deg,#0d1520 0%,#0a0a0f 100%)' }}>
          <div style={{ fontSize: '2rem', fontWeight: '900', color: '#fff', marginBottom: '0.5rem' }}>Find the perfect gift 🎁</div>
          <div style={{ color: '#888', fontSize: '1rem' }}>All our island favourites — straight to your cart.</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '1.5rem', padding: '1.5rem 2rem', maxWidth: 1200, margin: '0 auto' }}>
          {products.map(p => {
            const col = seededColor('item-' + p.id);
            const light = seededLightColor('item-' + p.id);
            const isHov = hovered === p.id;
            return (
              <div key={p.id} onMouseEnter={() => setHovered(p.id)} onMouseLeave={() => setHovered(null)}
                style={{ background: '#0d1520', border: `2px solid ${isHov ? col : '#1a2a3a'}`, borderRadius: 16, overflow: 'hidden', transition: 'all 0.2s', boxShadow: isHov ? `0 8px 30px ${col}44` : '0 2px 8px rgba(0,0,0,0.3)', transform: isHov ? 'translateY(-4px)' : 'none' }}>
                <div style={{ height: 6, background: `linear-gradient(90deg,${col},${light})` }} />
                <div style={{ padding: '1.5rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>{p.emoji}</div>
                  <div style={{ fontWeight: '700', fontSize: '1rem', color: '#fff', marginBottom: '0.25rem' }}>{p.name}</div>
                  <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: '1rem' }}>{p.description}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '1.3rem', fontWeight: '900', color: '#FFD700' }}>€{p.price.toFixed(2)}</span>
                    <button onClick={() => addToCart(p)} style={{ background: col, color: '#000', border: 'none', borderRadius: 20, padding: '8px 18px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer' }}>+ Add</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <CartPanel open={showCart} onClose={() => setShowCart(false)} variant="modern" />
      </div>
    </PayPalScriptProvider>
  );
}
