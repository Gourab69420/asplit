import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Hotel, Utensils, Car, ShoppingBag, Coffee, Fuel, Zap, MoreHorizontal, Check, ChevronDown } from 'lucide-react';
import { useStore } from '../store';
import { Avatar, BottomSheet, formatAmount } from '../components/ui';

const CATEGORIES = [
  { id: 'food',      label: 'Food',      Icon: Utensils,    color: '#d97706', bg: '#fffbeb' },
  { id: 'hotel',     label: 'Hotel',     Icon: Hotel,       color: '#7c3aed', bg: '#f5f3ff' },
  { id: 'taxi',      label: 'Taxi',      Icon: Car,         color: '#0891b2', bg: '#ecfeff' },
  { id: 'transport', label: 'Transport', Icon: Car,         color: '#059669', bg: '#f0fdf4' },
  { id: 'activity',  label: 'Activity',  Icon: Zap,         color: '#db2777', bg: '#fdf2f8' },
  { id: 'shopping',  label: 'Shopping',  Icon: ShoppingBag, color: '#2563eb', bg: '#eff4ff' },
  { id: 'coffee',    label: 'Coffee',    Icon: Coffee,      color: '#92400e', bg: '#fef3c7' },
  { id: 'fuel',      label: 'Fuel',      Icon: Fuel,        color: '#65a30d', bg: '#f7fee7' },
  { id: 'other',     label: 'Other',     Icon: MoreHorizontal, color: '#6b7280', bg: '#f3f4f6' },
];

const SPLIT_TYPES = ['equal', 'custom', 'percentage'];

function AmountInput({ value, onChange }) {
  return (
    <div style={{ background: 'var(--surface)', padding: '24px 20px 20px', borderBottom: '1px solid var(--border-light)', textAlign: 'center' }}>
      <p className="t-caption c-3" style={{ marginBottom: 8 }}>Total Amount</p>
      <div className="flex items-center justify-center gap-2">
        <span style={{ fontSize: 36, fontWeight: 300, color: 'var(--text-3)' }}>₹</span>
        <input
          type="number" inputMode="decimal"
          value={value} onChange={e => onChange(e.target.value)}
          placeholder="0"
          style={{
            border: 'none', outline: 'none', fontSize: 48, fontWeight: 700,
            letterSpacing: -2, color: 'var(--text)', background: 'transparent',
            width: Math.max(80, String(value || '0').length * 32) + 'px',
            fontVariantNumeric: 'tabular-nums', textAlign: 'center', fontFamily: 'inherit',
          }}
        />
      </div>
    </div>
  );
}

