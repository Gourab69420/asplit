import { motion } from 'framer-motion';
import { ArrowLeft, Trash2, Hotel, Utensils, Car, ShoppingBag, Coffee, Fuel, Zap, MoreHorizontal } from 'lucide-react';
import { useStore } from '../store';
import { Avatar, formatAmount, formatDate, getCategoryMeta } from '../components/ui';

const CATEGORY_ICONS = { hotel: Hotel, food: Utensils, taxi: Car, transport: Car, activity: Zap, shopping: ShoppingBag, coffee: Coffee, fuel: Fuel, other: MoreHorizontal };

export default function ExpenseDetailScreen() {
  const { state, nav, deleteExpense, getMember } = useStore();
  const { expenseId, tripId } = state.screenParams;
  const expense = state.expenses.find(e => e.id === expenseId);
  if (!expense) return null;

  const meta = getCategoryMeta(expense.category);
  const Icon = CATEGORY_ICONS[expense.category] || MoreHorizontal;
  const perPerson = expense.amount / (expense.splitBetween.length || 1);

  const handleDelete = async () => {
    try { await deleteExpense(expenseId); } catch (e) { console.error(e); }
    nav('tripDashboard', { tripId });
  };

  return (
    <div className="screen">
      <div style={{ background: meta.bg, padding: '16px 20px 24px' }}>
        <div className="flex items-center justify-between mb-4">
          <button className="btn btn-ghost btn-icon" style={{ background: 'rgba(0,0,0,0.06)' }} onClick={() => nav('tripDashboard', { tripId })}>
            <ArrowLeft size={20} />
          </button>
          <button className="btn btn-ghost btn-icon" style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--danger)' }} onClick={handleDelete}>
            <Trash2 size={18} />
          </button>
        </div>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, boxShadow: 'var(--shadow-sm)' }}>
          <Icon size={24} color={meta.color} strokeWidth={1.8} />
        </div>
        <p style={{ fontSize: 13, color: meta.color, fontWeight: 500, marginBottom: 4 }}>{meta.label}</p>
        <p className="t-title" style={{ marginBottom: 4 }}>{expense.title}</p>
        <p className="t-amount">{formatAmount(expense.amount)}</p>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>{formatDate(expense.date)} at {expense.time}</p>
      </div>

      <div style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Paid by */}
        <div className="card card-p">
          <p className="t-caption c-3" style={{ marginBottom: 12 }}>PAID BY</p>
          {expense.paidBy.map(p => {
            const m = getMember(p.memberId);
            return m ? (
              <div key={p.memberId} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar member={m} size="sm" />
                  <p className="t-label">{m.name}</p>
                </div>
                <p className="t-label t-mono">{formatAmount(p.amount)}</p>
              </div>
            ) : null;
          })}
        </div>

        {/* Split between */}
        <div className="card card-p">
          <p className="t-caption c-3" style={{ marginBottom: 12 }}>SPLIT BETWEEN · {expense.splitBetween.length} people</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {expense.splitBetween.map(id => {
              const m = getMember(id);
              return m ? (
                <div key={id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar member={m} size="sm" />
                    <p className="t-label">{m.name}</p>
                  </div>
                  <p className="t-label t-mono c-2">{formatAmount(perPerson)}</p>
                </div>
              ) : null;
            })}
          </div>
        </div>

        {expense.notes && (
          <div className="card card-p">
            <p className="t-caption c-3" style={{ marginBottom: 6 }}>NOTES</p>
            <p className="t-body">{expense.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
