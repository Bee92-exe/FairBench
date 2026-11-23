-- FairBench Row Level Security (S-DB-3, NFR-04)
-- The Express backend uses the service-role key, which bypasses RLS.
-- These policies protect direct calls made with the anon key.

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
