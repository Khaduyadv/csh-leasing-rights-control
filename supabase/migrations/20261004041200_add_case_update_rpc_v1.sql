-- Controlled case update RPC. Only approved Human Input fields are writable.

create or replace function public.csh_update_case(
  p_shop_id text,
  p_cbld text,
  p_cskh text,
  p_session_id text,
  p_changes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  a public.assignment%rowtype;
  old_row public.case_current%rowtype;
  new_row public.case_current%rowtype;
  allowed jsonb := '{}'::jsonb;
  k text;
  v jsonb;
begin
  select * into a from public.assignment where shop_id = p_shop_id;
  if not found or a.cbld_name is distinct from p_cbld or a.cskh_name is distinct from p_cskh then
    raise exception 'WORKSPACE_ASSIGNMENT_MISMATCH';
  end if;
  if p_session_id is null or length(trim(p_session_id)) = 0 then
    raise exception 'SESSION_REQUIRED';
  end if;

  for k, v in select * from jsonb_each(coalesce(p_changes,'{}'::jsonb)) loop
    if k in ('handover_check_status','handover_condition','repair_status','debt_status','document_status','bql_confirmation_status','hdt2_transition_status','issue_type','issue_text','proposal_text','need_cbld_support','issue_priority','issue_status','completion_ref') then
      allowed := allowed || jsonb_build_object(k,v);
    end if;
  end loop;
  if allowed = '{}'::jsonb then raise exception 'NO_ALLOWED_CHANGES'; end if;

  select * into old_row from public.case_current where shop_id = p_shop_id;

  insert into public.case_current(shop_id,updated_by_cskh,updated_by_cbld,updated_from_session,last_progress_at,case_status,onboarded_at,is_onboarded)
  values (p_shop_id,p_cskh,p_cbld,p_session_id,now(),'IN_PROGRESS',now(),true)
  on conflict (shop_id) do update set
    updated_by_cskh=p_cskh, updated_by_cbld=p_cbld, updated_from_session=p_session_id,
    last_progress_at=now(), is_onboarded=true,
    onboarded_at=coalesce(public.case_current.onboarded_at,now()),
    case_status=case when public.case_current.case_status='NOT_ONBOARDED' then 'IN_PROGRESS' else public.case_current.case_status end;

  update public.case_current set
    handover_check_status = case when allowed ? 'handover_check_status' then allowed->>'handover_check_status' else handover_check_status end,
    handover_condition = case when allowed ? 'handover_condition' then allowed->>'handover_condition' else handover_condition end,
    repair_status = case when allowed ? 'repair_status' then allowed->>'repair_status' else repair_status end,
    debt_status = case when allowed ? 'debt_status' then allowed->>'debt_status' else debt_status end,
    document_status = case when allowed ? 'document_status' then allowed->>'document_status' else document_status end,
    bql_confirmation_status = case when allowed ? 'bql_confirmation_status' then allowed->>'bql_confirmation_status' else bql_confirmation_status end,
    hdt2_transition_status = case when allowed ? 'hdt2_transition_status' then allowed->>'hdt2_transition_status' else hdt2_transition_status end,
    issue_type = case when allowed ? 'issue_type' then allowed->>'issue_type' else issue_type end,
    issue_text = case when allowed ? 'issue_text' then allowed->>'issue_text' else issue_text end,
    proposal_text = case when allowed ? 'proposal_text' then allowed->>'proposal_text' else proposal_text end,
    need_cbld_support = case when allowed ? 'need_cbld_support' then (allowed->>'need_cbld_support')::boolean else need_cbld_support end,
    issue_priority = case when allowed ? 'issue_priority' then allowed->>'issue_priority' else issue_priority end,
    issue_status = case when allowed ? 'issue_status' then allowed->>'issue_status' else issue_status end,
    completion_ref = case when allowed ? 'completion_ref' then allowed->>'completion_ref' else completion_ref end
  where shop_id=p_shop_id
  returning * into new_row;

  insert into public.case_event_history(shop_id,event_type,field_name,old_value,new_value,actor_role,actor_name,session_id,source)
  select p_shop_id,'FIELD_UPDATE',e.key,
         case when old_row.shop_id is null then null else to_jsonb(old_row)->e.key end,
         e.value,'CSKH',p_cskh,p_session_id,'MOBILE_WEB'
  from jsonb_each(allowed) e;

  return to_jsonb(new_row);
end;
$$;

revoke all on function public.csh_update_case(text,text,text,text,jsonb) from public, anon;
grant execute on function public.csh_update_case(text,text,text,text,jsonb) to authenticated;
