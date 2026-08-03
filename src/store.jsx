import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { supabase } from './supabase';

export const AVATAR_COLORS = ['#2563eb','#7c3aed','#db2777','#059669','#d97706','#dc2626','#0891b2','#65a30d'];

// ── helpers ───────────────────────────────────────────────────
function getInitials(name = '') {
  return name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}
function pickColor(id = '') {
  const n = (id.charCodeAt(0) || 0) + (id.charCodeAt(id.length - 1) || 0);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}
function mapProfile(row) {
  return { id: row.id, name: row.name || '', email: row.email || '', upi: row.upi_id || '',
    initials: getInitials(row.name), color: row.avatar_color || pickColor(row.id) };
}
function mapTrip(row, memberIds = []) {
  return { id: row.id, name: row.name, description: row.description || '', currency: row.currency || 'INR',
    startDate: row.start_date || '', endDate: row.end_date || '', status: row.status || 'upcoming',
    coverColor: row.cover_color || '#2563eb', createdBy: row.created_by, members: memberIds };
}
function mapExpense(row) {
  return { id: row.id, tripId: row.trip_id, title: row.title, amount: Number(row.amount),
    category: row.category, splitType: row.split_type, paidBy: row.paid_by || [],
    splitBetween: row.split_between || [], notes: row.notes || '',
    date: row.expense_date || '', time: row.expense_time?.slice(0, 5) || '',
    _pending: row._pending || false };
}
function calcSettlements(members, expenses) {
  const balances = {};
  members.forEach(m => { balances[m.id] = 0; });
  expenses.forEach(exp => {
    const share = exp.amount / (exp.splitBetween.length || 1);
    exp.paidBy.forEach(p => { balances[p.memberId] = (balances[p.memberId] || 0) + p.amount; });
    exp.splitBetween.forEach(mid => { balances[mid] = (balances[mid] || 0) - share; });
  });
  const creditors = [], debtors = [];
  Object.entries(balances).forEach(([id, bal]) => {
    if (bal > 0.01) creditors.push({ id, amount: bal });
    else if (bal < -0.01) debtors.push({ id, amount: -bal });
  });
  const settlements = [];
  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const amt = Math.min(creditors[ci].amount, debtors[di].amount);
    settlements.push({ from: debtors[di].id, to: creditors[ci].id, amount: Math.round(amt) });
    creditors[ci].amount -= amt; debtors[di].amount -= amt;
    if (creditors[ci].amount < 0.01) ci++;
    if (debtors[di].amount < 0.01) di++;
  }
  return { balances, settlements };
}

// ── localStorage persistence ──────────────────────────────────
const LS_KEY = 'asplit_state';
const LS_QUEUE = 'asplit_queue';

function loadCache() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; }
}
function saveCache(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      trips: state.trips, members: state.members,
      expenses: state.expenses, darkMode: state.darkMode,
      currentUser: state.currentUser,
    }));
  } catch {}
}
function loadQueue() {
  try { return JSON.parse(localStorage.getItem(LS_QUEUE) || '[]'); } catch { return []; }
}
function saveQueue(q) {
  try { localStorage.setItem(LS_QUEUE, JSON.stringify(q)); } catch {}
}

// ── initial state (hydrate from cache) ───────────────────────
const cache = loadCache();
const initialState = {
  screen: 'loading', screenParams: {},
  trips:       cache?.trips       || [],
  members:     cache?.members     || [],
  expenses:    cache?.expenses    || [],
  currentUser: cache?.currentUser || null,
  darkMode:    cache?.darkMode    ?? false,
  notifications: 0, loading: true,
  isOnline: navigator.onLine,
};

