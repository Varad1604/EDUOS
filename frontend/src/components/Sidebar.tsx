import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';

// ─────────────────────────────────────────────────────────────────────────────
// Nav item definition: each item declares which permission gates it.
// The Sidebar renders only items the current role holds the permission for.
// ─────────────────────────────────────────────────────────────────────────────
interface NavItem {
  icon: string;
  label: string;
  path: string;
  permission?: string;   // if undefined = always visible (e.g. Dashboard)
}

const NAV: { section: string; items: NavItem[] }[] = [
  { section: 'Overview', items: [
    { icon: '📊', label: 'Dashboard',    path: '/' },
  ]},
  { section: 'Academics', items: [
    { icon: '👥', label: 'Students',     path: '/students',    permission: 'students.viewAll OR students.viewOwn' },
    { icon: '📚', label: 'Courses',      path: '/courses',     permission: 'courses.viewAll OR courses.viewOwn' },
    { icon: '📅', label: 'Timetable',    path: '/timetable',   permission: 'timetable.view' },
    { icon: '✅', label: 'Attendance',   path: '/attendance',  permission: 'attendance.mark OR attendance.viewAll OR attendance.viewOwn' },
    { icon: '📖', label: 'Library',      path: '/library',     permission: 'library.manage OR library.viewOwn' },
    { icon: '🏢', label: 'Hostel',       path: '/hostel',      permission: 'hostel.manage OR hostel.viewOwn' },
    { icon: '🚌', label: 'Transport',    path: '/transport',   permission: 'transport.manage OR transport.viewOwn' },
  ]},
  { section: 'Examinations', items: [
    { icon: '📝', label: 'Exams',        path: '/exams',        permission: 'exams.schedule OR exams.viewAll' },
    { icon: '🎫', label: 'Hall Tickets', path: '/hall-tickets', permission: 'halltickets.generate OR halltickets.viewOwn' },
    { icon: '🏆', label: 'Results',      path: '/results',      permission: 'results.viewAll OR results.viewOwn' },
  ]},
  { section: 'Finance', items: [
    { icon: '💰', label: 'Fees',         path: '/fees',         permission: 'fees.viewAll OR fees.viewOwn' },
    { icon: '🎓', label: 'Scholarships', path: '/scholarships', permission: 'scholarships.viewAll OR scholarships.viewOwn' },
    { icon: '📒', label: 'Accounts',     path: '/accounts',     permission: 'accounts.viewAll' },
    { icon: '📈', label: 'Reports',      path: '/reports',      permission: 'reports.view' },
    { icon: '🛡️', label: 'Audit Logs',   path: '/audit-logs',   permission: 'reports.view' },
  ]},
  { section: 'Campus Life', items: [
    { icon: '🎯', label: 'Placement',    path: '/placement',    permission: 'placement.manage OR placement.apply OR placement.view' },
    { icon: '🏥', label: 'Medical',      path: '/medical',      permission: 'medical.manage OR medical.view' },
  ]},
];

// Role badge colours
const ROLE_COLOURS: Record<string, string> = {
  Principal:  'rgba(99,102,241,0.2)',
  Registrar:  'rgba(139,92,246,0.2)',
  FeeManager: 'rgba(16,185,129,0.2)',
  Faculty:    'rgba(245,158,11,0.2)',
  Student:    'rgba(59,130,246,0.2)',
};

export default function Sidebar() {
  const { user, clearAuth } = useAuthStore();
  const { granted, role, isAdmin } = usePermissions();
  const nav = useNavigate();
  const loc = useLocation();

  // Check if a nav item should be shown
  const isVisible = (item: NavItem): boolean => {
    if (item.path === '/audit-logs') return isAdmin;
    if (!item.permission) return true;                // no gate = always show
    // Support "OR" logic: "perm.a OR perm.b"
    return item.permission.split(' OR ').some(p => granted.includes(p as never));
  };

  const isActive = (path: string) =>
    path === '/' ? loc.pathname === '/' : loc.pathname.startsWith(path);

  const filteredNav = NAV.map(section => ({
    ...section,
    items: section.items.filter(isVisible),
  })).filter(s => s.items.length > 0);

  const roleBg = ROLE_COLOURS[role] ?? 'rgba(255,255,255,0.05)';

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">🎓</div>
        <div>
          <div className="logo-text">EduOS</div>
          <div className="logo-sub">Management System</div>
        </div>
      </div>

      {/* Role badge */}
      <div style={{ margin: '0 1rem 1rem', padding: '0.5rem 0.75rem', background: roleBg, borderRadius: 8, fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
        {role} Access
      </div>

      {filteredNav.map(section => (
        <div key={section.section} className="sidebar-section">
          <div className="sidebar-section-label">{section.section}</div>
          {section.items.map(item => (
            <div
              key={item.path}
              id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => nav(item.path)}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>
      ))}

      <div className="sidebar-bottom">
        <div className="user-chip">
          <div className="user-avatar">{user?.username?.[0]?.toUpperCase() ?? 'U'}</div>
          <div className="user-info">
            <div className="user-name">{user?.username ?? 'User'}</div>
            <div className="user-role" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{user?.role_name ?? 'Role'}</div>
          </div>
          <button
            id="logout-btn"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', padding: '0.25rem' }}
            onClick={() => { clearAuth(); nav('/login'); }}
            title="Logout"
          >⎋</button>
        </div>
      </div>
    </aside>
  );
}
