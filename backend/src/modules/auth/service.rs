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
    modules::auth::models::{LoginResponse, UserInfo, UserRow, InstitutionInfo},
};

pub async fn login(
    db: &PgPool,
    redis_pool: &deadpool_redis::Pool,
    jwt_cfg: &JwtConfig,
    institution_id: Uuid,
    username: &str,
    password: &str,
) -> Result<LoginResponse, AppError> {
    // 1. Look up user with role name
    let user = sqlx::query_as::<_, UserRow>(
        r#"
        SELECT u.user_id, u.person_id, u.institution_id, u.username,
               u.password_hash, u.role_id, r.role_name, u.mfa_enabled, u.is_active, u.branch_id, u.last_login
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
        branch_id:      user.branch_id,
        role_id:        user.role_id,
        role_name:      user.role_name.clone(),
        jti:            Uuid::new_v4().to_string(),
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

    if user.mfa_enabled {
        // Send OTP (Mock) and return pre-auth token
        let otp: String = {
            let mut rng = rand::thread_rng();
            use rand::Rng;
            (0..6).map(|_| rng.gen_range(0..10).to_string()).collect()
        };
        let mfa_token = Uuid::new_v4().to_string();
        
        let mut redis_conn = redis_pool.get().await.map_err(|_| AppError::Internal(anyhow::anyhow!("Redis error")))?;
        let key = format!("mfa:{}", mfa_token);
        
        let mfa_data = serde_json::json!({
            "user_id": user.user_id,
            "institution_id": user.institution_id,
            "branch_id": user.branch_id,
            "otp": otp,
            "role_id": user.role_id,
            "role_name": user.role_name,
            "person_id": user.person_id,
            "username": user.username,
            "last_login": user.last_login
        });

        redis::cmd("SETEX")
            .arg(&key)
            .arg(300) // 5 minutes
            .arg(mfa_data.to_string())
            .query_async::<_, ()>(&mut redis_conn)
            .await
            .map_err(|_| AppError::Internal(anyhow::anyhow!("Redis error")))?;

        tracing::info!("Mock MFA OTP for user {}: {}", user.username, otp);

        return Ok(LoginResponse {
            mfa_required: true,
            mfa_token: Some(mfa_token),
            access_token: None,
            refresh_token: None,
            expires_in: None,
            user: None,
        });
    }

    // Fetch permissions
    let permissions: Vec<String> = sqlx::query_scalar(
        "SELECT resource || ':' || action FROM role_permissions WHERE role_id = $1"
    )
    .bind(user.role_id)
    .fetch_all(db)
    .await
    .unwrap_or_default();

    Ok(LoginResponse {
        mfa_required: false,
        mfa_token: None,
        access_token: Some(access_token),
        refresh_token: Some(raw_refresh),
        expires_in:    Some(jwt_cfg.access_expiry_minutes * 60),
        user: Some(UserInfo {
            user_id:        user.user_id,
            person_id:      user.person_id,
            username:       user.username,
            role_name:      user.role_name,
            permissions,
            institution_id: user.institution_id,
            branch_id:      user.branch_id,
            last_login:     user.last_login,
        }),
    })
}

pub async fn verify_mfa(
    db: &PgPool,
    redis_pool: &deadpool_redis::Pool,
    jwt_cfg: &JwtConfig,
    mfa_token: &str,
    otp: &str,
) -> Result<LoginResponse, AppError> {
    let mut redis_conn = redis_pool.get().await.map_err(|_| AppError::Internal(anyhow::anyhow!("Redis error")))?;
    let key = format!("mfa:{}", mfa_token);

    let data_str: Option<String> = redis::cmd("GET")
        .arg(&key)
        .query_async(&mut redis_conn)
        .await
        .map_err(|_| AppError::Internal(anyhow::anyhow!("Redis error")))?;

    let data_str = data_str.ok_or_else(|| AppError::Unauthorized("Invalid or expired MFA token".into()))?;
    let data: serde_json::Value = serde_json::from_str(&data_str).map_err(|_| AppError::Internal(anyhow::anyhow!("Parse error")))?;

    let stored_otp = data["otp"].as_str().unwrap_or("");
    if stored_otp != otp {
        return Err(AppError::Unauthorized("Invalid OTP".into()));
    }

    // OTP verified, generate tokens — parse all fields with proper error handling
    let parse_err = || AppError::Internal(anyhow::anyhow!("Malformed MFA session data in Redis"));
    let user_id = data["user_id"].as_str()
        .ok_or_else(parse_err)
        .and_then(|s| Uuid::parse_str(s).map_err(|_| parse_err()))?;
    let institution_id = data["institution_id"].as_str()
        .ok_or_else(parse_err)
        .and_then(|s| Uuid::parse_str(s).map_err(|_| parse_err()))?;
    let branch_id = data["branch_id"].as_str().and_then(|s| Uuid::parse_str(s).ok());
    let role_id = data["role_id"].as_str()
        .ok_or_else(parse_err)
        .and_then(|s| Uuid::parse_str(s).map_err(|_| parse_err()))?;
    let role_name = data["role_name"].as_str().ok_or_else(parse_err)?.to_string();
    let person_id = data["person_id"].as_str()
        .ok_or_else(parse_err)
        .and_then(|s| Uuid::parse_str(s).map_err(|_| parse_err()))?;
    let username = data["username"].as_str().ok_or_else(parse_err)?.to_string();

    let now = Utc::now();
    let exp = now + chrono::Duration::minutes(jwt_cfg.access_expiry_minutes);
    let claims = Claims {
        sub: user_id,
        institution_id,
        branch_id,
        role_id,
        role_name: role_name.clone(),
        jti: Uuid::new_v4().to_string(),
        exp: exp.timestamp(),
        iat: now.timestamp(),
    };

    let access_token = encode_jwt(&claims, &jwt_cfg.secret)?;
    let raw_refresh = generate_refresh_token();
    let refresh_hash = hash_refresh_token(&raw_refresh);
    let refresh_exp = now + chrono::Duration::days(jwt_cfg.refresh_expiry_days);

    sqlx::query("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)")
        .bind(user_id)
        .bind(&refresh_hash)
        .bind(refresh_exp)
        .execute(db)
        .await
        .map_err(AppError::Database)?;

    let _ = redis::cmd("DEL").arg(&key).query_async::<_, ()>(&mut redis_conn).await;

    // Fetch permissions
    let permissions: Vec<String> = sqlx::query_scalar(
        "SELECT resource || ':' || action FROM role_permissions WHERE role_id = $1"
    )
    .bind(role_id)
    .fetch_all(db)
    .await
    .unwrap_or_default();

    Ok(LoginResponse {
        mfa_required: false,
        mfa_token: None,
        access_token: Some(access_token),
        refresh_token: Some(raw_refresh),
        expires_in: Some(jwt_cfg.access_expiry_minutes * 60),
        user: Some(UserInfo {
            user_id,
            person_id,
            username,
            role_name,
            permissions,
            institution_id,
            branch_id,
            last_login: Some(now),
        }),
    })
}

pub async fn refresh_access_token(
    db: &PgPool,
    jwt_cfg: &JwtConfig,
    raw_refresh_token: &str,
) -> Result<String, AppError> {
    let token_hash = hash_refresh_token(raw_refresh_token);

    // Look up the token
    let row: Option<(Uuid, Uuid, Option<Uuid>, Uuid, String, chrono::DateTime<Utc>, bool)> = sqlx::query_as(
        r#"
        SELECT rt.user_id, u.institution_id, u.branch_id, u.role_id, r.role_name, rt.expires_at, rt.revoked
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

    let (user_id, institution_id, branch_id, role_id, role_name, expires_at, revoked) =
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
        branch_id,
        role_id,
        role_name,
        jti: Uuid::new_v4().to_string(),
        exp: exp.timestamp(),
        iat: now.timestamp(),
    };

    encode_jwt(&claims, &jwt_cfg.secret)
}

pub async fn logout(db: &PgPool, redis_pool: &deadpool_redis::Pool, claims: Claims) -> Result<(), AppError> {
    sqlx::query("UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false")
        .bind(claims.sub)
        .execute(db)
        .await
        .map_err(AppError::Database)?;

    // Add token to Redis blacklist
    let mut redis_conn = redis_pool.get().await.map_err(|_| AppError::Internal(anyhow::anyhow!("Redis error")))?;
    let key = format!("bl_token:{}", claims.jti);
    let now = Utc::now().timestamp();
    let ttl = claims.exp - now;

    if ttl > 0 {
        let _ = redis::cmd("SETEX")
            .arg(&key)
            .arg(ttl)
            .arg("revoked")
            .query_async::<_, ()>(&mut redis_conn)
            .await;
    }

    Ok(())
}

pub async fn hash_password(plain: &str) -> Result<String, AppError> {
    if plain.len() < 8 
        || !plain.chars().any(|c| c.is_numeric()) 
        || !plain.chars().any(|c| !c.is_alphanumeric()) 
    {
        return Err(crate::error::AppError::BadRequest(
            "Password must be at least 8 characters long, and contain at least one number and one special character".into()
        ));
    }

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
    use sha2::{Sha256, Digest};
    let mut h = Sha256::new();
    h.update(token.as_bytes());
    hex::encode(h.finalize())
}

pub async fn list_institutions(db: &PgPool) -> Result<Vec<InstitutionInfo>, AppError> {
    let rows = sqlx::query_as::<_, InstitutionInfo>(
        "SELECT institution_id, name FROM institutions WHERE soft_deleted = false ORDER BY name"
    )
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;
    Ok(rows)
}

pub async fn forgot_password(
    db: &PgPool,
    redis_pool: &deadpool_redis::Pool,
    institution_id: Uuid,
    username: &str,
) -> Result<(), AppError> {
    let user_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT user_id FROM users WHERE institution_id = $1 AND username = $2"
    )
    .bind(institution_id)
    .bind(username)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?;

    let _user_id = user_id.ok_or_else(|| AppError::NotFound("User not found".into()))?;

    use rand::Rng;
    let otp: String = (0..6).map(|_| rand::thread_rng().gen_range(0..10).to_string()).collect();

    let mut redis_conn = redis_pool.get().await.map_err(|_| AppError::Internal(anyhow::anyhow!("Redis error")))?;
    let key = format!("pwd_reset:{}:{}", institution_id, username);
    
    redis::cmd("SETEX")
        .arg(&key)
        .arg(900) // 15 minutes
        .arg(&otp)
        .query_async::<_, ()>(&mut redis_conn)
        .await
        .map_err(|_| AppError::Internal(anyhow::anyhow!("Redis error")))?;

    // Mock sending email
    tracing::info!("Mock Email: Password reset OTP for {} is {}", username, otp);

    Ok(())
}

