# FairBench: Lab Equipment Scheduler

A web app that replaces the paper booking sheet in Dr. Haque's lab. Students submit a window and a duration. The system builds a fair, conflict-free schedule, explains every decision, lets the admin override, and re-plans when a machine breaks.

**Stack:** React (Vite) · Node.js + Express · PostgreSQL on Supabase (Auth, RLS, Realtime)

## Team

| Person | Focus |
|---|---|
| Sabbir | Database, scheduler engine, core services |
| Aranno | Express API, security, admin screens |
| Sirat | Student screens, calendar, shared UI, settings and notification routes |

AI agents: start with `AGENTS.md`. It asks for your name first.

## Documents

See `docs/`: SRS, PRD, ARCHITECTURE, SYSTEM_DESIGN, ERD, DATABASE, API_SPEC, SCHEDULER_SPEC, FRONTEND_SPEC, TESTING, PROGRESS.

## Repository layout

```
fairbench/
  AGENTS.md  CLAUDE.md  README.md
  docs/
  database/
    migrations/     001_schema.sql ... 006_demo_seed.sql
  backend/
    src/
      app.js  server.js
      config/       env.js, supabase.js
      middleware/   auth.js, errors.js, validate.js
      routes/       me, machines, requests, schedule, bookings, admin, settings, notifications, health
      services/     requestService, bookingService, overrideService, outageService,
                    previewService, auditService, notificationService
      scheduler/    index.js, slots.js, score.js, place.js, repair.js, explain.js
      db/           pool.js, queries.js
    tests/
  frontend/
    src/
      api/  components/  components/admin/  hooks/  pages/  pages/admin/  lib/  mocks/
```

## Setup

1. Create a Supabase project. Run the files in `database/migrations/` in order (SQL editor or Supabase CLI).
2. Backend `.env` (never commit):
   ```
   PORT=4000
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...        # backend only
   SUPABASE_JWT_SECRET=...
   DATABASE_URL=postgresql://...         # Supabase connection string
   LAB_TIMEZONE=Asia/Dhaka
   CORS_ORIGIN=http://localhost:5173
   ```
3. Frontend `.env`:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   VITE_API_URL=http://localhost:4000
   VITE_USE_MOCKS=false
   ```
4. Install and run:
   ```
   cd backend && npm install && npm run dev
   cd frontend && npm install && npm run dev
   ```
5. Tests: `npm test` in `backend/`.
