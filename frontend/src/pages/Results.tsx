import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { api, examinationApi, studentsApi } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { generateSemesterGradeCardPDF, generateTranscriptPDF } from '../utils/pdfGenerator';

interface StudentItem {
  student_id: string;
  enrollment_number?: string;
  person: { first_name: string; last_name?: string; email?: string };
  category?: string;
  quota?: string;
  cgpa?: string;
}

interface ResultRecord {
  result_id: string;
  student_id: string;
  semester: number;
  academic_year: number;
  sgpa: string;
  cgpa: string;
  status: string;
  backlogs_count: number;
  published_date?: string;
}

interface StudentMark {
  marks_id: string;
  course_code: string;
  course_name: string;
  semester: number;
  exam_type: string;
  obtained_marks: string;
  max_marks: number;
  revaluation_status: string;
  revaluation_marks: string | null;
  credits?: string;
}

interface RevaluationRequestRow {
  revaluation_id: string;
  marks_id: string;
  student_id: string;
  student_name: string;
  course_code: string;
  course_name: string;
  request_date: string;
  reason: string | null;
  status: string;
  old_marks: string;
  new_marks: string | null;
}

export default function Results() {
  const { can, isStudent, user, isAdmin } = usePermissions();
  const [activeTab, setActiveTab] = useState<'results' | 'revaluations'>('results');
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [currentStudent, setCurrentStudent] = useState<any>(null);
  const [resultsList, setResultsList] = useState<ResultRecord[]>([]);
  const [studentMarks, setStudentMarks] = useState<StudentMark[]>([]);
  const [revaluations, setRevaluations] = useState<RevaluationRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Revaluation Request Dialog
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestMarksId, setRequestMarksId] = useState('');
  const [requestReason, setRequestReason] = useState('');

  // Revaluation Approval Dialog
  const [selectedReval, setSelectedReval] = useState<RevaluationRequestRow | null>(null);
  const [newObtainedMarks, setNewObtainedMarks] = useState('');

  // For students: find their own record automatically
  const findMyStudentId = async () => {
    try {
      const r = await studentsApi.list({ limit: 200 });
      const list: StudentItem[] = r.data.data ?? [];
      const me = list.find(s =>
        (s as any).person?.email?.toLowerCase().includes(user?.username?.toLowerCase() ?? '')
        || (s as any).person?.first_name?.toLowerCase() === user?.username?.toLowerCase()
      );
      if (me) {
        setCurrentStudent(me);
      }
      return me?.student_id ?? null;
    } catch { return null; }
  };

  const fetchResults = (studentId: string) => {
    if (!studentId) return;
    setLoading(true);
    setError('');
    Promise.all([
      examinationApi.results.get(studentId),
      examinationApi.marks.getStudentMarks(studentId)
    ])
      .then(([resR, marksR]) => {
        setResultsList(resR.data.data ?? []);
        setStudentMarks(marksR.data.data ?? []);
      })
      .catch(() => setError('Failed to fetch student results or marks.'))
      .finally(() => setLoading(false));
  };

  const fetchRevaluations = () => {
    if (!isAdmin) return;
    setLoading(true);
    examinationApi.revaluation.list()
      .then(res => setRevaluations(res.data.data ?? []))
      .catch(() => setError('Failed to fetch revaluation requests.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (activeTab === 'revaluations') {
      fetchRevaluations();
    } else {
      if (isStudent) {
        setLoading(true);
        findMyStudentId().then(id => {
          if (id) { setSelectedStudentId(id); fetchResults(id); }
          else setLoading(false);
        });
      } else if (can('results.viewAll')) {
        setLoading(true);
        studentsApi.list({ limit: 100 })
          .then(r => {
            const list = r.data.data ?? [];
            setStudents(list);
            if (list.length > 0) { 
              setSelectedStudentId(list[0].student_id); 
              setCurrentStudent(list[0]);
              fetchResults(list[0].student_id); 
            }
          })
          .catch(() => {})
          .finally(() => setLoading(false));
      }
    }
  }, [isStudent, activeTab]);

  useEffect(() => {
    if (selectedStudentId && !isStudent && activeTab === 'results') {
      const found = students.find(s => s.student_id === selectedStudentId);
      if (found) {
        setCurrentStudent(found);
      }
      fetchResults(selectedStudentId);
    }
  }, [selectedStudentId, activeTab, students]);

  const handleProcess = () => {
    if (!can('results.compile') || !selectedStudentId) return;
    setError(''); setMessage(''); setProcessing(true);
    examinationApi.results.process({ student_id: selectedStudentId, semester: 1, academic_year: 2026 })
      .then(() => { setMessage('SGPA and CGPA compiled successfully!'); fetchResults(selectedStudentId); })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
        setError(e.response?.data?.errors?.[0]?.message || 'Failed to process results (ensure marks are entered first)');
      })
      .finally(() => setProcessing(false));
  };

  const handlePublish = (resultId: string) => {
    if (!can('results.publish')) return;
    setError(''); setMessage('');
    api.patch(`/results/${resultId}/publish`, {})
      .then(() => { setMessage('Results published successfully!'); fetchResults(selectedStudentId); })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
        setError(e.response?.data?.errors?.[0]?.message || 'Failed to publish results');
      });
  };

  const handleOpenRequestModal = (marksId: string) => {
    setRequestMarksId(marksId);
    setRequestReason('');
    setShowRequestModal(true);
  };

  const handleRequestRevalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setMessage('');
    examinationApi.revaluation.request({ marks_id: requestMarksId, reason: requestReason || null })
      .then(() => {
        setMessage('Revaluation requested successfully!');
        setShowRequestModal(false);
        if (selectedStudentId) fetchResults(selectedStudentId);
      })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
        setError(e.response?.data?.errors?.[0]?.message || 'Failed to request revaluation');
      });
  };

  const handleApproveReval = (reval: RevaluationRequestRow) => {
    setSelectedReval(reval);
    setNewObtainedMarks(reval.old_marks);
  };

  const handleApproveRevalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReval) return;
    setError(''); setMessage('');
    examinationApi.revaluation.approve(selectedReval.revaluation_id, {
      status: 'Approved',
      new_marks: parseFloat(newObtainedMarks)
    })
      .then(() => {
        setMessage('Revaluation request approved and marks updated!');
        setSelectedReval(null);
        fetchRevaluations();
      })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
        setError(e.response?.data?.errors?.[0]?.message || 'Failed to approve revaluation');
      });
  };

  const handleRejectReval = (id: string) => {
    if (!window.confirm('Are you sure you want to reject this revaluation request?')) return;
    setError(''); setMessage('');
    examinationApi.revaluation.approve(id, {
      status: 'Rejected',
      new_marks: null
    })
      .then(() => {
        setMessage('Revaluation request rejected successfully.');
        fetchRevaluations();
      })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
        setError(e.response?.data?.errors?.[0]?.message || 'Failed to reject revaluation');
      });
  };

  // Block Faculty and FeeManager entirely
  if (!can('results.viewAll') && !can('results.viewOwn')) {
    return (
      <>
        <Header title="Results" subtitle="Access denied" />
        <div className="page fade-in">
          <div className="empty-state">
            <div className="empty-state-icon">🔒</div>
            <h3>Access Denied</h3>
            <p>You do not have permission to access the Results module.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Results" subtitle={isStudent ? 'My Academic Transcript' : 'Results Compilation & Publishing'} />
      <div className="page fade-in">
        {/* Tab system for Administrators */}
        {isAdmin && (
          <div className="tab-container" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
            <button
              onClick={() => setActiveTab('results')}
              style={{
                background: 'none', border: 'none', padding: '0.75rem 1rem', cursor: 'pointer',
                fontWeight: 600, color: activeTab === 'results' ? 'var(--accent-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'results' ? '2px solid var(--accent-primary)' : 'none'
              }}
            >
              🏆 Semester Results
            </button>
            <button
              onClick={() => setActiveTab('revaluations')}
              style={{
                background: 'none', border: 'none', padding: '0.75rem 1rem', cursor: 'pointer',
                fontWeight: 600, color: activeTab === 'revaluations' ? 'var(--accent-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'revaluations' ? '2px solid var(--accent-primary)' : 'none'
              }}
            >
              🔄 Revaluation Requests
            </button>
          </div>
        )}

        {message && <div className="card" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--accent-success)', padding: '1rem', marginBottom: '1.5rem', borderRadius: 8 }}>{message}</div>}
        {error && <div className="login-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        {activeTab === 'results' ? (
          <>
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 0 }}>
              <div>
                <h1>{isStudent ? 'Academic Transcript' : 'Transcripts & GPA'}</h1>
                <p>{isStudent ? 'View your compiled SGPA and CGPA results' : 'Compile results and publish semester-wise grades'}</p>
              </div>

              {isStudent && currentStudent && resultsList.length > 0 && (
                <button
                  className="btn btn-primary"
                  onClick={() => generateTranscriptPDF(currentStudent, studentMarks, resultsList)}
                >
                  🎓 Download Transcript
                </button>
              )}

              {!isStudent && can('results.viewAll') && (
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <select className="form-select" style={{ minWidth: 220 }} value={selectedStudentId}
                    onChange={e => setSelectedStudentId(e.target.value)}>
                    <option value="">-- Select Student --</option>
                    {students.map(s => (
                      <option key={s.student_id} value={s.student_id}>
                        {s.person.first_name} {s.person.last_name ?? ''} ({s.enrollment_number ?? 'No ID'})
                      </option>
                    ))}
                  </select>
                  {currentStudent && resultsList.length > 0 && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => generateTranscriptPDF(currentStudent, studentMarks, resultsList)}
                    >
                      🎓 Transcript PDF
                    </button>
                  )}
                  {can('results.compile') && selectedStudentId && (
                    <button className="btn btn-primary" onClick={handleProcess} disabled={processing}>
                      {processing ? 'Compiling…' : '⚙️ Compile SGPA/CGPA'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Overall results */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Overall Semester Standings</h3>
              {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading overall results…</div>
              ) : resultsList.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🏆</div>
                  <h3>No results compiled yet</h3>
                  <p>{isStudent ? 'Your results will appear here once published by the registrar.' : 'Enter exam marks first, then compile to generate CGPA.'}</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Semester</th><th>Academic Year</th><th>SGPA</th><th>CGPA</th>
                        <th>Result Status</th><th>Backlogs</th><th>Release Date</th>
                        {can('results.publish') && <th>Actions</th>}
                        <th>Grade Sheet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultsList.map(r => (
                        <tr key={r.result_id}>
                          <td style={{ fontWeight: 600 }}>Semester {r.semester}</td>
                          <td>{r.academic_year}</td>
                          <td><span className="badge badge-info">{r.sgpa}</span></td>
                          <td><span className="badge badge-success" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>{r.cgpa}</span></td>
                          <td><span className={`badge ${r.status === 'Pass' ? 'badge-success' : 'badge-danger'}`}>{r.status}</span></td>
                          <td><span style={r.backlogs_count > 0 ? { color: 'var(--accent-danger)', fontWeight: 600 } : {}}>{r.backlogs_count}</span></td>
                          <td>{r.published_date ? r.published_date.slice(0, 10) : <span style={{ color: 'var(--text-muted)' }}>Withheld</span>}</td>
                          {can('results.publish') && (
                            <td>
                              {!r.published_date ? (
                                <button className="btn btn-primary btn-sm" onClick={() => handlePublish(r.result_id)}>Publish</button>
                              ) : (
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Released ✓</span>
                              )}
                            </td>
                          )}
                          <td>
                            {currentStudent && (
                              <button 
                                className="btn btn-secondary btn-sm"
                                onClick={() => generateSemesterGradeCardPDF(currentStudent, r.semester, studentMarks, r)}
                              >
                                📄 Grade Card
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Course-wise marks */}
            {selectedStudentId && (
              <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>Course-wise Examination Performance</h3>
                {loading ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading course-wise marks…</div>
                ) : studentMarks.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No raw course marks logged for this student.</div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Semester</th><th>Course Code</th><th>Course Name</th><th>Exam Type</th>
                          <th>Scored Marks</th><th>Max Marks</th><th>Reval Status</th><th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentMarks.map(m => (
                          <tr key={m.marks_id}>
                            <td>Sem {m.semester}</td>
                            <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{m.course_code}</td>
                            <td>{m.course_name}</td>
                            <td>{m.exam_type}</td>
                            <td style={{ fontWeight: 600 }}>
                              {m.revaluation_status === 'Approved' ? (
                                <span>
                                  <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', marginRight: '0.5rem' }}>{m.obtained_marks}</span>
                                  <span style={{ color: 'var(--accent-success)' }}>{m.revaluation_marks}</span>
                                </span>
                              ) : m.obtained_marks}
                            </td>
                            <td>{m.max_marks}</td>
                            <td>
                              {m.revaluation_status === 'None' ? (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              ) : (
                                <span className={`badge ${m.revaluation_status === 'Approved' ? 'badge-success' : m.revaluation_status === 'Requested' ? 'badge-warning' : 'badge-danger'}`}>
                                  {m.revaluation_status}
                                </span>
                              )}
                            </td>
                            <td>
                              {isStudent && m.revaluation_status === 'None' && (
                                <button className="btn btn-secondary btn-sm" onClick={() => handleOpenRequestModal(m.marks_id)}>
                                  Request Reval
                                </button>
                              )}
                              {!isStudent && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Staff Only</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* Revaluations Tab for Admin */
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Pending Revaluation Requests</h3>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading revaluation requests…</div>
            ) : revaluations.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No revaluation requests submitted.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th><th>Student Name</th><th>Course</th><th>Old Marks</th>
                      <th>Reason</th><th>Status</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revaluations.map(rev => (
                      <tr key={rev.revaluation_id}>
                        <td>{rev.request_date}</td>
                        <td style={{ fontWeight: 600 }}>{rev.student_name}</td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{rev.course_code}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rev.course_name}</div>
                        </td>
                        <td>{rev.old_marks}</td>
                        <td><span style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>{rev.reason ?? 'No reason given'}</span></td>
                        <td>
                          <span className={`badge ${rev.status === 'Completed' || rev.status === 'Approved' ? 'badge-success' : rev.status === 'Pending' ? 'badge-warning' : 'badge-danger'}`}>
                            {rev.status}
                          </span>
                        </td>
                        <td>
                          {rev.status === 'Pending' ? (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button className="btn btn-primary btn-sm" onClick={() => handleApproveReval(rev)}>Approve</button>
                              <button className="btn btn-secondary btn-sm" style={{ borderColor: 'var(--accent-danger)', color: 'var(--accent-danger)' }} onClick={() => handleRejectReval(rev.revaluation_id)}>Reject</button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              Resolved {rev.new_marks ? `➔ ${rev.new_marks}` : '✓'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Student: request revaluation modal */}
        {showRequestModal && (
          <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="card" style={{ maxWidth: 450, width: '90%', border: '1px solid var(--accent-primary)' }}>
              <div className="card-header">
                <h3>Request Marks Revaluation</h3>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowRequestModal(false)}>✕</button>
              </div>
              <form onSubmit={handleRequestRevalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Justification / Reason *</label>
                  <textarea
                    className="form-input"
                    rows={4}
                    placeholder="Provide a reason or detailing your calculation concerns for this exam paper..."
                    value={requestReason}
                    onChange={e => setRequestReason(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowRequestModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Submit Request</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Admin: Approve Revaluation Modal (Entering New Marks) */}
        {selectedReval && (
          <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="card" style={{ maxWidth: 400, width: '90%', border: '1px solid var(--accent-success)' }}>
              <div className="card-header">
                <h3>Approve Revaluation</h3>
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedReval(null)}>✕</button>
              </div>
              <form onSubmit={handleApproveRevalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Student Name: <strong style={{ color: 'var(--text-main)' }}>{selectedReval.student_name}</strong></div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Course: <strong style={{ color: 'var(--text-main)' }}>{selectedReval.course_code} — {selectedReval.course_name}</strong></div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Original Scored Marks: <strong style={{ color: 'var(--text-main)' }}>{selectedReval.old_marks}</strong></div>
                </div>
                <div className="form-group">
                  <label className="form-label">New Scored Marks *</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className="form-input"
                    value={newObtainedMarks}
                    onChange={e => setNewObtainedMarks(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setSelectedReval(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Approve & Update Marks</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
