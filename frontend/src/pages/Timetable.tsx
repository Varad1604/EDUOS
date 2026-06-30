import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import { academicsApi } from '../api';
import { useAuthStore } from '../store';

interface ClassItem {
  class_id: string;
  semester: number;
  section: string;
  academic_year: number;
}

interface AllocationItem {
  allocation_id: string;
  class_id: string;
  course_code: string;
  course_name: string;
  faculty_name: string;
}

interface TimetableSlot {
  slot_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room?: string;
  building?: string;
  course_code: string;
  course_name: string;
  faculty_name: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const PERIODS = [
  { label: '09:00 - 10:00', start: '09:00', end: '10:00' },
  { label: '10:00 - 11:00', start: '10:00', end: '11:00' },
  { label: '11:00 - 12:00', start: '11:00', end: '12:00' },
  { label: '12:00 - 13:00', start: '12:00', end: '13:00' },
  { label: '13:00 - 14:00', start: '13:00', end: '14:00', isBreak: true, labelText: '🍱 LUNCH BREAK' },
  { label: '14:00 - 15:00', start: '14:00', end: '15:00' },
  { label: '15:00 - 16:00', start: '15:00', end: '16:00' },
  { label: '16:00 - 17:00', start: '16:00', end: '17:00' },
];

export default function Timetable() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [allocations, setAllocations] = useState<AllocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const { user } = useAuthStore();

  // Form State
  const [allocationId, setAllocationId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [room, setRoom] = useState('');
  const [building, setBuilding] = useState('');
  const [error, setError] = useState('');

  // Create Class modal
  const [showClassModal, setShowClassModal] = useState(false);
  const [classForm, setClassForm] = useState({ semester: '1', section: 'A', academic_year: new Date().getFullYear().toString() });
  const [classError, setClassError] = useState('');

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setClassError('');
    const instId = user?.institution_id;
    if (!instId) {
      setClassError('No active institution context found.');
      return;
    }
    try {
      await academicsApi.classes.create({
        institution_id: instId,
        semester: parseInt(classForm.semester),
        section: classForm.section,
        academic_year: parseInt(classForm.academic_year),
      });
      setShowClassModal(false);
      academicsApi.classes.list().then(r => {
        const list = r.data.data ?? [];
        setClasses(list);
        if (list.length > 0) setSelectedClassId(list[list.length - 1].class_id);
      });
    } catch (err: any) {
      setClassError(err?.response?.data?.errors?.[0]?.message ?? 'Failed to create class');
    }
  };

  const canEdit = user?.role_name === 'Principal' || user?.role_name === 'Registrar';

  useEffect(() => {
    // Fetch initial classes and allocations
    academicsApi.classes.list()
      .then(r => {
        const clsList = r.data.data ?? [];
        setClasses(clsList);
        if (clsList.length > 0) {
          setSelectedClassId(clsList[0].class_id);
        }
      })
      .catch(err => console.warn('Request failed:', err));

    academicsApi.courseAllocations.list()
      .then(r => {
        setAllocations(r.data.data ?? []);
      })
      .catch(err => console.warn('Request failed:', err));
  }, []);

  const fetchTimetable = (classId: string) => {
    if (!classId) return;
    setLoading(true);
    academicsApi.timetable.get(classId)
      .then(r => {
        setSlots(r.data.data ?? []);
      })
      .catch(err => console.warn('Request failed:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selectedClassId) {
      fetchTimetable(selectedClassId);
    }
  }, [selectedClassId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!allocationId) {
      setError('Please select a course allocation');
      return;
    }

    const payload = {
      class_id: selectedClassId,
      course_allocation_id: allocationId,
      day_of_week: dayOfWeek,
      start_time: startTime + ':00',
      end_time: endTime + ':00',
      room: room || null,
      building: building || null,
    };

    academicsApi.timetable.create(payload)
      .then(() => {
        setShowAddModal(false);
        setRoom('');
        setBuilding('');
        fetchTimetable(selectedClassId);
      })
      .catch(err => {
        setError(err.response?.data?.errors?.[0]?.message || 'Failed to create slot (Check for room clashes!)');
      });
  };

  const handleCellClick = (day: number, start: string, end: string) => {
    if (!canEdit) return;
    setDayOfWeek(day);
    setStartTime(start);
    setEndTime(end);
    setAllocationId('');
    setRoom('');
    setBuilding('');
    setError('');
    setShowAddModal(true);
  };

