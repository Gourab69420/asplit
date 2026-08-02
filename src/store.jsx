import { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { supabase } from './supabase';

export const AVATAR_COLORS = ['#2563eb','#7c3aed','#db2777','#059669','#d97706','#dc2626','#0891b2','#65a30d'];

function getInitials(name = '') {
  return name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}
function pickColor(id = '') {
  const n = (id.charCodeAt(0) || 0) + (id.charCodeAt(id.length - 1) || 0);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}
function mapProfile(row) {
  return {
    id:       row.id,
    name:     row.name || '',
    email:    row.email || '',
    upi:      row.upi_id || '',
    initials: getInitials(row.name),
    color:    row.avatar_color || pickColor(row.id),
  };
}
function mapTrip(row, memberIds = []) {
  return {
    id:          row.id,
    name:        row.name,
    description: row.description || '',
    currency:    row.currency || 'INR',
    startDate:   row.start_date || '',
    endDate:     row.end_date || '',
    status:      row.status || 'upcoming',
    coverColor:  row.cover_color || '#2563eb',
    createdBy:   row.created_by,
    members:     memberIds,
  };
}
function mapExpense(row) {
  return {
    id:           row.id,
    tripId:       row.trip_id,
    title:        row.title,
    amount:       Number(row.amount),
    category:     row.category,
    splitType:    row.split_type,
    paidBy:       row.paid_by || [],
    splitBetween: row.split_between || [],
    notes:        row.notes || '',
    date:         row.expense_date || '',
    time:         row.expense_time?.slice(0, 5) || '',
  };
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

const initialState = {
  screen: 'loading', screenParams: {},
  trips: [], members: [], expenses: [],
  currentUser: null, notifications: 0,
  darkMode: false, loading: true,
};

function reducer(state, action) {
  switch (action.type) {
    case 'NAV':            return { ...state, screen: action.screen, screenParams: action.params || {} };
    case 'SET_USER':       return { ...state, currentUser: action.user, screen: action.user ? 'home' : 'login', loading: false };
    case 'SIGN_OUT':       return { ...initialState, screen: 'login', loading: false };
    case 'SET_TRIPS':      return { ...state, trips: action.trips };
    case 'SET_MEMBERS':    return { ...state, members: action.members };
    case 'SET_EXPENSES':   return { ...state, expenses: action.expenses };
    case 'ADD_TRIP':       return { ...state, trips: [action.trip, ...state.trips] };
    case 'ADD_TRIP_MEMBER': return { ...state, trips: state.trips.map(t => t.id === action.tripId ? { ...t, members: [...(t.members || []), action.userId] } : t) };
    case 'ADD_EXPENSE':    return { ...state, expenses: [action.expense, ...state.expenses] };
    case 'DELETE_EXPENSE': return { ...state, expenses: state.expenses.filter(e => e.id !== action.id) };
    case 'UPDATE_PROFILE': return { ...state, currentUser: { ...state.currentUser, ...action.data } };
    case 'TOGGLE_DARK':    return { ...state, darkMode: !state.darkMode };
    default:               return state;
  }
}

const StoreCtx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
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

  // ── auth listener ─────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) initUser(session.user);
      else dispatch({ type: 'SET_USER', user: null });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) initUser(session.user);
      else dispatch({ type: 'SET_USER', user: null });
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── profile bootstrap ─────────────────────────────────────
  async function initUser(authUser) {
    const userId = authUser.id;
    const name = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || '';
    const email = authUser.email || '';

    // Try select first
    let { data: profile } = await supabase
      .from('profiles').select('*').eq('id', userId).maybeSingle();

    if (!profile) {
      // Row doesn't exist yet — insert it
      const { data: inserted } = await supabase
        .from('profiles')
        .insert({ id: userId, name, email })
        .select().maybeSingle();
      profile = inserted;
    }

    if (!profile) {
      // RLS is blocking — use auth metadata directly and show app anyway
      profile = { id: userId, name, email, upi_id: '', avatar_color: pickColor(userId) };
    }

    dispatch({ type: 'SET_USER', user: mapProfile(profile) });
    loadUserData(userId);
  }

  async function loadUserData(userId) {
    // Get all trip_ids this user belongs to
    const { data: memberRows } = await supabase
      .from('trip_members')
      .select('trip_id, role')
      .eq('user_id', userId);

    if (!memberRows?.length) return;

    const tripIds = memberRows.map(r => r.trip_id);

    // Fetch trips
    const { data: tripRows } = await supabase
      .from('trips')
      .select('*')
      .in('id', tripIds)
      .order('created_at', { ascending: false });

    if (!tripRows?.length) return;

    // Fetch all members for these trips
    const { data: allMemberRows } = await supabase
      .from('trip_members')
      .select('trip_id, user_id')
      .in('trip_id', tripIds);

    const trips = tripRows.map(t => {
      const mIds = (allMemberRows || []).filter(r => r.trip_id === t.id).map(r => r.user_id);
      return mapTrip(t, mIds);
    });
    dispatch({ type: 'SET_TRIPS', trips });

    // Fetch profiles of all members
    const allUserIds = [...new Set((allMemberRows || []).map(r => r.user_id))];
    if (allUserIds.length) {
      const { data: profiles } = await supabase
        .from('profiles').select('*').in('id', allUserIds);
      dispatch({ type: 'SET_MEMBERS', members: (profiles || []).map(mapProfile) });
    }

    // Fetch expenses
    const { data: expRows } = await supabase
      .from('expenses').select('*').in('trip_id', tripIds)
      .order('expense_date', { ascending: false });
    dispatch({ type: 'SET_EXPENSES', expenses: (expRows || []).map(mapExpense) });
  }

  // ── auth actions ──────────────────────────────────────────
  const signInGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    dispatch({ type: 'SIGN_OUT' });
  }, []);

  // ── data actions ──────────────────────────────────────────
  const createTrip = useCallback(async (form) => {
    const userId = state.currentUser?.id;
    if (!userId) throw new Error('Not signed in');
    const { data: trip, error } = await supabase.from('trips').insert({
      name: form.name, description: form.description, currency: form.currency,
      start_date: form.startDate, end_date: form.endDate,
      status: 'upcoming', cover_color: form.coverColor, created_by: userId,
    }).select().single();
    if (error) throw error;
    await supabase.from('trip_members').insert({ trip_id: trip.id, user_id: userId, role: 'admin' });
    const mapped = mapTrip(trip, [userId]);
    dispatch({ type: 'ADD_TRIP', trip: mapped });
    // Add current user to members if not already there
    dispatch({ type: 'SET_MEMBERS', members: state.members.some(m => m.id === userId) ? state.members : [...state.members, mapProfile({ id: userId, name: state.currentUser.name, email: state.currentUser.email, upi_id: state.currentUser.upi, avatar_color: state.currentUser.color })] });
    return mapped;
  }, [state.currentUser, state.members]);

  const addExpense = useCallback(async (form) => {
    const userId = state.currentUser?.id;
    const { data: exp, error } = await supabase.from('expenses').insert({
      trip_id: form.tripId, title: form.title, amount: form.amount,
      category: form.category, split_type: form.splitType,
      paid_by: form.paidBy, split_between: form.splitBetween,
      notes: form.notes, expense_date: form.date, expense_time: form.time,
      created_by: userId,
    }).select().single();
    if (error) throw error;
    const mapped = mapExpense(exp);
    dispatch({ type: 'ADD_EXPENSE', expense: mapped });
    return mapped;
  }, [state.currentUser]);

  const deleteExpense = useCallback(async (id) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    dispatch({ type: 'DELETE_EXPENSE', id });
  }, []);

  const updateProfile = useCallback(async (data) => {
    const userId = state.currentUser?.id;
    if (!userId) throw new Error('Not signed in');
    const patch = {};
    if (data.name  !== undefined) patch.name         = data.name;
    if (data.upi   !== undefined) patch.upi_id       = data.upi;
    if (data.color !== undefined) patch.avatar_color = data.color;
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
    if (error) throw error;
    dispatch({ type: 'UPDATE_PROFILE', data: {
      name:     data.name  ?? state.currentUser.name,
      upi:      data.upi   ?? state.currentUser.upi,
      color:    data.color ?? state.currentUser.color,
      initials: data.name != null ? getInitials(data.name) : state.currentUser.initials,
    }});
  }, [state.currentUser]);

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
