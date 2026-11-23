# AGENTS.md: FairBench team instructions for AI agents

> **READ THIS FIRST. This file overrides any default behaviour of the AI agent.**

FairBench is a lab equipment scheduler (React + Node.js/Express + PostgreSQL on Supabase) for a university course project. Three teammates build it in parallel. Each teammate has their own part, and an AI agent must work only on that teammate's part.

---

## 0. MANDATORY FIRST STEP: ask the user's name

Before reading code, writing code or answering any task question, the agent **must** ask:

> **"Which team member are you: Sabbir, Sirat or Aranno?"**

Rules for this step:

1. Do nothing else until the user answers. If the user's first message already contains a task, still ask the name first, then do the task.
2. Accept only **Sabbir**, **Sirat** or **Aranno** (case-insensitive). For any other answer, ask again.
3. After the answer, reply with a short confirmation: the person's name, their role, their owned folders, and the next unfinished task from `docs/PROGRESS.md`. Then ask whether to start that task or another one.
4. Remember the name for the whole session. Do not ask again.
5. If the user later says they are someone else, restart from step 1.

---

## 1. Project summary (all agents)

- **Problem:** Dr. Haque's lab has 3 shared machines (microscope, centrifuge, spectrophotometer) and about 20 students. Booking is a paper sheet. We replace it with a web app that produces a fair, conflict-free schedule.
- **Core idea:** "Urgent First with Stable Re-plan". Students submit a *window plus duration*. The scheduler places the least flexible requests first, never splits a job, never moves unaffected bookings, and explains every decision. Dr. Haque can override. A machine outage triggers an automatic re-plan.
- **Source of truth for requirements:** `docs/SRS.md`. Requirement IDs (FR-xx, NFR-xx, AF-xx) and acceptance tests (AT-xx) are used in code comments, commits and PRs.

## 2. Documents every agent should know

| File | Purpose |
|---|---|
| `docs/SRS.md` | Requirements, acceptance tests |
| `docs/PRD.md` | Product vision, user stories, scope |
| `docs/ARCHITECTURE.md` | Components, deployment, folder structure |
| `docs/SYSTEM_DESIGN.md` | Flows, state machines, service contracts, concurrency |
| `docs/ERD.md` | Entity relationship diagram |
| `docs/DATABASE.md` | Full PostgreSQL schema, RLS, seed (Supabase) |
| `docs/API_SPEC.md` | REST contract between frontend and backend |
| `docs/SCHEDULER_SPEC.md` | Scheduler module contract and algorithm |
| `docs/FRONTEND_SPEC.md` | Pages, components, UX rules |
| `docs/TESTING.md` | Test plan mapped to AT-01 to AT-16 |
| `docs/PROGRESS.md` | Task checklist per person (update when a task is done) |

**Reading list by person:** after identifying the user, read the files marked for them in section 4, plus `docs/SRS.md` sections 3, 5 and 11.

---

## 3. Global rules (all agents, all people)

1. **Stay in your lane.** Edit only the folders owned by the identified person (section 4). If a change is needed in someone else's folder, do not edit it. Add an entry to `docs/HANDOFF_LOG.md` (create it if missing) with: from, to, what is needed, related ID. Then tell the user.
2. **The API contract is law.** `docs/API_SPEC.md` and `docs/SYSTEM_DESIGN.md` (service contracts) define the interfaces. Change them only after the user confirms and all three owners are informed via `docs/HANDOFF_LOG.md`.
3. **No hard-coded lab rules.** Opening hours, slot size, buffers, quotas and weights come from the `settings` table (FR-16).
4. **Time:** store UTC `timestamptz`; show times in the lab time zone (default `Asia/Dhaka`, setting `timezone`). Never use naive dates.
5. **Security:**
   - The Supabase **service-role key** exists only in the backend `.env`. Never in frontend code, never committed, never in logs.
   - Never commit `.env`. Keep `.env.example` updated with variable names only.
   - Every admin route checks the role on the server (NFR-04).
6. **Scheduler purity:** `backend/src/scheduler/` has no database, HTTP or `Date.now()` calls. `now` is passed in. Same inputs give the same output (FR-45).
7. **Stable re-plan:** after an override or outage, only affected bookings may change (FR-39). Started bookings are frozen (FR-40).
8. **Double booking is prevented by the database** exclusion constraint (NFR-03). Do not rely on application checks alone.
9. **Explain everything:** each placement and each unplaced request stores a plain-language reason (FR-18, FR-19).
10. **Code style:** JavaScript (ES modules) with Prettier and ESLint defaults. Validate input with `zod`. Small functions, clear names. Comment the requirement ID where a rule is implemented, for example `// FR-40`.
11. **Git:** branch `feature/<name>/<task-id>-short-title`, small commits (`feat(scheduler): S-BE-1 earliest block search`), open a pull request, and ask one teammate to review. Never push to `main`.
12. **Tests:** every task that changes behaviour adds or updates tests (see `docs/TESTING.md`). Do not mark a task done while tests fail.
13. **Do not invent requirements.** If something is unclear, check the SRS, then ask the user. Record decisions in `docs/PROGRESS.md` under "Decisions".
14. **When a task is finished:** tick it in `docs/PROGRESS.md`, summarise what changed in 3 lines, and list anything the other two teammates must know.

