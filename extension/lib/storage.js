/** Shared settings access. Used by popup, options, and service worker. */

export const DEFAULTS = {
  // The Next.js app base URL. All calls go through its /api/backend proxy,
  // so the backend API key never lives in the extension. Defaults to production;
  // for local dev, change it to http://localhost:3000 in Options.
  apiBase: "https://aura-talent-frontend-new.vercel.app",
  // Identity + auth. These are populated by adopting the logged-in Supabase
  // session from an open Aura Talent tab — never set by hand. `userId` is the
  // auth user id (so it matches the web account exactly); `token` is the
  // Supabase access token; `email`/`name` are shown in the UI.
  userId: "",
  token: "",
  refreshToken: "",
  expiresAt: 0, // unix seconds; 0 = unknown
  email: "",
  name: "",
  // Supabase config for refreshing an expired token when no app tab is open.
  // URL is auto-derived from the session; the anon (publishable) key is pasted
  // once in Options. Both empty = no offline refresh (tab-based sync still works).
  supabaseUrl: "",
  supabaseAnonKey: "",
};

export async function getSettings() {
  const stored = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...stored };
}

export async function setSettings(patch) {
  await chrome.storage.sync.set(patch);
}

export async function isConnected() {
  const { userId, token } = await getSettings();
  return Boolean(userId && token);
}
