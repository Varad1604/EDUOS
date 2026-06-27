-- Seed Fee Allocations and Fee Payments for demo students

DO $$
DECLARE
    v_inst_id UUID := '550e8400-e29b-41d4-a716-446655440000';
    v_fee_struct_id UUID;
    v_student_ishaan UUID;
    v_student_aarav UUID;
    v_student_diya UUID;
    v_alloc_ishaan_sem1 UUID := 'a1111111-1111-1111-1111-111111111111';
    v_alloc_ishaan_sem2 UUID := 'a2222222-2222-2222-2222-222222222222';
    v_alloc_aarav_sem1 UUID  := 'a3333333-3333-3333-3333-333333333333';
BEGIN
    -- 1. Get the general merit fee structure
    SELECT fee_structure_id INTO v_fee_struct_id
    FROM fee_structures
    WHERE academic_year = 2026 AND category = 'General' AND quota = 'Merit' AND institution_id = v_inst_id
    LIMIT 1;

    -- 2. Get student IDs
    SELECT student_id INTO v_student_ishaan
    FROM student_profiles sp
    JOIN persons p ON sp.person_id = p.person_id
    WHERE p.email = 'student@eduos.org' AND sp.institution_id = v_inst_id;

    SELECT student_id INTO v_student_aarav
    FROM student_profiles sp
    JOIN persons p ON sp.person_id = p.person_id
    WHERE p.email = 'aarav.patel@eduos.org' AND sp.institution_id = v_inst_id;

    SELECT student_id INTO v_student_diya
    FROM student_profiles sp
    JOIN persons p ON sp.person_id = p.person_id
    WHERE p.email = 'diya.sen@eduos.org' AND sp.institution_id = v_inst_id;

    -- Only proceed if we found the structure and students
    IF v_fee_struct_id IS NOT NULL AND v_student_ishaan IS NOT NULL THEN
        -- Clear existing allocations to avoid unique conflicts on repeat runs
        DELETE FROM fee_payments WHERE student_id IN (v_student_ishaan, v_student_aarav, v_student_diya);
        DELETE FROM fee_allocations WHERE student_id IN (v_student_ishaan, v_student_aarav, v_student_diya);

        -- 3. Insert Fee Allocations
        -- Ishaan Semester 1: Fully Paid (₹60,000)
        INSERT INTO fee_allocations (fee_allocation_id, institution_id, student_id, fee_structure_id, academic_year, semester, total_amount, paid_amount, due_date, status)
        VALUES (v_alloc_ishaan_sem1, v_inst_id, v_student_ishaan, v_fee_struct_id, 2026, 1, 60000.00, 60000.00, '2026-02-15', 'Paid');

        -- Ishaan Semester 2: Unpaid (₹60,000)
        INSERT INTO fee_allocations (fee_allocation_id, institution_id, student_id, fee_structure_id, academic_year, semester, total_amount, paid_amount, due_date, status)
        VALUES (v_alloc_ishaan_sem2, v_inst_id, v_student_ishaan, v_fee_struct_id, 2026, 2, 60000.00, 0.00, '2026-08-15', 'Generated');

        -- Aarav Semester 1: Partially Paid (₹20,000 paid, ₹40,000 outstanding)
        INSERT INTO fee_allocations (fee_allocation_id, institution_id, student_id, fee_structure_id, academic_year, semester, total_amount, paid_amount, due_date, status)
        VALUES (v_alloc_aarav_sem1, v_inst_id, v_student_aarav, v_fee_struct_id, 2026, 1, 60000.00, 20000.00, '2026-02-15', 'Partial');

        -- 4. Insert Fee Payments
        -- Ishaan Semester 1 Payment
        INSERT INTO fee_payments (payment_id, institution_id, fee_allocation_id, student_id, amount, payment_mode, payment_gateway, transaction_id, payment_date, status, receipt_number, receipt_generated)
        VALUES (uuid_generate_v4(), v_inst_id, v_alloc_ishaan_sem1, v_student_ishaan, 60000.00, 'UPI', 'Razorpay', 'TXN_ISHAAN_SEM1_001', NOW() - INTERVAL '10 days', 'Success', 'REC-2026-ISH-001', TRUE);

        -- Aarav Semester 1 Payment (Partial)
        INSERT INTO fee_payments (payment_id, institution_id, fee_allocation_id, student_id, amount, payment_mode, payment_gateway, transaction_id, payment_date, status, receipt_number, receipt_generated)
        VALUES (uuid_generate_v4(), v_inst_id, v_alloc_aarav_sem1, v_student_aarav, 20000.00, 'Card', 'PhonePe', 'TXN_AARAV_SEM1_001', NOW() - INTERVAL '5 days', 'Success', 'REC-2026-AAR-001', TRUE);

        -- Post accounting journal entries matching these payments so balances reconcile
        -- (Usually handled by code, but we do standard seeding)
    END IF;
END $$;
