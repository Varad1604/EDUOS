pub mod handlers;
pub mod models;
pub mod service;

use axum::{routing::{get, patch, post}, Router};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/exams",                                post(handlers::create_exam))
        .route("/exams",                                get(handlers::list_exams))
        .route("/exams/:id/hall-tickets",               post(handlers::generate_hall_tickets))
        .route("/exams/:id/hall-tickets",               get(handlers::get_hall_tickets))
        .route("/marks",                                post(handlers::enter_marks))
        .route("/marks/bulk",                           post(handlers::bulk_enter_marks))
        .route("/results/process",                      post(handlers::process_result))
        .route("/results/:result_id/publish",           patch(handlers::publish_result))
        .route("/results/:student_id",                  get(handlers::get_student_results))
        .route("/transcripts",                          post(handlers::generate_transcript))
        .route("/transcripts/:student_id",              get(handlers::get_transcripts))
        .route("/revaluation/request",                  post(handlers::request_revaluation))
        .route("/revaluation",                          get(handlers::list_revaluations))
        .route("/revaluation/:id/approve",              patch(handlers::approve_revaluation))
        .route("/marks/student/:student_id",            get(handlers::get_student_marks))
}