// ── reducer ───────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {
    case 'NAV':             return { ...state, screen: action.screen, screenParams: action.params || {} };
    case 'SET_USER':        return { ...state, currentUser: action.user, screen: action.user ? 'home' : 'login', loading: false };
    case 'SIGN_OUT':        return { ...initialState, trips: [], members: [], expenses: [], currentUser: null, screen: 'login', loading: false };
    case 'SET_TRIPS':       return { ...state, trips: action.trips };
    case 'SET_MEMBERS':     return { ...state, members: action.members };
    case 'SET_EXPENSES':    return { ...state, expenses: action.expenses };
    case 'ADD_TRIP':        return { ...state, trips: [action.trip, ...state.trips] };
    case 'ADD_TRIP_MEMBER': return { ...state, trips: state.trips.map(t => t.id === action.tripId ? { ...t, members: [...(t.members || []), action.userId] } : t) };
    case 'ADD_EXPENSE':     return { ...state, expenses: [action.expense, ...state.expenses] };
    case 'REPLACE_EXPENSE': return { ...state, expenses: state.expenses.map(e => e.id === action.tempId ? action.expense : e) };
    case 'DELETE_EXPENSE':  return { ...state, expenses: state.expenses.filter(e => e.id !== action.id) };
    case 'DELETE_TRIP': {
      const remaining = state.trips.filter(t => t.id !== action.tripId);
      const remainingExpenses = state.expenses.filter(e => e.tripId !== action.tripId);
      // remove members who no longer belong to any remaining trip
      const usedMemberIds = new Set(remaining.flatMap(t => t.members || []));
      const remainingMembers = state.members.filter(m => usedMemberIds.has(m.id) || m.id === state.currentUser?.id);
      return { ...state, trips: remaining, expenses: remainingExpenses, members: remainingMembers };
    }
    case 'UPDATE_PROFILE':  return { ...state, currentUser: { ...state.currentUser, ...action.data } };
    case 'TOGGLE_DARK':     return { ...state, darkMode: !state.darkMode };
    case 'SET_ONLINE':      return { ...state, isOnline: action.online };
    default:                return state;
  }
}

