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
        let cfg = config::Config::builder()
            // Database
            .set_default("database.max_connections", 20)?
            .set_default("database.min_connections", 2)?
            // Server
            .set_default("server.host", "127.0.0.1")?
            .set_default("server.port", 8000)?
            .set_default("server.request_timeout_secs", 30)?
            .set_default("server.max_body_size_mb", 50)?
            // JWT
            .set_default("jwt.access_expiry_minutes", 15)?
            .set_default("jwt.refresh_expiry_days", 7)?
            // Security
            .set_default("security.allowed_origins", Vec::<String>::new())?
            // Load from env
            .add_source(
                config::Environment::default()
                    .separator("_")
                    .try_parsing(true),
            )
            .build()
            .context("Failed to build config")?;

        // Manual env overrides that the config crate might not pick up cleanly
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
        };

        let jwt = JwtConfig {
            secret: std::env::var("JWT_SECRET").context("JWT_SECRET must be set")?,
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

        // Try deserializing the rest from config crate, or just return our manually built one
        let _ = cfg; // config crate builder used only for defaults fallback

        Ok(AppConfig { server, database, redis, jwt, security })
    }
}
