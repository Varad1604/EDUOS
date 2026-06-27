use axum::{routing::get, Router, Json};
use serde_json::json;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .route("/health/ready", get(readiness))
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({
        "status": "ok",
        "service": "eduos-api",
        "version": env!("CARGO_PKG_VERSION")
    }))
}

async fn readiness(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> Json<serde_json::Value> {
    let db_ok = sqlx::query("SELECT 1")
        .fetch_one(&state.db)
        .await
        .is_ok();

    let status = if db_ok { "ready" } else { "degraded" };
    Json(json!({
        "status": status,
        "db": if db_ok { "ok" } else { "error" }
    }))
}
