-- Calendar data for everyone; names hidden when settings.show_names is false (FR-20, S-DB-4)
-- Owner-rights view on purpose: it is the single place that decides whether a name is shown.
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
