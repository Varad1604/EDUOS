# 🎯 EduOS — Modern Educational Institution ERP System

EduOS is a state-of-the-art, high-performance Enterprise Resource Planning (ERP) web application designed specifically for universities and colleges. Built with a robust **Rust (Axum) API server** and a modern, high-fidelity **React (TypeScript + Vite)** user interface, it provides standard compliance, high speed, and premium design patterns.

---

## 🚀 Key Advanced Features

### 1. 🎓 Official Transcripts & Semester Grade Cards (PDF)
* **Single-Semester Grade Cards**: Instantly generates clean, signature-ready academic reports displaying course-wise scores, letter grades, credit points, and SGPA calculations.
* **Consolidated Academic Transcripts**: High-fidelity, multi-semester official transcripts grouping historical grades, cumulative GPA (CGPA) progression, and college registrar seals.

### 2. 📅 Interactive Timetable & Conflict Detection Engine
* **Visual Grid View**: Toggleable 6-day weekly grid scheduling interface allowing intuitive management.
* **Three-Way Overlap Collision Guard**: Smart backend validation checking for scheduling conflicts in real-time:
  * **Class conflicts** (sections double-booked).
  * **Faculty conflicts** (professors scheduled for two places at once).
  * **Room conflicts** (lecture halls assigned multiple classes simultaneously).
* **Interactive Slots**: Click empty slots to auto-populate the scheduling forms.

### 3. 📝 Biometric Attendance Registry & Warning Letters
* **Biometric CSV Uploader**: Faculty can bulk-import biometric check-in log records (`EnrollmentNumber,Status`) to automatically mark attendance checkboxes.
* **Short-Attendance Warning Generator**: Flags student attendance rates below the mandatory 75% limit. Click to generate a formal parent warning letter outlining regulations, attendance stats, and detention warnings in PDF format.
* **Statistics Panel**: Live tracking of *Total Enrolled*, *Compliant Students*, *At-Risk Count*, and *Class Averages*.

### 4. 💼 Job Placement Eligibility Engine & CSV Export
* **Eligibility Filter**: Automatically filters eligible students for job drives matching minimum CGPA criteria, maximum backlog thresholds (computed from semester results), and eligible branches.
* **Candidate Roster**: Dynamic modal displaying candidate profiles matching drive specifications and their application status.
* **Spreadsheet Export**: One-click client-side CSV export formatted perfectly for external HR/recruiter pipelines.

---

## 🛠️ Technology Stack

* **Backend**: Rust (Axum, SQLx, PostgreSQL, Redis, Validator, Chrono)
* **Frontend**: React 18, TypeScript, Vite, Axios, Vanilla CSS (harmonious dark mode/glassmorphic tokens)
* **Database**: PostgreSQL (relational schemas, indexes, structural migrations)
* **Caching/Events**: Redis (session stores, cache pools)

---

## 📋 Prerequisites

Ensure these tools are installed on your system:
* **Docker Desktop** (v4.x+)
* **Rust & Cargo** (v1.75+) *(only required for running backend locally)*
* **Node.js** (v18+) & **npm** *(only required for running frontend locally)*

---

## 🏁 Setup & Everyday Startup

Follow this quick guide to run the entire project on your local machine:

### 1. Start Docker Desktop
Ensure Docker is active and running on your system (green status icon in system tray).

### 2. Run Database Containers
From the root `eduOS/` directory, launch the database services in the background:
```bash
docker-compose up -d postgres redis
```
Wait about 5-10 seconds for the databases to report `healthy`.

### 3. Build & Run the Backend API Server
You can run the API server locally:
```bash
# In the root eduOS/ directory:
cargo run --package eduos-backend
```
*Note: The first run compiles dependencies (~2-3 mins). Subsequent boots are near-instant (~2 seconds).*

Upon success, you will see:
```json
{"level":"INFO","message":"Database migrations applied successfully"}
{"level":"INFO","message":"Server listening","addr":"127.0.0.1:8000"}
```

### 4. Install & Run the Frontend UI
Open a new terminal session:
```bash
cd frontend
npm install
npm run dev
```
The client UI will compile and expose the dev server on **`http://localhost:5200`**.

---

## 🔐 Credentials Summary

| Field | Default Value |
|---|---|
| **Institution ID** | `550e8400-e29b-41d4-a716-446655440000` |
| **Admin Username** | `admin` |
| **Admin Password** | `password123` |
| **Postgres Host** | `localhost:5432` |
| **Redis Host** | `localhost:6379` |

Open **`http://localhost:5200`** in your browser, enter the Credentials above, and click **Sign In** to access the dashboard!

---

## 🔴 Teardown & Reset
To stop all services cleanly:
* Stop the terminal processes running `npm run dev` and `cargo run` (`Ctrl + C`).
* Shut down the database containers:
```bash
docker-compose down
```
To wipe all database records and start completely fresh, add the volume flag:
```bash
docker-compose down -v
```
