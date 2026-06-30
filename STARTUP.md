# 🚀 EduOS — Startup Guide

> Complete instructions to run the EduOS backend + frontend locally from scratch.

---

## 📋 Prerequisites

Make sure you have **all of these installed** before starting:

| Tool | Minimum Version | Download |
|------|----------------|----------|
| **Docker Desktop** | 4.x+ | https://www.docker.com/products/docker-desktop |
| **Rust** (with `cargo`) | 1.75+ | https://rustup.rs |
| **Node.js** | 18+ | https://nodejs.org |
| **npm** | 9+ | Comes with Node.js |

Verify everything is installed:

```powershell
docker --version       # Docker version 28.x.x
cargo --version        # cargo 1.75.x
node --version         # v18.x.x or v20.x.x
npm --version          # 9.x.x or 10.x.x
```

---

## 🗂️ Project Structure

```
eduOS/
├── backend/          ← Rust (Axum) API server
├── frontend/         ← React + TypeScript (Vite) UI
├── migrations/       ← PostgreSQL SQL migration files
├── docker-compose.yml
├── .env              ← Backend environment config
└── STARTUP.md        ← This file
```

---

## ⚡ Port Reference

| Service | Port | URL |
|---------|------|-----|
| **EduOS Frontend** | **5200** | http://localhost:5200 |
| **EduOS Backend API** | **8000** | http://localhost:8000/api/v1 |
| **PostgreSQL** | 5432 | localhost:5432 |
| **Redis** | 6379 | localhost:6379 |

> EduOS frontend is **pinned to port 5200** — it will never clash with other Vite projects on 5173.
> 
> ⚠️ **Port Note:** PostgreSQL is mapped to **5432** (not 5433). If you have WSL2 with a native postgres
> running on 5433, using 5432 ensures Docker's postgres is always reached correctly.

---

## 🏁 First-Time Setup

> **Only do this once** — the very first time you clone the project.

### Step 1 — Install frontend dependencies

Open a terminal in the project root:

```powershell
cd C:\Users\Varad Deshpande\Desktop\eduOS\frontend
npm install
```

---

## ▶️ Every-Day Startup (Step by Step)

Follow these steps **in order** every time you want to run EduOS.

---

### STEP 1 — Start Docker Desktop

Open **Docker Desktop** from the Start Menu or System Tray.

Wait until the Docker icon in the system tray shows **"Docker Desktop is running"** (green circle).

**Verify Docker is ready:**
```powershell
docker info
```
You should see Docker version info. If you see an error, Docker Desktop is not fully started yet — wait another 10–15 seconds and try again.

---

### STEP 2 — Start the Database (PostgreSQL + Redis)

Open a terminal in the `eduOS/` folder and run:

```powershell
cd C:\Users\Varad Deshpande\Desktop\eduOS
docker-compose up -d postgres redis
```

**Verify containers are healthy:**
```powershell
docker ps --filter "name=eduos"
```

Expected output:
```
NAMES            STATUS
eduos-postgres   Up X seconds (healthy)
eduos-redis      Up X seconds (healthy)
```

> ⚠️ Wait until both say **(healthy)** before proceeding. This usually takes 5–10 seconds.

---

### STEP 3 — Start the Backend API

In the same terminal (still in `eduOS/`):

```powershell
.\start-backend.ps1
```

> 💡 This script loads all environment variables from `.env` then runs the backend.
> **Do NOT use bare `cargo run`** — it will fail because `.env` isn't auto-loaded in PowerShell.

**First run:** Will compile all Rust dependencies (~2–3 minutes). Grab a coffee ☕

**Subsequent runs:** Only takes ~2–3 seconds (already compiled).

**You will see this output when it's ready:**
```json
{"level":"INFO","message":"EduOS API starting","env":"development"}
{"level":"INFO","message":"PostgreSQL connection pool established"}
{"level":"INFO","message":"Database migrations applied successfully"}
{"level":"INFO","message":"Database already seeded. Skipping seed."}
{"level":"INFO","message":"Server listening","addr":"127.0.0.1:8000"}
```

✅ **Backend is live at `http://localhost:8000/api/v1`**

> 💡 The first time ever, you will see `"Seeding default database records..."` — this creates the default institution, roles, and admin user automatically. Every run after that will say `"Database already seeded. Skipping seed."`

---

### STEP 4 — Start the Frontend

Open a **second terminal** (keep the backend running in Terminal 1):

