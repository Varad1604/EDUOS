use sqlx::PgPool;
use uuid::Uuid;
use chrono::Utc;
use crate::{
    error::AppError,
    events::{bus::EventBus, types::*},
    middleware::auth::Claims,
    modules::library::models::*,
};

pub async fn create_book(
    db: &PgPool,
    claims: &Claims,
    req: CreateBookRequest,
) -> Result<Book, AppError> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM library_books WHERE institution_id = $1 AND isbn = $2 AND soft_deleted = false)"
    )
    .bind(claims.institution_id)
    .bind(&req.isbn)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    if exists {
        return Err(AppError::BadRequest("Book with this ISBN already exists in inventory".into()));
    }

    let book = sqlx::query_as::<_, Book>(
        r#"
        INSERT INTO library_books (
            institution_id, isbn, title, author, publisher, category, total_copies, available_copies
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        RETURNING book_id, institution_id, isbn, title, author, publisher, category, total_copies, available_copies, created_at, updated_at, soft_deleted
        "#
    )
    .bind(claims.institution_id)
    .bind(&req.isbn)
    .bind(&req.title)
    .bind(&req.author)
    .bind(&req.publisher)
    .bind(&req.category)
    .bind(req.total_copies)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    Ok(book)
}

pub async fn list_books(
    db: &PgPool,
    claims: &Claims,
) -> Result<Vec<Book>, AppError> {
    let books = sqlx::query_as::<_, Book>(
        r#"
        SELECT book_id, institution_id, isbn, title, author, publisher, category, total_copies, available_copies, created_at, updated_at, soft_deleted
        FROM library_books
        WHERE institution_id = $1 AND soft_deleted = false
        ORDER BY title ASC
        "#
    )
    .bind(claims.institution_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    Ok(books)
}

pub async fn issue_book(
    db: &PgPool,
    _bus: &EventBus,
    claims: &Claims,
    req: IssueBookRequest,
) -> Result<BookTransaction, AppError> {
    let book = sqlx::query_as::<_, Book>(
        "SELECT book_id, institution_id, isbn, title, author, publisher, category, total_copies, available_copies, created_at, updated_at, soft_deleted
         FROM library_books
         WHERE institution_id = $1 AND isbn = $2 AND soft_deleted = false"
    )
    .bind(claims.institution_id)
    .bind(&req.isbn)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound("Book not found".into()))?;

    if book.available_copies <= 0 {
        return Err(AppError::BadRequest("No copies available for loan".into()));
    }

    let student_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM student_profiles WHERE student_id = $1 AND institution_id = $2 AND soft_deleted = false)"
    )
    .bind(req.student_id)
    .bind(claims.institution_id)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    if !student_exists {
        return Err(AppError::NotFound("Student not found".into()));
    }

    let mut tx = db.begin().await.map_err(AppError::Database)?;

    let affected = sqlx::query(
        "UPDATE library_books SET available_copies = available_copies - 1, updated_at = NOW() WHERE book_id = $1 AND available_copies > 0"
    )
    .bind(book.book_id)
    .execute(&mut *tx)
    .await
    .map_err(AppError::Database)?;

    if affected.rows_affected() == 0 {
        return Err(AppError::BadRequest("No copies available for loan".into()));
    }

    let days = req.days_to_due.unwrap_or(14);
    let issue_date = Utc::now().date_naive();
    let due_date = issue_date + chrono::Days::new(days as u64);

    let transaction = sqlx::query_as::<_, BookTransaction>(
        r#"
        INSERT INTO library_transactions (
            institution_id, book_id, student_id, issue_date, due_date, status, fine_amount
        )
        VALUES ($1, $2, $3, $4, $5, 'Issued', 0.00)
        RETURNING transaction_id, institution_id, book_id, student_id, issue_date, due_date, return_date, CAST(fine_amount AS TEXT) AS fine_amount, status, created_at, updated_at
        "#
    )
    .bind(claims.institution_id)
    .bind(book.book_id)
    .bind(req.student_id)
    .bind(issue_date)
    .bind(due_date)
    .fetch_one(&mut *tx)
    .await
    .map_err(AppError::Database)?;

    tx.commit().await.map_err(AppError::Database)?;

    Ok(transaction)
}