pub async fn reset_password(
    db: &PgPool,
    redis_pool: &deadpool_redis::Pool,
    institution_id: Uuid,
    username: &str,
    otp: &str,
    new_password: &str,
) -> Result<(), AppError> {
    let mut redis_conn = redis_pool.get().await.map_err(|_| AppError::Internal(anyhow::anyhow!("Redis error")))?;
    let key = format!("pwd_reset:{}:{}", institution_id, username);

    let stored_otp: Option<String> = redis::cmd("GET")
        .arg(&key)
        .query_async(&mut redis_conn)
        .await
        .map_err(|_| AppError::Internal(anyhow::anyhow!("Redis error")))?;

    if stored_otp.is_none() || stored_otp.unwrap() != otp {
        return Err(AppError::BadRequest("Invalid or expired OTP".into()));
    }

    let hashed_pw = hash_password(new_password).await?;

    sqlx::query("UPDATE users SET password_hash = $1 WHERE institution_id = $2 AND username = $3")
        .bind(hashed_pw)
        .bind(institution_id)
        .bind(username)
        .execute(db)
        .await
        .map_err(AppError::Database)?;

    let _ = redis::cmd("DEL")
        .arg(&key)
        .query_async::<_, ()>(&mut redis_conn)
        .await;

    Ok(())
}

