import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';

function Home() {
  const [hovered, setHovered] = useState(false);
  const { cartCount } = useCart();

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      background: '#0a0a0f',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Press Start 2P', monospace",
      padding: '2rem',
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {cartCount > 0 && (
        <Link to="/cart" style={{
          position: 'absolute', top: '1.5rem', right: '1.5rem',
          background: '#FFD700', color: '#000', textDecoration: 'none',
          padding: '0.5rem 1rem', fontSize: '0.45rem', letterSpacing: '0.1em',
          border: '2px solid #7F77DD',
        }}>
          🛒 CART ({cartCount})
        </Link>
      )}
      <style>{`
        @keyframes floatDot  { from{transform:translateY(0)} to{transform:translateY(-14px)} }
        @keyframes titlePulse{ from{text-shadow:0 0 20px #FFD700aa} to{text-shadow:0 0 50px #FFD700ff,0 0 100px #FFD70066} }
        @keyframes cardFloat { from{transform:translateY(0)} to{transform:translateY(-8px)} }
      `}</style>

      {/* Floating background dots */}
      {[...Array(22)].map((_,i) => (
        <div key={i} style={{
          position: 'absolute',
          width: 3 + (i % 5) * 2,
          height: 3 + (i % 5) * 2,
          borderRadius: '50%',
          background: i%3===0 ? '#7F77DD22' : i%3===1 ? '#FF6EB422' : '#FFD70022',
          left: `${(i*41+7)%100}%`,
          top: `${(i*57+3)%100}%`,
          animation: `floatDot ${2+(i%4)}s ease-in-out ${i*0.25}s infinite alternate`,
        }}/>
      ))}

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>🌴</div>
        <div style={{
          fontSize: '0.5rem',
          letterSpacing: '0.3em',
          color: '#7F77DD',
          marginBottom: '1.2rem',
          textTransform: 'uppercase',
        }}>
          🎌 Plastic Particles
        </div>
        <div style={{
          fontSize: 'clamp(1rem,3vw,1.4rem)',
          color: '#FFD700',
          animation: 'titlePulse 2s ease-in-out infinite alternate',
          lineHeight: 1.6,
          marginBottom: '1.2rem',
        }}>
          THE NEW ISLAND STORE
        </div>
        <div style={{ color: '#555', fontSize: '0.5rem', letterSpacing: '0.15em', lineHeight: 2 }}>
          UNIQUE ART SUPPLIES & TOYS<br/>EVERY PRODUCT A LITTLE TREASURE
        </div>
      </div>

      {/* Enter button */}
      <Link
        to="/shop"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'inline-block',
          padding: '1rem 2rem',
          background: hovered ? '#7F77DD' : 'transparent',
          color: hovered ? '#000' : '#7F77DD',
          border: '3px solid #7F77DD',
          textDecoration: 'none',
          fontSize: '0.55rem',
          letterSpacing: '0.15em',
          transition: 'all 0.2s',
          boxShadow: hovered ? '0 0 30px #7F77DD88' : 'none',
          animation: hovered ? 'cardFloat 1s ease-in-out infinite alternate' : 'none',
        }}
      >
        {hovered ? '▶ ENTER THE SHOP!' : 'ENTER THE SHOP 🎮'}
      </Link>

      <div style={{ color: '#333', fontSize: '0.35rem', marginTop: '3rem', letterSpacing: '0.15em' }}>
        🌴 ISLAND STORE — TOYS WITH A TROPICAL TWIST
      </div>
    </div>
  );
}

export default Home;