import React, { useState } from 'react';
import { authApi } from '../api';
import { useAuthStore } from '../store';
import { useNavigate } from 'react-router-dom';

const INSTITUTION_ID = '550e8400-e29b-41d4-a716-446655440000';

const DEMO_ROLES = [
  { label: 'Principal',   username: 'admin',      hint: 'Full system authorization' },
  { label: 'Registrar',   username: 'registrar',  hint: 'Academic & enrollment control' },
  { label: 'Fee Manager', username: 'feemanager', hint: 'Financial records & GL' },
  { label: 'Faculty',     username: 'faculty',    hint: 'Attendance & marking desk' },
  { label: 'Student',     username: 'student',    hint: 'Self-service academic portal' },
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
      <div className="login-left">
        <div className="login-left-logo">
          <div className="login-left-logo-mark" />
          <div className="login-left-logo-text">EduOS</div>
        </div>
        <h2>Enterprise Resource Planning</h2>
        <p>A unified portal for educational administration, double-entry financial accounting, course scheduling, and student lifecycle metrics.</p>
      </div>

      <div className="login-right">
        <div className="login-card">
          <h1>Sign In</h1>
          <p className="login-subtitle">Access your institutional workspace</p>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                id="username"
                className="form-input"
                placeholder="Enter username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                id="password"
                className="form-input"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <button id="login-btn" className="login-btn" type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Sign In'}
            </button>
          </form>

          <div className="login-divider">
            <span>Demo Quick Access</span>
          </div>

          <div className="login-quick-roles">
            {DEMO_ROLES.map(role => (
              <button
                key={role.username}
                type="button"
                id={`quick-login-${role.username}`}
                className="login-role-btn"
                disabled={loading}
                onClick={() => quickLogin(role.username)}
                style={{
                  gridColumn: role.username === 'student' ? '1 / -1' : 'auto'
                }}
              >
                <span className="login-role-btn-label">{role.label}</span>
                <span className="login-role-btn-hint">{role.hint}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
