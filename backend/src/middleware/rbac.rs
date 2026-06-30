use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use crate::{error::AppError, middleware::auth::Claims, state::AppState};


/// Global RBAC middleware that intercepts requests, maps them to resource & action, and checks DB permissions.
pub async fn rbac_middleware(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let claims = req
        .extensions()
        .get::<Claims>()
        .ok_or(AppError::Unauthorized("No auth claims".into()))?
        .clone();

    let method = req.method().clone();
    let path = req.uri().path();

    // Map method and path pattern to resource & action
    let (resource, action) = match (method.as_str(), path) {
        // Students
        ("POST", "/api/v1/students") => ("students", "create"),
        ("GET", "/api/v1/students") => ("students", "read"),
        (m, p) if p.starts_with("/api/v1/students/") => {
            if p.ends_with("/status") {
                ("students", "update")
            } else if p.ends_with("/documents") || p.ends_with("/academic-records") || p.ends_with("/enrollment-status") {
                ("students", "read")
            } else {
                match m {
                    "GET" => ("students", "read"),
                    "PUT" => ("students", "update"),
                    "DELETE" => ("students", "delete"),
                    _ => ("", "")
                }
            }
        }
        // Courses
        ("POST", "/api/v1/courses") => ("courses", "create"),
        ("GET", "/api/v1/courses") => ("courses", "read"),
        ("GET", p) if p.starts_with("/api/v1/courses/") => ("courses", "read"),
        ("POST", "/api/v1/classes") => ("courses", "create"),
        ("GET", "/api/v1/classes") => ("courses", "read"),
        ("POST", p) if p.starts_with("/api/v1/faculty/") && p.ends_with("/courses") => ("courses", "create"),
        ("GET", "/api/v1/faculty") => ("courses", "read"),
        ("GET", p) if p.starts_with("/api/v1/faculty/") && p.ends_with("/workload") => ("courses", "read"),
        // Attendance
        ("POST", "/api/v1/attendance/mark") => ("attendance", "create"),
        ("POST", "/api/v1/attendance/mark/bulk") => ("attendance", "create"),
        ("GET", p) if p.starts_with("/api/v1/attendance/") && p.ends_with("/summary") => ("attendance", "read"),
        // Timetable
        ("POST", "/api/v1/timetables") => ("courses", "create"),
        ("GET", p) if p.starts_with("/api/v1/timetables/class/") => ("courses", "read"),
        ("GET", "/api/v1/course-allocations") => ("courses", "read"),
        // Quizzes & Notifications
        ("POST", "/api/v1/quizzes") => ("courses", "create"),
        ("GET", "/api/v1/quizzes") => ("courses", "read"),
        ("POST", "/api/v1/notifications") => ("courses", "create"),
        ("GET", "/api/v1/notifications") => ("courses", "read"),
        // Exams & Marks
        ("POST", "/api/v1/exams") => ("exams", "create"),
        ("GET",  "/api/v1/exams") => ("exams", "read"),
        ("POST", "/api/v1/marks")         => ("marks", "create"),
        ("POST", "/api/v1/marks/bulk")    => ("marks", "create"),
        ("POST", "/api/v1/marks/publish") => ("marks", "approve"),
        ("POST", "/api/v1/results/process") => ("marks", "approve"),
        ("GET", p) if p.starts_with("/api/v1/results/") => ("marks", "read"),
        ("GET", p) if p.starts_with("/api/v1/marks/student/") => ("marks", "read"),
        ("GET", "/api/v1/revaluation") => ("marks", "read"),
        ("PATCH", p) if p.starts_with("/api/v1/revaluation/") && p.ends_with("/approve") => ("marks", "approve"),
        // Fees & Finance
        ("POST", "/api/v1/fee-structures") => ("fees", "create"),
        ("GET", "/api/v1/fee-structures") => ("fees", "read"),
        ("POST", "/api/v1/fee-allocations") => ("fees", "create"),
        ("GET", p) if p.starts_with("/api/v1/fee-allocations/") => ("fees", "read"),
        ("POST", "/api/v1/payments") => ("fees", "create"),
        ("POST", p) if p.starts_with("/api/v1/payments/") && p.ends_with("/verify") => ("fees", "create"),
        ("GET", p) if p.starts_with("/api/v1/payments/") => ("fees", "read"),
        ("POST", "/api/v1/scholarships") => ("fees", "create"),
        ("GET", "/api/v1/scholarships") => ("fees", "read"),
        ("POST", p) if p.starts_with("/api/v1/scholarships/") && p.ends_with("/allocate") => ("fees", "create"),
        ("POST", "/api/v1/late-fees/policy") => ("fees", "create"),
        ("POST", "/api/v1/late-fees/apply") => ("fees", "create"),
        ("POST", "/api/v1/installments") => ("fees", "create"),
        ("POST", "/api/v1/waivers") => ("fees", "create"),
        ("PATCH", p) if p.starts_with("/api/v1/waivers/") && p.ends_with("/approve") => ("fees", "approve"),
        ("POST", "/api/v1/accounts") => ("accounts", "create"),
        ("GET", "/api/v1/accounts") => ("accounts", "read"),
        ("POST", "/api/v1/journal-entries") => ("accounts", "create"),
        ("GET", "/api/v1/journal-entries") => ("accounts", "read"),
        ("PATCH", p) if p.starts_with("/api/v1/journal-entries/") && p.ends_with("/approve") => ("accounts", "approve"),
        ("POST", "/api/v1/fiscal-years") => ("accounts", "create"),
        ("PATCH", p) if p.starts_with("/api/v1/fiscal-years/") && p.ends_with("/lock") => ("accounts", "approve"),
        ("POST", "/api/v1/bank-statements") => ("accounts", "create"),
        ("GET", "/api/v1/reports/balance-sheet") => ("reports", "read"),
        ("GET", "/api/v1/reports/income-statement") => ("reports", "read"),
        ("GET", "/api/v1/reports/audit-logs") => ("reports", "read"),
        ("GET", "/api/v1/reports/fee-collection-trend") => ("reports", "read"),
        // Library
        ("POST", "/api/v1/library/books") => ("library", "manage"),
        ("GET", "/api/v1/library/books") => ("library", "view"),
        ("POST", "/api/v1/library/loans") => ("library", "manage"),
        ("POST", p) if p.starts_with("/api/v1/library/loans/") && p.ends_with("/return") => ("library", "manage"),
        ("GET", "/api/v1/library/loans") => ("library", "manage"),
        ("GET", p) if p.starts_with("/api/v1/library/loans/student/") => ("library", "view"),
        // Hostel
        ("POST", "/api/v1/hostel/rooms") => ("hostel", "manage"),
        ("GET", "/api/v1/hostel/rooms") => ("hostel", "view"),
        ("POST", "/api/v1/hostel/allocations") => ("hostel", "manage"),
        ("POST", p) if p.starts_with("/api/v1/hostel/allocations/") && p.ends_with("/vacate") => ("hostel", "manage"),
        ("GET", "/api/v1/hostel/allocations") => ("hostel", "manage"),
        ("GET", p) if p.starts_with("/api/v1/hostel/allocations/student/") => ("hostel", "view"),
        // Transport
        ("POST", "/api/v1/transport/routes") => ("transport", "manage"),
        ("GET", "/api/v1/transport/routes") => ("transport", "view"),
        ("POST", "/api/v1/transport/stops") => ("transport", "manage"),
        ("GET", p) if p.starts_with("/api/v1/transport/routes/") && p.ends_with("/stops") => ("transport", "view"),
        ("POST", "/api/v1/transport/vehicles") => ("transport", "manage"),
        ("GET", "/api/v1/transport/vehicles") => ("transport", "view"),
        ("POST", "/api/v1/transport/allocations") => ("transport", "manage"),
        ("POST", p) if p.starts_with("/api/v1/transport/allocations/") && p.ends_with("/vacate") => ("transport", "manage"),
        ("GET", "/api/v1/transport/allocations") => ("transport", "manage"),
        ("GET", p) if p.starts_with("/api/v1/transport/allocations/student/") => ("transport", "view"),
        // Placement
        ("GET", "/api/v1/placement/stats") => ("placement", "view"),
        ("GET", "/api/v1/placement/companies") => ("placement", "view"),
        ("POST", "/api/v1/placement/companies") => ("placement", "manage"),
        ("PATCH", p) if p.starts_with("/api/v1/placement/companies/") && p.ends_with("/status") => ("placement", "manage"),
        ("GET", "/api/v1/placement/drives") => ("placement", "view"),
        ("POST", "/api/v1/placement/drives") => ("placement", "manage"),
        ("POST", p) if p.starts_with("/api/v1/placement/drives/") && p.ends_with("/close") => ("placement", "manage"),
        ("GET", "/api/v1/placement/applications") => ("placement", "manage"),
        ("POST", "/api/v1/placement/applications") => ("placement", "apply"),
        ("GET", p) if p.starts_with("/api/v1/placement/applications/student/") => ("placement", "view"),
        ("PATCH", p) if p.starts_with("/api/v1/placement/applications/") && p.ends_with("/status") => ("placement", "manage"),
        ("GET", p) if p.starts_with("/api/v1/placement/rounds/application/") => ("placement", "view"),
        ("POST", "/api/v1/placement/rounds") => ("placement", "manage"),
        ("PATCH", p) if p.starts_with("/api/v1/placement/rounds/") && p.ends_with("/result") => ("placement", "manage"),
        ("GET", "/api/v1/placement/offers") => ("placement", "manage"),
        ("POST", "/api/v1/placement/offers") => ("placement", "manage"),
        ("PATCH", p) if p.starts_with("/api/v1/placement/offers/") && p.ends_with("/status") => ("placement", "view"),
        // Medical
        ("GET", "/api/v1/medical/stats") => ("medical", "view"),
        ("GET", "/api/v1/medical/visits") => ("medical", "view"),
        ("POST", "/api/v1/medical/visits") => ("medical", "manage"),
        ("PATCH", p) if p.starts_with("/api/v1/medical/visits/") && p.ends_with("/close") => ("medical", "manage"),
        ("GET", p) if p.starts_with("/api/v1/medical/visits/") && p.ends_with("/vitals") => ("medical", "view"),
        ("POST", p) if p.starts_with("/api/v1/medical/visits/") && p.ends_with("/vitals") => ("medical", "manage"),
        ("GET", p) if p.starts_with("/api/v1/medical/visits/") && p.ends_with("/prescriptions") => ("medical", "view"),
        ("POST", "/api/v1/medical/prescriptions") => ("medical", "manage"),
        ("GET", "/api/v1/medical/inventory") => ("medical", "view"),
        ("POST", "/api/v1/medical/inventory") => ("medical", "manage"),
        ("PATCH", p) if p.starts_with("/api/v1/medical/inventory/") && p.ends_with("/stock") => ("medical", "manage"),
        ("GET", "/api/v1/medical/sick-leaves") => ("medical", "view"),
        ("POST", "/api/v1/medical/sick-leaves") => ("medical", "manage"),
        _ => ("", "")
    };

    if resource.is_empty() {
        return Ok(next.run(req).await);
    }

    let cache_key = format!("rbac:perm:{}:{}:{}", claims.role_id, resource, action);
    let mut redis_conn_opt = None;
    if let Ok(mut conn) = state.redis.get().await {
        let cached_val: Option<String> = redis::cmd("GET")
            .arg(&cache_key)
            .query_async(&mut conn)
            .await
            .ok();
        if let Some(val) = cached_val {
            if val == "1" {
                return Ok(next.run(req).await);
            } else {
                return Err(AppError::Forbidden);
            }
        }
        redis_conn_opt = Some(conn);
    }

    let has_permission: Option<bool> = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM role_permissions
            WHERE role_id = $1 AND resource = $2 AND action = $3
        )
        "#
    )
    .bind(claims.role_id)
    .bind(resource)
    .bind(action)
    .fetch_one(&state.db)
    .await
    .map_err(AppError::Database)?;

    let allowed = has_permission.unwrap_or(false);

    if let Some(mut conn) = redis_conn_opt {
        let val_str = if allowed { "1" } else { "0" };
        let _: Result<(), _> = redis::cmd("SETEX")
            .arg(&cache_key)
            .arg(60)
            .arg(val_str)
            .query_async(&mut conn)
            .await;
    }

    if allowed {
        Ok(next.run(req).await)
    } else {
        Err(AppError::Forbidden)
    }
}

