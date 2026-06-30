use axum::{
    extract::{Path, State},
    Extension, Json,
};
use serde_json::json;
use uuid::Uuid;
use crate::{
    error::AppError,
    middleware::auth::Claims,
    modules::library::{models::*, service},
    response::ok,
    state::AppState,
};

pub async fn create_book(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateBookRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let book = service::create_book(&state.db, &claims, body).await?;
    Ok(ok(book))
}

pub async fn list_books(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    let books = service::list_books(&state.db, &claims).await?;
    Ok(ok(books))
}

pub async fn issue_book(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<IssueBookRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let transaction = service::issue_book(&state.db, &state.bus, &claims, body).await?;
    Ok(ok(transaction))
}

pub async fn return_book(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(transaction_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let transaction = service::return_book(&state.db, &state.bus, &claims, transaction_id).await?;
    Ok(ok(transaction))
}

pub async fn list_loans(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    let loans = service::list_loans(&state.db, &claims).await?;
    Ok(ok(loans))
}

pub async fn list_student_loans(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(student_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let loans = service::list_student_loans(&state.db, &claims, student_id).await?;
    Ok(ok(loans))
}

pub async fn create_periodical(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePeriodicalRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let periodical = service::create_periodical(&state.db, &claims, body).await?;
    Ok(ok(periodical))
}

pub async fn reserve_book(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateReservationRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let reservation = service::reserve_book(&state.db, &claims, body).await?;
    Ok(ok(reservation))
}

pub async fn send_overdue_reminders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    let count = service::send_overdue_reminders(&state.db, &state.bus, &claims).await?;
    Ok(ok(json!({ "reminders_sent": count })))
}
