import React, { useState } from 'react';
import { authApi } from '../api';
import { useAuthStore } from '../store';
import { useNavigate } from 'react-router-dom';

// ─── The institution UUID is fixed for this single-tenant deployment ───────────
const INSTITUTION_ID = '550e8400-e29b-41d4-a716-446655440000';

const DEMO_ROLES = [
  { label: 'Principal',   username: 'admin',      icon: '🎓', color: 'rgba(99,102,241,0.15)',  border: 'rgba(99,102,241,0.4)'  },
  { label: 'Registrar',   username: 'registrar',  icon: '📋', color: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.4)' },
  { label: 'Fee Manager', username: 'feemanager', icon: '💰', color: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)' },
  { label: 'Faculty',     username: 'faculty',    icon: '👨‍🏫', color: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)' },
  { label: 'Student',     username: 'student',    icon: '🎒', color: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)'  },
];

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setAuth = useAuthStore(s => s.setAuth);
  const nav = useNavigate();

  const handleSubmit = async (e: React.FormEvent, u = username, p = password) => {
    if (e) e.preventDefault();
    if (!u || !p) { setError('Username and password are required'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(INSTITUTION_ID, u, p);
      const { access_token, refresh_token, user } = res.data.data;
      setAuth(user, access_token, refresh_token);
      nav('/');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { errors?: { message: string }[] } } };
      setError(e?.response?.data?.errors?.[0]?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (u: string) => {
    setUsername(u);
    setPassword('password123');
    // submit immediately
    setError('');
    setLoading(true);
    authApi.login(INSTITUTION_ID, u, 'password123')
      .then(res => {
        const { access_token, refresh_token, user } = res.data.data;
        setAuth(user, access_token, refresh_token);
        nav('/');
      })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { errors?: { message: string }[] } } };
        setError(e?.response?.data?.errors?.[0]?.message || 'Login failed.');
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="login-bg">
      <form className="login-card fade-in" onSubmit={handleSubmit}>
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">🎓</div>
          <h1>EduOS</h1>
          <p>Educational Management System</p>
        </div>

        <h2>Welcome back</h2>
        <p className="login-subtitle">Sign in to your institution account</p>

        {error && <div className="login-error">⚠️ {error}</div>}

        {/* Username */}
        <div className="form-group">
          <label className="form-label">Username</label>
          <input
            id="username"
            className="form-input"
            placeholder="Enter your username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </div>

        {/* Password */}
        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            id="password"
            className="form-input"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <button id="login-btn" className="login-btn" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In →'}
        </button>

        {/* Quick-login demo panel */}
        <div style={{ marginTop: '1.75rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem', textAlign: 'center' }}>
            Quick Demo Login
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {DEMO_ROLES.map(role => (
              <button
                key={role.username}
                type="button"
                id={`quick-login-${role.username}`}
                disabled={loading}
                onClick={() => quickLogin(role.username)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.55rem 0.75rem', borderRadius: '8px',
                  background: role.color, border: `1px solid ${role.border}`,
                  color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.15s ease',
                  gridColumn: role.username === 'student' ? '1 / -1' : 'auto',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <span style={{ fontSize: '1rem' }}>{role.icon}</span>
                {role.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.6rem' }}>
            All demo accounts use password: <code style={{ background: 'var(--surface-2)', padding: '0 4px', borderRadius: 3 }}>password123</code>
          </p>
        </div>
      </form>
    </div>
  );
}
