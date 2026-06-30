pub mod models;
pub mod service;
pub mod handlers;

use axum::{routing::{get, post, patch}, Router};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        // Stats
        .route("/placement/stats", get(handlers::get_placement_stats))
        // Companies
        .route("/placement/companies",
            get(handlers::list_companies).post(handlers::create_company))
        .route("/placement/companies/:company_id/status",
            patch(handlers::update_company_status))
        // Drives
        .route("/placement/drives",
            get(handlers::list_drives).post(handlers::create_drive))
        .route("/placement/drives/:drive_id/close",
            post(handlers::close_drive))
        .route("/placement/drives/:drive_id/eligible-students",
            get(handlers::get_eligible_students))
        // Applications
        .route("/placement/applications",
            get(handlers::list_applications).post(handlers::apply_to_drive))
        .route("/placement/applications/student/:student_id",
            get(handlers::get_my_applications))
        .route("/placement/applications/:application_id/status",
            patch(handlers::update_application_status))
        // Interview Rounds
        .route("/placement/rounds", post(handlers::create_round))
        .route("/placement/rounds/application/:application_id",
            get(handlers::list_rounds))
        .route("/placement/rounds/:round_id/result",
            patch(handlers::update_round_result))
        // Offers
        .route("/placement/offers",
            get(handlers::list_offers).post(handlers::create_offer))
        .route("/placement/offers/:offer_id/status",
            patch(handlers::update_offer_status))
        // Interviews (Calendar/Scheduling)
        .route("/placement/interviews", get(handlers::list_interviews).post(handlers::schedule_interview))
        .route("/placement/interviews/:interview_id/status", post(handlers::update_interview_status))
        // Alumni Career tracking
        .route("/placement/alumni-tracking", get(handlers::list_alumni_placements).post(handlers::register_alumni_placement))
        // Analytics
        .route("/placement/analytics/stats", get(handlers::get_placement_analytics_stats))
}
