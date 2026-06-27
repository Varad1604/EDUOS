import React, { useEffect, useState, useCallback } from 'react';
import { placementApi, studentsApi } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { useAuthStore } from '../store';

/* ─── Type helpers ─────────────────────────────────────────────────────────── */
interface Company { company_id: string; company_name: string; industry: string; website?: string; contact_person?: string; contact_email?: string; contact_phone?: string; description?: string; status: string; }
interface Drive { drive_id: string; company_id: string; company_name: string; industry: string; drive_title: string; job_role: string; job_type: string; job_location?: string; package_lpa?: number; stipend_pm?: number; min_cgpa: number; backlogs_allowed: number; eligible_branches: string[]; bond_years: number; drive_date: string; application_deadline: string; status: string; application_count?: number; }
interface Application { application_id: string; drive_id: string; drive_title: string; job_role: string; company_name: string; package_lpa?: number; student_id: string; student_name: string; roll_number: string; applied_at: string; status: string; rejection_reason?: string; }
interface Offer { offer_id: string; student_id: string; student_name: string; roll_number: string; company_name: string; job_role: string; drive_title: string; offer_date: string; joining_date?: string; package_lpa?: number; stipend_pm?: number; status: string; }
interface Stats { total_companies: number; total_drives: number; open_drives: number; total_applications: number; total_offers: number; accepted_offers: number; avg_package_lpa?: number; highest_package_lpa?: number; }
interface Student { student_id: string; full_name: string; roll_number: string; }

const STATUS_COLOURS: Record<string, string> = {
  Open: '#10b981', Closed: '#6b7280', Cancelled: '#ef4444', Completed: '#6366f1',
  Applied: '#3b82f6', Shortlisted: '#8b5cf6', Rejected: '#ef4444',
  Interview: '#f59e0b', Offered: '#10b981', Accepted: '#22c55e',
  Declined: '#ef4444', Pending: '#f59e0b', Revoked: '#6b7280',
  Active: '#10b981', Blacklisted: '#ef4444', Inactive: '#6b7280',
};

