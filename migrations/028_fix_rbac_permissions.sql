-- Migration 028: Fix RBAC permissions
-- Remove incorrect permissions for Faculty (exams, library, medical)
-- Add hostel.view and transport.view to Student role

-- Step 1: Remove permissions from Faculty role that they should NOT have
DELETE FROM role_permissions
WHERE role_id IN (
    SELECT role_id FROM roles WHERE role_name = 'Faculty'
)
AND (
    (resource = 'exams' AND action IN ('read', 'create', 'update', 'delete', 'approve'))
    OR (resource = 'library' AND action IN ('view', 'manage'))
    OR (resource = 'medical' AND action IN ('view', 'manage'))
    OR (resource = 'fees' AND action IN ('read', 'create', 'update', 'delete', 'approve'))
    OR (resource = 'accounts' AND action IN ('read', 'create', 'update', 'delete', 'approve'))
    OR (resource = 'reports' AND action IN ('read', 'create', 'update', 'delete'))
    OR (resource = 'hostel' AND action IN ('view', 'manage'))
    OR (resource = 'transport' AND action IN ('view', 'manage'))
);

-- Step 2: Add attendance.approve to Faculty (HOD approval of leave from backend level)
INSERT INTO role_permissions (role_id, resource, action)
SELECT role_id, 'attendance', 'approve' FROM roles WHERE role_name = 'Faculty'
ON CONFLICT DO NOTHING;

-- Step 3: Ensure Student has hostel.view and transport.view (in case they were missing)
INSERT INTO role_permissions (role_id, resource, action)
SELECT role_id, 'hostel', 'view' FROM roles WHERE role_name = 'Student'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, resource, action)
SELECT role_id, 'transport', 'view' FROM roles WHERE role_name = 'Student'
ON CONFLICT DO NOTHING;
