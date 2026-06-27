use sqlx::{postgres::PgPoolOptions, PgPool};
use anyhow::{Context, Result};
use crate::config::DatabaseConfig;

pub async fn create_pool(cfg: &DatabaseConfig) -> Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(cfg.max_connections)
        .min_connections(cfg.min_connections)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .connect(&cfg.url)
        .await
        .context("Failed to connect to PostgreSQL")?;

    tracing::info!("PostgreSQL connection pool established");
    Ok(pool)
}

pub async fn run_migrations(pool: &PgPool) -> Result<()> {
    sqlx::migrate!("../migrations")
        .run(pool)
        .await
        .context("Failed to run database migrations")?;
    tracing::info!("Database migrations applied successfully");

    seed_database(pool).await.context("Failed to seed database")?;

    Ok(())
}

async fn seed_database(pool: &PgPool) -> Result<()> {
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM institutions)")
        .fetch_one(pool)
        .await?;

    if exists {
        tracing::info!("Database already seeded. Skipping seed.");
        return Ok(());
    }

    tracing::info!("Seeding default database records...");

    // 1. Create default institution
    let inst_id = uuid::Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
    sqlx::query(
        "INSERT INTO institutions (institution_id, name, type) VALUES ($1, 'EduOS Engineering College', 'EngineeringCollege')"
    )
    .bind(inst_id)
    .execute(pool)
    .await?;

    // 2. Create roles and keep track of their IDs
    let roles = vec!["Principal", "Registrar", "FeeManager", "Faculty", "Student"];
    let principal_role_id = uuid::Uuid::new_v4();
    let registrar_role_id = uuid::Uuid::new_v4();
    let feemanager_role_id = uuid::Uuid::new_v4();
    let faculty_role_id = uuid::Uuid::new_v4();
    let student_role_id = uuid::Uuid::new_v4();

    for role_name in &roles {
        let role_id = match *role_name {
            "Principal" => principal_role_id,
            "Registrar" => registrar_role_id,
            "FeeManager" => feemanager_role_id,
            "Faculty" => faculty_role_id,
            "Student" => student_role_id,
            _ => uuid::Uuid::new_v4(),
        };

        sqlx::query(
            "INSERT INTO roles (role_id, institution_id, role_name, description) VALUES ($1, $2, $3, $4)"
        )
        .bind(role_id)
        .bind(inst_id)
        .bind(*role_name)
        .bind(format!("Default {} role", role_name))
        .execute(pool)
        .await?;
    }

    // 3. Seed default permissions for all roles
    crate::middleware::rbac::seed_default_permissions(pool, inst_id)
        .await
        .context("Failed to seed role permissions")?;

    // 4. Create demo persons and users for all roles
    // 4a. Principal user
    let p_admin_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO persons (person_id, institution_id, first_name, last_name, phone, email)
         VALUES ($1, $2, 'System', 'Administrator', '9999999999', 'admin@eduos.org')"
    )
    .bind(p_admin_id)
    .bind(inst_id)
    .execute(pool)
    .await?;

    let admin_pass = crate::modules::auth::service::hash_password("password123").await?;
    let admin_user_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO users (user_id, person_id, institution_id, username, password_hash, role_id)
         VALUES ($1, $2, $3, 'admin', $4, $5)"
    )
    .bind(admin_user_id)
    .bind(p_admin_id)
    .bind(inst_id)
    .bind(admin_pass)
    .bind(principal_role_id)
    .execute(pool)
    .await?;

    // 4b. Registrar user
    let p_registrar_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO persons (person_id, institution_id, first_name, last_name, phone, email)
         VALUES ($1, $2, 'Rajesh', 'Kumar', '9898989898', 'registrar@eduos.org')"
    )
    .bind(p_registrar_id)
    .bind(inst_id)
    .execute(pool)
    .await?;

    let registrar_pass = crate::modules::auth::service::hash_password("password123").await?;
    sqlx::query(
        "INSERT INTO users (user_id, person_id, institution_id, username, password_hash, role_id)
         VALUES ($1, $2, $3, 'registrar', $4, $5)"
    )
    .bind(uuid::Uuid::new_v4())
    .bind(p_registrar_id)
    .bind(inst_id)
    .bind(registrar_pass)
    .bind(registrar_role_id)
    .execute(pool)
    .await?;

    // 4c. Fee Manager user
    let p_feemanager_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO persons (person_id, institution_id, first_name, last_name, phone, email)
         VALUES ($1, $2, 'Amit', 'Sharma', '9797979797', 'feemanager@eduos.org')"
    )
    .bind(p_feemanager_id)
    .bind(inst_id)
    .execute(pool)
    .await?;

    let feemanager_pass = crate::modules::auth::service::hash_password("password123").await?;
    sqlx::query(
        "INSERT INTO users (user_id, person_id, institution_id, username, password_hash, role_id)
         VALUES ($1, $2, $3, 'feemanager', $4, $5)"
    )
    .bind(uuid::Uuid::new_v4())
    .bind(p_feemanager_id)
    .bind(inst_id)
    .bind(feemanager_pass)
    .bind(feemanager_role_id)
    .execute(pool)
    .await?;

    // 4d. Faculty user
    let p_faculty_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO persons (person_id, institution_id, first_name, last_name, phone, email)
         VALUES ($1, $2, 'Aarav', 'Sharma', '9696969696', 'faculty@eduos.org')"
    )
    .bind(p_faculty_id)
    .bind(inst_id)
    .execute(pool)
    .await?;

    let faculty_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO faculty (faculty_id, person_id, institution_id, employee_code, designation)
         VALUES ($1, $2, $3, 'FAC001', 'Assistant Professor')"
    )
    .bind(faculty_id)
    .bind(p_faculty_id)
    .bind(inst_id)
    .execute(pool)
    .await?;

    let faculty_pass = crate::modules::auth::service::hash_password("password123").await?;
    sqlx::query(
        "INSERT INTO users (user_id, person_id, institution_id, username, password_hash, role_id)
         VALUES ($1, $2, $3, 'faculty', $4, $5)"
    )
    .bind(uuid::Uuid::new_v4())
    .bind(p_faculty_id)
    .bind(inst_id)
    .bind(faculty_pass)
    .bind(faculty_role_id)
    .execute(pool)
    .await?;

    // 4e. Student user
    let p_student_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO persons (person_id, institution_id, first_name, last_name, phone, email)
         VALUES ($1, $2, 'Ishaan', 'Verma', '9595959595', 'student@eduos.org')"
    )
    .bind(p_student_id)
    .bind(inst_id)
    .execute(pool)
    .await?;

    // 5. Seed academic structure (CSE department & branch)
    let dept_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO departments (department_id, institution_id, department_name)
         VALUES ($1, $2, 'Computer Science and Engineering')"
    )
    .bind(dept_id)
    .bind(inst_id)
    .execute(pool)
    .await?;

    let branch_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO branches (branch_id, institution_id, department_id, branch_name, branch_code)
         VALUES ($1, $2, $3, 'Computer Science', 'CSE')"
    )
    .bind(branch_id)
    .bind(inst_id)
    .bind(dept_id)
    .execute(pool)
    .await?;

    let student_id = uuid::Uuid::new_v4();
    let mut seeded_student_ids = Vec::new();
    seeded_student_ids.push(student_id);

    sqlx::query(
        "INSERT INTO student_profiles (student_id, person_id, institution_id, enrollment_number, enrollment_status, branch_id, current_semester, current_academic_year, category, quota, cgpa)
         VALUES ($1, $2, $3, 'CS2026001', 'Active', $4, 1, 2026, 'General', 'Merit', 8.5)"
    )
    .bind(student_id)
    .bind(p_student_id)
    .bind(inst_id)
    .bind(branch_id)
    .execute(pool)
    .await?;

    let student_pass = crate::modules::auth::service::hash_password("password123").await?;
    sqlx::query(
        "INSERT INTO users (user_id, person_id, institution_id, username, password_hash, role_id)
         VALUES ($1, $2, $3, 'student', $4, $5)"
    )
    .bind(uuid::Uuid::new_v4())
    .bind(p_student_id)
    .bind(inst_id)
    .bind(student_pass.clone())
    .bind(student_role_id)
    .execute(pool)
    .await?;

    // 6. Seed curriculum, courses, classes & enrollments
    let curriculum_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO curriculum_versions (curriculum_id, institution_id, year, pattern, effective_from)
         VALUES ($1, $2, 2026, 'CBCS', '2026-06-01')"
    )
    .bind(curriculum_id)
    .bind(inst_id)
    .execute(pool)
    .await?;

    let course1_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO courses (course_id, institution_id, curriculum_id, course_code, course_name, credits, course_type, semester, min_marks, max_marks)
         VALUES ($1, $2, $3, 'CS101', 'Computer Programming', 4.0, 'Theory', 1, 35, 100)"
    )
    .bind(course1_id)
    .bind(inst_id)
    .bind(curriculum_id)
    .execute(pool)
    .await?;

    let course2_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO courses (course_id, institution_id, curriculum_id, course_code, course_name, credits, course_type, semester, min_marks, max_marks)
         VALUES ($1, $2, $3, 'CS102', 'Data Structures', 4.0, 'Theory', 1, 35, 100)"
    )
    .bind(course2_id)
    .bind(inst_id)
    .bind(curriculum_id)
    .execute(pool)
    .await?;

    let class_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO classes (class_id, institution_id, branch_id, semester, section, academic_year)
         VALUES ($1, $2, $3, 1, 'A', 2026)"
    )
    .bind(class_id)
    .bind(inst_id)
    .bind(branch_id)
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO class_enrollments (enrollment_id, institution_id, class_id, student_id, academic_year, semester)
         VALUES ($1, $2, $3, $4, 2026, 1)"
    )
    .bind(uuid::Uuid::new_v4())
    .bind(inst_id)
    .bind(class_id)
    .bind(student_id)
    .execute(pool)
    .await?;

    // Allocate faculty
    let allocation_id1 = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO course_allocations (allocation_id, institution_id, course_id, faculty_id, class_id, academic_year, semester, weekly_hours)
         VALUES ($1, $2, $3, $4, $5, 2026, 1, 4)"
    )
    .bind(allocation_id1)
    .bind(inst_id)
    .bind(course1_id)
    .bind(faculty_id)
    .bind(class_id)
    .execute(pool)
    .await?;

    let allocation_id2 = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO course_allocations (allocation_id, institution_id, course_id, faculty_id, class_id, academic_year, semester, weekly_hours)
         VALUES ($1, $2, $3, $4, $5, 2026, 1, 4)"
    )
    .bind(allocation_id2)
    .bind(inst_id)
    .bind(course2_id)
    .bind(faculty_id)
    .bind(class_id)
    .execute(pool)
    .await?;

    // Timetable slot
    sqlx::query(
        "INSERT INTO timetable_slots (slot_id, institution_id, class_id, course_allocation_id, day_of_week, start_time, end_time, room, building)
         VALUES ($1, $2, $3, $4, 1, '09:00:00', '10:00:00', 'Room 101', 'Main Block')"
    )
    .bind(uuid::Uuid::new_v4())
    .bind(inst_id)
    .bind(class_id)
    .bind(allocation_id1)
    .execute(pool)
    .await?;

    // 7. Seed Chart of Accounts
    let accounts = vec![
        ("1001", "Cash & Bank Account", "Asset", 500000.0, 754000.0),
        ("1201", "Accounts Receivable (Fees)", "Asset", 0.0, 10000.0),
        ("1301", "Prepaid Expense (Fuel)", "Asset", 0.0, 5000.0),
        ("2001", "Accounts Payable (Vendors)", "Liability", 0.0, 12000.0),
        ("2101", "Outstanding Salaries", "Liability", 0.0, 15000.0),
        ("3001", "Capital Reserves", "Equity", 500000.0, 500000.0),
        ("4001", "Tuition Fee Revenue", "Income", 0.0, 300000.0),
        ("4101", "Hostel Rent Revenue", "Income", 0.0, 80000.0),
        ("4201", "Transport Fee Revenue", "Income", 0.0, 40000.0),
        ("4301", "Library Fine Revenue", "Income", 0.0, 2000.0),
        ("5001", "Faculty Salary Expense", "Expense", 0.0, 120000.0),
        ("5101", "Campus Utility Expense", "Expense", 0.0, 30000.0),
        ("5201", "Transport Operating Expense (Fuel)", "Expense", 0.0, 15000.0),
        ("5301", "Medical Supplies Expense", "Expense", 0.0, 10000.0),
        ("5401", "Library Books Expense", "Expense", 0.0, 5000.0),
    ];

    let mut coa_map = std::collections::HashMap::new();
    for (code, name, acc_type, open_bal, curr_bal) in accounts {
        let account_id = uuid::Uuid::new_v4();
        sqlx::query(
            "INSERT INTO chart_of_accounts (account_id, institution_id, account_code, account_name, account_type, opening_balance, current_balance, fiscal_year)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 2026)"
        )
        .bind(account_id)
        .bind(inst_id)
        .bind(code)
        .bind(name)
        .bind(acc_type)
        .bind(open_bal)
        .bind(curr_bal)
        .execute(pool)
        .await?;
        coa_map.insert(code.to_string(), account_id);
    }

    // 8. Seed Fee Structure
    let sem_fee = serde_json::json!([
        {"semester": 1, "amount": 60000.0},
        {"semester": 2, "amount": 60000.0}
    ]);
    let fee_struct_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO fee_structures (fee_structure_id, institution_id, academic_year, branch_id, category, quota, semesters, total_amount)
         VALUES ($1, $2, 2026, $3, 'General', 'Merit', $4, '120000.00')"
    )
    .bind(fee_struct_id)
    .bind(inst_id)
    .bind(branch_id)
    .bind(sem_fee)
    .execute(pool)
    .await?;

    // 9. Seed 11 extra student persons, users, and student_profiles
    let student_data = vec![
        ("Aarav", "Patel", "CS2026002", "Active", 3, 8.5, "aarav.patel@eduos.org"),
        ("Diya", "Sen", "CS2026003", "Active", 5, 9.2, "diya.sen@eduos.org"),
        ("Kabir", "Singh", "CS2026004", "Detained", 3, 6.8, "kabir.singh@eduos.org"),
        ("Ananya", "Roy", "CS2026005", "Alumni", 8, 9.8, "ananya.roy@eduos.org"),
        ("Rohan", "Gupta", "CS2026006", "Dropout", 2, 7.1, "rohan.gupta@eduos.org"),
        ("Meera", "Nair", "CS2026007", "Active", 1, 7.9, "meera.nair@eduos.org"),
        ("Vivaan", "Joshi", "CS2026008", "Active", 7, 8.8, "vivaan.joshi@eduos.org"),
        ("Saisha", "Rao", "CS2026009", "Active", 5, 9.4, "saisha.rao@eduos.org"),
        ("Dev", "Sharma", "CS2026010", "Detained", 1, 6.5, "dev.sharma@eduos.org"),
        ("Riya", "Bose", "CS2026011", "Alumni", 8, 9.1, "riya.bose@eduos.org"),
        ("Aryan", "Kapoor", "CS2026012", "Active", 3, 8.2, "aryan.kapoor@eduos.org"),
    ];

    for (first_name, last_name, roll, status, semester, cgpa, email) in student_data {
        let person_id = uuid::Uuid::new_v4();
        sqlx::query(
            "INSERT INTO persons (person_id, institution_id, first_name, last_name, phone, email)
             VALUES ($1, $2, $3, $4, '9876543210', $5)"
        )
        .bind(person_id)
        .bind(inst_id)
        .bind(first_name)
        .bind(last_name)
        .bind(email)
        .execute(pool)
        .await?;

        let student_profile_id = uuid::Uuid::new_v4();
        sqlx::query(
            "INSERT INTO student_profiles (student_id, person_id, institution_id, enrollment_number, enrollment_status, branch_id, current_semester, current_academic_year, category, quota, cgpa)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 2026, 'General', 'Merit', $8)"
        )
        .bind(student_profile_id)
        .bind(person_id)
        .bind(inst_id)
        .bind(roll)
        .bind(status)
        .bind(branch_id)
        .bind(semester)
        .bind(cgpa)
        .execute(pool)
        .await?;

        let username = first_name.to_lowercase();
        sqlx::query(
            "INSERT INTO users (user_id, person_id, institution_id, username, password_hash, role_id)
             VALUES ($1, $2, $3, $4, $5, $6)"
        )
        .bind(uuid::Uuid::new_v4())
        .bind(person_id)
        .bind(inst_id)
        .bind(&username)
        .bind(&student_pass)
        .bind(student_role_id)
        .execute(pool)
        .await?;

        seeded_student_ids.push(student_profile_id);
    }

    // 10. Seed Library Books and Transactions
    let books = vec![
        ("978-0262033848", "Introduction to Algorithms", "Thomas H. Cormen", "MIT Press", "Computer Science", 5),
        ("978-0201633610", "Design Patterns", "Erich Gamma", "Addison-Wesley", "Software Engineering", 3),
        ("978-0132350884", "Clean Code", "Robert C. Martin", "Prentice Hall", "Software Engineering", 4),
        ("978-0073523323", "Database System Concepts", "Abraham Silberschatz", "McGraw-Hill", "Computer Science", 2),
        ("978-0136083207", "Artificial Intelligence: A Modern Approach", "Stuart Russell", "Prentice Hall", "Artificial Intelligence", 3),
    ];

    let mut seeded_book_ids = Vec::new();
    for (isbn, title, author, publisher, category, copies) in books {
        let book_id = uuid::Uuid::new_v4();
        sqlx::query(
            "INSERT INTO library_books (book_id, institution_id, isbn, title, author, publisher, category, total_copies, available_copies)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"
        )
        .bind(book_id)
        .bind(inst_id)
        .bind(isbn)
        .bind(title)
        .bind(author)
        .bind(publisher)
        .bind(category)
        .bind(copies)
        .bind(copies - 1)
        .execute(pool)
        .await?;
        seeded_book_ids.push(book_id);
    }

    // Transactions
    sqlx::query(
        "INSERT INTO library_transactions (transaction_id, institution_id, book_id, student_id, issue_date, due_date, status)
         VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_DATE - 5, CURRENT_DATE + 10, 'Issued')"
    )
    .bind(inst_id)
    .bind(seeded_book_ids[0])
    .bind(seeded_student_ids[0])
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO library_transactions (transaction_id, institution_id, book_id, student_id, issue_date, due_date, return_date, status, fine_amount)
         VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_DATE - 15, CURRENT_DATE - 5, CURRENT_DATE - 5, 'Returned', 0.00)"
    )
    .bind(inst_id)
    .bind(seeded_book_ids[1])
    .bind(seeded_student_ids[1])
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO library_transactions (transaction_id, institution_id, book_id, student_id, issue_date, due_date, status, fine_amount)
         VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_DATE - 20, CURRENT_DATE - 5, 'Overdue', 150.00)"
    )
    .bind(inst_id)
    .bind(seeded_book_ids[2])
    .bind(seeded_student_ids[2])
    .execute(pool)
    .await?;

    // 11. Seed Hostel Rooms & Bookings
    let rooms = vec![
        ("Mandakini Hostel", "101", "Single AC", 1, 0, 15000.00),
        ("Mandakini Hostel", "102", "Double AC", 2, 1, 10000.00),
        ("Kailash Hostel", "201", "Double Non-AC", 2, 1, 7500.00),
        ("Kailash Hostel", "202", "Triple Non-AC", 3, 2, 5000.00),
    ];

    let mut seeded_room_ids = Vec::new();
    for (hostel, room_no, rtype, cap, avail, rent) in rooms {
        let room_id = uuid::Uuid::new_v4();
        sqlx::query(
            "INSERT INTO hostel_rooms (room_id, institution_id, hostel_name, room_number, room_type, capacity, available_beds, rent_amount)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"
        )
        .bind(room_id)
        .bind(inst_id)
        .bind(hostel)
        .bind(room_no)
        .bind(rtype)
        .bind(cap)
        .bind(avail)
        .bind(rent)
        .execute(pool)
        .await?;
        seeded_room_ids.push(room_id);
    }

    sqlx::query(
        "INSERT INTO hostel_allocations (allocation_id, institution_id, room_id, student_id, start_date, mess_plan, status)
         VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_DATE - 30, 'Veg', 'Active')"
    )
    .bind(inst_id)
    .bind(seeded_room_ids[0])
    .bind(seeded_student_ids[0])
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO hostel_allocations (allocation_id, institution_id, room_id, student_id, start_date, mess_plan, status)
         VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_DATE - 30, 'Non-Veg', 'Active')"
    )
    .bind(inst_id)
    .bind(seeded_room_ids[1])
    .bind(seeded_student_ids[1])
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO hostel_allocations (allocation_id, institution_id, room_id, student_id, start_date, mess_plan, status)
         VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_DATE - 30, 'None', 'Active')"
    )
    .bind(inst_id)
    .bind(seeded_room_ids[2])
    .bind(seeded_student_ids[2])
    .execute(pool)
    .await?;

    // 12. Seed Transport Routes, Vehicles & Allocations
    let route1_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO transport_routes (route_id, institution_id, route_code, route_name, start_location, end_location)
         VALUES ($1, $2, 'RT01', 'North City Line', 'North Terminal', 'Campus Gate 1')"
    )
    .bind(route1_id)
    .bind(inst_id)
    .execute(pool)
    .await?;

    let route2_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO transport_routes (route_id, institution_id, route_code, route_name, start_location, end_location)
         VALUES ($1, $2, 'RT02', 'South Hub Express', 'South Metro Station', 'Campus Gate 2')"
    )
    .bind(route2_id)
    .bind(inst_id)
    .execute(pool)
    .await?;

    let stop1_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO transport_stops (stop_id, route_id, stop_name, pickup_time, fare_amount)
         VALUES ($1, $2, 'Sector 15', '07:30:00', 1500.00)"
    )
    .bind(stop1_id)
    .bind(route1_id)
    .execute(pool)
    .await?;

    let stop2_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO transport_stops (stop_id, route_id, stop_name, pickup_time, fare_amount)
         VALUES ($1, $2, 'Tech Park', '07:45:00', 1800.00)"
    )
    .bind(stop2_id)
    .bind(route2_id)
    .execute(pool)
    .await?;

    let vehicle1_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO transport_vehicles (vehicle_id, institution_id, vehicle_number, capacity, available_seats, driver_name, driver_phone, status)
         VALUES ($1, $2, 'KA-01-F-1234', 40, 39, 'Ramesh Singh', '9876543210', 'Active')"
    )
    .bind(vehicle1_id)
    .bind(inst_id)
    .execute(pool)
    .await?;

    let vehicle2_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO transport_vehicles (vehicle_id, institution_id, vehicle_number, capacity, available_seats, driver_name, driver_phone, status)
         VALUES ($1, $2, 'KA-01-F-5678', 30, 29, 'Suresh Kumar', '9876543211', 'Active')"
    )
    .bind(vehicle2_id)
    .bind(inst_id)
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO transport_allocations (allocation_id, institution_id, student_id, route_id, stop_id, vehicle_id, start_date, status)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, CURRENT_DATE - 30, 'Active')"
    )
    .bind(inst_id)
    .bind(seeded_student_ids[3])
    .bind(route1_id)
    .bind(stop1_id)
    .bind(vehicle1_id)
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO transport_allocations (allocation_id, institution_id, student_id, route_id, stop_id, vehicle_id, start_date, status)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, CURRENT_DATE - 30, 'Active')"
    )
    .bind(inst_id)
    .bind(seeded_student_ids[4])
    .bind(route2_id)
    .bind(stop2_id)
    .bind(vehicle2_id)
    .execute(pool)
    .await?;

    // 13. Seed Placement Recruiter details
    let google_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO placement_companies (company_id, institution_id, company_name, industry, website, contact_person, contact_email, status)
         VALUES ($1, $2, 'Google', 'IT/Software', 'google.com', 'Sundar Pichai', 'recruit@google.com', 'Active')"
    )
    .bind(google_id)
    .bind(inst_id)
    .execute(pool)
    .await?;

    let microsoft_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO placement_companies (company_id, institution_id, company_name, industry, website, contact_person, contact_email, status)
         VALUES ($1, $2, 'Microsoft', 'IT/Software', 'microsoft.com', 'Satya Nadella', 'recruit@microsoft.com', 'Active')"
    )
    .bind(microsoft_id)
    .bind(inst_id)
    .execute(pool)
    .await?;

    let gs_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO placement_companies (company_id, institution_id, company_name, industry, website, contact_person, contact_email, status)
         VALUES ($1, $2, 'Goldman Sachs', 'Finance', 'goldmansachs.com', 'David Solomon', 'recruit@gs.com', 'Active')"
    )
    .bind(gs_id)
    .bind(inst_id)
    .execute(pool)
    .await?;

    let drive1_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO placement_drives (drive_id, institution_id, company_id, drive_title, job_role, job_type, job_location, package_lpa, min_cgpa, eligible_branches, drive_date, application_deadline, status)
         VALUES ($1, $2, $3, 'Google SWE Intern 2026', 'Software Engineer Intern', 'Internship', 'Bangalore', 15.00, 8.5, ARRAY['CSE'], CURRENT_DATE + 30, CURRENT_DATE + 15, 'Open')"
    )
    .bind(drive1_id)
    .bind(inst_id)
    .bind(google_id)
    .execute(pool)
    .await?;

    let drive2_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO placement_drives (drive_id, institution_id, company_id, drive_title, job_role, job_type, job_location, package_lpa, min_cgpa, eligible_branches, drive_date, application_deadline, status)
         VALUES ($1, $2, $3, 'Microsoft FTE 2026', 'Software Engineer', 'Full-Time', 'Hyderabad', 24.00, 8.0, ARRAY['CSE'], CURRENT_DATE + 40, CURRENT_DATE + 20, 'Open')"
    )
    .bind(drive2_id)
    .bind(inst_id)
    .bind(microsoft_id)
    .execute(pool)
    .await?;

    let app1_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO placement_applications (application_id, drive_id, student_id, institution_id, status)
         VALUES ($1, $2, $3, $4, 'Shortlisted')"
    )
    .bind(app1_id)
    .bind(drive1_id)
    .bind(seeded_student_ids[1])
    .bind(inst_id)
    .execute(pool)
    .await?;

    let app2_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO placement_applications (application_id, drive_id, student_id, institution_id, status)
         VALUES ($1, $2, $3, $4, 'Offered')"
    )
    .bind(app2_id)
    .bind(drive1_id)
    .bind(seeded_student_ids[4])
    .bind(inst_id)
    .execute(pool)
    .await?;

    let app3_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO placement_applications (application_id, drive_id, student_id, institution_id, status)
         VALUES ($1, $2, $3, $4, 'Rejected')"
    )
    .bind(app3_id)
    .bind(drive1_id)
    .bind(seeded_student_ids[3])
    .bind(inst_id)
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO placement_offers (offer_id, application_id, student_id, drive_id, institution_id, package_lpa, status)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 15.00, 'Accepted')"
    )
    .bind(app2_id)
    .bind(seeded_student_ids[4])
    .bind(drive1_id)
    .bind(inst_id)
    .execute(pool)
    .await?;

    // 14. Seed Medical Center visits & pharmacy stock
    sqlx::query(
        "INSERT INTO medical_inventory (item_id, institution_id, item_name, item_category, unit, quantity_in_stock, reorder_level)
         VALUES (gen_random_uuid(), $1, 'Paracetamol 500mg', 'Medicine', 'Tab', 500, 50)"
    )
    .bind(inst_id)
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO medical_inventory (item_id, institution_id, item_name, item_category, unit, quantity_in_stock, reorder_level)
         VALUES (gen_random_uuid(), $1, 'Ibuprofen 400mg', 'Medicine', 'Tab', 300, 30)"
    )
    .bind(inst_id)
    .execute(pool)
    .await?;

    let visit_id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO medical_visits (visit_id, institution_id, student_id, chief_complaint, doctor_name, diagnosis, notes, status)
         VALUES ($1, $2, $3, 'Seasonal Fever', 'Dr. Sunita Rao', 'Viral Fever', 'Rest prescribed for 3 days', 'Closed')"
    )
    .bind(visit_id)
    .bind(inst_id)
    .bind(seeded_student_ids[5])
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO medical_vitals (vital_id, visit_id, temperature_c, pulse_bpm, bp_systolic, bp_diastolic, spo2_pct, weight_kg, height_cm)
         VALUES (gen_random_uuid(), $1, 38.5, 88, 120, 80, 98.0, 65.0, 172.0)"
    )
    .bind(visit_id)
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO medical_prescriptions (prescription_id, visit_id, medicine_name, dosage, frequency, duration_days, route)
         VALUES (gen_random_uuid(), $1, 'Paracetamol 500mg', '500mg', 'TDS', 3, 'Oral')"
    )
    .bind(visit_id)
    .execute(pool)
    .await?;

    // 15. Create double-entry journals for realistic financial reports
    let j1 = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO journal_entries (journal_id, institution_id, reference, description, status, created_by_user_id, approved_by_user_id, posted_at)
         VALUES ($1, $2, 'JV-2026-001', 'Academic Year 2026-27 Semester 1 Fee Accrual', 'Posted', $3, $3, NOW())"
    )
    .bind(j1)
    .bind(inst_id)
    .bind(admin_user_id)
    .execute(pool)
    .await?;

    sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount, narration) VALUES (gen_random_uuid(), $1, $2, 420000.00, 0.00, 'Accrued semester fee')")
        .bind(j1).bind(coa_map["1201"]).execute(pool).await?;
    sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount, narration) VALUES (gen_random_uuid(), $1, $2, 0.00, 300000.00, 'Tuition portion')")
        .bind(j1).bind(coa_map["4001"]).execute(pool).await?;
    sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount, narration) VALUES (gen_random_uuid(), $1, $2, 0.00, 80000.00, 'Hostel rent portion')")
        .bind(j1).bind(coa_map["4101"]).execute(pool).await?;
    sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount, narration) VALUES (gen_random_uuid(), $1, $2, 0.00, 40000.00, 'Transport portion')")
        .bind(j1).bind(coa_map["4201"]).execute(pool).await?;

    sqlx::query(
        "INSERT INTO event_log (event_id, institution_id, event_type, aggregate_id, aggregate_type, user_id, event_payload, event_version)
         VALUES (gen_random_uuid(), $1, 'JournalEntryPosted', $2, 'JournalEntry', $3, json_build_object('journal_id', $2::uuid, 'reference', 'JV-2026-001', 'occurred_at', NOW()), 1)"
    )
    .bind(inst_id)
    .bind(j1)
    .bind(admin_user_id)
    .execute(pool)
    .await?;

    let j2 = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO journal_entries (journal_id, institution_id, reference, description, status, created_by_user_id, approved_by_user_id, posted_at)
         VALUES ($1, $2, 'JV-2026-002', 'Fee Collection and Bank Deposit', 'Posted', $3, $3, NOW())"
    )
    .bind(j2)
    .bind(inst_id)
    .bind(admin_user_id)
    .execute(pool)
    .await?;

    sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount, narration) VALUES (gen_random_uuid(), $1, $2, 410000.00, 0.00, 'Fee collected')")
        .bind(j2).bind(coa_map["1001"]).execute(pool).await?;
    sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount, narration) VALUES (gen_random_uuid(), $1, $2, 0.00, 410000.00, 'Accounts receivable cleared')")
        .bind(j2).bind(coa_map["1201"]).execute(pool).await?;

    sqlx::query(
        "INSERT INTO event_log (event_id, institution_id, event_type, aggregate_id, aggregate_type, user_id, event_payload, event_version)
         VALUES (gen_random_uuid(), $1, 'JournalEntryPosted', $2, 'JournalEntry', $3, json_build_object('journal_id', $2::uuid, 'reference', 'JV-2026-002', 'occurred_at', NOW()), 1)"
    )
    .bind(inst_id)
    .bind(j2)
    .bind(admin_user_id)
    .execute(pool)
    .await?;

    let j3 = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO journal_entries (journal_id, institution_id, reference, description, status, created_by_user_id, approved_by_user_id, posted_at)
         VALUES ($1, $2, 'JV-2026-003', 'Salaries processing for June 2026', 'Posted', $3, $3, NOW())"
    )
    .bind(j3)
    .bind(inst_id)
    .bind(admin_user_id)
    .execute(pool)
    .await?;

    sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount, narration) VALUES (gen_random_uuid(), $1, $2, 120000.00, 0.00, 'Faculty salary exp')")
        .bind(j3).bind(coa_map["5001"]).execute(pool).await?;
    sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount, narration) VALUES (gen_random_uuid(), $1, $2, 0.00, 105000.00, 'Paid via bank')")
        .bind(j3).bind(coa_map["1001"]).execute(pool).await?;
    sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount, narration) VALUES (gen_random_uuid(), $1, $2, 0.00, 15000.00, 'Outstanding salaries')")
        .bind(j3).bind(coa_map["2101"]).execute(pool).await?;

    sqlx::query(
        "INSERT INTO event_log (event_id, institution_id, event_type, aggregate_id, aggregate_type, user_id, event_payload, event_version)
         VALUES (gen_random_uuid(), $1, 'JournalEntryPosted', $2, 'JournalEntry', $3, json_build_object('journal_id', $2::uuid, 'reference', 'JV-2026-003', 'occurred_at', NOW()), 1)"
    )
    .bind(inst_id)
    .bind(j3)
    .bind(admin_user_id)
    .execute(pool)
    .await?;

    let j4 = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO journal_entries (journal_id, institution_id, reference, description, status, created_by_user_id, approved_by_user_id, posted_at)
         VALUES ($1, $2, 'JV-2026-004', 'Electricity, water and campus maintenance expenses', 'Posted', $3, $3, NOW())"
    )
    .bind(j4)
    .bind(inst_id)
    .bind(admin_user_id)
    .execute(pool)
    .await?;

    sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount, narration) VALUES (gen_random_uuid(), $1, $2, 30000.00, 0.00, 'Utility bills')")
        .bind(j4).bind(coa_map["5101"]).execute(pool).await?;
    sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount, narration) VALUES (gen_random_uuid(), $1, $2, 0.00, 18000.00, 'Paid via bank')")
        .bind(j4).bind(coa_map["1001"]).execute(pool).await?;
    sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount, narration) VALUES (gen_random_uuid(), $1, $2, 0.00, 12000.00, 'Accounts payable')")
        .bind(j4).bind(coa_map["2001"]).execute(pool).await?;

    sqlx::query(
        "INSERT INTO event_log (event_id, institution_id, event_type, aggregate_id, aggregate_type, user_id, event_payload, event_version)
         VALUES (gen_random_uuid(), $1, 'JournalEntryPosted', $2, 'JournalEntry', $3, json_build_object('journal_id', $2::uuid, 'reference', 'JV-2026-004', 'occurred_at', NOW()), 1)"
    )
    .bind(inst_id)
    .bind(j4)
    .bind(admin_user_id)
    .execute(pool)
    .await?;

    let j5 = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO journal_entries (journal_id, institution_id, reference, description, status, created_by_user_id, approved_by_user_id, posted_at)
         VALUES ($1, $2, 'JV-2026-005', 'Transport fuel prepayments and purchases', 'Posted', $3, $3, NOW())"
    )
    .bind(j5)
    .bind(inst_id)
    .bind(admin_user_id)
    .execute(pool)
    .await?;

    sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount, narration) VALUES (gen_random_uuid(), $1, $2, 15000.00, 0.00, 'Fuel consumed')")
        .bind(j5).bind(coa_map["5201"]).execute(pool).await?;
    sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount, narration) VALUES (gen_random_uuid(), $1, $2, 5000.00, 0.00, 'Prepaid fuel')")
        .bind(j5).bind(coa_map["1301"]).execute(pool).await?;
    sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount, narration) VALUES (gen_random_uuid(), $1, $2, 0.00, 20000.00, 'Paid via bank')")
        .bind(j5).bind(coa_map["1001"]).execute(pool).await?;

    sqlx::query(
        "INSERT INTO event_log (event_id, institution_id, event_type, aggregate_id, aggregate_type, user_id, event_payload, event_version)
         VALUES (gen_random_uuid(), $1, 'JournalEntryPosted', $2, 'JournalEntry', $3, json_build_object('journal_id', $2::uuid, 'reference', 'JV-2026-005', 'occurred_at', NOW()), 1)"
    )
    .bind(inst_id)
    .bind(j5)
    .bind(admin_user_id)
    .execute(pool)
    .await?;

    let j6 = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO journal_entries (journal_id, institution_id, reference, description, status, created_by_user_id, approved_by_user_id, posted_at)
         VALUES ($1, $2, 'JV-2026-006', 'Medical pharmacy and library book purchases', 'Posted', $3, $3, NOW())"
    )
    .bind(j6)
    .bind(inst_id)
    .bind(admin_user_id)
    .execute(pool)
    .await?;

    sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount, narration) VALUES (gen_random_uuid(), $1, $2, 10000.00, 0.00, 'Medical stock')")
        .bind(j6).bind(coa_map["5301"]).execute(pool).await?;
    sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount, narration) VALUES (gen_random_uuid(), $1, $2, 5000.00, 0.00, 'Library supplies')")
        .bind(j6).bind(coa_map["5401"]).execute(pool).await?;
    sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount, narration) VALUES (gen_random_uuid(), $1, $2, 0.00, 15000.00, 'Paid via bank')")
        .bind(j6).bind(coa_map["1001"]).execute(pool).await?;

    sqlx::query(
        "INSERT INTO event_log (event_id, institution_id, event_type, aggregate_id, aggregate_type, user_id, event_payload, event_version)
         VALUES (gen_random_uuid(), $1, 'JournalEntryPosted', $2, 'JournalEntry', $3, json_build_object('journal_id', $2::uuid, 'reference', 'JV-2026-006', 'occurred_at', NOW()), 1)"
    )
    .bind(inst_id)
    .bind(j6)
    .bind(admin_user_id)
    .execute(pool)
    .await?;

    let j7 = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO journal_entries (journal_id, institution_id, reference, description, status, created_by_user_id, approved_by_user_id, posted_at)
         VALUES ($1, $2, 'JV-2026-007', 'Library fine collection and deposit', 'Posted', $3, $3, NOW())"
    )
    .bind(j7)
    .bind(inst_id)
    .bind(admin_user_id)
    .execute(pool)
    .await?;

    sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount, narration) VALUES (gen_random_uuid(), $1, $2, 2000.00, 0.00, 'Library cash fine')")
        .bind(j7).bind(coa_map["1001"]).execute(pool).await?;
    sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount, narration) VALUES (gen_random_uuid(), $1, $2, 0.00, 2000.00, 'Fine revenue')")
        .bind(j7).bind(coa_map["4301"]).execute(pool).await?;

    sqlx::query(
        "INSERT INTO event_log (event_id, institution_id, event_type, aggregate_id, aggregate_type, user_id, event_payload, event_version)
         VALUES (gen_random_uuid(), $1, 'JournalEntryPosted', $2, 'JournalEntry', $3, json_build_object('journal_id', $2::uuid, 'reference', 'JV-2026-007', 'occurred_at', NOW()), 1)"
    )
    .bind(inst_id)
    .bind(j7)
    .bind(admin_user_id)
    .execute(pool)
    .await?;

    tracing::info!("All demo users, CSE department/branch/courses, classes, allocations, fee structure, accounts, library transactions, hostels, transport, placement drives, medical logs, and journal entries seeded successfully.");
    Ok(())
}
