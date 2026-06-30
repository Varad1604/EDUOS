use sqlx::PgPool;
use uuid::Uuid;
use crate::error::AppError;

/// Log an immutable domain event to the `event_log` table.
/// Called by all service modules to maintain the audit trail.
pub async fn log_event(
    db:             &PgPool,
    institution_id: Uuid,
    user_id:        Uuid,
    event_type:     &str,
    aggregate_id:   Uuid,
    aggregate_type: &str,
    payload:        serde_json::Value,
) -> Result<(), AppError> {
    sqlx::query(
        r#"
        INSERT INTO event_log
            (event_id, institution_id, event_type, aggregate_id, aggregate_type, user_id, event_payload, event_version)
        VALUES
            (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 1)
        "#,
    )
    .bind(institution_id)
    .bind(event_type)
    .bind(aggregate_id)
    .bind(aggregate_type)
    .bind(user_id)
    .bind(payload)
    .execute(db)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}