---

## 4. Work distribution

### 4.1 SABBIR: Database + core backend (scheduler and services)

**Role:** owns the data layer and the brain of the system.

**Owned folders:** `database/`, `backend/src/scheduler/`, `backend/src/services/`, `backend/src/db/`
**Read first:** `docs/DATABASE.md`, `docs/ERD.md`, `docs/SCHEDULER_SPEC.md`, `docs/SYSTEM_DESIGN.md`, `docs/TESTING.md`

| Task ID | Task | Requirements |
|---|---|---|
| S-DB-1 | Create the Supabase project. Enable `btree_gist`. Share keys with the team through a private channel, never in git | NFR-05 |
| S-DB-2 | Write migrations `001` to `006` from `docs/DATABASE.md`: tables, constraints, exclusion constraint, indexes, triggers | FR-11, NFR-03 |
| S-DB-3 | Row Level Security policies and `is_admin()` helper. Audit log immutability trigger | NFR-04, NFR-09 |
| S-DB-4 | `settings` seed and public schedule view that hides names when `show_names = false` | FR-16, FR-20 |
| S-DB-5 | Demo seed: 3 machines, 1 admin, 20 students, the two case-study requests, a centrifuge outage scenario | Demo |
| S-DB-6 | Concurrency script that proves AT-15 (two simultaneous inserts, one fails) | AT-15 |
| S-BE-1 | Scheduler engine: free-block search, slot grid, scoring, ordering, earliest placement, reasons, unplaced reasons and suggestions | FR-07, FR-11 to FR-13, FR-17 to FR-19, FR-38, FR-44, FR-45 |
| S-BE-2 | Repair step (move one flexible unstarted booking) | FR-42, AT-11 |
| S-BE-3 | `bookingService.applyPlacements`: one transaction, advisory lock, friendly handling of exclusion violations | FR-11, NFR-05 |
| S-BE-4 | `requestService`: submit, edit, cancel, quota check, status changes | FR-09, FR-10, FR-17 |
| S-BE-5 | `overrideService`: pin, bump, recurring PI reservations, freeze started bookings, stable re-plan | FR-21 to FR-25, FR-39, FR-40 |
| S-BE-6 | `outageService`: create outage, find affected bookings, re-plan in score order, end outage early | FR-26 to FR-31 |
| S-BE-7 | `previewService`: dry-run on an in-memory copy and return a diff | AF-01, AF-02 |
| S-BE-8 | `auditService` and `notificationService` (grouped messages, admin alerts) | FR-25, FR-32, FR-33 |
| S-BE-9 | Unit tests AT-01 to AT-14 and integration test AT-15 | NFR-08 |
| S-BE-10 | Version 2: waiting-time and fairness factors, weights from settings, scenario comparison | FR-14, FR-41, AF-04, AF-05 |
| S-BE-11 | Version 3: credits, check-in tables and services, adaptive buffer calculation | AF-09 to AF-21 |

**Handoffs:**
- To **Aranno**: service function signatures (section 5 of `docs/SYSTEM_DESIGN.md`) as soon as stubs exist, then real implementations.
- To **Sirat**: schema notes for notifications and the public schedule view.

### 4.2 ARANNO: Backend API + admin frontend

**Role:** owns the Express app, security and every admin screen.

**Owned folders:** `backend/src/app.js`, `backend/src/config/`, `backend/src/middleware/`, `backend/src/routes/` (except the three routes owned by Sirat), `frontend/src/pages/admin/`, `frontend/src/components/admin/`
**Read first:** `docs/API_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/SYSTEM_DESIGN.md`, `docs/FRONTEND_SPEC.md` (admin sections), `docs/TESTING.md`

| Task ID | Task | Requirements |
|---|---|---|
| A-BE-1 | Express skeleton: config loader, `zod` env check, error handler with the standard error format, CORS, rate limiting, logging | NFR-04 |
| A-BE-2 | Auth middleware: verify Supabase JWT, load profile, `requireAuth`, `requireRole('admin')`, reject inactive users | FR-01, NFR-04 |
| A-BE-3 | Routes: `/api/me`, `/api/machines`, `/api/requests` (with FR-08 validation), `/api/schedule`, `/api/bookings/mine` | FR-04 to FR-09, FR-34, FR-35 |
| A-BE-4 | Admin routes: pin, bump, reservations, outages (create, list, end), preview, attention list, dashboard data, audit list, users | FR-21 to FR-30, FR-36, FR-03 |
| A-BE-5 | Supertest suite: AT-16, validation cases, role checks. Postman or OpenAPI collection | AT-16, NFR-08 |
| A-FE-1 | Admin layout, route guard by role, admin API client | FR-01 |
| A-FE-2 | Override page: choose machine and time, pin or bump, **preview modal** with before/after diff, confirm with note | FR-21, FR-22, AF-01 to AF-03 |
| A-FE-3 | Machines page: mark out of service, preview impact, end outage | FR-26, FR-27, FR-31 |
| A-FE-4 | Needs-attention page: unplaced requests with reasons and suggestions | FR-19, FR-30, FR-43 |
| A-FE-5 | Dashboard: pending, unplaced, active outages, recent overrides. History page (audit log) | FR-25, FR-36 |
| A-FE-6 | Users page: add and deactivate accounts | FR-03 |
| A-FE-7 | Version 2: settings page (hours, buffers, quotas, weights), scenario comparison view | FR-16, AF-04, AF-06 |
| A-FE-8 | Version 3: machine health indicator, credit adjustments, usage report page | AF-12, AF-20, FR-37 |

