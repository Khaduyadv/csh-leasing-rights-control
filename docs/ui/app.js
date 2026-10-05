import { backend, BackendError } from './backend.js';
import {
  branchLabels, adaptBackendCase, enrichWithCaseDetail, sandboxWritableFields,
  closureProgress, priority, dueLabel, caseState, sortedCases
} from './data.js';

const app = document.querySelector('#app');

const state = {
  view: 'home',
  selectorsState: 'loading', selectors: {}, directors: [],
  director: '', cs: '',
  workspaceState: 'idle', workspaceError: '', rows: [],
  selected: '', selectedCase: null, detailState: 'idle', detailError: '', detailOrigin: 'workspace',
  queueTab: 'work', branch: 'ALL', priority: 'ALL', sort: 'priority',
  feedback: '', scrollY: 0,
  directorFilter: 'ALL', directorState: 'idle', directorError: '', directorRows: [],
  personFilter: '', personDirector: '', drillRows: [],
  leadershipState: 'idle', leadershipError: '', leadershipDashboard: null, leadershipRows: [],
  leadTitle: '', leadRows: null
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const attr = esc;

const isOpen = c => c.status !== 'COMPLETED';
const withinT45 = c => (c.days != null && c.days <= 45) || c.branch === 'DATA_EXCEPTION' || c.status === 'COMPLETED';
const isPriority = (c, b) => b === 'OVERDUE' ? c.days < 0 : b === 'T7' ? c.days >= 0 && c.days <= 7 : b === 'T15' ? c.days > 7 && c.days <= 15 : b === 'T30' ? c.days > 15 && c.days <= 30 : b === 'T45' ? c.days > 30 && c.days <= 45 : true;

// A backend error code is mapped to one of a small number of real, honestly-distinguishable UI
// states. The backend does not distinguish "invalid context" from "access denied" from "no
// assignment" the way the old sandbox mock did — WORKSPACE_ASSIGNMENT_MISMATCH covers all three on
// purpose (a single denial reason, no existence/validity leak). Anything else is a genuine backend
// error (network failure, unexpected response).
function classifyError(err) {
  if (err instanceof BackendError && err.code === 'WORKSPACE_ASSIGNMENT_MISMATCH') return 'denied';
  return 'error';
}
function errorMessage(err) {
  if (!(err instanceof BackendError)) return String(err?.message || err || 'ỗi không xác định');
  if (err.code === 'WORKSPACE_ASSIGNMENT_MISMATCH') return 'Backend từ chối: ngữ cảnh hoặc case không khớp assignment hiện hành.';
  if (err.code === 'BACKEND_UNAVAILABLE') return 'Không kết nối được CSH Production Backend. Kiểm tra mạng và thử lại.';
  return `Backend báo lỗi: ${err.message}`;
}

function topnav() {
  return `<nav class="workspace-tabs" aria-label="Chọn góc nhìn"><button class="${state.view === 'home' || state.view === 'workspace' ? 'active' : ''}" data-view="home">CSKH</button><button class="${state.view === 'director' ? 'active' : ''}" data-view="director">CBLĐ</button><button class="${state.view === 'leadership' ? 'active' : ''}" data-view="leadership">Leadership</button></nav>`;
}
function heading(title, sub, back = false) {
  return `<div class="page-heading">${back ? '<button class="back-button" data-back aria-label="Quay lại">←</button>' : ''}<div><p class="eyebrow">CSH LEASING RIGHTS CONTROL</p><h1>${title}</h1><p class="muted">${sub}</p></div></div>`;
}
function genericStatePanel(kind, message, retryAct = 'state-retry') {
  const text = {
    loading: ['Đang tải dữ liệu', 'Đang gọi CSH Production Backend…'],
    denied: ['Không được backend chấp nhận', message || 'Ngữ cảnh hoặc case không khớp assignment hiện hành.'],
    error: ['Chưa tải được dữ liệu', message || 'CSH Production Backend không phản hồi được.']
  }[kind];
  if (!text) return '';
  return `<section class="state-panel" role="status"><span class="spinner">${kind === 'loading' ? '◌' : '!'}</span><h2>${esc(text[0])}</h2><p>${esc(text[1])}</p><div class="state-actions">${kind !== 'loading' ? `<button class="button primary" data-act="${retryAct}">Thử lại</button>` : ''}<button class="button secondary" data-act="home">Về chọn workspace</button></div></section>`;
}

// ---------- CSKH: home / workspace ----------

function home() {
  if (state.selectorsState === 'loading') return genericStatePanel('loading');
  if (state.selectorsState === 'error') return genericStatePanel('error', state.selectorsError, 'reload-selectors');
  if (state.workspaceState === 'loading') return genericStatePanel('loading');
  if (state.workspaceState === 'denied') return genericStatePanel('denied', state.workspaceError, 'state-retry');
  if (state.workspaceState === 'error') return genericStatePanel('error', state.workspaceError, 'state-retry');
  const roster = state.selectors[state.director] || [];
  return `<section class="hero">${heading('CSH Leasing Rights Control', 'Chọn workspace để xem đúng phạm vi công việc.')}<div class="entry-card"><div class="entry-step"><span>01</span><div><strong>Chọn CBLĐ</strong><small>Phân đoạn workspace, không xác thực danh tính</small></div></div><label class="field-label" for="cbldSelect">CBLĐ phụ trách</label><select id="cbldSelect"><option value="">Chọn CBLĐ</option>${state.directors.map(d => `<option ${state.director === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select><div class="entry-step second ${state.director ? '' : 'disabled'}"><span>02</span><div><strong>Chọn CSKH</strong><small>Chỉ hiện CSKH thuộc CBLĐ đã chọn</small></div></div><label class="field-label" for="cskhSelect">CSKH</label><select id="cskhSelect" ${state.director ? '' : 'disabled'}><option value="">${state.director ? 'Chọn CSKH' : 'Chọn CBLĐ trước'}</option>${roster.map(n => `<option ${state.cs === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select><button class="button primary entry-submit" data-act="enter" ${state.director && state.cs ? '' : 'disabled'}>Vào workspace <span>→</span></button><p class="assignment-proof"><span class="proof-dot"></span> Roster đọc trực tiếp từ backend (Staff Assignment hiện hành). Backend kiểm tra lại toàn bộ ngữ cảnh khi vào workspace.</p></div><div class="entry-footer"><span class="sandbox-tag live-tag"><i></i> CSH PRODUCTION BACKEND</span></div></section>`;
}

function pill(c) { return `<span class="pill ${c.status === 'COMPLETED' ? 'done' : 'active'}">${esc(caseState(c))}</span>`; }
function origin() { return '<span class="source-chip">CSH PRODUCTION</span>'; }

function card(c) {
  const exceptional = c.branch === 'DATA_EXCEPTION';
  return `<button class="case-card ${c.status === 'COMPLETED' ? 'is-complete' : ''}" data-case="${attr(c.id)}"><div class="case-top"><strong class="shop-id">${esc(c.shop)}</strong><span class="due ${c.days < 0 && isOpen(c) ? 'late' : ''}">${esc(dueLabel(c))}</span></div><div class="case-tags"><span class="branch-tag">${esc(c.branch)}</span>${pill(c)}${origin()}</div><div class="case-next"><span>VIỆC TIẾP THEO</span><strong>${esc(c.status === 'COMPLETED' ? 'Đã hoàn tất · chỉ xem' : c.next || 'Chưa ghi nhận')}</strong></div>${exceptional ? `<div class="case-warning exception">${esc(c.warning || 'Cần xác minh / cần quyết định')}</div>` : ''}${c.issueStatus && c.issueStatus !== 'RESOLVED' ? `<div class="issue-badge">Vướng mắc · ${esc(c.issueStatus)}</div>` : ''}${c.supportNeeded === true ? '<div class="issue-badge">Có yêu cầu CBLĐ hỗ trợ</div>' : ''}<div class="case-owner">${esc(c.cs)} · ${esc(c.director)}</div></button>`;
}

function findCase(id) { return state.rows.find(c => c.id === id) || (state.selectedCase && state.selectedCase.id === id ? state.selectedCase : null); }

function queueRows() {
  let rows = state.rows.filter(withinT45);
  if (state.queueTab === 'work') rows = rows.filter(c => isOpen(c) && !c.requiresHumanAuthority && (!c.issueStatus || c.issueStatus === 'RESOLVED'));
  if (state.queueTab === 'issues') rows = rows.filter(c => isOpen(c) && (c.requiresHumanAuthority || c.supportNeeded === true || (c.issueStatus && c.issueStatus !== 'RESOLVED')));
  if (state.queueTab === 'completed') rows = rows.filter(c => c.status === 'COMPLETED');
  if (state.branch !== 'ALL') rows = rows.filter(c => c.branch === state.branch);
  if (state.priority !== 'ALL') rows = rows.filter(c => isPriority(c, state.priority));
  if (state.sort === 'due') rows = [...rows].sort((a, b) => a.days - b.days || a.shop.localeCompare(b.shop));
  else if (state.sort === 'shop') rows = [...rows].sort((a, b) => a.shop.localeCompare(b.shop, 'vi'));
  else rows = sortedCases(rows);
  return rows;
}

function workspace() {
  if (state.workspaceState === 'loading') return genericStatePanel('loading');
  if (state.workspaceState === 'denied') return genericStatePanel('denied', state.workspaceError, 'state-retry');
  if (state.workspaceState === 'error') return genericStatePanel('error', state.workspaceError, 'state-retry');
  const rows = queueRows();
  const all = state.rows.filter(withinT45);
  const counts = {
    work: all.filter(c => isOpen(c) && !c.requiresHumanAuthority && (!c.issueStatus || c.issueStatus === 'RESOLVED')).length,
    issues: all.filter(c => isOpen(c) && (c.requiresHumanAuthority || c.supportNeeded === true || (c.issueStatus && c.issueStatus !== 'RESOLVED'))).length,
    completed: all.filter(c => c.status === 'COMPLETED').length
  };
  return `<section class="workspace">${heading(`Xin chào, ${esc(state.cs)}`, 'Bây giờ bạn cần làm gì?')}<div class="scope-strip"><span>CBLĐ</span><strong>${esc(state.director)}</strong><button class="text-button" data-act="change-context">Đổi workspace</button><span class="context-hint">Context chưa phải identity</span></div><div class="quick-stats"><button class="stat-card" data-qtab="work"><span>Đang xử lý</span><strong>${counts.work}</strong></button><button class="stat-card" data-qtab="issues"><span>Có vướng mắc</span><strong>${counts.issues}</strong></button><button class="stat-card urgent" data-priority="OVERDUE"><span>Quá hạn</span><strong>${all.filter(c => isOpen(c) && c.days < 0).length}</strong></button></div><div class="queue-header"><div><p class="eyebrow">ƯU TIÊN HÔM NAY</p><h2>Danh sách công việc</h2></div><span class="result-count">${rows.length} case</span></div><div class="queue-tabs" role="tablist"><button data-qtab="work" class="${state.queueTab === 'work' ? 'selected' : ''}">Công việc <b>${counts.work}</b></button><button data-qtab="issues" class="${state.queueTab === 'issues' ? 'selected' : ''}">Vướng mắc <b>${counts.issues}</b></button><button data-qtab="completed" class="${state.queueTab === 'completed' ? 'selected' : ''}">Đã hoàn tất <b>${counts.completed}</b></button></div><div class="filter-controls"><label>Nhánh<select id="branchFilter"><option value="ALL">Tất cả nhánh</option>${Object.keys(branchLabels).map(k => `<option ${state.branch === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label><label>Ưu tiên<select id="priorityFilter">${[['ALL', 'Tất cả mốc'], ['OVERDUE', 'Quá hạn'], ['T7', 'T-7'], ['T15', 'T-15'], ['T30', 'T-30'], ['T45', 'T-45']].map(([v, l]) => `<option value="${v}" ${state.priority === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label>Sắp xếp<select id="sortFilter"><option value="priority" ${state.sort === 'priority' ? 'selected' : ''}>Ưu tiên</option><option value="due" ${state.sort === 'due' ? 'selected' : ''}>Ngày CKTT</option><option value="shop" ${state.sort === 'shop' ? 'selected' : ''}>Mã căn</option></select></label></div><div class="case-list">${rows.length ? rows.map(card).join('') : `<div class="empty-card"><strong>${state.queueTab === 'completed' ? 'Chưa có case hoàn tất' : 'Không có case phù hợp'}</strong><span>Đổi bộ lọc hoặc chọn tab khác.</span></div>`}</div></section>`;
}

// ---------- Case detail ----------

function field(name, label, value, options, disabled = false) {
  const current = String(value ?? '');
  const recognized = options.some(([v]) => v === current);
  return `<label class="form-field">${esc(label)}<select data-field="${name}" ${disabled ? 'disabled' : ''}><option value="" ${!recognized ? 'selected' : ''}>${!recognized && current ? 'Giá trị nguồn chưa chuẩn hóa' : 'Chọn khi có dữ kiện'}</option>${options.map(([v, l]) => `<option value="${esc(v)}" ${current === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
}
const E = {
  check: [['NOT_CHECKED', 'Chưa kiểm tra'], ['CHECKED', 'Đã kiểm tra']],
  condition: [['BELOW_STANDARD', 'Dưới chuẩn'], ['MEETS_STANDARD', 'Đạt chuẩn'], ['ABOVE_STANDARD', 'Trên chuẩn']],
  repair: [['NOT_REQUIRED', 'Không yêu cầu'], ['RECORDED', 'Đã ghi nhận'], ['IN_REPAIR', 'Đang sửa chữa'], ['COMPLETED', 'Đã sửa chữa']],
  debt: [['UNKNOWN', 'Chưa xác định'], ['PENDING', 'Đang xử lý'], ['CLEARED', 'Đã đối soát'], ['NOT_APPLICABLE', 'Không áp dụng']],
  docs: [['UNKNOWN', 'Chưa xác định'], ['PENDING', 'Đang xử lý'], ['COMPLETE', 'Đủ hồ sơ'], ['NOT_APPLICABLE', 'Không áp dụng']],
  bql: [['PENDING', 'Chờ xác nhận'], ['CONFIRMED', 'Đã xác nhận'], ['NOT_APPLICABLE', 'Không áp dụng']],
  transition: [['NOT_APPLICABLE', 'Không áp dụng'], ['PENDING', 'Đang xử lý'], ['RIGHTS_OBLIGATIONS_DONE', 'Quyền/nghĩa vụ hoàn tất'], ['DEPOSIT_DONE', 'Tiền cọc hoàn tất'], ['THREE_PARTY_CONFIRMED', 'Ba bên xác nhận'], ['COMPLETE', 'Hoàn tất chuyển tiếp']]
};
function historyText(h) {
  if (typeof h === 'string') return h;
  const at = h.created_at || h.at || '';
  const event = h.event_type || h.event || 'Cập nhật';
  const field = h.field_name || h.field;
  const oldV = h.old_value ?? h.oldValue;
  const newV = h.new_value ?? h.newValue;
  return `${at} · ${event}${field ? ` · ${field}: ${oldV ?? '—'} → ${newV ?? '—'}` : ''}`;
}

function detail(c) {
  if (state.detailState === 'denied') return `<section class="state-panel" role="status"><span class="spinner">!</span><h2>Không mở được case này</h2><p>${esc(state.detailError || 'Backend từ chối: case không thuộc workspace hiện tại hoặc không tồn tại.')}</p><div class="state-actions"><button class="button primary" data-back>Quay lại</button></div></section>`;
  if (!c) return `<section class="state-panel"><h2>Không tìm thấy case</h2><button class="button primary" data-back>Quay lại</button></section>`;
  const completed = c.status === 'COMPLETED', authority = c.branch === 'DATA_EXCEPTION', after = c.branch === 'AFTER_CKTT', ro = completed || authority || state.view !== 'workspace';
  const progress = closureProgress(c);
  const ref = c.raw || {};
  const values = authority
    ? [['Mã exception', c.warning], ['Mô tả', c.exception], ['CKTT nguồn', c.ckttDate], ['Tuyến xử lý', 'Human Authority · cần xác minh / cần quyết định']]
    : after
      ? [['HĐT2 tại CKTT', c.branch], ['Ngày bắt đầu HĐT2', c.hdt2Start], ['Ngày kết thúc HĐT2', c.hdt2End], ['Chuyển tiếp HĐT2', ref.hdt2_transition_status]]
      : [['Ngày CKTT', c.ckttDate], ['Kiểm tra hiện trạng', ref.handover_check_status], ['Điều kiện bàn giao', ref.handover_condition], ['Sửa chữa', ref.repair_status]];
  const detailLoadingNote = state.detailState === 'loading' ? '<p class="muted">Đang tải lịch sử / exception từ backend…</p>' : '';
  return `<section class="detail-view">${heading(c.shop, `${esc(c.cs)} · ${esc(c.director)} · dữ liệu thật`, true)}<div class="detail-summary"><div class="case-tags"><span class="branch-tag">${esc(c.branch)}</span>${pill(c)}${origin()}</div><h2 class="detail-due ${c.days < 0 && isOpen(c) ? 'late' : ''}">${esc(dueLabel(c))}</h2><p class="detail-next"><span>VIỆC TIẾP THEO · HỆ THỐNG</span><strong>${esc(c.status === 'COMPLETED' ? 'Đã hoàn tất · chỉ xem' : c.next || 'Chưa ghi nhận')}</strong></p></div>${authority ? `<div class="exception-callout" role="alert"><strong>Cần xác minh / cần quyết định</strong><p>${esc(c.warning || c.exception || 'DATA_EXCEPTION')}</p><small>requires_human_authority=true · Không sửa CKTT, không tự chọn branch, không fallback.</small></div>` : ''}${after ? '<div class="info-callout"><strong>HĐT2 còn hiệu lực sau CKTT</strong><span>Ưu tiên flow chuyển tiếp HĐT2; đây không phải kết luận pháp lý.</span></div>' : ''}<details class="disclosure" open><summary><span>01</span><strong>Tình trạng hiện tại</strong><em>Trường suy ra · chỉ đọc · backend</em></summary><div class="detail-grid derived-field">${[['Mã căn', c.shop], ['Dự án / phân khu', `${c.projectCode || '—'} · ${c.zone || '—'}`], ['Tình trạng case', caseState(c)], ['Branch', c.branch], ['Ưu tiên', c.status === 'COMPLETED' ? '—' : c.days < 0 ? 'OVERDUE' : c.days <= 7 ? 'T7' : c.days <= 15 ? 'T15' : c.days <= 30 ? 'T30' : c.days <= 45 ? 'T45' : 'Ngoài T-45'], ['CKTT', c.ckttDate], ['HĐT2', `${c.hdt2Start || '—'} → ${c.hdt2End || '—'}`], ['CSKH / CBLĐ', `${c.cs} / ${c.director}`]].map(([l, v]) => `<div><small>${esc(l)}</small><strong>${esc(v || 'Chưa có dữ kiện')}</strong></div>`).join('')}</div></details><details class="disclosure" open><summary><span>02</span><strong>${authority ? 'Dữ kiện cần xác minh' : after ? 'Cập nhật chuyển tiếp HĐT2' : 'Cập nhật bàn giao mặt bằng'}</strong><em>${ro ? 'Chỉ đọc' : 'Dữ kiện hệ thống có thể chưa biết'}</em></summary><div class="detail-grid">${values.map(([l, v]) => `<div><small>${esc(l)}</small><strong>${esc(v || 'Chưa có dữ kiện')}</strong></div>`).join('')}</div>${!ro ? `<div class="action-form"><h3>Ghi nhận dữ kiện</h3><p>Chỉ cập nhật dữ kiện vận hành còn thiếu. Branch, next action và trạng thái hoàn tất được backend tính và trả về sau khi lưu.</p><div class="form-grid">${after ? '' : field('handover_check_status', 'Kiểm tra hiện trạng', ref.handover_check_status || '', E.check)}${after ? '' : field('handover_condition', 'Điều kiện bàn giao', ref.handover_condition || '', E.condition)}${after ? '' : field('repair_status', 'Sửa chữa', ref.repair_status || '', E.repair)}${after ? field('hdt2_transition_status', 'Chuyển tiếp HĐT2', ref.hdt2_transition_status || '', E.transition) : ''}${field('debt_status', 'Công nợ · điều kiện đóng', ref.debt_status || '', E.debt)}${field('document_status', 'Hồ sơ', ref.document_status || '', E.docs)}${field('bql_confirmation_status', 'Xác nhận BQL', ref.bql_confirmation_status || '', E.bql)}<label class="form-field">Mã tham chiếu hoàn tất<input data-field="completion_ref" value="${attr(ref.completion_ref || '')}" maxlength="120" placeholder="Nhập mã tham chiếu khi có"></label></div><details class="nested-disclosure"><summary>Ghi nhận vướng mắc / đề xuất</summary><div class="form-grid"><label class="form-field">Loại vướng mắc<input data-field="issue_type" value="${attr(ref.issue_type || '')}" maxlength="120"></label><label class="form-field">Ưu tiên vướng mắc<select data-field="issue_priority"><option value="">Chọn khi có dữ kiện</option><option>NORMAL</option><option ${ref.issue_priority === 'SOON' ? 'selected' : ''}>SOON</option><option ${ref.issue_priority === 'URGENT' ? 'selected' : ''}>URGENT</option></select></label><label class="form-field wide">Mô tả<textarea data-field="issue_text" rows="3">${esc(ref.issue_text || '')}</textarea></label><label class="form-field wide">Đề xuất<textarea data-field="proposal_text" rows="2">${esc(ref.proposal_text || '')}</textarea></label>${field('issue_status', 'Trạng thái vướng mắc', ref.issue_status || '', [['NEW', 'Mới'], ['IN_PROGRESS', 'Đang xử lý'], ['RESOLVED', 'Đã xử lý']])}<label class="support-toggle"><input type="checkbox" data-field="need_cbld_support" ${ref.need_cbld_support === true ? 'checked' : ''}> Cần CBLĐ hỗ trợ</label></div></details><button class="button primary save-action" data-act="save-case" ${state.saving ? 'disabled' : ''}>${state.saving ? 'Đang lưu…' : 'Lưu thay đổi'}</button><p class="save-status" aria-live="polite">${esc(state.feedback)}</p></div>` : ''}<div class="closure-panel"><div class="queue-header"><div><p class="eyebrow">GATE HOÀN TẤT</p><h3>${completed ? 'Gate field evidence' : 'Tiến độ đóng case'} · ${progress.doneCount}/${progress.total}</h3></div><span class="readonly-badge">HỆ THỐNG TÍNH</span></div><ol class="gate-list">${progress.gates.map(g => `<li class="${g.done ? 'gate-done' : 'gate-open'}"><span>${g.done ? '✓' : '○'}</span>${esc(g.label)}</li>`).join('')}</ol>${authority ? '<p class="blocked-note">Bị khóa: cần Human Authority. Không có thao tác hoàn tất.</p>' : completed ? '<p class="success-note">Backend ghi nhận COMPLETED. Case chỉ đọc.</p>' : '<p class="muted">Không có nút tự chọn COMPLETED. Backend chỉ chuyển trạng thái khi đủ mọi điều kiện.</p>'}</div></details><details class="disclosure"><summary><span>03</span><strong>Vướng mắc / hỗ trợ</strong><em>${c.blocker ? 'Có ghi nhận' : 'Chưa ghi nhận'}</em></summary><div class="detail-grid"><div class="wide"><small>Vướng mắc</small><strong>${esc(c.blocker || 'Chưa ghi nhận')}</strong></div><div class="wide"><small>Đề xuất</small><strong>${esc(ref.proposal_text || 'Chưa ghi nhận')}</strong></div><div><small>Yêu cầu CBLĐ hỗ trợ</small><strong>${c.supportNeeded === true ? 'Có' : c.supportNeeded === false ? 'Không' : 'Chưa có dữ kiện'}</strong></div></div></details><details class="disclosure"><summary><span>04</span><strong>Lịch sử / evidence</strong><em>${c.history?.length || 0} mục · chỉ đọc</em></summary>${detailLoadingNote}<ol class="history-list">${(c.history || []).length ? c.history.map(x => `<li>${esc(historyText(x))}</li>`).join('') : '<li>Chưa có lịch sử.</li>'}</ol><p class="source-note">Nguồn ${esc(c.source || 'CSH Production Backend')} · history chỉ đọc</p></details><p class="source-note">${completed ? 'Completed case · read-only · ' : ''}Thay đổi được ghi trực tiếp vào CSH Production Backend (csh_update_case).</p></section>`;
}

// ---------- CBLĐ ----------

function director() {
  if (state.directorState === 'loading') return genericStatePanel('loading');
  if (state.directorState === 'denied') return genericStatePanel('denied', state.directorError, 'director-retry');
  if (state.directorState === 'error') return genericStatePanel('error', state.directorError, 'director-retry');
  const rows = state.directorRows;
  const by = state.directorFilter === 'ALL'
    ? Object.entries(state.selectors).flatMap(([d, people]) => people.map(name => ({ name, director: d, rows: rows.filter(c => c.cs === name && c.director === d) })))
    : (state.selectors[state.directorFilter] || []).map(name => ({ name, director: state.directorFilter, rows: rows.filter(c => c.cs === name && c.director === state.directorFilter) }));
  const selected = state.personFilter;
  const dr = selected ? rows.filter(c => c.cs === selected && c.director === state.personDirector) : [];
  return `<section>${heading('Theo dõi CBLĐ', 'Backlog, quá hạn, hỗ trợ và HĐT2 sau CKTT. Chỉ drill-down, không đổi assignment.')}<label class="field-label">Lọc CBLĐ<select id="directorFilter"><option value="ALL">Tất cả CBLĐ</option>${state.directors.map(d => `<option ${state.directorFilter === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></label><div class="quick-stats supervisor-stats"><button class="stat-card" data-drill="needs"><span>Case cần tôi xử lý</span><strong>${rows.filter(c => c.requiresHumanAuthority || c.days < 0 || c.supportNeeded === true).length}</strong></button><button class="stat-card" data-drill="after"><span>HĐT2 sau CKTT</span><strong>${rows.filter(c => c.branch === 'AFTER_CKTT').length}</strong></button><button class="stat-card urgent" data-drill="overdue"><span>Quá hạn</span><strong>${rows.filter(c => c.days < 0 && isOpen(c)).length}</strong></button><button class="stat-card" data-drill="support"><span>Yêu cầu hỗ trợ</span><strong>${rows.filter(c => c.supportNeeded === true).length}</strong></button></div><div class="queue-header"><div><p class="eyebrow">CSKH</p><h2>Backlog theo nhân sự</h2></div></div><div class="people-list">${by.map(p => `<button class="person-row" data-person="${attr(p.name)}" data-person-director="${attr(p.director)}"><span class="avatar">${esc(p.name.split(' ').slice(-2).map(x => x[0]).join(''))}</span><span class="person-info"><strong>${esc(p.name)}</strong><small>${p.rows.filter(c => isOpen(c) && c.branch !== 'DATA_EXCEPTION').length} đang xử lý · ${p.rows.filter(c => c.days < 0 && isOpen(c)).length} quá hạn · CBLĐ ${esc(p.director)}</small></span><span class="person-open">Xem case →</span></button>`).join('')}</div>${selected ? `<div class="queue-header"><div><p class="eyebrow">DRILL-DOWN</p><h2>${esc(selected)}</h2></div><button class="text-button" data-act="clear-person">Xóa chọn</button></div><div class="case-list">${dr.length ? sortedCases(dr).map(card).join('') : '<div class="empty-card">Không có case phù hợp.</div>'}</div>` : ''}<div class="director-drill-controls"><button class="button secondary" data-drill="overdue">Xem quá hạn</button><button class="button secondary" data-drill="after">Xem AFTER_CKTT</button><button class="button secondary" data-drill="support">Xem cần hỗ trợ</button><button class="button secondary" data-drill="exception">Xem cần quyết định</button></div><div class="case-list">${(state.drillRows || []).map(card).join('')}</div><p class="source-note">Staff Assignment là assignment hiện hành. Selector chỉ hiển thị nhóm; không có thao tác sửa assignment.</p></section>`;
}

// ---------- Leadership ----------

function leadership() {
  if (state.leadershipState === 'loading') return genericStatePanel('loading');
  if (state.leadershipState === 'error') return genericStatePanel('error', state.leadershipError, 'leadership-retry');
  const dash = state.leadershipDashboard;
  const rows = state.leadershipRows;
  if (!dash) return genericStatePanel('loading');
  const s = dash.summary;
  const br = Object.entries(dash.branches || {}).filter(([, n]) => n);
  const cb = (dash.teams || []).map(t => [t.cbld_name, t.active_cases]);
  const metric = (label, n, key) => `<button class="lead-kpi" data-kpi="${key}"><span>${label}</span><strong>${n}</strong><small>Chạm để xem case</small></button>`;
  return `<section>${heading('Toàn cảnh CSH', `${s.universe} shop CSH-Cho thuê có CKTT · CSH Production Backend · chỉ đọc`)}<div class="readonly-banner">Leadership view · read-only</div><div class="lead-kpis">${metric('Total universe', s.universe, 'universe')}${metric('Onboarded T-45', s.onboarded_active, 'onboarded')}${metric('Overdue', s.overdue, 'overdue')}${metric('Completed', s.completed, 'completed')}${metric('Open exceptions', s.open_exceptions, 'exceptions')}${metric('AFTER_CKTT', s.after_cktt, 'after')}</div><div class="lead-grid"><article class="panel"><p class="eyebrow">BRANCH DISTRIBUTION</p><h2>Branch · chạm để lọc</h2>${br.map(([b, n]) => `<button class="bar-row bar-button" data-branch="${b}"><span>${b}</span><i class="bar-track"><i style="width:${Math.max(8, n / Math.max(1, s.universe) * 100)}%"></i></i><strong>${n}</strong></button>`).join('')}</article><article class="panel"><p class="eyebrow">THEO CBLĐ</p><h2>Phân bố universe</h2>${cb.map(([d, n]) => `<button class="bar-row bar-button" data-cbld="${attr(d)}"><span>${esc(d)}</span><i class="bar-track"><i style="width:${Math.max(8, n / Math.max(1, s.universe) * 100)}%"></i></i><strong>${n}</strong></button>`).join('')}</article></div><div class="lead-drills"><button class="button secondary" data-kpi="after">Case AFTER_CKTT</button><button class="button secondary" data-kpi="decision">Case cần quyết định</button><button class="button secondary" data-kpi="support">Case cần hỗ trợ</button></div><div class="queue-header"><div><p class="eyebrow">DRILL-DOWN · READ ONLY</p><h2>${esc(state.leadTitle || 'Case cần quyết định')}</h2></div><span class="readonly-badge">CHỈ ĐỌC</span></div><div class="case-list">${(state.leadRows || rows.filter(c => c.branch === 'DATA_EXCEPTION')).map(card).join('') || '<div class="empty-card">Không có case trong nhóm này.</div>'}</div></section>`;
}

// ---------- render ----------

function render() {
  let content;
  if (state.view === 'home') content = home();
  else if (state.selected) content = detail(findCase(state.selected));
  else if (state.view === 'workspace') content = workspace();
  else if (state.view === 'director') content = director();
  else content = leadership();
  app.innerHTML = topnav() + content;
  bind();
}

function navigateCase(id) {
  state.selected = id; state.detailOrigin = state.view; state.feedback = '';
  state.scrollY = window.scrollY; state.detailState = 'loading'; state.detailError = '';
  const existing = findCase(id);
  if (existing) state.selectedCase = existing;
  render();
  window.scrollTo(0, 0);
  loadCaseDetail(id);
}

async function loadCaseDetail(id) {
  try {
    const payload = await backend.getCase(id, state.director, state.cs);
    const base = state.rows.find(c => c.id === id) || adaptBackendCase(payload.case);
    state.selectedCase = enrichWithCaseDetail(base, payload);
    state.detailState = 'ready';
  } catch (err) {
    state.detailState = classifyError(err);
    state.detailError = errorMessage(err);
  }
  if (state.selected === id) render();
}

// ---------- data loading ----------

async function loadSelectors() {
  state.selectorsState = 'loading'; render();
  try {
    const rows = await backend.getWorkspaceSelectors();
    const map = {};
    for (const r of rows) map[r.cbld_name] = r.cskh_names;
    state.selectors = map;
    state.directors = Object.keys(map).sort((a, b) => a.localeCompare(b, 'vi'));
    state.selectorsState = 'ready';
  } catch (err) {
    state.selectorsState = 'error';
    state.selectorsError = errorMessage(err);
  }
  render();
}

async function enterWorkspace() {
  state.workspaceState = 'loading'; render();
  try {
    const [active, completedList] = await Promise.all([
      backend.getWorkspace(state.director, state.cs),
      backend.getCompletedCases(state.director, state.cs)
    ]);
    state.rows = [...active, ...completedList].map(adaptBackendCase);
    state.workspaceState = 'ready';
    state.view = 'workspace'; state.queueTab = 'work'; state.branch = 'ALL'; state.priority = 'ALL'; state.sort = 'priority';
  } catch (err) {
    state.workspaceState = classifyError(err);
    state.workspaceError = errorMessage(err);
  }
  render();
}

async function loadDirectorRows() {
  state.directorState = 'loading'; render();
  try {
    state.directorRows = state.directorFilter === 'ALL'
      ? (await backend.getLeadershipCases()).map(adaptBackendCase)
      : (await backend.getCbldCases(state.directorFilter)).map(adaptBackendCase);
    state.directorState = 'ready';
  } catch (err) {
    state.directorState = classifyError(err);
    state.directorError = errorMessage(err);
  }
  render();
}

async function loadLeadership() {
  state.leadershipState = 'loading'; render();
  try {
    const [dash, rows] = await Promise.all([backend.getLeadershipDashboard(), backend.getLeadershipCases()]);
    state.leadershipDashboard = dash;
    state.leadershipRows = rows.map(adaptBackendCase);
    state.leadershipState = 'ready';
  } catch (err) {
    state.leadershipState = 'error';
    state.leadershipError = errorMessage(err);
  }
  render();
}

// ---------- bind ----------

function bind() {
  app.querySelectorAll('[data-view]').forEach(b => b.onclick = () => {
    state.view = b.dataset.view; state.selected = ''; state.feedback = '';
    if (state.view === 'home') { /* keep selected context for re-entry */ }
    if (state.view === 'director' && state.directorState === 'idle') loadDirectorRows();
    else if (state.view === 'director') render();
    else if (state.view === 'leadership' && state.leadershipState === 'idle') loadLeadership();
    else render();
  });
  app.querySelector('#cbldSelect')?.addEventListener('change', e => { state.director = e.target.value; state.cs = ''; render(); });
  app.querySelector('#cskhSelect')?.addEventListener('change', e => { state.cs = e.target.value; render(); });
  app.querySelector('#directorFilter')?.addEventListener('change', e => { state.directorFilter = e.target.value; state.personFilter = ''; state.personDirector = ''; state.drillRows = []; state.directorState = 'idle'; loadDirectorRows(); });
  app.querySelector('[data-act="enter"]')?.addEventListener('click', enterWorkspace);
  app.querySelectorAll('[data-case]').forEach(b => b.onclick = () => navigateCase(b.dataset.case));
  app.querySelectorAll('[data-qtab]').forEach(b => b.onclick = () => { state.queueTab = b.dataset.qtab; render(); });
  app.querySelector('#branchFilter')?.addEventListener('change', e => { state.branch = e.target.value; render(); });
  app.querySelector('#priorityFilter')?.addEventListener('change', e => { state.priority = e.target.value; render(); });
  app.querySelector('#sortFilter')?.addEventListener('change', e => { state.sort = e.target.value; render(); });
  app.querySelector('[data-priority]')?.addEventListener('click', () => { state.queueTab = 'work'; state.priority = 'OVERDUE'; render(); });
  app.querySelector('[data-back]')?.addEventListener('click', () => { state.selected = ''; state.feedback = ''; render(); window.scrollTo(0, state.scrollY || 0); });
  app.querySelector('[data-act="change-context"]')?.addEventListener('click', () => { state.view = 'home'; state.selected = ''; state.workspaceState = 'idle'; render(); });
  app.querySelectorAll('[data-person]').forEach(b => b.onclick = () => { state.personFilter = b.dataset.person; state.personDirector = b.dataset.personDirector; state.drillRows = []; render(); });
  app.querySelector('[data-act="clear-person"]')?.addEventListener('click', () => { state.personFilter = ''; state.personDirector = ''; render(); });
  app.querySelectorAll('[data-drill]').forEach(b => b.onclick = () => {
    const key = b.dataset.drill;
    const rows = state.directorRows;
    state.drillRows = sortedCases(rows.filter(c => key === 'needs' ? (c.requiresHumanAuthority || c.days < 0 || c.supportNeeded === true) : key === 'after' ? c.branch === 'AFTER_CKTT' : key === 'overdue' ? (c.days < 0 && isOpen(c)) : key === 'support' ? c.supportNeeded === true : c.branch === 'DATA_EXCEPTION'));
    render();
  });
  app.querySelectorAll('[data-kpi]').forEach(b => b.onclick = () => {
    const k = b.dataset.kpi; const rows = state.leadershipRows;
    const match = rows.filter(c => k === 'universe' ? true : k === 'onboarded' ? c.onboardedT45 : k === 'overdue' ? (c.days < 0 && isOpen(c)) : k === 'completed' ? c.status === 'COMPLETED' : k === 'exceptions' ? c.branch === 'DATA_EXCEPTION' : k === 'after' ? c.branch === 'AFTER_CKTT' : k === 'support' ? c.supportNeeded === true : c.branch === 'DATA_EXCEPTION');
    state.leadTitle = b.textContent.trim().split('\n')[0]; state.leadRows = sortedCases(match); render();
  });
  app.querySelectorAll('[data-branch]').forEach(b => b.onclick = () => { state.leadTitle = `Branch ${b.dataset.branch}`; state.leadRows = state.leadershipRows.filter(c => c.branch === b.dataset.branch); render(); });
  app.querySelectorAll('[data-cbld]').forEach(b => b.onclick = () => { state.leadTitle = `CBLĐ ${b.dataset.cbld}`; state.leadRows = state.leadershipRows.filter(c => c.director === b.dataset.cbld); render(); });
  app.querySelector('[data-act="home"]')?.addEventListener('click', () => { state.view = 'home'; render(); });
  app.querySelector('[data-act="state-retry"]')?.addEventListener('click', () => { if (state.director && state.cs) enterWorkspace(); else { state.view = 'home'; state.workspaceState = 'idle'; render(); } });
  app.querySelector('[data-act="reload-selectors"]')?.addEventListener('click', loadSelectors);
  app.querySelector('[data-act="director-retry"]')?.addEventListener('click', loadDirectorRows);
  app.querySelector('[data-act="leadership-retry"]')?.addEventListener('click', loadLeadership);
  app.querySelectorAll('[data-field]').forEach(el => {
    el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => el.dataset.dirty = 'true');
    if (el.tagName === 'SELECT') el.addEventListener('change', () => el.dataset.dirty = 'true');
  });
  app.querySelector('[data-act="save-case"]')?.addEventListener('click', saveCase);
}

async function saveCase() {
  const c = findCase(state.selected);
  if (!c) return;
  const changes = {};
  app.querySelectorAll('[data-field][data-dirty="true"]').forEach(el => {
    const k = el.dataset.field;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (typeof v === 'string') v = v.trim();
    if (v === '' && el.tagName === 'SELECT') return; // unchanged / not selected
    changes[k] = v;
  });
  const unknown = Object.keys(changes).filter(k => !sandboxWritableFields.includes(k));
  if (unknown.length) { state.feedback = `Trường không hợp lệ: ${unknown.join(', ')}`; render(); return; }
  if (!Object.keys(changes).length) { state.feedback = 'Chưa có thay đổi nào để lưu.'; render(); return; }
  state.saving = true; render();
  try {
    await backend.updateCase(c.shop, state.director, state.cs, changes);
    const payload = await backend.getCase(c.shop, state.director, state.cs);
    const updated = enrichWithCaseDetail(adaptBackendCase(payload.case), payload);
    state.selectedCase = updated;
    const idx = state.rows.findIndex(r => r.id === updated.id);
    if (idx >= 0) state.rows[idx] = updated;
    state.feedback = updated.status === 'COMPLETED' ? 'Đủ gate; backend đã chuyển case sang completed (chỉ đọc).' : 'Đã lưu vào CSH Production Backend.';
  } catch (err) {
    state.feedback = mapWriteError(err);
  }
  state.saving = false;
  render();
}

function mapWriteError(err) {
  if (!(err instanceof BackendError)) return 'Lưu thất bại: lỗi không xác định.';
  switch (err.code) {
    case 'WORKSPACE_ASSIGNMENT_MISMATCH': return 'Ngữ cảnh không còn hợp lệ; vui lòng đổi workspace rồi thử lại.';
    case 'CASE_ALREADY_COMPLETED': return 'Case đã hoàn tất; không thể chỉnh sửa thêm.';
    case 'NO_ALLOWED_CHANGES': return 'Chưa có thay đổi nào để lưu.';
    case 'SESSION_REQUIRED': return 'Thiếu session kỹ thuật; tải lại trang và thử lại.';
    case 'BACKEND_UNAVAILABLE': return 'Không kết nối được backend; vui lòng thử lại.';
    default:
      if (err.code.startsWith('UNKNOWN_OR_SYSTEM_FIELD')) return 'Trường dữ liệu không hợp lệ hoặc không được phép chỉnh sửa; không có gì được lưu.';
      return `Backend từ chối: ${err.message}`;
  }
}

document.querySelector('#helpButton')?.addEventListener('click', () => document.querySelector('#helpDialog')?.showModal());
document.querySelectorAll('#helpDialog [data-close]').forEach(b => b.onclick = () => document.querySelector('#helpDialog').close());

render();
loadSelectors();
