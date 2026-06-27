import axios from 'axios';

// In dev, Vite proxies /api → http://localhost:8000, so no CORS issues.
// In production, set VITE_API_URL to the absolute backend URL.
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({ baseURL: API_BASE, timeout: 15000 });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  async err => {
    if (err.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (institution_id: string, username: string, password: string) =>
    api.post('/auth/login', { institution_id, username, password }),
  refresh: (refresh_token: string) =>
    api.post('/auth/refresh', { refresh_token }),
  logout: () => api.post('/auth/logout'),
};

export const studentsApi = {
  list:   (params?: Record<string, unknown>) => api.get('/students', { params }),
  get:    (id: string) => api.get(`/students/${id}`),
  create: (data: unknown) => api.post('/students', data),
  update: (id: string, data: unknown) => api.put(`/students/${id}`, data),
  delete: (id: string) => api.delete(`/students/${id}`),
  setStatus: (id: string, data: unknown) => api.patch(`/students/${id}/status`, data),
};

export const academicsApi = {
  courses: {
    list:   (params?: Record<string, unknown>) => api.get('/courses', { params }),
    create: (data: unknown) => api.post('/courses', data),
  },
  classes: {
    list:   () => api.get('/classes'),
    create: (data: unknown) => api.post('/classes', data),
  },
  attendance: {
    mark:    (data: unknown) => api.post('/attendance/mark', data),
    markBulk: (data: unknown) => api.post('/attendance/mark/bulk', data),
    summary: (studentId: string, courseId: string) =>
      api.get(`/attendance/${studentId}/summary`, { params: { course_id: courseId } }),
  },
  timetable: {
    get:    (classId: string) => api.get(`/timetables/class/${classId}`),
    create: (data: unknown)   => api.post('/timetables', data),
  },
  courseAllocations: {
    list:   () => api.get('/course-allocations'),
  },
};

export const examinationApi = {
  exams:   { list: () => api.get('/exams'), create: (d: unknown) => api.post('/exams', d) },
  marks:   {
    enter: (d: unknown) => api.post('/marks', d),
    enterBulk: (d: unknown) => api.post('/marks/bulk', d),
    getStudentMarks: (sid: string) => api.get(`/marks/student/${sid}`),
  },
  results: { process: (d: unknown) => api.post('/results/process', d), get: (sid: string) => api.get(`/results/${sid}`) },
  revaluation: {
    list: () => api.get('/revaluation'),
    request: (d: unknown) => api.post('/revaluation/request', d),
    approve: (id: string, d: unknown) => api.patch(`/revaluation/${id}/approve`, d),
  },
};

export const financeApi = {
  feeStructures: { list: () => api.get('/fee-structures'), create: (d: unknown) => api.post('/fee-structures', d) },
  allocations:   { create: (d: unknown) => api.post('/fee-allocations', d), summary: (sid: string) => api.get(`/fee-allocations/${sid}`) },
  payments:      { initiate: (d: unknown) => api.post('/payments', d), list: (sid: string) => api.get(`/payments/${sid}`) },
  scholarships:  {
    list: () => api.get('/scholarships'),
    create: (d: unknown) => api.post('/scholarships', d),
    allocate: (id: string, d: unknown) => api.post(`/scholarships/${id}/allocate`, d),
  },
  accounts:      { list: () => api.get('/accounts'), create: (d: unknown) => api.post('/accounts', d) },
  journal:       { list: () => api.get('/journal-entries'), create: (d: unknown) => api.post('/journal-entries', d) },
  reports:       {
    balanceSheet: () => api.get('/reports/balance-sheet'),
    incomeStatement: () => api.get('/reports/income-statement'),
    auditLogs: () => api.get('/reports/audit-logs'),
  },
};

export const libraryApi = {
  books: {
    list:   () => api.get('/library/books'),
    create: (data: unknown) => api.post('/library/books', data),
  },
  loans: {
    list:   () => api.get('/library/loans'),
    issue:  (data: unknown) => api.post('/library/loans', data),
    return: (transactionId: string) => api.post(`/library/loans/${transactionId}/return`),
    listStudent: (studentId: string) => api.get(`/library/loans/student/${studentId}`),
  },
};

export const hostelApi = {
  rooms: {
    list:   () => api.get('/hostel/rooms'),
    create: (data: unknown) => api.post('/hostel/rooms', data),
  },
  allocations: {
    list:   () => api.get('/hostel/allocations'),
    create: (data: unknown) => api.post('/hostel/allocations', data),
    vacate: (allocationId: string) => api.post(`/hostel/allocations/${allocationId}/vacate`),
    listStudent: (studentId: string) => api.get(`/hostel/allocations/student/${studentId}`),
  },
};

export const transportApi = {
  routes: {
    list:   () => api.get('/transport/routes'),
    create: (data: unknown) => api.post('/transport/routes', data),
    listStops: (routeId: string) => api.get(`/transport/routes/${routeId}/stops`),
  },
  stops: {
    create: (data: unknown) => api.post('/transport/stops', data),
  },
  vehicles: {
    list:   () => api.get('/transport/vehicles'),
    create: (data: unknown) => api.post('/transport/vehicles', data),
  },
  allocations: {
    list:   () => api.get('/transport/allocations'),
    create: (data: unknown) => api.post('/transport/allocations', data),
    vacate: (allocationId: string) => api.post(`/transport/allocations/${allocationId}/vacate`),
    listStudent: (studentId: string) => api.get(`/transport/allocations/student/${studentId}`),
  },
};

// ── Helper: unwrap { data: T } envelope ──────────────────────────────────────
const unwrap = (res: any) => res.data?.data ?? res.data;

export const placementApi = {
  stats: () => api.get('/placement/stats').then(unwrap),
  listCompanies: () => api.get('/placement/companies').then(unwrap),
  createCompany: (data: unknown) => api.post('/placement/companies', data).then(unwrap),
  updateCompanyStatus: (id: string, status: string) => api.patch(`/placement/companies/${id}/status`, { status }).then(unwrap),
  listDrives: () => api.get('/placement/drives').then(unwrap),
  createDrive: (data: unknown) => api.post('/placement/drives', data).then(unwrap),
  closeDrive: (id: string) => api.post(`/placement/drives/${id}/close`).then(unwrap),
  listEligibleStudents: (driveId: string) => api.get(`/placement/drives/${driveId}/eligible-students`).then(unwrap),

  listApplications: (driveId?: string) => api.get('/placement/applications', { params: driveId ? { drive_id: driveId } : {} }).then(unwrap),
  myApplications: (studentId: string) => api.get(`/placement/applications/student/${studentId}`).then(unwrap),
  apply: (data: unknown) => api.post('/placement/applications', data).then(unwrap),
  updateApplicationStatus: (id: string, data: unknown) => api.patch(`/placement/applications/${id}/status`, data).then(unwrap),
  listRounds: (applicationId: string) => api.get(`/placement/rounds/application/${applicationId}`).then(unwrap),
  createRound: (data: unknown) => api.post('/placement/rounds', data).then(unwrap),
  updateRoundResult: (id: string, data: unknown) => api.patch(`/placement/rounds/${id}/result`, data).then(unwrap),
  listOffers: () => api.get('/placement/offers').then(unwrap),
  createOffer: (data: unknown) => api.post('/placement/offers', data).then(unwrap),
  updateOfferStatus: (id: string, data: unknown) => api.patch(`/placement/offers/${id}/status`, data).then(unwrap),
};

export const medicalApi = {
  stats: () => api.get('/medical/stats').then(unwrap),
  listVisits: (studentId?: string) => api.get('/medical/visits', { params: studentId ? { student_id: studentId } : {} }).then(unwrap),
  createVisit: (data: unknown) => api.post('/medical/visits', data).then(unwrap),
  closeVisit: (id: string, data: unknown) => api.patch(`/medical/visits/${id}/close`, data).then(unwrap),
  getVitals: (visitId: string) => api.get(`/medical/visits/${visitId}/vitals`).then(unwrap),
  recordVitals: (visitId: string, data: unknown) => api.post(`/medical/visits/${visitId}/vitals`, data).then(unwrap),
  getPrescriptions: (visitId: string) => api.get(`/medical/visits/${visitId}/prescriptions`).then(unwrap),
  createPrescription: (data: unknown) => api.post('/medical/prescriptions', data).then(unwrap),
  listInventory: () => api.get('/medical/inventory').then(unwrap),
  createInventoryItem: (data: unknown) => api.post('/medical/inventory', data).then(unwrap),
  adjustStock: (id: string, delta: number, reason?: string) => api.patch(`/medical/inventory/${id}/stock`, { delta, reason }).then(unwrap),
  listSickLeaves: (studentId?: string) => api.get('/medical/sick-leaves', { params: studentId ? { student_id: studentId } : {} }).then(unwrap),
  issueSickLeave: (data: unknown) => api.post('/medical/sick-leaves', data).then(unwrap),
};
