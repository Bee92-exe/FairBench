# FRONTEND_SPEC

Owners: **Sirat** (shared UI, student pages, calendar), **Aranno** (admin pages). Backend contract: `API_SPEC.md`.

## 1. Tech choices

| Need | Choice |
|---|---|
| Build | Vite + React 18 (JavaScript or TypeScript, team decides once) |
| Routing | React Router |
| Server state | TanStack Query (cache, refetch, loading and error states) |
| Auth | `@supabase/supabase-js` for login and session; access token sent to the API |
| Forms | react-hook-form + zod (same rules as `API_SPEC.md` section 2) |
| Styling | Tailwind CSS, mobile first |
| Dates | `date-fns` + `date-fns-tz`, always format in the lab time zone from `/api/settings` |
| Calendar | FullCalendar `timeGrid` (day and week), one tab per machine |
| Realtime | Supabase Realtime on `bookings`, fallback refetch every 30 seconds |
| Mocks | MSW (Mock Service Worker), enabled by `VITE_USE_MOCKS=true` |
| Tests | Vitest + React Testing Library |

## 2. Folder structure

```
frontend/src/
  api/          client.js (fetch wrapper, token, error mapping), hooks per resource
  components/   Button, Modal, Table, Badge, Spinner, EmptyState, ErrorBanner, FormField,
                CalendarView, StatusChip, ReasonText, ScoreBreakdown
  components/admin/   PreviewDiff, OutageForm, PinForm, AttentionCard   (Aranno)
  hooks/        useAuth, useSettings, useNotifications
  lib/          time.js (lab time zone helpers), validation.js, constants.js
  mocks/        handlers.js, fixtures.js
  pages/        Login, RequestForm, MyBookings, LabCalendar, Notifications, NotFound
  pages/admin/  Dashboard, Override, Machines, Attention, History, Users, Settings   (Aranno)
```

## 3. Routes and access

| Route | Page | Role | Owner |
|---|---|---|---|
| `/login` | Login | public | Sirat |
| `/` | Redirect: student to `/my`, admin to `/admin` | any | Sirat |
| `/calendar` | Lab calendar | any, read-only for visitors | Sirat |
| `/request/new` | Request form | student | Sirat |
| `/my` | My bookings | student | Sirat |
| `/notifications` | Inbox | any | Sirat |
| `/admin` | Dashboard | admin | Aranno |
| `/admin/override` | Pin, bump, reserve with preview | admin | Aranno |
| `/admin/machines` | Outages with preview | admin | Aranno |
| `/admin/attention` | Needs attention | admin | Aranno |
| `/admin/history` | Audit log | admin | Aranno |
| `/admin/users` | Accounts | admin | Aranno |
| `/admin/settings` | Settings (V2) | admin | Aranno |

A `RequireRole` wrapper redirects unauthorised users. The server still enforces roles.

## 4. Page specifications

### Request form (FR-04 to FR-08)
Fields: machine (select, shows status and buffer note), duration (select in slot steps, for example 15 min to 8 h), earliest start and latest finish (date-time pickers, lab time), fixed or flexible toggle, reason (required when fixed), urgency (1 to 5).
Behaviour: live validation, message under each field, summary line "This needs {duration} in one continuous block inside this window", spectrophotometer warning "Slow machine: extra {n} minutes are reserved after your run". After submit show either the booking with its reason, or the unplaced explanation with the suggestion and a button to edit the window.

### My bookings (FR-35, FR-18, FR-19)
List of own requests grouped as Upcoming, Needs attention, Past. Each card: machine, time or "not placed", `StatusChip`, plain-language reason, edit and cancel buttons, a "moved" banner when a booking changed (from notifications). V2: `ScoreBreakdown` with the improve sentence.

### Lab calendar (FR-34, FR-20)
Tabs for the three machines. Day and week views. Colours: student booking (blue), PI reserved (purple), outage (grey hatch), your own booking (green outline). Click a block for details. Names show or hide according to `show_names`. Visitors see the same view without login. Legend visible on mobile.

### Notifications (FR-32)
Bell with unread count in the header, inbox page, mark as read, grouped messages with links to the booking.

### Admin: Override (FR-21 to FR-25, AF-01 to AF-03)
Choose pin, bump or reserve. Pick machine and time, or an existing booking. Press **Preview** to open `PreviewDiff`: summary chips (affected, moved, unplaced, at risk), table of students with old and new slot, risk badge for deadline-bound jobs, warnings for running bookings. Optional note, **Confirm** and **Cancel**. Handle `409 PREVIEW_STALE` by showing the refreshed preview.

### Admin: Machines (FR-26 to FR-31)
Machine cards with status. "Mark out of service" form (machine, start, end, note), preview, confirm. Active outages list with "End early" (also previewed).

### Admin: Needs attention (FR-19, FR-30, FR-43)
Cards for each unplaced request: student, machine, window, reason, suggestion, deadline-risk badge, buttons "Pin a slot" and "Contact student".

### Admin: Dashboard and History (FR-25, FR-36)
Counters for pending, unplaced, active outages. Recent overrides. History is an infinite list of audit rows with actor, action, details and note.

## 5. Shared components (Sirat builds, Aranno uses)

| Component | Props |
|---|---|
| `Button` | `variant` (primary, secondary, danger), `loading`, `disabled`, `onClick` |
| `Modal` | `open`, `title`, `onClose`, `children`, `footer` |
| `Table` | `columns`, `rows`, `emptyText` |
| `Badge` / `StatusChip` | `status` (scheduled, unplaced, waiting, cancelled, completed, moved, risk) |
| `CalendarView` | `machineId`, `from`, `to`, `blocks`, `outages`, `onSelect`, `readOnly`, `highlightUserId` |
| `ReasonText` | `text`, `tone` |
| `ScoreBreakdown` | `breakdown`, `weights` |
| `ErrorBanner`, `EmptyState`, `Spinner` | standard |

Document props in a short comment at the top of each file.

## 6. UX and quality rules

1. Mobile first: usable at 360 px wide, touch targets at least 44 px, no horizontal scroll.
2. Every page has loading, empty and error states. Never a blank screen.
3. Show times as `Tue 24 Nov 2026, 10:00` in the lab time zone. Show the zone label on the request form.
4. Plain language everywhere. Show the stored reason text, do not rewrite it.
5. Disable submit buttons while a request is running. Confirm destructive actions.
6. Accessibility: labels on all inputs, focus outline visible, colour is never the only signal (icon or text too), contrast AA.
7. Never store tokens in `localStorage` manually. Use the Supabase session helper.
8. No secrets in the bundle. Only `VITE_` public variables.

## 7. API client rules

- One `api/client.js` (Sirat) adds the Bearer token, parses the standard error format into an `ApiError(code, message, details)`, and redirects to login on `401`.
- One hook per resource (`useMyRequests`, `useSchedule`, `usePreview`...). Invalidate affected queries after mutations.
- Mock handlers in `mocks/` mirror `API_SPEC.md` exactly.
