// CSH Leasing Rights Control — production entry gate.
//
// Runs BEFORE the persona-selection screen (./app.js). If a gateway session already exists in
// this tab (sessionStorage token from an earlier successful login), the real app loads
// immediately. Otherwise this renders a single shared-access-code screen; only a successful
// csh-gateway login hands control to app.js. This file does no business-rule computation and
// knows nothing about CSH case data — it only decides whether a gateway session exists.
//
// Built from the already-approved design-system pieces (.hero/.entry-card/.entry-step/
// .field-label/.button.primary/.entry-submit/.assignment-proof/.blocked-note from
// styles.css + interactive.css) rather than new CSS, per the integration-only scope for this
// screen.

import { hasSession, login, BackendError } from './backend.js';

const app = document.querySelector('#app');

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderGate(opts = {}) {
  const { error = '', locked = false, busy = false } = opts;
  app.innerHTML = `<section class="hero">
    <div class="page-heading">
      <div>
        <p class="eyebrow">CSH LEASING RIGHTS CONTROL</p>
        <h1>Mã truy cập</h1>
        <p class="muted">Nhập mã truy cập dùng chung để vào hệ thống.</p>
      </div>
    </div>
    <div class="entry-card">
      <div class="entry-step">
        <span>●</span>
        <div><strong>Mã truy cập dùng chung</strong><small>Không phải tài khoản cá nhân — không nhập thông tin đăng nhập nào khác tại đây</small></div>
      </div>
      <label class="field-label" for="accessCode">Mã truy cập</label>
      <input id="accessCode" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" ${locked || busy ? 'disabled' : ''} />
      ${error ? `<div class="blocked-note" role="alert" style="margin-top:12px">${escapeHtml(error)}</div>` : ''}
      <button class="button primary entry-submit" id="accessSubmit" ${locked || busy ? 'disabled' : ''}>${busy ? 'Đang kiểm tra…' : 'Vào hệ thống'} <span>→</span></button>
      <p class="assignment-proof"><span class="proof-dot"></span> Backend xác thực mã truy cập; phiên làm việc chỉ lưu tạm trong trình duyệt này, không lưu lâu dài.</p>
    </div>
    <div class="entry-footer"><span class="sandbox-tag live-tag"><i></i> CSH PRODUCTION BACKEND</span></div>
  </section>`;

  const input = app.querySelector('#accessCode');
  const submit = app.querySelector('#accessSubmit');
  input?.focus();

  const attempt = async () => {
    const code = input.value;
    if (!code) return;
    renderGate({ busy: true });
    try {
      await login(code);
      await bootApp();
    } catch (err) {
      handleLoginError(err);
    }
  };

  submit?.addEventListener('click', attempt);
  input?.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });
}

function handleLoginError(err) {
  if (err instanceof BackendError) {
    if (err.code === 'TEMPORARILY_LOCKED') {
      renderGate({ error: 'Tạm thời bị khóa do nhập sai mã nhiều lần. Vui lòng thử lại sau.', locked: true });
      return;
    }
    if (err.code === 'INVALID_CODE') {
      renderGate({ error: 'Mã truy cập không đúng.' });
      return;
    }
    if (err.code === 'CODE_REQUIRED') {
      renderGate({ error: 'Vui lòng nhập mã truy cập.' });
      return;
    }
    if (err.code === 'RATE_LIMIT_UNAVAILABLE' || err.code === 'GATEWAY_NOT_CONFIGURED' || err.code === 'ORIGIN_NOT_ALLOWED' || err.code === 'SESSION_CREATE_FAILED') {
      renderGate({ error: 'Hệ thống tạm thời không sẵn sàng. Vui lòng thử lại sau.' });
      return;
    }
    renderGate({ error: 'Không kết nối được CSH Production Backend. Kiểm tra mạng và thử lại.' });
    return;
  }
  renderGate({ error: String(err?.message || err || 'Lỗi không xác định') });
}

async function bootApp() {
  app.innerHTML = '';
  await import('./app.js');
}

if (hasSession()) {
  bootApp();
} else {
  renderGate();
}
