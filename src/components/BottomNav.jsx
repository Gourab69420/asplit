import { Home, Receipt, Activity, User } from 'lucide-react';
import { useStore } from '../store';

const TABS = [
  { id: 'home',     label: 'Home',     Icon: Home },
  { id: 'trips',    label: 'Trips',    Icon: Receipt },
  { id: 'activity', label: 'Activity', Icon: Activity },
  { id: 'profile',  label: 'Profile',  Icon: User },
];

export default function BottomNav() {
  const { state, nav } = useStore();
  const active = state.screen;

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: 'calc(var(--nav-h) + var(--safe-bottom))',
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(12px)',
      borderTop: '1px solid var(--border-light)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-around',
      paddingTop: 8, paddingBottom: 'var(--safe-bottom)',
      zIndex: 40,
    }}>
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id || (id === 'home' && active === 'home');
        return (
          <button
            key={id}
            onClick={() => nav(id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 4, background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px 0', minHeight: 48, WebkitTapHighlightColor: 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text-3)',
              transition: 'color 0.15s',
            }}
          >
            <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
            <span style={{ fontSize: 11, fontWeight: isActive ? 600 : 400, fontFamily: 'inherit' }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
