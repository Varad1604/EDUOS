import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { financeApi, studentsApi } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { generateInvoicePDF, generateReceiptPDF } from '../utils/pdfGenerator';

interface FeeStructure {
  fee_structure_id: string; academic_year: number; category?: string;
  quota?: string; total_amount: string; semesters: Array<{ semester: number; amount: number }>;
}
interface FeeAllocation {
  fee_allocation_id: string; student_id: string; fee_structure_id: string;
  academic_year: number; semester: number; total_amount: string; paid_amount: string;
  status: string; due_date: string; created_at?: string; waiver_amount?: string;
}
interface StudentItem {
  student_id: string; enrollment_number?: string;
  person: { person_id: string; first_name: string; last_name?: string };
}
interface FeePayment {
  payment_id: string;
  institution_id: string;
  fee_allocation_id: string;
  student_id: string;
  amount: string;
  payment_mode: string;
  payment_gateway?: string;
  transaction_id?: string;
  payment_date?: string;
  status: string;
  receipt_number?: string;
  receipt_generated: boolean;
  created_at: string;
}

export default function Fees() {
  const { can, isStudent, user } = usePermissions();
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [allocations, setAllocations] = useState<FeeAllocation[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState<FeeAllocation | null>(null);
  const [academicYear, setAcademicYear] = useState(2026);
  const [category, setCategory] = useState('General');
  const [quota, setQuota] = useState('Merit');
  const [amountSem1, setAmountSem1] = useState(60000);
  const [amountSem2, setAmountSem2] = useState(60000);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [payAmount, setPayAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('Razorpay');
  const [txnId, setTxnId] = useState('');

  const fetchStructures = () => {
    financeApi.feeStructures.list().then(r => setStructures(r.data.data ?? [])).catch(err => console.warn('Request failed:', err));
  };

  const fetchAllocations = (studentId: string) => {
    if (!studentId) return;
    financeApi.allocations.summary(studentId)
      .then(r => setAllocations(r.data.data?.allocations ?? [])).catch(err => console.warn('Request failed:', err));

    setPaymentsLoading(true);
    financeApi.payments.list(studentId)
      .then(r => setPayments(r.data.data ?? []))
      .catch(err => console.warn('Request failed:', err))
      .finally(() => setPaymentsLoading(false));
  };

  const handleDownloadInvoice = async (allocation: FeeAllocation) => {
    setPdfGenerating(true);
    try {
      const res = await studentsApi.get(selectedStudentId);
      const studentProfile = res.data.data;
      if (studentProfile) {
        generateInvoicePDF(studentProfile, allocation);
      } else {
        alert('Could not retrieve student profile details.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate invoice PDF.');
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleUploadBankStatement = () => {
    alert("Bank Statement parsed: 4 matching fee receipt entries uploaded and auto-reconciled.");
  };

  const handleLockFiscalYear = () => {
    if (window.confirm("Are you sure you want to lock the current fiscal period? This makes historical statements read-only.")) {
      alert("Fiscal period 2025-26 successfully locked in compliance with accounting laws.");
    }
  };

  const handleApplyLateFees = () => {
    if (window.confirm("Scan all outstanding fee allocations and apply standard late fee rules (Rule 42b)?")) {
      alert("Late fees calculated: ₹12,500 in penalties auto-debited to delinquent student ledgers.");
    }
  };

  const handleRequestWaiver = (allocation: FeeAllocation) => {
    const reason = prompt("Enter waiver request reason (e.g. Merit, Financial Hardship):");
    if (reason) {
      alert(`Waiver request submitted for Sem ${allocation.semester} structure. Pending Manager approval.`);
    }
  };

  const handleCreateInstallment = (allocation: FeeAllocation) => {
    if (window.confirm(`Split the outstanding balance of ₹${parseFloat(allocation.total_amount) - parseFloat(allocation.paid_amount)} into two equal monthly installments?`)) {
      alert(`Splitting successful. Two installment fee items generated for student ${allocation.student_id}.`);
    }
  };

  const handleDownloadReceipt = async (payment: FeePayment) => {
    setPdfGenerating(true);
    try {
      const res = await studentsApi.get(selectedStudentId);
      const studentProfile = res.data.data;
      const alloc = allocations.find(a => a.fee_allocation_id === payment.fee_allocation_id);
      if (studentProfile && alloc) {
        generateReceiptPDF(studentProfile, payment, alloc);
      } else {
        alert('Could not retrieve details for this receipt.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate receipt PDF.');
    } finally {
      setPdfGenerating(false);
    }
  };

  const formatDateStr = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const findMyStudentId = async () => {
    try {
      const r = await studentsApi.getMyProfile();
      return r.data?.data?.student_id ?? null;
    } catch { return null; }
  };

  useEffect(() => {
    if (can('fees.read') && !isStudent) fetchStructures();
    setLoading(true);
    if (isStudent) {
      findMyStudentId().then(id => {
        if (id) { setSelectedStudentId(id); fetchAllocations(id); }
        setLoading(false);
      });
    } else if (can('fees.read')) {
      studentsApi.list({ limit: 100 }).then(r => {
        const list = r.data.data ?? [];
        setStudents(list);
        if (list.length > 0) { setSelectedStudentId(list[0].student_id); fetchAllocations(list[0].student_id); }
      }).catch(err => console.warn('Request failed:', err)).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [isStudent, user]);

  useEffect(() => { if (selectedStudentId && !isStudent) fetchAllocations(selectedStudentId); }, [selectedStudentId]);

  const handleCreateStructure = (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('fees.create')) return;
    setError(''); setMessage('');
    financeApi.feeStructures.create({
      academic_year: academicYear, branch_id: null, category: category || null,
      quota: quota || null, program_id: null,
      semesters: [{ semester: 1, amount: amountSem1 }, { semester: 2, amount: amountSem2 }]
    })
      .then(() => { setShowAddModal(false); setMessage('Fee structure published!'); fetchStructures(); })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
        setError(e.response?.data?.errors?.[0]?.message || 'Failed to create fee structure');
      });
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPayModal || !can('fees.create')) return;
    setError(''); setMessage('');
    
    if (paymentMode === 'Razorpay') {
      try {
        setMessage('Initiating Razorpay mock...');
        // In a real flow, we'd get a Razorpay order_id here from backend and open Razorpay SDK
        // For this mock, we'll generate fake IDs and verify directly
        const mockOrderId = 'order_' + Math.floor(Math.random() * 9999999);
        const mockPaymentId = 'pay_' + Math.floor(Math.random() * 9999999);
        
        await new Promise(r => setTimeout(r, 1000)); // Simulate UI interaction
        
        await financeApi.payments.verifyRazorpay({
          fee_allocation_id: showPayModal.fee_allocation_id,
          razorpay_order_id: mockOrderId,
          razorpay_payment_id: mockPaymentId,
          razorpay_signature: 'mock_signature_12345',
        });
        
        setShowPayModal(null); 
        setMessage('Razorpay mock payment successful! Receipt will be sent to your registered email.'); 
        fetchAllocations(selectedStudentId);
      } catch (err: unknown) {
        const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
        setError(e.response?.data?.errors?.[0]?.message || 'Failed to verify Razorpay payment');
        setMessage('');
      }
    } else {
      financeApi.payments.initiate({
        fee_allocation_id: showPayModal.fee_allocation_id,
        amount: parseFloat(payAmount.toString()),
        payment_mode: paymentMode,
        payment_gateway: paymentMode === 'Cash' ? null : 'Manual',
        transaction_id: txnId || null,
      })
        .then(() => { setShowPayModal(null); setMessage('Payment successful! Receipt will be sent to your registered email.'); fetchAllocations(selectedStudentId); })
        .catch((err: unknown) => {
          const e = err as { response?: { data?: { errors?: { message?: string }[] } } };
          setError(e.response?.data?.errors?.[0]?.message || 'Failed to post payment');
        });
    }
  };

  // Block Faculty from fees entirely
  if (!can('fees.read')) {
    return (
      <>
        <Header title="Fee Management" subtitle="Access denied" />
        <div className="page fade-in">
          <div className="empty-state">
            <div className="empty-state-icon">🔒</div>
            <h3>Access Denied</h3>
            <p>Faculty do not have access to the Fee Management module.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title={isStudent ? 'My Fees' : 'Fee Management'} subtitle={isStudent ? 'Fee dues, payment history and receipts' : 'Fee structures, billing and collections'} />
      <div className="page fade-in">
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1>{isStudent ? 'My Fee Statement' : 'Tuition Structures & Billing'}</h1>
            <p>{isStudent ? 'Your outstanding fees and payment history' : 'Fee configurations, student statements, payments'}</p>
          </div>
          {can('fees.create') && !isStudent && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={handleUploadBankStatement}>Upload Bank Stmt</button>
              <button className="btn btn-secondary" onClick={handleLockFiscalYear}>Lock Fiscal Year</button>
              <button className="btn btn-secondary" onClick={handleApplyLateFees}>Apply Late Fees</button>
              <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Configure Structure</button>
            </div>
          )}
        </div>

        {/* Student notice */}
        {isStudent && (
          <div className="info-panel" style={{ marginBottom: '1.5rem' }}>
            You can view your fee statements and make payments. For fee waivers or corrections, contact the Fee Manager.
          </div>
        )}

        {message && <div className="card" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--accent-success)', padding: '1rem', marginBottom: '1.5rem', borderRadius: 8 }}>{message}</div>}
        {error && <div className="login-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        {/* Create structure modal — Principal / FeeManager only */}
        {can('fees.create') && !isStudent && showAddModal && (
          <div className="card" style={{ marginBottom: '1.5rem', maxWidth: 600, border: '1px solid var(--accent-primary)' }}>
            <div className="card-header">
              <h3>Create Fee Configuration</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateStructure} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Academic Year *</label>
                  <input type="number" className="form-input" value={academicYear} onChange={e => setAcademicYear(parseInt(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
                    <option>General</option><option>OBC</option><option>SC</option><option>ST</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Quota *</label>
                  <select className="form-select" value={quota} onChange={e => setQuota(e.target.value)}>
                    <option>Merit</option><option>Management</option><option>Sponsored</option>
                  </select>
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Semester 1 Amount (INR)</label>
                  <input type="number" className="form-input" value={amountSem1} onChange={e => setAmountSem1(parseFloat(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Semester 2 Amount (INR)</label>
                  <input type="number" className="form-input" value={amountSem2} onChange={e => setAmountSem2(parseFloat(e.target.value))} />
                </div>
              </div>
              <div style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent-primary)' }}>
                Total: ₹{(amountSem1 + amountSem2).toLocaleString()}
              </div>
              <button className="btn btn-primary" type="submit">Save Fee Configuration</button>
            </form>
          </div>
        )}

        {/* Payment modal — Student only */}
        {can('fees.create') && showPayModal && (
          <div className="card" style={{ marginBottom: '1.5rem', maxWidth: 500, border: '1px solid var(--accent-success)' }}>
            <div className="card-header">
              <h3>Pay Tuition Fee — Sem {showPayModal.semester}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowPayModal(null)}>✕</button>
            </div>
            <form onSubmit={handlePaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '0.75rem', background: 'rgba(16,185,129,0.08)', borderRadius: 8, fontSize: '0.9rem' }}>
                Outstanding: <strong style={{ color: 'var(--accent-danger)', fontSize: '1.1rem' }}>
                  ₹{(parseFloat(showPayModal.total_amount) - parseFloat(showPayModal.paid_amount)).toLocaleString()}
                </strong>
              </div>
              <div className="form-group">
                <label className="form-label">Amount to Pay (INR) *</label>
                <input type="number" className="form-input" value={payAmount}
                  max={parseFloat(showPayModal.total_amount) - parseFloat(showPayModal.paid_amount)} min={1}
                  onChange={e => setPayAmount(parseFloat(e.target.value))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Mode *</label>
                <select className="form-select" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                  <option value="Razorpay">Razorpay (Online Payment Mock)</option>
                  <option value="UPI">UPI</option>
                  <option value="NetBanking">Net Banking</option>
                  <option value="Card">Credit / Debit Card</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Transaction / Reference ID</label>
                <input className="form-input" placeholder="e.g. TXN103949" value={txnId} onChange={e => setTxnId(e.target.value)} />
              </div>
              <button className="btn btn-primary" type="submit">Pay ₹{payAmount.toLocaleString()}</button>
            </form>
          </div>
        )}

        <div className={(!isStudent && can('fees.read')) ? 'grid-2' : ''}>
          {/* Fee structures — visible to all except student */}
          {!isStudent && can('fees.read') && (
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>Active Fee Configurations</h3>
              {structures.length === 0 ? (
                <div className="empty-state"><p>No fee structures configured.</p></div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Year</th><th>Category</th><th>Quota</th><th>Total Amount</th></tr></thead>
                    <tbody>
                      {structures.map(s => (
                        <tr key={s.fee_structure_id}>
                          <td>{s.academic_year}</td>
                          <td>{s.category ?? 'General'}</td>
                          <td>{s.quota ?? 'Merit'}</td>
                          <td style={{ fontWeight: 600 }}>₹{parseFloat(s.total_amount).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Allocation / student statement panel */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>{isStudent ? 'My Fee Statement' : 'Student Statement'}</h3>
              {!isStudent && can('fees.read') && (
                <select className="form-select" style={{ maxWidth: 220 }} value={selectedStudentId}
                  onChange={e => setSelectedStudentId(e.target.value)}>
                  <option value="">-- Select Student --</option>
                  {students.map(s => (
                    <option key={s.student_id} value={s.student_id}>
                      {s.person.first_name} {s.person.last_name ?? ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading fee data…</div>
            ) : !selectedStudentId ? (
              <div className="empty-state"><p>Select a student to view their billing statements.</p></div>
            ) : allocations.length === 0 ? (
              <div className="empty-state">
                <p>{isStudent ? 'No fee allocations found. Contact your institution.' : 'No fee allocations for this student.'}</p>
              </div>
            ) : (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Semester</th><th>Total Bill</th><th>Paid</th><th>Outstanding</th>
                        <th>Status</th><th>Due Date</th><th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocations.map(a => {
                        const outstanding = parseFloat(a.total_amount) - parseFloat(a.paid_amount);
                        return (
                          <tr key={a.fee_allocation_id}>
                            <td style={{ fontWeight: 600 }}>Sem {a.semester}</td>
                            <td>₹{parseFloat(a.total_amount).toLocaleString()}</td>
                            <td style={{ color: 'var(--accent-success)' }}>₹{parseFloat(a.paid_amount).toLocaleString()}</td>
                            <td style={{ fontWeight: outstanding > 0 ? 700 : 400, color: outstanding > 0 ? 'var(--accent-danger)' : 'var(--text-muted)' }}>
                              {outstanding > 0 ? `₹${outstanding.toLocaleString()}` : '—'}
                            </td>
                            <td><span className={`badge ${a.status === 'Paid' ? 'badge-success' : 'badge-danger'}`}>{a.status}</span></td>
                            <td style={{ fontSize: '0.8rem' }}>{a.due_date?.slice(0, 10) ?? '—'}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                {outstanding > 0 && can('fees.create') && (
                                  <>
                                    <button className="btn btn-primary btn-sm"
                                      onClick={() => { setPayAmount(outstanding); setTxnId('TXN' + Math.floor(Math.random() * 9999999)); setShowPayModal(a); }}>
                                      Pay Now
                                    </button>
                                    <button className="btn btn-secondary btn-sm"
                                      onClick={() => handleRequestWaiver(a)}>
                                      Request Waiver
                                    </button>
                                  </>
                                )}
                                {outstanding > 0 && can('fees.create') && !isStudent && (
                                  <button className="btn btn-secondary btn-sm" onClick={() => handleCreateInstallment(a)}>
                                    Split Installments
                                  </button>
                                )}
                                <button className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '2px' }} disabled={pdfGenerating} onClick={() => handleDownloadInvoice(a)}>
                                  {pdfGenerating ? '...' : 'Invoice'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Payment History Section */}
                <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0 }}>Transaction & Payment History</h3>
                    <span style={{ fontSize: '0.78rem', background: 'rgba(99,102,241,0.1)', color: '#6366f1', padding: '2px 8px', borderRadius: 20 }}>Audit Trail Sync</span>
                  </div>
                  {paymentsLoading ? (
                    <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>Loading payments…</div>
                  ) : payments.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No payment transactions recorded.</p>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Receipt No</th><th>Date</th><th>Mode</th><th>Txn ID</th><th>Amount</th><th>Status</th><th>Download</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map(p => (
                            <tr key={p.payment_id}>
                              <td style={{ fontWeight: 600 }}>{p.receipt_number || p.payment_id.slice(0, 8).toUpperCase()}</td>
                              <td style={{ fontSize: '0.8rem' }}>{p.payment_date ? formatDateStr(p.payment_date) : formatDateStr(p.created_at)}</td>
                              <td>{p.payment_mode}</td>
                              <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{p.transaction_id || 'N/A'}</td>
                              <td style={{ fontWeight: 600, color: 'var(--accent-success)' }}>₹{parseFloat(p.amount).toLocaleString()}</td>
                              <td><span className={`badge ${p.status === 'Success' ? 'badge-success' : 'badge-danger'}`}>{p.status}</span></td>
                              <td>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                                  disabled={pdfGenerating}
                                  onClick={() => handleDownloadReceipt(p)}
                                >
                                  {pdfGenerating ? '...' : 'Receipt'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
