use axum::{
    extract::{Path, State},
    Extension, Json,
};
use uuid::Uuid;
use crate::{
    error::AppError,
    middleware::auth::Claims,
    modules::hostel::{models::*, service},
    response::ok,
    state::AppState,
};

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

pub async fn create_maintenance_ticket(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMaintenanceTicketRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ticket = service::create_maintenance_ticket(&state.db, &claims, body).await?;
    Ok(ok(ticket))
}

pub async fn update_ticket_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(ticket_id): Path<Uuid>,
    Json(body): Json<UpdateTicketStatusRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ticket = service::update_ticket_status(&state.db, &claims, ticket_id, body).await?;
    Ok(ok(ticket))
}

pub async fn list_maintenance_tickets(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    let tickets = service::list_maintenance_tickets(&state.db, &claims).await?;
    Ok(ok(tickets))
}

pub async fn request_hostel_leave(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateHostelLeaveRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let leave = service::request_hostel_leave(&state.db, &claims, body).await?;
    Ok(ok(leave))
}

pub async fn approve_hostel_leave(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(leave_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let leave = service::approve_hostel_leave(&state.db, &claims, leave_id, true).await?;
    Ok(ok(leave))
}

pub async fn reject_hostel_leave(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(leave_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let leave = service::approve_hostel_leave(&state.db, &claims, leave_id, false).await?;
    Ok(ok(leave))
}

pub async fn list_leave_requests(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    let leaves = service::list_leave_requests(&state.db, &claims).await?;
    Ok(ok(leaves))
}

pub async fn create_mess_menu(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMessMenuRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let menu = service::create_mess_menu(&state.db, &claims, body).await?;
    Ok(ok(menu))
}

pub async fn get_mess_menus(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    let menus = service::get_mess_menus(&state.db, &claims).await?;
    Ok(ok(menus))
}

pub async fn set_mess_preference(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<MessPreferenceRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let pref = service::set_mess_preference(&state.db, &claims, body).await?;
    Ok(ok(pref))
}
