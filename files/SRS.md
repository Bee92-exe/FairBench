---
title: "FairBench: Lab Equipment Scheduler"
subtitle: "Software Requirements Specification (SRS), version 1.0"
date: "23 November 2026"
---

Based on the case study "Who Gets the Microscope?" and the team requirements file "Lab Equipment Scheduler: Website Requirements". FairBench is a working name.

# 1. Introduction

## 1.1 Purpose
This document defines what FairBench must do and the constraints it must respect. It merges the team's requirement IDs (FR, NFR, AF) with the "Urgent First with Stable Re-plan" scheduling approach, and fixes the technology stack: React, Node.js with Express, and PostgreSQL hosted on Supabase.

## 1.2 Scope
FairBench is a web application for Dr. Haque's university lab. About 20 students share three machines: one microscope, one centrifuge and one slow spectrophotometer. Students submit needs (a window and a duration, not a fixed slot). The system produces a conflict-free schedule with a plain-language reason for every decision. Dr. Haque can overrule it, and the system copes with a machine going out of service.

**Out of scope:** payments, equipment other than the three machines, integration with the university timetable, native mobile apps (a responsive web app is used instead).

## 1.3 Definitions

| Term | Meaning |
|---|---|
| Request | A student's need: machine, duration, window (earliest start, latest finish), fixed or flexible, reason, urgency |
| Booking | A concrete machine and time slot the system (or admin) created for a request |
| Window | The time range in which the request may run |
| Slack | Window length minus duration. Low slack means a tight request |
| Fixed request | Cannot move (sample spoils, submission date). Needs a reason |
| Flexible request | Can happen at any time inside its window |
| Pinned booking | A booking fixed by the admin to an exact machine and time. The scheduler never moves it |
| Outage | A date range during which a machine is unavailable |
| Re-plan | Re-placing only the bookings affected by a change |
| Buffer | Extra minutes reserved after a booking (larger for the spectrophotometer) |
| Preview (What-If) | A dry-run of a change on a copy of the schedule. Nothing is saved until confirmed |

## 1.4 Conventions
Priority codes: **M** = Must (version 1), **S** = Should (version 2), **C** = Could (version 3 or later). Requirement IDs match the team document. IDs FR-38 to FR-45 come from the team's review of the Urgent First process.

# 2. Overall description

## 2.1 Problem summary
Booking is a paper sheet on the lab door. This causes double bookings, arguments and students claiming a whole week. Dr. Haque decides conflicts by remembering who asked him last, and he takes machines for his own research without recording it. Requests are not equal: some cannot move and some runs cannot be interrupted. Machines also break.

## 2.2 Users

| Role | Needs |
|---|---|
| Student | Submit and edit own requests, see own bookings, understand why a slot was given or refused |
| Admin (Dr. Haque) | See everything, override the schedule, reserve own research time, mark machines out of service, manage accounts and settings |
| Visitor (optional) | Read-only view of the schedule, with names hidden or shown by setting |

## 2.3 Operating environment

- Browser-based, responsive (phones and desktops).
- Frontend: React. Backend: Node.js with Express (REST API, JSON). Scheduler: a separate pure module in the backend.
- Database and authentication: PostgreSQL on Supabase (Supabase Auth, Row Level Security, optional Supabase Realtime for live calendar updates).
- All times stored as `timestamptz` in UTC and displayed in the lab's time zone (default Asia/Dhaka).

## 2.4 Assumptions and dependencies

- The three machines are not interchangeable, so a job is never moved to another machine.
- With about 20 users and 3 machines, the whole problem fits in memory and recalculates in seconds.
- Email delivery (version 2) depends on an email service such as Supabase SMTP or Resend. In-app notifications work without it.

## 2.5 Business rules (defaults, all configurable by the admin)
The case leaves these open. The defaults below are proposals to confirm with Dr. Haque and are stored in a settings table, not in code (FR-16).

