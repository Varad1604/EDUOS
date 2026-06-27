import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { financeApi } from '../api';
import { usePermissions } from '../hooks/usePermissions';

interface AuditLog {
  event_id: string;
  event_type: string;
  aggregate_id: string;
  aggregate_type: string | null;
  event_payload: Record<string, unknown>;
  created_at: string;
  username: string | null;
}

export default function AuditLogs() {
  const { isAdmin } = usePermissions();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Enforce access control
  if (!isAdmin) {
    return (
      <>
        <Header title="Audit Logs" subtitle="Access denied" />
        <div className="page fade-in">
          <div className="empty-state">
            <div className="empty-state-icon">🔒</div>
            <h3>Access Denied</h3>
            <p>The system audit log module is restricted to administrators and registrars.</p>
          </div>
        </div>
      </>
    );
  }

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await financeApi.reports.auditLogs();
      setLogs(res.data.data ?? []);
    } catch {
      setError('Failed to fetch system audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    return (
      log.event_type.toLowerCase().includes(term) ||
      (log.username && log.username.toLowerCase().includes(term)) ||
      (log.aggregate_type && log.aggregate_type.toLowerCase().includes(term)) ||
      log.aggregate_id.toLowerCase().includes(term)
    );
  });

  const getEventBadgeClass = (type: string) => {
    if (type.includes('Created') || type.includes('Enrolled') || type.includes('Admitted')) {
      return 'badge-success';
    }
    if (type.includes('Payment') || type.includes('Fee') || type.includes('Scholarship')) {
      return 'badge-primary';
    }
    if (type.includes('Approved') || type.includes('Published') || type.includes('Posted')) {
      return 'badge-success';
    }
    if (type.includes('Failed') || type.includes('Detained') || type.includes('Rejected') || type.includes('Denied')) {
      return 'badge-danger';
    }
    return 'badge-warning';
  };

  return (
    <>
      <Header title="System Audit Logs" subtitle="Immutable event sourcing ledger logs" />
      <div className="page fade-in">
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1>Immutable Audit Trail</h1>
            <p>View all raw events, state changes, and administrative actions.</p>
          </div>
          <button className="btn btn-secondary" onClick={fetchLogs} disabled={loading}>
            {loading ? 'Refreshing...' : '🔄 Refresh Log'}
          </button>
        </div>

        {error && <div className="login-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <input
                className="form-input"
                placeholder="🔍 Search logs by event type, operator, aggregate, ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Showing {filteredLogs.length} of {logs.length} logged actions
            </div>
          </div>
        </div>

        <div className="grid-3" style={{ gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          {/* Logs List Table */}
          <div className="card">
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading audit trail…</div>
            ) : filteredLogs.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No audit events match your search.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Event Type</th>
                      <th>Aggregate</th>
                      <th>Operator</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map(log => (
                      <tr
                        key={log.event_id}
                        onClick={() => setSelectedLog(log)}
                        style={{
                          cursor: 'pointer',
                          background: selectedLog?.event_id === log.event_id ? 'rgba(var(--accent-primary-rgb), 0.08)' : 'transparent',
                        }}
                      >
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td>
                          <span className={`badge ${getEventBadgeClass(log.event_type)}`}>
                            {log.event_type}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                            {log.aggregate_type ?? 'Generic'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                          {log.username ?? 'System / Saga'}
                        </td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedLog(log)}>
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payload Inspector Sidebar */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignSelf: 'start' }}>
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>Event Payload Inspector</h3>
            {selectedLog ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="form-label" style={{ marginBottom: '0.25rem' }}>Event ID</label>
                  <code style={{ fontSize: '0.8rem', background: 'var(--bg-card-hover)', padding: '0.25rem 0.5rem', borderRadius: 4, display: 'block' }}>
                    {selectedLog.event_id}
                  </code>
                </div>
                <div className="grid-2">
                  <div>
                    <label className="form-label" style={{ marginBottom: '0.25rem' }}>Aggregate Type</label>
                    <div style={{ fontWeight: 600 }}>{selectedLog.aggregate_type ?? 'N/A'}</div>
                  </div>
                  <div>
                    <label className="form-label" style={{ marginBottom: '0.25rem' }}>Operator</label>
                    <div style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{selectedLog.username ?? 'System / Saga'}</div>
                  </div>
                </div>
                <div>
                  <label className="form-label" style={{ marginBottom: '0.25rem' }}>Target ID (Aggregate ID)</label>
                  <code style={{ fontSize: '0.8rem', background: 'var(--bg-card-hover)', padding: '0.25rem 0.5rem', borderRadius: 4, display: 'block' }}>
                    {selectedLog.aggregate_id}
                  </code>
                </div>
                <div>
                  <label className="form-label" style={{ marginBottom: '0.25rem' }}>Payload JSON</label>
                  <pre style={{
                    fontSize: '0.8rem',
                    background: 'var(--bg-card-hover)',
                    padding: '0.75rem',
                    borderRadius: 6,
                    overflow: 'auto',
                    maxHeight: '300px',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                  }}>
                    {JSON.stringify(selectedLog.event_payload, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Select a log row from the list to inspect its metadata and event payload details.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
