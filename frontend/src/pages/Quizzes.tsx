import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { academicsApi } from '../api';
import { usePermissions } from '../hooks/usePermissions';

interface Quiz {
  quiz_id: string;
  course_id: string;
  course_name?: string;
  course_code?: string;
  title: string;
  description?: string;
  total_marks: number;
  quiz_date: string;
  created_at: string;
}

interface Course {
  course_id: string;
  course_code: string;
  course_name: string;
}

export default function Quizzes() {
  const { isStudent, isFaculty, isAdmin } = usePermissions();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [totalMarks, setTotalMarks] = useState(10);
  const [quizDate, setQuizDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const fetchQuizzes = () => {
    setLoading(true);
    academicsApi.quizzes.list()
      .then(r => setQuizzes(r.data.data ?? []))
      .catch(err => console.warn('Request failed:', err))
      .finally(() => setLoading(false));
  };

  const fetchCourses = () => {
    academicsApi.courses.list()
      .then(r => {
        const list = r.data.data ?? [];
        setCourses(list);
        if (list.length > 0) setCourseId(list[0].course_id);
      })
      .catch(err => console.warn('Request failed:', err));
  };

  useEffect(() => {
    fetchQuizzes();
    if (isFaculty || isAdmin) {
      fetchCourses();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setMessage('');
    if (!courseId || !title || !quizDate) { setError('Please fill all required fields'); return; }

    academicsApi.quizzes.create({
      course_id: courseId,
      title,
      description: description || null,
      total_marks: parseInt(totalMarks.toString()),
      quiz_date: quizDate,
    })
      .then(() => {
        setShowAddModal(false);
        setTitle(''); setDescription(''); setTotalMarks(10);
        setMessage('Quiz scheduled successfully!');
        fetchQuizzes();
      })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
        setError(e.response?.data?.errors?.[0]?.message || 'Failed to create quiz');
      });
  };

  return (
    <>
      <Header title="Quizzes" subtitle="Manage and view class quiz schedules" />
      <div className="page fade-in">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1>Quiz Schedules</h1>
            <p>{isStudent ? 'Your upcoming academic tests and quizzes' : 'Schedule quizzes and manage assessments'}</p>
          </div>
          {(isFaculty || isAdmin) && (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              + Schedule Quiz
            </button>
          )}
        </div>

        {message && <div className="card" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--accent-success)', padding: '1rem', marginBottom: '1.5rem', borderRadius: 8 }}>{message}</div>}

        {/* Add Quiz Modal */}
        {showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2>Schedule a Quiz</h2>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>✕</button>
              </div>
              {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Course *</label>
                  <select className="form-select" value={courseId} onChange={e => setCourseId(e.target.value)} required>
                    {courses.map(c => (
                      <option key={c.course_id} value={c.course_id}>
                        {c.course_code} - {c.course_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Quiz Title *</label>
                  <input className="form-input" placeholder="e.g. MCQ Test 1" value={title} onChange={e => setTitle(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Description / Instructions</label>
                  <textarea className="form-input" style={{ minHeight: 80, resize: 'vertical' }} placeholder="Topics covered, guidelines..." value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Total Marks *</label>
                    <input type="number" className="form-input" value={totalMarks} onChange={e => setTotalMarks(parseInt(e.target.value))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Schedule Date *</label>
                    <input type="date" className="form-input" value={quizDate} onChange={e => setQuizDate(e.target.value)} required />
                  </div>
                </div>
                <button className="btn btn-primary" type="submit" style={{ marginTop: '0.5rem' }}>Publish Quiz Schedule</button>
              </form>
            </div>
          </div>
        )}

        {/* Quizzes List */}
        <div className="card">
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading quizzes…</div>
          ) : quizzes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📝</div>
              <h3>No Quizzes Scheduled</h3>
              <p>{isStudent ? 'You have no upcoming quizzes scheduled.' : 'Schedule your first class quiz above.'}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Quiz Details</th>
                    <th>Course</th>
                    <th>Date</th>
                    <th>Marks</th>
                  </tr>
                </thead>
                <tbody>
                  {quizzes.map(q => (
                    <tr key={q.quiz_id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--accent-primary)', fontSize: '0.95rem' }}>{q.title}</div>
                        {q.description && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{q.description}</div>}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{q.course_code}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{q.course_name}</div>
                      </td>
                      <td>
                        <span className="badge badge-muted">{q.quiz_date}</span>
                      </td>
                      <td>
                        <strong style={{ fontSize: '0.95rem' }}>{q.total_marks} Marks</strong>
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
