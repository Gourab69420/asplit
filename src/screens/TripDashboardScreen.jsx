import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, UserPlus, Settings, ChevronRight, Hotel, Utensils, Car, ShoppingBag, Coffee, Fuel, Zap, MoreHorizontal, Trash2, Edit2, Check, X, AlertCircle } from 'lucide-react';
import { useStore, AVATAR_COLORS } from '../store';
import { supabase } from '../supabase';
import { Avatar, AvatarStack, BottomSheet, formatAmount, formatDateShort, getCategoryMeta, EmptyState } from '../components/ui';
import { Receipt } from 'lucide-react';

const CATEGORY_ICONS = { hotel: Hotel, food: Utensils, taxi: Car, transport: Car, activity: Zap, shopping: ShoppingBag, coffee: Coffee, fuel: Fuel, other: MoreHorizontal };

function StatCard({ label, value, sub, color }) {
  return (
    <div className="card flex-1" style={{ padding: '14px 16px' }}>
      <p className="t-caption c-3" style={{ marginBottom: 4 }}>{label}</p>
      <p className="t-amount-sm" style={{ color: color || 'var(--text)' }}>{value}</p>
      {sub && <p className="t-caption c-3" style={{ marginTop: 2 }}>{sub}</p>}
    </div>
  );
}

function MemberRow({ member, balance }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '12px 0' }}>
      <div className="flex items-center gap-3">
        <Avatar member={member} size="sm" />
        <div>
          <p className="t-label">{member.name}</p>
          <p className="t-caption c-3">{member.role || 'member'}</p>
        </div>
      </div>
      <div className="flex flex-col items-end">
        <p className="t-label" style={{ color: balance >= 0 ? 'var(--success)' : 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
          {balance >= 0 ? '+' : ''}{formatAmount(Math.abs(balance))}
        </p>
        <p className="t-caption c-3">{balance >= 0 ? 'receives' : 'owes'}</p>
      </div>
    </div>
  );
}

function ExpenseCard({ expense, members, onPress }) {
  const meta = getCategoryMeta(expense.category);
  const Icon = CATEGORY_ICONS[expense.category] || MoreHorizontal;
  const payer = members.find(m => m.id === expense.paidBy[0]?.memberId);
  return (
    <motion.div className="card" style={{ padding: '14px 16px', cursor: 'pointer', marginBottom: 10 }} onClick={onPress} whileTap={{ scale: 0.98 }}>
      <div className="flex items-center gap-3">
        <div className="icon-box" style={{ background: meta.bg, width: 44, height: 44, borderRadius: 12 }}>
          <Icon size={20} color={meta.color} strokeWidth={1.8} />
        </div>
        <div className="flex-1">
          <p className="t-label">{expense.title}</p>
          <p className="t-caption c-3">
            {payer ? `Paid by ${payer.name.split(' ')[0]}` : ''} · {expense.splitBetween.length} people
          </p>
        </div>
        <div className="flex flex-col items-end">
          <p className="t-label t-mono">{formatAmount(expense.amount)}</p>
          <p className="t-caption c-3">{formatDateShort(expense.date)}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Add Member Sheet ──────────────────────────────────────────
function AddMemberSheet({ open, onClose, tripId, existingMemberIds }) {
  const { state, dispatch } = useStore();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAdd = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      // Check if user exists by email
      let userId = null;
      let memberProfile = null;
      if (email.trim()) {
        const { data: found } = await supabase
          .from('profiles').select('*').eq('email', email.trim()).maybeSingle();
        if (found) { userId = found.id; memberProfile = found; }
      }
      if (!userId) {
        // Create a placeholder profile for the member
        const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
        const { data: created, error: ce } = await supabase
          .from('profiles')
          .insert({ name: name.trim(), email: email.trim(), avatar_color: color })
          .select().single();
        if (ce) throw ce;
        userId = created.id;
        memberProfile = created;
      }
      if (existingMemberIds.includes(userId)) {
        setError('This person is already in the trip'); setLoading(false); return;
      }
      // Add to trip_members
      const { error: me } = await supabase
        .from('trip_members')
        .insert({ trip_id: tripId, user_id: userId, role: 'member' });
      if (me) throw me;

      // Update trip members list in state
      const initials = name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      const newMember = {
        id: userId, name: name.trim(), email: email.trim(),
        upi: memberProfile?.upi_id || '',
        initials, color: memberProfile?.avatar_color || AVATAR_COLORS[0], role: 'member',
      };
      dispatch({ type: 'ADD_MEMBER', member: newMember });
      // Update trip's members array
      dispatch({ type: 'ADD_TRIP_MEMBER', tripId, userId });
      setSuccess(`${name.trim()} added to the trip!`);
      setName(''); setEmail('');
      setTimeout(() => { setSuccess(''); onClose(); }, 1200);
    } catch (e) {
      setError(e.message || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Add Member">
      <div style={{ padding: '8px 20px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: 'var(--danger-light)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <AlertCircle size={14} color="var(--danger)" />
              <p style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</p>
            </motion.div>
          )}
          {success && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: 'var(--success-light)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <Check size={14} color="var(--success)" />
              <p style={{ fontSize: 13, color: 'var(--success)' }}>{success}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="input-group">
          <label className="input-label">Full Name *</label>
          <input className="input" placeholder="e.g. Priya Patel" value={name} onChange={e => { setName(e.target.value); setError(''); }} />
        </div>

        <div className="input-group">
          <label className="input-label">Email (optional)</label>
          <input className="input" type="email" inputMode="email" placeholder="priya@example.com" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} />
          <p className="t-caption c-3">If they have an account, they'll be linked automatically</p>
        </div>

        <button className="btn btn-primary btn-full" onClick={handleAdd} disabled={loading || !!success}>
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
              Adding...
            </span>
          ) : 'Add to Trip'}
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </BottomSheet>
  );
}

