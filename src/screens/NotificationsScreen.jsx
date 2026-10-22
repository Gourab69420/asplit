import { useEffect, useState } from 'react';
import { ArrowLeft, Bell, Check, CircleDollarSign, Receipt, UserPlus } from 'lucide-react';
import { useStore } from '../store';
import { EmptyState, formatDateShort } from '../components/ui';

export default function NotificationsScreen() {
  const { nav, goBack, notifications, markNotificationsViewed, decideSettlementPayment, refreshNotifications } = useStore();
  const [error, setError] = useState('');
  const [workingId, setWorkingId] = useState('');
  const unreadIds = notifications.filter(notification => !notification.viewedAt).map(notification => notification.id);
  const unreadKey = unreadIds.join(',');

  useEffect(() => {
    if (!unreadKey) return;
    markNotificationsViewed(unreadKey.split(',')).catch(err => setError(err.message || 'Could not mark notifications as viewed.'));
  }, [unreadKey, markNotificationsViewed]);

  const openNotification = async notification => {
    if (!notification.viewedAt) {
      try { await markNotificationsViewed([notification.id]); } catch (err) { setError(err.message || 'Could not update this notification.'); }
    }
    const tripId = notification.data?.trip_id;
    if (notification.data?.expense_id) nav('expenseDetail', { expenseId: notification.data.expense_id, tripId });
    else if (tripId && notification.type === 'trip_join_request') nav('tripDashboard', { tripId, openJoinRequests: true });
    else if (tripId && notification.type.startsWith('settlement_payment')) nav('tripDashboard', { tripId, openSettleTab: true });
    else if (tripId && notification.type !== 'trip_join_declined') nav('tripDashboard', { tripId });
    else nav('trips');
  };

  const handlePaymentDecision = async (event, notification, approve) => {
    event.stopPropagation();
    const paymentId = notification.data?.payment_id;
    if (!paymentId) return;
    setWorkingId(paymentId);
    setError('');
    try {
      await decideSettlementPayment(paymentId, approve);
      await refreshNotifications();
    } catch (err) {
      setError(err.message || 'Could not update this payment request.');
    } finally {
      setWorkingId('');
    }
  };

  return (
    <div className="screen">
      <div style={{ padding: '16px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-ghost btn-icon" onClick={goBack} aria-label="Go back"><ArrowLeft size={20} /></button>
        <div style={{ flex: 1 }}>
          <p className="t-heading">Notifications</p>
          <p className="t-caption c-3">Updates from your trips</p>
        </div>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {error && <p role="alert" className="t-caption c-danger" style={{ marginBottom: 12 }}>{error}</p>}
        {notifications.length === 0 ? (
          <EmptyState icon={Bell} title="You’re all caught up" subtitle="Trip join requests and expense updates will appear here. Viewed notifications are removed after 24 hours." />
        ) : notifications.map(notification => {
          const unread = !notification.viewedAt;
          const Icon = notification.type === 'expense_added' ? Receipt
            : notification.type.startsWith('settlement_payment') ? CircleDollarSign
              : UserPlus;
          const remainingHours = notification.viewedAt
            ? Math.max(0, 24 - (Date.now() - Date.parse(notification.viewedAt)) / 3600000)
            : null;
          const canApprovePayment = notification.type === 'settlement_payment_request' && !notification.data?.decision;
          return (
          <div
            key={notification.id}
            className="card"
            style={{ width: '100%', padding: '14px', marginBottom: 10, border: unread ? '1px solid var(--accent)' : '1px solid var(--border-light)' }}
          >
            <button type="button" onClick={() => openNotification(notification)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 0, border: 0, background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--accent-light)', color: 'var(--accent)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon size={19} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="t-label" style={{ marginBottom: 3 }}>{notification.title}</p>
                <p className="t-caption c-2">{notification.body}</p>
                <p className="t-caption c-3" style={{ marginTop: 4 }}>
                  {formatDateShort(notification.createdAt)}{remainingHours != null ? ` · Removed in ${Math.ceil(remainingHours)}h` : ' · Expires 24h after viewing'}
                </p>
              </div>
              {unread ? <span aria-label="Unread" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} /> : <Check size={16} color="var(--text-3)" />}
            </button>
            {canApprovePayment && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingLeft: 54 }}>
                <button type="button" className="btn btn-primary btn-sm" disabled={workingId === notification.data?.payment_id} onClick={event => handlePaymentDecision(event, notification, true)}>
                  {workingId === notification.data?.payment_id ? 'Saving…' : 'Approve payment'}
                </button>
                <button type="button" className="btn btn-outline btn-sm" disabled={workingId === notification.data?.payment_id} onClick={event => handlePaymentDecision(event, notification, false)}>Decline</button>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
