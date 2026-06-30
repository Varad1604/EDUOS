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
  verifyMfa: (mfa_token: string, otp: string) =>
    api.post('/auth/verify-mfa', { mfa_token, otp }),
  refresh: (refresh_token: string) =>
    api.post('/auth/refresh', { refresh_token }),
  logout: () => api.post('/auth/logout'),
  listInstitutions: () => api.get('/auth/institutions'),
};

export const studentsApi = {
  list:   (params?: Record<string, unknown>) => api.get('/students', { params }),
  get:    (id: string) => api.get(`/students/${id}`),
  getMyProfile: () => api.get('/students/me'),
  create: (data: unknown) => api.post('/students', data),
  update: (id: string, data: unknown) => api.put(`/students/${id}`, data),
  delete: (id: string) => api.delete(`/students/${id}`),
  setStatus: (id: string, data: unknown) => api.patch(`/students/${id}/status`, data),
};

export const academicsApi = {
  curriculums: {
    list: () => api.get('/curriculums'),
    courses: (id: string) => api.get(`/curriculums/${id}/courses`),
    addCourse: (id: string, data: unknown) => api.post(`/curriculums/${id}/courses`, data),
  },
  courses: {
    list:   (params?: Record<string, unknown>) => api.get('/courses', { params }),
    create: (data: unknown) => api.post('/courses', data),
    update: (id: string, data: unknown) => api.put(`/courses/${id}`, data),
    delete: (id: string) => api.delete(`/courses/${id}`),
    prerequisites: (id: string) => api.get(`/courses/${id}/prerequisites`),
    setPrerequisite: (id: string, data: unknown) => api.post(`/courses/${id}/prerequisites`, data),
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
    defaulters: () => api.get('/attendance/defaulters'),
  },
  timetable: {
    get:    (classId: string) => api.get(`/timetables/class/${classId}`),
    create: (data: unknown)   => api.post('/timetables', data),
  },
  courseAllocations: {
    list:   () => api.get('/course-allocations'),
  },
  leaveRequests: {
    list: () => api.get('/leave-requests'),
    create: (data: unknown) => api.post('/leave-requests', data),
    updateStatus: (id: string, data: unknown) => api.put(`/leave-requests/${id}/status`, data),
  },
  quizzes: {
    list:   () => api.get('/quizzes'),
    create: (data: unknown) => api.post('/quizzes', data),
  },
  notifications: {
    list:   () => api.get('/notifications'),
    create: (data: unknown) => api.post('/notifications', data),
  },
  faculty: {
    list:   () => api.get('/faculty'),
  },
};

export const examinationApi = {
  exams:   { list: () => api.get('/exams'), create: (d: unknown) => api.post('/exams', d) },
  marks:   {
    enter: (d: unknown) => api.post('/marks', d),
    enterBulk: (d: unknown) => api.post('/marks/bulk', d),
    publish: (d: unknown) => api.post('/marks/publish', d),
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
  payments:      { 
    initiate: (d: unknown) => api.post('/payments', d), 
    verifyRazorpay: (d: unknown) => api.post('/payments/razorpay/verify', d),
    list: (sid: string) => api.get(`/payments/${sid}`) 
  },
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
    feeCollectionTrend: () => api.get('/reports/fee-collection-trend'),
  },
};

export const libraryApi = {
  books: {
    list:   () => api.get('/library/books'),
    create: (data: unknown) => api.post('/library/books', data),
    reserve: (data: unknown) => api.post('/library/reservations', data),
  },
  loans: {
    list:   () => api.get('/library/loans'),
    issue:  (data: unknown) => api.post('/library/loans', data),
    return: (transactionId: string) => api.post(`/library/loans/${transactionId}/return`),
    listStudent: (studentId: string) => api.get(`/library/loans/student/${studentId}`),
  },
  periodicals: {
    create: (data: unknown) => api.post('/library/periodicals', data),
  },
  reminders: {
    send: () => api.post('/library/reminders/send'),
  }
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
  maintenance: {
    create: (data: unknown) => api.post('/hostel/maintenance', data),
    update: (id: string, data: unknown) => api.post(`/hostel/maintenance/${id}`, data),
    list:   () => api.get('/hostel/maintenance'),
  },
  leaves: {
    create: (data: unknown) => api.post('/hostel/leaves', data),
    approve: (id: string) => api.post(`/hostel/leaves/${id}/approve`),
    reject: (id: string) => api.post(`/hostel/leaves/${id}/reject`),
    list:   () => api.get('/hostel/leaves'),
  },
  mess: {
    createMenu: (data: unknown) => api.post('/hostel/mess-menu', data),
    getMenus:   () => api.get('/hostel/mess-menu'),
    setPreference: (data: unknown) => api.post('/hostel/mess-preference', data),
  }
};

export const transportApi = {
  routes: {
    list:   () => api.get('/transport/routes'),
    create: (data: unknown) => api.post('/transport/routes', data),
    listStops: (routeId: string) => api.get(`/transport/routes/${routeId}/stops`),
    getGps: (routeId: string) => api.get(`/transport/routes/${routeId}/gps`),
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
  drivers: {
    create: (data: unknown) => api.post('/transport/drivers', data),
    list:   () => api.get('/transport/drivers'),
  },
  trips: {
    create: (data: unknown) => api.post('/transport/trips', data),
    update: (id: string, data: unknown) => api.post(`/transport/trips/${id}`, data),
    list:   () => api.get('/transport/trips'),
  }
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
  
  // Interviews
  scheduleInterview: (data: unknown) => api.post('/placement/interviews', data).then(unwrap),
  listInterviews: () => api.get('/placement/interviews').then(unwrap),
  updateInterviewStatus: (id: string, data: unknown) => api.post(`/placement/interviews/${id}/status`, data).then(unwrap),
  
  // Alumni Placement
  registerAlumniPlacement: (data: unknown) => api.post('/placement/alumni-tracking', data).then(unwrap),
  listAlumniPlacements: () => api.get('/placement/alumni-tracking').then(unwrap),
  
  // Analytics
  getAnalyticsStats: () => api.get('/placement/analytics/stats').then(unwrap),
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
