import { motion } from 'framer-motion';
import { Plus, Receipt, Calendar, Users, ChevronRight } from 'lucide-react';
import { useStore } from '../store';
import { AvatarStack, formatAmount, formatDateShort, EmptyState } from '../components/ui';

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

export default function TripsScreen() {
  const { state, nav, getTripMembers, getTripTotal } = useStore();
  const { trips } = state;

  return (
    <div className="screen">
      <div style={{ padding: '20px 20px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p className="t-title">All Trips</p>
        <button className="btn btn-secondary btn-sm" onClick={() => nav('createTrip')}>
          <Plus size={14} /> New
        </button>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {trips.length === 0 ? (
          <EmptyState icon={Receipt} title="No trips yet" subtitle="Create your first trip to start tracking expenses" action="Create Trip" onAction={() => nav('createTrip')} />
        ) : (
          <motion.div variants={container} initial="hidden" animate="show">
            {trips.map(trip => {
              const members = getTripMembers(trip);
              const total = getTripTotal(trip.id);
              return (
                <motion.div key={trip.id} variants={fadeUp} className="card" style={{ padding: '16px', marginBottom: 12, cursor: 'pointer' }} onClick={() => nav('tripDashboard', { tripId: trip.id })}>
                  <div className="flex items-center gap-3">
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: trip.coverColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 20 }}>✈</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="t-heading">{trip.name}</p>
                        <ChevronRight size={16} color="var(--text-3)" />
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1">
                          <Calendar size={11} color="var(--text-3)" />
                          <span className="t-caption c-3">{formatDateShort(trip.startDate)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users size={11} color="var(--text-3)" />
                          <span className="t-caption c-3">{members.length}</span>
                        </div>
                        <span className="t-caption" style={{ color: 'var(--accent)', fontWeight: 600 }}>{formatAmount(total)}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      <button className="fab" onClick={() => nav('createTrip')}>
        <Plus size={22} strokeWidth={2.5} />
      </button>
    </div>
  );
}
