# API_SPEC: REST contract

Owner: **Aranno** (routes, auth). Sirat owns `settings`, `notifications`, `health`. Sabbir owns the services behind the routes. This file is the contract between frontend and backend. Change it only through `HANDOFF_LOG.md`.

## 1. Conventions

- Base URL: `/api`. JSON in and out. Times are ISO 8601 UTC strings (`2026-11-24T04:00:00Z`).
- Auth: `Authorization: Bearer <Supabase access token>` on every route except `GET /api/health`.
- Roles: `student`, `admin`. Visitor mode uses the public calendar route only if enabled.
- Error format (all routes):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Window is shorter than duration", "details": [ { "field": "windowEnd", "message": "..." } ] } }
```

Codes are listed in `SYSTEM_DESIGN.md` section 7.

## 2. Request validation rules (FR-08)

| Field | Rule |
|---|---|
| `machineId` | Must exist. Machine must not be out of service for the whole window |
| `durationMin` | Positive multiple of `slot_minutes` (default 15), maximum one opening day |
| `windowStart` | Not in the past, within `booking_horizon_days` |
| `windowEnd` | After `windowStart`. Window must contain at least `durationMin + buffer` minutes of opening hours |
| `isFixed` | Boolean. If true, `reason` is required (at least 5 characters) |
| `urgency` | Integer 1 to 5 |
| Quota | Open requests and weekly hours within `quota` setting (422 `QUOTA_EXCEEDED`) |

## 3. Student routes

| Method and path | Owner | Auth | Purpose | FR |
|---|---|---|---|---|
| `GET /api/me` | Aranno | any | Current profile and role | FR-01 |
| `GET /api/machines` | Aranno | any | Machines with status, buffer, current outage | FR-34 |
| `POST /api/requests` | Aranno | student | Submit a request, returns request and booking or unplaced reason | FR-04 to FR-08 |
| `GET /api/requests/mine` | Aranno | student | Own requests with status, reason, booking, score | FR-35 |
| `PATCH /api/requests/:id` | Aranno | student (owner) | Edit before start | FR-09 |
| `POST /api/requests/:id/cancel` | Aranno | student (owner) | Cancel and free the slot | FR-09 |
| `GET /api/schedule?machineId=&from=&to=` | Aranno | any | Calendar blocks for a machine and date range | FR-34 |
| `GET /api/bookings/mine` | Aranno | student | Own bookings | FR-35 |
| `GET /api/settings` | Sirat | any | Public settings (hours, slot size, timezone, show_names, quota) | FR-16 |
| `GET /api/notifications` | Sirat | any | Own notifications, newest first, `?unread=true` | FR-32 |
| `POST /api/notifications/:id/read` | Sirat | any | Mark one read | FR-32 |
| `POST /api/notifications/read-all` | Sirat | any | Mark all read | FR-32 |
| `GET /api/health` | Sirat | none | `{ "status": "ok", "db": true, "version": "1.0.0" }` | Ops |

### POST /api/requests

Request:

```json
{
  "machineId": "uuid",
  "durationMin": 180,
  "windowStart": "2026-11-24T03:00:00Z",
  "windowEnd": "2026-11-25T11:00:00Z",
  "isFixed": true,
  "reason": "Samples expire Thursday",
  "urgency": 5
}
```

Response `201` (placed):

```json
{
  "request": { "id": "uuid", "status": "scheduled", "score": 78.5,
               "scoreBreakdown": { "deadline": 40, "tightness": 25, "waiting": 0, "fairness": 0 } },
  "booking": { "id": "uuid", "machineId": "uuid",
               "start": "2026-11-24T04:00:00Z", "end": "2026-11-24T07:00:00Z",
               "reason": "Placed Tuesday 10:00: earliest free slot inside your window. You were placed early because you had only two possible days" }
}
```

Response `201` (not placed):

```json
{
  "request": { "id": "uuid", "status": "unplaced",
               "unplacedReason": "Microscope is full on Tuesday and Wednesday. Your samples expire Thursday, so Dr. Haque needs to decide",
               "suggestion": "Widen your window by one day or choose a shorter run" },
  "booking": null
}
```

### GET /api/schedule

```json
{
  "machineId": "uuid",
  "blocks": [
    { "id": "uuid", "kind": "student", "label": "Rahim", "start": "...", "end": "...", "occupiedUntil": "..." },
    { "id": "uuid", "kind": "pi_reserved", "label": "PI reserved", "start": "...", "end": "..." }
  ],
  "outages": [ { "id": "uuid", "start": "...", "end": "...", "note": "Rotor replacement" } ]
}
```

`label` is `null` for students when `show_names` is false (admins always see names).

## 4. Admin routes (all require role `admin`)

| Method and path | Owner | Purpose | FR |
|---|---|---|---|
| `POST /api/admin/changes/preview` | Aranno | Dry-run of a change. Nothing saved | AF-01, AF-02 |
| `POST /api/admin/changes/apply` | Aranno | Apply a change with optional note | FR-21 to FR-30 |
| `GET /api/admin/requests?status=` | Aranno | All requests, filterable | FR-36 |
| `GET /api/admin/outages` | Aranno | Active and past outages | FR-26 |
| `GET /api/admin/attention` | Aranno | Unplaced, deadline risk, running-booking warnings | FR-19, FR-30 |
| `GET /api/admin/dashboard` | Aranno | Pending, unplaced, active outages, recent overrides | FR-36 |
| `GET /api/admin/audit?limit=&before=` | Aranno | Audit log pages | FR-25 |
| `GET /api/admin/users` | Aranno | List accounts | FR-03 |
| `POST /api/admin/users` | Aranno | Create student account (Supabase admin API) | FR-03 |
| `PATCH /api/admin/users/:id` | Aranno | Deactivate or reactivate | FR-03 |
| `PUT /api/settings` | Sirat | Update settings (admin only) | FR-16, AF-06 |
| `GET /api/reports/usage` (V3) | Sirat | Usage per student and machine | FR-37 |

### Change object (preview and apply)

```json
{ "type": "pin",        "machineId": "uuid", "start": "...", "end": "...", "bookingId": "uuid (optional)", "requestId": "uuid (optional)" }
{ "type": "bump",       "bookingId": "uuid" }
{ "type": "reserve",    "machineId": "uuid", "start": "...", "end": "...", "recurrence": { "freq": "weekly", "count": 8 } }
{ "type": "outage",     "machineId": "uuid", "start": "...", "end": "...", "note": "Rotor replacement" }
{ "type": "end_outage", "outageId": "uuid" }
```

`apply` body: `{ "change": { ... }, "note": "optional note sent to affected students", "previewHash": "from preview" }`.

Preview response shape is in `SYSTEM_DESIGN.md` section 5. `apply` returns `{ "applied": true, "summary": { ... }, "auditId": 123 }` or `409 PREVIEW_STALE` with a new preview.

## 5. Status codes summary

`200` read or update, `201` created, `400` validation, `401` no or bad token, `403` forbidden, `404` not found, `409` conflict (slot taken, stale preview, booking started), `422` quota, `500` internal.

## 6. Mock data rule (for Sirat and Aranno)

Until Sabbir's services are ready, routes and the frontend mock layer return data that follows the shapes above exactly. When real services land, only the implementation changes, never the shape.
