# PROGRESS

Tick a task only when its tests pass. Each person edits only their own section.

## Sabbir (database + core backend)
- [ ] S-DB-1 Supabase project and extensions
- [ ] S-DB-2 Migrations 001 to 006
- [ ] S-DB-3 RLS and audit immutability
- [ ] S-DB-4 Settings seed and public schedule view
- [ ] S-DB-5 Demo seed
- [ ] S-DB-6 Concurrency proof (AT-15)
- [ ] S-BE-1 Scheduler engine
- [ ] S-BE-2 Repair step
- [ ] S-BE-3 applyPlacements transaction
- [ ] S-BE-4 requestService
- [ ] S-BE-5 overrideService
- [ ] S-BE-6 outageService
- [ ] S-BE-7 previewService
- [ ] S-BE-8 auditService and notificationService
- [ ] S-BE-9 Tests AT-01 to AT-15
- [ ] S-BE-10 Version 2 scoring and scenarios
- [ ] S-BE-11 Version 3 credits, check-in, adaptive buffer

## Aranno (backend API + admin frontend)
- [ ] A-BE-1 Express skeleton
- [ ] A-BE-2 Auth middleware
- [ ] A-BE-3 Student and schedule routes
- [ ] A-BE-4 Admin routes
- [ ] A-BE-5 Supertest suite (AT-16)
- [ ] A-FE-1 Admin layout and guard
- [ ] A-FE-2 Override page with preview
- [ ] A-FE-3 Machines and outage page
- [ ] A-FE-4 Needs-attention page
- [ ] A-FE-5 Dashboard and history
- [ ] A-FE-6 Users page
- [ ] A-FE-7 Settings page and scenarios (version 2)
- [ ] A-FE-8 Health, credits, usage (version 3)

## Sirat (frontend + small backend)
- [x] SI-FE-1 Project setup and layout
- [x] SI-FE-2 Login and session
- [x] SI-FE-3 Mock mode
- [x] SI-FE-4 Request form
- [x] SI-FE-5 My bookings
- [x] SI-FE-6 Lab calendar
- [x] SI-FE-7 Notifications UI
- [x] SI-FE-8 Time utils, states, accessibility
- [x] SI-FE-9 Score breakdown (version 2)
- [ ] SI-FE-10 Check-in, fault report, credits (version 3)
- [x] SI-BE-1 Settings routes
- [x] SI-BE-2 Notifications routes
- [x] SI-BE-3 Health route
- [ ] SI-BE-4 Usage report route (version 3)

## Decisions
| Date | Decision | By |
|---|---|---|
| 2026-11-23 | Built Vite+React 18 frontend with Tailwind CSS, custom lab design system, MSW/in-memory mock DB adhering strictly to API_SPEC. Implemented shared components (Button, Modal, Table, Badge, CalendarView, ReasonText, ScoreBreakdown), student pages (Login, MyBookings, RequestForm, LabCalendar, Notifications), and Sirat backend routes (settings, notifications, health). | Sirat |
