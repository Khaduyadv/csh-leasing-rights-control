-- CSH control views V1
-- Computes onboarding, HĐT2 branch, warnings and next action.

create or replace view public.v_case_control
with (security_invoker = true)
as
with base as (
  select
    s.shop_id,
    s.project_code,
    s.zone,
    s.shop_name,
    a.cskh_name,
    a.cbld_name,
    h1.id as hdt1_id,
    h1.contract_ref as hdt1_contract_ref,
    h1.start_date as hdt1_start_date,
    h1.end_date as cktt_end_date,
    h1.status as hdt1_status,
    cc.case_status,
    cc.handover_check_status,
    cc.handover_condition,
    cc.repair_status,
    cc.debt_status,
    cc.document_status,
    cc.bql_confirmation_status,
    cc.hdt2_transition_status,
    cc.issue_type,
    cc.issue_text,
    cc.proposal_text,
    cc.need_cbld_support,
    cc.issue_priority,
    cc.issue_status,
    cc.last_progress_at,
    cc.completed_at,
    cc.completion_ref,
    cc.updated_at as case_updated_at,
    coalesce(cc.case_status,'NOT_ONBOARDED') as effective_case_status
  from public.shop_master s
  left join public.assignment a on a.shop_id = s.shop_id
  left join lateral (
    select x.*
    from public.hdt1 x
    where x.shop_id = s.shop_id
    order by x.end_date desc, x.updated_at desc
    limit 1
  ) h1 on true
  left join public.case_current cc on cc.shop_id = s.shop_id
  where s.is_in_scope = true
), h2 as (
  select
    b.*,
    coalesce(h.hdt2_count,0) as hdt2_count,
    coalesce(h.active_at_cktt_count,0) as active_at_cktt_count,
    h.relevant_hdt2_end_date,
    h.relevant_hdt2_contract_ref
  from base b
  left join lateral (
    select
      count(*) filter (where x.start_date is null or x.start_date <= b.cktt_end_date) as hdt2_count,
      count(*) filter (
        where (x.start_date is null or x.start_date <= b.cktt_end_date)
          and (x.end_date is null or x.end_date >= b.cktt_end_date)
          and x.status not in ('CANCELLED','LIQUIDATED')
      ) as active_at_cktt_count,
      (array_agg(x.end_date order by x.end_date desc, x.updated_at desc)
        filter (where x.start_date is null or x.start_date <= b.cktt_end_date))[1] as relevant_hdt2_end_date,
      (array_agg(x.contract_ref order by x.end_date desc, x.updated_at desc)
        filter (where x.start_date is null or x.start_date <= b.cktt_end_date))[1] as relevant_hdt2_contract_ref
    from public.hdt2 x
    where x.shop_id = b.shop_id and b.cktt_end_date is not null
  ) h on true
), classified as (
  select
    h2.*,
    case
      when cktt_end_date is null then null
      when active_at_cktt_count > 1 then 'DATA_EXCEPTION'
      when hdt2_count = 0 then 'NO_HDT2'
      when relevant_hdt2_end_date is null then 'DATA_EXCEPTION'
      when relevant_hdt2_end_date < cktt_end_date then 'BEFORE_CKTT'
      when relevant_hdt2_end_date = cktt_end_date then 'SAME_AS_CKTT'
      when relevant_hdt2_end_date > cktt_end_date then 'AFTER_CKTT'
      else 'DATA_EXCEPTION'
    end as computed_hdt2_branch,
    case when cktt_end_date is null then null else cktt_end_date - current_date end as computed_days_to_cktt,
    case
      when cktt_end_date is null then false
      when coalesce(effective_case_status,'NOT_ONBOARDED') = 'COMPLETED' then false
      when cktt_end_date <= current_date + 45 then true
      else false
    end as computed_is_onboarded,
    case
      when last_progress_at is null then null
      else greatest(0, current_date - last_progress_at::date)
    end as computed_stale_days
  from h2
)
select
  c.*,
  case
    when not computed_is_onboarded then null
    when computed_hdt2_branch = 'DATA_EXCEPTION' then 'Rà soát dữ liệu HĐT2'
    when computed_hdt2_branch = 'AFTER_CKTT' and coalesce(hdt2_transition_status,'PENDING') <> 'COMPLETE' then 'Xử lý chuyển tiếp HĐT2'
    when computed_hdt2_branch = 'AFTER_CKTT' then 'Hoàn tất chuyển giao Chủ sở hữu'
    when coalesce(handover_check_status,'NOT_CHECKED') <> 'CHECKED' then 'Kiểm tra mặt bằng'
    when handover_condition = 'BELOW_STANDARD' and coalesce(repair_status,'RECORDED') <> 'COMPLETED' then 'Hoàn thiện mặt bằng'
    when coalesce(debt_status,'UNKNOWN') not in ('CLEARED','NOT_APPLICABLE') then 'Xử lý công nợ'
    when coalesce(document_status,'UNKNOWN') not in ('COMPLETE','NOT_APPLICABLE') then 'Hoàn thiện hồ sơ'
    when coalesce(bql_confirmation_status,'PENDING') not in ('CONFIRMED','NOT_APPLICABLE') then 'Ban quản lý xác nhận'
    else 'Hoàn tất bàn giao Chủ sở hữu'
  end as computed_next_action,
  case
    when not computed_is_onboarded then 'NONE'
    when computed_hdt2_branch = 'DATA_EXCEPTION' then 'CRITICAL'
    when computed_days_to_cktt < 0 then 'CRITICAL'
    when need_cbld_support = true and coalesce(issue_status,'NEW') <> 'RESOLVED' then 'WARNING'
    when computed_stale_days is not null and computed_stale_days >= 10 then 'WARNING'
    when computed_days_to_cktt <= 7 then 'WARNING'
    when computed_days_to_cktt <= 15 then 'INFO'
    else 'NONE'
  end as computed_warning_level,
  case
    when not computed_is_onboarded then null
    when computed_hdt2_branch = 'DATA_EXCEPTION' then 'HDT2_DATA_EXCEPTION'
    when computed_days_to_cktt < 0 then 'CKTT_OVERDUE'
    when need_cbld_support = true and coalesce(issue_status,'NEW') <> 'RESOLVED' then 'CBLD_SUPPORT_REQUIRED'
    when computed_stale_days is not null and computed_stale_days >= 10 then 'NO_PROGRESS_10D'
    when computed_days_to_cktt <= 7 then 'CKTT_T7'
    when computed_days_to_cktt <= 15 then 'CKTT_T15'
    else null
  end as computed_warning_code
from classified c;

create or replace view public.v_active_workspace
with (security_invoker = true)
as
select *
from public.v_case_control
where computed_is_onboarded = true
  and coalesce(effective_case_status,'NOT_ONBOARDED') <> 'COMPLETED';

create or replace view public.v_completed_cases
with (security_invoker = true)
as
select *
from public.v_case_control
where coalesce(effective_case_status,'NOT_ONBOARDED') = 'COMPLETED';
