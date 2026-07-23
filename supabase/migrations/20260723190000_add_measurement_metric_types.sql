-- Widen body_metrics.metric_type for manual circumference/tape measurements
-- (Log Measurements screen). Bundles the body_water fix: it's already in
-- the TS MetricType union and read by dashboard/bodyComposition.ts, but was
-- missing from this constraint (a pre-existing insert-time bug).
alter table public.body_metrics drop constraint if exists body_metrics_metric_type_check;
alter table public.body_metrics add constraint body_metrics_metric_type_check
  check (metric_type in (
    'weight', 'body_fat', 'lean_mass', 'bone_mass', 'body_water', 'height', 'bmr',
    'waist', 'neck', 'shoulder', 'chest',
    'bicep_left', 'bicep_right', 'forearm_left', 'forearm_right',
    'abdomen', 'hips', 'thigh_left', 'thigh_right', 'calf_left', 'calf_right'
  ));
