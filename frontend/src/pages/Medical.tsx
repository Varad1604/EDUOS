import React, { useEffect, useState, useCallback } from 'react';
import Header from '../components/Header';
import { medicalApi, studentsApi } from '../api';
import { usePermissions } from '../hooks/usePermissions';

/* ─── Types ──────────────────────────────────────────────────────────────────── */
interface MedVisit {
  visit_id: string; student_id: string; student_name?: string; roll_number?: string;
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
  const [showVitalsModal, setShowVitalsModal] = useState<string>(''); // visit_id
  const [showPrescriptionModal, setShowPrescriptionModal] = useState<string>(''); // visit_id
  const [showDispenseModal, setShowDispenseModal] = useState<any>(null); //General item or general form

  const [visitDetails, setVisitDetails] = useState<Record<string, { vitals?: any[], prescriptions?: any[] }>>({});

  const loadVisitDetails = async (visitId: string) => {
    try {
      const [vits, pres] = await Promise.all([
        medicalApi.getVitals(visitId).catch(() => []),
        medicalApi.getPrescriptions(visitId).catch(() => []),
      ]);
      setVisitDetails(prev => ({
        ...prev,
        [visitId]: { vitals: vits, prescriptions: pres }
      }));
    } catch (err) {
      console.warn("Failed to fetch visit details", err);
    }
  };

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
        .catch(err => console.warn('Request failed:', err));
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
            {visits.map(v => {
              const details = visitDetails[v.visit_id];
              return (
                <div key={v.visit_id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>{v.chief_complaint}</span>
                        {pill(v.status)}
                      </div>
                      <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                        👤 Student: <strong>{v.student_name ?? v.student_id}</strong> ({v.roll_number})
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
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => {
                        if (details) {
                          setVisitDetails(prev => {
                            const copy = { ...prev };
                            delete copy[v.visit_id];
                            return copy;
                          });
                        } else {
                          loadVisitDetails(v.visit_id);
                        }
                      }}>
                        {details ? '▲ Hide Medical File' : '▼ View Medical File'}
                      </button>
                      {canManage && v.status === 'Open' && (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={() => setShowVitalsModal(v.visit_id)}>📊 Vitals</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setShowPrescriptionModal(v.visit_id)}>💊 Prescribe</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setShowSickLeaveModal(v.visit_id)}>📄 Leave Cert</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleClose(v.visit_id)}>🚪 Close Case</button>
                        </>
                      )}
                    </div>
                  </div>

                  {details && (
                    <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'rgba(99, 102, 241, 0.03)', borderRadius: '8px', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>📊 Patient Vitals</h4>
                        {!details.vitals || details.vitals.length === 0 ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No vitals recorded.</span>
                        ) : (
                          <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div>Temp: <strong>{details.vitals[0].temperature_c ?? 'N/A'} °C</strong></div>
                            <div>Pulse: <strong>{details.vitals[0].pulse_bpm ?? 'N/A'} bpm</strong></div>
                            <div>BP: <strong>{details.vitals[0].bp_systolic ?? 'N/A'}/{details.vitals[0].bp_diastolic ?? 'N/A'} mmHg</strong></div>
                            <div>SpO2: <strong>{details.vitals[0].spo2_pct ?? 'N/A'}%</strong></div>
                            <div>Weight: <strong>{details.vitals[0].weight_kg ?? 'N/A'} kg</strong></div>
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>💊 Prescribed Treatment</h4>
                        {!details.prescriptions || details.prescriptions.length === 0 ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No prescriptions issued.</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {details.prescriptions.map((pr: any) => (
                              <div key={pr.prescription_id} style={{ fontSize: '0.8rem', borderBottom: '1px dashed var(--border)', paddingBottom: '0.25rem' }}>
                                <div><strong>{pr.medicine_name}</strong> - {pr.dosage} ({pr.route})</div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Frequency: {pr.frequency} · Duration: {pr.duration_days} days</div>
                                {pr.instructions && <div style={{ fontSize: '0.72rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>* {pr.instructions}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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

        {/* Vitals Modal */}
        {showVitalsModal && (
          <VitalsModal visitId={showVitalsModal} onClose={() => setShowVitalsModal('')} onSaved={() => { showMsg('Vitals recorded successfully!'); setShowVitalsModal(''); loadVisitDetails(showVitalsModal); }} />
        )}

        {/* Prescription Modal */}
        {showPrescriptionModal && (
          <PrescriptionModal visitId={showPrescriptionModal} onClose={() => setShowPrescriptionModal('')} onSaved={() => { showMsg('Prescription recorded!'); setShowPrescriptionModal(''); loadVisitDetails(showPrescriptionModal); }} />
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
            <div style={{ display: 'flex', gap: 12 }}>
              <button id="dispense-medicine-btn" className="btn btn-secondary" onClick={() => setShowDispenseModal(true)}>💊 Dispense Medicine</button>
              <button id="add-inventory-btn" className="btn btn-primary" onClick={() => setShowInventoryModal(true)}>+ Add Item</button>
            </div>
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

        {showDispenseModal && (
          <DispenseModal inventory={inventory} onClose={() => setShowDispenseModal(false)} onSaved={() => { showMsg('Medicine dispensed successfully!'); setShowDispenseModal(false); loadAll(); }} />
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

/* ─── Vitals Sub-Modal ──────────────────────────────────────────────────────── */
function VitalsModal({ visitId, onClose, onSaved }: { visitId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    temperature_c: '', pulse_bpm: '', bp_systolic: '', bp_diastolic: '', spo2_pct: '', weight_kg: '', height_cm: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await medicalApi.recordVitals(visitId, {
        temperature_c: form.temperature_c ? parseFloat(form.temperature_c) : null,
        pulse_bpm: form.pulse_bpm ? parseInt(form.pulse_bpm) : null,
        bp_systolic: form.bp_systolic ? parseInt(form.bp_systolic) : null,
        bp_diastolic: form.bp_diastolic ? parseInt(form.bp_diastolic) : null,
        spo2_pct: form.spo2_pct ? parseFloat(form.spo2_pct) : null,
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
        height_cm: form.height_cm ? parseFloat(form.height_cm) : null
      });
      onSaved();
    } catch (err: any) {
      alert(err.message || 'Failed to record vitals');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <h2>Record Vitals</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Temperature (°C)</label>
              <input className="form-input" type="number" step="0.1" value={form.temperature_c} onChange={e => setForm(p => ({ ...p, temperature_c: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Pulse (BPM)</label>
              <input className="form-input" type="number" value={form.pulse_bpm} onChange={e => setForm(p => ({ ...p, pulse_bpm: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>BP Systolic (mmHg)</label>
              <input className="form-input" type="number" value={form.bp_systolic} onChange={e => setForm(p => ({ ...p, bp_systolic: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>BP Diastolic (mmHg)</label>
              <input className="form-input" type="number" value={form.bp_diastolic} onChange={e => setForm(p => ({ ...p, bp_diastolic: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>SpO2 (%)</label>
              <input className="form-input" type="number" step="0.1" value={form.spo2_pct} onChange={e => setForm(p => ({ ...p, spo2_pct: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Weight (kg)</label>
              <input className="form-input" type="number" step="0.1" value={form.weight_kg} onChange={e => setForm(p => ({ ...p, weight_kg: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Height (cm)</label>
              <input className="form-input" type="number" step="0.1" value={form.height_cm} onChange={e => setForm(p => ({ ...p, height_cm: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-primary">Save Vitals</button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Prescription Sub-Modal ────────────────────────────────────────────────── */
function PrescriptionModal({ visitId, onClose, onSaved }: { visitId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    medicine_name: '', dosage: '', frequency: 'OD', duration_days: '5', route: 'Oral', instructions: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await medicalApi.createPrescription({
        visit_id: visitId,
        medicine_name: form.medicine_name,
        dosage: form.dosage,
        frequency: form.frequency,
        duration_days: parseInt(form.duration_days),
        route: form.route,
        instructions: form.instructions || null
      });
      onSaved();
    } catch (err: any) {
      alert(err.message || 'Failed to prescribe medicine');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <h2>Issue Prescription</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label>Medicine Name *</label>
            <input className="form-input" value={form.medicine_name} onChange={e => setForm(p => ({ ...p, medicine_name: e.target.value }))} required placeholder="e.g. Paracetamol 650mg" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Dosage *</label>
              <input className="form-input" value={form.dosage} onChange={e => setForm(p => ({ ...p, dosage: e.target.value }))} required placeholder="e.g. 1 Tablet" />
            </div>
            <div className="form-group">
              <label>Duration (days) *</label>
              <input className="form-input" type="number" value={form.duration_days} onChange={e => setForm(p => ({ ...p, duration_days: e.target.value }))} required />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Frequency</label>
              <select className="form-input" value={form.frequency} onChange={e => setForm(p => ({ ...p, frequency: e.target.value }))}>
                {['OD', 'BD', 'TDS', 'QID', 'SOS', 'PRN'].map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Route</label>
              <select className="form-input" value={form.route} onChange={e => setForm(p => ({ ...p, route: e.target.value }))}>
                {['Oral', 'Topical', 'IV', 'IM', 'Sublingual', 'Inhalation', 'Other'].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Instructions</label>
            <textarea className="form-input" rows={2} value={form.instructions} onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))} placeholder="Take after meals, avoid cold water…" />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-primary">Add Prescription</button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Pharmacy Dispense Modal ───────────────────────────────────────────────── */
function DispenseModal({ inventory, onClose, onSaved }: { inventory: any[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    item_id: '', quantity: '1'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.item_id) return alert('Select medicine first');
    try {
      await medicalApi.adjustStock(form.item_id, -parseInt(form.quantity), 'Dispensed');
      onSaved();
    } catch (err: any) {
      alert(err.message || 'Dispensing failed');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <h2>Pharmacy Dispensing Desk</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label>Select Medicine from Inventory *</label>
            <select className="form-input" value={form.item_id} onChange={e => setForm(p => ({ ...p, item_id: e.target.value }))} required>
              <option value="">-- Choose Item --</option>
              {inventory.map(item => (
                <option key={item.item_id} value={item.item_id}>
                  {item.item_name} (Category: {item.item_category} · Current Stock: {item.quantity_in_stock} {item.unit})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Quantity to Dispense *</label>
            <input className="form-input" type="number" min="1" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} required />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="submit" className="btn btn-primary">Dispense Medicine</button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
