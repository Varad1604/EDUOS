import { useAuthStore } from '../store';

// ─────────────────────────────────────────────────────────────────────────────
// Centralized permission model — single source of truth for ALL role checks.
// Usage:  const { can, role, isStudent, isFaculty } = usePermissions();
//         if (can('courses.create')) { ... }
// ─────────────────────────────────────────────────────────────────────────────

type Permission =
  // Students
  | 'students.viewAll'
  | 'students.viewOwn'
  | 'students.create'
  | 'students.edit'
  | 'students.delete'
  // Courses
  | 'courses.viewAll'
  | 'courses.viewOwn'
  | 'courses.create'
  | 'courses.edit'
  // Timetable
  | 'timetable.view'
  | 'timetable.create'
  // Attendance
  | 'attendance.mark'
  | 'attendance.viewAll'
  | 'attendance.viewOwn'
  // Exams
  | 'exams.schedule'
  | 'exams.viewAll'
  | 'exams.enterMarks'
  // Hall Tickets
  | 'halltickets.generate'
  | 'halltickets.viewOwn'
  // Results
  | 'results.compile'
  | 'results.publish'
  | 'results.viewAll'
  | 'results.viewOwn'
  // Fees
  | 'fees.createStructure'
  | 'fees.viewAll'
  | 'fees.viewOwn'
  | 'fees.pay'
  | 'fees.waiver'
  // Scholarships
  | 'scholarships.create'
  | 'scholarships.allocate'
  | 'scholarships.viewAll'
  | 'scholarships.viewOwn'
  // Accounts / Finance
  | 'accounts.viewAll'
  | 'accounts.create'
  | 'accounts.postJournal'
  | 'accounts.approveJournal'
  | 'reports.view'
  | 'library.manage'
  | 'library.viewOwn'
  | 'hostel.manage'
  | 'hostel.viewOwn'
  | 'transport.manage'
  | 'transport.viewOwn'
  // Placement
  | 'placement.manage'
  | 'placement.apply'
  | 'placement.view'
  // Medical
  | 'medical.manage'
  | 'medical.view';


// ─────────────────────────────────────────────────────────────────────────────
// Role → Permission matrix
// This is THE authoritative definition of what each role can do.
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_PERMISSIONS: Record<string, Permission[]> = {

  // Principal: full institutional access
  Principal: [
    'students.viewAll', 'students.create', 'students.edit', 'students.delete',
    'courses.viewAll', 'courses.create', 'courses.edit',
    'timetable.view', 'timetable.create',
    'attendance.viewAll',
    'exams.schedule', 'exams.viewAll', 'exams.enterMarks',
    'halltickets.generate',
    'results.compile', 'results.publish', 'results.viewAll',
    'fees.createStructure', 'fees.viewAll', 'fees.waiver',
    'scholarships.create', 'scholarships.allocate', 'scholarships.viewAll',
    'accounts.viewAll', 'accounts.create', 'accounts.postJournal', 'accounts.approveJournal',
    'reports.view',
    'library.manage', 'library.viewOwn',
    'hostel.manage', 'hostel.viewOwn',
    'transport.manage', 'transport.viewOwn',
    'placement.manage', 'placement.view',
    'medical.manage', 'medical.view',
  ],

  // Registrar: academic admin — no financial write access
  Registrar: [
    'students.viewAll', 'students.create', 'students.edit', 'students.delete',
    'courses.viewAll', 'courses.create', 'courses.edit',
    'timetable.view', 'timetable.create',
    'attendance.viewAll',
    'exams.schedule', 'exams.viewAll',
    'halltickets.generate',
    'results.compile', 'results.publish', 'results.viewAll',
    'fees.viewAll',                                // read-only fees
    'scholarships.create', 'scholarships.allocate', 'scholarships.viewAll',
    'reports.view',
    'library.manage', 'library.viewOwn',
    'hostel.manage', 'hostel.viewOwn',
    'transport.manage', 'transport.viewOwn',
    'placement.manage', 'placement.view',
    'medical.manage', 'medical.view',
    // NOTE: no accounts.viewAll — Registrar doesn't touch the general ledger
  ],

  // FeeManager: finance only — no academic data
  FeeManager: [
    'students.viewAll',                            // need to look up students for billing
    'fees.createStructure', 'fees.viewAll', 'fees.waiver',
    'scholarships.create', 'scholarships.allocate', 'scholarships.viewAll',
    'accounts.viewAll', 'accounts.create', 'accounts.postJournal', 'accounts.approveJournal',
    'reports.view',
    // NOTE: no attendance, exams, results, halltickets, courses access
  ],

  // Faculty: teaching duties only — their courses + attendance + exams for own classes
  Faculty: [
    'students.viewAll',                            // need to see students in class
    'courses.viewOwn',
    'timetable.view',
    'attendance.mark', 'attendance.viewAll',
    'exams.schedule', 'exams.viewAll', 'exams.enterMarks',
    'library.manage', 'library.viewOwn',
    'hostel.manage', 'hostel.viewOwn',
    'transport.manage', 'transport.viewOwn',
    'placement.view',
    'medical.manage', 'medical.view',
    // NOTE: no fees, scholarships, accounts, results, halltickets
  ],

  // Student: own data only, read-only except paying own fees
  Student: [
    'students.viewOwn',
    'courses.viewOwn',
    'timetable.view',
    'attendance.viewOwn',
    'exams.viewAll',                               // can see exam schedule (read-only)
    'halltickets.viewOwn',
    'results.viewOwn',
    'fees.viewOwn', 'fees.pay',
    'scholarships.viewOwn',
    'library.viewOwn',
    'hostel.viewOwn',
    'transport.viewOwn',
    'placement.apply', 'placement.view',
    'medical.view',
    // NOTE: no create/edit/delete on anything
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
export function usePermissions() {
  const user = useAuthStore(s => s.user);
  const role = user?.role_name ?? '';
  const granted = ROLE_PERMISSIONS[role] ?? [];
  const can = (permission: Permission): boolean => granted.includes(permission);

  return {
    can,
    role,
    user,
    granted,
    // Convenience booleans
    isPrincipal:  role === 'Principal',
    isRegistrar:  role === 'Registrar',
    isFeeManager: role === 'FeeManager',
    isFaculty:    role === 'Faculty',
    isStudent:    role === 'Student',
    isAdmin:      role === 'Principal' || role === 'Registrar',
    isFinance:    role === 'Principal' || role === 'FeeManager',
    isStaff:      role === 'Principal' || role === 'Registrar' || role === 'FeeManager' || role === 'Faculty',
  };
}
