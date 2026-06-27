import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import { studentsApi } from '../api';
import { usePermissions } from '../hooks/usePermissions';

interface Student {
  student_id: string;
  enrollment_number?: string;
  enrollment_status: string;
  enrollment_date?: string;
  branch_id?: string;
  current_semester?: number;
  cgpa?: string;
  person: { first_name: string; last_name?: string; phone?: string; email?: string; };
}

const STATUS_BADGE: Record<string, string> = {
  Active: 'badge-success', Applicant: 'badge-info', Admitted: 'badge-info',
  Detained: 'badge-warning', Alumni: 'badge-muted', Dropout: 'badge-danger', Inquiry: 'badge-muted',
};

// Student: View own profile only
function MyProfile() {
  const { user } = usePermissions();
  const [me, setMe] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentsApi.list({ limit: 200 })
      .then(r => {
        const list: Student[] = r.data.data ?? [];
        const found = list.find(s =>
          s.person.email?.toLowerCase().includes(user?.username?.toLowerCase() ?? '') ||
          s.person.first_name?.toLowerCase() === user?.username?.toLowerCase()
        );
        setMe(found ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.username]);

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading Profile...</div>;
  if (!me) return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h3>Profile Not Found</h3>
      <p>Your student record could not be located. Contact the registrar's office.</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 700 }}>
      <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--color-primary-light)', border: '1px solid var(--color-primary-border)' }}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', fontSize: '2rem', fontWeight: 700, flexShrink: 0, color: '#fff', justifyContent: 'center' }}>
            {me.person.first_name[0]}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{me.person.first_name} {me.person.last_name}</div>
            <div style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>Enrollment No: <strong style={{ color: 'var(--color-text-primary)' }}>{me.enrollment_number ?? 'Not assigned'}</strong></div>
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
              <span className={`badge ${STATUS_BADGE[me.enrollment_status] ?? 'badge-muted'}`}>{me.enrollment_status}</span>
              {me.current_semester && <span className="badge badge-info">Semester {me.current_semester}</span>}
            </div>
          </div>
          {me.cgpa && (
            <div style={{ textAlign: 'center', background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)', borderRadius: 4, padding: '12px 20px' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-success)' }}>{me.cgpa}</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>CGPA</div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>Contact Information</h3></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '0.25rem 0' }}>
          {[
            { label: 'Email', value: me.person.email ?? '—' },
            { label: 'Phone', value: me.person.phone ?? '—' },
            { label: 'Enrolled On', value: me.enrollment_date?.slice(0, 10) ?? '—' },
            { label: 'Student ID', value: me.student_id },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</div>
              <div style={{ fontWeight: 500, color: 'var(--color-text-primary)', fontSize: '0.9rem', wordBreak: 'break-all' }}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Staff: Full student list with role-controlled actions
function StudentList() {
  const { can, user } = usePermissions();
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tab, setTab]           = useState('All');

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  const TABS = ['All','Active','Applicant','Detained','Alumni','Dropout'];

  useEffect(() => {
    setLoading(true);
    studentsApi.list({ page, limit: 20, status: statusFilter || undefined, search: search || undefined })
      .then(r => {
        setStudents(r.data.data ?? []);
        setTotal(r.data.meta?.pagination?.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, statusFilter, search]);

  const handleTabChange = (t: string) => { setTab(t); setStatusFilter(t === 'All' ? '' : t); setPage(1); };
  
  const handleStatusChange = async (id: string, newStatus: string) => {
    if (!can('students.edit')) return;
    await studentsApi.setStatus(id, { enrollment_status: newStatus });
    setStudents(prev => prev.map(s => s.student_id === id ? { ...s, enrollment_status: newStatus } : s));
  };

  const handleDeleteConfirm = async () => {
    if (!studentToDelete || !can('students.delete')) return;
    try {
      await studentsApi.delete(studentToDelete.student_id);
      setStudents(prev => prev.filter(s => s.student_id !== studentToDelete.student_id));
      setTotal(prev => prev - 1);
      setStudentToDelete(null);
    } catch (err) {
      alert('Failed to delete student record.');
    }
  };

  const handleExport = () => {
    const headers = ['Student ID', 'Enrollment Number', 'First Name', 'Last Name', 'Email', 'Phone', 'Semester', 'Status', 'CGPA'];
    const rows = students.map(s => [
      s.student_id,
      s.enrollment_number || '',
      s.person.first_name,
      s.person.last_name || '',
      s.person.email || '',
      s.person.phone || '',
      s.current_semester || '',
      s.enrollment_status,
      s.cgpa || ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "students_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Enroll Student modal
  const [showEnrollModal, setShowEnrollModal] = React.useState(false);
  const [enrollError, setEnrollError] = React.useState('');
  const [enrollLoading, setEnrollLoading] = React.useState(false);
  const [enrollForm, setEnrollForm] = React.useState({
    first_name: '', last_name: '', email: '', phone: '',
    enrollment_number: '', current_semester: '1', enrollment_status: 'Active',
    branch_id: '', enrollment_date: new Date().toISOString().slice(0, 10),
  });

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('students.create')) return;
    setEnrollError(''); setEnrollLoading(true);
    try {
      await studentsApi.create({
        institution_id: user?.institution_id || '550e8400-e29b-41d4-a716-446655440000',
        person: {
          first_name: enrollForm.first_name, last_name: enrollForm.last_name || null,
          email: enrollForm.email || null, phone: enrollForm.phone || null,
        },
        enrollment_number: enrollForm.enrollment_number || null,
        current_semester: parseInt(enrollForm.current_semester) || 1,
        enrollment_status: enrollForm.enrollment_status,
        branch_id: enrollForm.branch_id || null,
        enrollment_date: enrollForm.enrollment_date,
      });
      setShowEnrollModal(false);
      setEnrollForm({ first_name: '', last_name: '', email: '', phone: '', enrollment_number: '', current_semester: '1', enrollment_status: 'Active', branch_id: '', enrollment_date: new Date().toISOString().slice(0, 10) });
      setLoading(true);
      studentsApi.list({ page: 1, limit: 20 })
        .then(r => { setStudents(r.data.data ?? []); setTotal(r.data.meta?.pagination?.total ?? 0); setPage(1); })
        .finally(() => setLoading(false));
    } catch (err: any) {
      setEnrollError(err?.response?.data?.errors?.[0]?.message ?? 'Failed to enroll student');
    } finally { setEnrollLoading(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Students</h1>
          <p>{total.toLocaleString()} total records</p>
        </div>
        {can('students.create') && (
          <button id="add-student-btn" className="btn btn-primary" onClick={() => setShowEnrollModal(true)}>Enroll Student</button>
        )}
      </div>

      {/* Enroll Student Modal */}
      {showEnrollModal && (
        <div className="modal-overlay" onClick={() => setShowEnrollModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h2>Enroll New Student</h2>
            {enrollError && <div className="login-error" style={{ marginBottom: 16 }}>{enrollError}</div>}
            <form onSubmit={handleEnrollSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input className="form-input" required value={enrollForm.first_name} onChange={e => setEnrollForm(p => ({ ...p, first_name: e.target.value }))} placeholder="First name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input className="form-input" value={enrollForm.last_name} onChange={e => setEnrollForm(p => ({ ...p, last_name: e.target.value }))} placeholder="Last name" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={enrollForm.email} onChange={e => setEnrollForm(p => ({ ...p, email: e.target.value }))} placeholder="student@eduos.org" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={enrollForm.phone} onChange={e => setEnrollForm(p => ({ ...p, phone: e.target.value }))} placeholder="+91 98xxxxxxxx" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Enrollment Number</label>
                  <input className="form-input" value={enrollForm.enrollment_number} onChange={e => setEnrollForm(p => ({ ...p, enrollment_number: e.target.value }))} placeholder="e.g. 2024CSE001" />
                </div>
                <div className="form-group">
                  <label className="form-label">Semester</label>
                  <select className="form-select" value={enrollForm.current_semester} onChange={e => setEnrollForm(p => ({ ...p, current_semester: e.target.value }))}>
                    {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={enrollForm.enrollment_status} onChange={e => setEnrollForm(p => ({ ...p, enrollment_status: e.target.value }))}>
                    {['Active','Admitted','Applicant','Detained','Alumni','Dropout'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Enrollment Date</label>
                  <input className="form-input" type="date" value={enrollForm.enrollment_date} onChange={e => setEnrollForm(p => ({ ...p, enrollment_date: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="submit" className="btn btn-primary" disabled={enrollLoading}>{enrollLoading ? 'Processing…' : 'Enroll Student'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEnrollModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="modal-overlay" onClick={() => setSelectedStudent(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h2>Student Details</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span className="form-label">First Name</span>
                  <div className="form-input" style={{ background: 'var(--color-surface-2)' }}>{selectedStudent.person.first_name}</div>
                </div>
                <div>
                  <span className="form-label">Last Name</span>
                  <div className="form-input" style={{ background: 'var(--color-surface-2)' }}>{selectedStudent.person.last_name || '—'}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span className="form-label">Email Address</span>
                  <div className="form-input" style={{ background: 'var(--color-surface-2)', wordBreak: 'break-all' }}>{selectedStudent.person.email || '—'}</div>
                </div>
                <div>
                  <span className="form-label">Phone Number</span>
                  <div className="form-input" style={{ background: 'var(--color-surface-2)' }}>{selectedStudent.person.phone || '—'}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span className="form-label">Enrollment Number</span>
                  <div className="form-input" style={{ background: 'var(--color-surface-2)' }}>{selectedStudent.enrollment_number || '—'}</div>
                </div>
                <div>
                  <span className="form-label">Current Semester</span>
                  <div className="form-input" style={{ background: 'var(--color-surface-2)' }}>Semester {selectedStudent.current_semester || '—'}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span className="form-label">Branch ID</span>
                  <div className="form-input" style={{ background: 'var(--color-surface-2)' }}>{selectedStudent.branch_id || '—'}</div>
                </div>
                <div>
                  <span className="form-label">Enrollment Status</span>
                  <div className="form-input" style={{ background: 'var(--color-surface-2)' }}>{selectedStudent.enrollment_status}</div>
                </div>
              </div>
              {selectedStudent.cgpa && (
                <div>
                  <span className="form-label">Cumulative GPA (CGPA)</span>
                  <div className="form-input" style={{ background: 'var(--color-surface-2)', fontWeight: 'bold', color: 'var(--color-success)' }}>{selectedStudent.cgpa}</div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedStudent(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {studentToDelete && (
        <div className="modal-overlay" onClick={() => setStudentToDelete(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h2>Confirm Record Removal</h2>
            <p style={{ marginBottom: 20 }}>Are you sure you want to remove the record of student <strong>{studentToDelete.person.first_name} {studentToDelete.person.last_name || ''}</strong>? This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-danger" onClick={handleDeleteConfirm}>Delete</button>
              <button type="button" className="btn btn-secondary" onClick={() => setStudentToDelete(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="tabs">
        {TABS.map(t => <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => handleTabChange(t)}>{t}</div>)}
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', gap: '0.75rem', flex: 1, alignItems: 'center' }}>
            <input className="form-input" placeholder="Search by name, enrollment number…" style={{ maxWidth: 340 }}
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          {can('students.viewAll') && <button className="btn btn-secondary btn-sm" onClick={handleExport}>Export CSV</button>}
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading students…</div>
        ) : students.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3>No Students Found</h3>
            <p>Try adjusting your search criteria or filters.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th><th>Enrollment No.</th><th>Semester</th>
                  <th>Status</th><th>CGPA</th><th>Contact</th>
                  {can('students.edit') && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.student_id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0, color: 'var(--color-primary)' }}>
                          {s.person.first_name[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{s.person.first_name} {s.person.last_name ?? ''}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{s.person.email ?? s.student_id.slice(0, 8) + '…'}</div>
                        </div>
                      </div>
                    </td>
                    <td>{s.enrollment_number ?? '—'}</td>
                    <td>{s.current_semester ? `Sem ${s.current_semester}` : '—'}</td>
                    <td><span className={`badge ${STATUS_BADGE[s.enrollment_status] ?? 'badge-muted'}`}>{s.enrollment_status}</span></td>
                    <td>{s.cgpa ? <strong style={{ color: parseFloat(s.cgpa) >= 7.5 ? 'var(--color-success)' : 'var(--accent-warning)' }}>{s.cgpa}</strong> : '—'}</td>
                    <td style={{ fontSize: '0.8rem' }}>{s.person.phone ?? s.person.email ?? '—'}</td>
                    {can('students.edit') && (
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedStudent(s)}>View</button>
                          {can('students.edit') && (
                            <select
                              className="form-select"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: 'auto', minWidth: 110 }}
                              value={s.enrollment_status}
                              onChange={e => handleStatusChange(s.student_id, e.target.value)}
                            >
                              {['Active','Admitted','Detained','Alumni','Dropout'].map(st => <option key={st}>{st}</option>)}
                            </select>
                          )}
                          {can('students.delete') && <button className="btn btn-danger btn-sm" onClick={() => setStudentToDelete(s)}>Remove</button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 20 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '1rem 0 0' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
            <span style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Page {page} of {Math.ceil(total / 20)}</span>
            <button className="btn btn-secondary btn-sm" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </>
  );
}

// Page entry point
export default function Students() {
  const { can, isStudent } = usePermissions();

  if (!can('students.viewAll') && !can('students.viewOwn')) {
    return (
      <>
        <Header title="Students" subtitle="Access denied" />
        <div className="page fade-in">
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3>Access Denied</h3>
            <p>You do not have permission to access the Students module.</p>
          </div>
        </div>
      </>
    );
  }

  const subtitle = isStudent ? 'My Profile' : 'Student Lifecycle Management';

  return (
    <>
      <Header title={isStudent ? 'My Profile' : 'Students'} subtitle={subtitle} />
      <div className="page fade-in">
        {isStudent ? <MyProfile /> : <StudentList />}
      </div>
    </>
  );
}