  // Filter allocations that match the selected class ID
  const classAllocations = allocations.filter(a => a.class_id === selectedClassId);

  return (
    <>
      <Header title="Timetable" subtitle="Daily class schedules and room assignments" />
      <div className="page fade-in">
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1>Class Timetable</h1>
            <p>Manage schedules by selecting a class</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {selectedClassId && (
              <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                <button
                  type="button"
                  className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: 0, padding: '0.5rem 1rem', border: 'none', cursor: 'pointer', transition: 'none' }}
                  onClick={() => setViewMode('grid')}
                >
                  🎛️ Grid View
                </button>
                <button
                  type="button"
                  className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: 0, padding: '0.5rem 1rem', border: 'none', cursor: 'pointer', transition: 'none' }}
                  onClick={() => setViewMode('list')}
                >
                  📋 List View
                </button>
              </div>
            )}
            <select
              className="form-select"
              style={{ minWidth: '220px' }}
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
            >
              <option value="">-- Select Class --</option>
              {classes.map(c => (
                <option key={c.class_id} value={c.class_id}>
                  Semester {c.semester} - Section {c.section} (Year {c.academic_year})
                </option>
              ))}
            </select>
          {canEdit && (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowClassModal(true)}>+ Create Class</button>
              {selectedClassId && (
                <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Schedule Slot</button>
              )}
            </div>
          )}
          </div>
        </div>

        {/* Create Class Modal */}
        {showClassModal && (
          <div className="modal-overlay" onClick={() => setShowClassModal(false)}>
            <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
              <h2>Create New Class</h2>
              {classError && <div className="login-error" style={{ marginBottom: 12 }}>{classError}</div>}
              <form onSubmit={handleCreateClass} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Semester *</label>
                    <select className="form-select" value={classForm.semester} onChange={e => setClassForm(p => ({ ...p, semester: e.target.value }))}>
                      {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Section *</label>
                    <input className="form-input" value={classForm.section} onChange={e => setClassForm(p => ({ ...p, section: e.target.value }))} placeholder="e.g. A, B, CSE-A" required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Academic Year</label>
                  <input className="form-input" type="number" value={classForm.academic_year} onChange={e => setClassForm(p => ({ ...p, academic_year: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn btn-primary">Create Class</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowClassModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {showAddModal && (
          <div className="card" style={{ marginBottom: '1.5rem', maxWidth: '500px', border: '1px solid var(--accent-primary)' }}>
            <div className="card-header">
              <h3>Create Timetable Slot</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            {error && <div className="login-error">{error}</div>}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Course & Faculty Allocation *</label>
                <select className="form-select" value={allocationId} onChange={e => setAllocationId(e.target.value)}>
                  <option value="">-- Choose Allocation --</option>
                  {classAllocations.map(a => (
                    <option key={a.allocation_id} value={a.allocation_id}>
                      {a.course_code} - {a.course_name} ({a.faculty_name})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Day of Week *</label>
                <select className="form-select" value={dayOfWeek} onChange={e => setDayOfWeek(parseInt(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6].map(d => (
                    <option key={d} value={d}>{DAYS[d - 1]}</option>
                  ))}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Start Time *</label>
                  <input type="time" className="form-input" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">End Time *</label>
                  <input type="time" className="form-input" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Room Number</label>
                  <input className="form-input" placeholder="e.g. 101" value={room} onChange={e => setRoom(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Building</label>
                  <input className="form-input" placeholder="e.g. Main Block" value={building} onChange={e => setBuilding(e.target.value)} />
                </div>
              </div>
              <button className="btn btn-primary" type="submit">Add to Schedule</button>
            </form>
          </div>
        )}


        <div className="card">
          {!selectedClassId ? (
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <h3>No class selected</h3>
              <p>Select a class from the dropdown above to view the schedule.</p>
            </div>
          ) : loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ animation: 'pulse 1.5s infinite' }}>Loading timetable…</div>
            </div>
          ) : slots.length === 0 && viewMode === 'list' ? (
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <h3>Empty Timetable</h3>
              <p>No slots scheduled for this class yet.</p>
            </div>
          ) : (
            viewMode === 'grid' ? (
              <div className="table-wrap" style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '850px', tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ background: 'var(--card-bg-secondary)' }}>
                      <th style={{ width: '110px', padding: '0.75rem', border: '1px solid var(--border-color)', textAlign: 'center' }}>Time</th>
                      {DAYS.map((d) => (
                        <th key={d} style={{ padding: '0.75rem', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERIODS.map(period => (
                      <tr key={period.label} style={period.isBreak ? { background: 'rgba(245,158,11,0.04)' } : {}}>
                        <td style={{
                          padding: '0.75rem',
                          border: '1px solid var(--border-color)',
                          textAlign: 'center',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)'
                        }}>
                          {period.label}
                        </td>
                        {period.isBreak ? (
                          <td colSpan={6} style={{
                            padding: '0.75rem',
                            border: '1px solid var(--border-color)',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            letterSpacing: '2px',
                            color: 'var(--accent-warning)',
                            fontSize: '0.85rem'
                          }}>
                            {period.labelText}
                          </td>
                        ) : (
                          [1, 2, 3, 4, 5, 6].map(dayNum => {
                            const slot = slots.find(s => {
                              if (s.day_of_week !== dayNum) return false;
                              const sStart = s.start_time.slice(0, 5);
                              const sEnd = s.end_time.slice(0, 5);
                              return sStart < period.end && sEnd > period.start;
                            });

                            if (slot) {
                              return (
                                <td key={dayNum} style={{
                                  padding: '6px',
                                  border: '1px solid var(--border-color)',
                                  verticalAlign: 'top',
                                  height: '95px'
                                }}>
                                  <div style={{
                                    background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.1))',
                                    borderLeft: '4px solid var(--accent-primary)',
                                    borderRadius: '4px',
                                    padding: '8px',
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                  }}>
                                    <div>
                                      <div style={{ fontWeight: 'bold', color: 'var(--accent-primary)', fontSize: '0.8rem', marginBottom: '2px' }}>
                                        {slot.course_code}
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1rem', maxHeight: '2rem' }} title={slot.course_name}>
                                        {slot.course_name}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        👤 {slot.faculty_name}
                                      </div>
                                      {slot.room && (
                                        <div style={{
                                          fontSize: '0.65rem',
                                          color: 'var(--accent-success)',
                                          background: 'rgba(16,185,129,0.08)',
                                          padding: '2px 5px',
                                          borderRadius: '3px',
                                          width: 'fit-content',
                                          marginTop: '2px',
                                          fontWeight: 600
                                        }}>
                                          🚪 Room {slot.room}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              );
                            }

                            return (
                              <td
                                key={dayNum}
                                onClick={() => handleCellClick(dayNum, period.start, period.end)}
                                style={{
                                  padding: '6px',
                                  border: '1px solid var(--border-color)',
                                  cursor: canEdit ? 'pointer' : 'default',
                                  transition: 'background-color 0.2s',
                                  height: '95px'
                                }}
                                onMouseEnter={e => { if (canEdit) e.currentTarget.style.backgroundColor = 'var(--card-bg-secondary)'; }}
                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                              >
                                {canEdit && (
                                  <div style={{
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-muted)',
                                    opacity: 0.15,
                                    fontSize: '1.25rem',
                                    border: '1px dashed var(--text-muted)',
                                    borderRadius: '4px'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.opacity = '0.6'}
                                  onMouseLeave={e => e.currentTarget.style.opacity = '0.15'}
                                  >
                                    +
                                  </div>
                                )}
                              </td>
                            );
                          })
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="table-wrap">
                {slots.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">📅</div>
                    <h3>Empty Timetable</h3>
                    <p>No slots scheduled for this class yet.</p>
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Time Slot</th>
                        <th>Course Code</th>
                        <th>Course Name</th>
                        <th>Faculty</th>
                        <th>Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slots.map(s => (
                        <tr key={s.slot_id}>
                          <td style={{ fontWeight: 600 }}>{DAYS[s.day_of_week - 1]}</td>
                          <td>
                            <span className="badge badge-info" style={{ fontFamily: 'monospace' }}>
                              {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
                            </span>
                          </td>
                          <td style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{s.course_code}</td>
                          <td>{s.course_name}</td>
                          <td>{s.faculty_name}</td>
                          <td>
                            {s.room ? `${s.room} (${s.building ?? 'Main Block'})` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}