```powershell
cd C:\Users\Varad Deshpande\Desktop\eduOS\frontend
npm run dev
```

**You will see:**
```
  VITE v5.x.x  ready in XXXms

  ➜  Local:   http://localhost:5200/
  ➜  Network: use --host to expose
```

✅ **Frontend is live at `http://localhost:5200`**

---

### STEP 5 — Open EduOS in Your Browser

Navigate to: **http://localhost:5200**

You will see the **EduOS Login Page**. Enter:

| Field | Value |
|-------|-------|
| Institution ID | `550e8400-e29b-41d4-a716-446655440000` |
| Username | `admin` |
| Password | `Password@123` |

Click **Sign In** → You will land on the Dashboard. 🎉

---

## 🔴 Stopping EduOS

To stop everything cleanly:

```powershell
# 1. Stop the frontend:
#    Press Ctrl + C in Terminal 2 (the npm run dev terminal)

# 2. Stop the backend:
#    Press Ctrl + C in Terminal 1 (the cargo run terminal)

# 3. Stop Docker containers:
docker-compose down
```

> ℹ️ Your database data is **preserved** between restarts (stored in a Docker volume). 
> To wipe the database and start completely fresh: `docker-compose down -v`

---

## 🛠️ Troubleshooting

### ❌ `Only one usage of each socket address (os error 10048)` — Port 8000 already in use

A previous backend process is still running. Kill it:

```powershell
# Find what's on port 8000
netstat -ano | findstr ":8000"

# Kill it using the PID shown in the last column (replace XXXX)
taskkill /PID XXXX /F

# Then try again
.\start-backend.ps1
```

---

### ❌ `Failed to connect to PostgreSQL` — Database unreachable

Docker Desktop is not running or the container is not healthy.

```powershell
# 1. Make sure Docker Desktop is fully started (check system tray)
# 2. Check container status
docker ps --filter "name=eduos"

# 3. If containers are not there, start them
docker-compose up -d postgres redis

# 4. Wait for (healthy) status, then rerun the backend
.\start-backend.ps1
```

---

### ❌ Frontend shows `Port 5200 is already in use`

Another process has taken port 5200. Find and kill it:

```powershell
netstat -ano | findstr ":5200"
taskkill /PID XXXX /F
```

---

### ❌ `npm run dev` fails — missing packages

Re-install frontend dependencies:

```powershell
cd C:\Users\Varad Deshpande\Desktop\eduOS\frontend
npm install
npm run dev
```

---

### ❌ Login fails — wrong credentials or Institution ID

The default credentials are seeded automatically on first boot. If you wiped the database (`docker-compose down -v`), restart the backend once and it will re-seed.

```
Institution ID: 550e8400-e29b-41d4-a716-446655440000
Username:       admin
Password:       Password@123
```

---

### ❌ Docker Desktop won't open

Open PowerShell as Administrator and run:

```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

---

## 🔐 Credentials Summary

| Item | Value |
|------|-------|
| **Institution ID** | `550e8400-e29b-41d4-a716-446655440000` |
| **Admin username** | `admin` |
| **Admin password** | `Password@123` |
| **DB host** | `localhost:5432` |
| **DB name** | `eduos_dev` |
| **DB user** | `eduos` |
| **DB password** | `eduos_dev_pass` |
| **Redis** | `localhost:6379` |

---

## 📡 API Quick Test (Optional)

To verify the backend is working correctly, run these in PowerShell:

```powershell
# Health check
curl http://localhost:8000/api/v1/health

# Login and get a token
curl -X POST http://localhost:8000/api/v1/auth/login `
  -H "Content-Type: application/json" `
  -d '{"institution_id":"550e8400-e29b-41d4-a716-446655440000","username":"admin","password":"Password@123"}'
```

You should get back a `{"success": true, "data": {"access_token": "..."}}` response.

---

## 🔁 Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│                    EDUOS STARTUP ORDER                          │
│                                                                 │
│  1. Open Docker Desktop  (wait for green icon)                  │
│  2. docker-compose up -d postgres redis   (wait for healthy)    │
│  3. .\start-backend.ps1                  (Terminal 1)          │
│  4. cd frontend && npm run dev            (Terminal 2)          │
│  5. Open http://localhost:5200            (Browser)             │
│                                                                 │
│  LOGIN:  admin / Password@123                                   │
│  INST:   550e8400-e29b-41d4-a716-446655440000                  │
└─────────────────────────────────────────────────────────────────┘
```
