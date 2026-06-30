import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { api, examinationApi, studentsApi } from '../api';
import { usePermissions } from '../hooks/usePermissions';

interface Exam {
  exam_id: string; exam_code?: string; exam_type: string;
  course_code: string; course_name: string;
  scheduled_date: string; scheduled_time: string;
  hall_tickets_generated: boolean;
}
interface HallTicket {
  hall_ticket_id: string; exam_id: string; student_id: string;
  hall_no: string; seat_no: string; qr_code: string; student_name?: string;
}

// ─── Student: view own hall ticket ────────────────────────────────────────────
function MyHallTicket() {
  const { user } = usePermissions();
  const [ticket, setTicket] = useState<HallTicket | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, eRes] = await Promise.all([
          studentsApi.list({ limit: 200 }),
          examinationApi.exams.list(),
        ]);
        const students = sRes.data.data ?? [];
        const me = students.find((s: any) =>
          s.person?.email?.toLowerCase().includes(user?.username?.toLowerCase() ?? '')
          || s.person?.first_name?.toLowerCase() === user?.username?.toLowerCase()
        );
        if (!me) { setLoading(false); return; }

        const exams: Exam[] = eRes.data.data ?? [];
        const generated = exams.filter(e => e.hall_tickets_generated);
        if (generated.length === 0) { setLoading(false); return; }

        const targetExam = generated[0];
        setExam(targetExam);

        const tRes = await api.get(`/exams/${targetExam.exam_id}/hall-tickets`);
        const allTickets: HallTicket[] = tRes.data.data ?? [];
        const myTicket = allTickets.find(t => t.student_id === me.student_id);
        if (myTicket) {
          setTicket({ ...myTicket, student_name: `${me.person.first_name} ${me.person.last_name ?? ''}` });
        }
      } catch {
        setError('Failed to load your hall ticket.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.username]);

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading your hall ticket…</div>;
  if (error) return <div className="login-error">{error}</div>;
  if (!ticket || !exam) return (
    <div className="empty-state">
      <div className="empty-state-icon">🎫</div>
      <h3>Hall ticket not yet generated</h3>
      <p>Your department will issue your admit card once the examination schedule is confirmed.</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
      <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={() => window.print()}>🖨️ Print Hall Ticket</button>
      <div className="card" id="printable-ticket" style={{ width: '100%', maxWidth: 580, background: 'var(--bg-secondary)', border: '2px solid var(--border)', padding: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px dashed var(--border)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ color: 'var(--accent-primary)', marginBottom: '0.25rem' }}>EduOS Engineering College</h2>
            <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Official Examination Admit Card</p>
          </div>
          <div style={{ fontSize: '2.5rem' }}>🎓</div>
        </div>
        <div style={{ display: 'flex', gap: '2rem' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { label: 'Student Name', value: ticket.student_name },
              { label: 'Exam Code', value: exam.exam_code ?? '—' },
              { label: 'Subject', value: `${exam.course_code} — ${exam.course_name}` },
              { label: 'Exam Type', value: exam.exam_type },
              { label: 'Date & Time', value: `${exam.scheduled_date} @ ${exam.scheduled_time?.slice(0, 5)}` },
              { label: 'Seat No.', value: ticket.seat_no },
              { label: 'Hall No.', value: ticket.hall_no },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{f.value}</div>
              </div>
            ))}
          </div>
          <div style={{ width: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <div style={{ width: 120, height: 120, background: 'white', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={`data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="white"/><rect x="10" y="10" width="20" height="20" fill="black"/><rect x="70" y="10" width="20" height="20" fill="black"/><rect x="10" y="70" width="20" height="20" fill="black"/><rect x="40" y="40" width="20" height="20" fill="black"/><rect x="45" y="20" width="10" height="10" fill="black"/><rect x="20" y="45" width="10" height="10" fill="black"/><rect x="70" y="70" width="15" height="15" fill="black"/></svg>`}
                style={{ width: '100%', height: '100%' }} alt="QR Code" />
            </div>
            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Scan to Verify</div>
          </div>
        </div>
        <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <strong>Important:</strong> Carry your Student ID card. Report 15 minutes early. No electronic gadgets allowed.
        </div>
      </div>
    </div>
  );
}

// ─── Admin: generate + view all tickets ──────────────────────────────────────
function AdminHallTickets() {
  const { isAdmin } = usePermissions();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [tickets, setTickets] = useState<HallTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadExams = () => {
    setLoading(true);
    examinationApi.exams.list().then(r => setExams(r.data.data ?? [])).catch(err => console.warn('Request failed:', err)).finally(() => setLoading(false));
  };

  useEffect(() => { loadExams(); }, []);

  useEffect(() => {
    if (!selectedExamId) { setTickets([]); return; }
    setLoading(true); setError('');
    api.get(`/exams/${selectedExamId}/hall-tickets`)
      .then(async (r) => {
        const rawTickets: HallTicket[] = r.data.data ?? [];
        const sRes = await studentsApi.list({ limit: 200 });
        const studentsList = sRes.data.data ?? [];
        setTickets(rawTickets.map(t => {
          const s = studentsList.find((st: any) => st.student_id === t.student_id);
          return { ...t, student_name: s ? `${s.person.first_name} ${s.person.last_name ?? ''}` : 'Unknown' };
        }));
      })
      .catch(() => setError('Failed to load tickets for this exam'))
      .finally(() => setLoading(false));
  }, [selectedExamId]);

  const handleGenerate = (examId: string) => {
    if (!isAdmin) return;
    setError(''); setMessage(''); setLoading(true);
    api.post(`/exams/${examId}/hall-tickets`, {})
      .then((r: any) => { setMessage(`Generated ${r.data.data?.count ?? 0} hall tickets!`); loadExams(); setSelectedExamId(examId); })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
        setError(e.response?.data?.errors?.[0]?.message || 'Failed to generate hall tickets');
      })
      .finally(() => setLoading(false));
  };

  return (
    <>
      {message && <div className="card" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--accent-success)', padding: '1rem', marginBottom: '1.5rem', borderRadius: 8 }}>{message}</div>}
      {error && <div className="login-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

      <div className="card">
        {selectedExamId && tickets.length > 0 ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3>Admit Cards — {exams.find(e => e.exam_id === selectedExamId)?.course_name}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedExamId('')}>← All Exams</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Student</th><th>Seat No.</th><th>Hall No.</th><th>QR Signature</th></tr></thead>
                <tbody>
                  {tickets.map(t => (
                    <tr key={t.hall_ticket_id}>
                      <td style={{ fontWeight: 600 }}>{t.student_name}</td>
                      <td>{t.seat_no}</td>
                      <td>{t.hall_no}</td>
                      <td><code style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.qr_code?.slice(0, 16)}…</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <h3 style={{ marginBottom: '1rem' }}>Exam — Ticket Status</h3>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
            ) : exams.length === 0 ? (
              <div className="empty-state"><div className="empty-state-icon">📝</div><h3>No exams scheduled</h3><p>Schedule exams first before generating tickets.</p></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                     <tr>
                       <th>Exam Code</th><th>Course</th><th>Date</th><th>Ticket Status</th>
                       {isAdmin && <th>Actions</th>}
                     </tr>
                  </thead>
                  <tbody>
                    {exams.map(e => (
                      <tr key={e.exam_id}>
                        <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{e.exam_code ?? '—'}</td>
                        <td>{e.course_code} — {e.course_name}</td>
                        <td>{e.scheduled_date}</td>
                        <td><span className={`badge ${e.hall_tickets_generated ? 'badge-success' : 'badge-warning'}`}>{e.hall_tickets_generated ? 'Issued' : 'Pending'}</span></td>
                         {isAdmin && (
                           <td>
                             {e.hall_tickets_generated ? (
                               <button className="btn btn-secondary btn-sm" onClick={() => setSelectedExamId(e.exam_id)}>View Tickets</button>
                             ) : (
                               <button className="btn btn-primary btn-sm" onClick={() => handleGenerate(e.exam_id)}>Generate</button>
                             )}
                           </td>
                         )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ─── Page router ──────────────────────────────────────────────────────────────
export default function HallTickets() {
  const { can, isStudent } = usePermissions();

  if (!can('exams.read')) {
    return (
      <>
        <Header title="Hall Tickets" subtitle="Access denied" />
        <div className="page fade-in">
          <div className="empty-state">
            <div className="empty-state-icon">🔒</div>
            <h3>Access Denied</h3>
            <p>Faculty and Fee Managers do not have access to the Hall Tickets module.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Hall Tickets" subtitle={isStudent ? 'Your exam admit card' : 'Generate and manage exam hall tickets'} />
      <div className="page fade-in">
        <div className="page-header">
          <h1>{isStudent ? 'My Hall Ticket' : 'Exam Hall Tickets'}</h1>
          <p>{isStudent ? 'Your entry pass for upcoming examinations' : 'Generate hall tickets and view seat allocations'}</p>
        </div>
        {isStudent ? <MyHallTicket /> : <AdminHallTickets />}
      </div>
    </>
  );
}
