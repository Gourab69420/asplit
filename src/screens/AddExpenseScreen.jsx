import { useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, Hotel, Utensils, Car, ShoppingBag, Coffee, Fuel, Zap, MoreHorizontal, Users, WalletCards, Equal, AlertCircle } from 'lucide-react';
import { useStore } from '../store';
import { Avatar, BottomSheet, formatAmount } from '../components/ui';

const CATEGORIES = [
  { id: 'food', label: 'Food', Icon: Utensils, color: '#d97706', bg: '#fffbeb' },
  { id: 'hotel', label: 'Hotel', Icon: Hotel, color: '#7c3aed', bg: '#f5f3ff' },
  { id: 'taxi', label: 'Taxi', Icon: Car, color: '#0891b2', bg: '#ecfeff' },
  { id: 'transport', label: 'Transport', Icon: Car, color: '#059669', bg: '#f0fdf4' },
  { id: 'activity', label: 'Activity', Icon: Zap, color: '#db2777', bg: '#fdf2f8' },
  { id: 'shopping', label: 'Shopping', Icon: ShoppingBag, color: '#2563eb', bg: '#eff4ff' },
  { id: 'coffee', label: 'Coffee', Icon: Coffee, color: '#92400e', bg: '#fef3c7' },
  { id: 'fuel', label: 'Fuel', Icon: Fuel, color: '#65a30d', bg: '#f7fee7' },
  { id: 'other', label: 'Other', Icon: MoreHorizontal, color: '#6b7280', bg: '#f3f4f6' },
];

const toCents = value => {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
};
const moneyFromCents = cents => (cents / 100).toFixed(2);

function equalAmounts(ids, totalCents) {
  const each = Math.floor(totalCents / ids.length);
  const remainder = totalCents - each * ids.length;
  return Object.fromEntries(ids.map((id, index) => [id, moneyFromCents(each + (index < remainder ? 1 : 0))]));
}

function MemberChoice({ member, selected, amount, onToggle, onAmountChange, customized, label }) {
  return (
    <div className="card" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-light)'}`, background: selected ? 'var(--accent-light)' : 'var(--surface)' }}>
      <button type="button" onClick={onToggle} aria-pressed={selected} aria-label={`${selected ? 'Remove' : 'Select'} ${member.name} ${label}`} style={{ border: 0, background: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, cursor: 'pointer', color: 'var(--text)', textAlign: 'left' }}>
        <span style={{ width: 22, height: 22, borderRadius: 7, border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--border)'}`, background: selected ? 'var(--accent)' : 'var(--surface)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          {selected && <Check size={14} color="#fff" strokeWidth={3} />}
        </span>
        <Avatar member={member} size="xs" />
        <span style={{ fontSize: 14, fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</span>
      </button>
      {customized && selected && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <span className="t-caption c-3">₹</span>
          <input className="input" type="number" inputMode="decimal" min="0" step="0.01" value={amount ?? ''} onChange={e => onAmountChange(e.target.value)} aria-label={`${label} amount for ${member.name}`} style={{ width: 100, height: 38, textAlign: 'right', padding: '0 9px', fontVariantNumeric: 'tabular-nums' }} />
        </label>
      )}
      {!customized && selected && amount != null && <span className="t-caption c-2" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatAmount(amount)}</span>}
    </div>
  );
}

function AllocationStatus({ total, allocated, label, hasSelection }) {
  const difference = total - allocated;
  const valid = hasSelection && difference === 0;
  return (
    <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, background: valid ? 'var(--success-light)' : 'var(--surface-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span className="t-caption c-2">{label}</span>
      <span style={{ fontSize: 13, fontWeight: 650, color: valid ? 'var(--success)' : 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>{formatAmount(allocated)} / {formatAmount(total)}</span>
    </div>
  );
}

function SectionHeading({ icon: Icon, title, description, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0, background: 'var(--accent-light)', color: 'var(--accent)' }}><Icon size={17} /></div>
      <div style={{ flex: 1 }}>
        <p className="t-label">{title}</p>
        <p className="t-caption c-3" style={{ marginTop: 2 }}>{description}</p>
      </div>
      {action}
    </div>
  );
}

