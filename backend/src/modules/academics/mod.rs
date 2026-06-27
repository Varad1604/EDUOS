pub mod handlers;
pub mod models;
pub mod service;

use axum::{routing::{get, post}, Router};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/courses",                              post(handlers::create_course))
        .route("/courses",                              get(handlers::list_courses))
        .route("/courses/:id",                          get(handlers::get_course))
        .route("/classes",                              post(handlers::create_class))
        .route("/classes",                              get(handlers::list_classes))
        .route("/faculty/:id/courses",                  post(handlers::allocate_faculty))
        .route("/faculty/:id/workload",                 get(handlers::get_faculty_workload))
        .route("/attendance/mark",                      post(handlers::mark_attendance))
        .route("/attendance/mark/bulk",                 post(handlers::bulk_mark_attendance))
        .route("/attendance/:student_id/summary",       get(handlers::get_attendance_summary))
        .route("/timetables",                           post(handlers::create_timetable_slot))
        .route("/timetables/class/:class_id",           get(handlers::get_timetable))
        .route("/course-allocations",                   get(handlers::list_allocations))
}
