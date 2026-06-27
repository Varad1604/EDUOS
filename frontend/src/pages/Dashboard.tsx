import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { usePermissions } from '../hooks/usePermissions';
import { studentsApi, academicsApi, examinationApi, financeApi } from '../api';

// ─── Admin / Registrar Dashboard ─────────────────────────────────────────────
function AdminDashboard() {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [stats, setStats] = useState({
    students: 0, courses: 0, exams: 0, feeStructures: 0,
    scholarships: 0, accounts: 0, assets: 0, income: 0,
  });
  const [topStudents, setTopStudents] = useState<any[]>([]);
  const [recentExams, setRecentExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const BARS = [65, 80, 55, 90, 72, 85, 60, 78, 88, 70, 92, 76];

  useEffect(() => {
    Promise.allSettled([
      studentsApi.list({ limit: 1 }),
      academicsApi.courses.list(),
      examinationApi.exams.list(),
      financeApi.feeStructures.list(),
      financeApi.scholarships.list(),
      financeApi.accounts.list(),
      studentsApi.list({ limit: 5, sort: 'cgpa_desc' }),
    ]).then(([sR, cR, eR, fsR, scR, acR, topR]) => {
      const students = sR.status === 'fulfilled' ? (sR.value.data.meta?.pagination?.total ?? 0) : 0;
      const courses  = cR.status === 'fulfilled' ? (cR.value.data.data?.length ?? 0) : 0;
      const exams    = eR.status === 'fulfilled' ? (eR.value.data.data?.length ?? 0) : 0;
      const feeStructures = fsR.status === 'fulfilled' ? (fsR.value.data.data?.length ?? 0) : 0;
      const scholarships  = scR.status === 'fulfilled' ? (scR.value.data.data?.length ?? 0) : 0;
      const accs = acR.status === 'fulfilled' ? (acR.value.data.data ?? []) : [];
      const assets = accs.filter((a: any) => a.account_type === 'Asset').reduce((s: number, a: any) => s + parseFloat(a.current_balance || '0'), 0);
      const income = accs.filter((a: any) => a.account_type === 'Income').reduce((s: number, a: any) => s + parseFloat(a.current_balance || '0'), 0);
      setStats({ students, courses, exams, feeStructures, scholarships, accounts: accs.length, assets, income });

      if (eR.status === 'fulfilled') {
        setRecentExams((eR.value.data.data ?? []).slice(0, 5));
      }
      // For top students by CGPA — filter and sort on client
      if (topR.status === 'fulfilled') {
        const all: any[] = topR.value.data.data ?? [];
        const sorted = all.filter(s => s.cgpa).sort((a, b) => parseFloat(b.cgpa) - parseFloat(a.cgpa)).slice(0, 5);
        setTopStudents(sorted);
      }
    }).finally(() => setLoading(false));
  }, []);

  const STAT_CARDS = [
    { icon: '👥', value: loading ? '…' : stats.students.toLocaleString(), label: 'Total Students', color: '#6366f1' },
    { icon: '📚', value: loading ? '…' : stats.courses.toString(), label: 'Active Courses', color: '#8b5cf6' },
    { icon: '📝', value: loading ? '…' : stats.exams.toString(), label: 'Exams Scheduled', color: '#f59e0b' },
    { icon: '📋', value: loading ? '…' : stats.feeStructures.toString(), label: 'Fee Structures', color: '#10b981' },
    { icon: '🎓', value: loading ? '…' : stats.scholarships.toString(), label: 'Scholarship Schemes', color: '#3b82f6' },
    { icon: '🏦', value: loading ? '…' : `₹${(stats.assets / 100000).toFixed(1)}L`, label: 'Total Assets', color: '#ec4899' },
    { icon: '💰', value: loading ? '…' : `₹${(stats.income / 100000).toFixed(1)}L`, label: 'Revenue (YTD)', color: '#10b981' },
    { icon: '📒', value: loading ? '…' : stats.accounts.toString(), label: 'GL Accounts', color: '#6b7280' },
  ];

  return (
    <>
      <div className="stats-grid">
        {STAT_CARDS.map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.color + '20' }}>{s.icon}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: '1.5rem' }}>
        <div className="card" style={{ position: 'relative' }}>
          <div className="card-header">
            <h3>Fee Collection Trend</h3>
            <span className="badge badge-success">2025-26</span>
          </div>

          {hoveredBar !== null && (
            <div style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--accent-primary)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '0.78rem',
              color: 'var(--text-primary)',
              pointerEvents: 'none',
              zIndex: 10,
              boxShadow: 'var(--shadow)',
              animation: 'fadeIn 0.2s ease both',
            }}>
              <strong>{MONTHS[hoveredBar]}</strong>: ₹{(BARS[hoveredBar] * 0.42).toFixed(2)} Lakhs
            </div>
          )}

          <div style={{ marginTop: '1rem', width: '100%', overflow: 'hidden' }}>
            <svg viewBox="0 0 600 200" style={{ width: '100%', height: 'auto', display: 'block' }}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-primary)" />
                  <stop offset="100%" stopColor="var(--accent-secondary)" stopOpacity={0.6} />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              <line x1="40" y1="30" x2="570" y2="30" stroke="var(--border)" strokeDasharray="3 3" />
              <line x1="40" y1="70" x2="570" y2="70" stroke="var(--border)" strokeDasharray="3 3" />
              <line x1="40" y1="110" x2="570" y2="110" stroke="var(--border)" strokeDasharray="3 3" />
              <line x1="40" y1="150" x2="570" y2="150" stroke="var(--border)" strokeDasharray="3 3" />

              {/* Y Axis labels */}
              <text x="30" y="34" fill="var(--text-muted)" fontSize="10" textAnchor="end">₹8L</text>
              <text x="30" y="74" fill="var(--text-muted)" fontSize="10" textAnchor="end">₹6L</text>
              <text x="30" y="114" fill="var(--text-muted)" fontSize="10" textAnchor="end">₹4L</text>
              <text x="30" y="154" fill="var(--text-muted)" fontSize="10" textAnchor="end">₹2L</text>

              {/* Axis line */}
              <line x1="40" y1="170" x2="570" y2="170" stroke="var(--border)" strokeWidth={1.5} />

              {/* Bars */}
              {BARS.map((h, i) => {
                const slotWidth = 530 / 12;
                const barWidth = 22;
                const x = 40 + i * slotWidth + (slotWidth - barWidth) / 2;
                const barHeight = (h / 100) * 130;
                const y = 170 - barHeight;

                return (
                  <g key={i}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      fill="url(#barGrad)"
                      rx={4}
                      ry={4}
                      style={{
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        opacity: hoveredBar === null || hoveredBar === i ? 1 : 0.4,
                      }}
                      onMouseEnter={() => setHoveredBar(i)}
                      onMouseLeave={() => setHoveredBar(null)}
                    />
                    <text
                      x={x + barWidth / 2}
                      y="186"
                      fill={hoveredBar === i ? 'var(--text-primary)' : 'var(--text-muted)'}
                      fontSize="9"
                      fontWeight={hoveredBar === i ? 'bold' : 'normal'}
                      textAnchor="middle"
                    >
                      {MONTHS[i]}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3>Recent Exam Activity</h3>
            <a href="/exams" className="btn btn-secondary btn-sm">Manage</a>
          </div>
          {recentExams.length === 0 ? (
            <div className="empty-state"><p>No exams scheduled yet.</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Course</th><th>Type</th><th>Date</th><th>Hall Tickets</th></tr></thead>
                <tbody>
                  {recentExams.map(e => (
                    <tr key={e.exam_id}>
                      <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{e.course_code}</td>
                      <td><span className="badge badge-warning">{e.exam_type}</span></td>
                      <td>{e.scheduled_date}</td>
                      <td><span className={`badge ${e.hall_tickets_generated ? 'badge-success' : 'badge-muted'}`}>{e.hall_tickets_generated ? 'Issued' : 'Pending'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h3>🏆 Top Students by CGPA</h3>
            <a href="/students" className="btn btn-primary btn-sm">All Students</a>
          </div>
          {topStudents.length === 0 ? (
            <div className="empty-state"><p>No student results compiled yet. Enter marks and compile results first.</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Rank</th><th>Student</th><th>Enrollment No.</th><th>Sem</th><th>CGPA</th><th>Status</th></tr></thead>
                <tbody>
                  {topStudents.map((s, i) => (
                    <tr key={s.student_id}>
                      <td>#{i + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>{s.person.first_name[0]}</div>
                          {s.person.first_name} {s.person.last_name ?? ''}
                        </div>
                      </td>
                      <td>{s.enrollment_number ?? '—'}</td>
                      <td>Sem {s.current_semester ?? '—'}</td>
                      <td><strong style={{ color: 'var(--accent-success)' }}>{parseFloat(s.cgpa).toFixed(2)}</strong></td>
                      <td><span className="badge badge-success">{s.enrollment_status}</span></td>
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


// ─── FeeManager Dashboard ─────────────────────────────────────────────────────
function FeeManagerDashboard() {
  const [structures, setStructures] = useState<any[]>([]);
  const [scholarships, setScholarships] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      financeApi.feeStructures.list(),
      financeApi.scholarships.list(),
      financeApi.accounts.list(),
    ]).then(([fs, sc, ac]) => {
      setStructures(fs.data.data ?? []);
      setScholarships(sc.data.data ?? []);
      setAccounts(ac.data.data ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const totalAssets = accounts.filter(a => a.account_type === 'Asset').reduce((s, a) => s + parseFloat(a.current_balance || '0'), 0);
  const totalIncome = accounts.filter(a => a.account_type === 'Income').reduce((s, a) => s + parseFloat(a.current_balance || '0'), 0);
  const totalExpenses = accounts.filter(a => a.account_type === 'Expense').reduce((s, a) => s + parseFloat(a.current_balance || '0'), 0);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading financial data…</div>;

  return (
    <>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[
          { icon: '🏦', value: `₹${(totalAssets / 1000).toFixed(0)}K`, label: 'Total Assets', up: true, change: '' },
          { icon: '💰', value: `₹${(totalIncome / 1000).toFixed(0)}K`, label: 'Revenue (YTD)', up: true, change: '' },
          { icon: '📤', value: `₹${(totalExpenses / 1000).toFixed(0)}K`, label: 'Expenses (YTD)', up: false, change: '' },
          { icon: '📋', value: structures.length.toString(), label: 'Fee Structures', up: true, change: '' },
          { icon: '🎓', value: scholarships.length.toString(), label: 'Scholarship Schemes', up: true, change: '' },
          { icon: '📒', value: accounts.length.toString(), label: 'GL Accounts', up: true, change: '' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: '1.5rem' }}>
        <div className="card">
          <div className="card-header"><h3>Fee Structures</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Year</th><th>Category</th><th>Quota</th><th>Total Amount</th></tr></thead>
              <tbody>
                {structures.length === 0
                  ? <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No fee structures created</td></tr>
                  : structures.map(f => (
                    <tr key={f.fee_structure_id}>
                      <td>{f.academic_year}</td>
                      <td>{f.category ?? '—'}</td>
                      <td>{f.quota ?? '—'}</td>
                      <td style={{ fontWeight: 600 }}>₹{parseFloat(f.total_amount).toLocaleString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>GL Accounts Summary</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Account</th><th>Type</th><th>Balance</th></tr></thead>
              <tbody>
                {accounts.slice(0, 8).map(a => (
                  <tr key={a.account_id}>
                    <td style={{ fontWeight: 600 }}>{a.account_code}</td>
                    <td>{a.account_name}</td>
                    <td><span className={`badge ${a.account_type === 'Asset' || a.account_type === 'Income' ? 'badge-success' : 'badge-warning'}`}>{a.account_type}</span></td>
                    <td>₹{parseFloat(a.current_balance).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Faculty Dashboard ────────────────────────────────────────────────────────
function FacultyDashboard() {
  const [courses, setCourses] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      academicsApi.courses.list(),
      examinationApi.exams.list(),
    ]).then(([c, e]) => {
      setCourses(c.data.data ?? []);
      setExams((e.data.data ?? []).slice(0, 5));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading faculty data…</div>;

  return (
    <>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[
          { icon: '📚', value: courses.length.toString(), label: 'Courses (This Semester)' },
          { icon: '📝', value: exams.length.toString(), label: 'Exams Scheduled' },
          { icon: '✅', value: '—', label: 'Classes Today' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: '1.5rem' }}>
        <div className="card">
          <div className="card-header"><h3>My Courses</h3><a href="/courses" className="btn btn-secondary btn-sm">View All</a></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Course Name</th><th>Credits</th><th>Type</th></tr></thead>
              <tbody>
                {courses.length === 0
                  ? <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No courses allocated yet</td></tr>
                  : courses.slice(0, 6).map(c => (
                    <tr key={c.course_id}>
                      <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{c.course_code}</td>
                      <td>{c.course_name}</td>
                      <td>{c.credits}</td>
                      <td><span className="badge badge-info">{c.course_type}</span></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Upcoming Exams</h3><a href="/exams" className="btn btn-secondary btn-sm">Manage</a></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Course</th><th>Type</th><th>Date</th><th>Hall Tickets</th></tr></thead>
              <tbody>
                {exams.length === 0
                  ? <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No exams scheduled</td></tr>
                  : exams.map(e => (
                    <tr key={e.exam_id}>
                      <td style={{ fontWeight: 600 }}>{e.course_code}</td>
                      <td><span className="badge badge-warning">{e.exam_type}</span></td>
                      <td>{e.scheduled_date}</td>
                      <td><span className={`badge ${e.hall_tickets_generated ? 'badge-success' : 'badge-muted'}`}>{e.hall_tickets_generated ? 'Issued' : 'Pending'}</span></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ fontSize: '2rem' }}>📋</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1rem' }}>Quick Actions</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>Mark attendance or enter exam marks directly</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
            <a href="/attendance" className="btn btn-primary">Mark Attendance</a>
            <a href="/exams" className="btn btn-secondary">Enter Marks</a>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Student Dashboard ────────────────────────────────────────────────────────
function StudentDashboard() {
  const { user } = usePermissions();
  const [results, setResults] = useState<any[]>([]);
  const [feeSummary, setFeeSummary] = useState<any>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get current student's own data
    studentsApi.list({ limit: 100 }).then(r => {
      const students = r.data.data ?? [];
      const me = students.find((s: any) => s.person?.email === `${user?.username}@eduos.org`
        || s.person?.email?.toLowerCase().includes(user?.username?.toLowerCase() ?? ''));
      if (me) {
        examinationApi.results.get(me.student_id)
          .then(res => setResults(res.data.data ?? [])).catch(() => {});
        financeApi.allocations.summary(me.student_id)
          .then(res => setFeeSummary(res.data.data)).catch(() => {});
      }
    }).catch(() => {});

    examinationApi.exams.list()
      .then(r => setExams((r.data.data ?? []).slice(0, 4))).catch(() => {});
    setLoading(false);
  }, [user?.username]);

  const latestResult = results[results.length - 1];

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading your data…</div>;

  return (
    <>
      {/* Personal greeting card */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)', border: '1px solid rgba(99,102,241,0.3)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', fontWeight: 700, flexShrink: 0 }}>
          {user?.username?.[0]?.toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>Welcome, {user?.username}!</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>Student — EduOS Engineering College</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {latestResult && (
            <>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{latestResult.cgpa}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Current CGPA</div>
            </>
          )}
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { icon: '🏆', value: latestResult?.sgpa ?? '—', label: 'Last SGPA' },
          { icon: '✅', value: '82%', label: 'Attendance' },
          { icon: '💰', value: feeSummary ? `₹${parseInt(feeSummary.outstanding ?? 0).toLocaleString()}` : '—', label: 'Fee Outstanding' },
          { icon: '⚠️', value: latestResult?.backlogs_count?.toString() ?? '0', label: 'Backlogs' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: '1.5rem' }}>
        <div className="card">
          <div className="card-header"><h3>Upcoming Exams</h3><a href="/exams" className="btn btn-secondary btn-sm">View All</a></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Course</th><th>Type</th><th>Date</th><th>Time</th></tr></thead>
              <tbody>
                {exams.length === 0
                  ? <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No exams scheduled</td></tr>
                  : exams.map(e => (
                    <tr key={e.exam_id}>
                      <td style={{ fontWeight: 600 }}>{e.course_code}</td>
                      <td><span className="badge badge-warning">{e.exam_type}</span></td>
                      <td>{e.scheduled_date}</td>
                      <td>{e.scheduled_time?.slice(0, 5)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>My Results</h3><a href="/results" className="btn btn-secondary btn-sm">Full Transcript</a></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Semester</th><th>SGPA</th><th>CGPA</th><th>Status</th></tr></thead>
              <tbody>
                {results.length === 0
                  ? <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No results published yet</td></tr>
                  : results.map(r => (
                    <tr key={r.result_id}>
                      <td>Sem {r.semester}</td>
                      <td><span className="badge badge-info">{r.sgpa}</span></td>
                      <td><strong style={{ color: 'var(--accent-success)' }}>{r.cgpa}</strong></td>
                      <td><span className={`badge ${r.status === 'Pass' ? 'badge-success' : 'badge-danger'}`}>{r.status}</span></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick links for student */}
      <div className="grid-2" style={{ marginTop: '1.5rem' }}>
        <a href="/hall-tickets" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ cursor: 'pointer', transition: 'all 0.2s', border: '1px solid rgba(99,102,241,0.2)' }} onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-primary)')} onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)')}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ fontSize: '2rem' }}>🎫</div>
              <div>
                <div style={{ fontWeight: 600 }}>Hall Ticket</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Download your exam admit card</div>
              </div>
              <div style={{ marginLeft: 'auto', color: 'var(--accent-primary)' }}>→</div>
            </div>
          </div>
        </a>
        <a href="/fees" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ cursor: 'pointer', transition: 'all 0.2s', border: '1px solid rgba(16,185,129,0.2)' }} onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-success)')} onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(16,185,129,0.2)')}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ fontSize: '2rem' }}>💳</div>
              <div>
                <div style={{ fontWeight: 600 }}>Pay Fees</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>View due amounts and make payment</div>
              </div>
              <div style={{ marginLeft: 'auto', color: 'var(--accent-success)' }}>→</div>
            </div>
          </div>
        </a>
      </div>
    </>
  );
}

// ─── Main Dashboard Router ────────────────────────────────────────────────────
export default function Dashboard() {
  const { isPrincipal, isRegistrar, isFeeManager, isFaculty, isStudent } = usePermissions();

  const subtitle =
    isPrincipal  ? 'Principal — Full Institution View' :
    isRegistrar  ? 'Registrar — Academic & Enrollment View' :
    isFeeManager ? 'Fee Manager — Financial Operations' :
    isFaculty    ? 'Faculty — Teaching & Assessment View' :
    isStudent    ? 'Student — Personal Academic Portal' :
    'Dashboard';

  return (
    <>
      <Header title="Dashboard" subtitle={`EduOS · ${subtitle}`} />
      <div className="page fade-in">
        <div className="page-header">
          <h1>{isPrincipal || isRegistrar ? 'Institution Overview' : isStudent ? 'My Academic Portal' : isFeeManager ? 'Financial Overview' : 'Teaching Overview'}</h1>
          <p>{isPrincipal || isRegistrar ? 'Real-time snapshot of all institutional operations' : isStudent ? 'Your courses, results, fees and upcoming exams' : isFeeManager ? 'Fee collections, accounts and scholarship management' : 'Your courses, classes and examination schedule'}</p>
        </div>
        {(isPrincipal || isRegistrar) && <AdminDashboard />}
        {isFeeManager && <FeeManagerDashboard />}
        {isFaculty && <FacultyDashboard />}
        {isStudent && <StudentDashboard />}
      </div>
    </>
  );
}
