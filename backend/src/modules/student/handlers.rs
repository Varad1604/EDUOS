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
    response::ok,
    state::AppState,
};
use validator::Validate;


pub async fn create_student(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateStudentRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    body.validate().map_err(|e| AppError::Validation(e.to_string()))?;
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
    body.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    let updated = service::update_student(&state.db, &state.bus, &claims, student_id, body).await?;
    Ok(ok(updated))
}



pub async fn upload_document(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(student_id): Path<Uuid>,
    mut multipart: axum::extract::Multipart,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut file_data = Vec::new();
    let mut doc_type = String::new();
    let mut file_name = String::new();

    while let Some(field) = multipart.next_field().await.unwrap_or(None) {
        let name = field.name().unwrap_or("").to_string();
        if name == "document_type" {
            doc_type = field.text().await.unwrap_or_default();
        } else if name == "file" {
            file_name = field.file_name().unwrap_or("unknown").to_string();
            let data = field.bytes().await.map_err(|_| AppError::BadRequest("Failed to read file".into()))?;
            file_data = data.to_vec();
        }
    }

    if doc_type.is_empty() || file_data.is_empty() {
        return Err(AppError::BadRequest("document_type and file are required".into()));
    }

    let doc = service::upload_document(&state.db, &claims, student_id, &doc_type, &file_name, &file_data).await?;
    Ok(ok(doc))
}

pub async fn bulk_import_students(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<BulkImportRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let imported = service::bulk_import_students(&state.db, &state.bus, &claims, body.students).await?;
    Ok(ok(json!({ "imported": imported })))
}

pub async fn generate_transfer_certificate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(student_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let tc_data = service::generate_transfer_certificate(&state.db, &claims, student_id).await?;
    Ok(ok(tc_data))
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

pub async fn get_me(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    let (sp, p) = service::get_student_by_user_id(&state.db, claims.sub, claims.institution_id).await?;
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
