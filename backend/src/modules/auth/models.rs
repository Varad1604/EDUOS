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

#[derive(Debug, Deserialize, Validate)]
pub struct ForgotPasswordRequest {
    pub username: String,
    pub institution_id: Uuid,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ResetPasswordRequest {
    pub username: String,
    pub institution_id: Uuid,
    pub token: String,
    #[validate(length(min = 8))]
    pub new_password: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifyMfaRequest {
    pub mfa_token: String,
    pub otp: String,
}

// ── Response types ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub mfa_required:  bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mfa_token:     Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub access_token:  Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_in:    Option<i64>,   // seconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user:          Option<UserInfo>,
}

#[derive(Debug, Serialize)]
pub struct UserInfo {
    pub user_id:        Uuid,
    pub person_id:      Uuid,
    pub username:       String,
    pub role_name:      String,
    pub permissions:    Vec<String>,
    pub institution_id: Uuid,
    pub branch_id:      Option<Uuid>,
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
    pub mfa_enabled:    bool,
    pub is_active:      bool,
    pub branch_id:      Option<Uuid>,
    pub last_login:     Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct InstitutionInfo {
    pub institution_id: Uuid,
    pub name:           String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct RolePermissionReq {
    pub resource: String,
    pub action: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateRoleRequest {
    pub role_name: String,
    pub description: Option<String>,
    pub permissions: Vec<RolePermissionReq>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RoleInfo {
    pub role_id: Uuid,
    pub role_name: String,
    pub description: Option<String>,
}
