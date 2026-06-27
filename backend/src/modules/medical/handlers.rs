use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;
use validator::Validate;

use crate::{error::AppError, middleware::auth::Claims, state::AppState};
use super::{models::*, service};

fn ok<T: serde::Serialize>(data: T) -> Json<serde_json::Value> {
    Json(json!({ "success": true, "data": data }))
}

#[derive(Deserialize)]
pub struct StudentFilter {
    pub student_id: Option<Uuid>,
}

// ── Visits ─────────────────────────────────────────────────────────────────────

pub async fn list_visits(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<StudentFilter>,
) -> Result<impl IntoResponse, AppError> {
    let visits = service::list_visits(&state.db, claims.institution_id, q.student_id).await?;
    Ok(ok(visits))
}

pub async fn create_visit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateVisitRequest>,
) -> Result<impl IntoResponse, AppError> {
    body.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    let visit = service::create_visit(&state.db, claims.institution_id, body).await?;
    Ok((StatusCode::CREATED, ok(visit)))
}

pub async fn close_visit(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(visit_id): Path<Uuid>,
    Json(body): Json<CloseVisitRequest>,
) -> Result<impl IntoResponse, AppError> {
    let visit = service::close_visit(&state.db, visit_id, body).await?;
    Ok(ok(visit))
}

// ── Vitals ─────────────────────────────────────────────────────────────────────

pub async fn record_vitals(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(visit_id): Path<Uuid>,
    Json(body): Json<RecordVitalsRequest>,
) -> Result<impl IntoResponse, AppError> {
    let vital = service::record_vitals(&state.db, visit_id, body).await?;
    Ok((StatusCode::CREATED, ok(vital)))
}

pub async fn get_vitals(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(visit_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let vitals = service::get_vitals(&state.db, visit_id).await?;
    Ok(ok(vitals))
}

// ── Prescriptions ──────────────────────────────────────────────────────────────

pub async fn get_prescriptions(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(visit_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let prescriptions = service::get_prescriptions(&state.db, visit_id).await?;
    Ok(ok(prescriptions))
}

pub async fn create_prescription(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Json(body): Json<CreatePrescriptionRequest>,
) -> Result<impl IntoResponse, AppError> {
    body.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    let prescription = service::create_prescription(&state.db, body).await?;
    Ok((StatusCode::CREATED, ok(prescription)))
}

// ── Inventory ──────────────────────────────────────────────────────────────────

pub async fn list_inventory(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, AppError> {
    let items = service::list_inventory(&state.db, claims.institution_id).await?;
    Ok(ok(items))
}

pub async fn create_inventory_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateInventoryItemRequest>,
) -> Result<impl IntoResponse, AppError> {
    body.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    let item = service::create_inventory_item(&state.db, claims.institution_id, body).await?;
    Ok((StatusCode::CREATED, ok(item)))
}

pub async fn adjust_stock(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(item_id): Path<Uuid>,
    Json(body): Json<AdjustStockRequest>,
) -> Result<impl IntoResponse, AppError> {
    let item = service::adjust_stock(&state.db, item_id, body).await
        .map_err(|e| AppError::Business(e.to_string()))?;
    Ok(ok(item))
}

// ── Sick Leaves ────────────────────────────────────────────────────────────────

pub async fn list_sick_leaves(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<StudentFilter>,
) -> Result<impl IntoResponse, AppError> {
    let leaves = service::list_sick_leaves(&state.db, claims.institution_id, q.student_id).await?;
    Ok(ok(leaves))
}

pub async fn issue_sick_leave(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<IssueSickLeaveRequest>,
) -> Result<impl IntoResponse, AppError> {
    body.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    let leave = service::issue_sick_leave(&state.db, claims.institution_id, body).await
        .map_err(|e| AppError::Business(e.to_string()))?;
    Ok((StatusCode::CREATED, ok(leave)))
}

// ── Stats ──────────────────────────────────────────────────────────────────────

pub async fn get_medical_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, AppError> {
    let stats = service::get_medical_stats(&state.db, claims.institution_id).await?;
    Ok(ok(stats))
}
