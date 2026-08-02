import { motion } from 'framer-motion';
import { Bell, Hotel, Utensils, Car, ShoppingBag, Coffee, Fuel, Zap, MoreHorizontal } from 'lucide-react';
import { useStore } from '../store';
import { Avatar, formatAmount, formatDateShort, getCategoryMeta, EmptyState } from '../components/ui';

const CATEGORY_ICONS = { hotel: Hotel, food: Utensils, taxi: Car, transport: Car, activity: Zap, shopping: ShoppingBag, coffee: Coffee, fuel: Fuel, other: MoreHorizontal };

export default function ActivityScreen() {
  const { state, nav, getMember } = useStore();
  const { expenses, trips } = state;

  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  return (
    <div className="screen">
      <div style={{ padding: '20px 20px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border-light)' }}>
        <p className="t-title">Activity</p>
        <p className="t-caption c-3" style={{ marginTop: 2 }}>All recent transactions</p>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {sorted.length === 0 ? (
          <EmptyState icon={Bell} title="No activity yet" subtitle="Your expense history will appear here" />
        ) : (
          sorted.map((expense, i) => {
            const meta = getCategoryMeta(expense.category);
            const Icon = CATEGORY_ICONS[expense.category] || MoreHorizontal;
            const payer = getMember(expense.paidBy[0]?.memberId);
            const trip = trips.find(t => t.id === expense.tripId);
            return (
              <motion.div key={expense.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="card" style={{ padding: '14px 16px', marginBottom: 10, cursor: 'pointer' }}
                onClick={() => nav('expenseDetail', { expenseId: expense.id, tripId: expense.tripId })}>
                <div className="flex items-center gap-3">
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={20} color={meta.color} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="t-label">{expense.title}</p>
                      <p className="t-label t-mono">{formatAmount(expense.amount)}</p>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        {payer && <Avatar member={payer} size="xs" />}
                        <span className="t-caption c-3">{payer?.name.split(' ')[0]} · {trip?.name}</span>
                      </div>
                      <span className="t-caption c-3">{formatDateShort(expense.date)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
