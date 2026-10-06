create or replace function public.csh_get_cbld_dashboard(p_cbld text)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
with team as (
  select * from public.v_active_workspace where cbld_name = p_cbld
), by_staff as (
  select cskh_name,
         count(*) as active_cases,
         count(*) filter (where computed_days_to_cktt < 0) as overdue,
         count(*) filter (where need_cbld_support = true and coalesce(issue_status,'NEW') <> 'RESOLVED') as need_support,
         count(*) filter (where computed_hdt2_branch = 'AFTER_CKTT') as after_cktt
  from team
  group by cskh_name
)
select jsonb_build_object(
  'summary', jsonb_build_object(
    'active', (select count(*) from team),
    'overdue', (select count(*) from team where computed_days_to_cktt < 0),
    'need_support', (select count(*) from team where need_cbld_support = true and coalesce(issue_status,'NEW') <> 'RESOLVED'),
    'after_cktt', (select count(*) from team where computed_hdt2_branch = 'AFTER_CKTT')
  ),
  'staff', coalesce((select jsonb_agg(to_jsonb(s) order by overdue desc, need_support desc, active_cases desc, cskh_name) from by_staff s),'[]'::jsonb),
  'attention', coalesce((select jsonb_agg(to_jsonb(t) order by (computed_days_to_cktt < 0) desc, computed_days_to_cktt asc, shop_id)
                         from team t
                         where computed_days_to_cktt < 0
                            or need_cbld_support = true
                            or computed_hdt2_branch = 'DATA_EXCEPTION'
                            or effective_case_status = 'BLOCKED'), '[]'::jsonb)
);
$$;

create or replace function public.csh_get_leadership_dashboard()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
with all_cases as (
  select * from public.v_case_control
), active as (
  select * from all_cases where computed_is_onboarded = true and coalesce(effective_case_status,'NOT_ONBOARDED') <> 'COMPLETED'
), completed as (
  select * from all_cases where coalesce(effective_case_status,'NOT_ONBOARDED') = 'COMPLETED'
), by_cbld as (
  select cbld_name,
         count(*) as active_cases,
         count(*) filter (where computed_days_to_cktt < 0) as overdue,
         count(*) filter (where computed_hdt2_branch = 'AFTER_CKTT') as after_cktt,
         count(*) filter (where need_cbld_support = true and coalesce(issue_status,'NEW') <> 'RESOLVED') as need_support
  from active
  group by cbld_name
)
select jsonb_build_object(
  'summary', jsonb_build_object(
    'universe', (select count(*) from all_cases),
    'onboarded_active', (select count(*) from active),
    'overdue', (select count(*) from active where computed_days_to_cktt < 0),
    'after_cktt', (select count(*) from active where computed_hdt2_branch = 'AFTER_CKTT'),
    'no_hdt2', (select count(*) from active where computed_hdt2_branch = 'NO_HDT2'),
    'completed', (select count(*) from completed),
    'open_exceptions', (select count(*) from public.exception where status='OPEN')
  ),
  'branches', jsonb_build_object(
    'NO_HDT2', (select count(*) from all_cases where computed_hdt2_branch='NO_HDT2'),
    'BEFORE_CKTT', (select count(*) from all_cases where computed_hdt2_branch='BEFORE_CKTT'),
    'SAME_AS_CKTT', (select count(*) from all_cases where computed_hdt2_branch='SAME_AS_CKTT'),
    'AFTER_CKTT', (select count(*) from all_cases where computed_hdt2_branch='AFTER_CKTT'),
    'DATA_EXCEPTION', (select count(*) from all_cases where computed_hdt2_branch='DATA_EXCEPTION')
  ),
  'teams', coalesce((select jsonb_agg(to_jsonb(x) order by overdue desc, active_cases desc, cbld_name) from by_cbld x), '[]'::jsonb),
  'exceptions', coalesce((select jsonb_agg(to_jsonb(e) order by severity desc, opened_at asc) from public.exception e where status='OPEN'), '[]'::jsonb)
);
$$;

revoke all on function public.csh_get_cbld_dashboard(text) from public, anon;
revoke all on function public.csh_get_leadership_dashboard() from public, anon;
grant execute on function public.csh_get_cbld_dashboard(text) to authenticated;
grant execute on function public.csh_get_leadership_dashboard() to authenticated;