import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Users } from 'lucide-react';
import { useStore } from '../store';

export default function JoinTripScreen() {
  const { state, nav, goBack, getTripInvite, requestTripJoin, refreshUserData } = useStore();
  const token = state.screenParams?.token;
  const [trip, setTrip] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setError('');
    getTripInvite(token).then(result => {
      if (!active) return;
      if (!result) throw new Error('This invite link is invalid or expired.');
      setTrip(result);
      setStatus('ready');
    }).catch(err => {
      if (!active) return;
      setError(err.message || 'Could not load this invite.');
      setStatus('error');
    });
    return () => { active = false; };
  }, [token, getTripInvite]);

  const handleRequest = async () => {
    setSubmitting(true);
    setError('');
    try {
      const result = await requestTripJoin(token);
      if (result === 'already_member') {
        await refreshUserData();
        nav('tripDashboard', { tripId: trip.trip_id });
      } else {
        setStatus(result);
      }
    } catch (err) {
      setError(err.message || 'Could not send your request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="screen">
      <div style={{ padding: '16px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-ghost btn-icon" onClick={goBack}><ArrowLeft size={20} /></button>
        <p className="t-heading">Join a Trip</p>
      </div>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
        <div className="icon-box" style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--accent-light)' }}>
          <Users size={24} color="var(--accent)" />
        </div>
        {status === 'loading' && <p className="t-body c-2">Loading invite…</p>}
        {trip && <>
          <div>
            <p className="t-caption c-3">You were invited to</p>
            <h1 className="t-heading" style={{ marginTop: 4 }}>{trip.trip_name}</h1>
          </div>
          {status === 'ready' && <>
            <p className="t-body c-2">Request to join this trip. An admin will review your request.</p>
            <button className="btn btn-primary btn-full" onClick={handleRequest} disabled={submitting}>
              {submitting ? 'Sending request…' : 'Request to Join'}
            </button>
          </>}
          {status === 'pending' && <div className="card" style={{ padding: 16, width: '100%' }}>
            <p className="t-label">Request sent</p>
            <p className="t-caption c-3" style={{ marginTop: 4 }}>An admin needs to approve your request before you can access the trip.</p>
            <button className="btn btn-outline btn-full" style={{ marginTop: 12 }} onClick={handleRequest} disabled={submitting}>
              {submitting ? 'Checking…' : 'Check Request Status'}
            </button>
          </div>}
          {status === 'approved' && <div className="card" style={{ padding: 16, width: '100%' }}>
            <CheckCircle2 size={22} color="var(--success)" />
            <p className="t-label" style={{ marginTop: 8 }}>Request approved</p>
            <button className="btn btn-primary btn-full" style={{ marginTop: 12 }} onClick={handleRequest}>Open Trip</button>
          </div>}
        </>}
        {error && <p role="alert" style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
      </div>
    </div>
  );
}
