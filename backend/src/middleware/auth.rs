use axum::{
    extract::{Request, State},
    http::header,
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::{error::AppError, state::AppState};

/// JWT claims embedded in every access token.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub:            Uuid,     // user_id
    pub institution_id: Uuid,
    pub branch_id:      Option<Uuid>,
    pub role_id:        Uuid,
    pub role_name:      String,
    pub jti:            String,   // JWT ID for blacklisting
    pub exp:            i64,      // Unix timestamp
    pub iat:            i64,
}

/// Axum middleware: validates JWT and injects `Claims` as a request extension.
pub async fn require_auth(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let token = extract_bearer_token(&req)
        .ok_or_else(|| AppError::Unauthorized("Missing or malformed Authorization header".into()))?;

    let secret = state.config.jwt.secret.as_bytes();
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret),
        &validation,
    )
    .map_err(|e| AppError::Unauthorized(format!("Invalid token: {}", e)))?;

    let claims = token_data.claims;

    // Check Redis blacklist
    let mut redis_conn = state.redis.get().await.map_err(|_| AppError::Internal(anyhow::anyhow!("Redis error")))?;
    let key = format!("bl_token:{}", claims.jti);
    let is_blacklisted: Option<String> = redis::cmd("GET")
        .arg(&key)
        .query_async(&mut redis_conn)
        .await
        .unwrap_or(None);

    if is_blacklisted.is_some() {
        return Err(AppError::Unauthorized("Token revoked".into()));
    }

    // Check user is still active in DB (optional but recommended)
    let is_active: Option<bool> = sqlx::query_scalar(
        "SELECT is_active FROM users WHERE user_id = $1 AND institution_id = $2"
    )
    .bind(claims.sub)
    .bind(claims.institution_id)
    .fetch_optional(&state.db)
    .await
    .map_err(AppError::Database)?;

    match is_active {
        Some(true) => {}
        Some(false) => return Err(AppError::Unauthorized("Account is deactivated".into())),
        None => return Err(AppError::Unauthorized("User not found".into())),
    }

    req.extensions_mut().insert(claims);
    Ok(next.run(req).await)
}

fn extract_bearer_token(req: &Request) -> Option<&str> {
    let auth_header = req.headers().get(header::AUTHORIZATION)?.to_str().ok()?;
    auth_header.strip_prefix("Bearer ")
}

/// Helper for generating JWT tokens (used in auth service).
pub fn encode_jwt(
    claims: &Claims,
    secret: &str,
) -> Result<String, AppError> {
    use jsonwebtoken::{encode, EncodingKey, Header};
    encode(
        &Header::new(Algorithm::HS256),
        claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(anyhow::anyhow!("JWT encoding failed: {}", e)))
}
