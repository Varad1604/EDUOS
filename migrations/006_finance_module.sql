-- ── Fee Structures ────────────────────────────────────────────────────────────
CREATE TABLE fee_structures (
    fee_structure_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID NOT NULL REFERENCES institutions(institution_id),
    academic_year       INT NOT NULL,
    branch_id           UUID REFERENCES branches(branch_id),
    category            VARCHAR(30),   -- SC | ST | General | OBC | EWS
    quota               VARCHAR(30),   -- Management | Sponsored | Government
    program_id          UUID REFERENCES programs(program_id),
    semesters           JSONB NOT NULL,
    -- [{semester: 1, amount: 50000}, {semester: 2, amount: 50000}]
    total_amount        NUMERIC(12,2) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(institution_id, academic_year, branch_id, category, quota)
);

-- ── Fee Allocations (per student) ─────────────────────────────────────────────
CREATE TABLE fee_allocations (
    fee_allocation_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID NOT NULL REFERENCES institutions(institution_id),
    student_id          UUID NOT NULL REFERENCES student_profiles(student_id),
    fee_structure_id    UUID NOT NULL REFERENCES fee_structures(fee_structure_id),
    academic_year       INT NOT NULL,
    semester            INT NOT NULL,
    total_amount        NUMERIC(12,2) NOT NULL,
    paid_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
    due_date            DATE NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'Generated',
    -- Generated | Partial | Paid | Overdue | Waived | Cancelled
    waiver_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
    waiver_reason       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    soft_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(student_id, fee_structure_id, academic_year, semester)
);

-- ── Fee Payments ──────────────────────────────────────────────────────────────
CREATE TABLE fee_payments (
    payment_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID NOT NULL REFERENCES institutions(institution_id),
    fee_allocation_id   UUID NOT NULL REFERENCES fee_allocations(fee_allocation_id),
    student_id          UUID NOT NULL REFERENCES student_profiles(student_id),
    amount              NUMERIC(12,2) NOT NULL,
    payment_mode        VARCHAR(30) NOT NULL,
    -- Card | UPI | NetBanking | Cash | Cheque | DD
    payment_gateway     VARCHAR(30),  -- Razorpay | PhonePe | GPay | Custom
    transaction_id      VARCHAR(100),
    gateway_order_id    VARCHAR(100),
    payment_date        TIMESTAMPTZ,
    status              VARCHAR(30) NOT NULL DEFAULT 'Pending',
    -- Pending | Success | Failed | Refunded | Reconciled
    receipt_number      VARCHAR(50),
    receipt_generated   BOOLEAN NOT NULL DEFAULT FALSE,
    failure_reason      TEXT,
    retry_count         INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    soft_deleted        BOOLEAN NOT NULL DEFAULT FALSE
);

-- ── Scholarships ──────────────────────────────────────────────────────────────
CREATE TABLE scholarships (
    scholarship_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID NOT NULL REFERENCES institutions(institution_id),
    scholarship_name    VARCHAR(150) NOT NULL,
    scholarship_type    VARCHAR(30) NOT NULL,
    -- Government | Private | Institution | Merit | Need
    amount              NUMERIC(12,2),
    eligibility_criteria JSONB NOT NULL,
    -- {min_cgpa: 7.5, category: "SC", year: 1, income_limit: 250000}
    academic_year       INT,
    total_beneficiaries INT,
    application_deadline DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE scholarship_allotments (
    allotment_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID NOT NULL REFERENCES institutions(institution_id),
    student_id          UUID NOT NULL REFERENCES student_profiles(student_id),
    scholarship_id      UUID NOT NULL REFERENCES scholarships(scholarship_id),
    allotment_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    amount              NUMERIC(12,2) NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'Approved',
    -- Approved | Disbursed | Rejected | Cancelled
    disbursal_date      DATE,
    disbursal_mode      VARCHAR(30),  -- BankTransfer | FeeAdjustment
    bank_reference      VARCHAR(100),
    rejection_reason    TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id, scholarship_id)
);

-- ── Chart of Accounts ─────────────────────────────────────────────────────────
CREATE TABLE chart_of_accounts (
    account_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    account_code    VARCHAR(20) NOT NULL,
    account_name    VARCHAR(150) NOT NULL,
    account_type    VARCHAR(30) NOT NULL,
    -- Asset | Liability | Equity | Income | Expense
    parent_account_id UUID REFERENCES chart_of_accounts(account_id),
    opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
    current_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
    fiscal_year     INT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(institution_id, account_code, fiscal_year)
);

-- ── Journal Entries ───────────────────────────────────────────────────────────
CREATE TABLE journal_entries (
    journal_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID NOT NULL REFERENCES institutions(institution_id),
    entry_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    reference           VARCHAR(100),  -- e.g. FEE_PAYMENT_<uuid>
    description         TEXT,
    status              VARCHAR(30) NOT NULL DEFAULT 'Draft',
    -- Draft | Submitted | Approved | Posted | Rejected
    created_by_user_id  UUID REFERENCES users(user_id),
    approved_by_user_id UUID REFERENCES users(user_id),
    posted_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE journal_items (
    item_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_id      UUID NOT NULL REFERENCES journal_entries(journal_id) ON DELETE CASCADE,
    account_id      UUID NOT NULL REFERENCES chart_of_accounts(account_id),
    debit_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
    credit_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
    narration       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_debit_or_credit CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR
        (credit_amount > 0 AND debit_amount = 0)
    )
);
