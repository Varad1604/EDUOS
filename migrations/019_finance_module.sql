-- Module 5: Finance Enterprise Additions

-- Fiscal Years
CREATE TABLE fiscal_years (
    fiscal_year_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(institution_id),
    name VARCHAR(50) NOT NULL, -- e.g. "FY 2024-2025"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_locked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bank Statements and Reconciliation
CREATE TABLE bank_statements (
    statement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(institution_id),
    account_number VARCHAR(100) NOT NULL,
    statement_date DATE NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bank_statement_lines (
    line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id UUID NOT NULL REFERENCES bank_statements(statement_id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    description TEXT,
    reference_id VARCHAR(255), -- UTR or Check Number
    amount NUMERIC(15,2) NOT NULL,
    is_reconciled BOOLEAN DEFAULT false
);

ALTER TABLE fee_payments ADD COLUMN reconciliation_id UUID REFERENCES bank_statement_lines(line_id);
ALTER TABLE journal_items ADD COLUMN reconciliation_id UUID REFERENCES bank_statement_lines(line_id);

-- Late Fee Policies
CREATE TABLE late_fee_policies (
    policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(institution_id),
    fee_structure_id UUID REFERENCES fee_structures(fee_structure_id),
    penalty_amount NUMERIC(10,2) NOT NULL,
    penalty_type VARCHAR(20) NOT NULL, -- 'Fixed' or 'Percentage'
    grace_period_days INT DEFAULT 0
);

-- Installment Plans
CREATE TABLE installment_plans (
    plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id UUID NOT NULL REFERENCES fee_allocations(fee_allocation_id) ON DELETE CASCADE,
    total_amount NUMERIC(15,2) NOT NULL,
    installments_count INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE installment_schedules (
    schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES installment_plans(plan_id) ON DELETE CASCADE,
    amount_due NUMERIC(15,2) NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'Pending' -- Pending, Paid, Overdue
);

ALTER TABLE fee_payments ADD COLUMN schedule_id UUID REFERENCES installment_schedules(schedule_id);

-- Fee Waivers
CREATE TABLE fee_waiver_requests (
    waiver_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(institution_id),
    student_id UUID NOT NULL REFERENCES student_profiles(student_id),
    allocation_id UUID NOT NULL REFERENCES fee_allocations(fee_allocation_id),
    requested_amount NUMERIC(15,2) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'Pending', -- Pending, Approved, Rejected
    approved_by UUID REFERENCES users(user_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
