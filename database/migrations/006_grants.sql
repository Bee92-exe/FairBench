-- 006_grants.sql
--
-- Why this exists: migrations 001-005 create tables through a direct SQL
-- connection as the application role, so Supabase's default table privileges
-- were never applied. Any PostgREST call (supabase-js) then fails with
--   permission denied for table profiles
-- even with the service-role key. The API hid this by falling back to
-- user_metadata for the role, which silently demoted every admin to student.
--
-- RLS still decides which ROWS a role may touch; these grants only let the role
-- reach the table at all.
--
-- Note: `grant ... on all tables in schema public` also covers views, and the
-- application role does not own every object here (schedule_public was created
-- by the project owner), so this grants per object instead of in one statement.

grant usage on schema public to anon, authenticated, service_role;

do $$
declare
  obj record;
begin
  for obj in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p', 'v', 'm')
       and pg_get_userbyid(c.relowner) = current_user
  loop
    -- Backend uses the service-role key: it bypasses RLS but still needs grants.
    execute format('grant all privileges on table public.%I to service_role', obj.relname);

    -- Signed-in users: the policies in 003_rls.sql restrict the rows.
    execute format('grant select, insert, update, delete on table public.%I to authenticated', obj.relname);

    -- Anonymous visitors see nothing unless a policy allows it.
    execute format('grant select on table public.%I to anon', obj.relname);
  end loop;
end $$;

grant usage, select on all sequences in schema public to authenticated, service_role;

-- Keep the same defaults for objects added later by this role.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
