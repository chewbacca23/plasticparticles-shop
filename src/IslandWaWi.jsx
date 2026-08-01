import React, { useState, useMemo, useEffect, useRef } from 'react';
import { INIT_PRODUCTS, INIT_CATEGORIES, INIT_ORDERS, makeZones } from './data/wawiDefaults';
import { syncWaWiToShop, loadWaWiState, saveWaWiState } from './data/productStore';

// ── Colour badge helpers ─────────────────────────────────────────────────────
const seededColor = (seed) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) { h = ((h << 5) - h) + seed.charCodeAt(i); h |= 0; }
  const hue = Math.abs(h) % 360;
  const sat = 55 + Math.abs(h >> 8) % 25;
  const light = 38 + Math.abs(h >> 16) % 18;
  return `hsl(${hue},${sat}%,${light}%)`;
};
const lightColor = (seed) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) { h = ((h << 5) - h) + seed.charCodeAt(i); h |= 0; }
  const hue = Math.abs(h) % 360;
  const sat = 45 + Math.abs(h >> 8) % 30;
  const light = 88 + Math.abs(h >> 16) % 8;
  return `hsl(${hue},${sat}%,${light}%)`;
};

// Returns the 1-based global number for a product across all worlds
const getGlobalNumber = (productId, allProducts) => {
  const sorted = [...allProducts].sort((a, b) => parseInt(a.id) - parseInt(b.id));
  const idx = sorted.findIndex(p => p.id === productId);
  return idx === -1 ? null : idx + 1;
};

// ── NumBadge — the coloured rounded cube ─────────────────────────────────────
const NumBadge = ({ num, size = 'md' }) => {
  if (!num && num !== 0) return null;
  const seed = 'item-' + num;
  const bg = seededColor(seed);
  const light = lightColor(seed);
  const s = size === 'sm'
    ? { fontSize: 9,  padding: '2px 6px',  minWidth: 22, height: 18 }
    : size === 'lg'
    ? { fontSize: 13, padding: '4px 10px', minWidth: 32, height: 28 }
    : { fontSize: 11, padding: '3px 8px',  minWidth: 26, height: 22 };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: bg, color: '#fff',
      borderRadius: 6, fontWeight: 700, fontFamily: 'var(--pixel)',
      boxShadow: `0 0 0 2px ${light}`,
      transition: 'transform 0.15s',
      cursor: 'default',
      ...s,
    }}>
{num}
    </span>
  );
};

// ── Worlds config ─────────────────────────────────────────────────────────────
const WORLDS = [
  { id: 'jungle',     name: 'Jungle World',    emoji: '🌴', color: '#1D9E75', bgColor: '#E1F5EE', maxItems: 150, desc: 'The original island paradise' },
  { id: 'planet',     name: 'Space Planet',    emoji: '🪐', color: '#7F77DD', bgColor: '#EEEDFE', maxItems: 180, desc: 'Reach for the stars' },
  { id: 'artist',     name: "Artist's Island", emoji: '🎨', color: '#D85A30', bgColor: '#FAECE7', maxItems: 200, desc: 'A masterpiece world' },
  { id: 'underwater', name: 'Underwater Cove', emoji: '🫧', color: '#0B6E99', bgColor: '#E0F4FB', maxItems: 160, desc: 'Dive for sunken toys' },
];

// ── Password Gate ─────────────────────────────────────────────────────────────
const getHash = async (str) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const PasswordGate = ({ onUnlock }) => {
  const [pw, setPw] = useState('');
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const [showPw, setShowPw] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!locked) return;
    let t = 30; setLockTimer(t);
    const iv = setInterval(() => { t--; setLockTimer(t); if (t <= 0) { setLocked(false); setAttempts(0); clearInterval(iv); } }, 1000);
    return () => clearInterval(iv);
  }, [locked]);

  const tryUnlock = async () => {
    const hash = await getHash(pw);
    const correct = await getHash('IslandBoss2026');
    if (hash === correct) { sessionStorage.setItem('wawi_auth', '1'); onUnlock(); }
    else {
      setShake(true); setPw(''); setAttempts(a => a + 1);
      setTimeout(() => setShake(false), 600);
      if (attempts + 1 >= 5) setLocked(true);
      inputRef.current?.focus();
    }
  };

  const handleKey = e => { if (e.key === 'Enter' && !locked) tryUnlock(); };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--pp2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 0 }}>
      <GlobalStyles />
      <style>{`@keyframes shakePw{0%,100%{transform:translateX(0)}20%{transform:translateX(-10px)}40%{transform:translateX(10px)}60%{transform:translateX(-8px)}80%{transform:translateX(8px)}}`}</style>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 64, marginBottom: 8, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }}>🏝️</div>
        <div style={{ fontFamily: 'var(--pixel)', fontSize: 11, color: 'var(--gd)', letterSpacing: 2, marginBottom: 6 }}>ISLANDSTORE</div>
        <div style={{ fontFamily: 'var(--pixel)', fontSize: 7, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>WARENWIRTSCHAFTSSYSTEM</div>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.06)', border: '2px solid rgba(127,119,221,0.4)', borderRadius: 16, padding: '32px 36px', width: 340, backdropFilter: 'blur(10px)', animation: shake ? 'shakePw 0.5s ease' : 'none' }}>
        <div style={{ fontFamily: 'var(--pixel)', fontSize: 8, color: '#fff', marginBottom: 20, textAlign: 'center' }}>🔐 RESTRICTED ACCESS</div>
        {locked ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
            <div style={{ fontFamily: 'var(--pixel)', fontSize: 7, color: 'var(--co)', marginBottom: 8 }}>TOO MANY ATTEMPTS</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Try again in <strong style={{ color: 'var(--gd)' }}>{lockTimer}s</strong></div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8, fontWeight: 500 }}>Password</div>
              <div style={{ position: 'relative' }}>
                <input ref={inputRef} type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} onKeyDown={handleKey} placeholder="Enter password..." style={{ width: '100%', padding: '10px 40px 10px 12px', border: '1px solid rgba(127,119,221,0.5)', borderRadius: 8, fontSize: 14, background: 'rgba(255,255,255,0.08)', color: '#fff', outline: 'none', fontFamily: 'var(--body)' }} />
                <button onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'rgba(255,255,255,0.4)' }}>{showPw ? '🙈' : '👁️'}</button>
              </div>
            </div>
            {attempts > 0 && attempts < 5 && <div style={{ fontSize: 11, color: 'var(--co)', marginBottom: 12, textAlign: 'center' }}>❌ Wrong password · {5 - attempts} attempt(s) left</div>}
            <button onClick={tryUnlock} style={{ width: '100%', padding: '11px', background: 'var(--pp)', border: 'none', borderRadius: 8, fontFamily: 'var(--pixel)', fontSize: 8, color: '#fff', cursor: 'pointer', letterSpacing: 1 }}>ENTER THE ISLAND →</button>
          </>
        )}
      </div>
      <div style={{ marginTop: 24, fontFamily: 'var(--pixel)', fontSize: 6, color: 'rgba(255,255,255,0.2)', textAlign: 'center', lineHeight: 2 }}>AUTHORIZED PERSONNEL ONLY<br />© ISLANDSTORE WAWI</div>
    </div>
  );
};

