import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Field } from '../components/ui';
import { api, setTokens } from '../lib/api';
import { useAuth } from '../lib/auth';

export function Login() {
  const [phone, setPhone] = useState('+919000000000');
  const [password, setPassword] = useState('Super@123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const { refresh } = useAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api<{ accessToken: string; refreshToken: string; user: { role: string } }>(
        '/api/auth/login-password',
        {
          method: 'POST',
          body: JSON.stringify({ phone, password }),
        },
      );
      if (res.user.role !== 'SUPER_ADMIN') {
        setError('This panel is for superadmins only.');
        return;
      }
      setTokens(res.accessToken, res.refreshToken);
      await refresh();
      nav('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <h2 style={{ margin: '0 0 4px' }}>PrintPlz Admin</h2>
        <p className="muted">Superadmin only. Vendors use the mobile app.</p>
        <div style={{ height: 12 }} />
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91..." />
        </Field>
        <div style={{ height: 10 }} />
        <Field label="Password">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && (
          <p role="alert" style={{ color: 'var(--error)', fontSize: 13 }}>
            {error}
          </p>
        )}
        <div style={{ height: 12 }} />
        <button type="submit" className="btn" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted" style={{ marginTop: 12 }}>
          Seeded: +919000000000 / Super@123
        </p>
      </form>
    </div>
  );
}
