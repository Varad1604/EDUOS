use axum::{
    extract::{Path, State},
    Extension, Json,
};
use serde_json::json;
use uuid::Uuid;
use crate::{
    error::AppError,
    middleware::auth::Claims,
    modules::hostel::{models::*, service},
    state::AppState,
};

fn ok<T: serde::Serialize>(data: T) -> Json<serde_json::Value> {
    Json(json!({
        "success": true,
        "data": data,
        "meta": { "timestamp": chrono::Utc::now() }
    }))
}

pub async fn create_room(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRoomRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let room = service::create_room(&state.db, &claims, body).await?;
    Ok(ok(room))
}

pub async fn list_rooms(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    let rooms = service::list_rooms(&state.db, &claims).await?;
    Ok(ok(rooms))
}

pub async fn allocate_room(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AllocateRoomRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let allocation = service::allocate_room(&state.db, &state.bus, &claims, body).await?;
    Ok(ok(allocation))
}

pub async fn vacate_room(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(allocation_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let allocation = service::vacate_room(&state.db, &claims, allocation_id).await?;
    Ok(ok(allocation))
}

pub async fn list_allocations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    let allocations = service::list_allocations(&state.db, &claims).await?;
    Ok(ok(allocations))
}

pub async fn list_student_allocations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(student_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let allocations = service::list_student_allocations(&state.db, &claims, student_id).await?;
    Ok(ok(allocations))
}
