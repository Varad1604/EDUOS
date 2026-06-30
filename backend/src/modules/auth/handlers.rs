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
    headers: axum::http::HeaderMap,
    Json(body): Json<LoginRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let institution_id = Uuid::parse_str(&body.institution_id)
        .map_err(|_| AppError::BadRequest("Invalid institution_id UUID".into()))?;

    // Rate Limiting Logic (5 attempts per minute per IP)
    let ip = headers.get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown_ip")
        .split(',')
        .next()
        .unwrap_or("unknown_ip")
        .trim();

    let rl_key = format!("rate_limit:login:{}", ip);
    let mut redis_conn = state.redis.get().await.map_err(|e| {
        tracing::error!("Redis pool error: {}", e);
        AppError::Internal(anyhow::anyhow!("Redis unavailable"))
    })?;

    let attempts: Option<i32> = redis::cmd("GET")
        .arg(&rl_key)
        .query_async(&mut redis_conn)
        .await
        .unwrap_or(None);

    if let Some(count) = attempts {
        if count >= 5 {
            return Err(AppError::RateLimited);
        }
    }

    let resp_res = service::login(
        &state.db,
        &state.redis,
        &state.config.jwt,
        institution_id,
        &body.username,
        &body.password,
    )
    .await;

    if resp_res.is_err() {
        // Increment failed attempts
        let _ = redis::cmd("INCR")
            .arg(&rl_key)
            .query_async::<_, i32>(&mut redis_conn)
            .await;

        if attempts.is_none() {
            let _ = redis::cmd("EXPIRE")
                .arg(&rl_key)
                .arg(60)
                .query_async::<_, ()>(&mut redis_conn)
                .await;
        }
    }

    let resp = resp_res?;

    Ok(Json(json!({
        "success": true,
        "data": resp,
        "meta": { "timestamp": chrono::Utc::now() }
    })))
}

pub async fn verify_mfa(
    State(state): State<AppState>,
    Json(body): Json<crate::modules::auth::models::VerifyMfaRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let resp = service::verify_mfa(&state.db, &state.redis, &state.config.jwt, &body.mfa_token, &body.otp).await?;
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
    service::logout(&state.db, &state.redis, claims.clone()).await?;
    Ok(Json(json!({ "success": true, "data": null })))
}

pub async fn list_institutions(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let list = service::list_institutions(&state.db).await?;
    Ok(Json(json!({
        "success": true,
        "data": list,
        "meta": { "timestamp": chrono::Utc::now() }
    })))
}

pub async fn forgot_password(
    State(state): State<AppState>,
    Json(body): Json<crate::modules::auth::models::ForgotPasswordRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    service::forgot_password(&state.db, &state.redis, body.institution_id, &body.username).await?;
    Ok(Json(json!({
        "success": true,
        "data": "OTP sent to registered email/phone",
        "meta": { "timestamp": chrono::Utc::now() }
    })))
}

pub async fn reset_password(
    State(state): State<AppState>,
    Json(body): Json<crate::modules::auth::models::ResetPasswordRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    service::reset_password(&state.db, &state.redis, body.institution_id, &body.username, &body.token, &body.new_password).await?;
    Ok(Json(json!({
        "success": true,
        "data": "Password reset successfully",
        "meta": { "timestamp": chrono::Utc::now() }
    })))
}

pub async fn create_role(
    State(state): State<AppState>,
    axum::Extension(claims): axum::Extension<Claims>,
    Json(body): Json<crate::modules::auth::models::CreateRoleRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let role = service::create_role(&state.db, claims.institution_id, body).await?;
    Ok(Json(json!({
        "success": true,
        "data": role,
        "meta": { "timestamp": chrono::Utc::now() }
    })))
}

pub async fn list_roles(
    State(state): State<AppState>,
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    let roles = service::list_roles(&state.db, claims.institution_id).await?;
    Ok(Json(json!({
        "success": true,
        "data": roles,
        "meta": { "timestamp": chrono::Utc::now() }
    })))
}
