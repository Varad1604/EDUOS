import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Students = lazy(() => import('./pages/Students'));
const Courses = lazy(() => import('./pages/Courses'));
const Timetable = lazy(() => import('./pages/Timetable'));
const Attendance = lazy(() => import('./pages/Attendance'));
const LeaveManagement = lazy(() => import('./pages/LeaveManagement'));
const Exams = lazy(() => import('./pages/Exams'));
const HallTickets = lazy(() => import('./pages/HallTickets'));
const Results = lazy(() => import('./pages/Results'));
const Fees = lazy(() => import('./pages/Fees'));
const Scholarships = lazy(() => import('./pages/Scholarships'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Reports = lazy(() => import('./pages/Reports'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const Library = lazy(() => import('./pages/Library'));
const Hostel = lazy(() => import('./pages/Hostel'));
const Transport = lazy(() => import('./pages/Transport'));
const Placement = lazy(() => import('./pages/Placement'));
const Medical = lazy(() => import('./pages/Medical'));
const Quizzes = lazy(() => import('./pages/Quizzes'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Faculty = lazy(() => import('./pages/Faculty'));

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Suspense fallback={
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-muted)' }}>
            <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '1rem' }} />
            <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>Loading View…</div>
          </div>
        }>
          {children}
        </Suspense>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token);
  const user  = useAuthStore(s => s.user);
  return (!!token && !!user) ? <>{children}</> : <Navigate to="/login" replace />;
}

function RequireRole({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const user = useAuthStore(s => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role_name)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <RequireAuth>
            <ProtectedLayout><Dashboard /></ProtectedLayout>
          </RequireAuth>
        } />
        
        <Route path="/students" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar', 'FeeManager', 'Faculty', 'Student']}>
              <ProtectedLayout><Students /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />

        <Route path="/faculty" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar', 'Faculty']}>
              <ProtectedLayout><Faculty /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />
        
        <Route path="/courses" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar', 'Faculty', 'Student']}>
              <ProtectedLayout><Courses /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />
        
        <Route path="/timetable" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar', 'Faculty', 'Student']}>
              <ProtectedLayout><Timetable /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />
        
        <Route path="/attendance" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar', 'Faculty', 'Student']}>
              <ProtectedLayout><Attendance /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />
        
        <Route path="/leave" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar', 'Faculty']}>
              <ProtectedLayout><LeaveManagement /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />
        
        <Route path="/exams" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar', 'Student']}>
              <ProtectedLayout><Exams /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />
        
        <Route path="/hall-tickets" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar', 'Student']}>
              <ProtectedLayout><HallTickets /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />
        
        <Route path="/results" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar', 'Student']}>
              <ProtectedLayout><Results /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />
        
        <Route path="/fees" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar', 'FeeManager', 'Student']}>
              <ProtectedLayout><Fees /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />
        
        <Route path="/scholarships" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar', 'FeeManager', 'Student']}>
              <ProtectedLayout><Scholarships /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />
        
        <Route path="/accounts" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'FeeManager']}>
              <ProtectedLayout><Accounts /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />
        
        <Route path="/reports" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar', 'FeeManager']}>
              <ProtectedLayout><Reports /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />

        <Route path="/audit-logs" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar']}>
              <ProtectedLayout><AuditLogs /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />
        
        <Route path="/library" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar', 'Student']}>
              <ProtectedLayout><Library /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />

        <Route path="/hostel" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar', 'Student']}>
              <ProtectedLayout><Hostel /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />

        <Route path="/transport" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar', 'Student']}>
              <ProtectedLayout><Transport /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />

        <Route path="/placement" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar', 'Faculty', 'Student']}>
              <ProtectedLayout><Placement /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />

        <Route path="/medical" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar', 'Student']}>
              <ProtectedLayout><Medical /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />

        <Route path="/quizzes" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar', 'Faculty', 'Student']}>
              <ProtectedLayout><Quizzes /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />

        <Route path="/notifications" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar', 'Faculty', 'Student']}>
              <ProtectedLayout><Notifications /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

