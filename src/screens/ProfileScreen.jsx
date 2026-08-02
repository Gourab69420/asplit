import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Download, Info, Shield, LogOut, Edit2, Check, X, AlertCircle } from 'lucide-react';
import { useStore, AVATAR_COLORS } from '../store';
import { Avatar, BottomSheet, formatAmount } from '../components/ui';

function EditField({ label, value, onSave, placeholder, type = 'text' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => { setDraft(value); setEditing(false); };

  return (
    <div style={{ padding: '12px 16px' }}>
      <p className="t-caption c-3" style={{ marginBottom: 4 }}>{label}</p>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            type={type}
            className="input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
            style={{ height: 40, flex: 1, fontSize: 15 }}
            placeholder={placeholder}
          />
          <button onClick={handleSave} disabled={saving} style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--success-light)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {saving ? <span style={{ width: 14, height: 14, border: '2px solid var(--success)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'block' }} /> : <Check size={15} color="var(--success)" />}
          </button>
          <button onClick={handleCancel} style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface-2)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={15} color="var(--text-2)" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between" style={{ minHeight: 32 }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: value ? 'var(--text)' : 'var(--text-3)' }}>
            {value || placeholder}
          </p>
          <button onClick={() => { setDraft(value); setEditing(true); }} style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface-2)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Edit2 size={13} color="var(--text-2)" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProfileScreen() {
  const { state, dispatch, signOut, updateProfile } = useStore();
  const { currentUser, expenses, trips } = state;
  const [exportSheet, setExportSheet] = useState(false);
  const [saveError, setSaveError] = useState('');

  const uid = currentUser?.id;
  const totalSpent = expenses
    .filter(e => e.paidBy.some(p => p.memberId === uid))
    .reduce((s, e) => s + e.amount, 0);

  const handleUpdate = async (field, value) => {
    setSaveError('');
    try {
      await updateProfile({ ...currentUser, [field]: value });
    } catch (e) {
      setSaveError(e.message);
    }
  };

  const handleSignOut = async () => { await signOut(); };

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ background: 'var(--surface)', padding: '24px 20px 20px', borderBottom: '1px solid var(--border-light)' }}>
        <div className="flex items-center gap-4">
          {/* Avatar with color picker */}
          <div style={{ position: 'relative' }}>
            <Avatar member={currentUser} size="xl" />
          </div>
          <div style={{ flex: 1 }}>
            <p className="t-title">{currentUser?.name || 'Your Name'}</p>
            <p className="t-caption c-3">{currentUser?.email}</p>
            <span className="badge badge-accent" style={{ marginTop: 6 }}>Member</span>
          </div>
        </div>

        {/* Avatar color picker */}
        <div style={{ marginTop: 16 }}>
          <p className="t-caption c-3" style={{ marginBottom: 8 }}>Avatar Color</p>
          <div className="flex gap-2 flex-wrap">
            {AVATAR_COLORS.map(c => (
              <button key={c} onClick={() => handleUpdate('color', c)} style={{
                width: 28, height: 28, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                outline: currentUser?.color === c ? `3px solid ${c}` : '2px solid transparent',
                outlineOffset: 2, transition: 'outline 0.15s', flexShrink: 0,
              }} />
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3" style={{ marginTop: 20 }}>
          {[
            { label: 'Trips',    value: trips.length },
            { label: 'Expenses', value: expenses.length },
            { label: 'Paid',     value: formatAmount(totalSpent) },
          ].map(s => (
            <div key={s.label} className="flex-1" style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{s.value}</p>
              <p className="t-caption c-3">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Save error */}
        <AnimatePresence>
          {saveError && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: 'var(--danger-light)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <AlertCircle size={14} color="var(--danger)" />
              <p style={{ fontSize: 13, color: 'var(--danger)' }}>{saveError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Account — editable */}
        <div className="card" style={{ padding: '4px 0' }}>
          <p className="section-title" style={{ padding: '10px 16px 4px' }}>Account</p>

          <EditField
            label="Full Name"
            value={currentUser?.name || ''}
            placeholder="Enter your name"
            onSave={v => handleUpdate('name', v)}
          />
          <div className="divider" style={{ margin: '0 16px' }} />

          <div style={{ padding: '12px 16px' }}>
            <p className="t-caption c-3" style={{ marginBottom: 4 }}>Email</p>
            <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-2)' }}>{currentUser?.email}</p>
            <p className="t-caption c-3" style={{ marginTop: 2 }}>Managed by Google</p>
          </div>
          <div className="divider" style={{ margin: '0 16px' }} />

          <EditField
            label="UPI ID"
            value={currentUser?.upi || ''}
            placeholder="yourname@upi"
            onSave={v => handleUpdate('upi', v)}
          />
        </div>

        {/* Preferences */}
        <div className="card" style={{ padding: '4px 0' }}>
          <p className="section-title" style={{ padding: '10px 16px 4px' }}>Preferences</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Moon size={17} color="var(--text-2)" strokeWidth={1.8} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 500, flex: 1 }}>Dark Mode</p>
            <button onClick={() => dispatch({ type: 'TOGGLE_DARK' })} style={{
              width: 44, height: 26, borderRadius: 13,
              background: state.darkMode ? 'var(--accent)' : 'var(--border)',
              border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3, left: state.darkMode ? 21 : 3,
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>
        </div>

        {/* Data */}
        <div className="card" style={{ padding: '4px 0' }}>
          <p className="section-title" style={{ padding: '10px 16px 4px' }}>Data</p>
          {[
            { label: 'Export Data', sub: 'Download your expenses', onPress: () => setExportSheet(true) },
            { label: 'About ASplit', sub: 'Version 1.0.0' },
            { label: 'Privacy Policy' },
          ].map((item, i, arr) => (
            <div key={item.label}>
              <button onClick={item.onPress} style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', background: 'none', border: 'none',
                cursor: item.onPress ? 'pointer' : 'default', WebkitTapHighlightColor: 'transparent',
              }}>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>{item.label}</p>
                  {item.sub && <p className="t-caption c-3">{item.sub}</p>}
                </div>
                {item.onPress && <Download size={16} color="var(--accent)" />}
              </button>
              {i < arr.length - 1 && <div className="divider" style={{ margin: '0 16px' }} />}
            </div>
          ))}
        </div>

        {/* Sign out */}
        <div className="card" style={{ padding: '4px 0' }}>
          <button onClick={handleSignOut} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
            background: 'none', border: 'none', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--danger-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LogOut size={17} color="var(--danger)" strokeWidth={1.8} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--danger)' }}>Sign Out</p>
          </button>
        </div>

      </div>

      {/* Export Sheet */}
      <BottomSheet open={exportSheet} onClose={() => setExportSheet(false)} title="Export Data">
        <div style={{ padding: '8px 20px 24px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { label: 'Expense Report',    sub: 'All expenses with details' },
            { label: 'Settlement Report', sub: 'Who owes whom' },
            { label: 'Member Report',     sub: 'Per-person breakdown' },
            { label: 'Export as CSV',     sub: 'Spreadsheet format' },
            { label: 'Export as PDF',     sub: 'Printable report' },
          ].map(item => (
            <button key={item.label} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderRadius: 12, background: 'var(--bg)',
              border: 'none', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', textAlign: 'left' }}>{item.label}</p>
                <p className="t-caption c-3">{item.sub}</p>
              </div>
              <Download size={16} color="var(--accent)" />
            </button>
          ))}
        </div>
      </BottomSheet>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
