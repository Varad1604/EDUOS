import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { financeApi, studentsApi } from '../api';
import { usePermissions } from '../hooks/usePermissions';

interface Scholarship {
  scholarship_id: string; scholarship_name: string; scholarship_type: string;
  amount?: string; eligibility_criteria: { min_cgpa?: number }; academic_year?: number;
}
interface StudentItem {
  student_id: string; enrollment_number?: string;
  person: { first_name: string; last_name?: string };
}

export default function Scholarships() {
  const { can, isStudent } = usePermissions();
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAllotModal, setShowAllotModal] = useState<Scholarship | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('Merit');
  const [amount, setAmount] = useState(25000);
  const [minCgpa, setMinCgpa] = useState(7.5);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [allotAmount, setAllotAmount] = useState(0);

  const fetchScholarships = () => {
    setLoading(true);
    financeApi.scholarships.list()
      .then(r => setScholarships(r.data.data ?? [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchScholarships();
    if (can('scholarships.allocate')) {
      studentsApi.list({ limit: 100 }).then(r => setStudents(r.data.data ?? [])).catch(() => {});
    }
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('scholarships.create')) return;
    setError(''); setMessage('');
    if (!name) { setError('Scholarship name is required'); return; }
    financeApi.scholarships.create({
      scholarship_name: name, scholarship_type: type,
      amount: parseFloat(amount.toString()),
      eligibility_criteria: { min_cgpa: parseFloat(minCgpa.toString()) },
      academic_year: 2026, total_beneficiaries: 100, application_deadline: '2026-12-31',
    })
      .then(() => { setShowAddModal(false); setName(''); setMessage('Scholarship scheme published!'); fetchScholarships(); })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
        setError(e.response?.data?.errors?.[0]?.message || 'Failed to create scholarship');
      });
  };

  const handleAllotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAllotModal || !can('scholarships.allocate')) return;
    setError(''); setMessage('');
    financeApi.scholarships.allocate(showAllotModal.scholarship_id, {
      student_id: selectedStudentId, amount: parseFloat(allotAmount.toString()),
    })
      .then(() => { setShowAllotModal(null); setMessage('Scholarship awarded and disbursed!'); fetchScholarships(); })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
        setError(e.response?.data?.errors?.[0]?.message || 'Failed to allocate scholarship');
      });
  };

  // Student sees only their own scholarships (simplified — shows all schemes with read-only view)
  // Faculty block
  if (!can('scholarships.viewAll') && !can('scholarships.viewOwn')) {
    return (
      <>
        <Header title="Scholarships" subtitle="Access denied" />
        <div className="page fade-in">
          <div className="empty-state">
            <div className="empty-state-icon">🔒</div>
            <h3>Access Denied</h3>
            <p>Faculty do not have access to the Scholarships module.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Scholarships" subtitle={isStudent ? 'Financial aid schemes you may apply to' : 'Manage scholarship schemes and allocations'} />
      <div className="page fade-in">
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1>{isStudent ? 'Available Scholarships' : 'Financial Aid & Scholarships'}</h1>
            <p>{isStudent ? 'View eligibility criteria and your allotted scholarships' : 'Create schemes and award grants to eligible students'}</p>
          </div>
          {can('scholarships.create') && (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Configure Scholarship</button>
          )}
        </div>

        {/* Student notice */}
        {isStudent && (
          <div style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span>ℹ️</span> Below are active scholarship schemes. Contact the Registrar's office to apply or check your allotment status.
          </div>
        )}

        {message && <div className="card" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--accent-success)', padding: '1rem', marginBottom: '1.5rem', borderRadius: 8 }}>{message}</div>}
        {error && <div className="login-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        {/* Create scheme modal — Principal / Registrar / FeeManager */}
        {can('scholarships.create') && showAddModal && (
          <div className="card" style={{ marginBottom: '1.5rem', maxWidth: 500, border: '1px solid var(--accent-primary)' }}>
            <div className="card-header">
              <h3>Create Scholarship Scheme</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Scholarship Name *</label>
                <input className="form-input" placeholder="e.g. Merit-cum-Means Grant" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Type *</label>
                  <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                    <option value="Merit">Merit Based</option>
                    <option value="Government">Government Welfare</option>
                    <option value="Need">Need Based</option>
                    <option value="Private">Private Endowment</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Grant Amount (INR)</label>
                  <input type="number" className="form-input" value={amount} onChange={e => setAmount(parseFloat(e.target.value))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Min Eligibility CGPA</label>
                <input type="number" step="0.1" className="form-input" value={minCgpa} onChange={e => setMinCgpa(parseFloat(e.target.value))} />
              </div>
              <button className="btn btn-primary" type="submit">Publish Scheme</button>
            </form>
          </div>
        )}

        {/* Award modal — Principal / Registrar / FeeManager */}
        {can('scholarships.allocate') && showAllotModal && (
          <div className="card" style={{ marginBottom: '1.5rem', maxWidth: 500, border: '1px solid var(--accent-success)' }}>
            <div className="card-header">
              <h3>Award: {showAllotModal.scholarship_name}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAllotModal(null)}>✕</button>
            </div>
            <form onSubmit={handleAllotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Select Student *</label>
                <select className="form-select" value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)} required>
                  <option value="">-- Select Student --</option>
                  {students.map(s => (
                    <option key={s.student_id} value={s.student_id}>
                      {s.person.first_name} {s.person.last_name ?? ''} ({s.enrollment_number ?? 'No ID'})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Disbursal Amount (INR) *</label>
                <input type="number" className="form-input" value={allotAmount} onChange={e => setAllotAmount(parseFloat(e.target.value))} required />
              </div>
              <button className="btn btn-primary" type="submit">Confirm & Disburse</button>
            </form>
          </div>
        )}

        {/* Scholarship list */}
        <div className="card">
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading schemes…</div>
          ) : scholarships.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🎓</div>
              <h3>No scholarship schemes yet</h3>
              <p>{isStudent ? 'No active scholarships at this time.' : 'Configure a financial aid scheme to award grants.'}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Scheme Name</th><th>Type</th><th>Grant Amount</th>
                    <th>Min CGPA</th><th>Year</th>
                    {can('scholarships.allocate') && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {scholarships.map(s => (
                    <tr key={s.scholarship_id}>
                      <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{s.scholarship_name}</td>
                      <td><span className="badge badge-muted">{s.scholarship_type}</span></td>
                      <td style={{ fontWeight: 600 }}>₹{s.amount ? parseFloat(s.amount).toLocaleString() : '—'}</td>
                      <td>{s.eligibility_criteria?.min_cgpa ?? '—'}</td>
                      <td>{s.academic_year ?? '—'}</td>
                      {can('scholarships.allocate') && (
                        <td>
                          <button className="btn btn-secondary btn-sm"
                            onClick={() => { setAllotAmount(s.amount ? parseFloat(s.amount) : 10000); setShowAllotModal(s); }}>
                            Award Student
                          </button>
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
