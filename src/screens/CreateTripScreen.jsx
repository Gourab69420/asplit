import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin } from 'lucide-react';
import { useStore, AVATAR_COLORS } from '../store';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];
const COVER_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#059669', '#d97706', '#0891b2', '#dc2626', '#65a30d'];

export default function CreateTripScreen() {
  const { nav, createTrip } = useStore();
  const [form, setForm] = useState({ name: '', description: '', currency: 'INR', startDate: '', endDate: '', coverColor: COVER_COLORS[0] });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Trip name is required';
    if (!form.startDate) e.startDate = 'Start date is required';
    if (!form.endDate) e.endDate = 'End date is required';
    if (form.startDate && form.endDate && form.endDate < form.startDate) e.endDate = 'End date must be after start date';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const trip = await createTrip(form);
      nav('tripDashboard', { tripId: trip.id });
    } catch (e) {
      setErrors({ submit: e.message });
      setSaving(false);
    }
  };

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ padding: '16px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-ghost btn-icon" onClick={() => nav('home')}><ArrowLeft size={20} /></button>
        <p className="t-heading">New Trip</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Cover color */}
        <div>
          <p className="input-label mb-2">Trip Color</p>
          <div className="flex gap-3 flex-wrap">
            {COVER_COLORS.map(c => (
              <button key={c} onClick={() => set('coverColor', c)} style={{
                width: 36, height: 36, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                outline: form.coverColor === c ? `3px solid ${c}` : 'none',
                outlineOffset: 2, transition: 'outline 0.15s',
              }} />
            ))}
          </div>
        </div>

        {/* Trip name */}
        <div className="input-group">
          <label className="input-label">Trip Name *</label>
          <input className={`input input-lg ${errors.name ? 'input-error' : ''}`} placeholder="e.g. Goa Winter Trip" value={form.name} onChange={e => set('name', e.target.value)} style={errors.name ? { borderColor: 'var(--danger)' } : {}} />
          {errors.name && <p style={{ fontSize: 12, color: 'var(--danger)' }}>{errors.name}</p>}
        </div>

        {/* Description */}
        <div className="input-group">
          <label className="input-label">Description</label>
          <textarea className="textarea" placeholder="What's this trip about?" value={form.description} onChange={e => set('description', e.target.value)} />
        </div>

        {/* Currency */}
        <div className="input-group">
          <label className="input-label">Currency</label>
          <div className="flex gap-2 flex-wrap">
            {CURRENCIES.map(c => (
              <button key={c} className={`chip ${form.currency === c ? 'chip-active' : ''}`} onClick={() => set('currency', c)}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Dates */}
        <div className="flex gap-3">
          <div className="input-group flex-1">
            <label className="input-label">Start Date *</label>
            <input type="date" className="input" value={form.startDate} onChange={e => set('startDate', e.target.value)} style={errors.startDate ? { borderColor: 'var(--danger)' } : {}} />
            {errors.startDate && <p style={{ fontSize: 12, color: 'var(--danger)' }}>{errors.startDate}</p>}
          </div>
          <div className="input-group flex-1">
            <label className="input-label">End Date *</label>
            <input type="date" className="input" value={form.endDate} onChange={e => set('endDate', e.target.value)} style={errors.endDate ? { borderColor: 'var(--danger)' } : {}} />
            {errors.endDate && <p style={{ fontSize: 12, color: 'var(--danger)' }}>{errors.endDate}</p>}
          </div>
        </div>

        {/* Preview */}
        {form.name && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="card" style={{ padding: '16px', borderLeft: `4px solid ${form.coverColor}` }}>
            <div className="flex items-center gap-3">
              <div style={{ width: 40, height: 40, borderRadius: 12, background: form.coverColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={18} color="#fff" />
              </div>
              <div>
                <p className="t-heading">{form.name}</p>
                {form.description && <p className="t-caption c-3">{form.description}</p>}
              </div>
            </div>
          </motion.div>
        )}

        {errors.submit && <p style={{ fontSize: 12, color: 'var(--danger)', textAlign: 'center' }}>{errors.submit}</p>}
        <button className="btn btn-primary btn-full" style={{ marginTop: 8 }} onClick={handleCreate} disabled={saving}>
          {saving ? 'Creating...' : 'Create Trip'}
        </button>
      </motion.div>
    </div>
  );
}
