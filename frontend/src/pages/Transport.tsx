import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { transportApi, studentsApi } from '../api';
import { usePermissions } from '../hooks/usePermissions';

interface TransportRoute {
  route_id: string;
  route_code: string;
  route_name: string;
  start_location: string;
  end_location: string;
}

interface TransportStop {
  stop_id: string;
  route_id: string;
  stop_name: string;
  pickup_time: string;
  fare_amount: string;
}

interface TransportVehicle {
  vehicle_id: string;
  vehicle_number: string;
  capacity: number;
  available_seats: number;
  driver_name?: string | null;
  driver_phone?: string | null;
  status: string;
}

interface TransportAllocation {
  allocation_id: string;
  route_id: string;
  route_code: string;
  route_name: string;
  stop_id: string;
  stop_name: string;
  pickup_time: string;
  vehicle_id: string;
  vehicle_number: string;
  driver_name?: string | null;
  driver_phone?: string | null;
  student_id: string;
  student_name: string;
  start_date: string;
  end_date?: string | null;
  status: string;
  fare_amount: string;
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

export default function Transport() {
  const { can, role, isStudent, user } = usePermissions();
  
  // Data state
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [stops, setStops] = useState<TransportStop[]>([]);
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([]);
  const [allocations, setAllocations] = useState<TransportAllocation[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  // Selected state for stop listing
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  
  // Tab control
  const [activeTab, setActiveTab] = useState<'routes' | 'vehicles' | 'allocate' | 'passengers' | 'my-transport'>('routes');
  
  // Loading indicators
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [loadingStops, setLoadingStops] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  
  // Form input states
  const [newRoute, setNewRoute] = useState({
    route_code: '',
    route_name: '',
    start_location: '',
    end_location: ''
  });
  const [newStop, setNewStop] = useState({
    stop_name: '',
    pickup_time: '',
    fare_amount: 1000.00
  });
  const [newVehicle, setNewVehicle] = useState({
    vehicle_number: '',
    capacity: 30,
    driver_name: '',
    driver_phone: ''
  });
  const [newAllocation, setNewAllocation] = useState({
    student_id: '',
    route_id: '',
    stop_id: '',
    vehicle_id: ''
  });
  
  // Filtering & Search
  const [routeSearch, setRouteSearch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [passengerSearch, setPassengerSearch] = useState('');
  
  // Success & Error banner states
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

  const fetchRoutes = () => {
    setLoadingRoutes(true);
    transportApi.routes.list()
      .then(r => setRoutes(r.data.data ?? []))
      .catch(() => showAlert('Failed to load transport routes catalog'))
      .finally(() => setLoadingRoutes(false));
  };

  const fetchStops = (routeId: string) => {
    if (!routeId) {
      setStops([]);
      return;
    }
    setLoadingStops(true);
    transportApi.routes.listStops(routeId)
      .then(r => setStops(r.data.data ?? []))
      .catch(() => showAlert('Failed to load route stops'))
      .finally(() => setLoadingStops(false));
  };

  const fetchVehicles = () => {
    if (!can('transport.manage')) return;
    setLoadingVehicles(true);
    transportApi.vehicles.list()
      .then(r => setVehicles(r.data.data ?? []))
      .catch(() => showAlert('Failed to load vehicle registry'))
      .finally(() => setLoadingVehicles(false));
  };

  const fetchAllocations = () => {
    if (!can('transport.manage')) return;
    setLoadingAllocations(true);
    transportApi.allocations.list()
      .then(r => setAllocations(r.data.data ?? []))
      .catch(() => showAlert('Failed to load active passenger list'))
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
        
        transportApi.allocations.listStudent(sid)
          .then(r2 => setAllocations(r2.data.data ?? []))
          .catch(() => {});
      })
      .catch(() => {
        transportApi.allocations.listStudent(user?.user_id ?? '')
          .then(r => setAllocations(r.data.data ?? []))
          .catch(() => {});
      })
      .finally(() => setLoadingAllocations(false));
  };

  const fetchStudents = () => {
    if (!can('transport.manage')) return;
    setLoadingStudents(true);
    studentsApi.list({ limit: 100 })
      .then(r => setStudents(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingStudents(false));
  };

  useEffect(() => {
    fetchRoutes();
    if (can('transport.manage')) {
      fetchVehicles();
      fetchAllocations();
      fetchStudents();
    } else if (isStudent) {
      fetchStudentAllocations();
      setActiveTab('my-transport');
    }
  }, [role]);

  // Load stops when selected route changes
  useEffect(() => {
    fetchStops(selectedRouteId);
  }, [selectedRouteId]);

  const handleCreateRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('transport.manage')) return;
    
    if (!newRoute.route_code || !newRoute.route_name || !newRoute.start_location || !newRoute.end_location) {
      showAlert('All route parameters are required.');
      return;
    }

    transportApi.routes.create(newRoute)
      .then(() => {
        showAlert('Transport Route registered successfully!', false);
        setNewRoute({ route_code: '', route_name: '', start_location: '', end_location: '' });
        fetchRoutes();
      })
      .catch((err: any) => {
        showAlert(err.response?.data?.error || 'Failed to create route');
      });
  };

