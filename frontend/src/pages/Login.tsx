import React, { useState, useEffect } from 'react';
import { authApi } from '../api';
import { useAuthStore } from '../store';
import { useNavigate } from 'react-router-dom';

const DEMO_ROLES = [
  { label: 'Principal',   username: 'admin',      hint: 'Full system authorization' },
  { label: 'Registrar',   username: 'registrar',  hint: 'Academic & enrollment control' },
  { label: 'Fee Manager', username: 'feemanager', hint: 'Financial records & GL' },
  { label: 'Faculty',     username: 'faculty',    hint: 'Attendance & marking desk' },
  { label: 'Student',     username: 'student',    hint: 'Self-service academic portal' },
];

export default function Login() {
  const [username, setUsername]           = useState('');
  const [password, setPassword]           = useState('');
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const [institutions, setInstitutions]   = useState<any[]>([]);
  const [selectedInstId, setSelectedInstId] = useState('');

  // MFA state — only populated when backend requests it
  const [mfaRequired, setMfaRequired]     = useState(false);
  const [mfaToken, setMfaToken]           = useState('');
  const [otp, setOtp]                     = useState('');

  const setAuth = useAuthStore(s => s.setAuth);
  const nav     = useNavigate();

  useEffect(() => {
    authApi.listInstitutions()
      .then(res => {
        const list = res.data.data ?? [];
        setInstitutions(list);
        if (list.length > 0) setSelectedInstId(list[0].institution_id);
      })
      .catch(err => console.error('Failed to load institutions:', err));
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const extractErrorMessage = (err: unknown): string => {
    const e = err as { response?: { data?: { errors?: { message: string }[] } } };
    return e?.response?.data?.errors?.[0]?.message || 'Something went wrong. Please try again.';
  };

  const finaliseLogin = (data: { access_token: string; refresh_token: string; user: any }) => {
    setAuth(data.user, data.access_token, data.refresh_token);
    nav('/');
  };

  // ── Normal login submit ────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent, u = username, p = password) => {
    if (e) e.preventDefault();
    if (!selectedInstId) { setError('Please select an institution'); return; }
    if (!u || !p)         { setError('Username and password are required'); return; }
    setError('');
    setLoading(true);
    try {
      const res  = await authApi.login(selectedInstId, u, p);
      const data = res.data.data;

      if (data.mfa_required) {
        // Backend wants MFA — show OTP screen, do NOT call setAuth yet
        setMfaRequired(true);
        setMfaToken(data.mfa_token);
        return;
      }

      finaliseLogin(data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // ── MFA verification submit ────────────────────────────────────────────────

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) { setError('Enter the 6-digit OTP'); return; }
    setError('');
    setLoading(true);
    try {
      const res  = await authApi.verifyMfa(mfaToken, otp);
      const data = res.data.data;
      finaliseLogin(data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Quick-login (DEV only) ─────────────────────────────────────────────────

  const quickLogin = (u: string) => {
    if (!selectedInstId) { setError('Please select an institution'); return; }
    setUsername(u);
    setPassword('Password@123');
    setError('');
    setLoading(true);
    authApi.login(selectedInstId, u, 'Password@123')
      .then(res => {
        const data = res.data.data;
        if (data.mfa_required) {
          setMfaRequired(true);
          setMfaToken(data.mfa_token);
          return;
        }
        finaliseLogin(data);
      })
      .catch((err: unknown) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

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

          {/* ── MFA screen ───────────────────────────────────────────────── */}
          {mfaRequired ? (
            <>
              <h1>Two-Factor Auth</h1>
              <p className="login-subtitle">Enter the 6-digit OTP sent to your registered email / phone.</p>

              {error && <div className="login-error">{error}</div>}

              <form onSubmit={handleVerifyOtp}>
                <div className="form-group">
                  <label className="form-label">One-Time Password</label>
                  <input
                    id="otp-input"
                    className="form-input"
                    placeholder="••••••"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoFocus
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </div>
                <button id="verify-otp-btn" className="login-btn" type="submit" disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
              </form>

              <button
                type="button"
                style={{ marginTop: '1rem', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
                onClick={() => { setMfaRequired(false); setMfaToken(''); setOtp(''); setError(''); }}
              >
                ← Back to login
              </button>
            </>
          ) : (
            /* ── Normal login screen ─────────────────────────────────────── */
            <>
              <h1>Sign In</h1>
              <p className="login-subtitle">Access your institutional workspace</p>

              {error && <div className="login-error">{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Institution</label>
                  <select
                    id="institution_select"
                    className="form-select"
                    value={selectedInstId}
                    onChange={e => setSelectedInstId(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {institutions.length === 0 ? (
                      <option value="">Loading institutions...</option>
                    ) : (
                      institutions.map(inst => (
                        <option key={inst.institution_id} value={inst.institution_id}>
                          {inst.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

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

              {/* Quick access — only rendered in dev builds */}
              {import.meta.env.DEV && (
                <>
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
                </>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
