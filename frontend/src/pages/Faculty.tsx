import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { academicsApi } from '../api';
import { usePermissions } from '../hooks/usePermissions';

interface FacultyMember {
  faculty_id: string;
  employee_code?: string;
  designation: string;
  qualification?: string;
  specialization?: string;
  joining_date?: string;
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  department_name?: string;
}

export default function Faculty() {
  const { isStudent } = usePermissions();
  const [faculty, setFaculty] = useState<FacultyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');

  const fetchFaculty = () => {
    setLoading(true);
    academicsApi.faculty.list()
      .then(r => setFaculty(r.data.data ?? []))
      .catch(err => console.warn('Request failed:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isStudent) {
      fetchFaculty();
    }
  }, [isStudent]);

  if (isStudent) {
    return (
      <div className="empty-state">
        <h3>Access Denied</h3>
        <p>Students are not authorized to view the administrative faculty registry.</p>
      </div>
    );
  }

  const filteredFaculty = faculty.filter(f => {
    const fullName = `${f.first_name} ${f.last_name || ''}`.toLowerCase();
    const matchesSearch = fullName.includes(search.toLowerCase()) || 
                          (f.employee_code && f.employee_code.toLowerCase().includes(search.toLowerCase())) ||
                          (f.department_name && f.department_name.toLowerCase().includes(search.toLowerCase()));
    const matchesDesignation = designationFilter ? f.designation === designationFilter : true;
    return matchesSearch && matchesDesignation;
  });

  return (
    <>
      <Header title="Faculty Registry" subtitle="Manage and monitor academic staff credentials and departments" />
      <div className="page-layout">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 250 }}>
            <input
              type="text"
              placeholder="Search faculty by name, code or department..."
              className="form-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ width: 200 }}>
            <select
              className="form-select"
              value={designationFilter}
              onChange={e => setDesignationFilter(e.target.value)}
            >
              <option value="">All Designations</option>
              <option value="Professor">Professor</option>
              <option value="AssocProf">Associate Professor</option>
              <option value="AsstProf">Assistant Professor</option>
              <option value="Lecturer">Lecturer</option>
            </select>
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Loading faculty members...
            </div>
          ) : filteredFaculty.length === 0 ? (
            <div className="empty-state">
              <h3>No faculty records found</h3>
              <p>Try refining your search terms or filters.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Faculty Name</th>
                    <th>Employee Code</th>
                    <th>Designation</th>
                    <th>Department</th>
                    <th>Qualification</th>
                    <th>Specialization</th>
                    <th>Contact Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFaculty.map(f => (
                    <tr key={f.faculty_id}>
                      <td>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                            {f.first_name[0]}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{f.first_name} {f.last_name || ''}</div>
                            {f.joining_date && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                Joined {new Date(f.joining_date).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <code style={{ fontSize: '0.85rem' }}>{f.employee_code ?? 'N/A'}</code>
                      </td>
                      <td>
                        <span className={`badge ${
                          f.designation === 'Professor' ? 'badge-success' :
                          f.designation === 'AssocProf' ? 'badge-info' :
                          f.designation === 'AsstProf' ? 'badge-warning' : 'badge-muted'
                        }`}>
                          {f.designation === 'AssocProf' ? 'Associate Prof' :
                           f.designation === 'AsstProf' ? 'Assistant Prof' : f.designation}
                        </span>
                      </td>
                      <td>{f.department_name ?? 'N/A'}</td>
                      <td><strong>{f.qualification ?? 'N/A'}</strong></td>
                      <td>{f.specialization ?? 'N/A'}</td>
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>
                          {f.email && <div style={{ color: 'var(--color-text-primary)' }}>{f.email}</div>}
                          {f.phone && <div style={{ color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>{f.phone}</div>}
                        </div>
                      </td>
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
