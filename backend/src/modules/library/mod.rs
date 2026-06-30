pub mod handlers;
pub mod models;
pub mod service;

use axum::{routing::{get, post}, Router};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/library/books", post(handlers::create_book))
        .route("/library/books", get(handlers::list_books))
        .route("/library/loans", post(handlers::issue_book))
        .route("/library/loans/:transaction_id/return", post(handlers::return_book))
        .route("/library/loans", get(handlers::list_loans))
        .route("/library/loans/student/:student_id", get(handlers::list_student_loans))
        .route("/library/periodicals", post(handlers::create_periodical))
        .route("/library/reservations", post(handlers::reserve_book))
        .route("/library/reminders/send", post(handlers::send_overdue_reminders))
}
