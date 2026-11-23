-- FairBench schema (S-DB-2, FR-11, NFR-03)
-- Owner: Sabbir. Applied once, in order, via database/migrate.js.
-- Conventions: uuid keys, timestamptz (UTC), text + check instead of enums.

create extension if not exists btree_gist;

-- Profiles: one row per auth user
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null default 'student' check (role in ('student','admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table machines (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  status text not null default 'working' check (status in ('working','out_of_service')),
  buffer_minutes int not null default 10 check (buffer_minutes >= 0),
  reliability_note text,
  created_at timestamptz not null default now()
);

create table requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id),
  machine_id uuid not null references machines(id),
  duration_min int not null check (duration_min > 0),
  window_start timestamptz not null,
  window_end timestamptz not null,
  is_fixed boolean not null default false,
  reason text,
  urgency smallint not null default 3 check (urgency between 1 and 5),
  status text not null default 'pending'
    check (status in ('pending','scheduled','waiting','unplaced','cancelled','completed')),
  score numeric,
  score_breakdown jsonb,
  unplaced_reason text,
  suggestion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (window_end > window_start),
  check (window_end - window_start >= duration_min * interval '1 minute'),
  check (not is_fixed or length(btrim(coalesce(reason, ''))) > 0)   -- FR-06
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references requests(id),
  machine_id uuid not null references machines(id),
  kind text not null default 'student' check (kind in ('student','pi_reserved')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  occupied_until timestamptz not null,               -- end_at + buffer
  pinned boolean not null default false,
  set_by text not null default 'system' check (set_by in ('system','admin')),
  status text not null default 'active'
    check (status in ('active','cancelled','superseded','completed')),
  reason text,
  note text,
  started_at timestamptz,
  actual_end timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check (end_at > start_at),
  check (occupied_until >= end_at),
  check ((kind = 'student' and request_id is not null)
      or (kind = 'pi_reserved' and request_id is null)),
  -- NFR-03: no overlapping active bookings on one machine
  constraint no_double_booking exclude using gist (
    machine_id with =,
    tstzrange(start_at, occupied_until) with &&
  ) where (status = 'active')
);

create table outages (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references machines(id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  note text,
  ended_early_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

create table audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references profiles(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

create table settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  message text not null,
  data jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
