pub mod handlers;
pub mod models;
pub mod service;

use axum::{routing::{get, post, put, delete}, Router};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/courses",                              post(handlers::create_course))
        .route("/courses",                              get(handlers::list_courses))
        .route("/courses/:id",                          get(handlers::get_course))
        .route("/courses/:id",                          put(handlers::update_course))
        .route("/courses/:id",                          delete(handlers::delete_course))
        .route("/classes",                              post(handlers::create_class))
        .route("/classes",                              get(handlers::list_classes))
        .route("/faculty",                              get(handlers::list_faculty))
        .route("/faculty/:id/courses",                  post(handlers::allocate_faculty))
        .route("/faculty/:id/workload",                 get(handlers::get_faculty_workload))
        .route("/attendance/mark",                      post(handlers::mark_attendance))
        .route("/attendance/mark/bulk",                 post(handlers::bulk_mark_attendance))
        .route("/attendance/defaulters",                get(handlers::get_attendance_defaulters))
        .route("/attendance/:student_id/summary",       get(handlers::get_attendance_summary))
        .route("/timetables",                           post(handlers::create_timetable_slot))
        .route("/timetables/class/:class_id",           get(handlers::get_timetable))
        .route("/course-allocations",                   get(handlers::list_allocations))
        .route("/curriculums",                          get(handlers::list_curriculums))
        .route("/courses/:id/prerequisites",            post(handlers::set_course_prerequisite))
        .route("/courses/:id/prerequisites",            get(handlers::get_course_prerequisites))
        .route("/curriculums/:id/courses",              post(handlers::add_curriculum_course))
        .route("/curriculums/:id/courses",              get(handlers::get_curriculum_courses))
        .route("/leave-requests",                       post(handlers::create_leave_request))
        .route("/leave-requests",                       get(handlers::list_leave_requests))
        .route("/leave-requests/:id/status",            put(handlers::update_leave_status))
        .route("/quizzes",                              post(handlers::create_quiz))
        .route("/quizzes",                              get(handlers::list_quizzes))
        .route("/notifications",                        post(handlers::create_notification))
        .route("/notifications",                        get(handlers::list_notifications))
}
