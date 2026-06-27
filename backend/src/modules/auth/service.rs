use argon2::{Argon2, PasswordHash, PasswordVerifier, PasswordHasher};
use argon2::password_hash::{rand_core::OsRng, SaltString};
use base64::Engine as _;
use uuid::Uuid;
use chrono::Utc;
use sqlx::PgPool;
use crate::{
    config::JwtConfig,
    error::AppError,
    middleware::auth::{Claims, encode_jwt},
    modules::auth::models::{LoginResponse, UserInfo, UserRow},
};

pub async fn login(
    db: &PgPool,
    jwt_cfg: &JwtConfig,
    institution_id: Uuid,
    username: &str,
    password: &str,
) -> Result<LoginResponse, AppError> {
    // 1. Look up user with role name
    let user = sqlx::query_as::<_, UserRow>(
        r#"
        SELECT u.user_id, u.person_id, u.institution_id, u.username,
               u.password_hash, u.role_id, r.role_name, u.is_active, u.last_login
        FROM users u
        JOIN roles r ON r.role_id = u.role_id
        WHERE u.institution_id = $1 AND u.username = $2 AND u.is_active = true
        "#,
    )
    .bind(institution_id)
    .bind(username)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::Unauthorized("Invalid credentials".into()))?;

    // 2. Verify password (Argon2id) — must run in a blocking thread to avoid
    //    stalling the async executor (causes silent connection reset otherwise)
    let password_owned = password.to_owned();
    let hash_owned     = user.password_hash.clone();
    let verified = tokio::task::spawn_blocking(move || {
        let parsed = PasswordHash::new(&hash_owned)
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Hash parse: {}", e)))?;
        Argon2::default()
            .verify_password(password_owned.as_bytes(), &parsed)
            .map_err(|_| AppError::Unauthorized("Invalid credentials".into()))
    })
    .await
    .map_err(|e| AppError::Internal(anyhow::anyhow!("Thread join error: {}", e)))??;
    let _ = verified;

    // 3. Build Claims
    let now   = Utc::now();
    let exp   = now + chrono::Duration::minutes(jwt_cfg.access_expiry_minutes);
    let claims = Claims {
        sub:            user.user_id,
        institution_id: user.institution_id,
        role_id:        user.role_id,
        role_name:      user.role_name.clone(),
        exp:            exp.timestamp(),
        iat:            now.timestamp(),
    };

    let access_token = encode_jwt(&claims, &jwt_cfg.secret)?;

    // 4. Generate refresh token (opaque random token, store hash)
    let raw_refresh = generate_refresh_token();
    let refresh_hash = hash_refresh_token(&raw_refresh);
    let refresh_exp = now + chrono::Duration::days(jwt_cfg.refresh_expiry_days);

    sqlx::query(
        "INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)"
    )
    .bind(user.user_id)
    .bind(&refresh_hash)
    .bind(refresh_exp)
    .execute(db)
    .await
    .map_err(AppError::Database)?;

    // 5. Update last_login
    sqlx::query("UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE user_id = $1")
        .bind(user.user_id)
        .execute(db)
        .await
        .map_err(AppError::Database)?;

    Ok(LoginResponse {
        access_token,
        refresh_token: raw_refresh,
        expires_in:    jwt_cfg.access_expiry_minutes * 60,
        user: UserInfo {
            user_id:        user.user_id,
            username:       user.username,
            role_name:      user.role_name,
            institution_id: user.institution_id,
            last_login:     user.last_login,
        },
    })
}

pub async fn refresh_access_token(
    db: &PgPool,
    jwt_cfg: &JwtConfig,
    raw_refresh_token: &str,
) -> Result<String, AppError> {
    let token_hash = hash_refresh_token(raw_refresh_token);

    // Look up the token
    let row: Option<(Uuid, Uuid, Uuid, String, chrono::DateTime<Utc>, bool)> = sqlx::query_as(
        r#"
        SELECT rt.user_id, u.institution_id, u.role_id, r.role_name, rt.expires_at, rt.revoked
        FROM refresh_tokens rt
        JOIN users u ON u.user_id = rt.user_id
        JOIN roles r ON r.role_id = u.role_id
        WHERE rt.token_hash = $1
        "#,
    )
    .bind(&token_hash)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?;

    let (user_id, institution_id, role_id, role_name, expires_at, revoked) =
        row.ok_or_else(|| AppError::Unauthorized("Invalid refresh token".into()))?;

    if revoked {
        return Err(AppError::Unauthorized("Refresh token revoked".into()));
    }

    if expires_at < Utc::now() {
        return Err(AppError::Unauthorized("Refresh token expired".into()));
    }

    let now = Utc::now();
    let exp = now + chrono::Duration::minutes(jwt_cfg.access_expiry_minutes);
    let claims = Claims {
        sub: user_id,
        institution_id,
        role_id,
        role_name,
        exp: exp.timestamp(),
        iat: now.timestamp(),
    };

    encode_jwt(&claims, &jwt_cfg.secret)
}

pub async fn logout(db: &PgPool, user_id: Uuid) -> Result<(), AppError> {
    sqlx::query("UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false")
        .bind(user_id)
        .execute(db)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}

pub async fn hash_password(plain: &str) -> Result<String, AppError> {
    let plain_owned = plain.to_owned();
    tokio::task::spawn_blocking(move || {
        let salt = SaltString::generate(&mut OsRng);
        Argon2::default()
            .hash_password(plain_owned.as_bytes(), &salt)
            .map(|h| h.to_string())
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Hash error: {}", e)))
    })
    .await
    .map_err(|e| AppError::Internal(anyhow::anyhow!("Thread join: {}", e)))?
}

fn generate_refresh_token() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..48).map(|_| rng.gen::<u8>()).collect();
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(&bytes)
}

fn hash_refresh_token(token: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    token.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}
