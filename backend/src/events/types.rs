use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Every domain event is a variant of this enum.
/// Events are immutable facts — something happened.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event_type", content = "payload")]
pub enum DomainEvent {
    // ── Student Domain ────────────────────────────────────────────────────────
    StudentCreated(StudentCreatedPayload),
    StudentEnrolled(StudentEnrolledPayload),
    StudentDetained(StudentDetainedPayload),
    StudentAlumni(StudentAlumniPayload),
    StudentDropout(StudentDropoutPayload),
    StudentProfileUpdated(StudentProfileUpdatedPayload),
    DocumentUploaded(DocumentUploadedPayload),

    // ── Academics Domain ──────────────────────────────────────────────────────
    CourseCreated(CourseCreatedPayload),
    AttendanceMarked(AttendanceMarkedPayload),
    FacultyAssigned(FacultyAssignedPayload),
    TimetableGenerated(TimetableGeneratedPayload),

    // ── Examination Domain ────────────────────────────────────────────────────
    ExamCreated(ExamCreatedPayload),
    HallTicketsGenerated(HallTicketsGeneratedPayload),
    MarksEntered(MarksEnteredPayload),
    ResultProcessed(ResultProcessedPayload),
    ResultPublished(ResultPublishedPayload),
    TranscriptGenerated(TranscriptGeneratedPayload),
    RevaluationRequested(RevaluationRequestedPayload),

    // ── Finance Domain ────────────────────────────────────────────────────────
    FeeStructureCreated(FeeStructureCreatedPayload),
    FeeAllocated(FeeAllocatedPayload),
    PaymentInitiated(PaymentInitiatedPayload),
    PaymentSucceeded(PaymentSucceededPayload),
    PaymentFailed(PaymentFailedPayload),
    ScholarshipAllocated(ScholarshipAllocatedPayload),
    ScholarshipDisbursed(ScholarshipDisbursedPayload),
    JournalEntryPosted(JournalEntryPostedPayload),

    // ── Library Domain ────────────────────────────────────────────────────────
    LibraryFineGenerated(LibraryFineGeneratedPayload),

    // ── Hostel Domain ─────────────────────────────────────────────────────────
    HostelChargeGenerated(HostelChargeGeneratedPayload),

    // ── Transport Domain ──────────────────────────────────────────────────────
    TransportChargeGenerated(TransportChargeGeneratedPayload),
}

