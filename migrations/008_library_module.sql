-- ── Library Books ────────────────────────────────────────────────────────────
CREATE TABLE library_books (
    book_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    isbn            VARCHAR(30) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    author          VARCHAR(255) NOT NULL,
    publisher       VARCHAR(255),
    category        VARCHAR(100),
    total_copies    INT NOT NULL DEFAULT 1,
    available_copies INT NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    soft_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(institution_id, isbn)
);

-- ── Library Transactions ──────────────────────────────────────────────────────
CREATE TABLE library_transactions (
    transaction_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    book_id         UUID NOT NULL REFERENCES library_books(book_id),
    student_id      UUID NOT NULL REFERENCES student_profiles(student_id),
    issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date        DATE NOT NULL,
    return_date     DATE,
    fine_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
    status          VARCHAR(30) NOT NULL DEFAULT 'Issued',
    -- Issued | Returned | Overdue | Lost
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_library_transactions_student ON library_transactions(student_id);
CREATE INDEX idx_library_transactions_book ON library_transactions(book_id);
