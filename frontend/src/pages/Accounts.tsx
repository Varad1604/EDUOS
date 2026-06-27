import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { api, financeApi } from '../api';
import { usePermissions } from '../hooks/usePermissions';

interface Account {
  account_id: string; account_code: string; account_name: string;
  account_type: string; opening_balance: string; current_balance: string; fiscal_year: number;
}
interface JournalEntry {
  journal_id: string; entry_date: string; reference?: string;
  description?: string; status: string;
}
interface JournalItemRow {
  account_id: string; debit_amount: string; credit_amount: string; narration: string;
}

export default function Accounts() {
  const { can } = usePermissions();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddJournal, setShowAddJournal] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('Asset');
  const [openingBalance, setOpeningBalance] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<JournalItemRow[]>([
    { account_id: '', debit_amount: '0', credit_amount: '0', narration: '' },
    { account_id: '', debit_amount: '0', credit_amount: '0', narration: '' },
  ]);

  // Block non-finance roles entirely
  if (!can('accounts.viewAll')) {
    return (
      <>
        <Header title="Accounts" subtitle="Access denied" />
        <div className="page fade-in">
          <div className="empty-state">
            <div className="empty-state-icon">🔒</div>
            <h3>Access Denied</h3>
            <p>The Accounts & General Ledger module is restricted to Finance staff only (Principal and Fee Manager).</p>
          </div>
        </div>
      </>
    );
  }

  const fetchData = async () => {
    setLoading(true);
    try {
      const [aRes, jRes] = await Promise.all([financeApi.accounts.list(), financeApi.journal.list()]);
      setAccounts(aRes.data.data ?? []);
      setJournals(jRes.data.data ?? []);
    } catch { setError('Failed to fetch financial data.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('accounts.create')) return;
    setError(''); setMessage('');
    if (!code || !name) { setError('Please fill in all required fields'); return; }
    financeApi.accounts.create({
      account_code: code, account_name: name, account_type: type,
      opening_balance: parseFloat(openingBalance.toString()), fiscal_year: 2026, parent_account_id: null,
    })
      .then(() => { setShowAddAccount(false); setCode(''); setName(''); setMessage('Account created!'); fetchData(); })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
        setError(e.response?.data?.errors?.[0]?.message || 'Failed to create account');
      });
  };

  const handleItemChange = (idx: number, field: keyof JournalItemRow, val: string) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: val };
    setItems(updated);
  };

  const handleCreateJournal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('accounts.postJournal')) return;
    setError(''); setMessage('');
    let totalDebit = 0; let totalCredit = 0;
    const formattedItems = [];
    for (const item of items) {
      if (!item.account_id) { setError('Select an account for all rows'); return; }
      const deb = parseFloat(item.debit_amount || '0');
      const cred = parseFloat(item.credit_amount || '0');
      if (deb > 0 && cred > 0) { setError('A row cannot have both debit and credit'); return; }
      if (deb === 0 && cred === 0) { setError('Each row must have a debit OR credit amount'); return; }
      totalDebit += deb; totalCredit += cred;
      formattedItems.push({ account_id: item.account_id, debit_amount: deb > 0 ? deb : null, credit_amount: cred > 0 ? cred : null, narration: item.narration || null });
    }
    if (totalDebit !== totalCredit) {
      setError(`Out of balance! Debits ₹${totalDebit.toLocaleString()} ≠ Credits ₹${totalCredit.toLocaleString()} (diff ₹${Math.abs(totalDebit - totalCredit).toLocaleString()})`);
      return;
    }
    financeApi.journal.create({ entry_date: entryDate, reference: reference || null, description: description || null, items: formattedItems })
      .then(() => {
        setShowAddJournal(false); setReference(''); setDescription('');
        setItems([{ account_id: '', debit_amount: '0', credit_amount: '0', narration: '' }, { account_id: '', debit_amount: '0', credit_amount: '0', narration: '' }]);
        setMessage('Journal entry drafted and saved!'); fetchData();
      })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
        setError(e.response?.data?.errors?.[0]?.message || 'Failed to post journal entry');
      });
  };

  const handleApprove = (journalId: string) => {
    if (!can('accounts.approveJournal')) return;
    setError(''); setMessage('');
    api.patch(`/journal-entries/${journalId}/approve`)
      .then(() => { setMessage('Journal entry approved and posted to General Ledger!'); fetchData(); })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
        setError(e.response?.data?.errors?.[0]?.message || 'Failed to approve entry');
      });
  };

  return (
    <>
      <Header title="Accounts" subtitle="General Ledger, Chart of Accounts, and Journal Entries" />
      <div className="page fade-in">
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1>General Ledger & Accounts</h1>
            <p>Chart of accounts with double-entry bookkeeping</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {can('accounts.create') && <button className="btn btn-secondary" onClick={() => setShowAddAccount(true)}>+ Create Account</button>}
            {can('accounts.postJournal') && <button className="btn btn-primary" onClick={() => setShowAddJournal(true)}>+ Post Journal Entry</button>}
          </div>
        </div>

        {message && <div className="card" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--accent-success)', padding: '1rem', marginBottom: '1.5rem', borderRadius: 8 }}>{message}</div>}
        {error && <div className="login-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        {/* Create Account */}
        {can('accounts.create') && showAddAccount && (
          <div className="card" style={{ marginBottom: '1.5rem', maxWidth: 500, border: '1px solid var(--accent-primary)' }}>
            <div className="card-header">
              <h3>Create Account</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddAccount(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Account Code *</label>
                  <input className="form-input" placeholder="e.g. 1002" value={code} onChange={e => setCode(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Type *</label>
                  <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                    <option>Asset</option><option>Liability</option><option>Equity</option><option>Income</option><option>Expense</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Account Name *</label>
                <input className="form-input" placeholder="e.g. Bank Savings A/C" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Opening Balance (INR)</label>
                <input type="number" className="form-input" value={openingBalance} onChange={e => setOpeningBalance(parseFloat(e.target.value))} />
              </div>
              <button className="btn btn-primary" type="submit">Create Account</button>
            </form>
          </div>
        )}

        {/* Journal Entry Modal */}
        {can('accounts.postJournal') && showAddJournal && (
          <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid var(--accent-primary)' }}>
            <div className="card-header">
              <h3>Post Balancing Journal Entry</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddJournal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateJournal} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Entry Date *</label>
                  <input type="date" className="form-input" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Reference ID</label>
                  <input className="form-input" placeholder="e.g. REF_PAYMENT" value={reference} onChange={e => setReference(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input className="form-input" placeholder="e.g. Fee collection batch" value={description} onChange={e => setDescription(e.target.value)} />
                </div>
              </div>
              <div>
                <h4 style={{ marginBottom: '0.75rem' }}>Debit & Credit Lines</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <select className="form-select" style={{ flex: 2 }} value={item.account_id}
                        onChange={e => handleItemChange(idx, 'account_id', e.target.value)} required>
                        <option value="">-- Account --</option>
                        {accounts.map(a => <option key={a.account_id} value={a.account_id}>{a.account_code} — {a.account_name} ({a.account_type})</option>)}
                      </select>
                      <input type="number" className="form-input" style={{ flex: 1 }} placeholder="Dr." value={item.debit_amount} onChange={e => handleItemChange(idx, 'debit_amount', e.target.value)} />
                      <input type="number" className="form-input" style={{ flex: 1 }} placeholder="Cr." value={item.credit_amount} onChange={e => handleItemChange(idx, 'credit_amount', e.target.value)} />
                      <input className="form-input" style={{ flex: 2 }} placeholder="Narration" value={item.narration} onChange={e => handleItemChange(idx, 'narration', e.target.value)} />
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem' }}
                  onClick={() => setItems(prev => [...prev, { account_id: '', debit_amount: '0', credit_amount: '0', narration: '' }])}>+ Add Row</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '2rem', fontWeight: 600 }}>
                <div>Total Dr: ₹{items.reduce((s, i) => s + parseFloat(i.debit_amount || '0'), 0).toLocaleString()}</div>
                <div style={{ color: 'var(--accent-primary)' }}>Total Cr: ₹{items.reduce((s, i) => s + parseFloat(i.credit_amount || '0'), 0).toLocaleString()}</div>
              </div>
              <button className="btn btn-primary" type="submit">Publish Draft Transaction</button>
            </form>
          </div>
        )}

        <div className="grid-2">
          {/* Chart of Accounts */}
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Chart of Accounts</h3>
            {loading ? <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Code</th><th>Account Name</th><th>Type</th><th>Current Balance</th></tr></thead>
                  <tbody>
                    {accounts.map(a => (
                      <tr key={a.account_id}>
                        <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{a.account_code}</td>
                        <td>{a.account_name}</td>
                        <td><span className={`badge ${a.account_type === 'Asset' || a.account_type === 'Income' ? 'badge-success' : 'badge-warning'}`}>{a.account_type}</span></td>
                        <td style={{ fontWeight: 600 }}>₹{parseFloat(a.current_balance).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Journal Entries */}
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Double-Entry Journal Log</h3>
            {loading ? <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div> : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th><th>Reference</th><th>Description</th><th>Status</th>
                      {can('accounts.approveJournal') && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {journals.map(j => (
                      <tr key={j.journal_id}>
                        <td>{j.entry_date}</td>
                        <td style={{ fontWeight: 600, color: 'var(--accent-secondary)' }}>{j.reference ?? '—'}</td>
                        <td>{j.description ?? 'No memo'}</td>
                        <td><span className={`badge ${j.status === 'Posted' || j.status === 'Approved' ? 'badge-success' : 'badge-warning'}`}>{j.status}</span></td>
                        {can('accounts.approveJournal') && (
                          <td>
                            {(j.status === 'Draft' || j.status === 'Submitted') ? (
                              <button className="btn btn-primary btn-sm" onClick={() => handleApprove(j.journal_id)}>Approve</button>
                            ) : <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Posted ✓</span>}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
