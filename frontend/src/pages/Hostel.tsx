import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { hostelApi, studentsApi } from '../api';
import { usePermissions } from '../hooks/usePermissions';

interface HostelRoom {
  room_id: string;
  hostel_name: string;
  room_number: string;
  room_type: string;
  capacity: number;
  available_beds: number;
  rent_amount: string;
}

interface HostelAllocation {
  allocation_id: string;
  room_id: string;
  hostel_name: string;
  room_number: string;
  room_type: string;
  student_id: string;
  student_name: string;
  start_date: string;
  end_date?: string | null;
  mess_plan: string;
  status: string;
  rent_amount: string;
}

interface Student {
  student_id: string;
  person: {
    first_name: string;
    last_name: string;
    email?: string;
  };
  enrollment_number?: string;
}

export default function Hostel() {
  const { can, role, isStudent, user } = usePermissions();
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [allocations, setAllocations] = useState<HostelAllocation[]>([]);
  const hasActiveAllocation = isStudent && allocations.some(a => a.status === 'Active');
  const [students, setStudents] = useState<Student[]>([]);
  const [activeTab, setActiveTab] = useState<'rooms' | 'allocate' | 'lodgers' | 'my-lodging' | 'tickets' | 'leaves' | 'mess'>('rooms');
  
  // Extra states
  const [tickets, setTickets] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [menus, setMenus] = useState<any[]>([]);
  const [messPreference, setMessPreference] = useState('Veg');

  const [ticketForm, setTicketForm] = useState({ issue_type: 'Plumbing', description: '' });
  const [leaveForm, setLeaveForm] = useState({ departure_date: '', return_date: '', reason: '' });
  const [menuForm, setMenuForm] = useState({ day_of_week: 'Monday', meal_type: 'Breakfast', items: '' });
  
  // Loading states
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  
  // Form states
  const [newRoom, setNewRoom] = useState({
    hostel_name: '',
    room_number: '',
    room_type: 'AC Double',
    capacity: 2,
    rent_amount: 5000.00
  });
  const [newAllocation, setNewAllocation] = useState({
    room_id: '',
    student_id: '',
    mess_plan: 'None'
  });
  
  // Search states
  const [roomSearch, setRoomSearch] = useState('');
  const [lodgerSearch, setLodgerSearch] = useState('');
  
  // Errors & success alerts
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const showAlert = (msg: string, isError = true) => {
    if (isError) {
      setError(msg);
      setSuccess('');
    } else {
      setSuccess(msg);
      setError('');
    }
    setTimeout(() => {
      setError('');
      setSuccess('');
    }, 5000);
  };

  const fetchRooms = () => {
    setLoadingRooms(true);
    hostelApi.rooms.list()
      .then(r => setRooms(r.data.data ?? []))
      .catch(() => showAlert('Failed to load rooms catalog'))
      .finally(() => setLoadingRooms(false));
  };

  const fetchAllocations = () => {
    if (!can('hostel.manage')) return;
    setLoadingAllocations(true);
    hostelApi.allocations.list()
      .then(r => setAllocations(r.data.data ?? []))
      .catch(() => showAlert('Failed to load active allocations'))
      .finally(() => setLoadingAllocations(false));
  };

  const fetchStudentAllocations = () => {
    if (!isStudent || !user?.user_id) return;
    setLoadingAllocations(true);
    
    studentsApi.list()
      .then(r => {
        const studentList = r.data.data ?? [];
        const ownStudent = studentList.find((s: Student) => s.person?.email === user?.username);
        const sid = ownStudent?.student_id || user?.user_id;
        
        hostelApi.allocations.listStudent(sid)
          .then(r2 => setAllocations(r2.data.data ?? []))
          .catch(err => console.warn('Request failed:', err));
      })
      .catch(() => {
        hostelApi.allocations.listStudent(user?.user_id ?? '')
          .then(r => setAllocations(r.data.data ?? []))
          .catch(err => console.warn('Request failed:', err));
      })
      .finally(() => setLoadingAllocations(false));
  };

  const fetchStudents = () => {
    if (!can('hostel.manage')) return;
    setLoadingStudents(true);
    studentsApi.list({ limit: 100 })
      .then(r => setStudents(r.data.data ?? []))
      .catch(err => console.warn('Request failed:', err))
      .finally(() => setLoadingStudents(false));
  };

  const fetchTickets = () => {
    hostelApi.maintenance.list()
      .then(r => setTickets(r.data.data ?? []))
      .catch(() => showAlert('Failed to load maintenance tickets'));
  };

  const fetchLeaves = () => {
    hostelApi.leaves.list()
      .then(r => setLeaves(r.data.data ?? []))
      .catch(() => showAlert('Failed to load leave requests'));
  };

  const fetchMenus = () => {
    hostelApi.mess.getMenus()
      .then(r => setMenus(r.data.data ?? []))
      .catch(() => showAlert('Failed to load mess menus'));
  };

  useEffect(() => {
    fetchRooms();
    if (can('hostel.manage')) {
      fetchAllocations();
      fetchStudents();
      fetchTickets();
      fetchLeaves();
      fetchMenus();
    } else if (isStudent) {
      fetchStudentAllocations();
      setActiveTab('my-lodging');
      fetchMenus();
    }
  }, [role]);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('hostel.manage')) return;
    
    if (!newRoom.hostel_name || !newRoom.room_number) {
      showAlert('Hostel Name and Room Number are required.');
      return;
    }

    hostelApi.rooms.create(newRoom)
      .then(() => {
        showAlert('Hostel Room registered successfully!', false);
        setNewRoom({ hostel_name: '', room_number: '', room_type: 'AC Double', capacity: 2, rent_amount: 5000.00 });
        fetchRooms();
      })
      .catch((err: any) => {
        showAlert(err.response?.data?.error || 'Failed to create room');
      });
  };

  const handleAllocateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('hostel.manage')) return;
    
    if (!newAllocation.room_id || !newAllocation.student_id) {
      showAlert('Room and Student are required.');
      return;
    }

    hostelApi.allocations.create(newAllocation)
      .then(() => {
        showAlert('Student allocated to hostel room successfully!', false);
        setNewAllocation({ room_id: '', student_id: '', mess_plan: 'None' });
        fetchRooms();
        fetchAllocations();
      })
      .catch((err: any) => {
        showAlert(err.response?.data?.error || 'Failed to allocate room');
      });
  };

  const handleVacateRoom = (allocationId: string) => {
    if (!can('hostel.manage')) return;
    
    hostelApi.allocations.vacate(allocationId)
      .then(() => {
        showAlert('Student has vacated the room successfully.', false);
        fetchRooms();
        fetchAllocations();
      })
      .catch((err: any) => {
        showAlert(err.response?.data?.error || 'Failed to vacate room');
      });
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (allocations.length === 0) return showAlert('You need an active room allocation to report issues.');
    hostelApi.maintenance.create({
      room_id: allocations[0].room_id,
      issue_type: ticketForm.issue_type,
      description: ticketForm.description
    })
      .then(() => {
        showAlert('Maintenance ticket submitted successfully!', false);
        setTicketForm({ issue_type: 'Plumbing', description: '' });
        fetchTickets();
      })
      .catch(() => showAlert('Failed to submit ticket'));
  };

  const handleResolveTicket = (ticketId: string) => {
    hostelApi.maintenance.update(ticketId, { status: 'Resolved' })
      .then(() => {
        showAlert('Ticket marked as resolved!', false);
        fetchTickets();
      })
      .catch(() => showAlert('Failed to update ticket'));
  };

  const handleCreateLeave = (e: React.FormEvent) => {
    e.preventDefault();
    hostelApi.leaves.create(leaveForm)
      .then(() => {
        showAlert('Leave request submitted successfully!', false);
        setLeaveForm({ departure_date: '', return_date: '', reason: '' });
        fetchLeaves();
      })
      .catch(() => showAlert('Failed to submit leave request'));
  };

  const handleApproveLeave = (leaveId: string, approve: boolean) => {
    const action = approve ? hostelApi.leaves.approve : hostelApi.leaves.reject;
    action(leaveId)
      .then(() => {
        showAlert(`Leave request ${approve ? 'approved' : 'rejected'} successfully!`, false);
        fetchLeaves();
      })
      .catch(() => showAlert('Failed to update leave request'));
  };

  const handleUpdateMessPreference = (e: React.FormEvent) => {
    e.preventDefault();
    hostelApi.mess.setPreference({ dietary_preference: messPreference })
      .then(() => showAlert('Mess preference updated successfully!', false))
      .catch(() => showAlert('Failed to update preference'));
  };

  const handleCreateMenu = (e: React.FormEvent) => {
    e.preventDefault();
    hostelApi.mess.createMenu(menuForm)
      .then(() => {
        showAlert('Menu item updated!', false);
        setMenuForm({ day_of_week: 'Monday', meal_type: 'Breakfast', items: '' });
        fetchMenus();
      })
      .catch(() => showAlert('Failed to update menu'));
  };

  // Filters
  const filteredRooms = rooms.filter(r => 
    r.hostel_name.toLowerCase().includes(roomSearch.toLowerCase()) ||
    r.room_number.includes(roomSearch) ||
    r.room_type.toLowerCase().includes(roomSearch.toLowerCase())
  );

  const filteredAllocations = allocations.filter(a => 
    a.hostel_name.toLowerCase().includes(lodgerSearch.toLowerCase()) ||
    a.room_number.includes(lodgerSearch) ||
    a.student_name.toLowerCase().includes(lodgerSearch.toLowerCase())
  );

  const activeLodgersCount = allocations.filter(a => a.status === 'Active').length;

  return (
    <>
      <Header 
        title="Hostel Management" 
        subtitle={isStudent ? "View your room stay allotment and mess plan details" : "Manage campus lodger stay allocations and mess billing details"} 
      />
      <div className="page fade-in">
        
        {/* Banner Alert messages */}
        {error && (
          <div className="alert alert-danger" style={{ padding: '0.85rem 1.25rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--accent-danger)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="alert alert-success" style={{ padding: '0.85rem 1.25rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--accent-success)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span>✅</span>
            <span>{success}</span>
          </div>
        )}

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
          {isStudent ? (
            <>
              <button 
                onClick={() => setActiveTab('my-lodging')} 
                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'my-lodging' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeTab === 'my-lodging' ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
              >
                🏢 My Stay Allotment
              </button>
              {hasActiveAllocation && (
                <>
                  <button 
                    onClick={() => setActiveTab('tickets')} 
                    style={{ background: 'none', border: 'none', borderBottom: activeTab === 'tickets' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeTab === 'tickets' ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
                  >
                    🔧 Maintenance
                  </button>
                  <button 
                    onClick={() => setActiveTab('leaves')} 
                    style={{ background: 'none', border: 'none', borderBottom: activeTab === 'leaves' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeTab === 'leaves' ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
                  >
                    📝 Leave Request
                  </button>
                  <button 
                    onClick={() => setActiveTab('mess')} 
                    style={{ background: 'none', border: 'none', borderBottom: activeTab === 'mess' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeTab === 'mess' ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
                  >
                    🍽️ Mess Menu
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button 
                onClick={() => setActiveTab('rooms')} 
                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'rooms' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeTab === 'rooms' ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
              >
                🏢 Rooms Inventory
              </button>
              <button 
                onClick={() => setActiveTab('allocate')} 
                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'allocate' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeTab === 'allocate' ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
              >
                ✍️ Allocate Room Desk
              </button>
              <button 
                onClick={() => setActiveTab('lodgers')} 
                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'lodgers' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeTab === 'lodgers' ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
              >
                👥 Active Lodgers ({activeLodgersCount})
              </button>
              <button 
                onClick={() => setActiveTab('tickets')} 
                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'tickets' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeTab === 'tickets' ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
              >
                🔧 Maintenance Tickets
              </button>
              <button 
                onClick={() => setActiveTab('leaves')} 
                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'leaves' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeTab === 'leaves' ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
              >
                📝 Leave Requests
              </button>
              <button 
                onClick={() => setActiveTab('mess')} 
                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'mess' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeTab === 'mess' ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
              >
                🍽️ Manage Mess
              </button>
            </>
          )}
        </div>

        {/* Tab 1: Rooms Inventory */}
        {activeTab === 'rooms' && !isStudent && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Search by Hostel Block, Room Number, Type..." 
                value={roomSearch} 
                onChange={e => setRoomSearch(e.target.value)} 
                style={{ flex: 1, minWidth: 280 }}
              />
              <button className="btn btn-secondary" onClick={fetchRooms}>🔄 Refresh</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
              {loadingRooms ? (
                <div style={{ color: 'var(--text-secondary)' }}>Loading rooms catalog...</div>
              ) : filteredRooms.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }}>No rooms registered yet.</div>
              ) : filteredRooms.map(room => {
                const hasBeds = room.available_beds > 0;
                return (
                  <div key={room.room_id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.25rem', border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent-secondary)', fontWeight: 600, padding: '0.25rem 0.5rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '4px' }}>
                          {room.room_type}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: hasBeds ? 'var(--accent-success)' : 'var(--accent-danger)', fontWeight: 600 }}>
                          ● {hasBeds ? `${room.available_beds} of ${room.capacity} beds available` : 'Full / Occupied'}
                        </span>
                      </div>
                      <h3 style={{ margin: '0.5rem 0 0.25rem 0', color: 'var(--text-primary)' }}>{room.hostel_name} — Room {room.room_number}</h3>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Rent / Month:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>INR {parseFloat(room.rent_amount).toFixed(2)}</strong>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Room creation form */}
            {can('hostel.manage') && (
              <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)', marginTop: '2rem' }}>
                <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>🏢 Register New Hostel Room</h2>
                <form onSubmit={handleCreateRoom} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Hostel Block Name *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Aryabhata Block" 
                      value={newRoom.hostel_name} 
                      onChange={e => setNewRoom({...newRoom, hostel_name: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Room Number *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. 101-A" 
                      value={newRoom.room_number} 
                      onChange={e => setNewRoom({...newRoom, room_number: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Room Type *</label>
                    <select 
                      className="form-input" 
                      value={newRoom.room_type} 
                      onChange={e => setNewRoom({...newRoom, room_type: e.target.value})}
                      required
                    >
                      <option value="AC Double">AC Double</option>
                      <option value="Non-AC Double">Non-AC Double</option>
                      <option value="AC Triple">AC Triple</option>
                      <option value="Non-AC Triple">Non-AC Triple</option>
                      <option value="Single Room">Single Room</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bed Capacity *</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      min={1} 
                      max={10} 
                      value={newRoom.capacity} 
                      onChange={e => setNewRoom({...newRoom, capacity: parseInt(e.target.value) || 2})} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Monthly Rent Amount (INR) *</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      min={0} 
                      value={newRoom.rent_amount} 
                      onChange={e => setNewRoom({...newRoom, rent_amount: parseFloat(e.target.value) || 0.0})} 
                      required 
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button type="submit" className="btn btn-primary">➕ Add Room</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Allocate Room Desk */}
        {activeTab === 'allocate' && can('hostel.manage') && (
          <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)', maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>✍️ Hostel Room Allocation Desk</h2>
            <form onSubmit={handleAllocateRoom} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div className="form-group">
                <label className="form-label">Select Student Profile *</label>
                {loadingStudents ? (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading student records...</span>
                ) : (
                  <select 
                    className="form-input" 
                    value={newAllocation.student_id} 
                    onChange={e => setNewAllocation({...newAllocation, student_id: e.target.value})}
                    required
                  >
                    <option value="">-- Choose Student --</option>
                    {students.map(st => (
                      <option key={st.student_id} value={st.student_id}>
                        {st.person?.first_name} {st.person?.last_name} ({st.enrollment_number || 'N/A'}) - {st.student_id.substring(0, 8)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Select Hostel Room *</label>
                <select 
                  className="form-input" 
                  value={newAllocation.room_id} 
                  onChange={e => setNewAllocation({...newAllocation, room_id: e.target.value})}
                  required
                >
                  <option value="">-- Choose Room --</option>
                  {rooms.filter(r => r.available_beds > 0).map(r => (
                    <option key={r.room_id} value={r.room_id}>
                      {r.hostel_name} — Room {r.room_number} ({r.room_type}, {r.available_beds} beds left)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Select Mess Plan *</label>
                <select 
                  className="form-input" 
                  value={newAllocation.mess_plan} 
                  onChange={e => setNewAllocation({...newAllocation, mess_plan: e.target.value})}
                  required
                >
                  <option value="None">None (0 INR)</option>
                  <option value="Veg">Vegetarian Mess (+ 2,000 INR / mo)</option>
                  <option value="Non-Veg">Non-Vegetarian Mess (+ 3,000 INR / mo)</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem', marginTop: '0.5rem', fontWeight: 600 }}>
                🚀 Check In / Allocate Stay
              </button>
            </form>
          </div>
        )}

        {/* Tab 3: Active Lodgers */}
        {activeTab === 'lodgers' && can('hostel.manage') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Filter stay allocations by lodger name, room number, block..." 
                value={lodgerSearch} 
                onChange={e => setLodgerSearch(e.target.value)} 
                style={{ flex: 1, minWidth: 280 }}
              />
              <button className="btn btn-secondary" onClick={fetchAllocations}>🔄 Refresh Logs</button>
            </div>

            <div className="card" style={{ padding: '1rem', border: '1px solid var(--border)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.75rem' }}>Room Stay</th>
                    <th style={{ padding: '0.75rem' }}>Lodger Details</th>
                    <th style={{ padding: '0.75rem' }}>Start Date</th>
                    <th style={{ padding: '0.75rem' }}>End Date</th>
                    <th style={{ padding: '0.75rem' }}>Mess Plan</th>
                    <th style={{ padding: '0.75rem' }}>Status</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingAllocations ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Loading lodging registry...
                      </td>
                    </tr>
                  ) : filteredAllocations.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No lodgers allocations recorded.
                      </td>
                    </tr>
                  ) : filteredAllocations.map(alloc => (
                    <tr key={alloc.allocation_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: 600 }}>{alloc.hostel_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Room {alloc.room_number} ({alloc.room_type})</div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div>{alloc.student_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{alloc.student_id}</div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>{alloc.start_date}</td>
                      <td style={{ padding: '0.75rem' }}>{alloc.end_date || 'Ongoing stay'}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-secondary)' }}>
                          {alloc.mess_plan}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 600, 
                          padding: '0.15rem 0.4rem', 
                          borderRadius: '4px',
                          background: alloc.status === 'Active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: alloc.status === 'Active' ? 'var(--accent-success)' : 'var(--accent-danger)'
                        }}>
                          {alloc.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {alloc.status === 'Active' && (
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleVacateRoom(alloc.allocation_id)}
                          >
                            🚪 Vacate Room
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Student Stay details */}
        {activeTab === 'my-lodging' && isStudent && (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            {loadingAllocations ? (
              <div style={{ color: 'var(--text-secondary)' }}>Loading stay details...</div>
            ) : allocations.length === 0 ? (
              <div className="card" style={{ padding: '2rem', textAlign: 'center', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '2.5rem' }}>🏢</span>
                <h3 style={{ margin: '1rem 0 0.5rem 0', color: 'var(--text-primary)' }}>No Active Stay Allocation</h3>
                <p>You have not been assigned to a hostel room. Please check with your registrar or hostel warden.</p>
              </div>
            ) : (
              <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)' }}>
                <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>🏢 Your Hostel stay Details</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Hostel Block:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{allocations[0].hostel_name}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Room Number:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{allocations[0].room_number}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Room Type:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{allocations[0].room_type}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Stay Status:</span>
                    <span style={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 600, 
                      padding: '0.15rem 0.4rem', 
                      borderRadius: '4px',
                      background: allocations[0].status === 'Active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: allocations[0].status === 'Active' ? 'var(--accent-success)' : 'var(--accent-danger)'
                    }}>
                      {allocations[0].status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Allotment Start Date:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{allocations[0].start_date}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Mess Plan:</span>
                    <strong style={{ color: 'var(--accent-secondary)' }}>{allocations[0].mess_plan}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Stay Rent / Month:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>INR {parseFloat(allocations[0].rent_amount).toFixed(2)}</strong>
                  </div>

                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Maintenance */}
        {activeTab === 'tickets' && (
          <div style={{ display: 'grid', gridTemplateColumns: isStudent ? '1fr' : '1fr', gap: '1.5rem' }}>
            {isStudent && (
              <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)' }}>
                <h3>🔧 Log Maintenance Issue</h3>
                <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Issue Type</label>
                    <select className="form-input" value={ticketForm.issue_type} onChange={e => setTicketForm({...ticketForm, issue_type: e.target.value})}>
                      <option value="Plumbing">Plumbing</option>
                      <option value="Electrical">Electrical</option>
                      <option value="Furniture">Furniture</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea className="form-input" placeholder="e.g. Fan speed regulator is broken" value={ticketForm.description} onChange={e => setTicketForm({...ticketForm, description: e.target.value})} required />
                  </div>
                  <button type="submit" className="btn btn-primary">Submit Ticket</button>
                </form>
              </div>
            )}

            <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)' }}>
              <h3>🔧 Active Tickets</h3>
              <div style={{ marginTop: '1rem' }}>
                {tickets.length === 0 ? <p>No maintenance tickets raised.</p> : tickets.map((t: any) => (
                  <div key={t.ticket_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <strong>{t.issue_type}</strong> - {t.description}
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status: {t.status}</div>
                    </div>
                    {!isStudent && t.status !== 'Resolved' && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleResolveTicket(t.ticket_id)}>Mark Resolved</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Leave Requests */}
        {activeTab === 'leaves' && (
          <div style={{ display: 'grid', gridTemplateColumns: isStudent ? '1fr' : '1fr', gap: '1.5rem' }}>
            {isStudent && (
              <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)' }}>
                <h3>📝 Request Leave</h3>
                <form onSubmit={handleCreateLeave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Departure Date</label>
                    <input type="date" className="form-input" value={leaveForm.departure_date} onChange={e => setLeaveForm({...leaveForm, departure_date: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Return Date</label>
                    <input type="date" className="form-input" value={leaveForm.return_date} onChange={e => setLeaveForm({...leaveForm, return_date: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reason</label>
                    <textarea className="form-input" placeholder="Warden permission reason..." value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})} required />
                  </div>
                  <button type="submit" className="btn btn-primary">Request Leave</button>
                </form>
              </div>
            )}

            <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)' }}>
              <h3>📝 Leave History</h3>
              <div style={{ marginTop: '1rem' }}>
                {leaves.length === 0 ? <p>No leaves requested.</p> : leaves.map((l: any) => (
                  <div key={l.leave_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <strong>Leave from {l.departure_date} to {l.return_date}</strong>
                      <p style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>{l.reason}</p>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status: {l.status}</div>
                    </div>
                    {!isStudent && l.status === 'Pending' && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => handleApproveLeave(l.leave_id, true)}>Approve</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleApproveLeave(l.leave_id, false)}>Reject</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 7: Mess Management */}
        {activeTab === 'mess' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
            {isStudent ? (
              <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)' }}>
                <h3>🍽️ Dietary Preference</h3>
                <form onSubmit={handleUpdateMessPreference} style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem' }}>
                  <select className="form-input" value={messPreference} onChange={e => setMessPreference(e.target.value)}>
                    <option value="Veg">Vegetarian</option>
                    <option value="Non-Veg">Non-Vegetarian</option>
                    <option value="Vegan">Vegan</option>
                    <option value="Eggitarian">Eggitarian</option>
                  </select>
                  <button type="submit" className="btn btn-primary">Update Preference</button>
                </form>
              </div>
            ) : (
              <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)' }}>
                <h3>🍽️ Add Mess Menu Items</h3>
                <form onSubmit={handleCreateMenu} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Day of Week</label>
                    <select className="form-input" value={menuForm.day_of_week} onChange={e => setMenuForm({...menuForm, day_of_week: e.target.value})}>
                      <option value="Monday">Monday</option>
                      <option value="Tuesday">Tuesday</option>
                      <option value="Wednesday">Wednesday</option>
                      <option value="Thursday">Thursday</option>
                      <option value="Friday">Friday</option>
                      <option value="Saturday">Saturday</option>
                      <option value="Sunday">Sunday</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Meal Type</label>
                    <select className="form-input" value={menuForm.meal_type} onChange={e => setMenuForm({...menuForm, meal_type: e.target.value})}>
                      <option value="Breakfast">Breakfast</option>
                      <option value="Lunch">Lunch</option>
                      <option value="Dinner">Dinner</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Items</label>
                    <input type="text" className="form-input" placeholder="e.g. Idli, Sambhar, Chutney" value={menuForm.items} onChange={e => setMenuForm({...menuForm, items: e.target.value})} required />
                  </div>
                  <button type="submit" className="btn btn-primary">Save Menu</button>
                </form>
              </div>
            )}

            <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)' }}>
              <h3>🍽️ Weekly Mess Menu</h3>
              <div style={{ marginTop: '1rem' }}>
                {menus.length === 0 ? <p>No mess menus configured yet.</p> : menus.map((m: any) => (
                  <div key={m.menu_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <strong>{m.day_of_week} - {m.meal_type}</strong>
                    </div>
                    <div>{m.items}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
