pub mod handlers;
pub mod models;
pub mod service;

use axum::{routing::{get, patch, post}, Router};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/fee-structures",                           post(handlers::create_fee_structure))
        .route("/fee-structures",                           get(handlers::list_fee_structures))
        .route("/fee-allocations",                          post(handlers::allocate_fee))
        .route("/fee-allocations/:student_id",              get(handlers::get_student_fee_summary))
        .route("/payments",                                 post(handlers::initiate_payment))
        .route("/payments/razorpay/verify",                 post(handlers::verify_razorpay))
        .route("/payments/:student_id",                     get(handlers::get_payments))
        .route("/scholarships",                             post(handlers::create_scholarship))
        .route("/scholarships",                             get(handlers::list_scholarships))
        .route("/scholarships/:id/allocate",                post(handlers::allocate_scholarship))
        .route("/accounts",                                 post(handlers::create_account))
        .route("/accounts",                                 get(handlers::list_accounts))
        .route("/journal-entries",                          post(handlers::create_journal_entry))
        .route("/journal-entries",                          get(handlers::list_journal_entries))
        .route("/journal-entries/:id/approve",              patch(handlers::approve_journal_entry))
        .route("/reports/balance-sheet",                    get(handlers::balance_sheet))
        .route("/reports/income-statement",                 get(handlers::income_statement))
        .route("/reports/audit-logs",                       get(handlers::audit_logs))
        .route("/reports/fee-collection-trend",             get(handlers::get_fee_collection_trend))
        .route("/fiscal-years",                             post(handlers::create_fiscal_year))
        .route("/fiscal-years/:id/lock",                    patch(handlers::lock_fiscal_year))
        .route("/bank-statements",                          post(handlers::upload_bank_statement))
        .route("/late-fees/policy",                         post(handlers::create_late_fee_policy))
        .route("/late-fees/apply",                          post(handlers::apply_late_fees))
        .route("/installments",                             post(handlers::create_installment_plan))
        .route("/waivers",                                  post(handlers::request_fee_waiver))
        .route("/waivers/:id/approve",                      patch(handlers::approve_fee_waiver))
}