/// Seed default role permissions for a new institution.
pub async fn seed_default_permissions(
    db: &sqlx::PgPool,
    institution_id: uuid::Uuid,
) -> anyhow::Result<()> {
    // Roles permissions mapping
    let role_permissions = vec![
        ("Principal", vec![
            ("students", "read"), ("students", "create"), ("students", "update"), ("students", "delete"),
            ("courses", "read"), ("courses", "create"), ("courses", "update"), ("courses", "delete"),
            ("marks", "read"), ("marks", "create"), ("marks", "update"), ("marks", "delete"), ("marks", "approve"),
            ("exams", "read"), ("exams", "create"), ("exams", "update"), ("exams", "delete"), ("exams", "approve"),
            ("fees", "read"), ("fees", "create"), ("fees", "update"), ("fees", "delete"), ("fees", "approve"),
            ("accounts", "read"), ("accounts", "create"), ("accounts", "update"), ("accounts", "delete"), ("accounts", "approve"),
            ("reports", "read"), ("reports", "create"), ("reports", "update"), ("reports", "delete"),
            ("attendance", "read"), ("attendance", "create"), ("attendance", "update"), ("attendance", "delete"), ("attendance", "approve"),
            ("library", "manage"), ("library", "view"),
            ("hostel", "manage"), ("hostel", "view"),
            ("transport", "manage"), ("transport", "view"),
            ("placement", "manage"), ("placement", "view"), ("placement", "apply"),
            ("medical", "manage"), ("medical", "view"),
        ]),
        ("Registrar", vec![
            ("students", "read"), ("students", "create"), ("students", "update"), ("students", "delete"),
            ("courses", "read"), ("courses", "create"), ("courses", "update"), ("courses", "delete"),
            ("marks", "read"), ("marks", "approve"),
            ("exams", "read"), ("exams", "create"), ("exams", "update"), ("exams", "delete"),
            ("fees", "read"),
            ("accounts", "read"),
            ("reports", "read"),
            ("attendance", "read"), ("attendance", "approve"),
            ("library", "manage"), ("library", "view"),
            ("hostel", "view"),
            ("transport", "view"),
            ("placement", "view"),
            ("medical", "view"),
        ]),
        ("FeeManager", vec![
            ("students", "read"),
            ("fees", "read"), ("fees", "create"), ("fees", "update"), ("fees", "approve"),
            ("accounts", "read"), ("accounts", "create"), ("accounts", "update"), ("accounts", "approve"),
            ("reports", "read"), ("reports", "create"),
        ]),
        ("Faculty", vec![
            ("students", "read"),
            ("courses", "read"),
            ("attendance", "read"), ("attendance", "create"), ("attendance", "approve"),
            ("marks", "read"), ("marks", "create"),
            // Faculty does NOT get: exams, library, medical, finance, hostel, transport
        ]),
        ("Student", vec![
            ("students", "read"),
            ("courses", "read"),
            ("attendance", "read"),
            ("exams", "read"),
            ("marks", "read"),
            ("fees", "read"), ("fees", "create"), // Student can pay their own fees
            ("library", "view"),
            ("hostel", "view"),   // All students see Hostel page (content gated by active booking)
            ("transport", "view"), // All students see Transport page (content gated by active booking)
            ("placement", "view"), ("placement", "apply"),
            ("medical", "view"),   // Student sees only own visits (filtered in frontend)
        ]),
    ];

    for (role_name, perms) in role_permissions {
        let role_id_opt: Option<uuid::Uuid> = sqlx::query_scalar(
            "SELECT role_id FROM roles WHERE institution_id = $1 AND role_name = $2"
        )
        .bind(institution_id)
        .bind(role_name)
        .fetch_optional(db)
        .await?;

        if let Some(role_id) = role_id_opt {
            for (resource, action) in perms {
                sqlx::query(
                    "INSERT INTO role_permissions (role_id, resource, action)
                     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING"
                )
                .bind(role_id).bind(resource).bind(action)
                .execute(db).await?;
            }
        }
    }

    Ok(())
}

