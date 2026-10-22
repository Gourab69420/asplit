import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Copy, Check, Smartphone } from 'lucide-react';
import { useStore } from '../store';
import { Avatar, formatAmount } from '../components/ui';

export default function SettlementScreen() {
  const { state, nav } = useStore();
  const { settlement, tripId } = state.screenParams;
  const [paid, setPaid] = useState(false);
  const [upiCopied, setUpiCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

  if (!settlement) return null;

  const { members } = state;
  const from = members.find(m => m.id === settlement.from);
  const to = members.find(m => m.id === settlement.to);
  const isPayer = state.currentUser?.id === settlement.from;
  const upiParams = new URLSearchParams({
    pa: to?.upi?.trim() || '',
    cu: 'INR',
  });
  const upiLink = `upi://pay?${upiParams.toString()}`;

  const handleCopyUPI = async () => {
    try {
      await navigator.clipboard.writeText(to.upi);
      setUpiCopied(true);
      setCopyError('');
      window.setTimeout(() => setUpiCopied(false), 2500);
    } catch {
      setCopyError(`Copy unavailable. Select and copy this UPI ID: ${to.upi}`);
    }
  };

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
          <p className="t-caption c-3">{to?.upi ? `UPI · ${to.upi}` : 'Payment recipient'}</p>
        </div>

        {isPayer ? (
          <>
            {to?.upi ? (
              <>
                <a href={upiLink} className="btn btn-primary btn-full" style={{ textDecoration: 'none' }}>
                  <Smartphone size={18} /> Pay using UPI app
                </a>
                <p className="t-caption c-3" style={{ textAlign: 'center', lineHeight: 1.6 }}>
                  Enter the payment amount in your UPI app: {formatAmount(settlement.amount)}.
                </p>
                <button type="button" onClick={handleCopyUPI} className="btn btn-outline btn-full">
                  {upiCopied ? <Check size={18} /> : <Copy size={18} />}
                  {upiCopied ? 'UPI ID Copied' : 'Copy UPI ID'}
                </button>
                <p className="t-caption c-3" style={{ textAlign: 'center', lineHeight: 1.6 }}>
                  If the UPI app can’t complete the payment, copy the UPI ID and pay manually. Enter {formatAmount(settlement.amount)}.
                </p>
                {copyError && <p role="alert" className="t-caption c-2" style={{ textAlign: 'center', userSelect: 'all' }}>{copyError}</p>}
              </>
            ) : (
              <div className="card card-p t-caption c-2" style={{ textAlign: 'center' }}>
                {to?.name || 'The recipient'} needs to add a UPI ID to their profile before you can pay through a UPI app.
              </div>
            )}

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
          </>
        ) : (
          <div className="card card-p" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar member={from} size="sm" />
            <p className="t-body c-2"><strong>{from?.name || 'The payer'}</strong> can open a UPI app and mark this payment as paid.</p>
          </div>
        )}
      </div>
    </div>
  );
}
