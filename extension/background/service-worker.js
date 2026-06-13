/**
 * Service worker — backend calls + session sync + token refresh.
 *
 * Fetches run with the extension's host permissions, so cross-origin calls to
 * the configured API base are NOT subject to page CORS. Identity is adopted
 * from the logged-in Aura Talent web app: the content script (content/sync.js)
 * pushes the session here automatically, and a one-shot connect (syncSession)
 * covers the case where no app tab was open at install time.
 */
import { getSettings, setSettings } from "../lib/storage.js";
import { readWebSession } from "../lib/session.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/config.js";

class NotConnectedError extends Error {
  constructor() { super("Not connected — sign in to Aura Talent first."); this.status = 401; }
}

function appOrigin(apiBase) {
  return new URL(apiBase.replace(/\/+$/, "")).origin;
}

/* ── Token freshness ───────────────────────────────────────────────────── */

/**
 * Exchange the stored refresh token for a new access token via Supabase. Used
 * when no app tab is open to keep the token fresh for us. Returns true on
 * success; on a hard failure it signs out so the UI can prompt re-login.
 */
async function refreshAccessToken() {
  const s = await getSettings();
  const { refreshToken } = s;
  // Options values win; fall back to the bundled defaults (lib/config.js).
  const url = (s.supabaseUrl || SUPABASE_URL).replace(/\/+$/, "");
  const anonKey = s.supabaseAnonKey || SUPABASE_ANON_KEY;
  if (!refreshToken || !url || !anonKey) return false;
  try {
    const resp = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!resp.ok) {
      if (resp.status === 400 || resp.status === 401) await signOut();
      return false;
    }
    const data = await resp.json();
    const prev = await getSettings();
    await setSettings({
      token: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
      userId: data.user?.id || prev.userId,
      email: data.user?.email || prev.email,
    });
    return true;
  } catch {
    return false; // offline / network — keep creds, let the call surface the error
  }
}

/** Refresh proactively if the token is within 60s of expiry. */
async function ensureFreshToken() {
  const { token, expiresAt } = await getSettings();
  if (!token || !expiresAt) return;
  if (expiresAt - Math.floor(Date.now() / 1000) < 60) await refreshAccessToken();
}

/* ── Backend calls (auto-retry once on 401 after a refresh) ─────────────── */

async function authedFetch(path, init) {
  const settings = await getSettings();
  if (!settings.userId || !settings.token) throw new NotConnectedError();
  const base = settings.apiBase.replace(/\/+$/, "");

  const doFetch = async () => {
    const { token } = await getSettings();
    const headers = { Accept: "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) };
    return fetch(`${base}/api/backend/${path}`, { ...init, headers });
  };

  await ensureFreshToken();
  let resp = await doFetch();
  if (resp.status === 401 && (await refreshAccessToken())) {
    resp = await doFetch(); // retry once with the new token
  }
  return resp;
}

async function callBackend(path, body) {
  const resp = await authedFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    let detail = `Request failed (${resp.status})`;
    try {
      const data = await resp.json();
      if (data.detail) detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch { /* non-JSON */ }
    const err = new Error(detail);
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}

// callBackend always sends user_id in the body; build it here so authedFetch
// stays generic.
async function postWithUser(path, body) {
  const { userId } = await getSettings();
  return callBackend(path, { user_id: userId, ...body });
}

async function getResume() {
  const { userId } = await getSettings();
  const resp = await authedFetch(`resume/${userId}`, { method: "GET" });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`Could not load resume (${resp.status})`);
  return resp.json();
}

/* ── Session sync ──────────────────────────────────────────────────────── */

async function storeSession(s) {
  if (s?.userId && s?.token) {
    const patch = {
      userId: s.userId,
      token: s.token,
      refreshToken: s.refreshToken || "",
      expiresAt: s.expiresAt || 0,
      email: s.email || "",
      name: s.name || "",
    };
    // Auto-fill the project URL from the session; never touch the anon key here.
    if (s.supabaseUrl) patch.supabaseUrl = s.supabaseUrl;
    await setSettings(patch);
    return true;
  }
  return false;
}

/** One-shot connect: read the session from an open app tab on demand. */
async function syncSession() {
  const { apiBase } = await getSettings();
  const origin = appOrigin(apiBase);
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: `${origin}/*` });
  } catch {
    return { connected: false, reason: "no-permission", origin };
  }
  if (!tabs.length) return { connected: false, reason: "no-tab", origin };

  for (const tab of tabs) {
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: readWebSession,
      });
      if (await storeSession(result)) {
        return { connected: true, email: result.email, name: result.name, userId: result.userId };
      }
    } catch { /* not scriptable / no permission — try the next */ }
  }
  return { connected: false, reason: "not-signed-in", origin };
}

async function getStatus() {
  const { userId, token, email, name, apiBase } = await getSettings();
  return { connected: Boolean(userId && token), email, name, userId, apiBase };
}

async function signOut() {
  await setSettings({ userId: "", token: "", refreshToken: "", expiresAt: 0, email: "", name: "" });
  return { connected: false };
}

const ACTIONS = {
  evaluate: ({ jd_text, jd_url }) => postWithUser("jobs/evaluate", { jd_text, jd_url }),
  tailor: ({ jd_text, jd_url }) => postWithUser("resume/suggestions", { jd_text, jd_url }),
  // Cover-letter draft → { cover_letter_markdown, subject_line, key_points }.
  cover: (payload) => postWithUser("resume/cover-letter", payload),
  checkResume: () => getResume(),
  // Auth/session.
  syncSession: () => syncSession(),
  getStatus: () => getStatus(),
  signOut: () => signOut(),
  // Pushed by the content script whenever the web app session changes. A logged
  // -out push (no token) clears the extension so it tracks the website.
  sessionUpdate: async (s) => {
    if (s?.userId && s?.token) return { connected: await storeSession(s) };
    await signOut();
    return { connected: false };
  },
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handler = ACTIONS[msg?.action];
  if (!handler) {
    sendResponse({ ok: false, error: `Unknown action: ${msg?.action}` });
    return false;
  }
  handler(msg.payload || {})
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: err.message, status: err.status }));
  return true; // keep the channel open for the async response
});
