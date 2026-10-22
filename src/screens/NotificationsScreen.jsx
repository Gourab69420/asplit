import { ArrowLeft, Bell, CheckCheck, Receipt } from 'lucide-react';
import { useStore } from '../store';
import { Avatar, EmptyState, formatAmount, formatDateShort } from '../components/ui';

export default function NotificationsScreen() {
  const { nav, goBack, notifications, markNotificationsRead } = useStore();
  const unreadCount = notifications.filter(notification => notification.unread).length;

  const handleMarkAllRead = () => markNotificationsRead(notifications.map(notification => notification.id));

  return (
    <div className="screen">
      <div style={{ padding: '16px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-ghost btn-icon" onClick={goBack} aria-label="Go back"><ArrowLeft size={20} /></button>
        <div style={{ flex: 1 }}>
          <p className="t-heading">Notifications</p>
          <p className="t-caption c-3">Updates from your trips</p>
        </div>
        {unreadCount > 0 && (
          <button type="button" onClick={handleMarkAllRead} className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)' }}>
            <CheckCheck size={16} /> Mark all read
          </button>
        )}
      </div>

      <div style={{ padding: '16px 20px' }}>
        {notifications.length === 0 ? (
          <EmptyState icon={Bell} title="You’re all caught up" subtitle="Updates about expenses added by your trip members will appear here." />
        ) : notifications.map(({ id, expense, trip, member, unread }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              markNotificationsRead([id]);
              nav('expenseDetail', { expenseId: expense.id, tripId: expense.tripId });
            }}
            className="card"
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '14px', marginBottom: 10, border: unread ? '1px solid var(--accent)' : '1px solid var(--border-light)', cursor: 'pointer' }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--accent-light)', color: 'var(--accent)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Receipt size={19} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="t-label" style={{ marginBottom: 3 }}>{member?.name || 'A trip member'} added an expense</p>
              <p className="t-caption c-2" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {expense.title} · {trip?.name || 'Trip'} · {formatAmount(expense.amount)}
              </p>
              <p className="t-caption c-3" style={{ marginTop: 4 }}>{formatDateShort(expense.date)}</p>
            </div>
            {unread && <span aria-label="Unread" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
            {member && <Avatar member={member} size="xs" />}
          </button>
        ))}
      </div>
    </div>
  );
}