pub async fn return_book(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
    transaction_id: Uuid,
) -> Result<BookTransaction, AppError> {
    let tx_record = sqlx::query_as::<_, BookTransaction>(
        r#"SELECT transaction_id, institution_id, book_id, student_id, issue_date, due_date, return_date, CAST(fine_amount AS TEXT) AS fine_amount, status, created_at, updated_at
           FROM library_transactions
           WHERE transaction_id = $1 AND institution_id = $2"#
    )
    .bind(transaction_id)
    .bind(claims.institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound("Library loan transaction not found".into()))?;

    if tx_record.status == "Returned" {
        return Err(AppError::BadRequest("Book has already been returned".into()));
    }

    let return_date = Utc::now().date_naive();
    let mut fine_amount = 0.0;
    if return_date > tx_record.due_date {
        let overdue_days = (return_date - tx_record.due_date).num_days();
        fine_amount = (overdue_days * 10) as f64; // 10 INR per day
    }

    let mut sql_tx = db.begin().await.map_err(AppError::Database)?;

    sqlx::query(
        "UPDATE library_books SET available_copies = available_copies + 1, updated_at = NOW() WHERE book_id = $1"
    )
    .bind(tx_record.book_id)
    .execute(&mut *sql_tx)
    .await
    .map_err(AppError::Database)?;

    let updated_tx = sqlx::query_as::<_, BookTransaction>(
        r#"
        UPDATE library_transactions
        SET return_date = $1, fine_amount = $2, status = 'Returned', updated_at = NOW()
        WHERE transaction_id = $3 AND institution_id = $4
        RETURNING transaction_id, institution_id, book_id, student_id, issue_date, due_date, return_date, CAST(fine_amount AS TEXT) AS fine_amount, status, created_at, updated_at
        "#
    )
    .bind(return_date)
    .bind(fine_amount)
    .bind(transaction_id)
    .bind(claims.institution_id)
    .fetch_one(&mut *sql_tx)
    .await
    .map_err(AppError::Database)?;

    sql_tx.commit().await.map_err(AppError::Database)?;

    if fine_amount > 0.0 {
        // Also post to Finance module (fee_allocations) for auto-billing
        let _ = sqlx::query(
            r#"
            INSERT INTO fee_allocations (fee_allocation_id, institution_id, student_id, fee_structure_id, academic_year, semester, total_amount, due_date, status)
            VALUES (gen_random_uuid(), $1, $2, NULL, EXTRACT(YEAR FROM CURRENT_DATE), 1, $3, CURRENT_DATE + INTERVAL '7 days', 'Generated')
            "#
        )
        .bind(updated_tx.institution_id)
        .bind(updated_tx.student_id)
        .bind(fine_amount)
        .execute(db)
        .await;

        bus.publish(DomainEvent::LibraryFineGenerated(LibraryFineGeneratedPayload {
            transaction_id: updated_tx.transaction_id,
            student_id: updated_tx.student_id,
            institution_id: updated_tx.institution_id,
            amount: fine_amount,
            occurred_at: Utc::now(),
        }));
    }

    Ok(updated_tx)
}