  const handleCreateStop = (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('transport.manage')) return;
    if (!selectedRouteId) {
      showAlert('Please select a route first.');
      return;
    }
    if (!newStop.stop_name || !newStop.pickup_time) {
      showAlert('Stop Name and Pickup Time are required.');
      return;
    }

    transportApi.stops.create({
      route_id: selectedRouteId,
      ...newStop
    })
    .then(() => {
      showAlert('Bus Stop added successfully!', false);
      setNewStop({ stop_name: '', pickup_time: '', fare_amount: 1000.00 });
      fetchStops(selectedRouteId);
    })
    .catch((err: any) => {
      showAlert(err.response?.data?.error || 'Failed to add stop');
    });
  };

  const handleCreateVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('transport.manage')) return;
    if (!newVehicle.vehicle_number || !newVehicle.capacity) {
      showAlert('Vehicle Number and Capacity are required.');
      return;
    }

    transportApi.vehicles.create(newVehicle)
      .then(() => {
        showAlert('Transport vehicle registered successfully!', false);
        setNewVehicle({ vehicle_number: '', capacity: 30, driver_name: '', driver_phone: '' });
        fetchVehicles();
      })
      .catch((err: any) => {
        showAlert(err.response?.data?.error || 'Failed to register vehicle');
      });
  };

  const handleAllocateTransport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('transport.manage')) return;
    if (!newAllocation.student_id || !newAllocation.route_id || !newAllocation.stop_id || !newAllocation.vehicle_id) {
      showAlert('All allocation fields are required.');
      return;
    }

    transportApi.allocations.create(newAllocation)
      .then(() => {
        showAlert('Student allocated to transport route successfully!', false);
        setNewAllocation({ student_id: '', route_id: '', stop_id: '', vehicle_id: '' });
        fetchVehicles();
        fetchAllocations();
      })
      .catch((err: any) => {
        showAlert(err.response?.data?.error || 'Failed to allocate transport');
      });
  };

  const handleVacateTransport = (allocationId: string) => {
    if (!can('transport.manage')) return;

    transportApi.allocations.vacate(allocationId)
      .then(() => {
        showAlert('Passenger vacated successfully.', false);
        fetchVehicles();
        fetchAllocations();
      })
      .catch((err: any) => {
        showAlert(err.response?.data?.error || 'Failed to vacate seat');
      });
  };

  // Filters
  const filteredRoutes = routes.filter(r => 
    r.route_code.toLowerCase().includes(routeSearch.toLowerCase()) ||
    r.route_name.toLowerCase().includes(routeSearch.toLowerCase()) ||
    r.start_location.toLowerCase().includes(routeSearch.toLowerCase()) ||
    r.end_location.toLowerCase().includes(routeSearch.toLowerCase())
  );

  const filteredVehicles = vehicles.filter(v => 
    v.vehicle_number.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
    (v.driver_name ?? '').toLowerCase().includes(vehicleSearch.toLowerCase())
  );

  const filteredAllocations = allocations.filter(a => 
    a.route_code.toLowerCase().includes(passengerSearch.toLowerCase()) ||
    a.stop_name.toLowerCase().includes(passengerSearch.toLowerCase()) ||
    a.student_name.toLowerCase().includes(passengerSearch.toLowerCase()) ||
    a.vehicle_number.toLowerCase().includes(passengerSearch.toLowerCase())
  );

  const activePassengersCount = allocations.filter(a => a.status === 'Active').length;

  return (
    <>
      <Header 
        title="Transport Management" 
        subtitle={isStudent ? "View your bus route stop, pickup timing, and driver details" : "Manage routes stops, vehicle capacity, and student boarding desks"} 
      />
      
      <div className="page fade-in">
        
        {/* Banner Alerts */}
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

        {/* Tab switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem', gap: '1rem' }}>
          {isStudent ? (
            <button 
              onClick={() => setActiveTab('my-transport')} 
              style={{ background: 'none', border: 'none', borderBottom: activeTab === 'my-transport' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeTab === 'my-transport' ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
            >
              🚌 My Bus Route
            </button>
          ) : (
            <>
              <button 
                onClick={() => setActiveTab('routes')} 
                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'routes' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeTab === 'routes' ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
              >
                🗺️ Routes & Stops
              </button>
              <button 
                onClick={() => setActiveTab('vehicles')} 
                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'vehicles' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeTab === 'vehicles' ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
              >
                🚐 Vehicles registry
              </button>
              <button 
                onClick={() => setActiveTab('allocate')} 
                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'allocate' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeTab === 'allocate' ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
              >
                ✍️ Allocate Seat Desk
              </button>
              <button 
                onClick={() => setActiveTab('passengers')} 
                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'passengers' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeTab === 'passengers' ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
              >
                👥 Active Passengers ({activePassengersCount})
              </button>
            </>
          )}
        </div>

        {/* Tab 1: Routes & Stops */}
        {activeTab === 'routes' && !isStudent && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
              
              {/* Route list */}
              <div className="card" style={{ padding: '1.25rem', border: '1px solid var(--border)' }}>
                <h3 style={{ margin: '0 0 1rem 0' }}>🗺️ Routes Registry</h3>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Search routes..." 
                  value={routeSearch} 
                  onChange={e => setRouteSearch(e.target.value)} 
                  style={{ marginBottom: '1rem', width: '100%' }}
                />
                
                {loadingRoutes ? (
                  <div style={{ color: 'var(--text-secondary)' }}>Loading routes...</div>
                ) : filteredRoutes.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)' }}>No routes registered yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
                    {filteredRoutes.map(route => (
                      <div 
                        key={route.route_id} 
                        onClick={() => setSelectedRouteId(route.route_id)}
                        style={{ 
                          padding: '0.75rem', 
                          border: '1px solid var(--border)', 
                          borderRadius: 'var(--radius-sm)', 
                          cursor: 'pointer',
                          background: selectedRouteId === route.route_id ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                          borderColor: selectedRouteId === route.route_id ? 'var(--accent-primary)' : 'var(--border)',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                          <span>{route.route_name}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)' }}>{route.route_code}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          🏁 {route.start_location} ➔ {route.end_location}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Create Route form */}
                {can('transport.manage') && (
                  <form onSubmit={handleCreateRoute} style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <h4 style={{ margin: 0 }}>➕ Register New Route</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem' }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Code (e.g. RT-01)" 
                        value={newRoute.route_code} 
                        onChange={e => setNewRoute({...newRoute, route_code: e.target.value})} 
                        required 
                      />
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Route Name" 
                        value={newRoute.route_name} 
                        onChange={e => setNewRoute({...newRoute, route_name: e.target.value})} 
                        required 
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Start Location" 
                        value={newRoute.start_location} 
                        onChange={e => setNewRoute({...newRoute, start_location: e.target.value})} 
                        required 
                      />
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="End Location" 
                        value={newRoute.end_location} 
                        onChange={e => setNewRoute({...newRoute, end_location: e.target.value})} 
                        required 
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Create Route</button>
                  </form>
                )}
              </div>

              {/* Stops list for selected route */}
              <div className="card" style={{ padding: '1.25rem', border: '1px solid var(--border)' }}>
                <h3 style={{ margin: '0 0 1rem 0' }}>🚏 Stops & Fares</h3>
                {!selectedRouteId ? (
                  <div style={{ color: 'var(--text-muted)' }}>Select a route on the left to view/manage boarding stops.</div>
                ) : (
                  <>
                    {loadingStops ? (
                      <div style={{ color: 'var(--text-secondary)' }}>Loading stops...</div>
                    ) : stops.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No stops added to this route yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem' }}>
                        {stops.map(stop => (
                          <div key={stop.stop_id} style={{ padding: '0.65rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{stop.stop_name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>⏰ Pickup: {stop.pickup_time.substring(0, 5)}</div>
                            </div>
                            <div style={{ fontWeight: 600, color: 'var(--accent-secondary)' }}>
                              INR {parseFloat(stop.fare_amount).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Create Stop form */}
                    {can('transport.manage') && (
                      <form onSubmit={handleCreateStop} style={{ paddingTop: '1.25rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <h4 style={{ margin: 0 }}>➕ Add Boarding Stop</h4>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Stop Name (e.g. Central Gate)" 
                          value={newStop.stop_name} 
                          onChange={e => setNewStop({...newStop, stop_name: e.target.value})} 
                          required 
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Pickup (e.g. 08:30)" 
                            value={newStop.pickup_time} 
                            onChange={e => setNewStop({...newStop, pickup_time: e.target.value})} 
                            required 
                          />
                          <input 
                            type="number" 
                            className="form-input" 
                            placeholder="Monthly Fare" 
                            value={newStop.fare_amount} 
                            onChange={e => setNewStop({...newStop, fare_amount: parseFloat(e.target.value) || 0.0})} 
                            required 
                          />
                        </div>
                        <button type="submit" className="btn btn-secondary" style={{ width: '100%' }}>Add Stop</button>
                      </form>
                    )}
                  </>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Tab 2: Vehicle Catalog */}
        {activeTab === 'vehicles' && can('transport.manage') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Search vehicles by number, driver..." 
                value={vehicleSearch} 
                onChange={e => setVehicleSearch(e.target.value)} 
                style={{ flex: 1, minWidth: 280 }}
              />
              <button className="btn btn-secondary" onClick={fetchVehicles}>🔄 Refresh</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
              {loadingVehicles ? (
                <div style={{ color: 'var(--text-secondary)' }}>Loading vehicle list...</div>
              ) : filteredVehicles.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }}>No vehicles registered yet.</div>
              ) : filteredVehicles.map(vehicle => {
                const hasSeats = vehicle.available_seats > 0;
                return (
                  <div key={vehicle.vehicle_id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.25rem', border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent-secondary)', fontWeight: 600, padding: '0.25rem 0.5rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '4px' }}>
                          Bus / Van
                        </span>
                        <span style={{ fontSize: '0.8rem', color: hasSeats ? 'var(--accent-success)' : 'var(--accent-danger)', fontWeight: 600 }}>
                          ● {hasSeats ? `${vehicle.available_seats} of ${vehicle.capacity} seats left` : 'Full'}
                        </span>
                      </div>
                      <h3 style={{ margin: '0.5rem 0 0.25rem 0', color: 'var(--text-primary)' }}>{vehicle.vehicle_number}</h3>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                        👤 Driver: {vehicle.driver_name || 'N/A'} <br />
                        📞 Phone: {vehicle.driver_phone || 'N/A'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vehicle creation form */}
            {can('transport.manage') && (
              <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)', marginTop: '2rem' }}>
                <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>🚐 Register New Vehicle</h2>
                <form onSubmit={handleCreateVehicle} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Vehicle Registration Number *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. KA-01-F-9999" 
                      value={newVehicle.vehicle_number} 
                      onChange={e => setNewVehicle({...newVehicle, vehicle_number: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Total Seating Capacity *</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      min={1} 
                      value={newVehicle.capacity} 
                      onChange={e => setNewVehicle({...newVehicle, capacity: parseInt(e.target.value) || 30})} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Driver Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Driver Name" 
                      value={newVehicle.driver_name} 
                      onChange={e => setNewVehicle({...newVehicle, driver_name: e.target.value})} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Driver Contact Phone</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Driver Phone" 
                      value={newVehicle.driver_phone} 
                      onChange={e => setNewVehicle({...newVehicle, driver_phone: e.target.value})} 
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button type="submit" className="btn btn-primary">➕ Register Vehicle</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Allocate Transport Seat */}
        {activeTab === 'allocate' && can('transport.manage') && (
          <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)', maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>✍️ Transport Allocation Desk</h2>
            <form onSubmit={handleAllocateTransport} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
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
                <label className="form-label">Select Transport Route *</label>
                <select 
                  className="form-input" 
                  value={newAllocation.route_id} 
                  onChange={e => {
                    const val = e.target.value;
                    setNewAllocation({...newAllocation, route_id: val, stop_id: ''});
                    fetchStops(val);
                  }}
                  required
                >
                  <option value="">-- Choose Route --</option>
                  {routes.map(r => (
                    <option key={r.route_id} value={r.route_id}>
                      {r.route_code} — {r.route_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Select Boarding Stop *</label>
                <select 
                  className="form-input" 
                  value={newAllocation.stop_id} 
                  onChange={e => setNewAllocation({...newAllocation, stop_id: e.target.value})}
                  disabled={!newAllocation.route_id}
                  required
                >
                  <option value="">-- Choose Stop --</option>
                  {stops.map(s => (
                    <option key={s.stop_id} value={s.stop_id}>
                      {s.stop_name} (Pickup: {s.pickup_time.substring(0, 5)}, Fare: {parseFloat(s.fare_amount).toFixed(0)} INR)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Select Vehicle / Bus *</label>
                <select 
                  className="form-input" 
                  value={newAllocation.vehicle_id} 
                  onChange={e => setNewAllocation({...newAllocation, vehicle_id: e.target.value})}
                  required
                >
                  <option value="">-- Choose Vehicle --</option>
                  {vehicles.filter(v => v.available_seats > 0).map(v => (
                    <option key={v.vehicle_id} value={v.vehicle_id}>
                      {v.vehicle_number} (Driver: {v.driver_name || 'N/A'}, {v.available_seats} seats left)
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem', marginTop: '0.5rem', fontWeight: 600 }}>
                🚀 Check In Passenger / Issue Allocation
              </button>
            </form>
          </div>
        )}

        {/* Tab 4: Active Passengers Log */}
        {activeTab === 'passengers' && can('transport.manage') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Filter passengers by name, stop, route, vehicle..." 
                value={passengerSearch} 
                onChange={e => setPassengerSearch(e.target.value)} 
                style={{ flex: 1, minWidth: 280 }}
              />
              <button className="btn btn-secondary" onClick={fetchAllocations}>🔄 Refresh Logs</button>
            </div>

            <div className="card" style={{ padding: '1rem', border: '1px solid var(--border)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.75rem' }}>Route</th>
                    <th style={{ padding: '0.75rem' }}>Boarding Stop</th>
                    <th style={{ padding: '0.75rem' }}>Vehicle & Driver</th>
                    <th style={{ padding: '0.75rem' }}>Passenger Name</th>
                    <th style={{ padding: '0.75rem' }}>Monthly Fare</th>
                    <th style={{ padding: '0.75rem' }}>Status</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingAllocations ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Loading passenger registry...
                      </td>
                    </tr>
                  ) : filteredAllocations.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No transport passengers allocated yet.
                      </td>
                    </tr>
                  ) : filteredAllocations.map(alloc => (
                    <tr key={alloc.allocation_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: 600 }}>{alloc.route_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{alloc.route_code}</div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: 600 }}>{alloc.stop_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>⏰ {alloc.pickup_time.substring(0, 5)}</div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div>🚍 {alloc.vehicle_number}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>👤 {alloc.driver_name || 'N/A'}</div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: 600 }}>{alloc.student_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{alloc.student_id}</div>
                      </td>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                        INR {parseFloat(alloc.fare_amount).toFixed(2)}
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
                            onClick={() => handleVacateTransport(alloc.allocation_id)}
                          >
                            🚪 Vacate Seat
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

        {/* Tab 5: Student Route Card */}
        {activeTab === 'my-transport' && isStudent && (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            {loadingAllocations ? (
              <div style={{ color: 'var(--text-secondary)' }}>Loading transport details...</div>
            ) : allocations.length === 0 ? (
              <div className="card" style={{ padding: '2rem', textAlign: 'center', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '2.5rem' }}>🚌</span>
                <h3 style={{ margin: '1rem 0 0.5rem 0', color: 'var(--text-primary)' }}>No Active Transport Allocation</h3>
                <p>You have not been assigned to a bus route stop. Please check with your transport manager.</p>
              </div>
            ) : (
              <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)' }}>
                <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>🚌 Your Bus Route Details</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Bus Route Name:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{allocations[0].route_name} ({allocations[0].route_code})</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Boarding Stop:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{allocations[0].stop_name}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Pickup Time:</span>
                    <strong style={{ color: 'var(--accent-secondary)' }}>{allocations[0].pickup_time.substring(0, 5)} AM</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Assigned Vehicle:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{allocations[0].vehicle_number}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Driver Name:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{allocations[0].driver_name || 'N/A'}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Driver Phone:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{allocations[0].driver_phone || 'N/A'}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Allocation Status:</span>
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

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Monthly Fare:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>INR {parseFloat(allocations[0].fare_amount).toFixed(2)}</strong>
                  </div>

                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );
}
