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
  return { id: row.id, name: row.name || '', email: row.email || '', upi: row.upi_id || '', phone: row.phone || '',
    initials: getInitials(row.name), color: row.avatar_color || pickColor(row.id) };
}
function mapTrip(row, memberIds = [], adminIds = []) {
  return { id: row.id, name: row.name, description: row.description || '', currency: row.currency || 'INR',
    startDate: row.start_date || '', endDate: row.end_date || '', status: row.status || 'upcoming',
    coverColor: row.cover_color || '#2563eb', createdBy: row.created_by, members: memberIds, adminIds,
    deletedAt: row.deleted_at || null };
}
function mapExpense(row) {
  return { id: row.id, tripId: row.trip_id, title: row.title, amount: Number(row.amount),
    category: row.category, splitType: row.split_type, paidBy: row.paid_by || [],
    splitBetween: row.split_between || [], splitAmounts: row.split_amounts || [], notes: row.notes || '',
    date: row.expense_date || '', time: row.expense_time?.slice(0, 5) || '',
    createdBy: row.created_by || '', createdAt: row.created_at || '',
    _pending: row._pending || false };
}
function mapNotification(row) {
  return {
    id: row.id, type: row.type, title: row.title, body: row.body,
    data: row.data || {}, createdAt: row.created_at || '', viewedAt: row.viewed_at || null,
  };
}
function calcSettlements(members, expenses) {
  const balances = {};
  members.forEach(m => { balances[m.id] = 0; });
  expenses.forEach(exp => {
    exp.paidBy.forEach(p => { balances[p.memberId] = (balances[p.memberId] || 0) + p.amount; });
    if (exp.splitAmounts?.length) {
      exp.splitAmounts.forEach(share => { balances[share.memberId] = (balances[share.memberId] || 0) - Number(share.amount || 0); });
    } else {
      const share = exp.amount / (exp.splitBetween.length || 1);
      exp.splitBetween.forEach(mid => { balances[mid] = (balances[mid] || 0) - share; });
    }
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
    settlements.push({ from: debtors[di].id, to: creditors[ci].id, amount: Math.round(amt * 100) / 100 });
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
      currentUser: state.currentUser, notifications: state.notifications,
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
  notifications: cache?.notifications || [],
  exitPromptOpen: false, loading: true,
  isOnline: navigator.onLine,
};

// ── reducer ───────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {
    case 'NAV':             return { ...state, screen: action.screen, screenParams: action.params || {} };
    case 'SET_NOTIFICATIONS': return { ...state, notifications: action.notifications };
    case 'MARK_NOTIFICATIONS_VIEWED': return { ...state, notifications: state.notifications.map(item => action.ids.includes(item.id) && !item.viewedAt ? { ...item, viewedAt: action.viewedAt } : item) };
    case 'SHOW_EXIT_PROMPT': return { ...state, exitPromptOpen: true };
    case 'HIDE_EXIT_PROMPT': return { ...state, exitPromptOpen: false };
    case 'SET_USER':        return { ...state, currentUser: action.user, screen: action.user ? 'home' : 'login', loading: false };
    case 'SIGN_OUT':        return { ...initialState, trips: [], members: [], expenses: [], notifications: [], currentUser: null, screen: 'login', loading: false };
    case 'SET_TRIPS':       return { ...state, trips: action.trips };
    case 'SET_MEMBERS':     return { ...state, members: action.members };
    case 'SET_EXPENSES':    return { ...state, expenses: action.expenses };
    case 'ADD_TRIP':        return { ...state, trips: [action.trip, ...state.trips] };
    case 'UPDATE_TRIP':     return { ...state, trips: state.trips.map(t => t.id === action.trip.id ? action.trip : t) };
    case 'ADD_TRIP_MEMBER': return { ...state, trips: state.trips.map(t => t.id === action.tripId ? { ...t, members: [...(t.members || []), action.userId] } : t) };
    case 'ADD_EXPENSE':     return { ...state, expenses: [action.expense, ...state.expenses] };
    case 'REPLACE_EXPENSE': return { ...state, expenses: state.expenses.map(e => e.id === action.tempId ? action.expense : e) };
    case 'DELETE_EXPENSE':  return { ...state, expenses: state.expenses.filter(e => e.id !== action.id) };
    case 'DELETE_TRIP': {
      // Soft-delete: mark trip as deleted, keep expenses for 48h download
      const deletedAt = action.deletedAt || new Date().toISOString();
      const remaining = state.trips.map(t => t.id === action.tripId ? { ...t, deletedAt } : t);
      // remove members who no longer belong to any non-deleted trip
      const activeTrips = remaining.filter(t => !t.deletedAt);
      const usedMemberIds = new Set(activeTrips.flatMap(t => t.members || []));
      const remainingMembers = state.members.filter(m => usedMemberIds.has(m.id) || m.id === state.currentUser?.id);
      return { ...state, trips: remaining, members: remainingMembers };
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

  const navStackRef = useRef([{ key: 'asplit-root', screen: 'home', params: {} }]);
  const navSequenceRef = useRef(0);
  const historyInitializedRef = useRef(false);
  const nav = (screen, params = {}, { replace = false } = {}) => {
    const stack = navStackRef.current;
    const current = stack[stack.length - 1];
    const nextParams = params || {};
    if (!replace && current.screen === screen && JSON.stringify(current.params) === JSON.stringify(nextParams)) return;
    const entry = { key: `asplit-${++navSequenceRef.current}`, screen, params: nextParams };
    if (replace && stack.length > 1) {
      stack[stack.length - 1] = entry;
      window.history.replaceState({ asplitRoute: entry }, '', window.location.href);
    } else {
      stack.push(entry);
      window.history.pushState({ asplitRoute: entry }, '', window.location.href);
    }
    dispatch({ type: 'NAV', screen, params: nextParams });
  };
  const goBack = () => {
    if (navStackRef.current.length > 1) window.history.back();
    else dispatch({ type: 'SHOW_EXIT_PROMPT' });
  };
  const markNotificationsViewed = useCallback(async (ids) => {
    if (!ids.length) return;
    const viewedAt = new Date().toISOString();
    const { error } = await supabase.rpc('mark_app_notifications_viewed', { p_notification_ids: ids });
    if (error) throw error;
    dispatch({ type: 'MARK_NOTIFICATIONS_VIEWED', ids, viewedAt });
  }, []);

  useEffect(() => {
    const rootEntry = navStackRef.current[0];
    const rootState = { asplitRoute: rootEntry, asplitRootSentinel: true };
    if (!historyInitializedRef.current) {
      historyInitializedRef.current = true;
      window.history.replaceState(rootState, '', window.location.href);
      window.history.pushState(rootState, '', window.location.href);
    }
    const onPopState = event => {
      const entry = event.state?.asplitRoute;
      const stack = navStackRef.current;
      if (entry) {
        const wasAtRoot = stack.length === 1;
        const foundAt = stack.findIndex(item => item.key === entry.key);
        if (foundAt >= 0) stack.splice(foundAt + 1);
        else stack.push(entry);
        dispatch({ type: 'NAV', screen: entry.screen, params: entry.params });
        if (wasAtRoot) {
          window.history.pushState(rootState, '', window.location.href);
          dispatch({ type: 'SHOW_EXIT_PROMPT' });
        }
      } else {
        window.history.pushState(rootState, '', window.location.href);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const getTripExpenses = (tripId) => state.expenses.filter(e => e.tripId === tripId);
  const getTripMembers  = (trip)   => state.members.filter(m => (trip?.members || []).includes(m.id));
  const getMember       = (id)     => state.members.find(m => m.id === id);
  const getTripTotal    = (tripId) => state.expenses.filter(e => e.tripId === tripId).reduce((s, e) => s + e.amount, 0);
  const getSettlements  = (tripId) => {
    const trip = state.trips.find(t => t.id === tripId);
    if (!trip) return { balances: {}, settlements: [] };
    return calcSettlements(getTripMembers(trip), getTripExpenses(tripId));
  };
  const notifications = state.notifications.filter(item => !item.viewedAt || Date.now() - Date.parse(item.viewedAt) < 24 * 60 * 60 * 1000);

  const refreshNotifications = useCallback(async () => {
    if (!navigator.onLine || !stateRef.current.currentUser?.id) return;
    const { data, error } = await supabase.rpc('get_app_notifications');
    if (error) {
      console.error('Could not refresh notifications:', error.message);
      return;
    }
    dispatch({ type: 'SET_NOTIFICATIONS', notifications: (data || []).map(mapNotification) });
  }, []);

  useEffect(() => {
    if (!state.currentUser?.id) return undefined;
    refreshNotifications();
    const interval = window.setInterval(refreshNotifications, 60 * 1000);
    return () => window.clearInterval(interval);
  }, [state.currentUser?.id, refreshNotifications]);

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
    const inviteToken = new URLSearchParams(window.location.search).get('invite') || sessionStorage.getItem('asplit_invite_token');
    if (inviteToken) {
      sessionStorage.removeItem('asplit_invite_token');
      const url = new URL(window.location.href);
      url.searchParams.delete('invite');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      nav('joinInvite', { token: inviteToken });
    }
  }

  async function loadUserData(userId) {
    const { data: memberRows } = await supabase.from('trip_members').select('trip_id, role').eq('user_id', userId);
    if (!memberRows?.length) return;
    const tripIds = memberRows.map(r => r.trip_id);

    const { data: tripRows } = await supabase.from('trips').select('*').in('id', tripIds).order('created_at', { ascending: false });
    if (!tripRows?.length) return;

    const { data: allMemberRows } = await supabase.from('trip_members').select('trip_id, user_id, role').in('trip_id', tripIds);
    const trips = tripRows.map(t => {
      const members = (allMemberRows || []).filter(r => r.trip_id === t.id);
      const mIds = members.map(r => r.user_id);
      const admins = members.filter(r => r.role === 'admin').map(r => r.user_id);
      return mapTrip(t, mIds, admins);
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
    const inviteToken = new URLSearchParams(window.location.search).get('invite');
    if (inviteToken) sessionStorage.setItem('asplit_invite_token', inviteToken);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
    });
    if (error) {
      sessionStorage.removeItem('asplit_invite_token');
      throw error;
    }
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
      const mapped = mapTrip({ ...payload, id: tempId, _pending: true }, [userId], [userId]);
      dispatch({ type: 'ADD_TRIP', trip: mapped });
      const q = loadQueue(); q.push({ type: 'CREATE_TRIP', payload, userId, tempId }); saveQueue(q);
      return mapped;
    }
    const { data: trip, error } = await supabase.from('trips').insert(payload).select().single();
    if (error) throw error;
    const { error: memberError } = await supabase.from('trip_members').insert({ trip_id: trip.id, user_id: userId, role: 'admin' });
    if (memberError) throw memberError;
    const mapped = mapTrip(trip, [userId], [userId]);
    dispatch({ type: 'ADD_TRIP', trip: mapped });
    const cur = stateRef.current;
    dispatch({ type: 'SET_MEMBERS', members: cur.members.some(m => m.id === userId) ? cur.members : [...cur.members, mapProfile({ id: userId, name: cur.currentUser.name, email: cur.currentUser.email, upi_id: cur.currentUser.upi, phone: cur.currentUser.phone, avatar_color: cur.currentUser.color })] });
    return mapped;
  }, []);

  const updateTrip = useCallback(async (tripId, form) => {
    const existing = stateRef.current.trips.find(t => t.id === tripId);
    if (!existing) throw new Error('Trip not found');
    const payload = {
      name: form.name.trim(), description: form.description || '', currency: form.currency,
      start_date: form.startDate || null, end_date: form.endDate || null,
      cover_color: form.coverColor,
    };
    if (!navigator.onLine || String(tripId).startsWith('tmp_')) {
      const updated = { ...existing, ...form, name: payload.name };
      dispatch({ type: 'UPDATE_TRIP', trip: updated });
      return updated;
    }
    const { data, error } = await supabase.from('trips').update(payload).eq('id', tripId).select().single();
    if (error) throw error;
    const updated = mapTrip(data, existing.members, existing.adminIds || []);
    dispatch({ type: 'UPDATE_TRIP', trip: updated });
    return updated;
  }, []);

  const deleteTrip = useCallback(async (tripId) => {
    const deletedAt = new Date().toISOString();
    if (!navigator.onLine || String(tripId).startsWith('tmp_')) {
      dispatch({ type: 'DELETE_TRIP', tripId, deletedAt });
      return deletedAt;
    }
    const { data, error } = await supabase.from('trips').update({ deleted_at: deletedAt }).eq('id', tripId).select('id, deleted_at').single();
    if (error) throw error;
    dispatch({ type: 'DELETE_TRIP', tripId, deletedAt: data.deleted_at });
    return data.deleted_at;
  }, []);

  const createTripInvite = useCallback(async (tripId) => {
    const { data, error } = await supabase.rpc('create_trip_invite', { p_trip_id: tripId });
    if (error) throw error;
    return `${window.location.origin}/?invite=${encodeURIComponent(data)}`;
  }, []);

  const getTripInvite = useCallback(async (token) => {
    const { data, error } = await supabase.rpc('get_trip_invite', { p_token: token });
    if (error) throw error;
    return data?.[0] || null;
  }, []);

  const requestTripJoin = useCallback(async (token) => {
    const { data, error } = await supabase.rpc('request_trip_join', { p_token: token });
    if (error) throw error;
    return data;
  }, []);

  const listTripJoinRequests = useCallback(async (tripId) => {
    const { data, error } = await supabase.rpc('list_trip_join_requests', { p_trip_id: tripId });
    if (error) throw error;
    return data || [];
  }, []);

  const decideTripJoinRequest = useCallback(async (requestId, approve) => {
    const { data, error } = await supabase.rpc('decide_trip_join_request', { p_request_id: requestId, p_approve: approve });
    if (error) throw error;
    const userId = stateRef.current.currentUser?.id;
    if (userId) await loadUserData(userId);
    return data;
  }, []);

  const refreshUserData = useCallback(async () => {
    const userId = stateRef.current.currentUser?.id;
    if (userId && navigator.onLine) await loadUserData(userId);
  }, []);

  const addExpense = useCallback(async (form) => {
    const userId = stateRef.current.currentUser?.id;
    const payload = {
      trip_id: form.tripId, title: form.title, amount: form.amount,
      category: form.category, split_type: form.splitType,
      paid_by: form.paidBy, split_between: form.splitBetween,
      split_amounts: form.splitAmounts || [],
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
    if (data.phone !== undefined) patch.phone        = data.phone;
    if (data.color !== undefined) patch.avatar_color = data.color;
    dispatch({ type: 'UPDATE_PROFILE', data: {
      name:     data.name  ?? stateRef.current.currentUser.name,
      upi:      data.upi   ?? stateRef.current.currentUser.upi,
      phone:    data.phone ?? stateRef.current.currentUser.phone,
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
      state, dispatch, nav, goBack, notifications, markNotificationsViewed, refreshNotifications,
      getTripExpenses, getTripMembers, getMember, getTripTotal, getSettlements,
      signInGoogle, signOut, createTrip, updateTrip, deleteTrip, createTripInvite,
      getTripInvite, requestTripJoin, listTripJoinRequests, decideTripJoinRequest, refreshUserData,
      addExpense, deleteExpense, updateProfile,
    }}>
      {children}
    </StoreCtx.Provider>
  );
}

export const useStore = () => useContext(StoreCtx);
