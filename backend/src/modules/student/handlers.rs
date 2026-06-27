use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde_json::json;
use uuid::Uuid;
use crate::{
    error::AppError,
    middleware::auth::Claims,
    modules::student::{models::*, service},
    state::AppState,
};

fn ok<T: serde::Serialize>(data: T) -> Json<serde_json::Value> {
    Json(json!({
        "success": true,
        "data": data,
        "meta": { "timestamp": chrono::Utc::now() }
    }))
}

pub async fn create_student(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateStudentRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let student = service::create_student(&state.db, &state.bus, &claims, body).await?;
    Ok(ok(student))
}

pub async fn list_students(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<StudentListQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let (pairs, total) = service::list_students(&state.db, &claims, &query).await?;
    let page  = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(20);
    let data: Vec<StudentResponse> = pairs.into_iter().map(|(sp, p)| StudentResponse {
        student_id:        sp.student_id,
        person:            p,
        enrollment_number: sp.enrollment_number,
        enrollment_status: sp.enrollment_status,
        enrollment_date:   sp.enrollment_date,
        branch_id:         sp.branch_id,
        current_semester:  sp.current_semester,
        category:          sp.category,
        quota:             sp.quota,
        cgpa:              sp.cgpa,
        guardian_name:     sp.guardian_name,
        guardian_phone:    sp.guardian_phone,
        created_at:        sp.created_at,
    }).collect();

    Ok(Json(json!({
        "success": true,
        "data": data,
        "meta": {
            "timestamp": chrono::Utc::now(),
            "pagination": { "total": total, "page": page, "limit": limit }
        }
    })))
}

pub async fn get_student(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(student_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let (sp, p) = service::get_student(&state.db, &claims, student_id).await?;
    Ok(ok(StudentResponse {
        student_id: sp.student_id, person: p,
        enrollment_number: sp.enrollment_number,
        enrollment_status: sp.enrollment_status,
        enrollment_date: sp.enrollment_date,
        branch_id: sp.branch_id,
        current_semester: sp.current_semester,
        category: sp.category, quota: sp.quota,
        cgpa: sp.cgpa,
        guardian_name: sp.guardian_name,
        guardian_phone: sp.guardian_phone,
        created_at: sp.created_at,
    }))
}

pub async fn update_student(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(student_id): Path<Uuid>,
    Json(body): Json<UpdateStudentRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let updated = service::update_student(&state.db, &state.bus, &claims, student_id, body).await?;
    Ok(ok(updated))
}

pub async fn delete_student(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(student_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    service::soft_delete_student(&state.db, &claims, student_id).await?;
    Ok(Json(json!({ "success": true, "data": null })))
}

pub async fn change_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(student_id): Path<Uuid>,
    Json(body): Json<ChangeStatusRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let updated = service::change_status(&state.db, &state.bus, &claims, student_id, body).await?;
    Ok(ok(updated))
}

pub async fn list_documents(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(student_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let _ = service::get_student(&state.db, &claims, student_id).await?; // access check
    let docs = service::list_documents(&state.db, &claims, student_id).await?;
    Ok(ok(docs))
}

pub async fn get_academic_records(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(student_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let _ = service::get_student(&state.db, &claims, student_id).await?;
    let records = service::get_academic_records(&state.db, student_id).await?;
    Ok(ok(records))
}

pub async fn get_enrollment_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(student_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let (sp, _) = service::get_student(&state.db, &claims, student_id).await?;
    Ok(ok(json!({ "student_id": student_id, "status": sp.enrollment_status })))
}
