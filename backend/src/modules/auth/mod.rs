pub mod handlers;
pub mod models;
pub mod service;

use axum::{routing::{get, post}, Router};
use crate::state::AppState;

pub fn public_router() -> Router<AppState> {
    Router::new()
        .route("/auth/login",   post(handlers::login))
        .route("/auth/verify-mfa", post(handlers::verify_mfa))
        .route("/auth/refresh", post(handlers::refresh))
        .route("/auth/institutions", get(handlers::list_institutions))
        .route("/auth/forgot-password", post(handlers::forgot_password))
        .route("/auth/reset-password", post(handlers::reset_password))
}

pub fn protected_router() -> Router<AppState> {
    Router::new()
        .route("/auth/logout",  post(handlers::logout))
        .route("/roles", get(handlers::list_roles).post(handlers::create_role))
}