// ── Global Styles ─────────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --pp:#7F77DD; --pp2:#26215C; --pp3:#EEEDFE; --pp4:#534AB7;
      --tl:#1D9E75; --tl2:#04342C; --tl3:#E1F5EE;
      --co:#D85A30; --co2:#4A1B0C; --co3:#FAECE7;
      --am:#BA7517; --am3:#FAEEDA; --gd:#FFD700;
      --pixel:'Press Start 2P',monospace; --body:'DM Sans',sans-serif;
      --surface:#fff; --bg:#f5f3ff; --border:rgba(38,33,92,0.12);
      --text:#1a1a2e; --muted:#6b6896;
    }
    body { font-family: var(--body); background: var(--bg); color: var(--text); }
    button { font-family: var(--body); cursor: pointer; }
    input, select, textarea { font-family: var(--body); }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: var(--pp3); }
    ::-webkit-scrollbar-thumb { background: var(--pp); border-radius: 3px; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
    @keyframes slideIn { from{transform:translateY(-8px);opacity:0} to{transform:translateY(0);opacity:1} }
    @keyframes pop { 0%{transform:scale(0.8);opacity:0} 60%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
    @keyframes rocketFly { 0%{transform:translate(-80px,80px) scale(0.5);opacity:0} 40%{opacity:1} 100%{transform:translate(80px,-80px) scale(1.4);opacity:0} }
  `}</style>
);

// ── Sync to Shop ──────────────────────────────────────────────────────────────
const handleSyncToShop = (products, zones) => {
  const catalog = syncWaWiToShop(products, zones);
  const count = catalog.quickShopProducts.length;
  alert(`✅ Shop updated!\n\n${count} active product(s) synced.\nOpen /shop to see changes instantly.`);
};

// ── Tiny UI helpers ───────────────────────────────────────────────────────────
const Badge = ({ children, color = 'purple' }) => {
  const colors = { purple:{bg:'#EEEDFE',text:'#26215C'}, green:{bg:'#E1F5EE',text:'#04342C'}, orange:{bg:'#FAECE7',text:'#4A1B0C'}, amber:{bg:'#FAEEDA',text:'#633806'}, red:{bg:'#FCEBEB',text:'#501313'}, gray:{bg:'#F1EFE8',text:'#2C2C2A'} };
  const c = colors[color] || colors.purple;
  return <span style={{ display:'inline-block', padding:'3px 9px', borderRadius:20, fontSize:10, fontWeight:600, background:c.bg, color:c.text }}>{children}</span>;
};

const Btn = ({ children, onClick, variant = 'primary', size = 'md', style: s = {} }) => {
  const variants = { primary:{background:'var(--pp)',color:'#fff',border:'none'}, ghost:{background:'transparent',color:'var(--text)',border:'1px solid var(--border)'}, danger:{background:'var(--co3)',color:'var(--co2)',border:'none'}, success:{background:'var(--tl3)',color:'var(--tl2)',border:'none'}, dark:{background:'var(--pp2)',color:'#fff',border:'none'} };
  const sizes = { sm:{padding:'4px 10px',fontSize:11}, md:{padding:'8px 16px',fontSize:13}, lg:{padding:'11px 22px',fontSize:14} };
  return <button onClick={onClick} style={{...variants[variant],...sizes[size],borderRadius:6,fontWeight:500,transition:'all 0.15s',...s}}>{children}</button>;
};

const StockBar = ({ stock, minStock }) => {
  const max = Math.max(minStock * 4, 20);
  const pct = Math.min(100, Math.round(stock / max * 100));
  const col = stock <= minStock ? 'var(--co)' : stock <= minStock * 2 ? 'var(--am)' : 'var(--tl)';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ width:72, height:6, borderRadius:3, background:'var(--pp3)', overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:col, borderRadius:3, transition:'width 0.3s' }} />
      </div>
      <span style={{ fontSize:12, fontWeight:500 }}>{stock}</span>
    </div>
  );
};

const Card = ({ children, style: s = {} }) => (
  <div style={{ background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', overflow:'hidden', ...s }}>{children}</div>
);

const Modal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position:'fixed', inset:0, background:'rgba(38,33,92,0.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'var(--surface)', border:'3px solid var(--pp)', borderRadius:12, padding:24, width:460, maxHeight:'85vh', overflowY:'auto', animation:'pop 0.2s ease' }}>
        <div style={{ fontFamily:'var(--pixel)', fontSize:9, color:'var(--pp2)', marginBottom:18, paddingBottom:12, borderBottom:'1px solid var(--border)' }}>{title}</div>
        {children}
      </div>
    </div>
  );
};

const FormField = ({ label, children }) => (
  <div style={{ marginBottom:14 }}>
    <label style={{ display:'block', fontSize:12, color:'var(--muted)', marginBottom:5, fontWeight:500 }}>{label}</label>
    {children}
  </div>
);

const Input = ({ ...props }) => (
  <input {...props} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:6, fontSize:13, color:'var(--text)', background:'var(--surface)', outline:'none', ...props.style }} />
);

const Select = ({ children, ...props }) => (
  <select {...props} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:6, fontSize:13, color:'var(--text)', background:'var(--surface)', outline:'none', ...props.style }}>
    {children}
  </select>
);

// ── Topbar ────────────────────────────────────────────────────────────────────
const Topbar = ({ onSync, onLogout }) => (
  <div style={{ gridColumn:'1/-1', background:'var(--pp2)', display:'flex', alignItems:'center', gap:14, padding:'0 20px', borderBottom:'3px solid var(--pp)', height:56 }}>
    <div style={{ fontFamily:'var(--pixel)', fontSize:9, color:'#fff', letterSpacing:1 }}>🏝️ ISLAND<span style={{ color:'var(--gd)' }}>STORE</span> WaWi</div>
    <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
      <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--tl)', display:'inline-block', animation:'pulse 2s infinite' }} />
      <span style={{ fontFamily:'var(--pixel)', fontSize:6, color:'rgba(255,255,255,0.6)' }}>LIVE SYNC READY</span>
    </div>
    <Btn onClick={onSync} variant='success' size='sm'>⬆ SYNC TO SHOP</Btn>
    <button onClick={onLogout} title="Lock WaWi" style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:6, color:'rgba(255,255,255,0.6)', padding:'6px 10px', cursor:'pointer', fontSize:14, lineHeight:1 }}>🔒</button>
  </div>
);

// ── Sidebar ───────────────────────────────────────────────────────────────────
const NAV = [
  { id:'dashboard', icon:'📊', label:'Dashboard',    section:'MAIN' },
  { id:'products',  icon:'🧸', label:'Products' },
  { id:'categories',icon:'🗂️', label:'Categories' },
  { id:'stock',     icon:'📦', label:'Stock',         section:'OPERATIONS' },
  { id:'orders',    icon:'🛒', label:'Orders' },
  { id:'zones',     icon:'🗺️', label:'Zone Manager',  section:'ISLAND SHOP' },
  { id:'worlds',    icon:'🌍', label:'Worlds',         section:'UNIVERSE' },
  { id:'analytics', icon:'📈', label:'Analytics' },
];

const Sidebar = ({ active, setActive }) => (
  <div style={{ background:'var(--pp2)', borderRight:'3px solid var(--pp)', display:'flex', flexDirection:'column', gap:2, padding:'10px 0', overflowY:'auto' }}>
    {NAV.map(n => (
      <React.Fragment key={n.id}>
        {n.section && <div style={{ fontFamily:'var(--pixel)', fontSize:6, color:'rgba(255,255,255,0.3)', padding:'12px 16px 4px', letterSpacing:1 }}>{n.section}</div>}
        <div onClick={() => setActive(n.id)} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', cursor:'pointer', fontSize:13, color:active===n.id?'#fff':'rgba(255,255,255,0.55)', borderLeft:`3px solid ${active===n.id?'var(--pp)':'transparent'}`, background:active===n.id?'rgba(127,119,221,0.25)':'transparent', transition:'all 0.15s' }}>
          <span style={{ fontSize:16, width:20, textAlign:'center' }}>{n.icon}</span>
          {n.label}
        </div>
      </React.Fragment>
    ))}
  </div>
);

// ── Dashboard ─────────────────────────────────────────────────────────────────
const Dashboard = ({ products, orders }) => {
  const lowStock = products.filter(p => p.stock <= p.minStock);
  const todayOrders = orders.filter(o => o.date === '2026-04-28');
  const todayRevenue = todayOrders.reduce((s, o) => s + o.total, 0);
  const top4 = [...products].sort((a, b) => b.sales - a.sales).slice(0, 4);

  const StatCard = ({ label, value, sub, color = 'var(--pp2)' }) => (
    <Card style={{ padding:16 }}>
      <div style={{ fontSize:11, color:'var(--muted)', marginBottom:6 }}>{label}</div>
      <div style={{ fontFamily:'var(--pixel)', fontSize:16, color, marginBottom:4 }}>{value}</div>
      <div style={{ fontSize:11, color:'var(--muted)' }}>{sub}</div>
    </Card>
  );

  return (
    <div style={{ animation:'slideIn 0.2s ease' }}>
      <div style={{ fontFamily:'var(--pixel)', fontSize:10, color:'var(--pp2)', marginBottom:20, paddingBottom:10, borderBottom:'2px solid var(--pp3)' }}>📊 DASHBOARD</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Total Products"  value={products.length}    sub="across all worlds" />
        <StatCard label="Orders Today"    value={todayOrders.length} sub={`€${todayRevenue.toFixed(2)} revenue`} color='var(--tl)' />
        <StatCard label="Low Stock Items" value={lowStock.length}    sub="need reorder"       color={lowStock.length>0?'var(--co)':'var(--tl)'} />
        <StatCard label="Universe Worlds" value="3"                  sub="530 item slots total" color='var(--am)' />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        <Card>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontFamily:'var(--pixel)', fontSize:7, color:'var(--pp2)' }}>🔥 TOP SELLERS</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr>{['#','Product','Sales','Revenue'].map(h => <th key={h} style={{ padding:'8px 16px', textAlign:'left', fontSize:11, color:'var(--muted)', fontWeight:500, borderBottom:'1px solid var(--border)', background:'#fafafa' }}>{h}</th>)}</tr></thead>
            <tbody>{top4.map(p => {
              const num = getGlobalNumber(p.id, products);
              return (
                <tr key={p.id}>
                  <td style={{ padding:'8px 16px' }}><NumBadge num={num} size='sm' /></td>
                  <td style={{ padding:'8px 16px' }}>{p.emoji} {p.name}</td>
                  <td style={{ padding:'8px 16px' }}>{p.sales}</td>
                  <td style={{ padding:'8px 16px', color:'var(--tl)', fontWeight:600 }}>€{(p.sales*p.price).toFixed(2)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </Card>
        <Card>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontFamily:'var(--pixel)', fontSize:7, color:'var(--pp2)' }}>⚠️ LOW STOCK</div>
          {lowStock.length === 0
            ? <div style={{ padding:20, fontSize:12, color:'var(--muted)' }}>✅ All products have healthy stock levels!</div>
            : <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead><tr>{['#','Product','Stock'].map((h,i) => <th key={i} style={{ padding:'8px 16px', textAlign:'left', fontSize:11, color:'var(--muted)', fontWeight:500, borderBottom:'1px solid var(--border)', background:'#fafafa' }}>{h}</th>)}</tr></thead>
                <tbody>{lowStock.map(p => {
                  const num = getGlobalNumber(p.id, products);
                  return (
                    <tr key={p.id}>
                      <td style={{ padding:'8px 16px' }}><NumBadge num={num} size='sm' /></td>
                      <td style={{ padding:'8px 16px' }}>{p.emoji} {p.name}</td>
                      <td style={{ padding:'8px 16px' }}><Badge color='orange'>{p.stock} left</Badge></td>
                    </tr>
                  );
                })}</tbody>
              </table>
          }
        </Card>
      </div>
      <Card>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontFamily:'var(--pixel)', fontSize:7, color:'var(--pp2)' }}>📅 RECENT ORDERS</div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr>{['Order ID','Customer','Items','Total','Status'].map(h => <th key={h} style={{ padding:'8px 16px', textAlign:'left', fontSize:11, color:'var(--muted)', fontWeight:500, borderBottom:'1px solid var(--border)', background:'#fafafa' }}>{h}</th>)}</tr></thead>
          <tbody>{orders.slice(0,5).map(o => (
            <tr key={o.id} style={{ borderBottom:'1px solid var(--border)' }}>
              <td style={{ padding:'8px 16px', fontFamily:'var(--pixel)', fontSize:7, color:'var(--pp2)' }}>{o.id}</td>
              <td style={{ padding:'8px 16px' }}>{o.customer}</td>
              <td style={{ padding:'8px 16px', color:'var(--muted)' }}>{o.items.length} item(s)</td>
              <td style={{ padding:'8px 16px', fontWeight:600 }}>€{o.total.toFixed(2)}</td>
              <td style={{ padding:'8px 16px' }}><Badge color={o.status==='delivered'?'green':o.status==='shipped'?'purple':'amber'}>{o.status}</Badge></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  );
};

// ── Products ──────────────────────────────────────────────────────────────────
const emptyProduct = { name:'', price:'', emoji:'', desc:'', cat:'', stock:10, minStock:3, sku:'', worldId:'jungle' };

const Products = ({ products, setProducts, categories }) => {
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterWorld, setFilterWorld] = useState('all');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProduct);

  const cats = ['all', ...new Set(products.map(p => p.cat))];
  const filtered = useMemo(() => products.filter(p => {
    const s = p.name.toLowerCase().includes(search.toLowerCase()) || p.desc.toLowerCase().includes(search.toLowerCase());
    const c = filterCat === 'all' || p.cat === filterCat;
    const w = filterWorld === 'all' || p.worldId === filterWorld;
    return s && c && w;
  }), [products, search, filterCat, filterWorld]);

  const openAdd = () => { setEditing('new'); setForm({...emptyProduct, cat:categories[0]?.name||''}); };
  const openEdit = p => { setEditing(p.id); setForm({...p, price:String(p.price), stock:String(p.stock), minStock:String(p.minStock)}); };
  const save = () => {
    if (!form.name) return;
    const p = {...form, price:parseFloat(form.price)||0, stock:parseInt(form.stock)||0, minStock:parseInt(form.minStock)||3};
    if (editing === 'new') setProducts(prev => [...prev, {...p, id:Date.now().toString(), sales:0, active:true}]);
    else setProducts(prev => prev.map(x => x.id===editing ? {...x,...p} : x));
    setEditing(null);
  };
  const del = id => { if (window.confirm('Delete this product?')) setProducts(prev => prev.filter(p => p.id !== id)); };

  return (
    <div style={{ animation:'slideIn 0.2s ease' }}>
      <div style={{ fontFamily:'var(--pixel)', fontSize:10, color:'var(--pp2)', marginBottom:20, paddingBottom:10, borderBottom:'2px solid var(--pp3)' }}>🧸 PRODUCTS</div>
      <div style={{ display:'flex', gap:10, marginBottom:14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." style={{ flex:1, padding:'8px 12px', border:'1px solid var(--border)', borderRadius:6, fontSize:13, color:'var(--text)', background:'var(--surface)', outline:'none' }} />
        <select value={filterWorld} onChange={e => setFilterWorld(e.target.value)} style={{ padding:'8px 12px', border:'1px solid var(--border)', borderRadius:6, fontSize:13, color:'var(--text)', background:'var(--surface)', outline:'none' }}>
          <option value='all'>All Worlds</option>
          {WORLDS.map(w => <option key={w.id} value={w.id}>{w.emoji} {w.name}</option>)}
        </select>
        <Btn onClick={openAdd}>+ Add Product</Btn>
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
        {cats.map(c => <button key={c} onClick={() => setFilterCat(c)} style={{ padding:'4px 12px', borderRadius:20, fontSize:11, cursor:'pointer', border:`1px solid ${filterCat===c?'var(--pp)':'var(--border)'}`, background:filterCat===c?'var(--pp)':'transparent', color:filterCat===c?'#fff':'var(--muted)', transition:'all 0.15s' }}>{c==='all'?'All':c}</button>)}
      </div>
      <Card>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr>{['#','Product','World','Category','Price','Stock','Status','Actions'].map(h => <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, color:'var(--muted)', fontWeight:500, borderBottom:'1px solid var(--border)', background:'#fafafa' }}>{h}</th>)}</tr></thead>
          <tbody>{filtered.map(p => {
            const num = getGlobalNumber(p.id, products);
            const world = WORLDS.find(w => w.id === p.worldId);
            return (
              <tr key={p.id} style={{ borderBottom:'1px solid var(--border)' }}>
                <td style={{ padding:'10px 16px' }}><NumBadge num={num} /></td>
                <td style={{ padding:'10px 16px' }}><span style={{ fontSize:20, marginRight:8 }}>{p.emoji}</span><strong>{p.name}</strong><br /><span style={{ fontSize:11, color:'var(--muted)' }}>{p.sku}</span></td>
                <td style={{ padding:'10px 16px', fontSize:12 }}>{world ? `${world.emoji} ${world.name}` : '—'}</td>
                <td style={{ padding:'10px 16px' }}><Badge>{p.cat}</Badge></td>
                <td style={{ padding:'10px 16px', fontWeight:600 }}>€{p.price.toFixed(2)}</td>
                <td style={{ padding:'10px 16px' }}><StockBar stock={p.stock} minStock={p.minStock} /></td>
                <td style={{ padding:'10px 16px' }}>{p.stock<=p.minStock?<Badge color='orange'>Low Stock</Badge>:<Badge color='green'>OK</Badge>}</td>
                <td style={{ padding:'10px 16px', display:'flex', gap:6 }}>
                  <Btn onClick={() => openEdit(p)} variant='ghost' size='sm'>Edit</Btn>
                  <Btn onClick={() => del(p.id)} variant='danger' size='sm'>Del</Btn>
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </Card>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing==='new'?'ADD PRODUCT':'EDIT PRODUCT'}>
        <FormField label="Product Name"><Input value={form.name} onChange={e => setForm(f => ({...f,name:e.target.value}))} placeholder="e.g. Dino Figure Pack" /></FormField>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <FormField label="Price (€)"><Input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({...f,price:e.target.value}))} placeholder="9.99" /></FormField>
          <FormField label="Emoji"><Input value={form.emoji} onChange={e => setForm(f => ({...f,emoji:e.target.value}))} placeholder="🦕" maxLength={2} /></FormField>
        </div>
        <FormField label="Description"><Input value={form.desc} onChange={e => setForm(f => ({...f,desc:e.target.value}))} placeholder="Short description" /></FormField>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <FormField label="World">
            <Select value={form.worldId} onChange={e => setForm(f => ({...f,worldId:e.target.value}))}>
              {WORLDS.map(w => <option key={w.id} value={w.id}>{w.emoji} {w.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Category">
            <Select value={form.cat} onChange={e => setForm(f => ({...f,cat:e.target.value}))}>
              {categories.map(c => <option key={c.id}>{c.name}</option>)}
            </Select>
          </FormField>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <FormField label="Stock Qty"><Input type="number" value={form.stock} onChange={e => setForm(f => ({...f,stock:e.target.value}))} /></FormField>
          <FormField label="Min Stock Alert"><Input type="number" value={form.minStock} onChange={e => setForm(f => ({...f,minStock:e.target.value}))} /></FormField>
        </div>
        <FormField label="SKU"><Input value={form.sku} onChange={e => setForm(f => ({...f,sku:e.target.value}))} placeholder="TOY-001" /></FormField>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
          <Btn onClick={() => setEditing(null)} variant='ghost'>Cancel</Btn>
          <Btn onClick={save}>Save Product</Btn>
        </div>
      </Modal>
    </div>
  );
};

// ── Categories ────────────────────────────────────────────────────────────────
const Categories = ({ categories, setCategories, products }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({name:'', emoji:''});
  const save = () => { if (!form.name) return; setCategories(prev => [...prev, {id:'c'+Date.now(),...form,emoji:form.emoji||'📦'}]); setOpen(false); setForm({name:'',emoji:''}); };
  const del = id => setCategories(prev => prev.filter(c => c.id !== id));
  return (
    <div style={{ animation:'slideIn 0.2s ease' }}>
      <div style={{ fontFamily:'var(--pixel)', fontSize:10, color:'var(--pp2)', marginBottom:20, paddingBottom:10, borderBottom:'2px solid var(--pp3)' }}>🗂️ CATEGORIES</div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}><Btn onClick={() => setOpen(true)}>+ Add Category</Btn></div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12 }}>
        {categories.map(c => {
          const count = products.filter(p => p.cat === c.name).length;
          return (
            <Card key={c.id} style={{ padding:20, textAlign:'center' }}>
              <div style={{ fontSize:36, marginBottom:8 }}>{c.emoji}</div>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>{c.name}</div>
              <div style={{ fontSize:11, color:'var(--muted)', marginBottom:12 }}>{count} product(s)</div>
              <Btn onClick={() => del(c.id)} variant='danger' size='sm'>Remove</Btn>
            </Card>
          );
        })}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="ADD CATEGORY">
        <FormField label="Category Name"><Input value={form.name} onChange={e => setForm(f => ({...f,name:e.target.value}))} placeholder="e.g. Puzzles" /></FormField>
        <FormField label="Emoji"><Input value={form.emoji} onChange={e => setForm(f => ({...f,emoji:e.target.value}))} placeholder="🧩" maxLength={2} /></FormField>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
          <Btn onClick={() => setOpen(false)} variant='ghost'>Cancel</Btn>
          <Btn onClick={save}>Save</Btn>
        </div>
      </Modal>
    </div>
  );
};

// ── Stock ─────────────────────────────────────────────────────────────────────
const Stock = ({ products, setProducts }) => {
  const adj = (id, delta) => setProducts(prev => prev.map(p => p.id===id ? {...p,stock:Math.max(0,p.stock+delta)} : p));
  return (
    <div style={{ animation:'slideIn 0.2s ease' }}>
      <div style={{ fontFamily:'var(--pixel)', fontSize:10, color:'var(--pp2)', marginBottom:20, paddingBottom:10, borderBottom:'2px solid var(--pp3)' }}>📦 STOCK MANAGEMENT</div>
      {products.filter(p => p.stock <= p.minStock).length > 0 && (
        <div style={{ background:'var(--co3)', border:'1px solid var(--co)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'var(--co2)', marginBottom:16 }}>
          ⚠️ {products.filter(p => p.stock <= p.minStock).length} product(s) are below minimum stock level!
        </div>
      )}
      <Card>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr>{['#','Product','World','Current Stock','Level','Min Stock','Adjust'].map(h => <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, color:'var(--muted)', fontWeight:500, borderBottom:'1px solid var(--border)', background:'#fafafa' }}>{h}</th>)}</tr></thead>
          <tbody>{products.map(p => {
            const num = getGlobalNumber(p.id, products);
            const world = WORLDS.find(w => w.id === p.worldId);
            return (
              <tr key={p.id} style={{ borderBottom:'1px solid var(--border)', background:p.stock<=p.minStock?'rgba(216,90,48,0.04)':'transparent' }}>
                <td style={{ padding:'10px 16px' }}><NumBadge num={num} size='sm' /></td>
                <td style={{ padding:'10px 16px' }}><span style={{ fontSize:18, marginRight:8 }}>{p.emoji}</span>{p.name}</td>
                <td style={{ padding:'10px 16px', fontSize:12 }}>{world ? `${world.emoji} ${world.name}` : '—'}</td>
                <td style={{ padding:'10px 16px', fontFamily:'var(--pixel)', fontSize:12, color:p.stock<=p.minStock?'var(--co)':'var(--text)' }}>{p.stock}</td>
                <td style={{ padding:'10px 16px' }}><StockBar stock={p.stock} minStock={p.minStock} /></td>
                <td style={{ padding:'10px 16px', color:'var(--muted)' }}>{p.minStock}</td>
                <td style={{ padding:'10px 16px', display:'flex', gap:6, flexWrap:'wrap' }}>
                  <Btn onClick={() => adj(p.id,-1)} variant='ghost' size='sm'>−1</Btn>
                  <Btn onClick={() => adj(p.id, 1)} variant='ghost' size='sm'>+1</Btn>
                  <Btn onClick={() => adj(p.id,10)} variant='success' size='sm'>+10</Btn>
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </Card>
    </div>
  );
};

// ── Orders ────────────────────────────────────────────────────────────────────
const Orders = ({ orders, setOrders }) => {
  const [filter, setFilter] = useState('');
  const filtered = filter ? orders.filter(o => o.status === filter) : orders;
  const changeStatus = (id, status) => setOrders(prev => prev.map(o => o.id===id ? {...o,status} : o));
  return (
    <div style={{ animation:'slideIn 0.2s ease' }}>
      <div style={{ fontFamily:'var(--pixel)', fontSize:10, color:'var(--pp2)', marginBottom:20, paddingBottom:10, borderBottom:'2px solid var(--pp3)' }}>🛒 ORDERS</div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
        <Select value={filter} onChange={e => setFilter(e.target.value)} style={{ width:160 }}>
          <option value="">All Status</option>
          <option>pending</option><option>shipped</option><option>delivered</option>
        </Select>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        {filtered.map(o => (
          <Card key={o.id} style={{ padding:16 }}>
            <div style={{ fontFamily:'var(--pixel)', fontSize:7, color:'var(--pp2)', marginBottom:6 }}>{o.id}</div>
            <div style={{ fontSize:12, color:'var(--muted)', marginBottom:10 }}>{o.customer} · {o.date}</div>
            <div style={{ fontSize:12, lineHeight:1.8, marginBottom:10, color:'var(--text)' }}>
              {o.items.map((i,idx) => <div key={idx}>{i.qty}× {i.name} — €{(i.price*i.qty).toFixed(2)}</div>)}
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8, paddingTop:8, borderTop:'1px solid var(--border)' }}>
              <div style={{ fontSize:15, fontWeight:600 }}>€{o.total.toFixed(2)}</div>
              <Select value={o.status} onChange={e => changeStatus(o.id, e.target.value)} style={{ width:130, padding:'4px 8px', fontSize:11 }}>
                <option>pending</option><option>shipped</option><option>delivered</option>
              </Select>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ── Zone Manager ──────────────────────────────────────────────────────────────
const ZoneManager = ({ zones, setZones, products }) => {
  const [zoneModal, setZoneModal] = useState(null);
  const [selProduct, setSelProduct] = useState('');
  const openZone = zone => { setZoneModal(zone); setSelProduct(zone.productId || ''); };
  const assign = () => {
    setZones(prev => {
      const next = {...prev};
      next[zoneModal.type] = next[zoneModal.type].map(z => z.id===zoneModal.id ? {...z, productId:selProduct||null} : z);
      return next;
    });
    setZoneModal(null);
  };

  const ZoneSection = ({ title, zoneList }) => (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontFamily:'var(--pixel)', fontSize:7, color:'var(--pp2)', marginBottom:10 }}>{title}</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))', gap:8 }}>
        {zoneList.map(z => {
          const prod = products.find(p => p.id === z.productId);
          const num = prod ? getGlobalNumber(prod.id, products) : null;
          return (
            <div key={z.id} onClick={() => openZone(z)} style={{ background:prod?'var(--tl3)':'var(--surface)', border:`1px ${prod?'solid':'dashed'} ${prod?'var(--tl)':'var(--border)'}`, borderRadius:8, padding:10, textAlign:'center', cursor:'pointer', transition:'all 0.15s' }}>
              <div style={{ fontFamily:'var(--pixel)', fontSize:6, color:'var(--muted)', marginBottom:6 }}>{z.type.toUpperCase()} #{z.num}</div>
              {prod ? (
                <>
                  <div style={{ display:'flex', justifyContent:'center', marginBottom:4 }}><NumBadge num={num} size='sm' /></div>
                  <div style={{ fontSize:20 }}>{prod.emoji}</div>
                  <div style={{ fontSize:9, color:'var(--tl2)', marginTop:2, lineHeight:1.3 }}>{prod.name}</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize:20, opacity:0.3 }}>＋</div>
                  <div style={{ fontSize:9, color:'var(--muted)' }}>Empty</div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ animation:'slideIn 0.2s ease' }}>
      <div style={{ fontFamily:'var(--pixel)', fontSize:10, color:'var(--pp2)', marginBottom:20, paddingBottom:10, borderBottom:'2px solid var(--pp3)' }}>🗺️ ZONE MANAGER</div>
      <div style={{ background:'var(--tl3)', border:'1px solid var(--tl)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'var(--tl2)', marginBottom:18 }}>
        🏝️ Click any zone to assign or change a product. Changes sync to your Island Shop!
      </div>
      <ZoneSection title="🧱 WALL ZONES (21)"   zoneList={zones.wall} />
      <ZoneSection title="🔮 PYRAMID ZONES (7)"  zoneList={zones.pyramid} />
      <ZoneSection title="⭐ HERO CIRCLES (3)"   zoneList={zones.circle} />
      <Modal open={!!zoneModal} onClose={() => setZoneModal(null)} title={`ASSIGN ${zoneModal?.type?.toUpperCase()} ZONE #${zoneModal?.num}`}>
        <FormField label="Select Product">
          <Select value={selProduct} onChange={e => setSelProduct(e.target.value)}>
            <option value="">— Empty —</option>
            {products.map(p => {
              const num = getGlobalNumber(p.id, products);
              return <option key={p.id} value={p.id}>#{num} {p.emoji} {p.name}</option>;
            })}
          </Select>
        </FormField>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
          <Btn onClick={() => setZoneModal(null)} variant='ghost'>Cancel</Btn>
          <Btn onClick={() => { setSelProduct(''); assign(); }} variant='danger' size='sm'>Clear Zone</Btn>
          <Btn onClick={assign}>Assign</Btn>
        </div>
      </Modal>
    </div>
  );
};

