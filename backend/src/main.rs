use axum::{
    extract::DefaultBodyLimit,
    http::{header, Method},
    middleware as axum_middleware,
    Router,
};
use std::{net::SocketAddr, time::Duration};
use tower::ServiceBuilder;
use tower_http::{
    compression::CompressionLayer,
    cors::{AllowOrigin, CorsLayer},
    timeout::TimeoutLayer,
    trace::TraceLayer,
};
use tracing::{info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

mod audit;
mod config;
mod db;
mod error;
mod events;
mod middleware;
mod modules;
mod response;
mod state;

use crate::{config::AppConfig, state::AppState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    init_tracing();

    let config = AppConfig::load()?;
    info!(env = %std::env::var("RUN_ENV").unwrap_or_else(|_| "development".into()), "EduOS API starting");

    let state = AppState::new(config.clone()).await?;

    // Run migrations on startup
    db::run_migrations(&state.db).await?;

    // Start background event subscriber
    tokio::spawn(crate::events::subscriber::start_subscriber(state.clone()));

    let app = build_router(state.clone(), &config);

    let addr: SocketAddr = format!("{}:{}", config.server.host, config.server.port).parse()?;
    info!(addr = %addr, "Server listening");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

fn build_router(state: AppState, config: &AppConfig) -> Router {
    let allowed_origins: Vec<_> = config
        .security
        .allowed_origins
        .iter()
        .filter_map(|o| o.parse().ok())
        .collect();

    let cors = CorsLayer::new()
        .allow_methods([
            Method::GET, Method::POST, Method::PUT,
            Method::PATCH, Method::DELETE, Method::OPTIONS,
        ])
        .allow_headers([
            header::AUTHORIZATION, header::CONTENT_TYPE,
            header::ACCEPT, header::ORIGIN,
        ])
        .allow_credentials(true)
        .allow_origin(if allowed_origins.is_empty() {
            warn!("ALLOWED_ORIGINS not set — CORS restricted to http://localhost:5200 (dev default)");
            AllowOrigin::list(vec!["http://localhost:5200".parse().expect("hardcoded URL is valid")])
        } else {
            AllowOrigin::list(allowed_origins)
        });

    // ── Public routes (no auth) ───────────────────────────────────────────────
    let public = Router::new()
        .merge(modules::health::router())
        .merge(modules::auth::public_router());

    // ── Protected routes (JWT required) ───────────────────────────────────────
    let protected = Router::new()
        .merge(modules::auth::protected_router())
        .merge(modules::student::router())
        .merge(modules::academics::router())
        .merge(modules::examination::router())
        .merge(modules::finance::router())
        .merge(modules::library::router())
        .merge(modules::hostel::router())
        .merge(modules::transport::router())
        .merge(modules::placement::router())
        .merge(modules::medical::router())
        .route_layer(axum_middleware::from_fn_with_state(
            state.clone(),
            middleware::rbac::rbac_middleware,
        ))
        .route_layer(axum_middleware::from_fn_with_state(
            state.clone(),
            middleware::auth::require_auth,
        ));

    Router::new()
        .nest("/api/v1", public)
        .nest("/api/v1", protected)
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(tower::limit::ConcurrencyLimitLayer::new(100))
                .layer(TimeoutLayer::new(Duration::from_secs(
                    config.server.request_timeout_secs,
                )))
                .layer(CompressionLayer::new())
                .layer(cors)
                .layer(DefaultBodyLimit::max(
                    config.server.max_body_size_mb * 1024 * 1024,
                )),
        )
        .with_state(state)
}

async fn shutdown_signal() {
    let ctrl_c = async { tokio::signal::ctrl_c().await.expect("ctrl+c failed") };
    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("SIGTERM handler failed")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        _ = ctrl_c    => warn!("Received Ctrl+C, shutting down"),
        _ = terminate => warn!("Received SIGTERM, shutting down"),
    }
}

fn init_tracing() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "info,eduos_backend=debug,sqlx=warn".into());
    tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer().json())
        .init();
}
