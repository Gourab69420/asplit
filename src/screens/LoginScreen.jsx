import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ArrowRight } from 'lucide-react';
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
      background: 'var(--surface)', minHeight: '100dvh',
      paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)',
    }}>
      {/* Brand hero */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 32px 32px' }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{ marginBottom: 24 }}
        >
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 12px 32px rgba(37,99,235,0.28)',
          }}>
            <span style={{ color: '#fff', fontSize: 34, fontWeight: 800, fontFamily: 'Inter,sans-serif', letterSpacing: -1 }}>A</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.3 }} style={{ textAlign: 'center', marginBottom: 48 }}>
          <p style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.8, color: 'var(--text)', marginBottom: 8 }}>ASplit</p>
          <p style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.5 }}>
            Split trip expenses with friends,<br />settle up instantly.
          </p>
        </motion.div>

        {/* Feature pills */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 48 }}>
          {['Track expenses', 'Split fairly', 'Settle via UPI'].map(f => (
            <span key={f} style={{
              padding: '6px 14px', borderRadius: 100,
              background: 'var(--accent-light)', color: 'var(--accent)',
              fontSize: 13, fontWeight: 500,
            }}>{f}</span>
          ))}
        </motion.div>
      </div>

      {/* Auth section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        style={{ padding: '0 24px 32px' }}
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
            border: '1.5px solid var(--border)',
            background: loading ? 'var(--surface-2)' : 'var(--surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 12, cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', fontSize: 16, fontWeight: 600,
            color: 'var(--text)', transition: 'all 0.15s',
            WebkitTapHighlightColor: 'transparent',
            boxShadow: 'var(--shadow-sm)',
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
              <ArrowRight size={16} color="var(--text-3)" style={{ marginLeft: 'auto' }} />
            </>
          )}
        </button>

        <p className="t-caption c-3 text-center" style={{ marginTop: 20, lineHeight: 1.6 }}>
          By continuing you agree to our Terms of Service<br />and Privacy Policy
        </p>
      </motion.div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
