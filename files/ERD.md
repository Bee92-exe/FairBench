# ERD: FairBench entity relationship diagram

Database: PostgreSQL on Supabase. Full SQL is in `DATABASE.md`. Owner: Sabbir.

## 1. Version 1 entities

```mermaid
erDiagram
    PROFILES ||--o{ REQUESTS : submits
    MACHINES ||--o{ REQUESTS : "is requested on"
    REQUESTS ||--o| BOOKINGS : "is placed as"
    MACHINES ||--o{ BOOKINGS : hosts
    MACHINES ||--o{ OUTAGES : "has downtime"
    PROFILES ||--o{ OUTAGES : creates
    PROFILES ||--o{ AUDIT_LOG : "acts in"
    PROFILES ||--o{ NOTIFICATIONS : receives
    PROFILES ||--o{ BOOKINGS : "reserves (PI)"

    PROFILES {
        uuid id PK "= auth.users.id"
        text full_name
        text email UK
        text role "student | admin"
        boolean active
        timestamptz created_at
    }
    MACHINES {
        uuid id PK
        text name UK
        text status "working | out_of_service"
        int buffer_minutes
        text reliability_note
    }
    REQUESTS {
        uuid id PK
        uuid student_id FK
        uuid machine_id FK
        int duration_min
        timestamptz window_start
        timestamptz window_end
        boolean is_fixed
        text reason
        smallint urgency
        text status "pending | scheduled | waiting | unplaced | cancelled | completed"
        numeric score
        jsonb score_breakdown
        text unplaced_reason
        text suggestion
        timestamptz created_at
    }
    BOOKINGS {
        uuid id PK
        uuid request_id FK "null for PI reservation"
        uuid machine_id FK
        text kind "student | pi_reserved"
        timestamptz start_at
        timestamptz end_at
        timestamptz occupied_until "end + buffer"
        boolean pinned
        text set_by "system | admin"
        text status "active | cancelled | superseded | completed"
        text reason
        timestamptz started_at
        timestamptz actual_end
        uuid created_by FK
    }
    OUTAGES {
        uuid id PK
        uuid machine_id FK
        timestamptz start_at
        timestamptz end_at
        text note
        timestamptz ended_early_at
        uuid created_by FK
    }
    AUDIT_LOG {
        bigint id PK
        uuid actor_id FK
        text action
        text entity_type
        uuid entity_id
        jsonb details
        text note
        timestamptz created_at
    }
    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        text type
        text message
        jsonb data
        boolean read
        timestamptz created_at
    }
    SETTINGS {
        text key PK
        jsonb value
        uuid updated_by FK
        timestamptz updated_at
    }
```

`SETTINGS` is a standalone key-value table (hours, slot size, quotas, weights, time zone).

## 2. Later versions (V3 and V4)

```mermaid
erDiagram
    PROFILES ||--o{ CREDIT_LEDGER : earns
    BOOKINGS ||--o{ CHECKINS : "checked in by"
    MACHINES ||--o{ FAULT_REPORTS : "reported on"
    PROFILES ||--o{ FAULT_REPORTS : files
    REQUESTS ||--o{ WAITLIST_OFFERS : "offered slot"
    BOOKINGS ||--o{ SWAP_PROPOSALS : "swap from"

    CREDIT_LEDGER {
        uuid id PK
        uuid student_id FK
        int delta
        text reason
        uuid booking_id FK
        uuid adjusted_by FK
        timestamptz created_at
    }
    CHECKINS {
        uuid id PK
        uuid booking_id FK
        timestamptz checked_in_at
        timestamptz checked_out_at
    }
    FAULT_REPORTS {
        uuid id PK
        uuid machine_id FK
        uuid reported_by FK
        text note
        timestamptz created_at
    }
    WAITLIST_OFFERS {
        uuid id PK
        uuid request_id FK
        timestamptz slot_start
        timestamptz slot_end
        timestamptz expires_at
        text status "offered | accepted | expired"
    }
    SWAP_PROPOSALS {
        uuid id PK
        uuid booking_a FK
        uuid booking_b FK
        text status "proposed | accepted | rejected"
        timestamptz created_at
    }
```

## 3. Relationship rules

| Rule | How it is enforced |
|---|---|
| A request has at most one active booking | Unique index on `bookings(request_id)` where `status = 'active'` |
| No two active bookings overlap on one machine | `EXCLUDE USING gist` on `(machine_id, tstzrange(start_at, occupied_until))` |
| PI reservations have no request | `request_id` is null and `kind = 'pi_reserved'` |
| A fixed request must have a reason | Check constraint on `requests` |
| Audit rows cannot be changed | Trigger blocks update and delete |
| Only admins write bookings, outages, settings | RLS plus server role check |