#[allow(dead_code)]
impl DomainEvent {
    pub fn event_type(&self) -> &'static str {
        match self {
            DomainEvent::StudentCreated(_) => "StudentCreated",
            DomainEvent::StudentEnrolled(_) => "StudentEnrolled",
            DomainEvent::StudentDetained(_) => "StudentDetained",
            DomainEvent::StudentAlumni(_) => "StudentAlumni",
            DomainEvent::StudentDropout(_) => "StudentDropout",
            DomainEvent::StudentProfileUpdated(_) => "StudentProfileUpdated",
            DomainEvent::DocumentUploaded(_) => "DocumentUploaded",
            DomainEvent::CourseCreated(_) => "CourseCreated",
            DomainEvent::AttendanceMarked(_) => "AttendanceMarked",
            DomainEvent::FacultyAssigned(_) => "FacultyAssigned",
            DomainEvent::TimetableGenerated(_) => "TimetableGenerated",
            DomainEvent::ExamCreated(_) => "ExamCreated",
            DomainEvent::HallTicketsGenerated(_) => "HallTicketsGenerated",
            DomainEvent::MarksEntered(_) => "MarksEntered",
            DomainEvent::ResultProcessed(_) => "ResultProcessed",
            DomainEvent::ResultPublished(_) => "ResultPublished",
            DomainEvent::TranscriptGenerated(_) => "TranscriptGenerated",
            DomainEvent::RevaluationRequested(_) => "RevaluationRequested",
            DomainEvent::FeeStructureCreated(_) => "FeeStructureCreated",
            DomainEvent::FeeAllocated(_) => "FeeAllocated",
            DomainEvent::PaymentInitiated(_) => "PaymentInitiated",
            DomainEvent::PaymentSucceeded(_) => "PaymentSucceeded",
            DomainEvent::PaymentFailed(_) => "PaymentFailed",
            DomainEvent::ScholarshipAllocated(_) => "ScholarshipAllocated",
            DomainEvent::ScholarshipDisbursed(_) => "ScholarshipDisbursed",
            DomainEvent::JournalEntryPosted(_) => "JournalEntryPosted",
            DomainEvent::LibraryFineGenerated(_) => "LibraryFineGenerated",
            DomainEvent::HostelChargeGenerated(_) => "HostelChargeGenerated",
            DomainEvent::TransportChargeGenerated(_) => "TransportChargeGenerated",
        }
    }

    pub fn aggregate_id(&self) -> Uuid {
        match self {
            DomainEvent::StudentCreated(p) => p.student_id,
            DomainEvent::StudentEnrolled(p) => p.student_id,
            DomainEvent::StudentDetained(p) => p.student_id,
            DomainEvent::StudentAlumni(p) => p.student_id,
            DomainEvent::StudentDropout(p) => p.student_id,
            DomainEvent::StudentProfileUpdated(p) => p.student_id,
            DomainEvent::DocumentUploaded(p) => p.student_id,
            DomainEvent::CourseCreated(p) => p.course_id,
            DomainEvent::AttendanceMarked(p) => p.attendance_id,
            DomainEvent::FacultyAssigned(p) => p.faculty_id,
            DomainEvent::TimetableGenerated(p) => p.class_id,
            DomainEvent::ExamCreated(p) => p.exam_id,
            DomainEvent::HallTicketsGenerated(p) => p.exam_id,
            DomainEvent::MarksEntered(p) => p.marks_id,
            DomainEvent::ResultProcessed(p) => p.result_id,
            DomainEvent::ResultPublished(p) => p.result_id,
            DomainEvent::TranscriptGenerated(p) => p.transcript_id,
            DomainEvent::RevaluationRequested(p) => p.revaluation_id,
            DomainEvent::FeeStructureCreated(p) => p.fee_structure_id,
            DomainEvent::FeeAllocated(p) => p.fee_allocation_id,
            DomainEvent::PaymentInitiated(p) => p.payment_id,
            DomainEvent::PaymentSucceeded(p) => p.payment_id,
            DomainEvent::PaymentFailed(p) => p.payment_id,
            DomainEvent::ScholarshipAllocated(p) => p.allotment_id,
            DomainEvent::ScholarshipDisbursed(p) => p.allotment_id,
            DomainEvent::JournalEntryPosted(p) => p.journal_id,
            DomainEvent::LibraryFineGenerated(p) => p.transaction_id,
            DomainEvent::HostelChargeGenerated(p) => p.allocation_id,
            DomainEvent::TransportChargeGenerated(p) => p.allocation_id,
        }
    }

    pub fn aggregate_type(&self) -> &'static str {
        match self {
            DomainEvent::StudentCreated(_)
            | DomainEvent::StudentEnrolled(_)
            | DomainEvent::StudentDetained(_)
            | DomainEvent::StudentAlumni(_)
            | DomainEvent::StudentDropout(_)
            | DomainEvent::StudentProfileUpdated(_)
            | DomainEvent::DocumentUploaded(_) => "Student",

            DomainEvent::CourseCreated(_)
            | DomainEvent::AttendanceMarked(_)
            | DomainEvent::FacultyAssigned(_)
            | DomainEvent::TimetableGenerated(_) => "Academics",

            DomainEvent::ExamCreated(_)
            | DomainEvent::HallTicketsGenerated(_)
            | DomainEvent::MarksEntered(_)
            | DomainEvent::ResultProcessed(_)
            | DomainEvent::ResultPublished(_)
            | DomainEvent::TranscriptGenerated(_)
            | DomainEvent::RevaluationRequested(_) => "Examination",

            DomainEvent::FeeStructureCreated(_)
            | DomainEvent::FeeAllocated(_)
            | DomainEvent::PaymentInitiated(_)
            | DomainEvent::PaymentSucceeded(_)
            | DomainEvent::PaymentFailed(_)
            | DomainEvent::ScholarshipAllocated(_)
            | DomainEvent::ScholarshipDisbursed(_)
            | DomainEvent::JournalEntryPosted(_) => "Finance",

            DomainEvent::LibraryFineGenerated(_) => "Library",

            DomainEvent::HostelChargeGenerated(_) => "Hostel",

            DomainEvent::TransportChargeGenerated(_) => "Transport",
        }
    }
}

