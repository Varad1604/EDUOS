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

// ── Companies ──────────────────────────────────────────────────────────────────

pub async fn list_companies(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, AppError> {
    let companies = service::list_companies(&state.db, claims.institution_id).await?;
    Ok(ok(companies))
}

pub async fn create_company(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCompanyRequest>,
) -> Result<impl IntoResponse, AppError> {
    body.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    let company = service::create_company(&state.db, claims.institution_id, body).await?;
    Ok((StatusCode::CREATED, ok(company)))
}

pub async fn update_company_status(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(company_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, AppError> {
    let status = body["status"].as_str().ok_or_else(|| AppError::Validation("status required".into()))?;
    let company = service::update_company_status(&state.db, company_id, status).await?;
    Ok(ok(company))
}

// ── Drives ─────────────────────────────────────────────────────────────────────

pub async fn list_drives(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, AppError> {
    let drives = service::list_drives(&state.db, claims.institution_id).await?;
    Ok(ok(drives))
}

pub async fn create_drive(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDriveRequest>,
) -> Result<impl IntoResponse, AppError> {
    body.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    let drive = service::create_drive(&state.db, claims.institution_id, body).await?;
    Ok((StatusCode::CREATED, ok(drive)))
}

pub async fn close_drive(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(drive_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let drive = service::close_drive(&state.db, drive_id).await?;
    Ok(ok(drive))
}

// ── Applications ───────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct DriveFilter {
    pub drive_id: Option<Uuid>,
}

pub async fn list_applications(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<DriveFilter>,
) -> Result<impl IntoResponse, AppError> {
    let apps = service::list_applications(&state.db, claims.institution_id, q.drive_id).await?;
    Ok(ok(apps))
}

pub async fn get_my_applications(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(student_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let apps = service::get_my_applications(&state.db, student_id).await?;
    Ok(ok(apps))
}

pub async fn apply_to_drive(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ApplyDriveRequest>,
) -> Result<impl IntoResponse, AppError> {
    let app = service::apply_to_drive(&state.db, claims.institution_id, body).await
        .map_err(|e| AppError::Business(e.to_string()))?;
    Ok((StatusCode::CREATED, ok(app)))
}

pub async fn update_application_status(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(application_id): Path<Uuid>,
    Json(body): Json<UpdateApplicationStatusRequest>,
) -> Result<impl IntoResponse, AppError> {
    let app = service::update_application_status(&state.db, application_id, body).await?;
    Ok(ok(app))
}

// ── Interview Rounds ───────────────────────────────────────────────────────────

pub async fn list_rounds(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(application_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let rounds = service::list_rounds(&state.db, application_id).await?;
    Ok(ok(rounds))
}

pub async fn create_round(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Json(body): Json<CreateInterviewRoundRequest>,
) -> Result<impl IntoResponse, AppError> {
    let round = service::create_round(&state.db, body).await?;
    Ok((StatusCode::CREATED, ok(round)))
}

pub async fn update_round_result(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(round_id): Path<Uuid>,
    Json(body): Json<UpdateInterviewResultRequest>,
) -> Result<impl IntoResponse, AppError> {
    let round = service::update_round_result(&state.db, round_id, body).await?;
    Ok(ok(round))
}

// ── Offers ─────────────────────────────────────────────────────────────────────

pub async fn list_offers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, AppError> {
    let offers = service::list_offers(&state.db, claims.institution_id).await?;
    Ok(ok(offers))
}

pub async fn create_offer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateOfferRequest>,
) -> Result<impl IntoResponse, AppError> {
    let offer = service::create_offer(&state.db, claims.institution_id, body).await?;
    Ok((StatusCode::CREATED, ok(offer)))
}

pub async fn update_offer_status(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(offer_id): Path<Uuid>,
    Json(body): Json<UpdateOfferStatusRequest>,
) -> Result<impl IntoResponse, AppError> {
    let offer = service::update_offer_status(&state.db, offer_id, body).await?;
    Ok(ok(offer))
}

// ── Stats ──────────────────────────────────────────────────────────────────────

pub async fn get_placement_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, AppError> {
    let stats = service::get_placement_stats(&state.db, claims.institution_id).await?;
    Ok(ok(stats))
}

pub async fn get_eligible_students(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(drive_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let students = service::get_eligible_students(&state.db, claims.institution_id, drive_id).await?;
    Ok(ok(students))
}

