import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { academicsApi } from '../api';
import { usePermissions } from '../hooks/usePermissions';

interface Notification {
  notification_id: string;
  title: string;
  message: string;
  category: string;
  target_role: string;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
}

export default function Notifications() {
  const { isStudent, isFaculty, isAdmin, role } = usePermissions();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('Academic');
  const [targetRole, setTargetRole] = useState('All');
  
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchNotifications = () => {
    setLoading(true);
    academicsApi.notifications.list()
      .then(r => setNotifications(r.data.data ?? []))
      .catch(err => console.warn('Request failed:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccessMessage('');
    if (!title || !message) { setError('Please fill all required fields'); return; }

    academicsApi.notifications.create({
      title,
      message,
      category,
      target_role: targetRole,
    })
      .then(() => {
        setShowAddModal(false);
        setTitle(''); setMessage(''); setCategory('Academic'); setTargetRole('All');
        setSuccessMessage('Announcement published successfully!');
        fetchNotifications();
      })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
        setError(e.response?.data?.errors?.[0]?.message || 'Failed to publish notification');
      });
  };

  const CATEGORY_COLOR: Record<string, string> = {
    Academic: '#6366f1',
    Exam: '#ef4444',
    Placement: '#10b981',
    Hostel: '#f59e0b',
    General: '#6b7280'
  };

  // Filter notifications based on target role
  const visibleNotifications = notifications.filter(n => {
    if (isAdmin) return true; // Admins see all
    if (role === n.target_role || n.target_role === 'All') return true;
    return false;
  });

  return (
    <>
      <Header title="Notifications" subtitle="Campus announcements and alerts" />
      <div className="page fade-in">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1>Announcements</h1>
            <p>{isStudent ? 'Official updates from your institution' : 'Publish notices and target specific user roles'}</p>
          </div>
          {(isFaculty || isAdmin || role === 'Registrar') && (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              + New Announcement
            </button>
          )}
        </div>

        {successMessage && <div className="card" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--accent-success)', padding: '1rem', marginBottom: '1.5rem', borderRadius: 8 }}>{successMessage}</div>}

        {/* Add Announcement Modal */}
        {showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2>Create Announcement</h2>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>✕</button>
              </div>
              {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Announcement Title *</label>
                  <input className="form-input" placeholder="e.g. End Semester Schedule" value={title} onChange={e => setTitle(e.target.value)} required />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select className="form-select" value={category} onChange={e => setCategory(e.target.value)} required>
                      <option value="Academic">Academic</option>
                      <option value="Exam">Exam / Results</option>
                      <option value="Placement">Placement</option>
                      <option value="Hostel">Hostel Life</option>
                      <option value="General">General Notice</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Audience *</label>
                    <select className="form-select" value={targetRole} onChange={e => setTargetRole(e.target.value)} required>
                      <option value="All">All Users</option>
                      <option value="Student">Students Only</option>
                      <option value="Faculty">Faculty Only</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Message Content *</label>
                  <textarea className="form-input" style={{ minHeight: 120, resize: 'vertical' }} placeholder="Type notice content here..." value={message} onChange={e => setMessage(e.target.value)} required />
                </div>
                <button className="btn btn-primary" type="submit" style={{ marginTop: '0.5rem' }}>Publish Notice</button>
              </form>
            </div>
          </div>
        )}

        {/* Notifications list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {loading ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading announcements…</div>
          ) : visibleNotifications.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-state-icon">🔔</div>
              <h3>No announcements</h3>
              <p>Everything is quiet for now. Check back later.</p>
            </div>
          ) : (
            visibleNotifications.map(n => (
              <div key={n.notification_id} className="card" style={{ borderLeft: `4px solid ${CATEGORY_COLOR[n.category] || '#6b7280'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="badge" style={{ background: `${CATEGORY_COLOR[n.category] || '#6b7280'}15`, color: CATEGORY_COLOR[n.category] || '#6b7280', border: `1px solid ${CATEGORY_COLOR[n.category]}30` }}>
                      {n.category}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Audience: <strong>{n.target_role}</strong>
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Published: {n.created_at.slice(0, 16).replace('T', ' ')}
                  </div>
                </div>
                <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>{n.title}</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', fontSize: '0.92rem' }}>{n.message}</p>
                <div style={{ marginTop: '1rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  By: <strong>{n.created_by_name || 'System'}</strong>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
