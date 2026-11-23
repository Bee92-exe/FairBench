-- FairBench settings seed (S-DB-4, FR-16)
-- All lab rules live here, never in code.

insert into settings (key, value) values
  ('lab_name',             '"Dr. Haque''s Biophysics & Nanoscopy Lab"'),
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
