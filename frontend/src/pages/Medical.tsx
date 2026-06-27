import React, { useEffect, useState, useCallback } from 'react';
import Header from '../components/Header';
import { medicalApi, studentsApi } from '../api';
import { usePermissions } from '../hooks/usePermissions';

/* ─── Types ──────────────────────────────────────────────────────────────────── */
interface MedVisit {
  visit_id: string; student_id: string; student_name?: string;
  visit_date: string; visit_time?: string; chief_complaint: string;
  doctor_name: string; diagnosis?: string; notes?: string;
  follow_up_date?: string; status: string;
}
interface InventoryItem {
  item_id: string; item_name: string; item_category: string;
  unit: string; quantity_in_stock: number; reorder_level: number;
  expiry_date?: string; batch_number?: string; manufacturer?: string;
}
interface SickLeave {
  sick_leave_id: string; student_id: string; student_name?: string;
  visit_id: string; leave_from: string; leave_to: string;
  days: number; doctor_name: string; remarks?: string;
  certificate_number?: string; issued_at: string;
}
interface Stats {
  total_visits_today?: number; total_visits_month?: number;
  open_visits?: number; total_inventory_items?: number;
  low_stock_items?: number; sick_leaves_issued?: number;
}
interface Student { student_id: string; person: { first_name: string; last_name?: string }; enrollment_number?: string; }

type Tab = 'overview' | 'visits' | 'inventory' | 'sick-leaves';

const STATUS_COLOR: Record<string, string> = {
  Open: '#f59e0b', Closed: '#10b981', FollowUp: '#6366f1',
};

