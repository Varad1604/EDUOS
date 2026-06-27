pub mod handlers;
pub mod models;
pub mod service;

use axum::{routing::post, Router};
use crate::state::AppState;

pub fn public_router() -> Router<AppState> {
    Router::new()
        .route("/auth/login",   post(handlers::login))
        .route("/auth/refresh", post(handlers::refresh))
}

pub fn protected_router() -> Router<AppState> {
    Router::new()
        .route("/auth/logout",  post(handlers::logout))
}