// ── Worlds Page ───────────────────────────────────────────────────────────────
const WorldsPage = ({ products }) => {
  const [activeWorld, setActiveWorld] = useState('jungle');
  const [showRocket, setShowRocket] = useState(false);

  const world = WORLDS.find(w => w.id === activeWorld);
  const worldProducts = products.filter(p => p.worldId === activeWorld);

  const switchWorld = (id) => {
    if (id === activeWorld) return;
    setShowRocket(true);
    setTimeout(() => { setActiveWorld(id); setShowRocket(false); }, 700);
  };

  return (
    <div style={{ animation:'slideIn 0.2s ease' }}>
      <div style={{ fontFamily:'var(--pixel)', fontSize:10, color:'var(--pp2)', marginBottom:20, paddingBottom:10, borderBottom:'2px solid var(--pp3)' }}>🌍 UNIVERSE — WORLDS</div>

      {/* World selector cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
        {WORLDS.map((w, wi) => {
          const wProds = products.filter(p => p.worldId === w.id);
          const globalStart = WORLDS.slice(0, wi).reduce((s, pw) => s + products.filter(p => p.worldId === pw.id).length, 0) + 1;
          const globalEnd = globalStart + wProds.length - 1;
          const isActive = activeWorld === w.id;
          return (
            <div key={w.id} onClick={() => switchWorld(w.id)} style={{ background:isActive?w.bgColor:'var(--surface)', border:`2px solid ${isActive?w.color:'var(--border)'}`, borderRadius:12, padding:20, cursor:'pointer', transition:'all 0.2s', position:'relative', overflow:'hidden' }}>
              <div style={{ fontSize:36, marginBottom:8 }}>{w.emoji}</div>
              <div style={{ fontFamily:'var(--pixel)', fontSize:8, color:isActive?w.color:'var(--pp2)', marginBottom:4 }}>{w.name}</div>
              <div style={{ fontSize:11, color:'var(--muted)', marginBottom:12 }}>{w.desc}</div>
              <div style={{ fontSize:11, fontWeight:600, color:w.color, marginBottom:4 }}>{wProds.length}/{w.maxItems} items</div>
              {wProds.length > 0 && <div style={{ fontSize:11, color:'var(--muted)' }}>Global #{globalStart}–#{globalEnd}</div>}
              <div style={{ position:'absolute', bottom:0, left:0, right:0, height:3, background:w.color, opacity:0.4, transform:`scaleX(${wProds.length/w.maxItems})`, transformOrigin:'left', transition:'transform 0.5s' }} />
            </div>
          );
        })}
      </div>

      {/* Rocket animation */}
      {showRocket && (
        <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontSize:64, animation:'rocketFly 0.7s ease-in-out forwards' }}>🚀</div>
        </div>
      )}

      {/* Active world items */}
      <div style={{ background:world.bgColor, border:`1px solid ${world.color}`, borderRadius:12, padding:20, marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <span style={{ fontSize:32 }}>{world.emoji}</span>
          <div>
            <div style={{ fontFamily:'var(--pixel)', fontSize:9, color:world.color }}>{world.name}</div>
            <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>{worldProducts.length} items · max {world.maxItems} · {world.maxItems - worldProducts.length} slots remaining</div>
          </div>
        </div>
        {worldProducts.length === 0
          ? <div style={{ textAlign:'center', padding:'30px 0', color:'var(--muted)', fontSize:13 }}>No items in this world yet. Add products and assign them here!</div>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:10 }}>
              {worldProducts.map(p => {
                const num = getGlobalNumber(p.id, products);
                return (
                  <div key={p.id} style={{ background:'rgba(255,255,255,0.7)', borderRadius:10, padding:12, textAlign:'center', border:'1px solid rgba(255,255,255,0.9)' }}>
                    <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}><NumBadge num={num} /></div>
                    <div style={{ fontSize:28, marginBottom:4 }}>{p.emoji}</div>
                    <div style={{ fontSize:11, fontWeight:600, color:'var(--text)', lineHeight:1.3 }}>{p.name}</div>
                    <div style={{ fontSize:10, color:'var(--muted)', marginTop:4 }}>€{p.price.toFixed(2)}</div>
                  </div>
                );
              })}
            </div>
        }
      </div>

      {/* Universe overview — all badges */}
      <Card style={{ padding:16 }}>
        <div style={{ fontFamily:'var(--pixel)', fontSize:7, color:'var(--pp2)', marginBottom:14 }}>🌌 UNIVERSE OVERVIEW — ALL ITEMS</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {[...products].sort((a,b) => parseInt(a.id)-parseInt(b.id)).map(p => {
            const num = getGlobalNumber(p.id, products);
            const w = WORLDS.find(wd => wd.id === p.worldId);
            return (
              <div key={p.id} title={`${p.name} — ${w?.name}`} style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                <NumBadge num={num} size='sm' />
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

// ── Analytics ─────────────────────────────────────────────────────────────────
const Analytics = ({ products, orders, categories }) => {
  const catData = categories.map(c => ({ name:c.name, emoji:c.emoji, rev:products.filter(p=>p.cat===c.name).reduce((s,p)=>s+p.sales*p.price,0) }));
  const maxRev = Math.max(...catData.map(c => c.rev), 1);
  const weekData = [{day:'Mon',sales:4},{day:'Tue',sales:7},{day:'Wed',sales:5},{day:'Thu',sales:9},{day:'Fri',sales:12},{day:'Sat',sales:18},{day:'Sun',sales:14}];
  const maxSales = Math.max(...weekData.map(d => d.sales), 1);
  const totalRevenue = products.reduce((s,p) => s + p.sales * p.price, 0);
  const totalSales = products.reduce((s,p) => s + p.sales, 0);

  return (
    <div style={{ animation:'slideIn 0.2s ease' }}>
      <div style={{ fontFamily:'var(--pixel)', fontSize:10, color:'var(--pp2)', marginBottom:20, paddingBottom:10, borderBottom:'2px solid var(--pp3)' }}>📈 ANALYTICS</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[
          {l:'Total Revenue',    v:`€${totalRevenue.toFixed(0)}`,  c:'var(--tl)'},
          {l:'Total Units Sold', v:totalSales,                      c:'var(--pp)'},
          {l:'Avg Order Value',  v:`€${(orders.reduce((s,o)=>s+o.total,0)/Math.max(orders.length,1)).toFixed(2)}`, c:'var(--am)'},
        ].map(s => (
          <Card key={s.l} style={{ padding:16 }}>
            <div style={{ fontSize:11, color:'var(--muted)', marginBottom:6 }}>{s.l}</div>
            <div style={{ fontFamily:'var(--pixel)', fontSize:16, color:s.c }}>{s.v}</div>
          </Card>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        <Card style={{ padding:16 }}>
          <div style={{ fontFamily:'var(--pixel)', fontSize:7, color:'var(--pp2)', marginBottom:14 }}>REVENUE BY CATEGORY</div>
          {catData.map(c => (
            <div key={c.name} style={{ marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                <span>{c.emoji} {c.name}</span><span style={{ fontWeight:600 }}>€{c.rev.toFixed(0)}</span>
              </div>
              <div style={{ height:8, borderRadius:4, background:'var(--pp3)', overflow:'hidden' }}>
                <div style={{ width:`${c.rev/maxRev*100}%`, height:'100%', background:'var(--pp)', borderRadius:4, transition:'width 0.5s' }} />
              </div>
            </div>
          ))}
        </Card>
        <Card style={{ padding:16 }}>
          <div style={{ fontFamily:'var(--pixel)', fontSize:7, color:'var(--pp2)', marginBottom:14 }}>WEEKLY SALES TREND</div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:120 }}>
            {weekData.map(d => (
              <div key={d.day} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <div style={{ fontSize:10, color:'var(--pp2)', fontWeight:600 }}>{d.sales}</div>
                <div style={{ width:'100%', background:'var(--pp)', borderRadius:'4px 4px 0 0', height:`${d.sales/maxSales*90}px`, transition:'height 0.5s' }} />
                <div style={{ fontSize:10, color:'var(--muted)' }}>{d.day}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card style={{ padding:16 }}>
        <div style={{ fontFamily:'var(--pixel)', fontSize:7, color:'var(--pp2)', marginBottom:14 }}>STOCK LEVELS BY PRODUCT</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10 }}>
          {products.map(p => {
            const num = getGlobalNumber(p.id, products);
            return (
              <div key={p.id} style={{ background:p.stock<=p.minStock?'var(--co3)':'var(--pp3)', borderRadius:8, padding:10, textAlign:'center' }}>
                <div style={{ display:'flex', justifyContent:'center', marginBottom:6 }}><NumBadge num={num} size='sm' /></div>
                <div style={{ fontSize:22 }}>{p.emoji}</div>
                <div style={{ fontSize:11, fontWeight:500, margin:'4px 0' }}>{p.name}</div>
                <div style={{ fontFamily:'var(--pixel)', fontSize:10, color:p.stock<=p.minStock?'var(--co)':'var(--pp2)' }}>{p.stock}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};


// ── Root App ──────────────────────────────────────────────────────────────────
export default function IslandWaWi() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('wawi_auth') === '1');
  const [page, setPage] = useState('dashboard');
  const saved = loadWaWiState();
  const [products, setProducts] = useState(saved?.products || INIT_PRODUCTS);
  const [categories, setCategories] = useState(saved?.categories || INIT_CATEGORIES);
  const [orders, setOrders] = useState(saved?.orders || INIT_ORDERS);
  const [zones, setZones] = useState(() => saved?.zones || makeZones(saved?.products || INIT_PRODUCTS));

  useEffect(() => {
    saveWaWiState({ products, categories, orders, zones });
  }, [products, categories, orders, zones]);

  const logout = () => { sessionStorage.removeItem('wawi_auth'); setAuthed(false); };

  if (!authed) return <PasswordGate onUnlock={() => setAuthed(true)} />;

  const pages = {
    dashboard:  <Dashboard  products={products} orders={orders} />,
    products:   <Products   products={products} setProducts={setProducts} categories={categories} />,
    categories: <Categories categories={categories} setCategories={setCategories} products={products} />,
    stock:      <Stock      products={products} setProducts={setProducts} />,
    orders:     <Orders     orders={orders} setOrders={setOrders} />,
    zones:      <ZoneManager zones={zones} setZones={setZones} products={products} />,
    worlds:     <WorldsPage products={products} />,
    analytics:  <Analytics  products={products} orders={orders} categories={categories} />,
  };

  return (
    <>
      <GlobalStyles />
      <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gridTemplateRows:'56px 1fr', height:'100vh', fontFamily:'var(--body)' }}>
        <Topbar onSync={() => handleSyncToShop(products, zones)} onLogout={logout} />
        <Sidebar active={page} setActive={setPage} />
        <div style={{ overflowY:'auto', padding:20, background:'var(--bg)' }}>
          {pages[page]}
        </div>
      </div>
    </>
  );
}