| Rule | Default |
|---|---|
| Opening hours | 09:00 to 17:00, Sunday to Thursday (change to Monday to Friday if the lab prefers) |
| Slot size | 15 minutes |
| Weekly quota per student | 10 machine hours and 5 open requests |
| Fairness definition | Need first (fixed and tight requests), then least recent usage as a tie-break |
| Spectrophotometer buffer | 20 minutes (microscope and centrifuge: 10 minutes) |
| Started jobs | Frozen. Never bumped by the system or by an override |
| Cancellation | Free up to 12 hours before start. Later cancellations are recorded (credits in version 3) |
| "Next week" | Calendar week (Sunday to Thursday), entered by the student as explicit dates |
| Booking horizon | Requests may be made up to 28 days ahead |

# 3. Functional requirements

## 3.1 Accounts and access

| ID | Requirement | Pri |
|---|---|---|
| FR-01 | Students and the admin log in with separate roles. Only the admin may override, mark outages or change settings. Students may edit only their own requests | M |
| FR-02 | Every request is linked to a named student account | M |
| FR-03 | Admin can add and deactivate student accounts. In version 1 accounts may be created in the Supabase dashboard | S |

## 3.2 Request submission

| ID | Requirement | Pri |
|---|---|---|
| FR-04 | The request form asks for: machine, duration, earliest start, latest finish, reason, urgency and fixed or flexible | M |
| FR-05 | A request is a window plus a duration, never a fixed slot. The system chooses the slot | M |
| FR-06 | The student marks the request as fixed or flexible. A reason is mandatory for fixed requests | M |
| FR-07 | Duration is one continuous block. A job is never split | M |
| FR-08 | Validation rejects: window shorter than duration (plus buffer), dates in the past, times outside opening hours, durations that are not multiples of the slot size, windows beyond the booking horizon | M |
| FR-09 | A student can edit or cancel their own request before it starts. A cancelled slot is freed and offered to waiting requests | S |
| FR-10 | Per-student weekly limit on hours and on open requests. A request over the limit is rejected or trimmed with an explanation | S |

## 3.3 Scheduling engine

| ID | Requirement | Pri |
|---|---|---|
| FR-11 | One machine never has two overlapping bookings (including buffer). Enforced in the database (see NFR-03) | M |
| FR-12 | The least flexible requests (fixed, tight window, near deadline) are scheduled first | M |
| FR-13 | Flexible requests fill the remaining gaps | M |
| FR-14 | Ties are broken by explicit fairness rules, first the student's least recent machine time, then the earlier submission | S |
| FR-15 | The spectrophotometer gets a longer buffer and shows a reliability warning | S |
| FR-16 | Opening hours, slot size, buffers, quotas and score weights are configurable by the admin | S |
| FR-17 | Every request always has one status: scheduled, waiting, could not be placed, cancelled or completed. None disappears silently | M |
| FR-38 | The priority score uses slack and time left to the deadline, and the formula is shown to students | M |
| FR-41 | Priority rises with waiting time, so flexible students are not left at the back forever | S |
| FR-42 | Before a request is marked "could not be placed", the system tries moving one flexible, unstarted booking inside its own window and retries | S |
| FR-44 | Initial scheduling, overrides and outage re-planning all use the same scheduling module | M |
| FR-45 | The scheduler is deterministic: the same inputs always give the same schedule | M |

## 3.4 Explanations and transparency

| ID | Requirement | Pri |
|---|---|---|
| FR-18 | Each booking stores a plain-language reason, for example "Placed Tuesday 14:00: earliest free slot inside your window. You were placed early because you had only two possible days" | M |
| FR-19 | Unplaced requests explain why, for example "Microscope is full Tuesday and Wednesday, your samples expire Thursday, needs Dr. Haque's decision" | M |
| FR-43 | Each unplaced request also shows a suggestion (widen the window, choose another day) | S |
| FR-20 | Everyone can see the schedule. Whether student names are shown or hidden is a setting | S |

## 3.5 Admin override

| ID | Requirement | Pri |
|---|---|---|
| FR-21 | Admin can pin a booking to an exact machine and time. The scheduler treats it as fixed | M |
| FR-22 | Admin can bump or move any student booking that has not started | M |
| FR-23 | Admin can reserve recurring blocks for his own research. They appear on the calendar as "PI reserved" | S |
| FR-24 | Bumped students are automatically re-planned and notified, never dropped | S |
| FR-25 | Every override is written to the audit log (who, what, when, optional note) | M |
| FR-39 | After an override or outage, only affected bookings are re-planned. All other bookings stay unchanged | M |
| FR-40 | Bookings that have already started are frozen and cannot be bumped. If a machine fails mid-run, the admin is alerted | M |

