create or replace function public.csh_update_case(p_shop_id text, p_cbld text, p_cskh text, p_session_id text, p_changes jsonb)
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
  v_branch text;
  v_closure_ready boolean := false;
begin
  select * into a from public.assignment where shop_id = p_shop_id;
  if not found or a.cbld_name is distinct from p_cbld or a.cskh_name is distinct from p_cskh then
    raise exception 'WORKSPACE_ASSIGNMENT_MISMATCH';
  end if;
  if p_session_id is null or length(trim(p_session_id)) = 0 then
    raise exception 'SESSION_REQUIRED';
  end if;
  select * into old_row from public.case_current where shop_id = p_shop_id;
  if old_row.shop_id is not null and old_row.case_status = 'COMPLETED' then
    raise exception 'CASE_ALREADY_COMPLETED';
  end if;
  for k, v in select * from jsonb_each(coalesce(p_changes,'{}'::jsonb)) loop
    if k in ('handover_check_status','handover_condition','repair_status','debt_status','document_status','bql_confirmation_status','hdt2_transition_status','issue_type','issue_text','proposal_text','need_cbld_support','issue_priority','issue_status','completion_ref') then
      allowed := allowed || jsonb_build_object(k,v);
    end if;
  end loop;
  if allowed = '{}'::jsonb then raise exception 'NO_ALLOWED_CHANGES'; end if;
  insert into public.case_current(shop_id,handover_check_status,handover_condition,repair_status,debt_status,document_status,bql_confirmation_status,hdt2_transition_status,issue_type,issue_text,proposal_text,need_cbld_support,issue_priority,issue_status,completion_ref,updated_by_cskh,updated_by_cbld,updated_from_session,last_progress_at,case_status,onboarded_at,is_onboarded)
  values (p_shop_id,allowed->>'handover_check_status',allowed->>'handover_condition',allowed->>'repair_status',allowed->>'debt_status',allowed->>'document_status',allowed->>'bql_confirmation_status',allowed->>'hdt2_transition_status',allowed->>'issue_type',allowed->>'issue_text',allowed->>'proposal_text',case when allowed ? 'need_cbld_support' then (allowed->>'need_cbld_support')::boolean else false end,allowed->>'issue_priority',allowed->>'issue_status',allowed->>'completion_ref',p_cskh,p_cbld,p_session_id,now(),'IN_PROGRESS',now(),true)
  on conflict (shop_id) do update set handover_check_status=coalesce(allowed->>'handover_check_status',public.case_current.handover_check_status),handover_condition=coalesce(allowed->>'handover_condition',public.case_current.handover_condition),repair_status=coalesce(allowed->>'repair_status',public.case_current.repair_status),debt_status=coalesce(allowed->>'debt_status',public.case_current.debt_status),document_status=coalesce(allowed->>'document_status',public.case_current.document_status),bql_confirmation_status=coalesce(allowed->>'bql_confirmation_status',public.case_current.bql_confirmation_status),hdt2_transition_status=coalesce(allowed->>'hdt2_transition_status',public.case_current.hdt2_transition_status),issue_type=case when allowed ? 'issue_type' then allowed->>'issue_type' else public.case_current.issue_type end,issue_text=case when allowed ? 'issue_text' then allowed->>'issue_text' else public.case_current.issue_text end,proposal_text=case when allowed ? 'proposal_text' then allowed->>'proposal_text' else public.case_current.proposal_text end,need_cbld_support=case when allowed ? 'need_cbld_support' then (allowed->>'need_cbld_support')::boolean else public.case_current.need_cbld_support end,issue_priority=coalesce(allowed->>'issue_priority',public.case_current.issue_priority),issue_status=coalesce(allowed->>'issue_status',public.case_current.issue_status),completion_ref=case when allowed ? 'completion_ref' then allowed->>'completion_ref' else public.case_current.completion_ref end,updated_by_cskh=p_cskh,updated_by_cbld=p_cbld,updated_from_session=p_session_id,last_progress_at=now(),case_status=case when public.case_current.case_status='NOT_ONBOARDED' then 'IN_PROGRESS' else public.case_current.case_status end,is_onboarded=true,onboarded_at=coalesce(public.case_current.onboarded_at,now()) returning * into new_row;
  insert into public.case_event_history(shop_id,event_type,field_name,old_value,new_value,actor_role,actor_name,session_id,source)
  select p_shop_id,'FIELD_UPDATE',e.key,case when old_row.shop_id is null then null else to_jsonb(old_row)->e.key end,e.value,'CSKH',p_cskh,p_session_id,'MOBILE_WEB' from jsonb_each(allowed) e;
  select computed_hdt2_branch into v_branch from public.v_case_control where shop_id=p_shop_id;
  v_closure_ready := nullif(trim(coalesce(new_row.completion_ref,'')),'') is not null and new_row.debt_status in ('CLEARED','NOT_APPLICABLE') and new_row.document_status in ('COMPLETE','NOT_APPLICABLE') and new_row.bql_confirmation_status in ('CONFIRMED','NOT_APPLICABLE') and ((v_branch='AFTER_CKTT' and new_row.hdt2_transition_status='COMPLETE') or (v_branch in ('NO_HDT2','BEFORE_CKTT','SAME_AS_CKTT') and new_row.handover_check_status='CHECKED' and (new_row.handover_condition <> 'BELOW_STANDARD' or new_row.repair_status='COMPLETED')));
  if v_closure_ready then
    update public.case_current set case_status='COMPLETED',completed_at=coalesce(completed_at,now()) where shop_id=p_shop_id returning * into new_row;
    insert into public.case_event_history(shop_id,event_type,actor_role,actor_name,session_id,source,new_value) values (p_shop_id,'CASE_COMPLETED','SYSTEM','SYSTEM',p_session_id,'MOBILE_WEB',jsonb_build_object('completion_ref',new_row.completion_ref,'branch',v_branch));
  end if;
  return to_jsonb(new_row);
end;
$$;
revoke all on function public.csh_update_case(text,text,text,text,jsonb) from public, anon;
grant execute on function public.csh_update_case(text,text,text,text,jsonb) to authenticated;
