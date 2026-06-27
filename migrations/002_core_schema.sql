-- ── Institutions ─────────────────────────────────────────────────────────────
CREATE TABLE institutions (
    institution_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    type            VARCHAR(50)  NOT NULL DEFAULT 'EngineeringCollege',
    -- EngineeringCollege | University | AutonomousInstitute | School
    address         JSONB,
    principal_name  VARCHAR(255),
    phone           VARCHAR(20),
    email           VARCHAR(100),
    affiliation     VARCHAR(255),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    soft_deleted    BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ
);

-- ── Departments ───────────────────────────────────────────────────────────────
CREATE TABLE departments (
    department_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    department_name VARCHAR(100) NOT NULL,
    hod_faculty_id  UUID,   -- FK set later (circular with faculty)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(institution_id, department_name)
);

-- ── Branches ──────────────────────────────────────────────────────────────────
CREATE TABLE branches (
    branch_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    department_id   UUID REFERENCES departments(department_id),
    branch_name     VARCHAR(100) NOT NULL,
    branch_code     VARCHAR(20),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(institution_id, branch_code)
);

-- ── Roles (RBAC) ──────────────────────────────────────────────────────────────
CREATE TABLE roles (
    role_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    role_name       VARCHAR(50)  NOT NULL,
    -- Principal | Registrar | FeeManager | Faculty | Student | Parent | HOD
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(institution_id, role_name)
);

CREATE TABLE role_permissions (
    permission_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id         UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    resource        VARCHAR(100) NOT NULL,
    -- students | courses | marks | exams | fees | accounts | reports | attendance
    action          VARCHAR(50)  NOT NULL,
    -- create | read | update | delete | approve
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(role_id, resource, action)
);

-- ── Persons (Universal Identity) ─────────────────────────────────────────────
CREATE TABLE persons (
    person_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100),
    date_of_birth   DATE,
    gender          VARCHAR(10),  -- M | F | Other
    aadhar          VARCHAR(12),
    phone           VARCHAR(20),
    email           VARCHAR(100),
    address         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    soft_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ,
    UNIQUE(institution_id, aadhar)
);

-- ── Users (Auth) ──────────────────────────────────────────────────────────────
CREATE TABLE users (
    user_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    person_id       UUID NOT NULL REFERENCES persons(person_id),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    username        VARCHAR(100) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role_id         UUID NOT NULL REFERENCES roles(role_id),
    mfa_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    last_login      TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(institution_id, username)
);

-- Refresh tokens
CREATE TABLE refresh_tokens (
    token_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked         BOOLEAN NOT NULL DEFAULT FALSE
);
