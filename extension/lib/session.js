/**
 * Reads the logged-in Supabase session out of the Aura Talent web app.
 *
 * Injected into an open app tab via chrome.scripting.executeScript, so it must
 * be fully self-contained (no imports/closures). supabase-js stores the session
 * in localStorage under a key like `sb-<project-ref>-auth-token`. After login
 * the web app also mirrors the auth user id into `aura_uid` — that's the exact
 * id the backend keys the resume on, so the extension adopts it verbatim.
 */
export function readWebSession() {
  const out = { userId: null, token: null, refreshToken: null, expiresAt: null, email: null, name: null, supabaseUrl: null };
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      // Derive the project URL from the key: `sb-<ref>-auth-token`.
      const ref = key.slice(3, key.length - "-auth-token".length);
      if (ref) out.supabaseUrl = `https://${ref}.supabase.co`;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      let parsed;
      try { parsed = JSON.parse(raw); } catch { continue; }
      // Different supabase-js versions wrap the session differently.
      const sess = parsed?.currentSession || parsed;
      if (sess?.access_token) out.token = sess.access_token;
      if (sess?.refresh_token) out.refreshToken = sess.refresh_token;
      if (sess?.expires_at) out.expiresAt = sess.expires_at; // unix seconds
      const user = sess?.user || parsed?.user;
      if (user?.id) {
        out.userId = user.id;
        out.email = user.email || null;
        out.name = user.user_metadata?.full_name || user.user_metadata?.name || null;
      }
    }
    // Fallback to the mirrored id if the session blob was shaped unexpectedly.
    if (!out.userId) out.userId = localStorage.getItem("aura_uid") || null;
  } catch (e) {
    out.error = String(e);
  }
  return out;
}
