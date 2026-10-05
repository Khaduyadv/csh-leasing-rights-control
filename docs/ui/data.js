// CSH Leasing Rights Control — data adapter layer.
//
// This module no longer reads any local fixture file. Every case object is adapted from a real
// `v_case_control` row (or the richer `csh_get_case` payload) returned by the production backend.
// Branch, priority, next action, and completion state are computed server-side and are never
// recomputed or overridden here — this layer only reshapes field names for the existing UI.

export const branchLabels = {
  NO_HDT2: 'NO_HDT2', BEFORE_CKTT: 'BEFORE_CKTT', SAME_AS_CKTT: 'SAME_AS_CKTT',
  AFTER_CKTT: 'AFTER_CKTT', DATA_EXCEPTION: 'DATA_EXCEPTION'
};

// Adapts one `v_case_control` row (as returned by csh_get_workspace / csh_get_completed_cases /
// csh_get_cbld_cases / csh_get_leadership_cases, or the `case` key of csh_get_case) into the shape
// the existing UI rendering code expects. `history` and `exception` detail are not part of the list
// RPCs (v_case_control carries no row-level exception/history columns) — they stay empty until a
// case is opened and enriched via `enrichWithCaseDetail` below.
export function adaptBackendCase(row) {
  const allowedPriorityBuckets = new Set(['OVERDUE', 'T7', 'T15', 'T30', 'T45', null]);
  if (!Number.isInteger(row.computed_priority_rank)) {
    throw new Error('CONTRACT_ERROR: computed_priority_rank must be an integer');
  }
  if (!allowedPriorityBuckets.has(row.computed_priority_bucket ?? null)) {
    throw new Error('CONTRACT_ERROR: computed_priority_bucket is invalid');
  }
  const completed = row.effective_case_status === 'COMPLETED';
  return {
    id: row.shop_id, shop: row.shop_id, projectCode: row.project_code, zone: row.zone,
    cs: row.cskh_name, director: row.cbld_name, branch: row.computed_hdt2_branch,
    days: row.computed_days_to_cktt,
    priorityBucket: row.computed_priority_bucket ?? null, priorityRank: row.computed_priority_rank,
    status: completed ? 'COMPLETED' : 'ACTIVE',
    onboardedT45: Boolean(row.computed_is_onboarded),
    requiresHumanAuthority: row.computed_hdt2_branch === 'DATA_EXCEPTION',
    next: row.computed_next_action, warning: null,
    blocker: row.issue_text || null, issueStatus: row.issue_status || null,
    supportNeeded: row.need_cbld_support, hdt1Start: row.hdt1_start_date, hdt1End: row.cktt_end_date,
    ckttDate: row.cktt_end_date, hdt2Start: row.relevant_hdt2_start_date, hdt2End: row.relevant_hdt2_end_date,
    hdt2Status: null, hdt2Expiry: row.relevant_hdt2_end_date,
    condition: row.handover_condition, document: row.document_status,
    noticeStatus: null,
    inspectionStatus: row.handover_check_status, repairStatus: row.repair_status,
    debtStatus: row.debt_status, bqlConfirmation: row.bql_confirmation_status,
    completionRef: row.completion_ref, handoverDate: null, closure: null,
    transitionStatus: row.hdt2_transition_status, legalForm: row.hdt2_transition_status, exception: null,
    completedAt: row.completed_at || null, history: [], source: 'CSH Production Backend',
    sourceRef: null, synthetic: false,
    raw: { ...row, completed, case_status: completed ? 'COMPLETED' : row.case_status, history: [] }
  };
}

// Merges the richer `csh_get_case` payload (real exception + history rows) into an already-adapted
// case object, for the detail screen only.
export function enrichWithCaseDetail(adapted, detailPayload) {
  const exc = Array.isArray(detailPayload?.exceptions) ? detailPayload.exceptions[0] : null;
  const history = Array.isArray(detailPayload?.history) ? detailPayload.history : [];
  return {
    ...adapted,
    warning: exc ? exc.exception_code : adapted.warning,
    exception: exc ? exc.description : adapted.exception,
    history,
    raw: { ...adapted.raw, history }
  };
}

