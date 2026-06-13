/**
 * Auto-sync content script — runs on the Aura Talent web app.
 *
 * Content scripts share the page's origin and therefore its localStorage, where
 * supabase-js keeps the session. Whenever the session appears or changes (login,
 * logout, or the web app's own silent token refresh), we relay it to the service
 * worker so the extension's stored credentials stay current with zero clicks.
 *
 * Standalone (no imports) — manifest/dynamic content scripts aren't ES modules.
 */
(() => {
  function readSession() {
    const out = { userId: null, token: null, refreshToken: null, expiresAt: null, email: null, name: null, supabaseUrl: null };
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const ref = key.slice(3, key.length - "-auth-token".length);
      if (ref) out.supabaseUrl = `https://${ref}.supabase.co`;
      let parsed;
      try { parsed = JSON.parse(localStorage.getItem(key)); } catch { continue; }
      const sess = parsed?.currentSession || parsed;
      if (sess?.access_token) out.token = sess.access_token;
      if (sess?.refresh_token) out.refreshToken = sess.refresh_token;
      if (sess?.expires_at) out.expiresAt = sess.expires_at;
      const user = sess?.user || parsed?.user;
      if (user?.id) {
        out.userId = user.id;
        out.email = user.email || null;
        out.name = user.user_metadata?.full_name || user.user_metadata?.name || null;
      }
    }
    return out;
  }

  let lastToken = null;
  function push(force) {
    const s = readSession();
    // Only message on a real change (or forced first run) to avoid chatter.
    if (!force && s.token === lastToken) return;
    lastToken = s.token;
    chrome.runtime
      .sendMessage({ action: "sessionUpdate", payload: s })
      .catch(() => { /* worker asleep / extension reloading — ignore */ });
  }

  push(true);
  // 'storage' fires for changes made in *other* tabs of the same origin.
  window.addEventListener("storage", () => push(false));
  // Same-tab refreshes don't fire 'storage', so poll lightly and on refocus.
  setInterval(() => push(false), 60_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") push(false);
  });
})();
