import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { academicsApi } from '../api';
import { usePermissions } from '../hooks/usePermissions';

interface LeaveRequest {
  leave_id: string;
  student_id?: string | null;
  faculty_id?: string | null;
  start_date: string;
  end_date: string;
  leave_type: string;
  reason: string;
  status: string;
  approved_by?: string;
  created_at: string;
}

export default function LeaveManagement() {
  const { user, isStudent, isFaculty, isAdmin } = usePermissions();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState('Medical');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchLeaves = () => {
    setLoading(true);
    academicsApi.leaveRequests.list()
      .then(r => {
        const all: LeaveRequest[] = r.data.data ?? [];
        // Faculty only see their own leave requests
        if (isFaculty && user?.user_id) {
          setLeaves(all.filter(l => l.faculty_id === user.user_id));
        } else {
          setLeaves(all);
        }
      })
      .catch(err => console.warn('Request failed:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLeaves(); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!startDate || !endDate || !reason) { setError('Please fill all fields'); return; }
    setSubmitting(true);

    // Optimistic update — add to list immediately
    const optimistic: LeaveRequest = {
      leave_id: `temp-${Date.now()}`,
      faculty_id: user?.user_id,
      start_date: startDate,
      end_date: endDate,
      leave_type: leaveType,
      reason,
      status: 'Pending',
      created_at: new Date().toISOString(),
    };
    setLeaves(prev => [optimistic, ...prev]);
    setShowAddModal(false);
    setStartDate(''); setEndDate(''); setReason('');

    academicsApi.leaveRequests.create({
      start_date: optimistic.start_date,
      end_date: optimistic.end_date,
      leave_type: optimistic.leave_type,
      reason: optimistic.reason,
    })
      .then(() => {
        // Replace optimistic entry with real data
        fetchLeaves();
      })
      .catch((err: unknown) => {
        // Rollback optimistic update on failure
        setLeaves(prev => prev.filter(l => l.leave_id !== optimistic.leave_id));
        setShowAddModal(true);
        const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
        setError(e.response?.data?.errors?.[0]?.message || 'Failed to apply for leave');
      })
      .finally(() => setSubmitting(false));
  };

  // Only admins (Principal / Registrar) can approve or reject leave
  const handleUpdateStatus = (id: string, status: string) => {
    if (!isAdmin) return;
    if (window.confirm(`Mark this request as ${status}?`)) {
      academicsApi.leaveRequests.updateStatus(id, { status })
        .then(() => fetchLeaves())
        .catch(err => console.warn('Update failed', err));
    }
  };

  const statusBadge = (status: string) => {
    const cls = status === 'Approved' ? 'badge-success' : status === 'Rejected' ? 'badge-danger' : 'badge-warning';
    return <span className={`badge ${cls}`}>{status}</span>;
  };

  const fmt = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  return (
    <>
      <Header
        title="Leave Management"
        subtitle={isAdmin ? 'Review and approve faculty leave requests' : 'Apply for leave and track your request status'}
      />
      <div className="page-layout">
        {/* Apply button — Faculty only */}
        {isFaculty && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              + Apply for Leave
            </button>
          </div>
        )}

        {/* Apply Leave Modal */}
        {showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>Apply for Leave</h2>
              {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Start Date *</label>
                    <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date *</label>
                    <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Leave Type *</label>
                  <select className="form-select" value={leaveType} onChange={e => setLeaveType(e.target.value)}>
                    <option>Medical</option>
                    <option>Personal</option>
                    <option>Academic Event</option>
                    <option>Emergency</option>
                    <option>Conference / Training</option>
                    <option>Casual Leave</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Reason *</label>
                  <textarea className="form-input" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Brief reason for the leave..." />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button className="btn btn-primary" type="submit" disabled={submitting}>
                    {submitting ? 'Submitting…' : 'Submit Request'}
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => setShowAddModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="card">
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading leave requests…</div>
          ) : leaves.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <h3>{isAdmin ? 'No leave requests found' : 'No leave requests yet'}</h3>
              {isFaculty && <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Click "+ Apply for Leave" to submit a new request.</p>}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Leave Type</th>
                    {isAdmin && <th>Requester</th>}
                    <th>From</th>
                    <th>To</th>
                    <th>Days</th>
                    <th>Reason</th>
                    <th>Status</th>
                    {isAdmin && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {leaves.map(l => {
                    const days = Math.max(1, Math.round((new Date(l.end_date).getTime() - new Date(l.start_date).getTime()) / 86400000) + 1);
                    return (
                      <tr key={l.leave_id}>
                        <td style={{ fontWeight: 600 }}>{l.leave_type}</td>
                        {isAdmin && (
                          <td>
                            <span className={`badge ${l.student_id ? 'badge-info' : 'badge-success'}`} style={{ fontSize: '0.78rem' }}>
                              {l.student_id ? 'Student' : 'Faculty'}
                            </span>
                          </td>
                        )}
                        <td>{fmt(l.start_date)}</td>
                        <td>{fmt(l.end_date)}</td>
                        <td><span className="badge badge-info">{days}d</span></td>
                        <td style={{ maxWidth: 200, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{l.reason}</td>
                        <td>{statusBadge(l.status)}</td>
                        {isAdmin && (
                          <td>
                            {l.status === 'Pending' ? (
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-primary btn-sm" onClick={() => handleUpdateStatus(l.leave_id, 'Approved')}>
                                  ✓ Approve
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                                  onClick={() => handleUpdateStatus(l.leave_id, 'Rejected')}
                                >
                                  ✗ Reject
                                </button>
                              </div>
                            ) : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>—</span>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
