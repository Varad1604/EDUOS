pub mod handlers;
pub mod models;
pub mod service;

use axum::{routing::{delete, get, patch, post, put}, Router};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/students",                                   post(handlers::create_student))
        .route("/students",                                   get(handlers::list_students))
        .route("/students/me",                                get(handlers::get_me))
        .route("/students/:id",                               get(handlers::get_student))
        .route("/students/:id",                               put(handlers::update_student))
        .route("/students/:id",                               delete(handlers::delete_student))
        .route("/students/:id/status",                        patch(handlers::change_status))
        .route("/students/:id/documents",                     get(handlers::list_documents))
        .route("/students/:id/academic-records",              get(handlers::get_academic_records))
        .route("/students/:id/enrollment-status",             get(handlers::get_enrollment_status))
        .route("/students/bulk-import",                       post(handlers::bulk_import_students))
        .route("/students/:id/documents/upload",              post(handlers::upload_document))
        .route("/students/:id/tc",                            post(handlers::generate_transfer_certificate))
}
