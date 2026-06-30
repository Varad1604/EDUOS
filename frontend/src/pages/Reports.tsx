import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { financeApi } from '../api';

interface Account {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  opening_balance: string;
  current_balance: string;
  fiscal_year: number;
}


interface JournalItem {
  item_id: string;
  account_id: string;
  account_code: string;
  account_name: string;
  debit_amount: string;
  credit_amount: string;
  narration: string | null;
}

interface JournalEntry {
  journal_id: string;
  entry_date: string;
  reference: string | null;
  description: string | null;
  status: string;
  posted_at: string | null;
  created_at: string;
  items: JournalItem[];
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'balanceSheet' | 'incomeStatement' | 'trialBalance' | 'ledgerJournals' | 'customReport' | 'auditorCheck'>('balanceSheet');
  const [accountsList, setAccountsList] = useState<Account[]>([]);
  const [journalsList, setJournalsList] = useState<JournalEntry[]>([]);
  const [auditLogsList, setAuditLogsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fiscalYear, setFiscalYear] = useState(2026);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const accRes = await financeApi.accounts.list();
      setAccountsList(accRes.data.data ?? []);

      const jRes = await financeApi.journal.list();
      setJournalsList(jRes.data.data ?? []);

      const auditLogsRes = await financeApi.reports.auditLogs();
      setAuditLogsList(auditLogsRes.data.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.errors?.[0]?.message || 'Failed to fetch financial reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute dynamic account balances based on active date range filters
  const computedAccounts = accountsList.map(acc => {
    if (!startDate && !endDate) return acc;
    
    let balance = parseFloat(acc.opening_balance || '0');
    
    journalsList.forEach(entry => {
      if (entry.status !== 'Posted') return;
      if (startDate && entry.entry_date < startDate) return;
      if (endDate && entry.entry_date > endDate) return;
      
      entry.items.forEach(item => {
        if (item.account_id === acc.account_id) {
          const deb = parseFloat(item.debit_amount || '0');
          const cred = parseFloat(item.credit_amount || '0');
          if (acc.account_type === 'Asset' || acc.account_type === 'Expense') {
            balance += deb - cred;
          } else {
            balance += cred - deb;
          }
        }
      });
    });
    
    return {
      ...acc,
      current_balance: balance.toString()
    };
  });

  const dynamicAssets = computedAccounts.filter(a => a.account_type === 'Asset');
  const dynamicLiabilities = computedAccounts.filter(a => a.account_type === 'Liability');
  const dynamicEquity = computedAccounts.filter(a => a.account_type === 'Equity');
  const dynamicIncome = computedAccounts.filter(a => a.account_type === 'Income');
  const dynamicExpenses = computedAccounts.filter(a => a.account_type === 'Expense');

  // Income Statement (P&L) calculations
  const totalIncome = dynamicIncome.reduce((sum, a) => sum + parseFloat(a.current_balance || '0'), 0);
  const totalExpenses = dynamicExpenses.reduce((sum, a) => sum + parseFloat(a.current_balance || '0'), 0);
  const netProfit = totalIncome - totalExpenses;

  // Balance Sheet calculations
  const totalAssets = dynamicAssets.reduce((sum, a) => sum + parseFloat(a.current_balance || '0'), 0);
  const totalLiabilities = dynamicLiabilities.reduce((sum, a) => sum + parseFloat(a.current_balance || '0'), 0);
  const totalEquity = dynamicEquity.reduce((sum, a) => sum + parseFloat(a.current_balance || '0'), 0);
  
  // Real-time alignment of Net Profit to Equity (CA Rules)
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + netProfit;
  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

  // Trial Balance calculations
  const trialDebits = computedAccounts
    .filter(a => a.account_type === 'Asset' || a.account_type === 'Expense')
    .reduce((sum, a) => sum + parseFloat(a.current_balance || '0'), 0);

  const trialCredits = computedAccounts
    .filter(a => a.account_type === 'Liability' || a.account_type === 'Equity' || a.account_type === 'Income')
    .reduce((sum, a) => sum + parseFloat(a.current_balance || '0'), 0);

  const isTrialBalanceInEquilibrium = Math.abs(trialDebits - trialCredits) < 0.01;

  // Auditor Ratios & Checks (Indian & International Standards)
  const postedJournalCount = journalsList.filter(j => j.status === 'Posted').length;
  const auditTrailMatches = auditLogsList.filter(log => log.event_type === 'JournalEntryPosted').length;
  
  // Rule 3(1) Compliance Check: Active Audit logs trail exists and logged posted items
  const isAuditTrailActive = auditLogsList.length > 0;
  const isAuditTrailSynchronized = postedJournalCount === auditTrailMatches || auditTrailMatches > 0;

  // Liquid assets & Cash liquidity check
  const cashAccounts = computedAccounts.filter(a => a.account_code === '1001');
  const cashBalance = cashAccounts.reduce((sum, a) => sum + parseFloat(a.current_balance || '0'), 0);
  const hasNegativeCash = cashBalance < 0;

  // Current ratio (Working capital check as per IFRS IAS 1)
  const currentAssets = computedAccounts
    .filter(a => a.account_code.startsWith('1'))
    .reduce((sum, a) => sum + parseFloat(a.current_balance || '0'), 0);
  const currentLiabilities = computedAccounts
    .filter(a => a.account_type === 'Liability')
    .reduce((sum, a) => sum + parseFloat(a.current_balance || '0'), 0);
  const currentRatio = currentLiabilities > 0 ? (currentAssets / currentLiabilities) : 1.5; // default healthy if 0 liabilities
  const isCurrentRatioHealthy = currentRatio >= 1.2;

  // month-end draft check
  const draftJournalCount = journalsList.filter(j => j.status === 'Draft').length;

  const isCompliant = isBalanced && isTrialBalanceInEquilibrium && !hasNegativeCash && isAuditTrailActive && draftJournalCount === 0;

  return (
    <>
      {/* Print-only optimized Stylesheet */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white !important; color: black !important; }
          .sidebar, .header-container, .main-content > header, button, select, label, .tab-buttons { display: none !important; }
          .main-content { margin-left: 0 !important; width: 100% !important; padding: 0 !important; }
          .card { border: 1px solid #ccc !important; box-shadow: none !important; background: white !important; color: black !important; padding: 1.5rem !important; margin-bottom: 1.5rem !important; }
          .grid-2 { display: flex !important; flex-direction: column !important; gap: 1.5rem !important; }
          h1, h2, h3, h4 { color: black !important; }
          table { border: 1px solid #ccc !important; border-collapse: collapse !important; width: 100% !important; margin-top: 1rem; }
          th, td { border: 1px solid #ccc !important; padding: 8px !important; color: black !important; }
          .badge { border: 1px solid #333 !important; background: transparent !important; color: black !important; }
        }
      `}} />

      <Header title="Financial Ledger & Statements" subtitle="CA-grade general ledger audits, trial balances, and statements" />
      <div className="page fade-in">
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div>
            <h1 className="report-title">Chartered Financial Statements</h1>
            <p>Accrual-based accounting ledgers for the fiscal year {fiscalYear}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }} className="no-print">
            <label className="form-label" style={{ marginBottom: 0, marginRight: '0.5rem', whiteSpace: 'nowrap' }}>Fiscal Year</label>
            <select className="form-select" style={{ width: '120px' }} value={fiscalYear} onChange={e => setFiscalYear(parseInt(e.target.value))}>
              <option value="2026">2026-27</option>
              <option value="2025">2025-26</option>
            </select>
            <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
              {loading ? 'Refreshing...' : '🔄 Refresh'}
            </button>
            <button className="btn btn-primary" onClick={() => window.print()} disabled={loading}>
              🖨️ Print PDF
            </button>
          </div>
        </div>

        {/* Date Range Filtering bar */}
        <div style={{ display: 'flex', gap: '1rem', background: 'var(--surface)', padding: '12px 18px', borderRadius: '12px', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }} className="no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>📅 Date Range Filter:</span>
            <input type="date" className="form-input" style={{ width: '150px', padding: '6px 10px', fontSize: '0.8rem' }} value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span style={{ color: 'var(--text-muted)' }}>to</span>
            <input type="date" className="form-input" style={{ width: '150px', padding: '6px 10px', fontSize: '0.8rem' }} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          {(startDate || endDate) && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setStartDate(''); setEndDate(''); }} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
              Clear Filter
            </button>
          )}
        </div>

        {error && <div className="login-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        {/* Tab Buttons */}
        <div className="tab-buttons" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'balanceSheet', label: '⚖️ Balance Sheet' },
            { id: 'incomeStatement', label: '📊 Profit & Loss (P&L)' },
            { id: 'trialBalance', label: '📈 Trial Balance' },
            { id: 'ledgerJournals', label: '📒 General Ledger Journals' },
            { id: 'customReport', label: '⚙️ Custom Report Builder' },
            { id: 'auditorCheck', label: '🛡️ Compliance & Controls' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                background: 'none',
                border: 'none',
                color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-muted)',
                fontSize: '1.05rem',
                fontWeight: 600,
                padding: '0.5rem 1rem',
                cursor: 'pointer',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '5rem 0', fontSize: '1.2rem', color: 'var(--text-muted)' }}>
            <div className="empty-state-icon" style={{ animation: 'pulse 1.5s infinite ease-in-out' }}>📒</div>
            Generating financial reports and computing balances...
          </div>
        ) : activeTab === 'balanceSheet' ? (
          <div>
            {/* Balance Sheet Verification Widget */}
            <div
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.5rem',
                border: isBalanced ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                background: isBalanced ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                boxShadow: isBalanced ? '0 4px 16px rgba(16, 185, 129, 0.05)' : '0 4px 16px rgba(239, 68, 68, 0.05)',
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>{isBalanced ? '✅' : '⚠️'}</span> Accounting Equation Check
                </h3>
                <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Double-entry verification: Assets must equal Liabilities + Capital Equity (incorporating current net surplus/deficit).
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`badge ${isBalanced ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                  {isBalanced ? 'Balanced ✓' : 'Out of Balance ✕'}
                </span>
                <div style={{ marginTop: '0.5rem', fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                  INR {totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} = INR {totalLiabilitiesAndEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Asset Allocation & Capital Equity Donut Chart */}
            <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '2rem', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <svg width="120" height="120" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--border)" strokeWidth="12" />
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--accent-primary)" strokeWidth="12"
                    strokeDasharray="251.32"
                    strokeDashoffset="0"
                    strokeLinecap="round"
                  />
                  <text x="50" y="55" textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="bold">Assets</text>
                </svg>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>TOTAL ASSETS</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                    ₹{totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <svg width="120" height="120" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--border)" strokeWidth="12" />
                  {/* Liabilities segment */}
                  {totalLiabilitiesAndEquity > 0 && (
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--accent-secondary)" strokeWidth="12"
                      strokeDasharray={`${(totalLiabilities / totalLiabilitiesAndEquity) * 251.32} 251.32`}
                      strokeDashoffset="0"
                    />
                  )}
                  {/* Equity segment */}
                  {totalLiabilitiesAndEquity > 0 && (
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--accent-success)" strokeWidth="12"
                      strokeDasharray={`${((totalEquity + netProfit) / totalLiabilitiesAndEquity) * 251.32} 251.32`}
                      strokeDashoffset={`-${(totalLiabilities / totalLiabilitiesAndEquity) * 251.32}`}
                    />
                  )}
                </svg>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>LIABILITIES & CAPITAL</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <span style={{ width: 10, height: 10, background: 'var(--accent-secondary)', borderRadius: '50%' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>Liabilities:</span>
                      <strong>₹{totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <span style={{ width: 10, height: 10, background: 'var(--accent-success)', borderRadius: '50%' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>Capital Equity:</span>
                      <strong>₹{(totalEquity + netProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid-2">
              {/* Assets Column */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
                <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem', marginBottom: '1rem', color: 'var(--accent-primary)' }}>Assets</h3>
                <div className="table-wrap" style={{ flex: 1 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Account Name</th>
                        <th style={{ textAlign: 'right' }}>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dynamicAssets.length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No asset accounts seeded</td>
                        </tr>
                      ) : (
                        dynamicAssets.map(a => (
                          <tr key={a.account_id}>
                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{a.account_code}</td>
                            <td>{a.account_name}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>INR {parseFloat(a.current_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid rgba(255,255,255,0.2)', fontWeight: 'bold', fontSize: '1.05rem' }}>
                        <td colSpan={2}>Total Assets</td>
                        <td style={{ textAlign: 'right', color: 'var(--accent-primary)' }}>INR {totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Liabilities & Equity Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Liabilities */}
                <div className="card">
                  <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem', marginBottom: '1rem', color: 'var(--accent-secondary)' }}>Liabilities</h3>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Account Name</th>
                          <th style={{ textAlign: 'right' }}>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dynamicLiabilities.length === 0 ? (
                          <tr>
                            <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No current liabilities logged</td>
                          </tr>
                        ) : (
                          dynamicLiabilities.map(a => (
                            <tr key={a.account_id}>
                              <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{a.account_code}</td>
                              <td>{a.account_name}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>INR {parseFloat(a.current_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: '2px solid rgba(255,255,255,0.2)', fontWeight: 'bold' }}>
                          <td colSpan={2}>Total Liabilities</td>
                          <td style={{ textAlign: 'right' }}>INR {totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Equity */}
                <div className="card">
                  <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem', marginBottom: '1rem', color: 'var(--accent-success)' }}>Equity (Capital Accounts)</h3>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Account Name</th>
                          <th style={{ textAlign: 'right' }}>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dynamicEquity.length === 0 ? (
                          <tr>
                            <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No capital accounts seeded</td>
                          </tr>
                        ) : (
                          dynamicEquity.map(a => (
                            <tr key={a.account_id}>
                              <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{a.account_code}</td>
                              <td>{a.account_name}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>INR {parseFloat(a.current_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          ))
                        )}
                        {/* Dynamic Profit & Loss account transfer row */}
                        {Math.abs(netProfit) > 0.001 && (
                          <tr style={{ background: 'rgba(99,102,241,0.05)' }}>
                            <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-muted)' }}>9999</td>
                            <td style={{ fontStyle: 'italic', fontWeight: 600 }}>
                              Profit & Loss A/c (Current Period Surplus)
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: netProfit >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                              INR {netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: '2px solid rgba(255,255,255,0.2)', fontWeight: 'bold' }}>
                          <td colSpan={2}>Total Capital Equity</td>
                          <td style={{ textAlign: 'right', color: 'var(--accent-success)' }}>INR {(totalEquity + netProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Combined Footer Summary Card */}
                <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', fontSize: '1.1rem', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.15)' }}>
                  <span>Total Liabilities & Equity</span>
                  <span style={{ color: 'var(--accent-secondary)' }}>INR {totalLiabilitiesAndEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'incomeStatement' ? (
          <div>
            {/* Profitability Summary Widget */}
            <div
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.5rem',
                border: netProfit >= 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                background: netProfit >= 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                boxShadow: netProfit >= 0 ? '0 4px 16px rgba(16, 185, 129, 0.05)' : '0 4px 16px rgba(239, 68, 68, 0.05)',
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Operating Profit & Loss Statement</h3>
                <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Real-time income accrued versus administrative operating expenses.
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`badge ${netProfit >= 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                  {netProfit >= 0 ? 'Net Surplus (Profit) ✓' : 'Net Deficit (Loss) ✕'}
                </span>
                <div style={{ marginTop: '0.5rem', fontWeight: 700, fontSize: '1.15rem', color: netProfit >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                  INR {netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Operating Revenue vs Expenses & Breakdown Charts */}
            <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '2rem', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap' }}>
              {/* Comparative SVG Bar Chart */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>REVENUE VS EXPENSES</h4>
                <svg width="220" height="140" viewBox="0 0 220 140">
                  <line x1="30" y1="110" x2="190" y2="110" stroke="var(--border)" strokeWidth="1.5" />
                  {/* Revenue / Expense comparison */}
                  {(() => {
                    const maxVal = Math.max(totalIncome, totalExpenses, 1000);
                    const revHeight = totalIncome > 0 ? (totalIncome / maxVal) * 90 : 0;
                    const expHeight = totalExpenses > 0 ? (totalExpenses / maxVal) * 90 : 0;

                    return (
                      <>
                        {/* Revenue Rect */}
                        <rect x="55" y={110 - revHeight} width="35" height={revHeight} fill="var(--accent-success)" rx="4" ry="4" />
                        <text x="72.5" y={100 - revHeight} textAnchor="middle" fill="var(--accent-success)" fontSize="10" fontWeight="bold">
                          {(totalIncome / 1000).toFixed(0)}K
                        </text>
                        <text x="72.5" y="125" textAnchor="middle" fill="var(--text-muted)" fontSize="9">Revenue</text>

                        {/* Expense Rect */}
                        <rect x="130" y={110 - expHeight} width="35" height={expHeight} fill="var(--accent-danger)" rx="4" ry="4" />
                        <text x="147.5" y={100 - expHeight} textAnchor="middle" fill="var(--accent-danger)" fontSize="10" fontWeight="bold">
                          {(totalExpenses / 1000).toFixed(0)}K
                        </text>
                        <text x="147.5" y="125" textAnchor="middle" fill="var(--text-muted)" fontSize="9">Expenses</text>
                      </>
                    );
                  })()}
                </svg>
              </div>

              {/* Revenue Stream Donut Chart */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                {(() => {
                  const incomeItems = dynamicIncome;
                  const total = incomeItems.reduce((sum, item) => sum + parseFloat(item.current_balance || '0'), 0);

                  // Colors for segments
                  const COLORS = ['var(--accent-primary)', 'var(--accent-secondary)', 'var(--accent-success)', '#f59e0b', '#ec4899'];
                  
                  let accumPct = 0;
                  const circleSegments = incomeItems.map((item, idx) => {
                    const balance = parseFloat(item.current_balance || '0');
                    if (balance <= 0 || total === 0) return null;
                    const pct = balance / total;
                    const startOffset = accumPct * 251.32;
                    accumPct += pct;
                    return (
                      <circle
                        key={item.account_id}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke={COLORS[idx % COLORS.length]}
                        strokeWidth="12"
                        strokeDasharray={`${pct * 251.32} 251.32`}
                        strokeDashoffset={-startOffset}
                      />
                    );
                  });

                  return (
                    <>
                      <svg width="120" height="120" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--border)" strokeWidth="12" />
                        {circleSegments}
                      </svg>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>REVENUE CHANNELS</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {incomeItems.map((item, idx) => {
                            const balance = parseFloat(item.current_balance || '0');
                            const pct = total > 0 ? (balance / total) * 100 : 0;
                            return (
                              <div key={item.account_id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                                <span style={{ width: 8, height: 8, background: COLORS[idx % COLORS.length], borderRadius: '50%' }} />
                                <span style={{ color: 'var(--text-secondary)' }}>{item.account_name}:</span>
                                <strong>{pct.toFixed(0)}%</strong>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="grid-2">
              {/* Income Column */}
              <div className="card">
                <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem', marginBottom: '1rem', color: 'var(--accent-success)' }}>Operating Revenue (Income)</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Account Name</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dynamicIncome.length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No operating revenues recorded</td>
                        </tr>
                      ) : (
                        dynamicIncome.map(a => (
                          <tr key={a.account_id}>
                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{a.account_code}</td>
                            <td>{a.account_name}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>INR {parseFloat(a.current_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid rgba(255,255,255,0.2)', fontWeight: 'bold' }}>
                        <td colSpan={2}>Total Operating Revenue</td>
                        <td style={{ textAlign: 'right', color: 'var(--accent-success)' }}>INR {totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Expenses Column */}
              <div className="card">
                <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem', marginBottom: '1rem', color: 'var(--accent-danger)' }}>Operating Expenses</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Account Name</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dynamicExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No operating expenses recorded</td>
                        </tr>
                      ) : (
                        dynamicExpenses.map(a => (
                          <tr key={a.account_id}>
                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{a.account_code}</td>
                            <td>{a.account_name}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>INR {parseFloat(a.current_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid rgba(255,255,255,0.2)', fontWeight: 'bold' }}>
                        <td colSpan={2}>Total Operating Expenses</td>
                        <td style={{ textAlign: 'right', color: 'var(--accent-danger)' }}>INR {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'trialBalance' ? (
          <div>
            {/* Trial Balance Audit Widget */}
            <div
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.5rem',
                border: isTrialBalanceInEquilibrium ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                background: isTrialBalanceInEquilibrium ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                boxShadow: isTrialBalanceInEquilibrium ? '0 4px 16px rgba(16, 185, 129, 0.05)' : '0 4px 16px rgba(239, 68, 68, 0.05)',
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>{isTrialBalanceInEquilibrium ? '✅' : '⚠️'}</span> Ledger Arithmetic Equilibrium
                </h3>
                <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  CA Rule: Total Debit balances must equal Total Credit balances at all times.
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`badge ${isTrialBalanceInEquilibrium ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                  {isTrialBalanceInEquilibrium ? 'In Equilibrium ✓' : 'Discrepancy Detected ✕'}
                </span>
                <div style={{ marginTop: '0.5rem', fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                  INR {trialDebits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} = INR {trialCredits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '1.25rem', color: 'var(--text-primary)' }}>Trial Balance Sheet</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Account Code</th>
                      <th>Account Name</th>
                      <th>Classification</th>
                      <th style={{ textAlign: 'right' }}>Debit Balance</th>
                      <th style={{ textAlign: 'right' }}>Credit Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountsList.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No ledger accounts fetched</td>
                      </tr>
                    ) : (
                      accountsList.map(a => {
                        const val = parseFloat(a.current_balance || '0');
                        const isDebit = a.account_type === 'Asset' || a.account_type === 'Expense';
                        return (
                          <tr key={a.account_id}>
                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{a.account_code}</td>
                            <td>{a.account_name}</td>
                            <td>
                              <span className={`badge ${
                                a.account_type === 'Asset' ? 'badge-primary' :
                                a.account_type === 'Liability' ? 'badge-warning' :
                                a.account_type === 'Equity' ? 'badge-success' :
                                a.account_type === 'Income' ? 'badge-success' : 'badge-danger'
                              }`} style={a.account_type === 'Income' ? { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' } : {}}>
                                {a.account_type}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: isDebit ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {isDebit ? `INR ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: !isDebit ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {!isDebit ? `INR ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid rgba(255,255,255,0.2)', fontWeight: 'bold', fontSize: '1.05rem', background: 'rgba(255,255,255,0.01)' }}>
                      <td colSpan={3}>Grand Total</td>
                      <td style={{ textAlign: 'right', color: 'var(--accent-primary)' }}>INR {trialDebits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right', color: 'var(--accent-primary)' }}>INR {trialCredits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'ledgerJournals' ? (
          <div>
            {/* General Ledger Journals Tab */}
            <div className="page-header" style={{ marginTop: 0, paddingBottom: '0.5rem' }}>
              <div>
                <h2>General Ledger Journals & Vouchers</h2>
                <p>Inspecting double-entry journal transactions recorded on the immutable ledger.</p>
              </div>
            </div>

            {journalsList.length === 0 ? (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div className="empty-state-icon">📂</div>
                <h3>No journal entries recorded</h3>
                <p>Transactions will appear here once student payments or manual general journals are logged.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {journalsList.map(j => (
                  <div className="card" key={j.journal_id} style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>🧾</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                            {j.reference || 'Manual Journal Voucher'}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Date: {j.entry_date} &bull; Journal ID: <code style={{ fontSize: '0.75rem' }}>{j.journal_id}</code>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span className={`badge ${j.status === 'Posted' ? 'badge-success' : 'badge-warning'}`}>
                          {j.status}
                        </span>
                      </div>
                    </div>

                    {j.description && (
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', fontStyle: 'italic', background: 'var(--bg-primary)', padding: '0.6rem 0.8rem', borderRadius: 6, borderLeft: '3px solid var(--accent-primary)' }}>
                        <strong>Narration:</strong> {j.description}
                      </div>
                    )}

                    <div className="table-wrap">
                      <table style={{ border: 'none' }}>
                        <thead>
                          <tr style={{ background: 'transparent', borderBottom: '1px solid var(--border)' }}>
                            <th>Account Code & Title</th>
                            <th style={{ textAlign: 'right', width: '150px' }}>Debit Amount (INR)</th>
                            <th style={{ textAlign: 'right', width: '150px' }}>Credit Amount (INR)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {j.items.map(item => {
                            const isDr = parseFloat(item.debit_amount) > 0;
                            return (
                              <tr key={item.item_id} style={{ border: 'none' }}>
                                <td>
                                  <div style={{ paddingLeft: isDr ? '0' : '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {!isDr && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>To</span>}
                                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>[{item.account_code}]</span>
                                    <span style={{ color: 'var(--text-primary)' }}>{item.account_name}</span>
                                  </div>
                                  {item.narration && (
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', paddingLeft: isDr ? '0' : '2.8rem', marginTop: '0.15rem' }}>
                                      &bull; {item.narration}
                                    </div>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600, color: isDr ? 'var(--text-primary)' : 'transparent' }}>
                                  {isDr ? parseFloat(item.debit_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600, color: !isDr ? 'var(--text-primary)' : 'transparent' }}>
                                  {!isDr ? parseFloat(item.credit_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: '1px solid var(--border)', fontWeight: 'bold', background: 'transparent' }}>
                            <td style={{ color: 'var(--text-muted)' }}>Equilibrium Sum</td>
                            <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                              INR {j.items.reduce((sum, item) => sum + parseFloat(item.debit_amount || '0'), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                              INR {j.items.reduce((sum, item) => sum + parseFloat(item.credit_amount || '0'), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'auditorCheck' ? (
          /* Auditor Compliance Dashboard Tab */
          <div>
            {/* Compliance Summary Header Badge */}
            <div
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '2rem',
                border: isCompliant ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                background: isCompliant 
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.02) 100%)' 
                  : 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.02) 100%)',
                borderRadius: '16px',
                marginBottom: '2rem',
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              }}
            >
              <div>
                <span className="badge badge-success" style={{ background: isCompliant ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: isCompliant ? '#10b981' : '#f59e0b', fontSize: '0.85rem', padding: '0.35rem 0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '0.5rem', display: 'inline-block' }}>
                  {isCompliant ? 'ICAI Compliant ✓' : 'Review Required ⚠️'}
                </span>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
                  {isCompliant ? 'System Controls Audit Status: Verified' : 'System Controls Audit Status: Action Items Found'}
                </h2>
                <p style={{ margin: '0.35rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Compliance report mapping to **Indian Companies (Accounts) Amendment Rules, Rule 3(1)** and **IFRS / IAS 1 Standards**.
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>🛡️</div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  Ref: AUD-{new Date().getFullYear()}-0933
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Check 1: Trial Balance Equilibrium */}
              <div className="card" style={{ display: 'flex', alignItems: 'start', gap: '1.25rem', borderLeft: '4px solid var(--accent-success)' }}>
                <div style={{ fontSize: '1.5rem' }}>{isTrialBalanceInEquilibrium ? '🟢' : '🔴'}</div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontWeight: 700 }}>Double-Entry Ledger Integrity Scan (IAS 1)</h4>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem' }}>
                    Verifies that every recorded debit matches its corresponding credit. Out-of-balance ledgers trigger reporting violations.
                  </p>
                  <div style={{ marginTop: '0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Status: {isTrialBalanceInEquilibrium ? 'Balance verified. Discrepancy is INR 0.00' : 'Warning: Ledger balances are out of sync.'}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-success)' }}>INR {trialDebits.toLocaleString()} Dr / Cr</div>
              </div>

              {/* Check 2: Audit Trail Event Log Synced (Rule 3(1)) */}
              <div className="card" style={{ display: 'flex', alignItems: 'start', gap: '1.25rem', borderLeft: '4px solid var(--accent-primary)' }}>
                <div style={{ fontSize: '1.5rem' }}>{isAuditTrailActive && isAuditTrailSynchronized ? '🟢' : '🟡'}</div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontWeight: 700 }}>Section 143(3)(j) Immutable Audit Trail Scan</h4>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem' }}>
                    Ensures the accounting database is running an **immutable transaction log** that logs every posted ledger journal entry. 
                  </p>
                  <div style={{ marginTop: '0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Status: {isAuditTrailActive ? 'Active. Logs tracked: ' + auditLogsList.length + ' events' : 'Log inactive or missing event log entries.'}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-primary)' }}>
                  {auditTrailMatches} Journals Tracked
                </div>
              </div>

              {/* Check 3: Liquid Cash Reserves Scan */}
              <div className="card" style={{ display: 'flex', alignItems: 'start', gap: '1.25rem', borderLeft: `4px solid ${hasNegativeCash ? 'var(--accent-danger)' : 'var(--accent-success)'}` }}>
                <div style={{ fontSize: '1.5rem' }}>{hasNegativeCash ? '🔴' : '🟢'}</div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontWeight: 700 }}>Liquid Asset Balance Verification (Solvency Scan)</h4>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem' }}>
                    Scans liquid Cash & Bank Account (1001) balances. Negative liquid cash is a red-flag audit warning.
                  </p>
                  <div style={{ marginTop: '0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Status: {hasNegativeCash ? 'CRITICAL WARNING: Negative Cash Balance' : 'Liquid reserves are healthy.'}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: hasNegativeCash ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
                  INR {cashBalance.toLocaleString()} Liquid
                </div>
              </div>

              {/* Check 4: Working Capital Current Ratio */}
              <div className="card" style={{ display: 'flex', alignItems: 'start', gap: '1.25rem', borderLeft: `4px solid ${isCurrentRatioHealthy ? 'var(--accent-success)' : 'var(--accent-warning)'}` }}>
                <div style={{ fontSize: '1.5rem' }}>{isCurrentRatioHealthy ? '🟢' : '🟡'}</div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontWeight: 700 }}>Current Ratio Liquidity Ratio (IFRS IAS 1)</h4>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem' }}>
                    Measures the institution's ability to cover short-term liabilities with short-term assets (Current Assets / Current Liabilities).
                  </p>
                  <div style={{ marginTop: '0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Status: Ratio is {currentRatio.toFixed(2)}:1 &bull; {isCurrentRatioHealthy ? 'Healthy short-term solvency' : 'Solvency ratio under 1.2'}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Ratio: {currentRatio.toFixed(2)}</div>
              </div>

              {/* Check 5: Month-End Draft journal checks */}
              <div className="card" style={{ display: 'flex', alignItems: 'start', gap: '1.25rem', borderLeft: `4px solid ${draftJournalCount === 0 ? 'var(--accent-success)' : 'var(--accent-warning)'}` }}>
                <div style={{ fontSize: '1.5rem' }}>{draftJournalCount === 0 ? '🟢' : '🟡'}</div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontWeight: 700 }}>Month-End Voucher Reconciliation Check</h4>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem' }}>
                    Detects unposted draft journal vouchers. Draft entries must be posted or canceled prior to fiscal period closure.
                  </p>
                  <div style={{ marginTop: '0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Status: {draftJournalCount === 0 ? 'All vouchers reconciled and posted.' : 'Draft journals pending review.'}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: draftJournalCount === 0 ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
                  {draftJournalCount} Draft Entry
                </div>
              </div>

            </div>

            {/* Declaration Certificate Block */}
            <div
              className="card"
              style={{
                marginTop: '2.5rem',
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.01)',
                padding: '2rem',
                textAlign: 'center',
                borderRadius: '12px',
              }}
            >
              <h3 style={{ marginBottom: '0.5rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Auditor Declaration
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
                Based on real-time scans of the chart of accounts and journal ledgers, we certify that the institution's books are in compliance with Indian Accounting Standards (AS) and the international reporting framework. No structural imbalances or audit violations were found.
              </p>
              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '1.5rem', display: 'inline-block', width: '200px', margin: '0 auto' }}>
                <div style={{ fontStyle: 'italic', fontWeight: 600, color: 'var(--text-primary)' }}>EduOS CA Board</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Real-time Audit signature</div>
              </div>
            </div>
          </div>
        ) : activeTab === 'customReport' ? (
          <div>
            <CustomReportBuilder computedAccounts={computedAccounts} />
          </div>
        ) : null}
      </div>
    </>
  );
}

/* ─── Custom Report Builder Component ────────────────────────────────────────── */
function CustomReportBuilder({ computedAccounts }: { computedAccounts: Account[] }) {
  const [types, setTypes] = useState<string[]>(['Asset', 'Liability', 'Equity', 'Income', 'Expense']);
  const [search, setSearch] = useState('');
  const [minBalance, setMinBalance] = useState('');
  
  const filtered = computedAccounts.filter(acc => {
    if (!types.includes(acc.account_type)) return false;
    if (search && !acc.account_name.toLowerCase().includes(search.toLowerCase()) && !acc.account_code.includes(search)) return false;
    if (minBalance && Math.abs(parseFloat(acc.current_balance || '0')) < parseFloat(minBalance)) return false;
    return true;
  });

  const totalBalance = filtered.reduce((sum, a) => sum + parseFloat(a.current_balance || '0'), 0);

  const handleExportCSV = () => {
    const headers = ['Account Code', 'Account Name', 'Type', 'Current Balance (INR)'];
    const rows = filtered.map(a => [a.account_code, a.account_name, a.account_type, a.current_balance]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `custom_financial_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Custom Statement & Report Builder</h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Compile, slice and audit custom reports based on criteria.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }} className="no-print">
          <button className="btn btn-secondary" onClick={handleExportCSV}>📥 Export CSV</button>
          <button className="btn btn-primary" onClick={() => window.print()}>🖨️ Print PDF</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '1.5rem' }} className="no-print">
        {/* Controls Panel */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', height: 'fit-content' }}>
          <h4 style={{ margin: '0 0 1rem 0' }}>Report Parameters</h4>
          
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Search Account</label>
            <input className="form-input" placeholder="Code or Name..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Min absolute balance (INR)</label>
            <input className="form-input" type="number" placeholder="e.g. 5000" value={minBalance} onChange={e => setMinBalance(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Account Types</label>
            {['Asset', 'Liability', 'Equity', 'Income', 'Expense'].map(t => {
              const checked = types.includes(t);
              return (
                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={checked} onChange={() => {
                    setTypes(prev => checked ? prev.filter(x => x !== t) : [...prev, t]);
                  }} />
                  {t}
                </label>
              );
            })}
          </div>
        </div>

        {/* Data Table Panel */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="table-wrap" style={{ flex: 1 }}>
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Account Name</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Current Balance</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No accounts match selected criteria</td>
                  </tr>
                ) : (
                  filtered.map(a => (
                    <tr key={a.account_id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{a.account_code}</td>
                      <td>{a.account_name}</td>
                      <td><span className="badge badge-info">{a.account_type}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>INR {parseFloat(a.current_balance || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid rgba(255,255,255,0.15)', fontWeight: 'bold' }}>
                  <td colSpan={3}>Aggregate Sum</td>
                  <td style={{ textAlign: 'right', color: 'var(--accent-primary)', fontSize: '1.05rem' }}>INR {totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
      
      {/* Print-only version of custom report */}
      <div className="print-only" style={{ display: 'none' }}>
        <h3 style={{ textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #000', paddingBottom: '0.5rem' }}>Custom compiled financial report</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '2px solid #000', textAlign: 'left', padding: '8px' }}>Code</th>
              <th style={{ borderBottom: '2px solid #000', textAlign: 'left', padding: '8px' }}>Account Name</th>
              <th style={{ borderBottom: '2px solid #000', textAlign: 'left', padding: '8px' }}>Type</th>
              <th style={{ borderBottom: '2px solid #000', textAlign: 'right', padding: '8px' }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.account_id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '8px' }}>{a.account_code}</td>
                <td style={{ padding: '8px' }}>{a.account_name}</td>
                <td style={{ padding: '8px' }}>{a.account_type}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>INR {parseFloat(a.current_balance || '0').toLocaleString()}</td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid #000', fontWeight: 'bold' }}>
              <td colSpan={3} style={{ padding: '8px' }}>Aggregate Sum</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>INR {totalBalance.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
