use thiserror::Error;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

/// Unified application error type.
#[derive(Debug, Error)]
pub enum AppError {
    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: insufficient permissions")]
    Forbidden,

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Business rule violation: {0}")]
    Business(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Unprocessable entity: {0}")]
    UnprocessableEntity(String),

    #[error("Rate limited")]
    #[allow(dead_code)]
    RateLimited,

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Internal error: {0}")]
    Internal(#[from] anyhow::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            AppError::Unauthorized(m) => (StatusCode::UNAUTHORIZED, "UNAUTHORIZED", m.clone()),
            AppError::Forbidden => (StatusCode::FORBIDDEN, "FORBIDDEN", "Insufficient permissions".into()),
            AppError::NotFound(m) => (StatusCode::NOT_FOUND, "NOT_FOUND", m.clone()),
            AppError::BadRequest(m) => (StatusCode::BAD_REQUEST, "BAD_REQUEST", m.clone()),
            AppError::Validation(m) => (StatusCode::UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", m.clone()),
            AppError::Business(m) => (StatusCode::UNPROCESSABLE_ENTITY, "BUSINESS_RULE_VIOLATION", m.clone()),
            AppError::Conflict(m) => (StatusCode::CONFLICT, "CONFLICT", m.clone()),
            AppError::UnprocessableEntity(m) => (StatusCode::UNPROCESSABLE_ENTITY, "UNPROCESSABLE_ENTITY", m.clone()),
            AppError::RateLimited => (StatusCode::TOO_MANY_REQUESTS, "RATE_LIMITED", "Too many requests".into()),
            AppError::Database(e) => {
                tracing::error!("Database error: {:?}", e);
                match e {
                    sqlx::Error::RowNotFound => (StatusCode::NOT_FOUND, "NOT_FOUND", "Record not found".into()),
                    sqlx::Error::Database(db_err) if db_err.constraint().is_some() => {
                        (StatusCode::CONFLICT, "CONFLICT", format!("Duplicate record: {}", db_err.constraint().unwrap_or("unknown")))
                    }
                    _ => (StatusCode::INTERNAL_SERVER_ERROR, "DATABASE_ERROR", "A database error occurred".into()),
                }
            }
            AppError::Internal(e) => {
                tracing::error!("Internal error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "An internal error occurred".into())
            }
        };

        let body = json!({
            "success": false,
            "data": null,
            "errors": [{
                "code": code,
                "message": message,
            }]
        });

        (status, Json(body)).into_response()
    }
}

/// Convenience alias for handler return types.
#[allow(dead_code)]
pub type AppResult<T> = Result<T, AppError>;