function MemberChip({ member, selected, amount, onToggle }) {
  return (
    <motion.button
      onClick={onToggle}
      whileTap={{ scale: 0.95 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
        borderRadius: 100, border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        background: selected ? 'var(--accent-light)' : 'var(--surface)',
        cursor: 'pointer', transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Avatar member={member} size="xs" />
      <span style={{ fontSize: 13, fontWeight: 500, color: selected ? 'var(--accent)' : 'var(--text)' }}>
        {member.name.split(' ')[0]}
      </span>
      {selected && amount !== undefined && (
        <span style={{ fontSize: 12, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
          ₹{Math.round(amount)}
        </span>
      )}
    </motion.button>
  );
}

export default function AddExpenseScreen() {
  const { state, nav, addExpense, getTripMembers } = useStore();
  const { tripId } = state.screenParams;
  const trip = state.trips.find(t => t.id === tripId);
  const members = getTripMembers(trip || { members: [] });
  const currentUserId = state.currentUser?.id;

  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('food');
  const [paidBy, setPaidBy] = useState(currentUserId ? [currentUserId] : []);
  const [splitType, setSplitType] = useState('equal');
  const [splitMembers, setSplitMembers] = useState(members.map(m => m.id));
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [catSheet, setCatSheet] = useState(false);

  const totalAmt = parseFloat(amount) || 0;
  const perPerson = splitMembers.length > 0 ? totalAmt / splitMembers.length : 0;

  const toggleSplitMember = (id) => {
    setSplitMembers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const validate = () => {
    const e = {};
    if (!totalAmt || totalAmt <= 0) e.amount = 'Enter a valid amount';
    if (!title.trim()) e.title = 'Expense title is required';
    if (splitMembers.length === 0) e.split = 'Select at least one member';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await addExpense({
        tripId, title, amount: totalAmt, category,
        paidBy: paidBy.map(id => ({ memberId: id, amount: totalAmt / paidBy.length })),
        splitBetween: splitMembers, splitType,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        notes,
      });
      nav('tripDashboard', { tripId });
    } catch (e) {
      setErrors({ submit: e.message });
    } finally {
      setSaving(false);
    }
  };

  const selCat = CATEGORIES.find(c => c.id === category);

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px' }}>
        <button className="btn btn-ghost btn-icon" onClick={() => nav('tripDashboard', { tripId })}><ArrowLeft size={20} /></button>
        <p className="t-heading">Add Expense</p>
      </div>

      {/* Amount */}
      <AmountInput value={amount} onChange={setAmount} />
      {errors.amount && <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--danger)', padding: '6px 0' }}>{errors.amount}</p>}

      <div style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Title */}
        <div className="input-group">
          <label className="input-label">What was this for?</label>
          <input className="input" placeholder="e.g. Dinner at Spice Route" value={title} onChange={e => setTitle(e.target.value)} style={errors.title ? { borderColor: 'var(--danger)' } : {}} />
          {errors.title && <p style={{ fontSize: 12, color: 'var(--danger)' }}>{errors.title}</p>}
        </div>

        {/* Category */}
        <div className="input-group">
          <label className="input-label">Category</label>
          <button className="input flex items-center gap-3 cursor-pointer" style={{ justifyContent: 'space-between', textAlign: 'left' }} onClick={() => setCatSheet(true)}>
            <div className="flex items-center gap-3">
              <div style={{ width: 28, height: 28, borderRadius: 8, background: selCat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <selCat.Icon size={15} color={selCat.color} strokeWidth={1.8} />
              </div>
              <span style={{ fontSize: 15, color: 'var(--text)' }}>{selCat.label}</span>
            </div>
            <ChevronDown size={16} color="var(--text-3)" />
          </button>
        </div>

        {/* Paid By */}
        <div className="input-group">
          <label className="input-label">Paid By</label>
          <div className="flex flex-wrap gap-2">
            {members.map(m => (
              <MemberChip key={m.id} member={m} selected={paidBy.includes(m.id)} onToggle={() => {
                setPaidBy(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id]);
              }} />
            ))}
          </div>
        </div>

        {/* Split */}
        <div className="input-group">
          <label className="input-label">Split Type</label>
          <div className="flex gap-2">
            {SPLIT_TYPES.map(t => (
              <button key={t} className={`chip flex-1 justify-center ${splitType === t ? 'chip-active' : ''}`} onClick={() => setSplitType(t)} style={{ textTransform: 'capitalize' }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Split members */}
        <div className="input-group">
          <label className="input-label">Split Between</label>
          {errors.split && <p style={{ fontSize: 12, color: 'var(--danger)' }}>{errors.split}</p>}
          <div className="flex flex-wrap gap-2">
            {members.map(m => (
              <MemberChip key={m.id} member={m} selected={splitMembers.includes(m.id)}
                amount={splitType === 'equal' && splitMembers.includes(m.id) ? perPerson : undefined}
                onToggle={() => toggleSplitMember(m.id)} />
            ))}
          </div>
          {totalAmt > 0 && splitMembers.length > 0 && (
            <div style={{ background: 'var(--accent-light)', borderRadius: 8, padding: '10px 12px', marginTop: 4 }}>
              <p style={{ fontSize: 13, color: 'var(--accent)' }}>
                Each person pays <strong>{formatAmount(perPerson)}</strong> · {splitMembers.length} people
              </p>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="input-group">
          <label className="input-label">Notes (optional)</label>
          <textarea className="textarea" placeholder="Any additional details..." value={notes} onChange={e => setNotes(e.target.value)} style={{ minHeight: 72 }} />
        </div>

        {errors.submit && <p style={{ fontSize: 12, color: 'var(--danger)' }}>{errors.submit}</p>}
        <button className="btn btn-primary btn-full" style={{ marginTop: 4 }} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Expense'}
        </button>
      </div>

      {/* Category Sheet */}
      <BottomSheet open={catSheet} onClose={() => setCatSheet(false)} title="Select Category">
        <div style={{ padding: '8px 20px 24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => { setCategory(cat.id); setCatSheet(false); }} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: '14px 8px', borderRadius: 12, border: `1.5px solid ${category === cat.id ? cat.color : 'var(--border)'}`,
              background: category === cat.id ? cat.bg : 'var(--surface)', cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
              <cat.Icon size={22} color={cat.color} strokeWidth={1.8} />
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{cat.label}</span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
