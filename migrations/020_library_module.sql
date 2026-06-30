-- Module 6: Library Enterprise Additions

-- Book Reservations
CREATE TABLE book_reservations (
    reservation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(institution_id),
    student_id UUID NOT NULL REFERENCES student_profiles(student_id),
    book_id UUID NOT NULL REFERENCES library_books(book_id),
    status VARCHAR(20) DEFAULT 'Pending', -- Pending, Fulfilled, Cancelled
    reserved_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Periodicals and Journals
CREATE TABLE periodicals (
    periodical_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(institution_id),
    title VARCHAR(255) NOT NULL,
    publisher VARCHAR(100),
    frequency VARCHAR(50), -- e.g. Monthly, Weekly
    category VARCHAR(50),
    total_copies INT DEFAULT 1,
    available_copies INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Library Fines Integration
CREATE TABLE library_fines (
    fine_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(institution_id),
    transaction_id UUID NOT NULL REFERENCES library_transactions(transaction_id),
    student_id UUID NOT NULL REFERENCES student_profiles(student_id),
    amount NUMERIC(10,2) NOT NULL,
    fee_allocation_id UUID REFERENCES fee_allocations(fee_allocation_id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
