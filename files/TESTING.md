# TESTING: test plan

Goal: prove every acceptance test in `SRS.md` section 11 and protect the scheduler from regressions (NFR-08).

## 1. Test levels

| Level | Tool | Scope | Owner |
|---|---|---|---|
| Unit: scheduler | Vitest (or Jest) | `backend/src/scheduler/` pure functions | Sabbir |
| Unit: services | Vitest with a test database | Service workflows and transactions | Sabbir |
| Integration: API | Supertest against the Express app and a test Supabase project or local Supabase | Routes, auth, validation, errors | Aranno (settings, notifications, health: Sirat) |
| Database | SQL and Node scripts | Constraints, RLS, audit trigger, concurrency | Sabbir |
| Frontend component | Vitest + React Testing Library | Forms, validation, status display | Sirat (admin components: Aranno) |
| Manual end-to-end | Checklist below | Full demo story | All |

Use a separate Supabase project (or schema) for tests. Never run tests against the demo data.

## 2. Acceptance tests mapped to code

| AT | Scenario | Level | File (suggested) | Owner |
|---|---|---|---|---|
| AT-01 | Overlapping requests, no overlap in result | Unit | `scheduler/overlap.test.js` | Sabbir |
| AT-02 | Tue or Wed, 3 hours, deadline Thursday | Unit | `scheduler/case-microscope.test.js` | Sabbir |
| AT-03 | Flexible 20-minute run fills a gap | Unit | `scheduler/fill-gaps.test.js` | Sabbir |
| AT-04 | Whole week rejected or trimmed | Integration | `api/requests.validation.test.js` | Aranno |
| AT-05 | Pin over a booking, student re-planned and notified | Service | `services/override.test.js` | Sabbir |
| AT-06 | Week outage, only affected move, urgent first | Service | `services/outage.test.js` | Sabbir |
| AT-07 | Impossible request rejected with reason | Integration | `api/requests.validation.test.js` | Aranno |
| AT-08 | 3-hour job with only 1-hour gaps, not split | Unit | `scheduler/no-split.test.js` | Sabbir |
| AT-09 | Override and outage appear in audit log | Service | `services/audit.test.js` | Sabbir |
| AT-10 | Waiting request gains priority | Unit | `scheduler/waiting.test.js` | Sabbir |
| AT-11 | Request fits only after repair move | Unit | `scheduler/repair.test.js` | Sabbir |
| AT-12 | Running booking never bumped | Service | `services/frozen.test.js` | Sabbir |
| AT-13 | Same input twice gives same schedule | Unit | `scheduler/determinism.test.js` | Sabbir |
| AT-14 | Expiring job never silently pushed past deadline | Unit and service | `scheduler/deadline-risk.test.js` | Sabbir |
| AT-15 | Simultaneous inserts, one fails | Database | `database/concurrency.test.js` | Sabbir |
| AT-16 | Student calls admin route, rejected | Integration | `api/authz.test.js` | Aranno |

## 3. Fixtures

A shared fixture file `backend/tests/fixtures.js` builds: three machines with buffers 10, 10, 20; opening hours Sunday to Thursday 09:00 to 17:00; slot size 15; a fixed `now` (for example Sunday 22 Nov 2026 09:00 lab time); helper `makeRequest(overrides)`. Tests never read the real clock.

## 4. Scheduler test checklist (S-BE-9)

- [ ] Output never contains two overlapping blocks on one machine (property test with 200 random request sets)
- [ ] Every start and end sits on the slot grid
- [ ] Every placement inside its window and opening hours
- [ ] Buffer respected between bookings
- [ ] Outage time never used
- [ ] Locked and started bookings unchanged after replan
- [ ] Bookings outside the affected set identical before and after (AT-06)
- [ ] 100 requests solved in under 3 seconds (NFR-02)

## 5. Manual end-to-end demo checklist

1. Log in as a student. Submit the two case-study requests. See booking, reason and the calendar.
2. Submit a request for an entire week. See rejection or trimming with a reason.
3. Submit a 3-hour request on a day with only 1-hour gaps. See it unplaced with a suggestion.
4. Log in as Dr. Haque. Pin a microscope slot over a student booking. Check the preview, confirm with a note. See the student's new slot and the notification.
5. Mark the centrifuge out of service for a week. Check the preview, confirm. See only affected bookings move and an unplaced one in Needs attention.
6. Open History and confirm both actions are logged.
7. Open the calendar on a 360 px wide phone viewport. Check nothing scrolls sideways.

## 6. CI (suggested)

On every pull request: install, lint, `npm test` in `backend/` and `frontend/`. Block merge on failure. Run the concurrency test manually before each milestone.

## 7. Coverage targets

Scheduler 90 percent lines, services 80 percent, routes 70 percent. Coverage is a guide, the acceptance tests are the real gate.