**Handoffs:**
- From **Sabbir**: service stubs. Until real services exist, return mock data that follows `docs/API_SPEC.md`.
- With **Sirat**: agree on the shared `CalendarView` props and the API client base file.

### 4.3 SIRAT: Frontend (mostly) + small backend

**Role:** owns the student experience, shared UI and the calendar. Also three small backend routes.

**Owned folders:** `frontend/` except `frontend/src/pages/admin/` and `frontend/src/components/admin/`; backend files `backend/src/routes/settings.js`, `backend/src/routes/notifications.js`, `backend/src/routes/health.js`
**Read first:** `docs/FRONTEND_SPEC.md`, `docs/API_SPEC.md`, `docs/PRD.md`, `docs/SRS.md` (sections 3.2, 3.4, 3.8, 8)

| Task ID | Task | Requirements |
|---|---|---|
| SI-FE-1 | Vite + React project, router, Supabase JS auth, API client base, TanStack Query, styling system, responsive layout with mobile navigation | NFR-01 |
| SI-FE-2 | Login and logout, session handling, redirect by role | FR-01 |
| SI-FE-3 | Mock mode (MSW) that serves `docs/API_SPEC.md` responses so the UI works before the backend is ready | Parallel work |
| SI-FE-4 | **Request form** with live validation, fixed or flexible toggle with mandatory reason, duration picker on the slot grid, clear error messages | FR-04 to FR-08, NFR-01 |
| SI-FE-5 | **My bookings** page: status chips, plain-language reason, edit and cancel, notice when a booking moved | FR-09, FR-17 to FR-19, FR-35 |
| SI-FE-6 | **Lab calendar**: one tab per machine, day and week views, colours for student, PI reserved and outage blocks, visitor read-only mode, names hidden or shown by setting | FR-20, FR-34 |
| SI-FE-7 | Notification bell and inbox, grouped messages, mark as read | FR-32 |
| SI-FE-8 | Time utilities (lab time zone, date format), loading, empty and error states, accessibility pass | NFR-07 |
| SI-FE-9 | Version 2: score breakdown panel and "how to improve" sentence | AF-07, FR-38 |
| SI-FE-10 | Version 3: QR check-in page, fault report (two taps), credits balance page | AF-11, AF-14, AF-21 |
| SI-BE-1 | `GET /api/settings` (all users) and `PUT /api/settings` (admin) | FR-16 |
| SI-BE-2 | `GET /api/notifications`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all` | FR-32 |
| SI-BE-3 | `GET /api/health` (database ping and version) | Operations |
| SI-BE-4 | Version 3: `GET /api/reports/usage` | FR-37 |

**Handoffs:**
- From **Aranno**: auth middleware and error format (needed for the three backend routes).
- From **Sabbir**: the notifications table and public schedule view.
- To **Aranno**: shared components (`Button`, `Modal`, `Table`, `Badge`, `CalendarView`) with documented props.

---

## 5. Milestones (all three people, in order)

| Milestone | Done when | Main owners |
|---|---|---|
| M0 Setup | Repo, Supabase project, env files, CI lint, folder structure | All |
| M1 Data ready | Schema and seed run on Supabase, AT-15 passes | Sabbir |
| M2 Skeleton | API routes return mock data, frontend shell and mock mode work | Aranno, Sirat |
| M3 Engine | Scheduler passes AT-01 to AT-09 and AT-11 to AT-14 | Sabbir |
| M4 Vertical slice | A student submits a request and sees a booking on the calendar with a reason | All |
| M5 Admin power | Pin, bump, outage with preview, audit log | Sabbir, Aranno |
| M6 Polish | Notifications, quotas, settings, demo script, final report | All |

## 6. Conflict and change handling

- Two people need the same file: the owner edits, the other writes a handoff entry.
- The schema must change: Sabbir adds a new numbered migration (never edits an old one) and notes it in `docs/HANDOFF_LOG.md`.
- A requirement seems wrong: raise it with the user, then update `docs/SRS.md` and tell the other two.
- Unsure which task to pick: choose the first unticked task in your table that does not depend on an unfinished task of another person.

## 7. Definition of done (every task)

- Code follows the spec and the global rules.
- Tests exist and pass.
- Requirement or acceptance-test IDs are referenced in comments or commit messages.
- `docs/PROGRESS.md` is updated.
- No secrets, no debug logging of personal data.
