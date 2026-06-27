use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use validator::Validate;

// ── Request types ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(length(min = 2))]
    pub institution_id: String,
    #[validate(length(min = 2))]
    pub username: String,
    #[validate(length(min = 6))]
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

// ── Response types ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub access_token:  String,
    pub refresh_token: String,
    pub expires_in:    i64,   // seconds
    pub user:          UserInfo,
}

#[derive(Debug, Serialize)]
pub struct UserInfo {
    pub user_id:        Uuid,
    pub username:       String,
    pub role_name:      String,
    pub institution_id: Uuid,
    pub last_login:     Option<DateTime<Utc>>,
}

// ── DB row types ──────────────────────────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
#[allow(dead_code)]
pub struct UserRow {
    pub user_id:        Uuid,
    pub person_id:      Uuid,
    pub institution_id: Uuid,
    pub username:       String,
    pub password_hash:  String,
    pub role_id:        Uuid,
    pub role_name:      String,
    pub is_active:      bool,
    pub last_login:     Option<DateTime<Utc>>,
}