const StoreCtx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const nav = (screen, params) => dispatch({ type: 'NAV', screen, params });

  const getTripExpenses = (tripId) => state.expenses.filter(e => e.tripId === tripId);
  const getTripMembers  = (trip)   => state.members.filter(m => (trip?.members || []).includes(m.id));
  const getMember       = (id)     => state.members.find(m => m.id === id);
  const getTripTotal    = (tripId) => state.expenses.filter(e => e.tripId === tripId).reduce((s, e) => s + e.amount, 0);
  const getSettlements  = (tripId) => {
    const trip = state.trips.find(t => t.id === tripId);
    if (!trip) return { balances: {}, settlements: [] };
    return calcSettlements(getTripMembers(trip), getTripExpenses(tripId));
  };

  // ── persist to localStorage on every state change ─────────
  useEffect(() => { saveCache(state); }, [state]);

  // ── apply dark mode to :root ───────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (state.darkMode) {
      root.style.setProperty('--bg', '#0f0f10');
      root.style.setProperty('--surface', '#1a1a1e');
      root.style.setProperty('--surface-2', '#26262c');
      root.style.setProperty('--border', '#2e2e36');
      root.style.setProperty('--border-light', '#232329');
      root.style.setProperty('--text', '#f4f4f5');
      root.style.setProperty('--text-2', '#a1a1aa');
      root.style.setProperty('--text-3', '#71717a');
      body.style.background = '#0f0f10';
      root.style.background = '#0f0f10';
      if (metaTheme) metaTheme.setAttribute('content', '#0f0f10');
    } else {
      ['--bg','--surface','--surface-2','--border','--border-light','--text','--text-2','--text-3']
        .forEach(k => root.style.removeProperty(k));
      body.style.background = '';
      root.style.background = '';
      if (metaTheme) metaTheme.setAttribute('content', '#ffffff');
    }
  }, [state.darkMode]);

  // ── online/offline detection ───────────────────────────────
  useEffect(() => {
    const setOnline  = () => { dispatch({ type: 'SET_ONLINE', online: true });  flushQueue(); };
    const setOffline = () =>   dispatch({ type: 'SET_ONLINE', online: false });
    window.addEventListener('online',  setOnline);
    window.addEventListener('offline', setOffline);
    return () => { window.removeEventListener('online', setOnline); window.removeEventListener('offline', setOffline); };
  }, []);

  // ── offline queue flush ────────────────────────────────────
  async function flushQueue() {
    const queue = loadQueue();
    if (!queue.length) return;
    const remaining = [];
    for (const op of queue) {
      try {
        if (op.type === 'ADD_EXPENSE') {
          const { data: exp, error } = await supabase.from('expenses').insert(op.payload).select().single();
          if (error) throw error;
          // replace temp expense with real one
          dispatch({ type: 'REPLACE_EXPENSE', tempId: op.tempId, expense: mapExpense(exp) });
        } else if (op.type === 'DELETE_EXPENSE') {
          const { error } = await supabase.from('expenses').delete().eq('id', op.id);
          if (error) throw error;
        } else if (op.type === 'CREATE_TRIP') {
          const { data: trip, error } = await supabase.from('trips').insert(op.payload).select().single();
          if (error) throw error;
          await supabase.from('trip_members').insert({ trip_id: trip.id, user_id: op.userId, role: 'admin' });
        } else if (op.type === 'UPDATE_PROFILE') {
          await supabase.from('profiles').update(op.patch).eq('id', op.userId);
        }
      } catch {
        remaining.push(op); // retry later
      }
    }
    saveQueue(remaining);
  }

  // ── auth listener ──────────────────────────────────────────
  useEffect(() => {
    // If we have cached user, show app immediately while loading
    if (cache?.currentUser) {
      dispatch({ type: 'SET_USER', user: cache.currentUser });
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) initUser(session.user);
      else if (!cache?.currentUser) dispatch({ type: 'SET_USER', user: null });
      else dispatch({ type: 'NAV', screen: 'home' }); // stay on cached data
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) initUser(session.user);
      else dispatch({ type: 'SET_USER', user: null });
    });
    return () => subscription.unsubscribe();
  }, []);

  async function initUser(authUser) {
    const userId = authUser.id;
    const name = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || '';
    const email = authUser.email || '';

    let { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!profile) {
      const { data: inserted } = await supabase.from('profiles').insert({ id: userId, name, email }).select().maybeSingle();
      profile = inserted;
    }
    if (!profile) profile = { id: userId, name, email, upi_id: '', avatar_color: pickColor(userId) };

    dispatch({ type: 'SET_USER', user: mapProfile(profile) });
    if (navigator.onLine) {
      await loadUserData(userId);
      flushQueue();
    }
  }

  async function loadUserData(userId) {
    const { data: memberRows } = await supabase.from('trip_members').select('trip_id, role').eq('user_id', userId);
    if (!memberRows?.length) return;
    const tripIds = memberRows.map(r => r.trip_id);

    const { data: tripRows } = await supabase.from('trips').select('*').in('id', tripIds).order('created_at', { ascending: false });
    if (!tripRows?.length) return;

    const { data: allMemberRows } = await supabase.from('trip_members').select('trip_id, user_id').in('trip_id', tripIds);
    const trips = tripRows.map(t => {
      const mIds = (allMemberRows || []).filter(r => r.trip_id === t.id).map(r => r.user_id);
      return mapTrip(t, mIds);
    });
    dispatch({ type: 'SET_TRIPS', trips });

    const allUserIds = [...new Set((allMemberRows || []).map(r => r.user_id))];
    if (allUserIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', allUserIds);
      dispatch({ type: 'SET_MEMBERS', members: (profiles || []).map(mapProfile) });
    }

    const { data: expRows } = await supabase.from('expenses').select('*').in('trip_id', tripIds).order('expense_date', { ascending: false });
    dispatch({ type: 'SET_EXPENSES', expenses: (expRows || []).map(mapExpense) });
  }

  // ── auth actions ───────────────────────────────────────────
  const signInGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_QUEUE);
    dispatch({ type: 'SIGN_OUT' });
  }, []);

  // ── data actions ───────────────────────────────────────────
  const createTrip = useCallback(async (form) => {
    const userId = stateRef.current.currentUser?.id;
    if (!userId) throw new Error('Not signed in');
    const payload = {
      name: form.name, description: form.description, currency: form.currency,
      start_date: form.startDate, end_date: form.endDate,
      status: 'upcoming', cover_color: form.coverColor, created_by: userId,
    };
    if (!navigator.onLine) {
      const tempId = 'tmp_' + Date.now();
      const mapped = mapTrip({ ...payload, id: tempId, _pending: true }, [userId]);
      dispatch({ type: 'ADD_TRIP', trip: mapped });
      const q = loadQueue(); q.push({ type: 'CREATE_TRIP', payload, userId, tempId }); saveQueue(q);
      return mapped;
    }
    const { data: trip, error } = await supabase.from('trips').insert(payload).select().single();
    if (error) throw error;
    await supabase.from('trip_members').insert({ trip_id: trip.id, user_id: userId, role: 'admin' });
    const mapped = mapTrip(trip, [userId]);
    dispatch({ type: 'ADD_TRIP', trip: mapped });
    const cur = stateRef.current;
    dispatch({ type: 'SET_MEMBERS', members: cur.members.some(m => m.id === userId) ? cur.members : [...cur.members, mapProfile({ id: userId, name: cur.currentUser.name, email: cur.currentUser.email, upi_id: cur.currentUser.upi, avatar_color: cur.currentUser.color })] });
    return mapped;
  }, []);

  const addExpense = useCallback(async (form) => {
    const userId = stateRef.current.currentUser?.id;
    const payload = {
      trip_id: form.tripId, title: form.title, amount: form.amount,
      category: form.category, split_type: form.splitType,
      paid_by: form.paidBy, split_between: form.splitBetween,
      notes: form.notes, expense_date: form.date, expense_time: form.time,
      created_by: userId,
    };
    if (!navigator.onLine) {
      const tempId = 'tmp_' + Date.now();
      const mapped = mapExpense({ ...payload, id: tempId, _pending: true });
      dispatch({ type: 'ADD_EXPENSE', expense: mapped });
      const q = loadQueue(); q.push({ type: 'ADD_EXPENSE', payload, tempId }); saveQueue(q);
      return mapped;
    }
    const { data: exp, error } = await supabase.from('expenses').insert(payload).select().single();
    if (error) throw error;
    const mapped = mapExpense(exp);
    dispatch({ type: 'ADD_EXPENSE', expense: mapped });
    return mapped;
  }, []);

  const deleteExpense = useCallback(async (id) => {
    dispatch({ type: 'DELETE_EXPENSE', id });
    if (!navigator.onLine) {
      const q = loadQueue(); q.push({ type: 'DELETE_EXPENSE', id }); saveQueue(q);
      return;
    }
    await supabase.from('expenses').delete().eq('id', id);
  }, []);

  const updateProfile = useCallback(async (data) => {
    const userId = stateRef.current.currentUser?.id;
    if (!userId) throw new Error('Not signed in');
    const patch = {};
    if (data.name  !== undefined) patch.name         = data.name;
    if (data.upi   !== undefined) patch.upi_id       = data.upi;
    if (data.color !== undefined) patch.avatar_color = data.color;
    dispatch({ type: 'UPDATE_PROFILE', data: {
      name:     data.name  ?? stateRef.current.currentUser.name,
      upi:      data.upi   ?? stateRef.current.currentUser.upi,
      color:    data.color ?? stateRef.current.currentUser.color,
      initials: data.name != null ? getInitials(data.name) : stateRef.current.currentUser.initials,
    }});
    if (!navigator.onLine) {
      const q = loadQueue(); q.push({ type: 'UPDATE_PROFILE', patch, userId }); saveQueue(q);
      return;
    }
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
    if (error) throw error;
  }, []);

  return (
    <StoreCtx.Provider value={{
      state, dispatch, nav,
      getTripExpenses, getTripMembers, getMember, getTripTotal, getSettlements,
      signInGoogle, signOut, createTrip, addExpense, deleteExpense, updateProfile,
    }}>
      {children}
    </StoreCtx.Provider>
  );
}

export const useStore = () => useContext(StoreCtx);
