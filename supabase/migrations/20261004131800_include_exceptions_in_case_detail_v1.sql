create or replace function public.csh_get_case(p_shop_id text)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'case', (select to_jsonb(c) from public.v_case_control c where c.shop_id = p_shop_id),
    'history', coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc) from (select * from public.case_event_history where shop_id = p_shop_id order by created_at desc limit 100) h), '[]'::jsonb),
    'exceptions', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (select * from public.exception where shop_id = p_shop_id and status in ('OPEN','IN_REVIEW') order by created_at desc) e), '[]'::jsonb)
  );
$$;
revoke all on function public.csh_get_case(text) from public, anon;
grant execute on function public.csh_get_case(text) to authenticated;