// ── Trip Settings Sheet ───────────────────────────────────────
function TripSettingsSheet({ open, onClose, trip }) {
  const { nav, dispatch } = useStore();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    try {
      await supabase.from('trips').delete().eq('id', trip.id);
      dispatch({ type: 'SET_TRIPS', trips: [] }); // will reload on next nav
      onClose();
      nav('home');
    } catch (e) { console.error(e); }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Trip Settings">
      <div style={{ padding: '8px 20px 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="card" style={{ padding: '4px 0' }}>
          {[
            { label: 'Edit Trip Details', icon: Edit2, onPress: () => { onClose(); nav('createTrip', { editTripId: trip.id }); } },
          ].map(item => (
            <button key={item.label} onClick={item.onPress} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              background: 'none', border: 'none', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <item.icon size={17} color="var(--text-2)" strokeWidth={1.8} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', flex: 1, textAlign: 'left' }}>{item.label}</p>
              <ChevronRight size={16} color="var(--text-3)" />
            </button>
          ))}
        </div>

        <div className="card" style={{ padding: '4px 0' }}>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              background: 'none', border: 'none', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--danger-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={17} color="var(--danger)" strokeWidth={1.8} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--danger)', flex: 1, textAlign: 'left' }}>Delete Trip</p>
            </button>
          ) : (
            <div style={{ padding: '16px' }}>
              <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: 12, fontWeight: 500 }}>Delete "{trip.name}"? This cannot be undone.</p>
              <div className="flex gap-3">
                <button className="btn btn-outline flex-1 btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
                <button className="btn btn-danger flex-1 btn-sm" onClick={handleDelete}>Delete</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

