pub mod handlers;
pub mod models;
pub mod service;

use axum::{routing::{delete, get, patch, post, put}, Router};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/students",                                   post(handlers::create_student))
        .route("/students",                                   get(handlers::list_students))
        .route("/students/:id",                               get(handlers::get_student))
        .route("/students/:id",                               put(handlers::update_student))
        .route("/students/:id",                               delete(handlers::delete_student))
        .route("/students/:id/status",                        patch(handlers::change_status))
        .route("/students/:id/documents",                     get(handlers::list_documents))
        .route("/students/:id/academic-records",              get(handlers::get_academic_records))
        .route("/students/:id/enrollment-status",             get(handlers::get_enrollment_status))
}
