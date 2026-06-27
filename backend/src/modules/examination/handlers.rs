use axum::{extract::{Path, Query, State}, Extension, Json};
use serde_json::json;
use serde::Deserialize;
use uuid::Uuid;
use crate::{error::AppError, middleware::auth::Claims, modules::examination::{models::*, service}, state::AppState};

fn ok<T: serde::Serialize>(data: T) -> Json<serde_json::Value> {
    Json(json!({ "success": true, "data": data, "meta": { "timestamp": chrono::Utc::now() } }))
}

#[derive(Deserialize)] pub struct ResultQuery { pub semester: Option<i32> }

pub async fn create_exam(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Json(b): Json<CreateExamRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::create_exam(&s.db, &s.bus, &c, b).await?))
}

pub async fn generate_hall_tickets(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Path(exam_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let tickets = service::generate_hall_tickets(&s.db, &s.bus, &c, exam_id).await?;
    Ok(ok(json!({ "count": tickets.len(), "tickets": tickets })))
}

pub async fn get_hall_tickets(
    State(s): State<AppState>, Extension(_c): Extension<Claims>,
    Path(exam_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let tickets = sqlx::query_as::<_, crate::modules::examination::models::HallTicket>(
        "SELECT * FROM exam_hall_tickets WHERE exam_id = $1 ORDER BY seat_no"
    )
    .bind(exam_id)
    .fetch_all(&s.db)
    .await
    .map_err(AppError::Database)?;
    Ok(ok(tickets))
}

pub async fn enter_marks(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Json(b): Json<EnterMarksRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::enter_marks(&s.db, &s.bus, &c, c.sub, b).await?))
}

pub async fn bulk_enter_marks(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Json(b): Json<BulkMarksRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut results = vec![];
    for entry in b.entries {
        let r = service::enter_marks(&s.db, &s.bus, &c, c.sub, EnterMarksRequest {
            exam_id: b.exam_id,
            student_id: entry.student_id,
            course_id: b.course_id,
            obtained_marks: entry.obtained_marks,
        }).await?;
        results.push(r);
    }
    Ok(ok(results))
}

pub async fn process_result(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Json(b): Json<ProcessResultRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::process_result(&s.db, &s.bus, &c, b).await?))
}

pub async fn publish_result(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Path(result_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::publish_result(&s.db, &c, result_id).await?))
}

pub async fn get_student_results(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Path(student_id): Path<Uuid>, Query(q): Query<ResultQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::get_student_results(&s.db, &c, student_id, q.semester).await?))
}

pub async fn generate_transcript(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Json(b): Json<GenerateTranscriptRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::generate_transcript(&s.db, &s.bus, &c, b).await?))
}

pub async fn get_transcripts(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Path(student_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let t = sqlx::query_as::<_, crate::modules::examination::models::Transcript>(
        "SELECT * FROM transcripts WHERE student_id = $1 AND institution_id = $2 ORDER BY generated_at DESC"
    )
    .bind(student_id).bind(c.institution_id).fetch_all(&s.db).await.map_err(AppError::Database)?;
    Ok(ok(t))
}

pub async fn request_revaluation(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Json(b): Json<RevaluationRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let id = service::request_revaluation(&s.db, &s.bus, &c, b).await?;
    Ok(ok(json!({ "revaluation_id": id })))
}

pub async fn list_exams(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::list_exams(&s.db, &c).await?))
}

pub async fn list_revaluations(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::list_revaluations(&s.db, &c).await?))
}

pub async fn approve_revaluation(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(b): Json<ApproveRevaluationRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    service::approve_revaluation(&s.db, &s.bus, &c, id, b).await?;
    Ok(ok(json!({ "success": true })))
}

pub async fn get_student_marks(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Path(student_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::get_student_marks(&s.db, &c, student_id).await?))
}


