

interface HeaderProps { title: string; subtitle?: string; }

export default function Header({ title, subtitle }: HeaderProps) {
  const now = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });

  return (
    <header className="header">
      <div className="header-left">
        <div>
          <div className="header-title">{title}</div>
          {subtitle && <div className="header-breadcrumb">{subtitle}</div>}
        </div>
      </div>
      <div className="header-right">
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{now}</span>
        <div className="header-badge">
          <span>🔔</span>
          <span className="badge-dot" />
        </div>
        <div className="header-badge">
          <span>⚙️</span>
        </div>
      </div>
    </header>
  );
}