pub async fn list_loans(
    db: &PgPool,
    claims: &Claims,
) -> Result<Vec<BookTransactionResponse>, AppError> {
    let loans = sqlx::query_as::<_, BookTransactionResponse>(
        r#"
        SELECT
            t.transaction_id,
            t.book_id,
            b.title AS book_title,
            b.author AS book_author,
            b.isbn,
            t.student_id,
            CONCAT(p.first_name, ' ', p.last_name) AS student_name,
            t.issue_date,
            t.due_date,
            t.return_date,
            CAST(t.fine_amount AS TEXT) AS fine_amount,
            t.status
        FROM library_transactions t
        JOIN library_books b ON t.book_id = b.book_id
        JOIN student_profiles sp ON t.student_id = sp.student_id
        JOIN persons p ON sp.person_id = p.person_id
        WHERE t.institution_id = $1
        ORDER BY t.created_at DESC
        "#
    )
    .bind(claims.institution_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    Ok(loans)
}

pub async fn list_student_loans(
    db: &PgPool,
    claims: &Claims,
    student_id: Uuid,
) -> Result<Vec<BookTransactionResponse>, AppError> {
    if claims.role_name == "Student" {
        let caller_student_id: Uuid = sqlx::query_scalar(
            "SELECT sp.student_id FROM student_profiles sp
             JOIN users u ON sp.person_id = u.person_id
             WHERE u.user_id = $1 AND sp.institution_id = $2"
        )
        .bind(claims.sub)
        .bind(claims.institution_id)
        .fetch_optional(db)
        .await
        .map_err(AppError::Database)?
        .ok_or_else(|| AppError::Unauthorized("Student profile not found".into()))?;

        if caller_student_id != student_id {
            return Err(AppError::Forbidden);
        }
    }

    let loans = sqlx::query_as::<_, BookTransactionResponse>(
        r#"
        SELECT
            t.transaction_id,
            t.book_id,
            b.title AS book_title,
            b.author AS book_author,
            b.isbn,
            t.student_id,
            CONCAT(p.first_name, ' ', p.last_name) AS student_name,
            t.issue_date,
            t.due_date,
            t.return_date,
            CAST(t.fine_amount AS TEXT) AS fine_amount,
            t.status
        FROM library_transactions t
        JOIN library_books b ON t.book_id = b.book_id
        JOIN student_profiles sp ON t.student_id = sp.student_id
        JOIN persons p ON sp.person_id = p.person_id
        WHERE t.student_id = $1 AND t.institution_id = $2
        ORDER BY t.created_at DESC
        "#
    )
    .bind(student_id)
    .bind(claims.institution_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    Ok(loans)
}

pub async fn create_periodical(
    db: &PgPool,
    claims: &Claims,
    req: CreatePeriodicalRequest,
) -> Result<Periodical, AppError> {
    sqlx::query_as::<_, Periodical>(
        r#"
        INSERT INTO periodicals (periodical_id, institution_id, title, publisher, frequency, category, total_copies, available_copies)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $6)
        RETURNING *
        "#
    )
    .bind(claims.institution_id)
    .bind(&req.title)
    .bind(&req.publisher)
    .bind(&req.frequency)
    .bind(&req.category)
    .bind(req.total_copies)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)
}

pub async fn reserve_book(
    db: &PgPool,
    claims: &Claims,
    req: CreateReservationRequest,
) -> Result<BookReservation, AppError> {
    let book = sqlx::query_as::<_, Book>(
        "SELECT * FROM library_books WHERE book_id = $1 AND institution_id = $2"
    )
    .bind(req.book_id)
    .bind(claims.institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound("Book not found".into()))?;

    if book.available_copies > 0 {
        return Err(AppError::BadRequest("Book is currently available, no need to reserve. You can issue it directly.".into()));
    }

    sqlx::query_as::<_, BookReservation>(
        r#"
        INSERT INTO book_reservations (reservation_id, institution_id, student_id, book_id, status)
        VALUES (gen_random_uuid(), $1, $2, $3, 'Pending')
        RETURNING *
        "#
    )
    .bind(claims.institution_id)
    .bind(claims.sub) // Assuming student is the caller
    .bind(req.book_id)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)
}

pub async fn send_overdue_reminders(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
) -> Result<usize, AppError> {
    let overdue_loans = sqlx::query_as::<_, BookTransaction>(
        "SELECT * FROM library_transactions WHERE institution_id = $1 AND status = 'Issued' AND due_date < CURRENT_DATE"
    )
    .bind(claims.institution_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    for loan in &overdue_loans {
        bus.publish(DomainEvent::LibraryFineGenerated(LibraryFineGeneratedPayload {
            transaction_id: loan.transaction_id,
            student_id: loan.student_id,
            institution_id: loan.institution_id,
            amount: 0.0, // Just a trigger
            occurred_at: Utc::now(),
        }));
    }

    Ok(overdue_loans.len())
}
