# DATABASE: PostgreSQL schema for Supabase

Owner: **Sabbir**. Put these as numbered files in `database/migrations/`. Never edit an applied migration; add a new one.

Conventions: `uuid` primary keys, `timestamptz` (UTC) for all times, text columns with `check` constraints instead of enums (easier to change).

## 001_schema.sql

```sql
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
```

## 002_indexes_triggers.sql

```sql
create index idx_requests_student on requests(student_id, status);
create index idx_requests_machine_status on requests(machine_id, status);
create index idx_bookings_machine_time on bookings(machine_id, start_at) where status = 'active';
create index idx_outages_machine_time on outages(machine_id, start_at, end_at);
create index idx_notifications_user on notifications(user_id, read, created_at desc);
create index idx_audit_created on audit_log(created_at desc);

-- A request has at most one active booking
create unique index uq_active_booking_per_request
  on bookings(request_id) where status = 'active' and request_id is not null;

-- updated_at
create function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger trg_requests_updated before update on requests
  for each row execute function set_updated_at();
create trigger trg_settings_updated before update on settings
  for each row execute function set_updated_at();

-- NFR-09: audit log is append-only
create function block_audit_change() returns trigger language plpgsql as $$
begin raise exception 'audit_log is append-only'; end $$;
create trigger trg_audit_no_update before update or delete on audit_log
  for each row execute function block_audit_change();

-- Create a profile automatically when an auth user is created
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
          new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
```

Make Dr. Haque an admin manually: `update profiles set role = 'admin' where email = 'drhaque@...';`

## 003_rls.sql

The Express backend uses the service-role key, which bypasses RLS. These policies protect direct calls made with the anon key.

```sql
create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles
                 where id = auth.uid() and role = 'admin' and active)
$$;

alter table profiles      enable row level security;
alter table machines      enable row level security;
alter table requests      enable row level security;
alter table bookings      enable row level security;
alter table outages       enable row level security;
alter table audit_log     enable row level security;
alter table settings      enable row level security;
alter table notifications enable row level security;

-- profiles
create policy profiles_select on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_admin_write on profiles for all using (is_admin()) with check (is_admin());

-- machines, outages, settings: everyone signed in can read, admin writes
create policy machines_read on machines for select to authenticated using (true);
create policy machines_admin on machines for all using (is_admin()) with check (is_admin());
create policy outages_read on outages for select to authenticated using (true);
create policy outages_admin on outages for all using (is_admin()) with check (is_admin());
create policy settings_read on settings for select to authenticated using (true);
create policy settings_admin on settings for all using (is_admin()) with check (is_admin());

-- requests: students see and edit only their own
create policy requests_select on requests for select using (student_id = auth.uid() or is_admin());
create policy requests_insert on requests for insert with check (student_id = auth.uid());
create policy requests_update on requests for update
  using (student_id = auth.uid() and status in ('pending','scheduled','waiting','unplaced'))
  with check (student_id = auth.uid());
create policy requests_admin on requests for all using (is_admin()) with check (is_admin());

-- bookings: readable by signed-in users (names are hidden through the view), admin writes
create policy bookings_read on bookings for select to authenticated using (true);
create policy bookings_admin on bookings for all using (is_admin()) with check (is_admin());

-- audit: admin reads only. Inserts come from the backend (service role)
create policy audit_admin_read on audit_log for select using (is_admin());

-- notifications: own only
create policy notif_select on notifications for select using (user_id = auth.uid());
create policy notif_update on notifications for update using (user_id = auth.uid());
```

## 004_settings_seed.sql

```sql
insert into settings (key, value) values
  ('timezone',             '"Asia/Dhaka"'),
  ('opening_hours',        '{"days":[0,1,2,3,4],"start":"09:00","end":"17:00"}'),   -- 0 = Sunday
  ('slot_minutes',         '15'),
  ('quota',                '{"weekly_hours":10,"open_requests":5}'),
  ('weights',              '{"deadline":0.40,"tightness":0.25,"waiting":0.15,"fairness":0.20}'),
  ('score_features',       '{"waiting":false,"fairness":false}'),                   -- true in V2
  ('booking_horizon_days', '28'),
  ('show_names',           'true'),
  ('cancel_free_hours',    '12'),
  ('fairness_window_days', '14'),
  ('checkin_grace_minutes','15')
on conflict (key) do nothing;

insert into machines (name, buffer_minutes, reliability_note) values
  ('Microscope', 10, null),
  ('Centrifuge', 10, null),
  ('Spectrophotometer', 20, 'Slow and temperamental. Extra buffer reserved after each run')
on conflict (name) do nothing;
```

## 005_public_schedule_view.sql

```sql
-- Calendar data for everyone; names hidden when settings.show_names is false (FR-20)
create view schedule_public as
select
  b.id, b.machine_id, b.kind, b.start_at, b.end_at, b.occupied_until, b.status,
  case
    when b.kind = 'pi_reserved' then 'PI reserved'
    when coalesce((select (value #>> '{}')::boolean from settings where key = 'show_names'), true)
         or is_admin() then p.full_name
    else null
  end as label
from bookings b
left join requests r on r.id = b.request_id
left join profiles p on p.id = r.student_id
where b.status = 'active';

grant select on schedule_public to authenticated;
```

## 006_demo_seed (script, not SQL)

`database/seed/seed.js` uses the Supabase admin API (`auth.admin.createUser`) because profiles reference `auth.users`. It creates:

1. 1 admin (Dr. Haque), 20 students (`student01@lab.test` ... `student20@lab.test`, shared demo password from `.env`).
2. The two case-study requests: "Microscope Tuesday or Wednesday, 3 hours, samples expire Thursday" (fixed, with reason) and "Centrifuge sometime next week, 20 minutes, not urgent" (flexible).
3. About 25 mixed requests so the calendar looks busy.
4. A ready-to-demo scenario: a centrifuge outage of one week that moves 4 bookings and leaves 1 unplaced.

The script calls `requestService.submit` so seed data goes through the real scheduler.

## Verification checklist (S-DB-6)

- [ ] Insert two overlapping active bookings on one machine: second fails with `23P01`.
- [ ] Insert a fixed request without a reason: fails.
- [ ] Update or delete an `audit_log` row: fails.
- [ ] As a student (anon key plus JWT), select another student's request: returns nothing.
- [ ] As a student, insert into `bookings`: denied.
- [ ] 20 parallel submit calls (script): zero overlapping bookings.
