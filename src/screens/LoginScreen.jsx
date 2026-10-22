import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ArrowRight, Equal, IndianRupee, Receipt, WalletCards } from 'lucide-react';
import { useStore } from '../store';

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

export default function LoginScreen() {
  const { signInGoogle } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Parse OAuth error from redirect URL (e.g. ?error=server_error&error_description=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
    const errDesc = params.get('error_description') || hashParams.get('error_description');
    const errCode = params.get('error_code') || hashParams.get('error_code');

    if (errDesc) {
      if (errCode === 'unexpected_failure') {
        setError('Account setup failed. Please try again — this usually resolves on the second attempt.');
      } else {
        setError(decodeURIComponent(errDesc).replace(/\+/g, ' '));
      }
      // Clean the URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      await signInGoogle();
      // Page redirects to Google — control returns via OAuth callback
    } catch (err) {
      setError(err.message || 'Google sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: 'radial-gradient(ellipse at 50% 36%, #eaf1ff 0%, #f8faff 42%, #ffffff 78%)',
      minHeight: '100dvh', padding: 'calc(var(--safe-top) + 18px) 22px calc(var(--safe-bottom) + 20px)',
    }}>
      <div style={{ width: '100%', maxWidth: 440, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 100, background: '#eff6ff', border: '1px solid #dbeafe', color: 'var(--accent)', fontSize: 13, fontWeight: 650 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669' }} /> ASplit
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 100, background: 'rgba(255,255,255,0.9)', border: '1px solid var(--border-light)', color: 'var(--text-2)', fontSize: 12, fontWeight: 550 }}>
          <IndianRupee size={14} /> India · INR
        </div>
      </div>

      <main style={{ flex: 1, width: '100%', maxWidth: 440, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 0 20px' }}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{ width: '100%', textAlign: 'center' }}
        >
          <div style={{ width: 72, height: 72, borderRadius: 21, background: 'linear-gradient(145deg, #4f83ef, #1d4ed8)', display: 'grid', placeItems: 'center', margin: '0 auto 20px', boxShadow: '0 10px 24px rgba(37,99,235,0.25)' }}>
            <span style={{ color: '#fff', fontSize: 36, fontWeight: 750, letterSpacing: -1 }}>A</span>
          </div>
          <p style={{ fontSize: 32, fontWeight: 750, letterSpacing: -1, color: '#111827', marginBottom: 8 }}>ASplit<span style={{ color: 'var(--accent)' }}>.</span></p>
          <p style={{ fontSize: 16, color: '#475569', lineHeight: 1.55, maxWidth: 350, margin: '0 auto 26px' }}>
            Split trip expenses with friends and settle up fairly.
          </p>

          <div style={{ textAlign: 'left', padding: '17px 17px 15px', border: '1px solid #e1e7f0', borderRadius: 20, background: 'rgba(255,255,255,0.92)', boxShadow: '0 10px 28px rgba(15,23,42,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, paddingBottom: 14, borderBottom: '1px solid #edf0f5' }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center', background: '#eff6ff', color: 'var(--accent)', flexShrink: 0 }}><Receipt size={21} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#111827', fontSize: 15, fontWeight: 650 }}>Goa weekend</p>
                <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Example trip · 4 people</p>
              </div>
              <span style={{ color: '#047857', background: '#ecfdf5', border: '1px solid #d1fae5', padding: '5px 9px', borderRadius: 100, fontSize: 11, fontWeight: 650 }}>Sample</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {['GS', 'AN', 'RK', 'PM'].map((initials, index) => <span key={initials} style={{ width: 31, height: 31, marginLeft: index ? -7 : 0, border: '2px solid #fff', borderRadius: '50%', display: 'grid', placeItems: 'center', background: ['#5968e8', '#e48a13', '#d9468f', '#0d9f8c'][index], color: '#fff', fontSize: 9, fontWeight: 650, zIndex: 4 - index }}>{initials}</span>)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#334155', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Stay and local travel</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ color: '#111827', fontSize: 15, fontWeight: 700 }}>₹12,000</p>
                <p style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>₹3,000 each</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 18 }}>
            {[
              { label: 'Live balances', Icon: WalletCards },
              { label: 'Equal or custom split', Icon: Equal },
              { label: 'UPI payments', Icon: IndianRupee },
            ].map(({ label, Icon }) => <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 11px', borderRadius: 100, border: '1px solid #e2e8f0', background: 'rgba(255,255,255,0.85)', color: '#475569', fontSize: 12 }}><Icon size={14} color="var(--accent)" />{label}</span>)}
          </div>
        </motion.div>
      </main>

      {/* Auth section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        style={{ width: '100%', maxWidth: 440, margin: '0 auto', padding: '0 0 8px' }}
      >
        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                background: 'var(--danger-light)', borderRadius: 12,
                padding: '12px 16px', display: 'flex', alignItems: 'flex-start',
                gap: 10, marginBottom: 16,
              }}
            >
              <AlertCircle size={16} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 500, lineHeight: 1.5 }}>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Google sign-in button */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          style={{
            width: '100%', height: 56, borderRadius: 14,
            border: '1px solid #e2e8f0',
            background: loading ? '#f1f5f9' : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 12, cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', fontSize: 16, fontWeight: 600,
            color: 'var(--text)', transition: 'all 0.15s',
            WebkitTapHighlightColor: 'transparent',
            boxShadow: '0 5px 16px rgba(15,23,42,0.08)',
          }}
        >
          {loading ? (
            <>
              <span style={{
                width: 18, height: 18, border: '2px solid var(--border)',
                borderTopColor: 'var(--accent)', borderRadius: '50%',
                animation: 'spin 0.7s linear infinite', display: 'inline-block',
              }} />
              Signing in...
            </>
          ) : (
            <>
              <GoogleIcon />
              Continue with Google
              <ArrowRight size={18} color="#94a3b8" style={{ marginLeft: 'auto' }} />
            </>
          )}
        </button>

      </motion.div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