// ── Payload structs ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudentCreatedPayload {
    pub student_id:     Uuid,
    pub institution_id: Uuid,
    pub person_id:      Uuid,
    pub enrollment_status: String,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudentEnrolledPayload {
    pub student_id:     Uuid,
    pub institution_id: Uuid,
    pub class_id:       Uuid,
    pub semester:       i32,
    pub academic_year:  i32,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudentDetainedPayload {
    pub student_id:     Uuid,
    pub institution_id: Uuid,
    pub reason:         String,
    pub semester:       i32,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudentAlumniPayload {
    pub student_id:      Uuid,
    pub institution_id:  Uuid,
    pub graduation_date: String,
    pub occurred_at:     DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudentDropoutPayload {
    pub student_id:     Uuid,
    pub institution_id: Uuid,
    pub reason:         String,
    pub dropout_date:   String,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudentProfileUpdatedPayload {
    pub student_id:     Uuid,
    pub institution_id: Uuid,
    pub changed_fields: serde_json::Value,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentUploadedPayload {
    pub student_id:     Uuid,
    pub institution_id: Uuid,
    pub document_id:    Uuid,
    pub document_type:  String,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CourseCreatedPayload {
    pub course_id:      Uuid,
    pub institution_id: Uuid,
    pub course_code:    String,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttendanceMarkedPayload {
    pub attendance_id:  Uuid,
    pub student_id:     Uuid,
    pub course_id:      Uuid,
    pub class_id:       Uuid,
    pub date:           String,
    pub status:         String,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FacultyAssignedPayload {
    pub faculty_id:     Uuid,
    pub course_id:      Uuid,
    pub class_id:       Uuid,
    pub institution_id: Uuid,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimetableGeneratedPayload {
    pub class_id:       Uuid,
    pub institution_id: Uuid,
    pub academic_year:  i32,
    pub semester:       i32,
    pub slot_count:     i32,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExamCreatedPayload {
    pub exam_id:        Uuid,
    pub course_id:      Uuid,
    pub class_id:       Uuid,
    pub institution_id: Uuid,
    pub exam_type:      String,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HallTicketsGeneratedPayload {
    pub exam_id:        Uuid,
    pub institution_id: Uuid,
    pub count:          i32,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarksEnteredPayload {
    pub marks_id:       Uuid,
    pub exam_id:        Uuid,
    pub student_id:     Uuid,
    pub course_id:      Uuid,
    pub obtained_marks: f64,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResultProcessedPayload {
    pub result_id:      Uuid,
    pub student_id:     Uuid,
    pub institution_id: Uuid,
    pub semester:       i32,
    pub academic_year:  i32,
    pub sgpa:           f64,
    pub cgpa:           f64,
    pub status:         String,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResultPublishedPayload {
    pub result_id:      Uuid,
    pub institution_id: Uuid,
    pub publish_date:   String,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptGeneratedPayload {
    pub transcript_id:  Uuid,
    pub student_id:     Uuid,
    pub institution_id: Uuid,
    pub transcript_type: String,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevaluationRequestedPayload {
    pub revaluation_id: Uuid,
    pub student_id:     Uuid,
    pub marks_id:       Uuid,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeeStructureCreatedPayload {
    pub fee_structure_id: Uuid,
    pub institution_id:   Uuid,
    pub academic_year:    i32,
    pub occurred_at:      DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeeAllocatedPayload {
    pub fee_allocation_id: Uuid,
    pub student_id:        Uuid,
    pub institution_id:    Uuid,
    pub total_amount:      f64,
    pub occurred_at:       DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentInitiatedPayload {
    pub payment_id:        Uuid,
    pub fee_allocation_id: Uuid,
    pub student_id:        Uuid,
    pub amount:            f64,
    pub occurred_at:       DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentSucceededPayload {
    pub payment_id:     Uuid,
    pub student_id:     Uuid,
    pub institution_id: Uuid,
    pub amount:         f64,
    pub transaction_id: String,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentFailedPayload {
    pub payment_id:  Uuid,
    pub student_id:  Uuid,
    pub reason:      String,
    pub retry_count: i32,
    pub occurred_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScholarshipAllocatedPayload {
    pub allotment_id:   Uuid,
    pub student_id:     Uuid,
    pub scholarship_id: Uuid,
    pub amount:         f64,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScholarshipDisbursedPayload {
    pub allotment_id:   Uuid,
    pub student_id:     Uuid,
    pub amount:         f64,
    pub bank_reference: String,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalEntryPostedPayload {
    pub journal_id:     Uuid,
    pub institution_id: Uuid,
    pub reference:      String,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryFineGeneratedPayload {
    pub transaction_id: Uuid,
    pub student_id:     Uuid,
    pub institution_id: Uuid,
    pub amount:         f64,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostelChargeGeneratedPayload {
    pub allocation_id:  Uuid,
    pub student_id:     Uuid,
    pub institution_id: Uuid,
    pub amount:         f64,
    pub occurred_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransportChargeGeneratedPayload {
    pub allocation_id:  Uuid,
    pub student_id:     Uuid,
    pub institution_id: Uuid,
    pub amount:         f64,
    pub occurred_at:    DateTime<Utc>,
}

