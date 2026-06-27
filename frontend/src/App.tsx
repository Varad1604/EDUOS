import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Courses from './pages/Courses';
import Timetable from './pages/Timetable';
import Attendance from './pages/Attendance';
import Exams from './pages/Exams';
import HallTickets from './pages/HallTickets';
import Results from './pages/Results';
import Fees from './pages/Fees';
import Scholarships from './pages/Scholarships';
import Accounts from './pages/Accounts';
import Reports from './pages/Reports';
import AuditLogs from './pages/AuditLogs';
import Library from './pages/Library';
import Hostel from './pages/Hostel';
import Transport from './pages/Transport';
import Placement from './pages/Placement';
import Medical from './pages/Medical';

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">{children}</div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;
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
        
        <Route path="/exams" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar', 'Faculty', 'Student']}>
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
            <RequireRole allowedRoles={['Principal', 'Registrar', 'Faculty', 'Student']}>
              <ProtectedLayout><Library /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />

        <Route path="/hostel" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar', 'Faculty', 'Student']}>
              <ProtectedLayout><Hostel /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />

        <Route path="/transport" element={
          <RequireAuth>
            <RequireRole allowedRoles={['Principal', 'Registrar', 'Faculty', 'Student']}>
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
            <RequireRole allowedRoles={['Principal', 'Registrar', 'Faculty', 'Student']}>
              <ProtectedLayout><Medical /></ProtectedLayout>
            </RequireRole>
          </RequireAuth>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