// ── Main Screen ───────────────────────────────────────────────
export default function TripDashboardScreen() {
  const { state, nav, getTripExpenses, getTripMembers, getTripTotal, getSettlements } = useStore();
  const { tripId } = state.screenParams;
  const trip = state.trips.find(t => t.id === tripId);
  const [tab, setTab] = useState('expenses');
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!trip) return null;

  const members = getTripMembers(trip);
  const expenses = getTripExpenses(tripId);
  const total = getTripTotal(tripId);
  const { balances, settlements } = getSettlements(tripId);
  const myId = state.currentUser?.id;
  const myBalance = balances[myId] || 0;

  const grouped = expenses.reduce((acc, e) => {
    if (!acc[e.date]) acc[e.date] = [];
    acc[e.date].push(e);
    return acc;
  }, {});

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ background: trip.coverColor, padding: '16px 20px 20px' }}>
        <div className="flex items-center justify-between mb-4">
          <button className="btn btn-ghost btn-icon" style={{ color: '#fff', background: 'rgba(255,255,255,0.15)' }} onClick={() => nav('home')}>
            <ArrowLeft size={20} />
          </button>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-icon" style={{ color: '#fff', background: 'rgba(255,255,255,0.15)' }} onClick={() => setAddMemberOpen(true)}>
              <UserPlus size={18} />
            </button>
            <button className="btn btn-ghost btn-icon" style={{ color: '#fff', background: 'rgba(255,255,255,0.15)' }} onClick={() => setSettingsOpen(true)}>
              <Settings size={18} />
            </button>
          </div>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 4 }}>
          {formatDateShort(trip.startDate)} – {formatDateShort(trip.endDate)}
        </p>
        <p style={{ color: '#fff', fontSize: 22, fontWeight: 700, letterSpacing: -0.3, marginBottom: 12 }}>{trip.name}</p>
        <AvatarStack members={members} size="sm" />
      </div>

      {/* Stats */}
      <div style={{ padding: '16px 20px', display: 'flex', gap: 10 }}>
        <StatCard label="Total Spent" value={formatAmount(total)} />
        <StatCard
          label="Your Balance"
          value={formatAmount(Math.abs(myBalance))}
          sub={myBalance >= 0 ? 'you receive' : 'you owe'}
          color={myBalance >= 0 ? 'var(--success)' : 'var(--danger)'}
        />
      </div>

      {/* Tabs */}
      <div className="flex" style={{ padding: '0 20px', gap: 4, marginBottom: 16 }}>
        {['expenses', 'members', 'settle'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
            background: tab === t ? 'var(--accent)' : 'var(--surface)',
            color: tab === t ? '#fff' : 'var(--text-2)',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            transition: 'all 0.15s', boxShadow: tab === t ? 'none' : 'var(--shadow-sm)',
          }}>
            {t === 'expenses' ? 'Expenses' : t === 'members' ? `Members (${members.length})` : 'Settle Up'}
          </button>
        ))}
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* Expenses tab */}
        {tab === 'expenses' && (
          <>
            {expenses.length === 0 ? (
              <EmptyState icon={Receipt} title="No expenses yet" subtitle="Add your first expense to get started" action="Add Expense" onAction={() => nav('addExpense', { tripId })} />
            ) : (
              Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([date, exps]) => (
                <div key={date}>
                  <p className="t-caption c-3" style={{ marginBottom: 8, marginTop: 4 }}>{formatDateShort(date)}</p>
                  {exps.map(e => (
                    <ExpenseCard key={e.id} expense={e} members={members} onPress={() => nav('expenseDetail', { expenseId: e.id, tripId })} />
                  ))}
                </div>
              ))
            )}
          </>
        )}

        {/* Members tab */}
        {tab === 'members' && (
          <>
            <div className="card" style={{ padding: '0 16px', marginBottom: 12 }}>
              {members.length === 0 ? (
                <p className="t-body c-3" style={{ padding: '16px 0', textAlign: 'center' }}>No members yet</p>
              ) : members.map((m, i) => (
                <div key={m.id}>
                  <MemberRow member={m} balance={balances[m.id] || 0} />
                  {i < members.length - 1 && <div className="divider" />}
                </div>
              ))}
            </div>
            <button className="btn btn-secondary btn-full" onClick={() => setAddMemberOpen(true)}>
              <UserPlus size={16} /> Add Member
            </button>
          </>
        )}

        {/* Settle tab */}
        {tab === 'settle' && (
          <>
            {settlements.length === 0 ? (
              <div className="card card-p text-center" style={{ padding: 32 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Check size={22} color="var(--success)" />
                </div>
                <p className="t-heading mb-2">All settled up!</p>
                <p className="t-body c-3">No pending payments in this trip.</p>
              </div>
            ) : (
              settlements.map((s, i) => {
                const from = members.find(m => m.id === s.from);
                const to = members.find(m => m.id === s.to);
                return (
                  <motion.div key={i} className="card" style={{ padding: '16px', marginBottom: 10, cursor: 'pointer' }}
                    onClick={() => nav('settlement', { settlement: s, tripId })} whileTap={{ scale: 0.98 }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar member={from} size="sm" />
                        <div>
                          <p className="t-label">{from?.name.split(' ')[0]} pays {to?.name.split(' ')[0]}</p>
                          <p className="t-caption c-3">Tap to pay via UPI</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="t-amount-sm c-danger">{formatAmount(s.amount)}</p>
                        <ChevronRight size={16} color="var(--text-3)" />
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* FAB */}
      <button className="fab" onClick={() => nav('addExpense', { tripId })}>
        <Plus size={22} strokeWidth={2.5} />
      </button>

      {/* Sheets */}
      <AddMemberSheet
        open={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        tripId={tripId}
        existingMemberIds={trip.members || []}
      />
      <TripSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        trip={trip}
      />
    </div>
  );
}
