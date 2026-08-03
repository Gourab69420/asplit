import { AnimatePresence, motion } from 'framer-motion';
import { StoreProvider, useStore } from './store';
import BottomNav from './components/BottomNav';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import TripsScreen from './screens/TripsScreen';
import ActivityScreen from './screens/ActivityScreen';
import ProfileScreen from './screens/ProfileScreen';
import CreateTripScreen from './screens/CreateTripScreen';
import TripDashboardScreen from './screens/TripDashboardScreen';
import AddExpenseScreen from './screens/AddExpenseScreen';
import ExpenseDetailScreen from './screens/ExpenseDetailScreen';
import SettlementScreen from './screens/SettlementScreen';
import SheetSyncScreen from './screens/SheetSyncScreen';

const SCREEN_MAP = {
  home:          HomeScreen,
  trips:         TripsScreen,
  activity:      ActivityScreen,
  profile:       ProfileScreen,
  createTrip:    CreateTripScreen,
  tripDashboard: TripDashboardScreen,
  addExpense:    AddExpenseScreen,
  expenseDetail: ExpenseDetailScreen,
  settlement:    SettlementScreen,
  sheetSync:     SheetSyncScreen,
};

const TAB_SCREENS = new Set(['home', 'trips', 'activity', 'profile']);

function LoadingSplash() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', gap: 16 }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(37,99,235,0.25)' }}>
        <span style={{ color: '#fff', fontSize: 26, fontWeight: 800, fontFamily: 'Inter,sans-serif' }}>A</span>
      </div>
      <div style={{ width: 24, height: 24, border: '2.5px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AppInner() {
  const { state } = useStore();
  const { screen, currentUser, loading } = state;

  if (loading) {
    return (
      <div className="app-shell">
        <LoadingSplash />
      </div>
    );
  }

  if (!currentUser || screen === 'login') {
    return (
      <div className="app-shell">
        <AnimatePresence mode="wait">
          <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <LoginScreen />
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  const Screen = SCREEN_MAP[screen] || HomeScreen;
  const isTab = TAB_SCREENS.has(screen);

  return (
    <div className="app-shell">
      {!state.isOnline && (
        <div style={{ background: '#d97706', color: '#fff', fontSize: 12, fontWeight: 600, textAlign: 'center', padding: '6px', letterSpacing: 0.3, zIndex: 200, flexShrink: 0 }}>
          ⚡ Offline — changes will sync when connected
        </div>
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0, x: isTab ? 0 : 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: isTab ? 0 : -18 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          <Screen />
        </motion.div>
      </AnimatePresence>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppInner />
    </StoreProvider>
  );
}
