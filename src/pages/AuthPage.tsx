import { useEffect, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import DeveloperLink from '../components/DeveloperLink';
import { go } from '../lib/nav';
import { onAuthChange, signInWithEmail, signInWithGoogle, signUpWithEmail } from '../utils/supabase';

export default function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return onAuthChange((user) => {
      if (user) go('/');
    });
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      setError('Enter an email and a password.');
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'login') {
        const { error: signInError } = await signInWithEmail(email, password);
        if (signInError) throw signInError;
        go('/');
      } else {
        const { data, error: signUpError } = await signUpWithEmail(email, password);
        if (signUpError) throw signUpError;
        if (!data.session) {
          setNotice('Account created. Open the confirmation link in your email, then sign in.');
        } else {
          go('/');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100%',
        background: '#050505',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&display=swap"
      />
      <form
        onSubmit={submit}
        style={{ width: 'min(100%, 340px)', display: 'flex', flexDirection: 'column', gap: '14px' }}
      >
        <button type="button" onClick={() => go('/')} style={textButton}>
          Back
        </button>
        <h1 style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, letterSpacing: '0.28em', fontSize: '28px', textTransform: 'uppercase' }}>
          {mode === 'login' ? 'Sign in' : 'Sign up'}
        </h1>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.45)', fontSize: '11px', lineHeight: 1.5 }}>
          {mode === 'login'
            ? 'Sign in to save a photo, record a video, or open your gallery.'
            : 'Create an account. You only need it when you save.'}
        </p>
        <label style={label}>
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            style={field}
          />
        </label>
        <label style={label}>
          Password
          <input
            type="password"
            name="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            style={field}
          />
        </label>
        {error && <p style={{ margin: 0, color: '#ff6b6b', fontSize: '11px' }}>{error}</p>}
        {notice && <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '11px', lineHeight: 1.5 }}>{notice}</p>}
        <button type="submit" disabled={loading} style={primaryButton}>
          {loading ? 'Please wait' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => { void signInWithGoogle(); }}
          style={secondaryButton}
        >
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => go(mode === 'login' ? '/signup' : '/login')}
          style={textButton}
        >
          {mode === 'login' ? 'Create an account' : 'Already have an account'}
        </button>
      </form>
      <DeveloperLink />
    </main>
  );
}

const label: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontSize: '10px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.45)',
};

const field: CSSProperties = {
  height: '40px',
  borderRadius: '4px',
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'transparent',
  color: '#fff',
  padding: '0 10px',
  fontFamily: 'ui-monospace, monospace',
  fontSize: '13px',
  letterSpacing: '0',
  textTransform: 'none',
};

const primaryButton: CSSProperties = {
  height: '40px',
  border: 'none',
  borderRadius: '4px',
  background: '#fff',
  color: '#050505',
  fontFamily: 'ui-monospace, monospace',
  fontSize: '11px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};

const secondaryButton: CSSProperties = {
  ...primaryButton,
  background: 'transparent',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.16)',
};

const textButton: CSSProperties = {
  alignSelf: 'flex-start',
  background: 'transparent',
  border: 'none',
  color: 'rgba(255,255,255,0.55)',
  padding: 0,
  cursor: 'pointer',
  fontFamily: 'ui-monospace, monospace',
  fontSize: '11px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};
