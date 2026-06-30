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
  const { isStudent, isFaculty, isAdmin } = usePermissions();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState('Medical');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const fetchLeaves = () => {
    setLoading(true);
    academicsApi.leaveRequests.list()
      .then(r => setLeaves(r.data.data ?? []))
      .catch(err => console.warn('Request failed:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLeaves(); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!startDate || !endDate || !reason) { setError('Please fill all fields'); return; }
    
    academicsApi.leaveRequests.create({
      start_date: startDate,
      end_date: endDate,
      leave_type: leaveType,
      reason,
    })
      .then(() => { 
        setShowAddModal(false); 
        setStartDate(''); setEndDate(''); setReason(''); 
        fetchLeaves(); 
      })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
        setError(e.response?.data?.errors?.[0]?.message || 'Failed to apply for leave');
      });
  };

  const handleUpdateStatus = (id: string, status: string) => {
    if (window.confirm(`Are you sure you want to mark this request as ${status}?`)) {
      academicsApi.leaveRequests.updateStatus(id, { status })
        .then(() => fetchLeaves())
        .catch(err => console.warn('Update failed', err));
    }
  };

  return (
    <>
      <Header title="Leave Management" subtitle="Track and apply for student and staff leave requests" />
      <div className="page-layout">
        {(isStudent || isFaculty) && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              Apply for Leave
            </button>
          </div>
        )}

        {/* Add Leave Modal */}
        {showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>Apply for Leave</h2>
              {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Start Date *</label>
                    <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date *</label>
                    <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Leave Type *</label>
                  <select className="form-select" value={leaveType} onChange={e => setLeaveType(e.target.value)}>
                    <option>Medical</option>
                    <option>Personal</option>
                    <option>Academic Event</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Reason *</label>
                  <textarea className="form-input" rows={3} value={reason} onChange={e => setReason(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button className="btn btn-primary" type="submit">Submit Request</button>
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
              <h3>No leave requests found</h3>
            </div>
          ) : (
             <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Requester</th>
                    <th>Type</th>
                    <th>Dates</th>
                    <th>Reason</th>
                    <th>Status</th>
                    {(isAdmin || isFaculty) && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {leaves.map(l => (
                    <tr key={l.leave_id}>
                      <td>
                        <span className={`badge ${l.student_id ? 'badge-info' : 'badge-success'}`} style={{ fontSize: '0.8rem', padding: '2px 6px' }}>
                          {l.student_id ? 'Student' : 'Faculty'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{l.leave_type}</td>
                      <td>{new Date(l.start_date).toLocaleDateString()} - {new Date(l.end_date).toLocaleDateString()}</td>
                      <td>{l.reason}</td>
                      <td>
                        <span className={`badge ${l.status === 'Approved' ? 'badge-success' : l.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>
                          {l.status}
                        </span>
                      </td>
                      {(isAdmin || isFaculty) && l.status === 'Pending' && (
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-primary btn-sm" onClick={() => handleUpdateStatus(l.leave_id, 'Approved')}>Approve</button>
                            <button className="btn btn-secondary btn-sm" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => handleUpdateStatus(l.leave_id, 'Rejected')}>Reject</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
