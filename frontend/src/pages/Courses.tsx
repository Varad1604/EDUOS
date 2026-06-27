import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { academicsApi } from '../api';
import { usePermissions } from '../hooks/usePermissions';

interface Course {
  course_id: string;
  course_code: string;
  course_name: string;
  credits: number;
  course_type: string;
  semester?: number;
  min_marks: number;
  max_marks: number;
  curriculum_id: string;
}

export default function Courses() {
  const { can, isFaculty, isStudent } = usePermissions();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [credits, setCredits] = useState(4);
  const [courseType, setCourseType] = useState('Theory');
  const [semester, setSemester] = useState(1);
  const [error, setError] = useState('');

  const fetchCourses = () => {
    setLoading(true);
    academicsApi.courses.list()
      .then(r => setCourses(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCourses(); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('courses.create')) return;
    setError('');
    if (!courseCode || !courseName) { setError('Please fill in all required fields'); return; }
    const curriculumId = courses[0]?.curriculum_id || '550e8400-e29b-41d4-a716-446655440000';
    academicsApi.courses.create({
      curriculum_id: curriculumId, course_code: courseCode, course_name: courseName,
      credits: parseFloat(credits.toString()), course_type: courseType,
      semester: parseInt(semester.toString()), min_marks: 35, max_marks: 100,
    })
      .then(() => { setShowAddModal(false); setCourseCode(''); setCourseName(''); fetchCourses(); })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
        setError(e.response?.data?.errors?.[0]?.message || 'Failed to create course');
      });
  };

  const pageSubtitle =
    isFaculty ? 'Courses allocated to you this semester' :
    isStudent ? 'Your enrolled courses' :
    'Curriculum and syllabus management';

  return (
    <>
      <Header title="Courses" subtitle={pageSubtitle} />
      <div className="page fade-in">
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1>Courses</h1>
            <p>
              {isFaculty ? `${courses.length} courses allocated to you` :
               isStudent ? `${courses.length} courses you are enrolled in` :
               `${courses.length} curriculum courses`}
            </p>
          </div>
          {can('courses.create') && (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add Course</button>
          )}
        </div>

        {/* Read-only banner for Faculty/Student */}
        {(isFaculty || isStudent) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span>ℹ️</span>
            {isFaculty ? 'You can view course details. Course creation and editing is managed by the Principal or Registrar.' : 'You can view your enrolled courses. Contact your registrar for enrollment changes.'}
          </div>
        )}

        {can('courses.create') && showAddModal && (
          <div className="card" style={{ marginBottom: '1.5rem', maxWidth: 500, border: '1px solid var(--accent-primary)' }}>
            <div className="card-header">
              <h3>Create New Course</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            {error && <div className="login-error">{error}</div>}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Course Code *</label>
                <input className="form-input" placeholder="e.g. CS103" value={courseCode} onChange={e => setCourseCode(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Course Name *</label>
                <input className="form-input" placeholder="e.g. Object Oriented Programming" value={courseName} onChange={e => setCourseName(e.target.value)} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Credits *</label>
                  <input type="number" className="form-input" value={credits} onChange={e => setCredits(parseFloat(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Semester *</label>
                  <select className="form-select" value={semester} onChange={e => setSemester(parseInt(e.target.value))}>
                    {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Course Type *</label>
                <select className="form-select" value={courseType} onChange={e => setCourseType(e.target.value)}>
                  <option>Theory</option><option>Practical</option><option>Project</option><option>Seminar</option>
                </select>
              </div>
              <button className="btn btn-primary" type="submit">Save Course</button>
            </form>
          </div>
        )}

        <div className="card">
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading courses…</div>
          ) : courses.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📚</div>
              <h3>{isFaculty ? 'No courses allocated' : isStudent ? 'No courses enrolled' : 'No courses found'}</h3>
              <p>{isFaculty ? 'Contact the Principal to get courses allocated.' : isStudent ? 'Your enrollment is being processed.' : 'Add courses to build the curriculum.'}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th><th>Name</th><th>Credits</th><th>Type</th><th>Semester</th>
                    <th>Min / Max Marks</th>
                    {can('courses.edit') && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {courses.map(c => (
                    <tr key={c.course_id}>
                      <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{c.course_code}</td>
                      <td>{c.course_name}</td>
                      <td>{c.credits}</td>
                      <td><span className={`badge ${c.course_type === 'Theory' ? 'badge-info' : 'badge-success'}`}>{c.course_type}</span></td>
                      <td>Sem {c.semester ?? 1}</td>
                      <td>{c.min_marks} / {c.max_marks}</td>
                      {can('courses.edit') && (
                        <td>
                          <button className="btn btn-secondary btn-sm">Edit</button>
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