export default function AddExpenseScreen() {
  const { state, nav, addExpense, getTripMembers } = useStore();
  const { tripId } = state.screenParams;
  const trip = state.trips.find(t => t.id === tripId);
  const members = getTripMembers(trip || { members: [] });
  const currentUserId = state.currentUser?.id;

  const [mode, setMode] = useState('normal');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('food');
  const [payerIds, setPayerIds] = useState(currentUserId ? [currentUserId] : []);
  const [splitIds, setSplitIds] = useState(() => members.map(member => member.id));
  const [payerAmounts, setPayerAmounts] = useState({});
  const [shareAmounts, setShareAmounts] = useState({});
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [catSheet, setCatSheet] = useState(false);

  const totalCents = toCents(amount);
  const totalAmount = totalCents / 100;
  const selCat = CATEGORIES.find(item => item.id === category) || CATEGORIES.at(-1);

  const normalPayers = useMemo(() => equalAmounts(payerIds, totalCents), [payerIds, totalCents]);
  const normalShares = useMemo(() => equalAmounts(splitIds, totalCents), [splitIds, totalCents]);
  const activePayers = mode === 'normal' ? normalPayers : payerAmounts;
  const activeShares = mode === 'normal' ? normalShares : shareAmounts;
  const payerTotalCents = payerIds.reduce((sum, id) => sum + toCents(activePayers[id]), 0);
  const shareTotalCents = splitIds.reduce((sum, id) => sum + toCents(activeShares[id]), 0);

  const setModeAndSeed = nextMode => {
    if (nextMode === 'custom') {
      setPayerAmounts(current => ({ ...equalAmounts(payerIds, totalCents), ...current }));
      setShareAmounts(current => ({ ...equalAmounts(splitIds, totalCents), ...current }));
    }
    setMode(nextMode);
    setErrors({});
  };

  const toggleId = (id, list, setList, amounts, setAmounts) => {
    const selected = list.includes(id);
    const updated = selected ? list.filter(item => item !== id) : [...list, id];
    setList(updated);
    if (mode === 'custom' && !selected) setAmounts(current => ({ ...current, [id]: current[id] || '0.00' }));
  };

  const distributePayers = () => setPayerAmounts(current => ({ ...current, ...equalAmounts(payerIds, totalCents) }));
  const distributeShares = () => setShareAmounts(current => ({ ...current, ...equalAmounts(splitIds, totalCents) }));

  const validate = () => {
    const next = {};
    if (totalCents <= 0) next.amount = 'Enter an amount greater than zero.';
    if (!title.trim()) next.title = 'Add a name for this expense.';
    if (!payerIds.length) next.payers = 'Select at least one person who paid.';
    if (!splitIds.length) next.shares = 'Select at least one person to split this expense with.';
    if (mode === 'custom') {
      if (payerIds.some(id => toCents(payerAmounts[id]) < 0)) next.payers = 'Payer amounts cannot be negative.';
      else if (payerTotalCents !== totalCents) next.payers = `Payer amounts need to equal ${formatAmount(totalAmount)}.`;
      if (splitIds.some(id => toCents(shareAmounts[id]) < 0)) next.shares = 'Share amounts cannot be negative.';
      else if (shareTotalCents !== totalCents) next.shares = `Shares need to equal ${formatAmount(totalAmount)}.`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const paidBy = payerIds.map(id => ({ memberId: id, amount: toCents(activePayers[id]) / 100 }));
      const splitAmounts = splitIds.map(id => ({ memberId: id, amount: toCents(activeShares[id]) / 100 }));
      await addExpense({
        tripId, title: title.trim(), amount: totalAmount, category,
        paidBy, splitBetween: splitIds, splitAmounts,
        splitType: mode === 'normal' ? 'equal' : 'custom',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5), notes: notes.trim(),
      });
      nav('tripDashboard', { tripId });
    } catch (error) {
      setErrors({ submit: error.message || 'Could not save this expense.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen">
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px' }}>
        <button className="btn btn-ghost btn-icon" onClick={() => nav('tripDashboard', { tripId })} aria-label="Back to trip"><ArrowLeft size={20} /></button>
        <div><p className="t-heading">Add Expense</p><p className="t-caption c-3">{trip?.name || 'Trip expense'}</p></div>
      </div>

      <div style={{ padding: '16px 20px 0' }}>
        <div role="tablist" aria-label="Expense entry mode" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: 4, borderRadius: 12, background: 'var(--surface-2)', gap: 4 }}>
          {[['normal', 'Normal'], ['custom', 'Customized']].map(([value, label]) => (
            <button key={value} role="tab" aria-selected={mode === value} onClick={() => setModeAndSeed(value)} style={{ height: 42, border: 0, borderRadius: 9, background: mode === value ? 'var(--surface)' : 'transparent', color: mode === value ? 'var(--accent)' : 'var(--text-2)', boxShadow: mode === value ? 'var(--shadow-sm)' : 'none', fontSize: 14, fontWeight: 650, cursor: 'pointer' }}>{label}</button>
          ))}
        </div>
        <p className="t-caption c-3" style={{ textAlign: 'center', marginTop: 8 }}>{mode === 'normal' ? 'Quick entry with equal amounts.' : 'Set the exact amount each person paid and owes.'}</p>
      </div>

      <div style={{ background: 'var(--surface)', padding: '20px 20px 16px', marginTop: 12, borderBottom: '1px solid var(--border-light)', textAlign: 'center' }}>
        <p className="t-caption c-3" style={{ marginBottom: 8 }}>Total expense</p>
        <div className="flex items-center justify-center gap-2">
          <span style={{ fontSize: 32, fontWeight: 350, color: 'var(--text-3)' }}>₹</span>
          <input type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={event => { setAmount(event.target.value); setErrors(current => ({ ...current, amount: undefined, payers: undefined, shares: undefined })); }} placeholder="0.00" aria-label="Total expense amount" style={{ border: 0, outline: 0, fontSize: 42, fontWeight: 750, letterSpacing: -1.5, color: 'var(--text)', background: 'transparent', width: Math.max(110, String(amount || '0.00').length * 27), fontVariantNumeric: 'tabular-nums', textAlign: 'center', fontFamily: 'inherit' }} />
        </div>
        {errors.amount && <p role="alert" style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{errors.amount}</p>}
      </div>

      <div style={{ padding: '20px 20px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="input-group">
          <label className="input-label" htmlFor="expense-title">What was this for?</label>
          <input id="expense-title" className="input" placeholder="e.g. Dinner at Spice Route" value={title} onChange={event => setTitle(event.target.value)} />
          {errors.title && <p role="alert" style={{ fontSize: 12, color: 'var(--danger)' }}>{errors.title}</p>}
        </div>

        <div className="input-group">
          <label className="input-label">Category</label>
          <button type="button" className="input flex items-center gap-3 cursor-pointer" style={{ justifyContent: 'space-between', textAlign: 'left' }} onClick={() => setCatSheet(true)}>
            <span className="flex items-center gap-3"><span style={{ width: 30, height: 30, borderRadius: 9, background: selCat.bg, display: 'grid', placeItems: 'center' }}><selCat.Icon size={16} color={selCat.color} /></span><span style={{ fontSize: 15, color: 'var(--text)' }}>{selCat.label}</span></span>
            <ChevronDown size={16} color="var(--text-3)" />
          </button>
        </div>

        <section className="input-group">
          <SectionHeading icon={WalletCards} title="Who paid?" description={mode === 'normal' ? 'Choose one or more payers. Any leftover cents are shared automatically.' : 'Choose each payer and enter the amount they covered.'} action={mode === 'custom' && payerIds.length > 0 ? <button type="button" className="btn btn-ghost btn-sm" onClick={distributePayers}><Equal size={14} /> Split equally</button> : null} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {members.map(member => (
              <MemberChoice key={member.id} member={member} label="as payer" selected={payerIds.includes(member.id)} amount={mode === 'normal' ? normalPayers[member.id] : payerAmounts[member.id]} customized={mode === 'custom'} onToggle={() => toggleId(member.id, payerIds, setPayerIds, payerAmounts, setPayerAmounts)} onAmountChange={value => { setPayerAmounts(current => ({ ...current, [member.id]: value })); setErrors(current => ({ ...current, payers: undefined })); }} />
            ))}
          </div>
          {errors.payers && <p role="alert" style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{errors.payers}</p>}
          <AllocationStatus total={totalAmount} allocated={mode === 'normal' ? totalAmount : payerTotalCents / 100} label="Paid total" hasSelection={payerIds.length > 0} />
        </section>

        <section className="input-group">
          <SectionHeading icon={Users} title="Who owes what?" description={mode === 'normal' ? 'Choose who shares the expense. Their portions are equal.' : 'Choose participants and set each person’s share.'} action={mode === 'custom' && splitIds.length > 0 ? <button type="button" className="btn btn-ghost btn-sm" onClick={distributeShares}><Equal size={14} /> Split equally</button> : null} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {members.map(member => (
              <MemberChoice key={member.id} member={member} label="in the split" selected={splitIds.includes(member.id)} amount={mode === 'normal' ? normalShares[member.id] : shareAmounts[member.id]} customized={mode === 'custom'} onToggle={() => toggleId(member.id, splitIds, setSplitIds, shareAmounts, setShareAmounts)} onAmountChange={value => { setShareAmounts(current => ({ ...current, [member.id]: value })); setErrors(current => ({ ...current, shares: undefined })); }} />
            ))}
          </div>
          {errors.shares && <p role="alert" style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{errors.shares}</p>}
          <AllocationStatus total={totalAmount} allocated={mode === 'normal' ? totalAmount : shareTotalCents / 100} label="Share total" hasSelection={splitIds.length > 0} />
        </section>

        {mode === 'custom' && (
          <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <AlertCircle size={17} color="var(--accent)" style={{ marginTop: 1, flexShrink: 0 }} />
            <p className="t-caption c-2">Both totals must match the expense total before you can save. Use “Split equally” to fill the selected rows automatically, then adjust any amount.</p>
          </div>
        )}

        <div className="input-group">
          <label className="input-label" htmlFor="expense-notes">Notes (optional)</label>
          <textarea id="expense-notes" className="textarea" placeholder="Add a detail about this expense" value={notes} onChange={event => setNotes(event.target.value)} style={{ minHeight: 76 }} />
        </div>

        {mode === 'custom' && totalCents > 0 && (payerTotalCents !== totalCents || shareTotalCents !== totalCents) && (
          <div className="card" style={{ padding: 14 }}>
            <p className="t-caption c-3" style={{ marginBottom: 6 }}>REMAINING TO ALLOCATE</p>
            <div className="flex items-center justify-between"><span className="t-caption c-2">Payers</span><strong style={{ color: payerTotalCents === totalCents ? 'var(--success)' : 'var(--warning)' }}>{formatAmount((totalCents - payerTotalCents) / 100)}</strong></div>
            <div className="flex items-center justify-between" style={{ marginTop: 6 }}><span className="t-caption c-2">Shares</span><strong style={{ color: shareTotalCents === totalCents ? 'var(--success)' : 'var(--warning)' }}>{formatAmount((totalCents - shareTotalCents) / 100)}</strong></div>
          </div>
        )}

        {errors.submit && <p role="alert" style={{ fontSize: 13, color: 'var(--danger)' }}>{errors.submit}</p>}
        <button className="btn btn-primary btn-full" style={{ marginTop: 2 }} onClick={handleSave} disabled={saving || !members.length}>
          {saving ? 'Saving expense…' : 'Save Expense'}
        </button>
      </div>

      <BottomSheet open={catSheet} onClose={() => setCatSheet(false)} title="Select Category">
        <div style={{ padding: '8px 20px 24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {CATEGORIES.map(item => (
            <button type="button" key={item.id} onClick={() => { setCategory(item.id); setCatSheet(false); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '14px 8px', borderRadius: 12, border: `1.5px solid ${category === item.id ? item.color : 'var(--border)'}`, background: category === item.id ? item.bg : 'var(--surface)', cursor: 'pointer' }}>
              <item.Icon size={22} color={item.color} strokeWidth={1.8} /><span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{item.label}</span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
