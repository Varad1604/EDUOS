use axum::{extract::State, Json};
use serde_json::json;
use uuid::Uuid;
use crate::{
    error::AppError,
    middleware::auth::Claims,
    modules::auth::{models::{LoginRequest, RefreshRequest}, service},
    state::AppState,
};

pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let institution_id = Uuid::parse_str(&body.institution_id)
        .map_err(|_| AppError::BadRequest("Invalid institution_id UUID".into()))?;

    let resp = service::login(
        &state.db,
        &state.config.jwt,
        institution_id,
        &body.username,
        &body.password,
    )
    .await?;

    Ok(Json(json!({
        "success": true,
        "data": resp,
        "meta": { "timestamp": chrono::Utc::now() }
    })))
}

pub async fn refresh(
    State(state): State<AppState>,
    Json(body): Json<RefreshRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let access_token = service::refresh_access_token(
        &state.db,
        &state.config.jwt,
        &body.refresh_token,
    )
    .await?;

    Ok(Json(json!({
        "success": true,
        "data": { "access_token": access_token },
        "meta": { "timestamp": chrono::Utc::now() }
    })))
}

pub async fn logout(
    State(state): State<AppState>,
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    service::logout(&state.db, claims.sub).await?;
    Ok(Json(json!({ "success": true, "data": null })))
}
