-- Workspace RPC layer for no-form-login UX using Supabase anonymous auth.

create or replace function public.csh_get_workspace_selectors()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object('cbld_name', cbld_name, 'cskh_names', cskh_names) order by cbld_name), '[]'::jsonb)
  from (
    select cbld_name, jsonb_agg(cskh_name order by cskh_name) as cskh_names
    from (select distinct cbld_name, cskh_name from public.assignment where cbld_name is not null and cskh_name is not null) d
    group by cbld_name
  ) x;
$$;

create or replace function public.csh_get_workspace(p_cbld text, p_cskh text)
returns setof public.v_active_workspace
language sql
security definer
set search_path = public, pg_temp
as $$
  select * from public.v_active_workspace
  where cbld_name = p_cbld and cskh_name = p_cskh
  order by computed_warning_level desc, computed_days_to_cktt asc, shop_id;
$$;

create or replace function public.csh_get_completed_cases(p_cbld text, p_cskh text)
returns setof public.v_completed_cases
language sql
security definer
set search_path = public, pg_temp
as $$
  select * from public.v_completed_cases
  where cbld_name = p_cbld and cskh_name = p_cskh
  order by completed_at desc nulls last, shop_id;
$$;

create or replace function public.csh_get_case(p_shop_id text)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'case', (select to_jsonb(c) from public.v_case_control c where c.shop_id = p_shop_id),
    'history', coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc) from (select * from public.case_event_history where shop_id = p_shop_id order by created_at desc limit 100) h), '[]'::jsonb)
  );
$$;

revoke all on function public.csh_get_workspace_selectors() from public, anon;
revoke all on function public.csh_get_workspace(text,text) from public, anon;
revoke all on function public.csh_get_completed_cases(text,text) from public, anon;
revoke all on function public.csh_get_case(text) from public, anon;
grant execute on function public.csh_get_workspace_selectors() to authenticated;
grant execute on function public.csh_get_workspace(text,text) to authenticated;
grant execute on function public.csh_get_completed_cases(text,text) to authenticated;
grant execute on function public.csh_get_case(text) to authenticated;
