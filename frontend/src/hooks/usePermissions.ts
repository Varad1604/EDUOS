import { useAuthStore } from '../store';

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic permission model — checks `user.permissions` provided by the backend.
// Usage:  const { can, role, isStudent, isFaculty } = usePermissions();
//         if (can('courses.create')) { ... }
// ─────────────────────────────────────────────────────────────────────────────

export function usePermissions() {
  const user = useAuthStore(s => s.user);
  const role = user?.role_name ?? '';
  const rawGranted = user?.permissions ?? [];
  const granted = rawGranted.map((p: string) => p.replace(':', '.'));
  const can = (permission: string): boolean => granted.includes(permission.replace(':', '.'));

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
