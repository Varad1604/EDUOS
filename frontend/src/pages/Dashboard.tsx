import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { usePermissions } from '../hooks/usePermissions';
import { studentsApi, academicsApi, examinationApi, financeApi, hostelApi, transportApi } from '../api';

// Professional SVG Icons
function DashboardIcon({ name, color }: { name: string; color?: string }) {
  const size = 20;
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color || "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  switch (name) {
    case 'students':
      return (
        <svg {...props}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'courses':
      return (
        <svg {...props}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case 'exams':
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case 'finance':
      return (
        <svg {...props}>
          <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      );
    case 'scholarship':
      return (
        <svg {...props}>
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
        </svg>
      );
    case 'accounts':
      return (
        <svg {...props}>
          <rect x="2" y="3" width="20" height="18" rx="2" ry="2" />
          <line x1="12" y1="3" x2="12" y2="21" />
        </svg>
      );
    case 'assets':
      return (
        <svg {...props}>
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}

// Admin / Registrar Dashboard
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
  const [collectionTrend, setCollectionTrend] = useState<number[]>(Array(12).fill(0));

  useEffect(() => {
    Promise.allSettled([
      studentsApi.list({ limit: 1 }),
      academicsApi.courses.list(),
      examinationApi.exams.list(),
      financeApi.feeStructures.list(),
      financeApi.scholarships.list(),
      financeApi.accounts.list(),
      studentsApi.list({ limit: 5, sort: 'cgpa_desc' }),
      financeApi.reports.feeCollectionTrend(),
    ]).then(([sR, cR, eR, fsR, scR, acR, topR, trendR]) => {
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
      if (topR.status === 'fulfilled') {
        const all: any[] = topR.value.data.data ?? [];
        const sorted = all.filter(s => s.cgpa).sort((a, b) => parseFloat(b.cgpa) - parseFloat(a.cgpa)).slice(0, 5);
        setTopStudents(sorted);
      }
      if (trendR.status === 'fulfilled') {
        const trendData = trendR.value.data.data ?? [];
        const monthlyAmounts = Array(12).fill(0);
        trendData.forEach((item: any) => {
          const m = parseInt(item.month);
          if (m >= 1 && m <= 12) {
            monthlyAmounts[m - 1] = parseFloat(item.total || '0');
          }
        });
        setCollectionTrend(monthlyAmounts);
      }
    }).finally(() => setLoading(false));
  }, []);

  const STAT_CARDS = [
    { key: 'students', value: loading ? '…' : stats.students.toLocaleString(), label: 'Total Students', color: '#1d4ed8' },
    { key: 'courses', value: loading ? '…' : stats.courses.toString(), label: 'Active Courses', color: '#1e40af' },
    { key: 'exams', value: loading ? '…' : stats.exams.toString(), label: 'Exams Scheduled', color: '#b45309' },
    { key: 'finance', value: loading ? '…' : stats.feeStructures.toString(), label: 'Fee Structures', color: '#15803d' },
    { key: 'scholarship', value: loading ? '…' : stats.scholarships.toString(), label: 'Scholarships', color: '#1d4ed8' },
    { key: 'assets', value: loading ? '…' : `₹${(stats.assets / 100000).toFixed(1)}L`, label: 'Total Assets', color: '#4b5563' },
    { key: 'finance', value: loading ? '…' : `₹${(stats.income / 100000).toFixed(1)}L`, label: 'Revenue (YTD)', color: '#15803d' },
    { key: 'accounts', value: loading ? '…' : stats.accounts.toString(), label: 'GL Accounts', color: '#4b5563' },
  ];

  return (
    <>
      <div className="stats-grid">
        {STAT_CARDS.map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.color + '15' }}>
              <DashboardIcon name={s.key} color={s.color} />
            </div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: '1.5rem' }}>
        <div className="card" style={{ position: 'relative' }}>
          <div className="card-header">
            <h3>Fee Collection Trend</h3>
            <span className="badge badge-success">YTD Ledger</span>
          </div>

          {hoveredBar !== null && (
            <div style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              padding: '6px 12px',
              fontSize: '0.78rem',
              color: 'var(--color-text-primary)',
              pointerEvents: 'none',
              zIndex: 10,
              boxShadow: 'var(--shadow)',
              animation: 'fadeIn 0.2s ease both',
            }}>
              <strong>{MONTHS[hoveredBar]}</strong>: ₹{collectionTrend[hoveredBar].toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          )}

          <div style={{ marginTop: '1rem', width: '100%', overflow: 'hidden' }}>
            <svg viewBox="0 0 600 200" style={{ width: '100%', height: 'auto', display: 'block' }}>
              <line x1="40" y1="30" x2="570" y2="30" stroke="var(--color-border-light)" strokeDasharray="3 3" />
              <line x1="40" y1="70" x2="570" y2="70" stroke="var(--color-border-light)" strokeDasharray="3 3" />
              <line x1="40" y1="110" x2="570" y2="110" stroke="var(--color-border-light)" strokeDasharray="3 3" />
              <line x1="40" y1="150" x2="570" y2="150" stroke="var(--color-border-light)" strokeDasharray="3 3" />

              <text x="30" y="34" fill="var(--color-text-muted)" fontSize="9" textAnchor="end">₹8L</text>
              <text x="30" y="74" fill="var(--color-text-muted)" fontSize="9" textAnchor="end">₹6L</text>
              <text x="30" y="114" fill="var(--color-text-muted)" fontSize="9" textAnchor="end">₹4L</text>
              <text x="30" y="154" fill="var(--color-text-muted)" fontSize="9" textAnchor="end">₹2L</text>

              <line x1="40" y1="170" x2="570" y2="170" stroke="var(--color-border)" strokeWidth={1.5} />

              {collectionTrend.map((amount, i) => {
                const maxAmount = Math.max(...collectionTrend, 10000);
                const slotWidth = 530 / 12;
                const barWidth = 20;
                const x = 40 + i * slotWidth + (slotWidth - barWidth) / 2;
                const barHeight = (amount / maxAmount) * 130;
                const y = 170 - barHeight;

                return (
                  <g key={i}>
                    {barHeight > 0 && (
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        fill="var(--color-primary)"
                        rx={2}
                        ry={2}
                        style={{
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          opacity: hoveredBar === null || hoveredBar === i ? 0.95 : 0.5,
                        }}
                        onMouseEnter={() => setHoveredBar(i)}
                        onMouseLeave={() => setHoveredBar(null)}
                      />
                    )}
                    <text
                      x={x + barWidth / 2}
                      y="186"
                      fill={hoveredBar === i ? 'var(--color-text-primary)' : 'var(--color-text-muted)'}
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
                      <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{e.course_code}</td>
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
            <h3>Top Students by CGPA</h3>
            <a href="/students" className="btn btn-primary btn-sm">All Students</a>
          </div>
          {topStudents.length === 0 ? (
            <div className="empty-state"><p>No student results compiled yet.</p></div>
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
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0, color: 'var(--color-primary)' }}>{s.person.first_name[0]}</div>
                          {s.person.first_name} {s.person.last_name ?? ''}
                        </div>
                      </td>
                      <td>{s.enrollment_number ?? '—'}</td>
                      <td>Sem {s.current_semester ?? '—'}</td>
                      <td><strong style={{ color: 'var(--color-success)' }}>{parseFloat(s.cgpa).toFixed(2)}</strong></td>
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

// FeeManager Dashboard
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
    }).catch(err => console.warn('Request failed:', err)).finally(() => setLoading(false));
  }, []);

  const totalAssets = accounts.filter(a => a.account_type === 'Asset').reduce((s, a) => s + parseFloat(a.current_balance || '0'), 0);
  const totalIncome = accounts.filter(a => a.account_type === 'Income').reduce((s, a) => s + parseFloat(a.current_balance || '0'), 0);
  const totalExpenses = accounts.filter(a => a.account_type === 'Expense').reduce((s, a) => s + parseFloat(a.current_balance || '0'), 0);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading financial data…</div>;

  return (
    <>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[
          { key: 'assets', value: `₹${(totalAssets / 100000).toFixed(1)}L`, label: 'Total Assets', color: '#1d4ed8' },
          { key: 'finance', value: `₹${(totalIncome / 100000).toFixed(1)}L`, label: 'Revenue (YTD)', color: '#15803d' },
          { key: 'finance', value: `₹${(totalExpenses / 100000).toFixed(1)}L`, label: 'Expenses (YTD)', color: '#b91c1c' },
          { key: 'finance', value: structures.length.toString(), label: 'Fee Structures', color: '#1d4ed8' },
          { key: 'scholarship', value: scholarships.length.toString(), label: 'Scholarship Schemes', color: '#1d4ed8' },
          { key: 'accounts', value: accounts.length.toString(), label: 'GL Accounts', color: '#4b5563' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.color + '15' }}>
              <DashboardIcon name={s.key} color={s.color} />
            </div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
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
                  ? <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No fee structures created</td></tr>
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

// Faculty Dashboard
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
    }).catch(err => console.warn('Request failed:', err)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading faculty data…</div>;

  return (
    <>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[
          { key: 'courses', value: courses.length.toString(), label: 'Courses (This Semester)', color: '#1d4ed8' },
          { key: 'exams', value: exams.length.toString(), label: 'Exams Scheduled', color: '#b45309' },
          { key: 'students', value: '—', label: 'Classes Today', color: '#4b5563' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.color + '15' }}>
              <DashboardIcon name={s.key} color={s.color} />
            </div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
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
                  ? <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No courses allocated yet</td></tr>
                  : courses.slice(0, 6).map(c => (
                    <tr key={c.course_id}>
                      <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{c.course_code}</td>
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
                  ? <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No exams scheduled</td></tr>
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

      <div className="card" style={{ marginTop: '1.5rem', background: 'var(--color-primary-light)', border: '1px solid var(--color-primary-border)' }}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ fontSize: '2rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-primary)' }}>Quick Actions</div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>Mark attendance or enter exam marks directly</div>
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

// Student Dashboard
function StudentDashboard() {
  const { user } = usePermissions();
  const [results, setResults] = useState<any[]>([]);
  const [feeSummary, setFeeSummary] = useState<any>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [attendancePct, setAttendancePct] = useState<string>('—');
  const [hostelAlloc, setHostelAlloc] = useState<any>(null);
  const [transportAlloc, setTransportAlloc] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentsApi.getMyProfile().then(r => {
      const me = r.data?.data;
      if (me) {
        examinationApi.results.get(me.student_id)
          .then(res => setResults(res.data.data ?? [])).catch(err => console.warn('Request failed:', err));
        financeApi.allocations.summary(me.student_id)
          .then(res => setFeeSummary(res.data.data)).catch(err => console.warn('Request failed:', err));

        // Fetch Hostel Stay allotment
        hostelApi.allocations.listStudent(me.student_id)
          .then(res => {
            const list = res.data.data ?? [];
            const active = list.find((a: any) => a.status === 'Active');
            setHostelAlloc(active ?? null);
          }).catch(err => console.warn('Hostel alloc fetch failed', err));

        // Fetch Transport Route allotment
        transportApi.allocations.listStudent(me.student_id)
          .then(res => {
            const list = res.data.data ?? [];
            const active = list.find((a: any) => a.status === 'Active');
            setTransportAlloc(active ?? null);
          }).catch(err => console.warn('Transport alloc fetch failed', err));

        academicsApi.courses.list().then(cRes => {
          const list = cRes.data.data ?? [];
          Promise.all(list.map((c: any) => 
            academicsApi.attendance.summary(me.student_id, c.course_id)
              .then(aS => aS.data.data.percentage)
              .catch(() => null)
          )).then(pcts => {
            const valid = pcts.filter((p): p is number => p !== null);
            if (valid.length > 0) {
              const avg = valid.reduce((sum, p) => sum + p, 0) / valid.length;
              setAttendancePct(`${avg.toFixed(1)}%`);
            } else {
              setAttendancePct('100.0%');
            }
          });
        });
      }
    }).catch(err => console.warn('Request failed:', err));

    examinationApi.exams.list()
      .then(r => setExams((r.data.data ?? []).slice(0, 4))).catch(err => console.warn('Request failed:', err));
    setLoading(false);
  }, [user?.username]);

  const latestResult = results[results.length - 1];

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading your data…</div>;

  return (
    <>
      <div className="card" style={{ background: 'var(--color-primary-light)', border: '1px solid var(--color-primary-border)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', fontWeight: 700, flexShrink: 0, color: '#fff' }}>
          {user?.username?.[0]?.toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Welcome back, {user?.username}</div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>Student Portal</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {latestResult && (
            <>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-primary)' }}>{latestResult.cgpa}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Current CGPA</div>
            </>
          )}
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { key: 'exams', value: latestResult?.sgpa ?? '—', label: 'Last SGPA', color: '#1d4ed8' },
          { key: 'students', value: attendancePct, label: 'Attendance', color: '#15803d' },
          { key: 'finance', value: feeSummary ? `₹${parseInt(feeSummary.outstanding ?? 0).toLocaleString()}` : '—', label: 'Outstanding Fees', color: '#b91c1c' },
          { key: 'exams', value: latestResult?.backlogs_count?.toString() ?? '0', label: 'Backlogs', color: '#4b5563' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.color + '15' }}>
              <DashboardIcon name={s.key} color={s.color} />
            </div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
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
                  ? <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No exams scheduled</td></tr>
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
          <div className="card-header"><h3>My Results</h3><a href="/results" className="btn btn-secondary btn-sm">Transcript</a></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Semester</th><th>SGPA</th><th>CGPA</th><th>Status</th></tr></thead>
              <tbody>
                {results.length === 0
                  ? <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No results published yet</td></tr>
                  : results.map(r => (
                    <tr key={r.result_id}>
                      <td>Sem {r.semester}</td>
                      <td><span className="badge badge-info">{r.sgpa}</span></td>
                      <td><strong style={{ color: 'var(--color-success)' }}>{r.cgpa}</strong></td>
                      <td><span className={`badge ${r.status === 'Pass' ? 'badge-success' : 'badge-danger'}`}>{r.status}</span></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Hostel stay & Transport details */}
      <div className="grid-2" style={{ marginTop: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h3>🏢 Hostel Stay Details</h3>
            <a href="/hostel" className="btn btn-secondary btn-sm">Manage Stay</a>
          </div>
          {hostelAlloc ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Block / Room:</span>
                <strong style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>{hostelAlloc.hostel_name} — Room {hostelAlloc.room_number}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Room Type:</span>
                <span className="badge badge-info">{hostelAlloc.room_type}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Mess Plan:</span>
                <strong style={{ color: 'var(--color-primary)', fontSize: '0.95rem' }}>{hostelAlloc.mess_plan}</strong>
              </div>
            </div>
          ) : (
            <div style={{ padding: '2rem 1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
              No active hostel stay allocation.
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>🚌 Transport Bus Details</h3>
            <a href="/transport" className="btn btn-secondary btn-sm">Manage Route</a>
          </div>
          {transportAlloc ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Route:</span>
                <strong style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>{transportAlloc.route_name} ({transportAlloc.route_code})</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Boarding Stop:</span>
                <strong style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>{transportAlloc.stop_name} (⏰ {transportAlloc.pickup_time?.slice(0, 5)} AM)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Vehicle Number:</span>
                <span className="badge badge-success">{transportAlloc.vehicle_number}</span>
              </div>
            </div>
          ) : (
            <div style={{ padding: '2rem 1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
              No active transport route allocation.
            </div>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: '1.5rem' }}>
        <a href="/hall-tickets" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ cursor: 'pointer', transition: 'all 0.15s', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Admit Card / Hall Ticket</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Download your exam admit card</div>
              </div>
              <div style={{ marginLeft: 'auto', color: 'var(--color-primary)' }}>→</div>
            </div>
          </div>
        </a>
        <a href="/fees" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ cursor: 'pointer', transition: 'all 0.15s', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Fees Payment</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>View due amounts and make payments</div>
              </div>
              <div style={{ marginLeft: 'auto', color: 'var(--color-success)' }}>→</div>
            </div>
          </div>
        </a>
      </div>
    </>
  );
}

// Main Dashboard Router
export default function Dashboard() {
  const { isPrincipal, isRegistrar, isFeeManager, isFaculty, isStudent } = usePermissions();

  const subtitle =
    isPrincipal  ? 'Principal — Institutional View' :
    isRegistrar  ? 'Registrar — Academic & Enrollment' :
    isFeeManager ? 'Fee Manager — Financial Operations' :
    isFaculty    ? 'Faculty — Teaching Desk' :
    isStudent    ? 'Student — Academic Portal' :
    'Dashboard';

  return (
    <>
      <Header title="Dashboard" subtitle={`EduOS · ${subtitle}`} />
      <div className="page fade-in">
        <div className="page-header">
          <h1>{isPrincipal || isRegistrar ? 'Institution Overview' : isStudent ? 'Academic Portal' : isFeeManager ? 'Financial Overview' : 'Teaching Overview'}</h1>
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
