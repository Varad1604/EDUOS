import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { examinationApi, academicsApi, studentsApi } from '../api';
import { usePermissions } from '../hooks/usePermissions';

interface Exam {
  exam_id: string;
  exam_code?: string;
  exam_type: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  exam_mode: string;
  max_marks: number;
  min_marks: number;
  hall_tickets_generated: boolean;
  course_code: string;
  course_name: string;
  semester: number;
  section: string;
}

interface CourseItem { course_id: string; course_code: string; course_name: string; }
interface ClassItem { class_id: string; semester: number; section: string; branch_id?: string; }
interface Student { student_id: string; enrollment_number?: string; person: { first_name: string; last_name?: string }; }

export default function Exams() {
  const { can, isStudent } = usePermissions();
  const [exams, setExams] = useState<Exam[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [marksState, setMarksState] = useState<Record<string, number>>({});
  const [marksLoading, setMarksLoading] = useState(false);
  const [examCode, setExamCode] = useState('');
  const [courseId, setCourseId] = useState('');
  const [classId, setClassId] = useState('');
  const [examType, setExamType] = useState('Internal');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('10:00');
  const [duration, setDuration] = useState(180);
  const [maxMarks, setMaxMarks] = useState(100);
  const [minMarks, setMinMarks] = useState(35);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const fetchExams = () => {
    setLoading(true);
    examinationApi.exams.list().then(r => setExams(r.data.data ?? [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchExams();
    if (can('exams.schedule')) {
      academicsApi.courses.list().then(r => setCourses(r.data.data ?? [])).catch(() => {});
      academicsApi.classes.list().then(r => setClasses(r.data.data ?? [])).catch(() => {});
    }
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('exams.schedule')) return;
    setError(''); setMessage('');
    if (!courseId || !classId || !scheduledDate) { setError('Please fill in all required fields'); return; }
    examinationApi.exams.create({
      exam_code: examCode || null, course_id: courseId, class_id: classId, exam_type: examType,
      scheduled_date: scheduledDate, scheduled_time: scheduledTime + ':00',
      duration_minutes: duration, exam_mode: 'Written', max_marks: maxMarks, min_marks: minMarks,
    })
      .then(() => { setShowAddModal(false); setExamCode(''); setMessage('Exam scheduled successfully!'); fetchExams(); })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
        setError(e.response?.data?.errors?.[0]?.message || 'Failed to schedule exam');
      });
  };

  const handleOpenMarksEntry = (exam: Exam) => {
    if (!can('exams.enterMarks')) return;
    setSelectedExam(exam); setMarksLoading(true); setError(''); setMessage('');
    const cls = classes.find(c => c.semester === exam.semester && c.section === exam.section);
    studentsApi.list({ semester: exam.semester, branch_id: cls?.branch_id || undefined, limit: 100 })
      .then(r => {
        const list = r.data.data ?? [];
        setStudents(list);
        const init: Record<string, number> = {};
        list.forEach((s: Student) => { init[s.student_id] = 0; });
        setMarksState(init);
      })
      .catch(() => setError('Failed to load students'))
      .finally(() => setMarksLoading(false));
  };

  const handleMarksSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExam || !can('exams.enterMarks')) return;
    setError(''); setMessage('');
    const targetCourse = courses.find(c => c.course_code === selectedExam.course_code);
    examinationApi.marks.enterBulk({
      exam_id: selectedExam.exam_id,
      course_id: targetCourse?.course_id || courses[0]?.course_id,
      entries: Object.keys(marksState).map(sid => ({ student_id: sid, obtained_marks: parseFloat(marksState[sid].toString()) })),
    })
      .then(() => { setMessage('Marks submitted successfully!'); setSelectedExam(null); })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
        setError(e.response?.data?.errors?.[0]?.message || 'Failed to submit marks');
      });
  };

  return (
    <>
      <Header title="Exams" subtitle={isStudent ? 'Your upcoming examinations' : 'Examination scheduling and marks entry'} />
      <div className="page fade-in">
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1>Examinations</h1>
            <p>{isStudent ? 'View your scheduled exams and exam results' : 'Schedule exams and manage student marks'}</p>
          </div>
          {can('exams.schedule') && (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Schedule Exam</button>
          )}
        </div>

        {/* Student read-only notice */}
        {isStudent && (
          <div style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span>ℹ️</span> You can view scheduled exams. Marks entry is performed by faculty members.
          </div>
        )}

        {message && <div className="card" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--accent-success)', padding: '1rem', marginBottom: '1.5rem', borderRadius: 8 }}>{message}</div>}
        {error && <div className="login-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        {/* Schedule exam modal — Faculty, Principal, Registrar only */}
        {can('exams.schedule') && showAddModal && (
          <div className="card" style={{ marginBottom: '1.5rem', maxWidth: 600, border: '1px solid var(--accent-primary)' }}>
            <div className="card-header">
              <h3>Schedule New Exam</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Course *</label>
                  <select className="form-select" value={courseId} onChange={e => setCourseId(e.target.value)}>
                    <option value="">-- Choose Course --</option>
                    {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.course_code} — {c.course_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Class *</label>
                  <select className="form-select" value={classId} onChange={e => setClassId(e.target.value)}>
                    <option value="">-- Choose Class --</option>
                    {classes.map(c => <option key={c.class_id} value={c.class_id}>Sem {c.semester} — Sec {c.section}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Exam Code</label>
                  <input className="form-input" placeholder="e.g. CS101_MID" value={examCode} onChange={e => setExamCode(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Exam Type *</label>
                  <select className="form-select" value={examType} onChange={e => setExamType(e.target.value)}>
                    <option value="Internal">Internal (Midterm)</option>
                    <option value="External">External (Final)</option>
                    <option value="Quiz">Quiz</option>
                    <option value="Practical">Practical</option>
                  </select>
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-input" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Time *</label>
                  <input type="time" className="form-input" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
                </div>
              </div>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Duration (min)</label>
                  <input type="number" className="form-input" value={duration} onChange={e => setDuration(parseInt(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Marks</label>
                  <input type="number" className="form-input" value={maxMarks} onChange={e => setMaxMarks(parseInt(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Passing Marks</label>
                  <input type="number" className="form-input" value={minMarks} onChange={e => setMinMarks(parseInt(e.target.value))} />
                </div>
              </div>
              <button className="btn btn-primary" type="submit">Publish Exam Schedule</button>
            </form>
          </div>
        )}

        {/* Marks entry panel — Faculty only */}
        {can('exams.enterMarks') && selectedExam && (
          <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid var(--accent-success)' }}>
            <div className="card-header">
              <div>
                <h3>Enter Marks: {selectedExam.course_name} ({selectedExam.exam_type})</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sem {selectedExam.semester} — Sec {selectedExam.section} | Max: {selectedExam.max_marks}</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedExam(null)}>✕ Cancel</button>
            </div>
            {marksLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>Loading students…</div>
            ) : (
              <form onSubmit={handleMarksSubmit}>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Student</th><th>Enrollment No.</th><th>Marks (max {selectedExam.max_marks})</th></tr></thead>
                    <tbody>
                      {students.map(s => (
                        <tr key={s.student_id}>
                          <td>{s.person.first_name} {s.person.last_name ?? ''}</td>
                          <td>{s.enrollment_number ?? '—'}</td>
                          <td>
                            <input type="number" step="0.01" min={0} max={selectedExam.max_marks} className="form-input"
                              style={{ maxWidth: 120 }} value={marksState[s.student_id] ?? 0}
                              onChange={e => setMarksState(prev => ({ ...prev, [s.student_id]: parseFloat(e.target.value) }))} required />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" type="submit">Submit Scores</button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Exam list */}
        <div className="card">
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading exams…</div>
          ) : exams.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📝</div>
              <h3>No exams scheduled</h3>
              <p>{isStudent ? 'No exams have been announced yet.' : 'Schedule an exam to begin processing marks.'}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Exam Code</th><th>Course</th><th>Class</th><th>Date / Time</th>
                    <th>Duration</th><th>Max / Min Marks</th><th>Hall Tickets</th>
                    {can('exams.enterMarks') && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {exams.map(e => (
                    <tr key={e.exam_id}>
                      <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{e.exam_code ?? '—'}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{e.course_code}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{e.course_name}</div>
                      </td>
                      <td>Sem {e.semester} — Sec {e.section}</td>
                      <td>
                        <div>{e.scheduled_date}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{e.scheduled_time?.slice(0, 5)}</div>
                      </td>
                      <td>{e.duration_minutes} min</td>
                      <td>{e.max_marks} / {e.min_marks}</td>
                      <td>
                        <span className={`badge ${e.hall_tickets_generated ? 'badge-success' : 'badge-warning'}`}>
                          {e.hall_tickets_generated ? 'Generated' : 'Pending'}
                        </span>
                      </td>
                      {can('exams.enterMarks') && (
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleOpenMarksEntry(e)}>Enter Marks</button>
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