export const sandboxWritableFields = Object.freeze([
  'handover_check_status', 'handover_condition', 'repair_status', 'debt_status', 'document_status',
  'bql_confirmation_status', 'hdt2_transition_status', 'issue_type', 'issue_text', 'proposal_text',
  'need_cbld_support', 'issue_priority', 'issue_status', 'completion_ref'
]);
export const sandboxEnums = Object.freeze({
  handover_check_status: ['NOT_CHECKED', 'CHECKED'],
  handover_condition: ['BELOW_STANDARD', 'MEETS_STANDARD', 'ABOVE_STANDARD'],
  repair_status: ['NOT_REQUIRED', 'RECORDED', 'IN_REPAIR', 'COMPLETED'],
  debt_status: ['UNKNOWN', 'PENDING', 'CLEARED', 'NOT_APPLICABLE'],
  document_status: ['UNKNOWN', 'PENDING', 'COMPLETE', 'NOT_APPLICABLE'],
  bql_confirmation_status: ['PENDING', 'CONFIRMED', 'NOT_APPLICABLE'],
  hdt2_transition_status: ['NOT_APPLICABLE', 'PENDING', 'RIGHTS_OBLIGATIONS_DONE', 'DEPOSIT_DONE', 'THREE_PARTY_CONFIRMED', 'COMPLETE'],
  issue_priority: ['NORMAL', 'SOON', 'URGENT'],
  issue_status: ['NEW', 'IN_PROGRESS', 'RESOLVED']
});

// Read-only, client-side mirror of the backend's own closure-gate rule (csh_update_case's
// v_closure_ready formula) so the UI can show a live gate-by-gate checklist. It never decides
// whether a case closes — only `csh_update_case` does that, server-side. This never writes
// anything and is never consulted before sending a write.
export function closureProgress(c) {
  const raw = c.raw || c;
  const handover = ['NO_HDT2', 'BEFORE_CKTT', 'SAME_AS_CKTT'].includes(c.branch || raw.computed_hdt2_branch);
  const after = (c.branch || raw.computed_hdt2_branch) === 'AFTER_CKTT';
  const gates = [
    { key: 'completion_ref', label: 'Mã tham chiếu hoàn tất', done: Boolean(String(raw.completion_ref || '').trim()) },
    { key: 'debt_status', label: 'Đối soát công nợ', done: ['CLEARED', 'NOT_APPLICABLE'].includes(raw.debt_status) },
    { key: 'document_status', label: 'Hồ sơ', done: ['COMPLETE', 'NOT_APPLICABLE'].includes(raw.document_status) },
    { key: 'bql_confirmation_status', label: 'Xác nhận BQL', done: ['CONFIRMED', 'NOT_APPLICABLE'].includes(raw.bql_confirmation_status) }
  ];
  if (after) gates.push({ key: 'hdt2_transition_status', label: 'Chuyển tiếp HĐT2', done: raw.hdt2_transition_status === 'COMPLETE' });
  else if (handover) {
    gates.push({ key: 'handover_check_status', label: 'Kiểm tra hiện trạng', done: raw.handover_check_status === 'CHECKED' });
    gates.push({ key: 'handover_condition', label: 'Điều kiện bàn giao / sửa chữa', done: ['MEETS_STANDARD', 'ABOVE_STANDARD'].includes(raw.handover_condition) || raw.repair_status === 'COMPLETED' });
  }
  const humanAuthority = Boolean(c.requiresHumanAuthority || (c.branch || raw.computed_hdt2_branch) === 'DATA_EXCEPTION');
  return { gates, completed: !humanAuthority && gates.every(g => g.done), humanAuthority, doneCount: gates.filter(g => g.done).length, total: gates.length };
}

export const priority = c => c.priorityRank;
export const dueLabel = c => c.status === 'COMPLETED' ? `Đã đóng ${c.completedAt || ''}`.trim() : c.days == null ? 'Chưa trong T-45' : c.days < 0 ? `Quá hạn ${Math.abs(c.days)} ngày` : `T-${c.days}`;
export const caseState = c => c.status === 'COMPLETED' ? 'Đã hoàn tất · chỉ xem' : 'Đang xử lý';
export const branchFields = c => {
  if (c.branch === 'AFTER_CKTT') return ['Tình trạng HĐT2 tại CKTT', 'Ngày bắt đầu HĐT2', 'Ngày kết thúc HĐT2', 'Hồ sơ chuyển tiếp HĐT2'];
  if (['NO_HDT2', 'BEFORE_CKTT', 'SAME_AS_CKTT'].includes(c.branch)) return ['Thông báo CSH', 'Ngày / lịch bàn giao mặt bằng', 'Tình trạng hiện trạng', 'Điều kiện đóng case'];
  return ['Dữ kiện cần xác minh', 'Nguồn đang xung đột hoặc còn thiếu', 'Người có thẩm quyền cần xác minh / quyết định'];
};
export const sortedCases = rows => [...rows].sort((a, b) => priority(a) - priority(b) || a.shop.localeCompare(b.shop, 'vi'));
