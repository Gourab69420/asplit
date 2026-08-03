import { motion } from 'framer-motion';
import { Bell, Search, Plus, Users, Calendar, IndianRupee } from 'lucide-react';
import { useStore } from '../store';
import { Avatar, AvatarStack, formatAmount, formatDateShort } from '../components/ui';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };
const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

function TripCard({ trip, onPress }) {
  const { getTripMembers, getTripTotal, getSettlements } = useStore();
  const members = getTripMembers(trip);
  const total = getTripTotal(trip.id);
  const { settlements } = getSettlements(trip.id);
  const settled = settlements.length === 0;

  return (
    <motion.div variants={fadeUp} className="card" style={{ padding: '18px 16px', cursor: 'pointer', marginBottom: 12 }} onClick={onPress}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div style={{ width: 40, height: 40, borderRadius: 12, background: trip.coverColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 18 }}>✈</span>
          </div>
          <div>
            <p className="t-heading" style={{ marginBottom: 2 }}>{trip.name}</p>
            <div className="flex items-center gap-1">
              <Calendar size={11} color="var(--text-3)" />
              <span className="t-caption c-3">{formatDateShort(trip.startDate)} – {formatDateShort(trip.endDate)}</span>
            </div>
          </div>
        </div>
        <span className={`badge ${trip.status === 'active' ? 'badge-accent' : 'badge-neutral'}`}>
          {trip.status === 'active' ? 'Active' : 'Upcoming'}
        </span>
      </div>

      <div className="divider" style={{ margin: '12px 0' }} />

      <div className="flex items-center justify-between">
        <div>
          <p className="t-caption c-3" style={{ marginBottom: 2 }}>Total Expenses</p>
          <p className="t-amount-sm">{formatAmount(total)}</p>
        </div>
        <div className="flex flex-col items-center" style={{ gap: 4 }}>
          <AvatarStack members={members} size="xs" />
          <span className="t-caption c-3">{members.length} members</span>
        </div>
        <div className="flex flex-col items-end" style={{ gap: 4 }}>
          <span className={`badge ${settled ? 'badge-success' : 'badge-danger'}`}>
            {settled ? 'Settled' : `${settlements.length} pending`}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export default function HomeScreen() {
  const { state, nav } = useStore();
  const { trips, currentUser, notifications } = state;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const activeTrips  = trips.filter(t => !t.deletedAt);
  const deletedTrips = trips.filter(t => !!t.deletedAt);

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border-light)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar member={currentUser} size="md" />
            <div>
              <p className="t-caption c-3">{greeting}</p>
              <p className="t-heading">{currentUser.name.split(' ')[0]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-icon-sq" style={{ position: 'relative' }} onClick={() => nav('activity')}>
              <Bell size={20} strokeWidth={1.8} />
              {notifications > 0 && (
                <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', border: '2px solid var(--surface)' }} />
              )}
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={16} color="var(--text-3)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input className="input" placeholder="Search trips or expenses..." style={{ paddingLeft: 40, height: 44 }} readOnly />
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ padding: '16px 20px', background: 'var(--surface)', marginBottom: 8, borderBottom: '1px solid var(--border-light)' }}>
        <div className="flex gap-3">
          {[
            { label: 'Total Trips', value: activeTrips.length, color: 'var(--accent)' },
            { label: 'Active', value: activeTrips.filter(t => t.status === 'active').length, color: 'var(--success)' },
            { label: 'Pending', value: activeTrips.reduce((s, t) => s + (t.status === 'active' ? 1 : 0), 0), color: 'var(--warning)' },
          ].map(item => (
            <div key={item.label} className="flex-1" style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px' }}>
              <p style={{ fontSize: 20, fontWeight: 700, color: item.color, fontVariantNumeric: 'tabular-nums' }}>{item.value}</p>
              <p className="t-caption c-3">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Trips */}
      <div style={{ padding: '16px 20px 0' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="t-heading">Your Trips</p>
          <button className="btn btn-secondary btn-sm" onClick={() => nav('createTrip')}>
            <Plus size={14} /> New Trip
          </button>
        </div>

        <motion.div variants={container} initial="hidden" animate="show">
          {activeTrips.map(trip => (
            <TripCard key={trip.id} trip={trip} onPress={() => nav('tripDashboard', { tripId: trip.id })} />
          ))}
        </motion.div>

        {/* Deleted trips — read-only with countdown */}
        {deletedTrips.length > 0 && (
          <>
            <p className="t-caption c-3" style={{ marginTop: 20, marginBottom: 8 }}>RECENTLY DELETED</p>
            {deletedTrips.map(trip => {
              const expiry = new Date(trip.deletedAt).getTime() + 48 * 60 * 60 * 1000;
              const hoursLeft = Math.max(0, Math.ceil((expiry - Date.now()) / 3600000));
              return (
                <motion.div key={trip.id} variants={fadeUp} className="card" style={{ padding: '14px 16px', marginBottom: 12, cursor: 'pointer', opacity: 0.7, borderLeft: '3px solid var(--danger)' }}
                  onClick={() => nav('tripDashboard', { tripId: trip.id })}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: trip.coverColor, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}>
                        <span style={{ fontSize: 16 }}>✈</span>
                      </div>
                      <div>
                        <p className="t-label" style={{ textDecoration: 'line-through' }}>{trip.name}</p>
                        <p className="t-caption" style={{ color: 'var(--danger)' }}>Deleted · {hoursLeft}h left to download</p>
                      </div>
                    </div>
                    <span className="badge badge-danger">Deleted</span>
                  </div>
                </motion.div>
              );
            })}
          </>
        )}
      </div>

      {/* FAB */}
      <button className="fab" onClick={() => nav('createTrip')}>
        <Plus size={22} strokeWidth={2.5} />
      </button>
    </div>
  );
}
