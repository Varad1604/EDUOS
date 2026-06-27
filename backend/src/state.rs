use sqlx::PgPool;
use deadpool_redis::Pool as RedisPool;
use std::sync::Arc;
use crate::{config::AppConfig, events::bus::EventBus};

#[derive(Clone)]
pub struct AppState {
    pub db:     PgPool,
    #[allow(dead_code)]
    pub redis:  RedisPool,
    pub bus:    Arc<EventBus>,
    pub config: Arc<AppConfig>,
}

impl AppState {
    pub async fn new(config: AppConfig) -> anyhow::Result<Self> {
        // DB pool
        let db = crate::db::create_pool(&config.database).await?;

        // Redis pool
        let redis_cfg = deadpool_redis::Config::from_url(&config.redis.url);
        let redis = redis_cfg
            .create_pool(Some(deadpool_redis::Runtime::Tokio1))?;

        // Event bus
        let bus = Arc::new(EventBus::new(1024));

        Ok(Self {
            db,
            redis,
            bus,
            config: Arc::new(config),
        })
    }

    #[allow(dead_code)]
    pub fn db(&self) -> &PgPool {
        &self.db
    }
}
