use axum::Json;
use serde::Serialize;
use serde_json::{json, Value};

/// Shared JSON success response wrapper used by all handlers.
/// Returns `{ "success": true, "data": <T>, "meta": { "timestamp": ... } }`.
pub fn ok<T: Serialize>(data: T) -> Json<Value> {
    Json(json!({
        "success": true,
        "data":    data,
        "meta":    { "timestamp": chrono::Utc::now() }
    }))
}
