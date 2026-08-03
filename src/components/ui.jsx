import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export function Avatar({ member, size = 'md', style = {} }) {
  if (!member) return null;
  return (
    <div className={`avatar avatar-${size}`} style={{ background: member.color, ...style }}>
      {member.initials}
    </div>
  );
}

export function AvatarStack({ members, max = 4, size = 'sm' }) {
  const shown = members.slice(0, max);
  const extra = members.length - max;
  const sizes = { xs: 24, sm: 32, md: 40 };
  const px = sizes[size] || 32;
  return (
    <div className="flex items-center" style={{ paddingLeft: px * 0.3 }}>
      {shown.map((m, i) => (
        <div key={m.id} style={{ marginLeft: i === 0 ? 0 : -(px * 0.3), zIndex: shown.length - i }}>
          <Avatar member={m} size={size} style={{ border: '2px solid var(--surface)' }} />
        </div>
      ))}
      {extra > 0 && (
        <div className={`avatar avatar-${size}`} style={{ marginLeft: -(px * 0.3), background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 11, fontWeight: 600, border: '2px solid var(--surface)' }}>
          +{extra}
        </div>
      )}
    </div>
  );
}

export function BottomSheet({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, backdropFilter: 'blur(2px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            style={{
              position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
              width: '100%', maxWidth: 480,
              background: 'var(--surface)',
              borderRadius: '20px 20px 0 0',
              zIndex: 101,
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
              maxHeight: '90dvh', overflowY: 'auto',
            }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 4px' }} />
            {title && (
              <div className="flex items-center justify-between px-5 py-3">
                <span className="t-heading">{title}</span>
                <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
              </div>
            )}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function IconBox({ icon: Icon, color, bg, size = 18 }) {
  return (
    <div className="icon-box" style={{ background: bg || 'var(--surface-2)' }}>
      <Icon size={size} color={color || 'var(--text-2)'} strokeWidth={1.8} />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, subtitle, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ padding: '48px 32px' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Icon size={28} color="var(--text-3)" strokeWidth={1.5} />
      </div>
      <p className="t-heading mb-2">{title}</p>
      <p className="t-body c-3" style={{ marginBottom: action ? 24 : 0 }}>{subtitle}</p>
      {action && <button className="btn btn-primary" onClick={onAction}>{action}</button>}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card card-p" style={{ marginBottom: 12 }}>
      <div className="skeleton" style={{ height: 16, width: '60%', marginBottom: 10 }} />
      <div className="skeleton" style={{ height: 12, width: '40%', marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 24, width: '30%' }} />
    </div>
  );
}

export function formatAmount(amount) {
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateShort(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const CATEGORY_MAP = {
  hotel:     { label: 'Hotel',     color: '#7c3aed', bg: '#f5f3ff' },
  food:      { label: 'Food',      color: '#d97706', bg: '#fffbeb' },
  taxi:      { label: 'Taxi',      color: '#0891b2', bg: '#ecfeff' },
  transport: { label: 'Transport', color: '#059669', bg: '#f0fdf4' },
  activity:  { label: 'Activity',  color: '#db2777', bg: '#fdf2f8' },
  shopping:  { label: 'Shopping',  color: '#2563eb', bg: '#eff4ff' },
  fuel:      { label: 'Fuel',      color: '#65a30d', bg: '#f7fee7' },
  coffee:    { label: 'Coffee',    color: '#92400e', bg: '#fef3c7' },
  other:     { label: 'Other',     color: '#6b7280', bg: '#f3f4f6' },
};
export const getCategoryMeta = (cat) => CATEGORY_MAP[cat] || CATEGORY_MAP.other;
