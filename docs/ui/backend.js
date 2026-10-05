// CSH Leasing Rights Control — production UI backend adapter (GATEWAY-ONLY).
//
// This adapter talks ONLY to the csh-gateway Edge Function's two operations (op:"login",
// op:"call"). It makes NO direct calls to /rest/v1/rpc/* or any other PostgREST path, and it
// carries NO Supabase API key of any kind — the legacy anon JWT that used to live in this file is
// gone entirely. The real access boundary is the shared access code -> short-lived gateway
// session token flow; this file is a thin, dumb transport for that flow plus the 9 allowlisted
// business calls. No business-rule computation happens here or anywhere else in the client.
//
// Exported surface (backend, BackendError) is intentionally unchanged from the pre-gateway
// version so app.js needed zero changes for its existing call sites.

const GATEWAY_URL = 'https://pxkpljnuxcedavdkoeko.supabase.co/functions/v1/csh-gateway';
const SESSION_STORAGE_KEY = 'csh_gateway_session_token';

export class BackendError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'BackendError';
    this.code = code;
  }
}

// Session token: sessionStorage (cleared when the tab closes) with an in-memory fallback if
// sessionStorage throws (private-mode edge cases). Never localStorage, never a cookie — the token
// must not outlive this tab or be sent automatically to anything.
let memoryToken = null;
function readToken() {
  try { return sessionStorage.getItem(SESSION_STORAGE_KEY); } catch { return memoryToken; }
}
function writeToken(token) {
  memoryToken = token;
  try {
    if (token) sessionStorage.setItem(SESSION_STORAGE_KEY, token);
    else sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch { /* sessionStorage unavailable — memory fallback above already applied */ }
}

export function hasSession() { return !!readToken(); }

// Clears the token with no network call — used before returning to the access-code screen.
export function clearSession() { writeToken(null); }

async function gatewayFetch(body) {
  let res;
  try {
    res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (networkErr) {
    throw new BackendError('BACKEND_UNAVAILABLE', networkErr?.message || 'Network request failed');
  }
  let payload = null;
  const text = await res.text();
  if (text) { try { payload = JSON.parse(text); } catch { payload = text; } }
  return { res, payload };
}

function gatewayErrorCode(payload, status) {
  const raw = (payload && typeof payload === 'object' && (payload.message || payload.error))
    || (typeof payload === 'string' ? payload : null)
    || `HTTP_${status}`;
  return { rawMessage: raw, code: String(raw).split(':')[0].trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_') || `HTTP_${status}` };
}

// Submits the shared access code to the gateway and stores the returned session token. Throws
// BackendError with the gateway's own code (INVALID_CODE, TEMPORARILY_LOCKED,
// RATE_LIMIT_UNAVAILABLE, GATEWAY_NOT_CONFIGURED, ORIGIN_NOT_ALLOWED, ...) on anything else.
export async function login(code) {
  const { res, payload } = await gatewayFetch({ op: 'login', code });
  if (!res.ok) {
    const { rawMessage, code: errCode } = gatewayErrorCode(payload, res.status);
    throw new BackendError(errCode, String(rawMessage));
  }
  if (!payload || typeof payload.token !== 'string' || !payload.token) {
    throw new BackendError('LOGIN_RESPONSE_INVALID', 'Gateway did not return a session token.');
  }
  writeToken(payload.token);
  return true;
}

async function call(fn, params) {
  const token = readToken();
  if (!token) throw new BackendError('SESSION_REQUIRED', 'No active gateway session.');
  const { res, payload } = await gatewayFetch({ op: 'call', token, fn, params: params || {} });
  if (res.status === 401) {
    // The gateway no longer honors this token (missing, invalid, or expired). Never keep using a
    // token the gateway rejected: clear it and send the user back to the access-code screen.
    clearSession();
    window.location.reload();
    throw new BackendError('SESSION_EXPIRED', 'Phiên làm việc đã hết hạn — quay lại màn hình nhập mã truy cập.');
  }
  if (!res.ok) {
    // Preserve the exact error-code shape the rest of the app already understands: for a
    // business-RPC failure the gateway passes the underlying RPC's {message,...} payload through
    // unchanged (e.g. WORKSPACE_ASSIGNMENT_MISMATCH); for a gateway-level failure it is {error:
    // "CODE"}. Either way the leading token of that message/error is the stable code.
    const { rawMessage, code: errCode } = gatewayErrorCode(payload, res.status);
    throw new BackendError(errCode, String(rawMessage));
  }
  return payload;
}

export const backend = {
  getWorkspaceSelectors: () => call('csh_get_workspace_selectors'),
  getWorkspace: (cbld, cskh) => call('csh_get_workspace', { p_cbld: cbld, p_cskh: cskh }),
  getCompletedCases: (cbld, cskh) => call('csh_get_completed_cases', { p_cbld: cbld, p_cskh: cskh }),
  getCase: (shopId, cbld, cskh) => call('csh_get_case', { p_shop_id: shopId, p_cbld: cbld, p_cskh: cskh }),
  getCbldDashboard: (cbld) => call('csh_get_cbld_dashboard', { p_cbld: cbld }),
  getCbldCases: (cbld) => call('csh_get_cbld_cases', { p_cbld: cbld }),
  getLeadershipDashboard: () => call('csh_get_leadership_dashboard'),
  getLeadershipCases: () => call('csh_get_leadership_cases'),
  // No client-side session id is sent any more — the gateway injects its own authoritative
  // session_id server-side for csh_update_case. The client cannot set or influence it.
  updateCase: (shopId, cbld, cskh, changes) => call('csh_update_case', {
    p_shop_id: shopId, p_cbld: cbld, p_cskh: cskh, p_changes: changes
  })
};
