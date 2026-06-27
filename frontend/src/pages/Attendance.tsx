import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { academicsApi, studentsApi } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { generateAttendanceWarningPDF } from '../utils/pdfGenerator';

interface ClassItem { class_id: string; semester: number; section: string; branch_id?: string; academic_year: number; }
interface CourseItem { course_id: string; course_code: string; course_name: string; }
interface Student { student_id: string; enrollment_number?: string; person: { first_name: string; last_name?: string }; }
interface StudentWithSummary extends Student {
  total_classes: number; present_count: number; percentage: number; is_eligible: boolean;
}

// ─── Student view: own attendance summary only ───────────────────────────────
function MyAttendance() {
  const { user } = usePermissions();
  const [summaries, setSummaries] = useState<{ course: CourseItem; total: number; present: number; pct: number; eligible: boolean }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    academicsApi.courses.list()
      .then(async r => {
        const courseList: CourseItem[] = r.data.data ?? [];
        // Find own student record
        const sRes = await studentsApi.list({ limit: 200 });
        const students = sRes.data.data ?? [];
        const me = students.find((s: any) =>
          s.person?.email?.toLowerCase().includes(user?.username?.toLowerCase() ?? '')
          || s.person?.first_name?.toLowerCase() === user?.username?.toLowerCase()
        );
        if (!me) { setLoading(false); return; }

        // Fetch summary for each course
        const result = [];
        for (const c of courseList) {
          try {
            const res = await academicsApi.attendance.summary(me.student_id, c.course_id);
            const d = res.data.data;
            result.push({ course: c, total: d?.total_classes ?? 0, present: d?.present_count ?? 0, pct: d?.percentage ?? 100, eligible: d?.is_eligible ?? true });
          } catch {
            result.push({ course: c, total: 0, present: 0, pct: 100, eligible: true });
          }
        }
        setSummaries(result);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.username]);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading your attendance…</div>;

  const hasAttendanceShortage = summaries.some(s => s.total > 0 && !s.eligible);

  return (
    <>
      {hasAttendanceShortage && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '1.25rem 1.5rem',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: 12,
          marginBottom: '1.5rem',
          boxShadow: '0 4px 20px rgba(239, 68, 68, 0.08)',
          animation: 'fadeIn 0.4s ease both',
        }}>
          <span style={{ fontSize: '1.75rem' }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: 0, color: 'var(--accent-danger)', fontWeight: 700, fontSize: '1.05rem', letterSpacing: '0.025em' }}>
              Academic Compliance Warning: Exam Detainment
            </h4>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.4' }}>
              You are <strong style={{ color: 'var(--accent-danger)' }}>Ineligible for Exams due to Shortage of Attendance</strong> (below 75% threshold) in the following courses:{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {summaries
                  .filter(s => s.total > 0 && !s.eligible)
                  .map(s => `${s.course.course_code} (${s.pct.toFixed(1)}%)`)
                  .join(', ')}
              </strong>. Please contact the respective faculty immediately.
            </p>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <span>ℹ️</span> Minimum 75% attendance is required for exam eligibility. Contact faculty for any corrections.
      </div>
      <div className="card">
        {summaries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <h3>No attendance records</h3>
            <p>Attendance will appear here once faculty marks it.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Course</th><th>Course Name</th><th>Classes Attended</th><th>Total Classes</th><th>Attendance %</th><th>Eligibility</th></tr>
              </thead>
              <tbody>
                {summaries.map(({ course, total, present, pct, eligible }) => (
                  <tr key={course.course_id}>
                    <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{course.course_code}</td>
                    <td>{course.course_name}</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent-success)' }}>{present}</td>
                    <td>{total}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--surface-3)', borderRadius: 3, maxWidth: 80 }}>
                          <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: pct >= 75 ? 'var(--accent-success)' : 'var(--accent-danger)', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontWeight: 600, color: pct >= 75 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>{pct.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${eligible ? 'badge-success' : 'badge-danger'}`}>{eligible ? '✓ Eligible' : '✗ Detained'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Faculty / Admin view: mark attendance ────────────────────────────────────
function MarkAttendance() {
  const { can } = usePermissions();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [students, setStudents] = useState<StudentWithSummary[]>([]);
  const [attendanceStates, setAttendanceStates] = useState<Record<string, string>>({});
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    academicsApi.classes.list().then(r => {
      const list = r.data.data ?? [];
      setClasses(list);
      if (list.length > 0) setSelectedClassId(list[0].class_id);
    }).catch(() => {});
    academicsApi.courses.list().then(r => {
      const list = r.data.data ?? [];
      setCourses(list);
      if (list.length > 0) setSelectedCourseId(list[0].course_id);
    }).catch(() => {});
  }, []);

  const fetchStudents = async () => {
    if (!selectedClassId || !selectedCourseId) return;
    setLoading(true); setError(''); setMessage('');
    try {
      const cls = classes.find(c => c.class_id === selectedClassId);
      const sRes = await studentsApi.list({ semester: cls?.semester, branch_id: cls?.branch_id, limit: 100 });
      const sList: Student[] = sRes.data.data ?? [];
      const updated: StudentWithSummary[] = [];
      const states: Record<string, string> = {};
      for (const s of sList) {
        states[s.student_id] = 'Present';
        try {
          const sum = await academicsApi.attendance.summary(s.student_id, selectedCourseId);
          const d = sum.data.data;
          updated.push({ ...s, total_classes: d?.total_classes ?? 0, present_count: d?.present_count ?? 0, percentage: d?.percentage ?? 100, is_eligible: d?.is_eligible ?? true });
        } catch {
          updated.push({ ...s, total_classes: 0, present_count: 0, percentage: 100, is_eligible: true });
        }
      }
      setStudents(updated); setAttendanceStates(states);
    } catch { setError('Failed to load students'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (selectedClassId && selectedCourseId) fetchStudents(); }, [selectedClassId, selectedCourseId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('attendance.mark')) return;
    setError(''); setMessage('');
    academicsApi.attendance.markBulk({
      course_id: selectedCourseId, class_id: selectedClassId, date,
      records: Object.keys(attendanceStates).map(sid => ({ student_id: sid, status: attendanceStates[sid] })),
    })
      .then(() => { setMessage('Attendance submitted successfully!'); fetchStudents(); })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
        setError(e.response?.data?.errors?.[0]?.message || 'Failed to submit attendance');
      });
  };

  // Statistics Calculations
  const totalEnrolled = students.length;
  const under75Count = students.filter(s => !s.is_eligible).length;
  const over75Count = totalEnrolled - under75Count;
  const avgPercentage = totalEnrolled > 0
    ? students.reduce((acc, curr) => acc + curr.percentage, 0) / totalEnrolled
    : 100;

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setMessage('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        const lines = text.split(/\r?\n/);
        const importedStates: Record<string, string> = { ...attendanceStates };
        let matchedCount = 0;
        let unmatchedList: string[] = [];

        // Skip header if first line contains 'enrollment' or 'status'
        const startIdx = (lines[0].toLowerCase().includes('enrollment') || lines[0].toLowerCase().includes('status')) ? 1 : 0;

        for (let i = startIdx; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const parts = line.split(',');
          if (parts.length < 2) continue;

          const rollNo = parts[0].trim();
          const status = parts[1].trim();

          const matchedStudent = students.find(s => s.enrollment_number?.toLowerCase() === rollNo.toLowerCase());
          if (matchedStudent) {
            const formattedStatus = status.toLowerCase() === 'present' ? 'Present' : status.toLowerCase() === 'absent' ? 'Absent' : 'Leave';
            importedStates[matchedStudent.student_id] = formattedStatus;
            matchedCount++;
          } else {
            unmatchedList.push(rollNo);
          }
        }

        setAttendanceStates(importedStates);
        let successMsg = `Successfully parsed biometric data: matched ${matchedCount} student(s) from file.`;
        if (unmatchedList.length > 0) {
          successMsg += ` (Unmatched roll numbers: ${unmatchedList.join(', ')})`;
        }
        setMessage(successMsg);
      } catch {
        setError('Failed to parse biometric CSV. Please ensure formatting is standard CSV.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select className="form-select" style={{ minWidth: 180 }} value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
          {classes.map(c => <option key={c.class_id} value={c.class_id}>Sem {c.semester} – Sec {c.section} ({c.academic_year})</option>)}
        </select>
        <select className="form-select" style={{ minWidth: 240 }} value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)}>
          {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.course_code} – {c.course_name}</option>)}
        </select>
        <input type="date" className="form-input" style={{ maxWidth: 160 }} value={date} onChange={e => setDate(e.target.value)} />
      </div>

      {/* Class Statistics Row */}
      {totalEnrolled > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div className="card" style={{ padding: '0.75rem 1rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL ENROLLED</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{totalEnrolled}</span>
          </div>
          <div className="card" style={{ padding: '0.75rem 1rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{"ATTENDANCE COMPLIANT (>= 75%)"}</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--accent-success)' }}>{over75Count}</span>
          </div>
          <div className="card" style={{ padding: '0.75rem 1rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{"AT DETENTION RISK (< 75%)"}</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--accent-danger)' }}>{under75Count}</span>
          </div>
          <div className="card" style={{ padding: '0.75rem 1rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>CLASS AVERAGE ATTENDANCE</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{avgPercentage.toFixed(1)}%</span>
          </div>
        </div>
      )}

      {/* Biometric CSV Import Panel */}
      {can('attendance.mark') && totalEnrolled > 0 && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', background: 'var(--card-bg-secondary)', border: '1px dashed var(--border-color)' }}>
          <div style={{ flex: 1, minWidth: '250px' }}>
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold' }}>📂 Bulk Import RFID / Biometric Logs</h4>
            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>CSV format: <code>EnrollmentNumber,Status</code> (Status: Present, Absent, or Leave)</p>
          </div>
          <div>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleCSVImport} 
              style={{ fontSize: '0.8rem', padding: '4px', background: 'var(--surface-3)', borderRadius: '4px' }} 
            />
          </div>
        </div>
      )}

      {message && <div className="card" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--accent-success)', padding: '1rem', marginBottom: '1.5rem', borderRadius: 8 }}>{message}</div>}
      {error && <div className="login-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

      <div className="card">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading students…</div>
        ) : students.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">✅</div><h3>No students in this class</h3></div>
        ) : (
          <>
            {can('attendance.mark') && (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => { const s = { ...attendanceStates }; students.forEach(st => { s[st.student_id] = 'Present'; }); setAttendanceStates(s); }}>✓ All Present</button>
                <button className="btn btn-secondary btn-sm" onClick={() => { const s = { ...attendanceStates }; students.forEach(st => { s[st.student_id] = 'Absent'; }); setAttendanceStates(s); }}>✗ All Absent</button>
              </div>
            )}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th><th>Enroll No.</th><th>Attended / Total</th><th>%</th>
                    {can('attendance.mark') && <th>Today's Status</th>}
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => (
                    <tr key={s.student_id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600 }}>{s.person.first_name[0]}</div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{s.person.first_name} {s.person.last_name ?? ''}</div>
                          </div>
                        </div>
                      </td>
                      <td>{s.enrollment_number ?? '—'}</td>
                      <td>{s.present_count} / {s.total_classes}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span className={`badge ${s.is_eligible ? 'badge-success' : 'badge-danger'}`}>{s.percentage.toFixed(1)}%</span>
                          {!s.is_eligible && <span style={{ fontSize: '0.72rem', color: 'var(--accent-danger)', marginLeft: '0.4rem' }}>⚠️ Under 75%</span>}
                          {!s.is_eligible && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{
                                marginLeft: '0.75rem',
                                padding: '2px 6px',
                                fontSize: '0.7rem',
                                borderColor: 'var(--accent-danger)',
                                color: 'var(--accent-danger)',
                                background: 'transparent'
                              }}
                              onClick={() => {
                                const courseObj = courses.find(c => c.course_id === selectedCourseId);
                                if (courseObj) {
                                  generateAttendanceWarningPDF(s, courseObj, {
                                    total_classes: s.total_classes,
                                    present_count: s.present_count,
                                    percentage: s.percentage
                                  });
                                }
                              }}
                            >
                              ⚠️ Warning Letter
                            </button>
                          )}
                        </div>
                      </td>
                      {can('attendance.mark') && (
                        <td>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            {['Present', 'Absent', 'Leave'].map(status => (
                              <button key={status} type="button"
                                className={`btn btn-sm ${attendanceStates[s.student_id] === status ? (status === 'Present' ? 'btn-primary' : status === 'Absent' ? 'btn-danger' : 'btn-warning') : 'btn-secondary'}`}
                                style={attendanceStates[s.student_id] === status && status === 'Absent' ? { background: 'var(--accent-danger)', color: 'white' } : attendanceStates[s.student_id] === status && status === 'Leave' ? { background: 'var(--accent-warning)', color: 'white' } : {}}
                                onClick={() => setAttendanceStates(prev => ({ ...prev, [s.student_id]: status }))}>
                                {status}
                              </button>
                            ))}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {can('attendance.mark') && (
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={handleSubmit}>Submit Attendance</button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ─── Page router ──────────────────────────────────────────────────────────────
export default function Attendance() {
  const { can, isStudent } = usePermissions();

  if (!can('attendance.mark') && !can('attendance.viewAll') && !can('attendance.viewOwn')) {
    return (
      <>
        <Header title="Attendance" subtitle="Access denied" />
        <div className="page fade-in">
          <div className="empty-state">
            <div className="empty-state-icon">🔒</div>
            <h3>Access Denied</h3>
            <p>You do not have permission to access the Attendance module.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Attendance" subtitle={isStudent ? 'My attendance summary' : 'Mark and monitor attendance'} />
      <div className="page fade-in">
        <div className="page-header">
          <h1>{isStudent ? 'My Attendance Record' : 'Attendance Registry'}</h1>
          <p>{isStudent ? 'Course-wise attendance and 75% eligibility status' : 'Mark daily attendance and monitor eligibility thresholds'}</p>
        </div>
        {isStudent ? <MyAttendance /> : <MarkAttendance />}
      </div>
    </>
  );
}