pub async fn create_role(
    db: &PgPool,
    institution_id: Uuid,
    req: crate::modules::auth::models::CreateRoleRequest,
) -> Result<crate::modules::auth::models::RoleInfo, AppError> {
    let mut tx = db.begin().await.map_err(AppError::Database)?;

    let role_id: Uuid = sqlx::query_scalar(
        "INSERT INTO roles (institution_id, role_name, description) VALUES ($1, $2, $3) RETURNING role_id"
    )
    .bind(institution_id)
    .bind(&req.role_name)
    .bind(&req.description)
    .fetch_one(&mut *tx)
    .await
    .map_err(AppError::Database)?;

    for perm in &req.permissions {
        sqlx::query("INSERT INTO role_permissions (role_id, resource, action) VALUES ($1, $2, $3)")
            .bind(role_id)
            .bind(&perm.resource)
            .bind(&perm.action)
            .execute(&mut *tx)
            .await
            .map_err(AppError::Database)?;
    }

    tx.commit().await.map_err(AppError::Database)?;

    Ok(crate::modules::auth::models::RoleInfo {
        role_id,
        role_name: req.role_name,
        description: req.description,
    })
}

pub async fn list_roles(
    db: &PgPool,
    institution_id: Uuid,
) -> Result<Vec<crate::modules::auth::models::RoleInfo>, AppError> {
    let rows = sqlx::query_as::<_, crate::modules::auth::models::RoleInfo>(
        "SELECT role_id, role_name, description FROM roles WHERE institution_id = $1 ORDER BY role_name"
    )
    .bind(institution_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    Ok(rows)
}
