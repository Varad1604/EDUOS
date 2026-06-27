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
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  // Form fields
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

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse || !can('courses.edit')) return;
    setError('');
    if (!editingCourse.course_code || !editingCourse.course_name) { setError('Please fill in all required fields'); return; }
    
    academicsApi.courses.update(editingCourse.course_id, {
      curriculum_id: editingCourse.curriculum_id,
      course_code: editingCourse.course_code,
      course_name: editingCourse.course_name,
      credits: parseFloat(editingCourse.credits.toString()),
      course_type: editingCourse.course_type,
      semester: parseInt(editingCourse.semester?.toString() || '1'),
      min_marks: editingCourse.min_marks,
      max_marks: editingCourse.max_marks,
    })
      .then(() => { setEditingCourse(null); fetchCourses(); })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
        setError(e.response?.data?.errors?.[0]?.message || 'Failed to update course');
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
        <div className="page-header">
          <div>
            <h1>Courses</h1>
            <p>
              {isFaculty ? `${courses.length} courses allocated to you` :
               isStudent ? `${courses.length} courses you are enrolled in` :
               `${courses.length} curriculum courses`}
            </p>
          </div>
          {can('courses.create') && (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>Add Course</button>
          )}
        </div>

        {/* Read-only notice for Faculty/Student */}
        {(isFaculty || isStudent) && (
          <div className="info-panel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div>
              {isFaculty 
                ? 'You can view course details. Course creation and editing is managed by the Principal or Registrar.' 
                : 'You can view your enrolled courses. Contact your registrar for enrollment changes.'}
            </div>
          </div>
        )}

        {/* Create Course Modal */}
        {can('courses.create') && showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>Create New Course</h2>
              {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
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
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button className="btn btn-primary" type="submit">Save Course</button>
                  <button className="btn btn-secondary" type="button" onClick={() => setShowAddModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Course Modal */}
        {can('courses.edit') && editingCourse && (
          <div className="modal-overlay" onClick={() => setEditingCourse(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>Edit Course Details</h2>
              {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
              <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Course Code *</label>
                  <input className="form-input" value={editingCourse.course_code} onChange={e => setEditingCourse({...editingCourse, course_code: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Course Name *</label>
                  <input className="form-input" value={editingCourse.course_name} onChange={e => setEditingCourse({...editingCourse, course_name: e.target.value})} />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Credits *</label>
                    <input type="number" className="form-input" value={editingCourse.credits} onChange={e => setEditingCourse({...editingCourse, credits: parseFloat(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Semester *</label>
                    <select className="form-select" value={editingCourse.semester || 1} onChange={e => setEditingCourse({...editingCourse, semester: parseInt(e.target.value)})}>
                      {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Course Type *</label>
                  <select className="form-select" value={editingCourse.course_type} onChange={e => setEditingCourse({...editingCourse, course_type: e.target.value})}>
                    <option>Theory</option><option>Practical</option><option>Project</option><option>Seminar</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button className="btn btn-primary" type="submit">Update Course</button>
                  <button className="btn btn-secondary" type="button" onClick={() => setEditingCourse(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="card">
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading courses…</div>
          ) : courses.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </div>
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
                      <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{c.course_code}</td>
                      <td>{c.course_name}</td>
                      <td>{c.credits}</td>
                      <td><span className={`badge ${c.course_type === 'Theory' ? 'badge-info' : 'badge-success'}`}>{c.course_type}</span></td>
                      <td>Sem {c.semester ?? 1}</td>
                      <td>{c.min_marks} / {c.max_marks}</td>
                      {can('courses.edit') && (
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => { setError(''); setEditingCourse(c); }}>Edit</button>
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