const pill = (s: string, color?: string) => {
  const c = color ?? STATUS_COLOR[s] ?? '#6b7280';
  return (
    <span style={{ background: c + '22', color: c, border: `1px solid ${c}44`, padding: '2px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600 }}>{s}</span>
  );
};

const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/* ─── Main Page ──────────────────────────────────────────────────────────────── */
export default function Medical() {
  const { can } = usePermissions();
  const canManage = can('medical.manage');

  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [visits, setVisits] = useState<MedVisit[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sickLeaves, setSickLeaves] = useState<SickLeave[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Modals
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showSickLeaveModal, setShowSickLeaveModal] = useState<string>(''); // visit_id

  const showMsg = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(''), 3500);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [st, v, inv, sl] = await Promise.all([
        medicalApi.stats(),
        medicalApi.listVisits(),
        medicalApi.listInventory(),
        medicalApi.listSickLeaves(),
      ]);
      setStats(st);
      setVisits(Array.isArray(v) ? v : []);
      setInventory(Array.isArray(inv) ? inv : []);
      setSickLeaves(Array.isArray(sl) ? sl : []);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (canManage) {
      studentsApi.list({ limit: 200 })
        .then(r => setStudents(r.data.data ?? []))
        .catch(() => {});
    }
  }, [canManage]);

  /* ── Overview ─────────────────────────────────────────────────────────────── */
  function OverviewTab() {
    const cards = [
      { label: 'Visits Today',     value: stats?.total_visits_today  ?? 0, color: '#1d4ed8' },
      { label: 'This Month',        value: stats?.total_visits_month  ?? 0, color: '#1e40af' },
      { label: 'Open Cases',         value: stats?.open_visits         ?? 0, color: '#b45309' },
      { label: 'Inventory Items',   value: stats?.total_inventory_items ?? 0, color: '#15803d' },
      { label: 'Low Stock',          value: stats?.low_stock_items     ?? 0, color: '#b91c1c' },
      { label: 'Sick Leaves',        value: stats?.sick_leaves_issued  ?? 0, color: '#1e40af' },
    ];

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 16, marginBottom: 32 }}>
          {cards.map(c => (
            <div key={c.label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{c.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Recent Visits */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem' }}>Recent OPD Visits</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setTab('visits')}>View All</button>
            </div>
            {visits.slice(0, 5).map(v => (
              <div key={v.visit_id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text)' }}>{v.chief_complaint}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmt(v.visit_date)} · Dr. {v.doctor_name}</div>
                </div>
                {pill(v.status)}
              </div>
            ))}
            {visits.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No visits recorded yet.</p>}
          </div>

          {/* Low Stock Alert */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem' }}>⚠️ Low Stock Alert</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setTab('inventory')}>Inventory</button>
            </div>
            {inventory.filter(i => i.quantity_in_stock <= i.reorder_level).slice(0, 5).map(i => (
              <div key={i.item_id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text)' }}>{i.item_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{i.item_category} · {i.unit}</div>
                </div>
                <span style={{ fontWeight: 700, color: i.quantity_in_stock === 0 ? '#ef4444' : '#f59e0b', fontSize: '0.85rem' }}>
                  {i.quantity_in_stock} left
                </span>
              </div>
            ))}
            {inventory.filter(i => i.quantity_in_stock <= i.reorder_level).length === 0 && (
              <p style={{ color: '#10b981', fontSize: '0.85rem' }}>✅ All items are adequately stocked.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Visits Tab ───────────────────────────────────────────────────────────── */
  function VisitsTab() {
    const [form, setForm] = useState({
      student_id: '', chief_complaint: '', doctor_name: '', visit_date: new Date().toISOString().slice(0, 10),
    });

    const handleCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await medicalApi.createVisit(form);
        setShowVisitModal(false);
        showMsg('Visit recorded successfully!');
        loadAll();
      } catch (err: any) { showMsg(err.message ?? 'Failed to create visit', 'error'); }
    };

    const handleClose = async (visitId: string) => {
      try {
        await medicalApi.closeVisit(visitId, { status: 'Closed' });
        showMsg('Visit closed.');
        loadAll();
      } catch { showMsg('Failed to close visit', 'error'); }
    };

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: 'var(--text)' }}>OPD Visits ({visits.length})</h3>
          {canManage && (
            <button id="new-visit-btn" className="btn btn-primary" onClick={() => setShowVisitModal(true)}>+ New Visit</button>
          )}
        </div>

        {visits.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏥</div>
            <h3>No visits recorded</h3>
            <p>OPD visit records will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {visits.map(v => (
              <div key={v.visit_id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>{v.chief_complaint}</span>
                      {pill(v.status)}
                    </div>
                    <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                      👨‍⚕️ Dr. {v.doctor_name} · 📅 {fmt(v.visit_date)}
                    </div>
                    {v.diagnosis && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Dx: {v.diagnosis}</div>}
                    {v.notes && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>{v.notes}</div>}
                    {v.follow_up_date && (
                      <div style={{ fontSize: '0.78rem', color: '#f59e0b', marginTop: 4 }}>🔁 Follow-up: {fmt(v.follow_up_date)}</div>
                    )}
                  </div>
                  {canManage && v.status === 'Open' && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setShowSickLeaveModal(v.visit_id)}>Issue Sick Leave</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleClose(v.visit_id)}>Close Visit</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New Visit Modal */}
        {showVisitModal && (
          <div className="modal-overlay" onClick={() => setShowVisitModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
              <h2>Record OPD Visit</h2>
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label>Student *</label>
                  <select className="form-input" value={form.student_id} onChange={e => setForm(p => ({ ...p, student_id: e.target.value }))} required>
                    <option value="">Select student</option>
                    {students.map(s => (
                      <option key={s.student_id} value={s.student_id}>
                        {s.person.first_name} {s.person.last_name ?? ''} {s.enrollment_number ? `(${s.enrollment_number})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Chief Complaint *</label>
                  <input className="form-input" value={form.chief_complaint} onChange={e => setForm(p => ({ ...p, chief_complaint: e.target.value }))} required placeholder="e.g. Fever, Headache, Stomach pain" />
                </div>
                <div className="form-group">
                  <label>Doctor Name *</label>
                  <input className="form-input" value={form.doctor_name} onChange={e => setForm(p => ({ ...p, doctor_name: e.target.value }))} required placeholder="Dr. Name" />
                </div>
                <div className="form-group">
                  <label>Visit Date</label>
                  <input className="form-input" type="date" value={form.visit_date} onChange={e => setForm(p => ({ ...p, visit_date: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn btn-primary">Record Visit</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowVisitModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Sick Leave Modal */}
        {showSickLeaveModal && (
          <SickLeaveModal visitId={showSickLeaveModal} students={students} onClose={() => setShowSickLeaveModal('')} onSaved={() => { showMsg('Sick leave certificate issued!'); setShowSickLeaveModal(''); loadAll(); }} />
        )}
      </div>
    );
  }

  /* ── Inventory Tab ────────────────────────────────────────────────────────── */
  function InventoryTab() {
    const [form, setForm] = useState({ item_name: '', item_category: 'Medicine', unit: 'Tab', quantity_in_stock: '0', reorder_level: '10', expiry_date: '', batch_number: '', manufacturer: '' });

    const handleCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await medicalApi.createInventoryItem({
          ...form,
          quantity_in_stock: parseInt(form.quantity_in_stock),
          reorder_level: parseInt(form.reorder_level),
          expiry_date: form.expiry_date || undefined,
        });
        setShowInventoryModal(false);
        showMsg('Item added to inventory!');
        loadAll();
      } catch (err: any) { showMsg(err.message ?? 'Failed to add item', 'error'); }
    };

    const handleAdjust = async (itemId: string, delta: number) => {
      try {
        await medicalApi.adjustStock(itemId, delta, delta > 0 ? 'Stock in' : 'Dispensed');
        loadAll();
      } catch { showMsg('Stock adjustment failed', 'error'); }
    };

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: 'var(--text)' }}>Medical Inventory ({inventory.length} items)</h3>
          {canManage && (
            <button id="add-inventory-btn" className="btn btn-primary" onClick={() => setShowInventoryModal(true)}>+ Add Item</button>
          )}
        </div>

        {inventory.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💊</div>
            <h3>No inventory items</h3>
            <p>Add medicines and medical supplies to start tracking stock.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th><th>Category</th><th>Stock</th><th>Reorder Level</th>
                  <th>Expiry</th><th>Batch</th>{canManage && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {inventory.map(i => {
                  const isLow = i.quantity_in_stock <= i.reorder_level;
                  const isOut = i.quantity_in_stock === 0;
                  return (
                    <tr key={i.item_id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{i.item_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{i.unit}</div>
                      </td>
                      <td><span className="badge badge-info">{i.item_category}</span></td>
                      <td>
                        <span style={{ fontWeight: 700, color: isOut ? '#ef4444' : isLow ? '#f59e0b' : '#10b981', fontSize: '1.1rem' }}>
                          {i.quantity_in_stock}
                        </span>
                        {isLow && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: isOut ? '#ef4444' : '#f59e0b' }}>{isOut ? '● Out of stock' : '● Low'}</span>}
                      </td>
                      <td>{i.reorder_level}</td>
                      <td style={{ fontSize: '0.82rem' }}>{i.expiry_date ? fmt(i.expiry_date) : '—'}</td>
                      <td style={{ fontSize: '0.82rem' }}>{i.batch_number ?? '—'}</td>
                      {canManage && (
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleAdjust(i.item_id, 10)} title="Add 10 units">+10</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleAdjust(i.item_id, -1)} disabled={i.quantity_in_stock === 0} title="Dispense 1">-1</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {showInventoryModal && (
          <div className="modal-overlay" onClick={() => setShowInventoryModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
              <h2>Add Inventory Item</h2>
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label>Item Name *</label>
                  <input className="form-input" value={form.item_name} onChange={e => setForm(p => ({ ...p, item_name: e.target.value }))} required placeholder="e.g. Paracetamol 500mg" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Category</label>
                    <select className="form-input" value={form.item_category} onChange={e => setForm(p => ({ ...p, item_category: e.target.value }))}>
                      {['Medicine', 'Consumable', 'Equipment', 'Vaccine', 'Other'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Unit</label>
                    <select className="form-input" value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}>
                      {['Tab', 'Ml', 'Strip', 'Piece', 'Vial', 'Bottle', 'Sachet', 'Pair'].map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Opening Stock</label>
                    <input className="form-input" type="number" value={form.quantity_in_stock} onChange={e => setForm(p => ({ ...p, quantity_in_stock: e.target.value }))} min="0" />
                  </div>
                  <div className="form-group">
                    <label>Reorder Level</label>
                    <input className="form-input" type="number" value={form.reorder_level} onChange={e => setForm(p => ({ ...p, reorder_level: e.target.value }))} min="0" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Expiry Date</label>
                    <input className="form-input" type="date" value={form.expiry_date} onChange={e => setForm(p => ({ ...p, expiry_date: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Batch No.</label>
                    <input className="form-input" value={form.batch_number} onChange={e => setForm(p => ({ ...p, batch_number: e.target.value }))} placeholder="Optional" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Manufacturer</label>
                  <input className="form-input" value={form.manufacturer} onChange={e => setForm(p => ({ ...p, manufacturer: e.target.value }))} placeholder="Optional" />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn btn-primary">Add Item</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowInventoryModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Sick Leaves Tab ──────────────────────────────────────────────────────── */
  function SickLeavesTab() {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: 'var(--text)' }}>Sick Leave Certificates ({sickLeaves.length})</h3>
        </div>

        {sickLeaves.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📄</div>
            <h3>No sick leaves issued</h3>
            <p>Issue sick leave certificates from the OPD Visits tab.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Certificate No.</th><th>Student</th><th>Period</th>
                  <th>Days</th><th>Doctor</th><th>Remarks</th><th>Issued</th>
                </tr>
              </thead>
              <tbody>
                {sickLeaves.map(sl => (
                  <tr key={sl.sick_leave_id}>
                    <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{sl.certificate_number ?? '—'}</td>
                    <td>{sl.student_name ?? sl.student_id.slice(0, 8) + '…'}</td>
                    <td style={{ fontSize: '0.82rem' }}>{fmt(sl.leave_from)} – {fmt(sl.leave_to)}</td>
                    <td><span className="badge badge-warning">{sl.days} day{sl.days !== 1 ? 's' : ''}</span></td>
                    <td>Dr. {sl.doctor_name}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sl.remarks ?? '—'}</td>
                    <td style={{ fontSize: '0.78rem' }}>{fmt(sl.issued_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview',    label: 'Overview',    icon: '📊' },
    { id: 'visits',      label: 'OPD Visits',  icon: '🏥' },
    { id: 'inventory',   label: 'Inventory',   icon: '💊' },
    { id: 'sick-leaves', label: 'Sick Leaves', icon: '📄' },
  ];

  return (
    <>
      <Header title="Medical Center" subtitle="OPD · Inventory · Sick Leave Certificates" />
      <div className="page fade-in">
        {/* Toast */}
        {toast && (
          <div style={{ position: 'fixed', top: 20, right: 20, background: toastType === 'success' ? '#10b981' : '#ef4444', color: '#fff', padding: '12px 24px', borderRadius: 12, zIndex: 9999, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            {toast}
          </div>
        )}

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28, background: 'var(--surface)', padding: 6, borderRadius: 14, width: 'fit-content', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.id} id={`tab-medical-${t.id}`} onClick={() => setTab(t.id)}
              style={{ padding: '8px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s', background: tab === t.id ? 'var(--card)' : 'transparent', color: tab === t.id ? 'var(--text)' : 'var(--text-muted)', boxShadow: tab === t.id ? '0 2px 8px rgba(0,0,0,0.15)' : 'none' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading medical data…</div>
        ) : (
          <>
            {tab === 'overview'    && <OverviewTab />}
            {tab === 'visits'      && <VisitsTab />}
            {tab === 'inventory'   && <InventoryTab />}
            {tab === 'sick-leaves' && <SickLeavesTab />}
          </>
        )}
      </div>
    </>
  );
}

/* ─── Sick Leave Sub-Modal ───────────────────────────────────────────────────── */
function SickLeaveModal({ visitId, students, onClose, onSaved }: {
  visitId: string;
  students: Student[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    student_id: '', leave_from: '', leave_to: '',
    doctor_name: '', remarks: '', certificate_number: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await medicalApi.issueSickLeave({ ...form, visit_id: visitId });
    onSaved();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <h2>Issue Sick Leave Certificate</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label>Student *</label>
            <select className="form-input" value={form.student_id} onChange={e => setForm(p => ({ ...p, student_id: e.target.value }))} required>
              <option value="">Select student</option>
              {students.map(s => <option key={s.student_id} value={s.student_id}>{s.person.first_name} {s.person.last_name ?? ''}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Leave From *</label>
              <input className="form-input" type="date" value={form.leave_from} onChange={e => setForm(p => ({ ...p, leave_from: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Leave To *</label>
              <input className="form-input" type="date" value={form.leave_to} onChange={e => setForm(p => ({ ...p, leave_to: e.target.value }))} required />
            </div>
          </div>
          <div className="form-group">
            <label>Doctor Name *</label>
            <input className="form-input" value={form.doctor_name} onChange={e => setForm(p => ({ ...p, doctor_name: e.target.value }))} required placeholder="Dr. Name" />
          </div>
          <div className="form-group">
            <label>Certificate Number</label>
            <input className="form-input" value={form.certificate_number} onChange={e => setForm(p => ({ ...p, certificate_number: e.target.value }))} placeholder="SL-2026-001" />
          </div>
          <div className="form-group">
            <label>Remarks</label>
            <textarea className="form-input" rows={2} value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} placeholder="Medical advice, rest recommendations…" />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-primary">Issue Certificate</button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
