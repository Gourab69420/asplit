import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, UserPlus, Link2, Settings, ChevronRight, Hotel, Utensils, Car, ShoppingBag, Coffee, Fuel, Zap, MoreHorizontal, Trash2, Edit2, Check, AlertCircle, Download } from 'lucide-react';
import { useStore } from '../store';
import { Avatar, AvatarStack, BottomSheet, formatAmount, formatDateShort, getCategoryMeta, EmptyState } from '../components/ui';
import { Receipt } from 'lucide-react';
import TripInviteSheet from '../components/TripInviteSheet';

const CATEGORY_ICONS = { hotel: Hotel, food: Utensils, taxi: Car, transport: Car, activity: Zap, shopping: ShoppingBag, coffee: Coffee, fuel: Fuel, other: MoreHorizontal };

const memberName = (members, id) => members.find(member => member.id === id)?.name || id || '';
const csvEscape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
function formatCsvDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = type => parts.find(item => item.type === type)?.value || '';
  return `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}`;
}
function downloadCsv(filename, rows) {
  const csv = `\uFEFF${rows.map(row => row.map(csvEscape).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function expenseShareBreakdown(expense, members) {
  if (expense.splitAmounts?.length) {
    return expense.splitAmounts.map(share => `${memberName(members, share.memberId)}: ${Number(share.amount || 0).toFixed(2)}`);
  }
  const ids = expense.splitBetween || [];
  if (!ids.length) return [];
  const totalCents = Math.round(Number(expense.amount || 0) * 100);
  const eachCents = Math.floor(totalCents / ids.length);
  const remainder = totalCents - eachCents * ids.length;
  return ids.map((id, index) => `${memberName(members, id)}: ${((eachCents + (index < remainder ? 1 : 0)) / 100).toFixed(2)}`);
}

function expenseCsvRows(trip, members, expenses) {
  return [
    ['Trip', 'Expense ID', 'Expense Date', 'Expense Time', 'Title', 'Category', 'Notes', 'Total Amount', 'Currency', 'Split Type', 'Payer Count', 'Payer Amount Breakdown', 'Participant Count', 'Share Breakdown', 'Created By', 'Created At (Local, 24h)'],
    ...expenses.map(expense => [
      trip.name, expense.id, expense.date, expense.time, expense.title, expense.category, expense.notes,
      Number(expense.amount || 0).toFixed(2), trip.currency, expense.splitType,
      expense.paidBy.length,
      expense.paidBy.map(payer => `${memberName(members, payer.memberId)}: ${Number(payer.amount || 0).toFixed(2)}`).join(' | '),
      expense.splitBetween.length,
      expenseShareBreakdown(expense, members).join(' | '),
      memberName(members, expense.createdBy), formatCsvDateTime(expense.createdAt),
    ]),
  ];
}

function settlementCsvRows(trip, members, settlements, paymentHistory) {
  const name = id => memberName(members, id);
  const statusText = status => ({
    approved: 'Done - recipient approved',
    pending: 'Waiting for recipient approval',
    declined: 'Declined by recipient',
  }[status] || status || 'Unknown');
  const historyRows = [...paymentHistory]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .map(payment => [
      trip.name, 'Payment record', payment.id, name(payment.from), name(payment.to), Number(payment.amount || 0).toFixed(2), trip.currency,
      statusText(payment.status), formatCsvDateTime(payment.createdAt), formatCsvDateTime(payment.decidedAt), name(payment.decidedBy),
      payment.status === 'approved' ? 'Recipient approved; balance reduced.' : payment.status === 'pending' ? 'Balance is unchanged until recipient approval.' : 'Balance was not changed.',
    ]);
  const outstandingRows = settlements.map(settlement => [
    trip.name, 'Current outstanding balance', '', name(settlement.from), name(settlement.to), Number(settlement.amount || 0).toFixed(2), trip.currency,
    'Still due', '', '', '', 'Calculated from expenses and recipient-approved payments; pending requests do not reduce the balance.',
  ]);
  return [
    ['Trip', 'Record Type', 'Payment ID', 'From', 'To', 'Amount', 'Currency', 'Status', 'Requested / Recorded At (Local, 24h)', 'Decision At (Local, 24h)', 'Approved / Declined By', 'Details'],
    ...historyRows,
    ...outstandingRows,
  ];
}

const paymentStatusLabel = status => ({
  approved: 'Settled', pending: 'Awaiting approval', declined: 'Declined',
}[status] || 'Unknown');

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
            {payer ? (expense.paidBy.length > 1 ? `Paid by ${expense.paidBy.length} people` : `Paid by ${payer.name.split(' ')[0]}`) : ''} · {expense.splitBetween.length} people
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

function PendingSettlementApprovals({ payments, members, onDecision }) {
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState('');
  if (!payments.length) return null;

  const decide = async (payment, approve) => {
    setWorkingId(payment.id);
    setError('');
    try { await onDecision(payment.id, approve); }
    catch (err) { setError(err.message || 'Could not update the payment request.'); }
    finally { setWorkingId(''); }
  };

  return (
    <div className="card" style={{ padding: 16, marginBottom: 12, border: '1px solid var(--warning)' }}>
      <p className="t-label" style={{ marginBottom: 10 }}>Payments awaiting your approval</p>
      {payments.map(payment => {
        const payer = members.find(member => member.id === payment.from);
        return (
          <div key={payment.id} style={{ padding: '10px 0', borderTop: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2">
              <Avatar member={payer} size="xs" />
              <p className="t-body" style={{ flex: 1 }}>{payer?.name || 'A trip member'} says they paid {formatAmount(payment.amount)}</p>
            </div>
            <div className="flex gap-2" style={{ marginTop: 10 }}>
              <button type="button" className="btn btn-primary btn-sm" disabled={workingId === payment.id} onClick={() => decide(payment, true)}>
                {workingId === payment.id ? 'Saving…' : 'Approve'}
              </button>
              <button type="button" className="btn btn-outline btn-sm" disabled={workingId === payment.id} onClick={() => decide(payment, false)}>Decline</button>
            </div>
          </div>
        );
      })}
      {error && <p role="alert" className="t-caption c-danger" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}

// ── Trip Settings Sheet ───────────────────────────────────────
function TripSettingsSheet({ open, onClose, trip, members, expenses, settlements, paymentHistory }) {
  const { state, nav, deleteTrip } = useStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const isAdmin = (trip.adminIds || []).includes(state.currentUser?.id);
  const isSettled = settlements.length === 0;

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteTrip(trip.id);
      onClose();
      nav('home', {}, { replace: true });
    } catch (e) { setDeleteError(e.message || 'Could not delete trip'); }
    finally { setDeleting(false); }
  };

  const exportCSV = () => downloadCsv(
    `${trip.name.replace(/[^\w-]+/g, '_')}_expenses.csv`, expenseCsvRows(trip, members, expenses)
  );

  const exportSettlementsCSV = () => downloadCsv(
    `${trip.name.replace(/[^\w-]+/g, '_')}_settlements.csv`, settlementCsvRows(trip, members, settlements, paymentHistory)
  );

  const settingsItems = [
    ...(isAdmin && !trip.deletedAt ? [{ label: 'Edit Trip Details', icon: Edit2, onPress: () => { onClose(); nav('editTrip', { tripId: trip.id }); } }] : []),
    { label: 'Export Expenses (CSV)', icon: Download, onPress: exportCSV },
    { label: 'Export Settlements (CSV)', icon: Download, onPress: exportSettlementsCSV },
  ];

  return (
    <BottomSheet open={open} onClose={onClose} title="Trip Settings">
      <div style={{ padding: '8px 20px 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        <div className="card" style={{ padding: '4px 0' }}>
          {settingsItems.map(item => (
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

        {/* Delete — trip admins only */}
        {isAdmin && !trip.deletedAt && (
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
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {!isSettled && (
                  <div style={{ background: 'var(--warning-light)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <AlertCircle size={14} color="var(--warning)" style={{ marginTop: 2, flexShrink: 0 }} />
                    <p style={{ fontSize: 13, color: 'var(--warning)' }}>{settlements.length} unsettled payment{settlements.length > 1 ? 's' : ''} remain. Make sure everyone has paid before deleting.</p>
                  </div>
                )}
                <p style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>Delete "{trip.name}"? It will be hidden from active trips, with data retained for up to 48 hours.</p>
                {deleteError && <p role="alert" style={{ fontSize: 12, color: 'var(--danger)' }}>{deleteError}</p>}
                <div className="flex gap-3">
                  <button className="btn btn-outline flex-1 btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
                  <button className="btn btn-danger flex-1 btn-sm" onClick={handleDelete} disabled={deleting}>
                    {deleting ? 'Deleting...' : isSettled ? 'Delete Trip' : 'Delete Anyway'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

// ── Countdown Banner ─────────────────────────────────────────
function DeletedBanner({ deletedAt, members, expenses, settlements, paymentHistory, trip }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calc = () => {
      const expiry = new Date(deletedAt).getTime() + 48 * 60 * 60 * 1000;
      const diff = expiry - Date.now();
      if (diff <= 0) { setTimeLeft('Expired'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [deletedAt]);

  const exportCSV = () => downloadCsv(
    `${trip.name.replace(/[^\w-]+/g, '_')}_expenses.csv`, expenseCsvRows(trip, members, expenses)
  );

  const exportSettlementsCSV = () => downloadCsv(
    `${trip.name.replace(/[^\w-]+/g, '_')}_settlements.csv`, settlementCsvRows(trip, members, settlements, paymentHistory)
  );

  return (
    <div style={{ margin: '12px 20px', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--danger-light)' }}>
      <div style={{ background: 'var(--danger)', padding: '12px 16px' }}>
        <p style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>⚠️ This trip has been deleted</p>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>Data available for download for: <strong>{timeLeft}</strong></p>
      </div>
      <div style={{ background: 'var(--danger-light)', padding: '12px 16px', display: 'flex', gap: 8 }}>
        <button className="btn btn-sm btn-outline flex-1" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={exportCSV}>
          <Download size={13} /> Expenses
        </button>
        <button className="btn btn-sm btn-outline flex-1" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={exportSettlementsCSV}>
          <Download size={13} /> Settlements
        </button>
      </div>
    </div>
  );
}

// ── Main Screen ───────────────────────────────────────────────
export default function TripDashboardScreen() {
  const { state, nav, goBack, getTripExpenses, getTripMembers, getTripTotal, getSettlements, decideSettlementPayment } = useStore();
  const { tripId, openJoinRequests, openSettleTab } = state.screenParams;
  const trip = state.trips.find(t => t.id === tripId);
  const [tab, setTab] = useState('expenses');
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    if (openJoinRequests) setInviteOpen(true);
  }, [tripId, openJoinRequests]);
  useEffect(() => {
    if (openSettleTab) setTab('settle');
  }, [tripId, openSettleTab]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!trip) return null;

  const isDeleted = !!trip.deletedAt;
  const isAdmin = (trip.adminIds || []).includes(state.currentUser?.id);
  const members = getTripMembers(trip);
  const expenses = getTripExpenses(tripId);
  const total = getTripTotal(tripId);
  const { balances, settlements } = getSettlements(tripId);
  const myId = state.currentUser?.id;
  const paymentApprovals = state.settlementPayments.filter(payment => payment.tripId === tripId && payment.to === myId && payment.status === 'pending');
  const paymentHistory = state.settlementPayments
    .filter(payment => payment.tripId === tripId)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const visiblePaymentHistory = paymentHistory.filter(payment => !(payment.status === 'pending' && payment.to === myId));
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
          <button className="btn btn-ghost btn-icon" style={{ color: '#fff', background: 'rgba(255,255,255,0.15)' }} onClick={goBack}>
            <ArrowLeft size={20} />
          </button>
          <div className="flex gap-2">
            {!isDeleted && isAdmin && (
              <button className="btn btn-ghost btn-icon" style={{ color: '#fff', background: 'rgba(255,255,255,0.15)' }} onClick={() => setInviteOpen(true)} aria-label="Invite members and review requests">
                <Link2 size={18} />
              </button>
            )}
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

      {/* Deleted banner */}
      {isDeleted && (
        <DeletedBanner
          deletedAt={trip.deletedAt}
          trip={trip}
          members={members}
          expenses={expenses}
          settlements={settlements}
          paymentHistory={paymentHistory}
        />
      )}

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
              <EmptyState icon={Receipt} title="No expenses yet" subtitle="Add your first expense to get started" action={isDeleted ? null : 'Add Expense'} onAction={() => nav('addExpense', { tripId })} />
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
            {!isDeleted && isAdmin && <button className="btn btn-secondary btn-full" onClick={() => setInviteOpen(true)}>
              <UserPlus size={16} /> Invite Members
            </button>}
          </>
        )}

        {/* Settle tab */}
        {tab === 'settle' && (
          <>
            <PendingSettlementApprovals payments={paymentApprovals} members={members} onDecision={decideSettlementPayment} />
            {settlements.length === 0 ? (
              <div className="card card-p text-center" style={{ padding: 32 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Check size={22} color="var(--success)" />
                </div>
                <p className="t-heading mb-2">No balance currently due</p>
                <p className="t-body c-3">New expenses can create another settlement later in the trip.</p>
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
            {visiblePaymentHistory.length > 0 && (
              <div className="card" style={{ padding: '6px 16px', marginTop: 12, marginBottom: 16 }}>
                <p className="section-title" style={{ padding: '10px 0 4px' }}>Settlement history</p>
                {visiblePaymentHistory.map((payment, index) => {
                  const payer = members.find(member => member.id === payment.from);
                  const recipient = members.find(member => member.id === payment.to);
                  const statusColor = payment.status === 'approved' ? 'var(--success)' : payment.status === 'declined' ? 'var(--danger)' : 'var(--warning)';
                  const reviewer = members.find(member => member.id === payment.decidedBy);
                  return (
                    <div key={payment.id} style={{ padding: '12px 0', borderTop: '1px solid var(--border-light)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="t-label" style={{ minWidth: 0 }}>{payer?.name || 'Member'} paid {recipient?.name || 'member'}</p>
                        <p className="t-label" style={{ flexShrink: 0 }}>{formatAmount(payment.amount)}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2" style={{ marginTop: 4 }}>
                        <p className="t-caption c-3">{formatDateShort(payment.createdAt)}{reviewer ? ` · Reviewed by ${reviewer.name}` : ''}</p>
                        <span className="t-caption" style={{ color: statusColor, fontWeight: 650, textAlign: 'right' }}>{paymentStatusLabel(payment.status)}</span>
                      </div>
                      {index < visiblePaymentHistory.length - 1 && <div className="divider" style={{ marginTop: 12 }} />}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB - hidden for deleted trips */}
      {!isDeleted && (
        <button className="fab" onClick={() => nav('addExpense', { tripId })}>
          <Plus size={22} strokeWidth={2.5} />
        </button>
      )}

      {/* Sheets */}
      <TripSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        trip={trip}
        members={members}
        expenses={expenses}
        settlements={settlements}
        paymentHistory={paymentHistory}
      />
      <TripInviteSheet open={inviteOpen} onClose={() => setInviteOpen(false)} trip={trip} />
    </div>
  );
}
