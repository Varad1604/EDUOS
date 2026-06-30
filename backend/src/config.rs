use serde::Deserialize;
use anyhow::{Context, Result};

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub server:   ServerConfig,
    pub database: DatabaseConfig,
    pub redis:    RedisConfig,
    pub jwt:      JwtConfig,
    pub security: SecurityConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    pub host:                  String,
    pub port:                  u16,
    pub request_timeout_secs:  u64,
    pub max_body_size_mb:      usize,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DatabaseConfig {
    pub url:             String,
    pub max_connections: u32,
    pub min_connections: u32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RedisConfig {
    pub url: String,
    pub pool_max_size: usize,
    pub pool_timeout_secs: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct JwtConfig {
    pub secret:                 String,
    pub access_expiry_minutes:  i64,
    pub refresh_expiry_days:    i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SecurityConfig {
    pub allowed_origins: Vec<String>,
}

impl AppConfig {
    pub fn load() -> Result<Self> {
        let server = ServerConfig {
            host: std::env::var("SERVER_HOST").unwrap_or_else(|_| "127.0.0.1".into()),
            port: std::env::var("SERVER_PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(8000),
            request_timeout_secs: std::env::var("SERVER_REQUEST_TIMEOUT_SECS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(30),
            max_body_size_mb: std::env::var("SERVER_MAX_BODY_SIZE_MB")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(50),
        };

        let database = DatabaseConfig {
            url: std::env::var("DATABASE_URL").context("DATABASE_URL must be set")?,
            max_connections: std::env::var("DATABASE_MAX_CONNECTIONS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(20),
            min_connections: std::env::var("DATABASE_MIN_CONNECTIONS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(2),
        };

        let redis = RedisConfig {
            url: std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into()),
            pool_max_size: std::env::var("REDIS_POOL_MAX_SIZE")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(20),
            pool_timeout_secs: std::env::var("REDIS_POOL_TIMEOUT_SECS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(5),
        };

        let jwt_secret = std::env::var("JWT_SECRET").context("JWT_SECRET must be set")?;
        if jwt_secret.len() < 32 {
            anyhow::bail!("JWT_SECRET must be at least 32 characters long for security. Got {} chars.", jwt_secret.len());
        }

        let jwt = JwtConfig {
            secret: jwt_secret,
            access_expiry_minutes: std::env::var("JWT_ACCESS_EXPIRY_MINUTES")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(15),
            refresh_expiry_days: std::env::var("JWT_REFRESH_EXPIRY_DAYS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(7),
        };

        let allowed_origins: Vec<String> = std::env::var("ALLOWED_ORIGINS")
            .unwrap_or_default()
            .split(',')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(String::from)
            .collect();

        let security = SecurityConfig { allowed_origins };

        Ok(AppConfig { server, database, redis, jwt, security })
    }
}