const pill = (s: string) => (
  <span style={{ background: (STATUS_COLOURS[s] ?? '#6b7280') + '22', color: STATUS_COLOURS[s] ?? '#6b7280', border: `1px solid ${STATUS_COLOURS[s] ?? '#6b7280'}44`, padding: '2px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600 }}>{s}</span>
);

const fmt_pkg = (v?: number) => v ? `₹ ${v} LPA` : '—';
const fmt_date = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/* ─── Tabs ──────────────────────────────────────────────────────────────────── */
type Tab = 'overview' | 'companies' | 'drives' | 'applications' | 'offers';

export default function Placement() {
  const { granted } = usePermissions();
  const user = useAuthStore(s => s.user);
  const canManage = granted.includes('placement.manage' as never);
  const canApply = granted.includes('placement.apply' as never);

  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [resolvedStudentId, setResolvedStudentId] = useState('');
  const [hoveredStage, setHoveredStage] = useState<number | null>(null);

  // Modals
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState<Drive | null>(null);
  const [showOfferModal, setShowOfferModal] = useState<Application | null>(null);

  // Eligible Candidates Modal State
  const [selectedEligibleDrive, setSelectedEligibleDrive] = useState<Drive | null>(null);
  const [eligibleStudents, setEligibleStudents] = useState<any[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [eligibleSearch, setEligibleSearch] = useState('');

  useEffect(() => {
    if (selectedEligibleDrive) {
      setLoadingEligible(true);
      setEligibleSearch('');
      setEligibleStudents([]);
      placementApi.listEligibleStudents(selectedEligibleDrive.drive_id)
        .then((res: any) => {
          setEligibleStudents(res || []);
        })
        .catch((err: any) => {
          setError(err.message || 'Failed to fetch eligible students');
        })
        .finally(() => {
          setLoadingEligible(false);
        });
    }
  }, [selectedEligibleDrive]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [st, co, dr, ap, of_] = await Promise.all([
        placementApi.stats(),
        placementApi.listCompanies(),
        placementApi.listDrives(),
        canManage ? placementApi.listApplications() : placementApi.myApplications(resolvedStudentId || user?.user_id || ''),
        canManage ? placementApi.listOffers() : Promise.resolve([]),
      ]);
      setStats(st);
      setCompanies(co);
      setDrives(dr);
      setApplications(ap);
      setOffers(of_);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [canManage, user, resolvedStudentId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (canManage) {
      studentsApi.list()
        .then(r => {
          const studentList = r.data.data ?? [];
          setStudents(studentList.map((st: any) => ({
            student_id: st.student_id,
            full_name: st.person ? `${st.person.first_name ?? ''} ${st.person.last_name ?? ''}`.trim() : (st.first_name ? `${st.first_name} ${st.last_name ?? ''}` : 'Unknown'),
            roll_number: st.enrollment_number || st.roll_number || ''
          })));
        })
        .catch(() => {});
    }
  }, [canManage]);

  useEffect(() => {
    if (!canManage && user?.username) {
      studentsApi.list()
        .then(r => {
          const studentList = r.data.data ?? [];
          const ownStudent = studentList.find((s: any) => s.person?.email === user?.username);
          if (ownStudent) {
            setResolvedStudentId(ownStudent.student_id);
          }
        })
        .catch(() => {});
    }
  }, [canManage, user?.username]);

  /* ── Sub-components ─────────────────────────────────────────────────────── */

  function OverviewTab() {
    if (!stats) return <div className="loading-spinner" />;
    const cards = [
      { label: 'Companies', value: stats.total_companies, color: '#1d4ed8' },
      { label: 'Total Drives', value: stats.total_drives, color: '#1e40af' },
      { label: 'Open Drives', value: stats.open_drives, color: '#15803d' },
      { label: 'Applications', value: stats.total_applications, color: '#b45309' },
      { label: 'Offers Made', value: stats.total_offers, color: '#1d4ed8' },
      { label: 'Offers Accepted', value: stats.accepted_offers, color: '#15803d' },
    ];
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
          {cards.map(c => (
            <div key={c.label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{c.label}</div>
            </div>
          ))}
        </div>

        {(stats.avg_package_lpa || stats.highest_package_lpa) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
            <div style={{ background: 'var(--color-primary-light)', border: '1px solid var(--color-primary-border)', borderRadius: 6, padding: '24px 28px', color: 'var(--color-text-primary)' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Average Package</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800 }}>₹ {stats.avg_package_lpa?.toFixed(2)} LPA</div>
            </div>
            <div style={{ background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)', borderRadius: 6, padding: '24px 28px', color: 'var(--color-text-primary)' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Highest Package</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800 }}>₹ {stats.highest_package_lpa?.toFixed(2)} LPA</div>
            </div>
          </div>
        )}

        {/* Live Placement Recruiting Funnel */}
        {(() => {
          const applied = Math.max(applications.length, stats.total_applications);
          let shortlisted = applications.filter(a => ['Shortlisted', 'Interview', 'Offered', 'Accepted'].includes(a.status)).length;
          let interview = applications.filter(a => ['Interview', 'Offered', 'Accepted'].includes(a.status)).length;
          let offered = Math.max(stats.total_offers, applications.filter(a => ['Offered', 'Accepted'].includes(a.status)).length);
          let accepted = stats.accepted_offers;

          // Enforce monotonic funnel constraints
          shortlisted = Math.min(shortlisted, applied);
          interview = Math.min(interview, shortlisted);
          offered = Math.min(offered, interview);
          accepted = Math.min(accepted, offered);

          const funnelStages = [
            { name: 'Applied', count: applied, desc: 'Registered for job drives', color: '#3b82f6', gradId: 'funnelBlue' },
            { name: 'Shortlisted', count: shortlisted, desc: 'Cleared initial screening', color: '#8b5cf6', gradId: 'funnelPurple' },
            { name: 'Interview', count: interview, desc: 'Technical & HR rounds', color: '#f59e0b', gradId: 'funnelOrange' },
            { name: 'Offered', count: offered, desc: 'Received employment offers', color: '#10b981', gradId: 'funnelEmerald' },
            { name: 'Accepted', count: accepted, desc: 'Officially accepted offers', color: '#22c55e', gradId: 'funnelGreen' },
          ];

          return (
            <div className="card" style={{ marginBottom: 32, position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ margin: 0, color: 'var(--text)' }}>Recruitment Pipeline Funnel</h3>
                <span style={{ fontSize: '0.78rem', background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>Real-time Analysis</span>
              </div>

              {hoveredStage !== null && (
                <div style={{
                  position: 'absolute',
                  top: '20px',
                  right: '24px',
                  background: 'var(--card)',
                  border: `1px solid ${funnelStages[hoveredStage].color}`,
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '0.82rem',
                  color: 'var(--text)',
                  pointerEvents: 'none',
                  zIndex: 10,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                  animation: 'fadeIn 0.2s ease both',
                  maxWidth: '240px'
                }}>
                  <strong style={{ color: funnelStages[hoveredStage].color }}>{funnelStages[hoveredStage].name}</strong>: {funnelStages[hoveredStage].count} candidates
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4 }}>{funnelStages[hoveredStage].desc}</div>
                </div>
              )}

              <div style={{ width: '100%', overflowX: 'auto', marginTop: 16 }}>
                <svg viewBox="0 0 600 170" style={{ width: '100%', minWidth: '550px', height: 'auto', display: 'block' }}>
                  <defs>
                    <linearGradient id="funnelBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#1d4ed8" />
                    </linearGradient>
                    <linearGradient id="funnelPurple" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#6d28d9" />
                    </linearGradient>
                    <linearGradient id="funnelOrange" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#b45309" />
                    </linearGradient>
                    <linearGradient id="funnelEmerald" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#047857" />
                    </linearGradient>
                    <linearGradient id="funnelGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" />
                      <stop offset="100%" stopColor="#15803d" />
                    </linearGradient>
                  </defs>

                  {funnelStages.map((st, i) => {
                    const w = 90;
                    const gap = 14;
                    const x_offset = 20;
                    const x = x_offset + i * (w + gap);

                    const y_tops = [10, 25, 37, 46, 52];
                    const y_bottoms = [140, 125, 113, 104, 98];

                    const yt = y_tops[i];
                    const yb = y_bottoms[i];
                    
                    const yt_next = i < 4 ? y_tops[i+1] : y_tops[i];
                    const yb_next = i < 4 ? y_bottoms[i+1] : y_bottoms[i];

                    const points = `${x},${yt} ${x+w},${yt_next} ${x+w},${yb_next} ${x},${yb}`;

                    let convText = '';
                    if (i > 0) {
                      const prevCount = funnelStages[i-1].count;
                      const rate = prevCount > 0 ? Math.round((st.count / prevCount) * 100) : 0;
                      convText = `${rate}%`;
                    }

                    const isHovered = hoveredStage === i;
                    const isAnyHovered = hoveredStage !== null;

                    return (
                      <g key={st.name}>
                        <polygon
                          points={points}
                          fill={`url(#${st.gradId})`}
                          style={{
                            cursor: 'pointer',
                            transition: 'all 0.25s ease',
                            opacity: !isAnyHovered || isHovered ? 1 : 0.45,
                            filter: isHovered ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' : 'none',
                          }}
                          onMouseEnter={() => setHoveredStage(i)}
                          onMouseLeave={() => setHoveredStage(null)}
                        />

                        <text
                          x={x + w/2}
                          y={(yt + yb)/2 + 5}
                          textAnchor="middle"
                          fill="#fff"
                          fontSize="13"
                          fontWeight="bold"
                          style={{ pointerEvents: 'none' }}
                        >
                          {st.count}
                        </text>

                        <text
                          x={x + w/2}
                          y="160"
                          textAnchor="middle"
                          fill={isHovered ? 'var(--text)' : 'var(--text-muted)'}
                          fontSize="10"
                          fontWeight={isHovered ? 'bold' : 'normal'}
                          style={{ pointerEvents: 'none' }}
                        >
                          {st.name}
                        </text>

                        {i > 0 && (
                          <g style={{ pointerEvents: 'none' }}>
                            <rect
                              x={x - gap + 1}
                              y={(y_tops[i-1] + y_bottoms[i-1])/2 - 9}
                              width={gap - 2}
                              height="18"
                              fill="var(--bg-primary)"
                              rx="3"
                              style={{ opacity: 0.85 }}
                            />
                            <text
                              x={x - gap/2}
                              y={(y_tops[i-1] + y_bottoms[i-1])/2 + 4}
                              textAnchor="middle"
                              fill="var(--text-muted)"
                              fontSize="8"
                              fontWeight="bold"
                            >
                              {convText}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          );
        })()}

        <h3 style={{ marginBottom: 12, color: 'var(--text)' }}>Open Drives</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          {drives.filter(d => d.status === 'Open').slice(0, 5).map(d => (
            <div key={d.drive_id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text)' }}>{d.drive_title}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{d.company_name} · {d.job_role}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: '#10b981' }}>{fmt_pkg(d.package_lpa)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Deadline: {fmt_date(d.application_deadline)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function CompaniesTab() {
    const [form, setForm] = useState({ company_name: '', industry: '', website: '', contact_person: '', contact_email: '', contact_phone: '', description: '' });
    const handleCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await placementApi.createCompany(form);
        setShowCompanyModal(false);
        showToast('Company registered successfully!');
        loadAll();
      } catch (e: any) { alert(e.message); }
    };
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ color: 'var(--text)', margin: 0 }}>Registered Companies ({companies.length})</h3>
          {canManage && <button id="add-company-btn" className="btn-primary" onClick={() => setShowCompanyModal(true)}>+ Add Company</button>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {companies.map(c => (
            <div key={c.company_id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)' }}>{c.company_name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{c.industry}</div>
                </div>
                {pill(c.status)}
              </div>
              {c.website && <div style={{ fontSize: '0.78rem', color: '#6366f1', marginBottom: 6 }}><a href={c.website} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1' }}>{c.website}</a></div>}
              {c.contact_person && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>👤 {c.contact_person}</div>}
              {c.contact_email && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>✉️ {c.contact_email}</div>}
              {c.description && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.4 }}>{c.description}</div>}
            </div>
          ))}
        </div>

        {showCompanyModal && (
          <div className="modal-overlay" onClick={() => setShowCompanyModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
              <h2>Register Company</h2>
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group"><label>Company Name *</label><input className="form-input" value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} required /></div>
                <div className="form-group"><label>Industry *</label>
                  <select className="form-input" value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))} required>
                    <option value="">Select Industry</option>
                    {['IT / Software', 'Banking & Finance', 'FMCG', 'Core Engineering', 'Consulting', 'E-Commerce', 'Healthcare', 'Education', 'Manufacturing', 'Other'].map(i => <option key={i}>{i}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Website</label><input className="form-input" value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://" /></div>
                <div className="form-group"><label>Contact Person</label><input className="form-input" value={form.contact_person} onChange={e => setForm(p => ({ ...p, contact_person: e.target.value }))} /></div>
                <div className="form-group"><label>Contact Email</label><input className="form-input" type="email" value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} /></div>
                <div className="form-group"><label>Contact Phone</label><input className="form-input" value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} /></div>
                <div className="form-group"><label>Description</label><textarea className="form-input" rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
                <div style={{ display: 'flex', gap: 10 }}><button type="submit" className="btn-primary">Register</button><button type="button" className="btn-secondary" onClick={() => setShowCompanyModal(false)}>Cancel</button></div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  function DrivesTab() {
    const [form, setForm] = useState({ company_id: '', drive_title: '', job_role: '', job_type: 'Full-Time', job_location: '', package_lpa: '', stipend_pm: '', min_cgpa: '6.0', backlogs_allowed: '0', eligible_branches: '', description: '', bond_years: '0', drive_date: '', application_deadline: '' });
    const handleCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await placementApi.createDrive({
          ...form,
          package_lpa: form.package_lpa ? parseFloat(form.package_lpa) : undefined,
          stipend_pm: form.stipend_pm ? parseFloat(form.stipend_pm) : undefined,
          min_cgpa: parseFloat(form.min_cgpa),
          backlogs_allowed: parseInt(form.backlogs_allowed),
          bond_years: parseInt(form.bond_years),
          eligible_branches: form.eligible_branches.split(',').map(b => b.trim()).filter(Boolean),
        });
        setShowDriveModal(false);
        showToast('Drive created!');
        loadAll();
      } catch (e: any) { alert(e.message); }
    };

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ color: 'var(--text)', margin: 0 }}>Placement Drives ({drives.length})</h3>
          {canManage && <button id="add-drive-btn" className="btn-primary" onClick={() => setShowDriveModal(true)}>+ Create Drive</button>}
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          {drives.map(d => (
            <div key={d.drive_id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)' }}>{d.drive_title}</span>
                    {pill(d.status)}
                    <span style={{ fontSize: '0.75rem', background: 'var(--surface)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 8 }}>{d.job_type}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6 }}>{d.company_name} · {d.job_role} {d.job_location ? `· 📍 ${d.job_location}` : ''}</div>
                  <div style={{ display: 'flex', gap: 20, fontSize: '0.78rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span>📅 Drive: {fmt_date(d.drive_date)}</span>
                    <span>⏰ Deadline: {fmt_date(d.application_deadline)}</span>
                    <span>📊 Min CGPA: {d.min_cgpa}</span>
                    <span>🚫 Backlogs: {d.backlogs_allowed}</span>
                    {d.bond_years > 0 && <span>📋 Bond: {d.bond_years} yr</span>}
                  </div>
                  {d.eligible_branches.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      {d.eligible_branches.map(b => <span key={b} style={{ background: '#6366f122', color: '#818cf8', border: '1px solid #6366f144', padding: '2px 8px', borderRadius: 8, fontSize: '0.72rem' }}>{b}</span>)}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', minWidth: 120 }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>{fmt_pkg(d.package_lpa) !== '—' ? fmt_pkg(d.package_lpa) : (d.stipend_pm ? `₹${d.stipend_pm}/mo` : '—')}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{d.application_count ?? 0} applicants</div>
                  {canApply && d.status === 'Open' && (
                    <button id={`apply-drive-${d.drive_id}`} className="btn-primary" style={{ marginTop: 10, fontSize: '0.78rem', padding: '6px 16px' }} onClick={() => setShowApplyModal(d)}>Apply Now</button>
                  )}
                  {canManage && d.status === 'Open' && (
                    <button className="btn-secondary" style={{ marginTop: 6, fontSize: '0.75rem', padding: '4px 12px' }} onClick={async () => { await placementApi.closeDrive(d.drive_id); showToast('Drive closed'); loadAll(); }}>Close</button>
                  )}
                  {canManage && (
                    <button id={`eligible-btn-${d.drive_id}`} className="btn-secondary" style={{ marginTop: 6, fontSize: '0.75rem', padding: '4px 12px', width: '100%' }} onClick={() => setSelectedEligibleDrive(d)}>Eligible Candidates</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {showDriveModal && (
          <div className="modal-overlay" onClick={() => setShowDriveModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
              <h2>Create Placement Drive</h2>
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group"><label>Company *</label>
                  <select className="form-input" value={form.company_id} onChange={e => setForm(p => ({ ...p, company_id: e.target.value }))} required>
                    <option value="">Select Company</option>
                    {companies.filter(c => c.status === 'Active').map(c => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Drive Title *</label><input className="form-input" value={form.drive_title} onChange={e => setForm(p => ({ ...p, drive_title: e.target.value }))} required /></div>
                <div className="form-group"><label>Job Role *</label><input className="form-input" value={form.job_role} onChange={e => setForm(p => ({ ...p, job_role: e.target.value }))} required /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group"><label>Job Type</label>
                    <select className="form-input" value={form.job_type} onChange={e => setForm(p => ({ ...p, job_type: e.target.value }))}>
                      {['Full-Time', 'Internship', 'PPO', 'Contractual'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Location</label><input className="form-input" value={form.job_location} onChange={e => setForm(p => ({ ...p, job_location: e.target.value }))} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div className="form-group"><label>Package (LPA)</label><input className="form-input" type="number" step="0.01" value={form.package_lpa} onChange={e => setForm(p => ({ ...p, package_lpa: e.target.value }))} /></div>
                  <div className="form-group"><label>Stipend/mo</label><input className="form-input" type="number" value={form.stipend_pm} onChange={e => setForm(p => ({ ...p, stipend_pm: e.target.value }))} /></div>
                  <div className="form-group"><label>Bond (years)</label><input className="form-input" type="number" value={form.bond_years} onChange={e => setForm(p => ({ ...p, bond_years: e.target.value }))} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group"><label>Min CGPA</label><input className="form-input" type="number" step="0.01" value={form.min_cgpa} onChange={e => setForm(p => ({ ...p, min_cgpa: e.target.value }))} /></div>
                  <div className="form-group"><label>Max Backlogs</label><input className="form-input" type="number" value={form.backlogs_allowed} onChange={e => setForm(p => ({ ...p, backlogs_allowed: e.target.value }))} /></div>
                </div>
                <div className="form-group"><label>Eligible Branches (comma-separated, e.g. CS,EC,ME)</label><input className="form-input" value={form.eligible_branches} onChange={e => setForm(p => ({ ...p, eligible_branches: e.target.value }))} placeholder="CS, EC, ME, IT" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group"><label>Drive Date *</label><input className="form-input" type="date" value={form.drive_date} onChange={e => setForm(p => ({ ...p, drive_date: e.target.value }))} required /></div>
                  <div className="form-group"><label>Application Deadline *</label><input className="form-input" type="date" value={form.application_deadline} onChange={e => setForm(p => ({ ...p, application_deadline: e.target.value }))} required /></div>
                </div>
                <div className="form-group"><label>Description</label><textarea className="form-input" rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
                <div style={{ display: 'flex', gap: 10 }}><button type="submit" className="btn-primary">Create Drive</button><button type="button" className="btn-secondary" onClick={() => setShowDriveModal(false)}>Cancel</button></div>
              </form>
            </div>
          </div>
        )}

        {showApplyModal && (
          <div className="modal-overlay" onClick={() => setShowApplyModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
              <h2>Apply to Drive</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>You are applying to <strong>{showApplyModal.drive_title}</strong> at {showApplyModal.company_name}.</p>
              {canManage ? (
                <div>
                  <div className="form-group"><label>Select Student</label>
                    <select id="apply-student-select" className="form-input">
                      <option value="">Select student</option>
                      {students.map(s => <option key={s.student_id} value={s.student_id}>{s.full_name} ({s.roll_number})</option>)}
                    </select>
                  </div>
                  <button id="confirm-apply-btn" className="btn-primary" onClick={async () => {
                    const sel = (document.getElementById('apply-student-select') as HTMLSelectElement).value;
                    if (!sel) return alert('Select a student');
                    try { await placementApi.apply({ drive_id: showApplyModal.drive_id, student_id: sel }); setShowApplyModal(null); showToast('Applied!'); loadAll(); } catch (e: any) { alert(e.message); }
                  }}>Confirm Application</button>
                </div>
              ) : (
                <button id="confirm-apply-btn" className="btn-primary" onClick={async () => {
                  try { await placementApi.apply({ drive_id: showApplyModal.drive_id, student_id: resolvedStudentId || user?.user_id || '' }); setShowApplyModal(null); showToast('Applied successfully!'); loadAll(); } catch (e: any) { alert(e.message); }
                }}>Confirm — Apply Now</button>
              )}
              <button className="btn-secondary" style={{ marginTop: 10 }} onClick={() => setShowApplyModal(null)}>Cancel</button>
            </div>
          </div>
        )}

        {selectedEligibleDrive && (
          <div className="modal-overlay" onClick={() => setSelectedEligibleDrive(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 750, width: '90%' }}>
              <h2>Eligible Candidates</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
                Roster for <strong>{selectedEligibleDrive.drive_title}</strong> at {selectedEligibleDrive.company_name}
              </p>
              <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 20, background: 'var(--surface)', padding: '10px 14px', borderRadius: 8, flexWrap: 'wrap' }}>
                <span>🎯 Min CGPA: {selectedEligibleDrive.min_cgpa}</span>
                <span>🚫 Max Backlogs: {selectedEligibleDrive.backlogs_allowed}</span>
                <span>🏢 Branches: {selectedEligibleDrive.eligible_branches.join(', ') || 'All'}</span>
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  className="form-input"
                  style={{ flex: 1, minWidth: 200, margin: 0 }}
                  placeholder="🔍 Search candidate by name or branch..."
                  value={eligibleSearch}
                  onChange={e => setEligibleSearch(e.target.value)}
                />
                <button
                  className="btn-primary"
                  style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => {
                    const headers = ['Roll Number', 'Full Name', 'Email', 'Phone', 'Branch Code', 'Branch Name', 'CGPA', 'Backlogs', 'Applied Status'];
                    const rows = eligibleStudents.map(s => [
                      s.roll_number || '',
                      s.student_name || '',
                      s.email || '',
                      s.phone || '',
                      s.branch_code || '',
                      s.branch_name || '',
                      s.cgpa || '0.0',
                      s.backlogs_count !== undefined ? s.backlogs_count.toString() : '0',
                      s.applied ? 'Applied' : 'Not Applied'
                    ]);
                    const blob = new Blob([
                      [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n')
                    ], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.setAttribute("href", url);
                    link.setAttribute("download", `eligible_candidates_${selectedEligibleDrive.drive_title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.csv`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  disabled={eligibleStudents.length === 0}
                >
                  📥 Export CSV
                </button>
              </div>

              {loadingEligible ? (
                <div className="loading-spinner" style={{ margin: '40px auto' }} />
              ) : (
                <div style={{ overflowX: 'auto', maxHeight: 350, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>Roll No</th>
                        <th style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>Name</th>
                        <th style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>Branch</th>
                        <th style={{ padding: '12px 14px', color: 'var(--text-secondary)', textAlign: 'center' }}>CGPA</th>
                        <th style={{ padding: '12px 14px', color: 'var(--text-secondary)', textAlign: 'center' }}>Backlogs</th>
                        <th style={{ padding: '12px 14px', color: 'var(--text-secondary)', textAlign: 'right' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eligibleStudents
                        .filter(s => {
                          const q = eligibleSearch.toLowerCase().trim();
                          if (!q) return true;
                          return (s.student_name || '').toLowerCase().includes(q)
                            || (s.roll_number || '').toLowerCase().includes(q)
                            || (s.branch_code || '').toLowerCase().includes(q)
                            || (s.branch_name || '').toLowerCase().includes(q);
                        })
                        .map(s => (
                          <tr key={s.student_id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600 }}>{s.roll_number || '—'}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <div>{s.student_name}</div>
                              {s.email && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.email}</div>}
                            </td>
                            <td style={{ padding: '10px 14px' }}>{s.branch_code || '—'}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>{s.cgpa || '—'}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <span style={{ color: s.backlogs_count > 0 ? '#ef4444' : 'var(--text-secondary)', fontWeight: s.backlogs_count > 0 ? 600 : 400 }}>
                                {s.backlogs_count}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                              {s.applied ? (
                                <span style={{ background: '#10b98122', color: '#10b981', border: '1px solid #10b98144', padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600 }}>Applied</span>
                              ) : (
                                <span style={{ background: '#6b728022', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem' }}>Not Applied</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      {eligibleStudents.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ padding: '30px 14px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No students meet the eligibility criteria for this drive.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                <button className="btn-secondary" onClick={() => setSelectedEligibleDrive(null)}>Close Roster</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function ApplicationsTab() {
    return (
      <div>
        <h3 style={{ color: 'var(--text)', marginBottom: 20 }}>{canManage ? `All Applications (${applications.length})` : `My Applications (${applications.length})`}</h3>
        {applications.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No applications found.</p>}
        <div style={{ display: 'grid', gap: 10 }}>
          {applications.map(a => (
            <div key={a.application_id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{a.drive_title} — {a.job_role}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{a.company_name} {a.package_lpa ? `· ${fmt_pkg(a.package_lpa)}` : ''}</div>
                {canManage && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>👤 {a.student_name} ({a.roll_number})</div>}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Applied: {fmt_date(a.applied_at)}</div>
                {a.rejection_reason && <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: 4 }}>Reason: {a.rejection_reason}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                {pill(a.status)}
                {canManage && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['Shortlisted', 'Rejected', 'Interview'].map(s => (
                      <button key={s} style={{ fontSize: '0.7rem', padding: '3px 10px', borderRadius: 8, border: `1px solid ${STATUS_COLOURS[s]}44`, background: STATUS_COLOURS[s] + '22', color: STATUS_COLOURS[s], cursor: 'pointer' }}
                        onClick={async () => { await placementApi.updateApplicationStatus(a.application_id, { status: s }); showToast(`Status updated to ${s}`); loadAll(); }}>
                        {s}
                      </button>
                    ))}
                    {a.status === 'Interview' && (
                      <button style={{ fontSize: '0.7rem', padding: '3px 10px', borderRadius: 8, border: '1px solid #10b98144', background: '#10b98122', color: '#10b981', cursor: 'pointer' }}
                        onClick={() => setShowOfferModal(a)}>Issue Offer</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {showOfferModal && (
          <div className="modal-overlay" onClick={() => setShowOfferModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
              <h2>Issue Offer Letter</h2>
              <p style={{ color: 'var(--text-secondary)' }}>To: <strong>{showOfferModal.student_name}</strong> for {showOfferModal.drive_title}</p>
              {(() => {
                const [pkg, setPkg] = useState('');
                const [join, setJoin] = useState('');
                const [ref, setRef] = useState('');
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                    <div className="form-group"><label>Package (LPA)</label><input className="form-input" type="number" step="0.01" value={pkg} onChange={e => setPkg(e.target.value)} /></div>
                    <div className="form-group"><label>Joining Date</label><input className="form-input" type="date" value={join} onChange={e => setJoin(e.target.value)} /></div>
                    <div className="form-group"><label>Offer Letter Ref</label><input className="form-input" value={ref} onChange={e => setRef(e.target.value)} placeholder="OL-2024-001" /></div>
                    <button className="btn-primary" onClick={async () => {
                      await placementApi.createOffer({ application_id: showOfferModal!.application_id, package_lpa: pkg ? parseFloat(pkg) : undefined, joining_date: join || undefined, offer_letter_ref: ref || undefined });
                      setShowOfferModal(null); showToast('Offer issued!'); loadAll();
                    }}>Issue Offer</button>
                    <button className="btn-secondary" onClick={() => setShowOfferModal(null)}>Cancel</button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    );
  }

  function OffersTab() {
    return (
      <div>
        <h3 style={{ color: 'var(--text)', marginBottom: 20 }}>Offer Letters ({offers.length})</h3>
        {offers.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No offers yet.</p>}
        <div style={{ display: 'grid', gap: 10 }}>
          {offers.map(o => (
            <div key={o.offer_id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{o.student_name} <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>({o.roll_number})</span></div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{o.company_name} — {o.job_role}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Offer Date: {fmt_date(o.offer_date)} {o.joining_date ? ` · Joining: ${fmt_date(o.joining_date)}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981', marginBottom: 6 }}>{fmt_pkg(o.package_lpa)}</div>
                {pill(o.status)}
                {o.status === 'Pending' && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                    <button style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: 8, border: '1px solid #22c55e44', background: '#22c55e22', color: '#22c55e', cursor: 'pointer' }}
                      onClick={async () => { await placementApi.updateOfferStatus(o.offer_id, { status: 'Accepted' }); showToast('Offer accepted!'); loadAll(); }}>Accept</button>
                    <button style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: 8, border: '1px solid #ef444444', background: '#ef444422', color: '#ef4444', cursor: 'pointer' }}
                      onClick={async () => { await placementApi.updateOfferStatus(o.offer_id, { status: 'Declined' }); showToast('Offer declined'); loadAll(); }}>Decline</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'companies', label: 'Companies', icon: '🏢' },
    { id: 'drives', label: 'Drives', icon: '📋' },
    { id: 'applications', label: canManage ? 'Applications' : 'My Applications', icon: '📨' },
    ...(canManage ? [{ id: 'offers' as Tab, label: 'Offers', icon: '🎁' }] : []),
  ];

  return (
    <div className="page-container">
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, background: '#10b981', color: '#fff', padding: '12px 24px', borderRadius: 12, zIndex: 9999, fontWeight: 600, boxShadow: '0 4px 20px rgba(16,185,129,0.4)' }}>{toast}</div>}

      <div className="page-header">
        <div>
          <h1 className="page-title">🎯 Placement & Careers</h1>
          <p className="page-subtitle">Campus Recruitment · Offer Letters · Career Management</p>
        </div>
      </div>

      {error && <div style={{ background: '#ef444422', border: '1px solid #ef4444', borderRadius: 10, padding: '12px 16px', color: '#ef4444', marginBottom: 20 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 6, marginBottom: 28, background: 'var(--surface)', padding: 6, borderRadius: 14, width: 'fit-content', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} id={`tab-placement-${t.id}`} onClick={() => setTab(t.id)}
            style={{ padding: '8px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s', background: tab === t.id ? 'var(--card)' : 'transparent', color: tab === t.id ? 'var(--text)' : 'var(--text-muted)', boxShadow: tab === t.id ? '0 2px 8px rgba(0,0,0,0.15)' : 'none' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="loading-spinner" /> : (
        <>
          {tab === 'overview' && <OverviewTab />}
          {tab === 'companies' && <CompaniesTab />}
          {tab === 'drives' && <DrivesTab />}
          {tab === 'applications' && <ApplicationsTab />}
          {tab === 'offers' && <OffersTab />}
        </>
      )}
    </div>
  );
}
