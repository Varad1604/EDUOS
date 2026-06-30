use axum::{
    extract::{Path, State},
    Extension, Json,
};
use uuid::Uuid;
use crate::{
    error::AppError,
    middleware::auth::Claims,
    modules::transport::{models::*, service},
    response::ok,
    state::AppState,
};

pub async fn create_route(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRouteRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let route = service::create_route(&state.db, &claims, body).await?;
    Ok(ok(route))
}

pub async fn list_routes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    let routes = service::list_routes(&state.db, &claims).await?;
    Ok(ok(routes))
}

pub async fn create_stop(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateStopRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let stop = service::create_stop(&state.db, &claims, body).await?;
    Ok(ok(stop))
}

pub async fn list_stops(
    State(state): State<AppState>,
    Path(route_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let stops = service::list_stops(&state.db, route_id).await?;
    Ok(ok(stops))
}

pub async fn create_vehicle(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateVehicleRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let vehicle = service::create_vehicle(&state.db, &claims, body).await?;
    Ok(ok(vehicle))
}

pub async fn list_vehicles(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    let vehicles = service::list_vehicles(&state.db, &claims).await?;
    Ok(ok(vehicles))
}

pub async fn allocate_transport(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AllocateTransportRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let allocation = service::allocate_transport(&state.db, &state.bus, &claims, body).await?;
    Ok(ok(allocation))
}

pub async fn vacate_transport(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(allocation_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let allocation = service::vacate_transport(&state.db, &claims, allocation_id).await?;
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

pub async fn create_driver(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDriverRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let driver = service::create_driver(&state.db, &claims, body).await?;
    Ok(ok(driver))
}

pub async fn list_drivers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    let drivers = service::list_drivers(&state.db, &claims).await?;
    Ok(ok(drivers))
}

pub async fn create_trip_log(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTripLogRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let trip = service::create_trip_log(&state.db, &claims, body).await?;
    Ok(ok(trip))
}

pub async fn update_trip_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(log_id): Path<Uuid>,
    Json(body): Json<UpdateTripStatusRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let trip = service::update_trip_status(&state.db, &claims, log_id, body).await?;
    Ok(ok(trip))
}

pub async fn list_trip_logs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    let trips = service::list_trip_logs(&state.db, &claims).await?;
    Ok(ok(trips))
}

pub async fn get_live_gps_simulation(
    Path(route_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let gps = service::get_live_gps_simulation(route_id).await?;
    Ok(Json(gps))
}
