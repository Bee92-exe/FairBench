-- FairBench indexes and triggers (S-DB-2, S-DB-3, NFR-09)

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
