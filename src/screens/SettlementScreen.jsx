import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, QrCode, Check, Share2, Copy } from 'lucide-react';
import { useStore } from '../store';
import { Avatar, formatAmount } from '../components/ui';

function QRPlaceholder({ upi, amount, name }) {
  // Visual QR placeholder using SVG pattern
  const cells = [];
  const size = 21;
  // Deterministic pattern from upi string
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const isCorner = (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);
      const hash = (upi.charCodeAt((r * size + c) % upi.length) + r * 7 + c * 13) % 3;
      const filled = isCorner || hash === 0;
      cells.push({ r, c, filled });
    }
  }
  const cell = 8;
  const pad = 16;
  const total = size * cell + pad * 2;

  return (
    <svg width={total} height={total} viewBox={`0 0 ${total} ${total}`} style={{ borderRadius: 12 }}>
      <rect width={total} height={total} fill="white" rx="12" />
      {cells.map(({ r, c, filled }) => filled && (
        <rect key={`${r}-${c}`} x={pad + c * cell} y={pad + r * cell} width={cell - 1} height={cell - 1} fill="#0f0f10" rx="1" />
      ))}
    </svg>
  );
}

export default function SettlementScreen() {
  const { state, nav, dispatch } = useStore();
  const { settlement, tripId } = state.screenParams;
  const [paid, setPaid] = useState(false);

  if (!settlement) return null;

  const { members } = state;
  const from = members.find(m => m.id === settlement.from);
  const to = members.find(m => m.id === settlement.to);
  const upiLink = `upi://pay?pa=${to?.upi}&pn=${encodeURIComponent(to?.name || '')}&am=${settlement.amount}&cu=INR&tn=ASplit+Settlement`;

  const handleMarkPaid = () => {
    setPaid(true);
    setTimeout(() => nav('tripDashboard', { tripId }), 1200);
  };

  return (
    <div className="screen">
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px' }}>
        <button className="btn btn-ghost btn-icon" onClick={() => nav('tripDashboard', { tripId })}><ArrowLeft size={20} /></button>
        <p className="t-heading">Settle Up</p>
      </div>

      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Payment card */}
        <div className="card" style={{ padding: '24px 20px', textAlign: 'center' }}>
          <div className="flex items-center justify-center gap-4" style={{ marginBottom: 20 }}>
            <div className="flex flex-col items-center gap-2">
              <Avatar member={from} size="lg" />
              <p className="t-label">{from?.name.split(' ')[0]}</p>
            </div>
            <div style={{ flex: 1, height: 2, background: 'var(--border)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--danger-light)', borderRadius: 100, padding: '4px 10px' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)' }}>pays</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Avatar member={to} size="lg" />
              <p className="t-label">{to?.name.split(' ')[0]}</p>
            </div>
          </div>
          <p className="t-amount c-danger" style={{ marginBottom: 4 }}>{formatAmount(settlement.amount)}</p>
          <p className="t-caption c-3">via UPI · {to?.upi}</p>
        </div>

        {/* QR Code */}
        <div className="card" style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <p className="t-label c-2">Scan to Pay</p>
          <div style={{ padding: 12, background: '#fff', borderRadius: 16, boxShadow: 'var(--shadow)' }}>
            <QRPlaceholder upi={to?.upi || 'upi'} amount={settlement.amount} name={to?.name || ''} />
          </div>
          <p className="t-caption c-3">{to?.upi}</p>
        </div>

        {/* Actions */}
        <a href={upiLink} className="btn btn-primary btn-full" style={{ textDecoration: 'none' }}>
          <QrCode size={18} /> Open UPI App
        </a>

        <AnimatePresence mode="wait">
          {!paid ? (
            <motion.button key="mark" className="btn btn-outline btn-full" onClick={handleMarkPaid} exit={{ opacity: 0, scale: 0.95 }}>
              <Check size={18} /> Mark as Paid
            </motion.button>
          ) : (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="btn btn-full" style={{ background: 'var(--success-light)', color: 'var(--success)', border: 'none', cursor: 'default' }}>
              <Check size={18} /> Payment Recorded
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
