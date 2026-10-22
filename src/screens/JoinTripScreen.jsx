import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, UserPlus, AlertCircle, CheckCircle, Loader2, Clock, UserCheck, UserX } from 'lucide-react';
import { useStore } from '../store';
import { supabase } from '../supabase';
import { Avatar, formatDateShort } from '../components/ui';

export default function JoinTripScreen() {
  const { state, nav, requestJoinTrip, signInGoogle } = useStore();
  const { inviteCode } = state.screenParams;
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [requestStatus, setRequestStatus] = useState(null); // 'pending' | 'approved' | 'rejected' | 'already_member' | 'already_requested'
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    if (!inviteCode) {
      setError('Invalid invite link');
      setLoading(false);
      return;
    }
    loadTrip();
  }, [inviteCode]);

  const loadTrip = async () => {
    try {
      const { data, error: err } = await supabase
        .from('trips')
        .select('*')
        .eq('invite_code', inviteCode)
        .maybeSingle();

      if (err) throw err;
      if (!data) throw new Error('Trip not found or link expired');
      if (data.deleted_at) throw new Error('This trip has been deleted');

      setTrip(data);

      // Check if user already has a pending request
      if (state.currentUser) {
        const existingReq = state.joinRequests.find(r => r.tripId === data.id && r.userId === state.currentUser.id);
        if (existingReq) {
          setRequestStatus(existingReq.status);
        }
      }
    } catch (e) {
      setError(e.message || 'Failed to load trip');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestJoin = async () => {
    const user = state.currentUser;
    if (!user) {
      setShowAuth(true);
      return;
    }

    if (trip.members?.includes(user.id)) {
      setRequestStatus('already_member');
      return;
    }

    setRequesting(true);
    setError('');

    try {
      const result = await requestJoinTrip(trip.id);
      if (result.alreadyMember) {
        setRequestStatus('already_member');
      } else if (result.alreadyRequested) {
        setRequestStatus('pending');
      } else {
        setRequestStatus('pending');
      }
    } catch (e) {
      setError(e.message || 'Failed to request to join');
    } finally {
      setRequesting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInGoogle();
    } catch (e) {
      setError(e.message || 'Sign in failed');
    }
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', gap: 16 }}>
        <Loader2 size={28} color="var(--accent)" style={{ animation: 'spin 0.8s linear infinite' }} />
        <p className="t-body c-3">Loading trip...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error && !trip) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', padding: 32, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--danger-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <AlertCircle size={28} color="var(--danger)" />
        </div>
        <p className="t-heading mb-2">Unable to Join</p>
        <p className="t-body c-3 mb-4">{error}</p>
        <button className="btn btn-primary" onClick={() => nav('home')}>Go Home</button>
      </div>
    );
  }

  const isMember = trip.members?.includes(state.currentUser?.id);

  return (
    <div className="screen">
      <div style={{ background: trip.cover_color, padding: '16px 20px 24px' }}>
        <div className="flex items-center justify-between mb-4">
          <button className="btn btn-ghost btn-icon" style={{ color: '#fff', background: 'rgba(255,255,255,0.15)' }} onClick={() => nav('home')}>
            <ArrowLeft size={20} />
          </button>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 4 }}>
          {formatDateShort(trip.start_date)} – {formatDateShort(trip.end_date)}
        </p>
        <p style={{ color: '#fff', fontSize: 22, fontWeight: 700, letterSpacing: -0.3, marginBottom: 12 }}>{trip.name}</p>
        {trip.description && <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>{trip.description}</p>}
      </div>

      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Trip preview card */}
        <div className="card card-p">
          <div className="flex items-center gap-3">
            <div style={{ width: 48, height: 48, borderRadius: 14, background: trip.cover_color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 22 }}>✈</span>
            </div>
            <div className="flex-1">
              <p className="t-heading">{trip.name}</p>
              <p className="t-caption c-3">{trip.members?.length || 0} members · {trip.currency}</p>
            </div>
          </div>
        </div>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: 'var(--danger-light)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}
            >
              <AlertCircle size={14} color="var(--danger)" />
              <p style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status messages */}
        <AnimatePresence>
          {requestStatus === 'pending' && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: 'var(--warning-light)', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}
            >
              <Clock size={18} color="var(--warning)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--warning)', marginBottom: 2 }}>Request Sent</p>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                  Your request to join <strong>{trip.name}</strong> has been sent to the admin for approval.
                  You'll be notified once it's reviewed.
                </p>
              </div>
            </motion.div>
          )}
          {requestStatus === 'approved' && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: 'var(--success-light)', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}
            >
              <UserCheck size={18} color="var(--success)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--success)', marginBottom: 2 }}>Request Approved!</p>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 8 }}>
                  You've been added to <strong>{trip.name}</strong>.
                </p>
                <motion.button
                  className="btn btn-primary btn-sm"
                  onClick={() => nav('tripDashboard', { tripId: trip.id })}
                  whileTap={{ scale: 0.98 }}
                >
                  Open Trip
                </motion.button>
              </div>
            </motion.div>
          )}
          {requestStatus === 'rejected' && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: 'var(--danger-light)', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}
            >
              <UserX size={18} color="var(--danger)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)', marginBottom: 2 }}>Request Declined</p>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                  Your request to join <strong>{trip.name}</strong> was not approved by the admin.
                </p>
              </div>
            </motion.div>
          )}
          {requestStatus === 'already_member' && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: 'var(--accent-light)', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'center' }}
            >
              <CheckCircle size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)', marginBottom: 2 }}>Already a Member</p>
                <p style={{ fontSize: 13, color: 'var(--text-2)' }}>You're already part of <strong>{trip.name}</strong>.</p>
              </div>
              <motion.button
                className="btn btn-primary btn-sm"
                onClick={() => nav('tripDashboard', { tripId: trip.id })}
                whileTap={{ scale: 0.98 }}
                style={{ marginLeft: 'auto' }}
              >
                Open Trip
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action */}
        {state.currentUser ? (
          isMember || requestStatus === 'already_member' ? (
            <motion.button
              className="btn btn-primary btn-full"
              onClick={() => nav('tripDashboard', { tripId: trip.id })}
              whileTap={{ scale: 0.98 }}
            >
              <CheckCircle size={18} /> Open Trip
            </motion.button>
          ) : requestStatus === 'pending' ? (
            <button className="btn btn-outline btn-full" disabled style={{ color: 'var(--warning)', borderColor: 'var(--warning)' }}>
              <Clock size={18} /> Request Pending Review
            </button>
          ) : requestStatus === 'rejected' ? (
            <motion.button
              className="btn btn-primary btn-full"
              onClick={handleRequestJoin}
              disabled={requesting}
              whileTap={{ scale: 0.98 }}
            >
              {requesting ? (
                <>
                  <Loader2 size={18} style={{ animation: 'spin 0.7s linear infinite' }} />
                  Requesting...
                </>
              ) : (
                <>
                  <UserPlus size={18} /> Request to Join Again
                </>
              )}
            </motion.button>
          ) : (
            <motion.button
              className="btn btn-primary btn-full"
              onClick={handleRequestJoin}
              disabled={requesting}
              whileTap={{ scale: 0.98 }}
            >
              {requesting ? (
                <>
                  <Loader2 size={18} style={{ animation: 'spin 0.7s linear infinite' }} />
                  Requesting...
                </>
              ) : (
                <>
                  <UserPlus size={18} /> Request to Join
                </>
              )}
            </motion.button>
          )
        ) : (
          <>
            <p className="t-body c-3" style={{ textAlign: 'center', marginBottom: 8 }}>
              Sign in to request to join this trip
            </p>
            <button className="btn btn-primary btn-full" onClick={handleGoogleSignIn}>
              <span style={{ width: 18, height: 18, display: 'inline-block', background: 'url("data:image/svg+xml,%3Csvg width=%2218%22 height=%2218%22 viewBox=%220 0 18 18%22%3E%3Cpath fill=%22%234285F4%22 d=%22M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z%22/%3E%3Cpath fill=%22%2334A853%22 d=%22M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z%22/%3E%3Cpath fill=%22%23FBBC05%22 d=%22M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z%22/%3E%3Cpath fill=%22%23EA4335%22 d=%22M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z%22/%3E%3C/svg%3E") no-repeat center/contain' }} />
              Continue with Google
            </button>
          </>
        )}

        {showAuth && !state.currentUser && (
          <div className="card card-p" style={{ marginTop: 8 }}>
            <p className="t-caption c-3" style={{ textAlign: 'center', marginBottom: 12 }}>
              You'll be redirected back here after signing in
            </p>
            <button className="btn btn-primary btn-full" onClick={handleGoogleSignIn}>
              <span style={{ width: 18, height: 18, display: 'inline-block', background: 'url("data:image/svg+xml,%3Csvg width=%2218%22 height=%2218%22 viewBox=%220 0 18 18%22%3E%3Cpath fill=%22%234285F4%22 d=%22M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z%22/%3E%3Cpath fill=%22%2334A853%22 d=%22M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z%22/%3E%3Cpath fill=%22%23FBBC05%22 d=%22M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z%22/%3E%3Cpath fill=%22%23EA4335%22 d=%22M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z%22/%3E%3C/svg%22) no-repeat center/contain' }} />
              Sign in with Google
            </button>
          </div>
        )}
      </div>
    </div>
  );
}