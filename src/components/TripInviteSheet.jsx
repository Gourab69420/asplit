import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, RefreshCw, X } from 'lucide-react';
import { useStore } from '../store';

export default function TripInviteSheet({ open, onClose, trip }) {
  const { createTripInvite, listTripJoinRequests, decideTripJoinRequest } = useStore();
  const [link, setLink] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [inviteLink, pending] = await Promise.all([
        createTripInvite(trip.id),
        listTripJoinRequests(trip.id),
      ]);
      setLink(inviteLink);
      setRequests(pending);
    } catch (err) {
      setError(err.message || 'Could not load invite settings.');
    } finally {
      setLoading(false);
    }
  }, [createTripInvite, listTripJoinRequests, trip.id]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Could not copy automatically. Select and copy the link above.');
    }
  };

  const decide = async (requestId, approve) => {
    setWorkingId(requestId);
    setError('');
    try {
      await decideTripJoinRequest(requestId, approve);
      setRequests(current => current.filter(request => request.request_id !== requestId));
    } catch (err) {
      setError(err.message || 'Could not update this request.');
    } finally {
      setWorkingId('');
    }
  };

  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-label="Invite and join requests" className="screen" onClick={event => event.stopPropagation()} style={{ width: '100%', maxHeight: '85dvh', borderRadius: '20px 20px 0 0', overflowY: 'auto', background: 'var(--bg)' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 1, padding: '16px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><p className="t-heading">Invite Members</p><p className="t-caption c-3">{trip.name}</p></div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <p className="t-label" style={{ marginBottom: 8 }}>Share this invite link</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" readOnly value={link} placeholder={loading ? 'Creating link…' : ''} aria-label="Trip invite link" style={{ minWidth: 0 }} />
              <button className="btn btn-primary" onClick={copyLink} disabled={!link} aria-label="Copy invite link">
                {copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="t-caption c-3" style={{ marginTop: 8 }}>People who open this link can request to join. They’ll only join after an admin approves.</p>
          </div>
          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <p className="t-label">Join requests {requests.length > 0 ? `(${requests.length})` : ''}</p>
              <button className="btn btn-ghost btn-icon" onClick={refresh} disabled={loading} aria-label="Refresh requests"><RefreshCw size={17} /></button>
            </div>
            {loading && <p className="t-caption c-3">Loading requests…</p>}
            {!loading && requests.length === 0 && <p className="t-caption c-3">No pending requests.</p>}
            {requests.map(request => (
              <div key={request.request_id} className="card" style={{ padding: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p className="t-label">{request.name || 'ASplit user'}</p>
                  <p className="t-caption c-3" style={{ overflowWrap: 'anywhere' }}>{request.email}</p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => decide(request.request_id, true)} disabled={!!workingId} title="Approve request"><Check size={15} /> Approve</button>
                <button className="btn btn-outline btn-sm" onClick={() => decide(request.request_id, false)} disabled={!!workingId} title="Decline request"><X size={15} /></button>
              </div>
            ))}
          </div>
          {error && <p role="alert" style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
        </div>
      </section>
    </div>
  );
}