## 3.6 Machine outages

| ID | Requirement | Pri |
|---|---|---|
| FR-26 | Admin can mark a machine out of service for a date range with a note | M |
| FR-27 | Bookings overlapping the outage are found automatically and re-planned | M |
| FR-28 | Bookings not affected by the outage stay unchanged | M |
| FR-29 | Re-planning goes in priority order, deadline-bound jobs first. Jobs are never moved to another machine | M |
| FR-30 | A job that cannot be placed after an outage is flagged to the student and the admin | M |
| FR-31 | When a machine is repaired early, the admin can end the outage and freed slots are offered to waiting requests in score order | C |

## 3.7 Notifications

| ID | Requirement | Pri |
|---|---|---|
| FR-32 | Students are notified (in-app, and email in version 2) when a booking is made, moved, bumped or cancelled. Several changes in one action are grouped into one message | S |
| FR-33 | Admin is alerted when a request cannot be placed or an outage affects bookings | S |

## 3.8 Views and reports

| ID | Requirement | Pri |
|---|---|---|
| FR-34 | Calendar per machine, with day and week views | M |
| FR-35 | "My bookings" page for each student, with status and reason | M |
| FR-36 | Admin dashboard: pending requests, unplaced requests, active outages, recent overrides | S |
| FR-37 | Usage report per student and per machine | C |

# 4. Advanced features (differentiators)
Each feature solves a real pain point in the case. Release plan: What-If and Priority Score in version 2, Check-In, Adaptive Buffer and Time Bank in version 3, and Waitlist and Swaps in version 4.

## 4.1 What-If impact preview (version 2)

| ID | Requirement | Pri |
|---|---|---|
| AF-01 | Every admin action (pin, bump, outage) first runs as a simulation on a copy of the schedule. Nothing is saved until Confirm. Cancel leaves the schedule untouched | S |
| AF-02 | The preview lists affected students, old slot, new slot and a risk flag for any deadline-bound job | S |
| AF-03 | The admin can add a note to the confirmation, which is sent to affected students | S |
| AF-04 | For outages the admin can compare scenarios side by side (for example 3 days against 7 days) | C |

## 4.2 Explainable priority score (version 2)

| ID | Requirement | Pri |
|---|---|---|
| AF-05 | Score = weighted sum of deadline pressure, window tightness, student's recent usage and waiting time | S |
| AF-06 | Weights are editable by the admin on a settings page | S |
| AF-07 | Each student sees the score breakdown and a plain sentence on how to improve it ("widen your window by one day") | S |
| AF-08 | The admin can review the reason behind any fixed deadline claim and reject it | S |

## 4.3 Time Bank: fairness credits (version 3)

| ID | Requirement | Pri |
|---|---|---|
| AF-09 | Credits are earned for cancelling more than a set time before the booking (default 12 hours) | C |
| AF-10 | Credits are lost for no-shows and for repeated book-then-cancel behaviour | C |
| AF-11 | The balance and its history are shown on the student's page | C |
| AF-12 | The admin can adjust credits manually with a recorded reason | C |
| AF-13 | Credits never outrank a fixed-deadline request. They only act as a tie-break | C |

## 4.4 Machine check-in with automatic no-show release (version 3)

| ID | Requirement | Pri |
|---|---|---|
| AF-14 | Each machine has a unique QR code that opens a check-in page for the current booking | C |
| AF-15 | Configurable grace period (default 15 minutes). After it the booking is released and a no-show is recorded | C |
| AF-16 | Released time is offered first to the waitlist, then to flexible requests | C |
| AF-17 | Check-out records the real end time so overruns are visible | C |

## 4.5 Adaptive buffer for the spectrophotometer (version 3)

| ID | Requirement | Pri |
|---|---|---|
| AF-18 | Track the difference between booked and actual duration per machine | C |
| AF-19 | Suggest a new buffer (for example the 80th percentile of past overruns) for admin approval | C |
| AF-20 | Show a machine health indicator (green, amber, red) from overruns and fault reports | C |
| AF-21 | Students can report a fault in two taps. Repeated reports raise an alert to the admin | C |

## 4.6 Waitlist with auto-promotion and slot swaps (version 4)

