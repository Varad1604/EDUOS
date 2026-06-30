import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';

interface NavItem {
  label: string;
  path: string;
  permission?: string;   // if undefined = always visible
}

const NAV: { section: string; items: NavItem[] }[] = [
  { section: 'Overview', items: [
    { label: 'Dashboard',     path: '/' },
    { label: 'Notifications', path: '/notifications' },
  ]},
  { section: 'Academics', items: [
    { label: 'Students',     path: '/students',    permission: 'students.read' },
    { label: 'Faculty',      path: '/faculty',     permission: 'courses.read' },
    { label: 'Courses',      path: '/courses',     permission: 'courses.read' },
    { label: 'Quizzes',      path: '/quizzes',     permission: 'courses.read' },
    { label: 'Timetable',    path: '/timetable',   permission: 'courses.read' },
    { label: 'Attendance',   path: '/attendance',  permission: 'attendance.read OR attendance.create' },
    { label: 'Library',      path: '/library',     permission: 'library.manage OR library.view' },
    { label: 'Hostel',       path: '/hostel',      permission: 'hostel.manage OR hostel.view' },
    { label: 'Transport',    path: '/transport',   permission: 'transport.manage OR transport.view' },
  ]},
  { section: 'Examinations', items: [
    { label: 'Exams',        path: '/exams',        permission: 'exams.create OR exams.read' },
    { label: 'Hall Tickets', path: '/hall-tickets', permission: 'exams.create OR exams.read' },
    { label: 'Results',      path: '/results',      permission: 'marks.read' },
  ]},
  { section: 'Finance', items: [
    { label: 'Fees',         path: '/fees',         permission: 'fees.read' },
    { label: 'Scholarships', path: '/scholarships', permission: 'fees.read' },
    { label: 'Accounts',     path: '/accounts',     permission: 'accounts.read' },
    { label: 'Reports',      path: '/reports',      permission: 'reports.read' },
    { label: 'Audit Logs',   path: '/audit-logs',   permission: 'reports.read' },
  ]},
  { section: 'Campus Life', items: [
    { label: 'Leave',        path: '/leave',        permission: 'attendance.read OR attendance.create' },
    { label: 'Placement',    path: '/placement',    permission: 'placement.manage OR placement.apply OR placement.view' },
    { label: 'Medical',      path: '/medical',      permission: 'medical.manage OR medical.view' },
  ]},
];

// Helper to render clean SVG icons instead of emojis
function SidebarIcon({ label }: { label: string }) {
  const size = 16;
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "icon"
  };

  switch (label) {
    case 'Dashboard':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      );
    case 'Students':
      return (
        <svg {...props}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'Faculty':
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'Courses':
      return (
        <svg {...props}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case 'Timetable':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'Attendance':
      return (
        <svg {...props}>
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case 'Leave':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'Library':
      return (
        <svg {...props}>
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      );
    case 'Hostel':
      return (
        <svg {...props}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case 'Transport':
      return (
        <svg {...props}>
          <rect x="1" y="3" width="22" height="13" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
          <circle cx="6" cy="19" r="2" />
          <circle cx="18" cy="19" r="2" />
        </svg>
      );
    case 'Exams':
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case 'Hall Tickets':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="8" y1="14" x2="8" y2="16" />
          <line x1="12" y1="14" x2="16" y2="14" />
        </svg>
      );
    case 'Results':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'Fees':
      return (
        <svg {...props}>
          <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
          <path d="M12 6v8" />
        </svg>
      );
    case 'Scholarships':
      return (
        <svg {...props}>
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
        </svg>
      );
    case 'Accounts':
      return (
        <svg {...props}>
          <rect x="2" y="3" width="20" height="18" rx="2" ry="2" />
          <line x1="12" y1="3" x2="12" y2="21" />
        </svg>
      );
    case 'Reports':
      return (
        <svg {...props}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case 'Audit Logs':
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'Placement':
      return (
        <svg {...props}>
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case 'Medical':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      );
    case 'Quizzes':
      return (
        <svg {...props}>
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case 'Notifications':
      return (
        <svg {...props}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
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

export default function Sidebar() {
  const { user, clearAuth } = useAuthStore();
  const { granted, role, isAdmin, isStudent, isFaculty } = usePermissions();
  const nav = useNavigate();
  const loc = useLocation();

  // Faculty: pages they should NEVER see (no exams/library/medical/finance for teaching staff)
  const FACULTY_BLOCKED = ['/exams', '/hall-tickets', '/results', '/library', '/medical', '/fees', '/scholarships', '/accounts', '/reports', '/audit-logs'];

  // Students: pages they should NEVER see
  const STUDENT_BLOCKED = ['/leave', '/faculty'];

  const isVisible = (item: NavItem): boolean => {
    if (item.path === '/audit-logs') return isAdmin;

    // Faculty-specific blocks
    if (isFaculty && FACULTY_BLOCKED.includes(item.path)) return false;

    // Student-specific blocks
    if (isStudent && STUDENT_BLOCKED.includes(item.path)) return false;

    if (!item.permission) return true;
    return item.permission.split(' OR ').some(p => granted.includes(p as never));
  };

  const isActive = (path: string) =>
    path === '/' ? loc.pathname === '/' : loc.pathname.startsWith(path);

  const filteredNav = NAV.map(section => ({
    ...section,
    items: section.items.filter(isVisible),
  })).filter(s => s.items.length > 0);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <div className="logo-icon-mark" />
        </div>
        <div>
          <div className="logo-text">EduOS</div>
          <span className="logo-sub">Management System</span>
        </div>
      </div>

      <div className="sidebar-role-badge">
        {role}
      </div>

      <nav className="sidebar-nav">
        {filteredNav.map(section => (
          <div key={section.section} className="sidebar-section">
            <div className="sidebar-section-label">{section.section}</div>
            {section.items.map(item => (
              <button
                key={item.path}
                id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
                onClick={() => nav(item.path)}
              >
                <SidebarIcon label={item.label} />
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="user-chip">
          <div className="user-avatar">{user?.username?.[0]?.toUpperCase() ?? 'U'}</div>
          <div className="user-info">
            <div className="user-name">{user?.username ?? 'User'}</div>
            <div className="user-role">{user?.role_name ?? 'Role'}</div>
          </div>
          <button
            id="logout-btn"
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer', 
              color: 'var(--color-text-muted)', 
              fontSize: '14px', 
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={() => { clearAuth(); nav('/login'); }}
            title="Logout"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