| ID | Requirement | Pri |
|---|---|---|
| AF-22 | A freed slot is matched against the waitlist by score, window and duration | C |
| AF-23 | A promoted student has a short time to accept (default 2 hours) before the offer passes to the next | C |
| AF-24 | Two students can swap bookings with mutual consent. The system validates windows and deadlines with the same rules | C |

# 5. Scheduling algorithm: Urgent First with Stable Re-plan

## 5.1 Inputs and outputs

- **Inputs:** open requests, existing bookings, outages, settings (hours, slot size, buffers, weights), current time.
- **Output:** a list of placements (request, machine, start, end, reason) and a list of unplaced requests (reason, suggestion). The module is a pure function with no database access, so it can be unit tested and run on a copy for previews.

## 5.2 Step by step

1. **Collect** all requests that need a slot, plus the current state.
2. **Lock first.** Pinned bookings (including the admin's reservations) and started bookings are placed and never move.
3. **Remove unavailable time.** Cut outages and closed hours from each machine's calendar.
4. **Score** each request (section 5.3).
5. **Sort** by: fixed before flexible, score high to low, nearer deadline, earlier submission, then request ID. The final ID step makes the result deterministic (FR-45).
6. **Place** each request in the earliest continuous free block inside its window on its own machine, with duration plus buffer on the slot grid.
7. **Repair.** If nothing fits, try moving one flexible, unstarted booking to another time inside its own window, then retry once (FR-42).
8. **Report.** If it still does not fit, mark it "could not be placed" with a reason and a suggestion, and alert the admin if a fixed deadline is at risk.
9. **Explain.** Store a one-line reason for every result.

## 5.3 Priority score (default formula)
Each factor is scaled to 0 to 100 and combined with admin-editable weights.

> **Score = 0.40 × deadline pressure + 0.25 × tightness + 0.15 × waiting time + 0.20 × fairness**

| Factor | Definition |
|---|---|
| Deadline pressure | Higher when fewer hours remain until the deadline (zero when more than 7 days remain) |
| Tightness | 1 minus slack divided by window length |
| Waiting time | Grows with the hours since submission (FR-41) |
| Fairness | Higher for students with less machine time in the last 14 days. Used as a tie-break only, and never outranks a fixed request (AF-13) |

Version 1 uses deadline pressure and tightness only. Waiting time and fairness are switched on in version 2.

## 5.4 Stable re-plan

- **Override:** the pinned slot is saved, and only unpinned, unstarted bookings that overlap it are re-planned through steps 3 to 9.
- **Outage:** only unstarted bookings on that machine inside the outage period are re-planned, in score order. Bookings already running stay and are flagged to the admin for a human decision.
- **Cancellation or early repair:** freed time is offered to waiting requests in score order.
- Every re-plan runs inside a single database transaction. If anything fails, the transaction rolls back and no booking is lost (NFR-05).

## 5.5 Worked example
The microscope is open 09:00 to 17:00. Request C needs 4 hours on Tuesday only (very small slack), request A needs 3 hours on Tuesday or Wednesday with samples expiring Thursday, and request D is a flexible 1-hour run any day. The order is C, A, D. If Dr. Haque then pins Wednesday morning, only the bookings overlapping it are re-planned. D moves, and A and C are untouched.

# 6. Data model (PostgreSQL on Supabase)

## 6.1 Tables

| Table | Main columns |
|---|---|
| profiles | id (= auth.users.id), name, email, role (student, admin), active |
| machines | id, name, status, buffer_minutes |
| requests | id, student_id, machine_id, duration_min, window_start, window_end, is_fixed, reason, urgency, status, created_at |
| bookings | id, request_id, machine_id, start_at, end_at, occupied_until, pinned, set_by (system, admin), status, reason, started_at |
| outages | id, machine_id, start_at, end_at, note, created_by |
| audit_log | id, actor_id, action, details (jsonb), created_at |
| settings | key, value (jsonb): hours, slot size, quotas, weights |
| notifications | id, user_id, message, read, created_at |

Version 3 and 4 tables (not created in version 1): credit_ledger, checkins, fault_reports, waitlist_offers, swap_proposals.

## 6.2 Database-level protection against double booking (NFR-03)
Two students submitting at the same moment must never both succeed, so the rule lives in PostgreSQL itself:

```sql
create extension if not exists btree_gist;

create table bookings (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references requests(id),
  machine_id uuid not null references machines(id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  occupied_until timestamptz not null,      -- end_at + buffer
  pinned boolean not null default false,
  set_by text not null default 'system',
  status text not null default 'active',
  reason text,
  started_at timestamptz,
  check (end_at > start_at and occupied_until >= end_at),
  exclude using gist (
    machine_id with =,
    tstzrange(start_at, occupied_until) with &&
  ) where (status = 'active')
);
```

Any insert that overlaps an active booking on the same machine fails with an exclusion violation, and the backend turns it into a friendly message. A re-plan also takes `pg_advisory_xact_lock` so two re-plans cannot run at once.

## 6.3 Security on Supabase

- Authentication through Supabase Auth, which stores passwords securely (NFR-04). The role is read from the `profiles` table.
- Row Level Security on every table: students read the schedule, but write only their own requests. Only admins write bookings, outages, settings and the audit log.
- The Express server verifies the user's Supabase JWT and checks the role on every admin route. The service-role key stays on the server and is never sent to the browser.

# 7. System architecture

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React (Vite), responsive CSS, a calendar component | Pages in section 8 |
| API | Node.js with Express | REST routes: /requests, /bookings, /machines, /outages, /preview, /audit, /settings |
| Scheduler | `scheduler.js`, a pure module | Called by the API for real runs and for previews |
| Database | PostgreSQL on Supabase | Exclusion constraint, RLS, daily backups |
| Auth | Supabase Auth | Student and admin roles |
| Notifications | Table plus Supabase Realtime in version 1, email in version 2 | |

**Preview flow (AF-01):** the API loads the current state, applies the proposed change to an in-memory copy, runs the scheduler, and returns a before/after diff. Only on Confirm does it repeat the change inside a transaction and write the audit log.

# 8. Screens

| Screen | Role | Content |
|---|---|---|
| Login | All | Supabase Auth login |
| Request form | Student | Fields from FR-04 with live validation |
| My bookings | Student | Own requests, status, reason, notices of moves (FR-35) |
| Lab calendar | Everyone | Three machines, day and week views, colours for student, PI reserved and outage blocks (FR-34) |
| Admin: override | Admin | Pin or bump a booking, preview, confirm with note |
| Admin: machines | Admin | Mark out of service, view preview, end outage |
| Admin: needs attention | Admin | Unplaced requests with reasons |
| Admin: dashboard and history | Admin | Overview, audit log (FR-36, FR-25) |
| Admin: settings | Admin | Hours, slot size, buffers, quotas, weights (version 2) |

# 9. External interfaces and constraints

- **User interface:** works from 360 px wide phones up to desktop. Times shown in the lab time zone with an unambiguous date format (for example 24 Nov 2026, 14:00).
- **Software interfaces:** Supabase (PostgreSQL, Auth, Realtime), optional email provider.
- **Constraints:** the scheduler contains no hard-coded lab rules. Every rule comes from the settings table.

# 10. Non-functional requirements

| ID | Requirement | Pri |
|---|---|---|
| NFR-01 | Simple, clean interface that works on phones. A request can be submitted in under one minute | M |
| NFR-02 | A full schedule recalculation finishes within 3 seconds for 20 students and 100 open requests | M |
| NFR-03 | Double booking is prevented by the database exclusion constraint, not only in the interface | M |
| NFR-04 | Passwords are stored securely by Supabase Auth. Role checks are enforced on the server and by RLS | M |
| NFR-05 | Daily database backups. Re-planning is transactional, so no booking is lost | M |
| NFR-06 | Scheduling rules are easy to explain and change (weights and rules live in settings) | S |
| NFR-07 | Times are shown in the lab time zone and stored in UTC | M |
| NFR-08 | Scheduler logic is covered by automated unit tests for every acceptance test in section 11 | M |
| NFR-09 | All admin actions are auditable. No audit entries can be edited or deleted by the application | M |

# 11. Acceptance tests

| ID | Scenario | Expected result |
|---|---|---|
| AT-01 | Two students request the same machine with overlapping windows | No overlap in the result |
| AT-02 | "Microscope Tuesday or Wednesday, 3 hours, samples expire Thursday" | Placed as one continuous block before Thursday |
| AT-03 | A flexible 20-minute centrifuge request is added | It fills a gap without displacing the urgent request |
| AT-04 | A student asks for an entire week | Rejected or trimmed with a reason |
| AT-05 | Admin pins a slot over a student booking | The student is re-planned and notified |
| AT-06 | Centrifuge marked out for a week | Only affected bookings move, urgent ones first. Others are identical before and after |
| AT-07 | Impossible request (window shorter than duration) | Rejected with a clear reason |
| AT-08 | A 3-hour job on a day with only 1-hour gaps | Not split. Reported as unplaced with a suggestion |
| AT-09 | Any override or outage | Appears in the audit log |
| AT-10 | A flexible request waits through several re-plans | Gains priority and is eventually placed |
| AT-11 | A request that only fits after moving one flexible booking | Placed, not rejected |
| AT-12 | A running booking and an override over it | The running booking is never bumped. Admin sees a warning |
| AT-13 | The same requests entered twice | Identical schedule both times |
| AT-14 | A job with a sample that expires Thursday cannot fit | Never silently pushed past Thursday. Flagged to the admin |
| AT-15 | Two insert attempts for the same slot at the same moment | One succeeds, one is rejected by the database |
| AT-16 | A student tries to call an admin route | Rejected with an authorisation error |

# 12. Traceability: case problems to requirements

| Problem in the case | Requirements |
|---|---|
| Double bookings | FR-11, NFR-03 |
| Arguments | FR-12, FR-14, FR-18, FR-19, FR-20, AF-07 |
| Students claiming a whole week | FR-05, FR-10 |
| Some requests cannot move, others can | FR-06, FR-12, FR-13 |
| Runs cannot be interrupted | FR-07, FR-40 |
| Equipment breaks | FR-26 to FR-31, FR-39 |
| Dr. Haque takes machines informally | FR-21, FR-23, FR-25, AF-01 |
| Decisions by who asked last | FR-12, FR-14, FR-38, AF-05 |
| Dr. Haque must be able to overrule | FR-21, FR-22, FR-24, FR-25 |
| Slow spectrophotometer | FR-15, AF-18 to AF-20 |

# 13. Release plan

| Version | Contents |
|---|---|
| 1 (core) | All **M** requirements: login, request form, scheduler, explanations, pin and bump, outages, calendar, My bookings |
| 2 | **S** requirements, plus What-If preview (AF-01 to AF-03) and Priority Score (AF-05 to AF-08) |
| 3 | Check-In, Adaptive Buffer, Time Bank (AF-09 to AF-21), FR-31, FR-37 |
| 4 | Waitlist and swaps (AF-22 to AF-24) |

For the university deadline, version 1 plus the What-If preview from version 2 gives a strong demo of the four things the case demands.

# 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Students go back to the paper sheet | Remove the sheet on launch day, give a short demo, keep the form under a minute |
| Dr. Haque keeps overriding informally | Audit log, What-If preview, PI reservations visible on the calendar |
| Students mark everything urgent | Mandatory reason for fixed requests, admin review (AF-08), weekly quota |
| Scheduler places jobs badly | Test with section 11, show explanations, admin can correct |
| Long outage leaves jobs with no slot | Flag early (FR-30), scenario comparison (AF-04) |
| Too many notifications | Group changes into one message |
| Greedy method misses a valid schedule | Repair step (FR-42). A constraint solver is a possible later upgrade for the repair step only |

# 15. Success measures

| Measure | Target |
|---|---|
| Double bookings | Zero |
| Requests placed within their window | At least 90 percent |
| Deadline-bound requests | 100 percent placed, or flagged to the admin within one minute |
| Machine idle time caused by no-shows | Reduced by at least half after check-in launches |
| Admin overrides with a recorded note | 100 percent |

# 16. Open questions for Dr. Haque

1. Working days and hours (Sunday to Thursday, or Monday to Friday; 09:00 to 17:00?).
2. Weekly quota per student, and whether names are visible to everyone.
3. Spectrophotometer buffer (20 minutes is a guess).
4. Late cancellation rule and who receives a freed slot.
5. Whether the admin must approve fixed deadline claims before they count, or only review them afterwards.
