import { getSettings, setSettings, DEFAULTS } from "../lib/storage.js";

const $ = (id) => document.getElementById(id);
const send = (action) => chrome.runtime.sendMessage({ action });

async function load() {
  const s = await getSettings();
  $("apiBase").value = s.apiBase || "";
  $("supabaseUrl").value = s.supabaseUrl || "";
  $("supabaseAnonKey").value = s.supabaseAnonKey || "";
  await refreshStatus();
}

async function refreshStatus() {
  const status = (await send("getStatus"))?.data || {};
  // The URL is auto-derived on connect — surface it if the field is still empty.
  if (!$("supabaseUrl").value) {
    const { supabaseUrl } = await getSettings();
    if (supabaseUrl) $("supabaseUrl").value = supabaseUrl;
  }
  const dot = $("dot");
  if (status.connected) {
    dot.className = "dot on";
    $("conn-line").textContent = status.email ? `Signed in as ${status.email}` : "Signed in";
    $("conn-sub").textContent = `User ID: ${status.userId}`;
    $("connect").style.display = "none";
    $("disconnect").style.display = "";
  } else {
    dot.className = "dot off";
    $("conn-line").textContent = "Not connected";
    $("conn-sub").textContent = "Sign in on the web app, then click Connect.";
    $("connect").style.display = "";
    $("disconnect").style.display = "none";
  }
}

$("save").addEventListener("click", async () => {
  const apiBase = ($("apiBase").value || DEFAULTS.apiBase).trim().replace(/\/+$/, "");
  await setSettings({
    apiBase,
    supabaseUrl: $("supabaseUrl").value.trim().replace(/\/+$/, ""),
    supabaseAnonKey: $("supabaseAnonKey").value.trim(),
  });
  $("saved").textContent = "Saved ✓";
  setTimeout(() => ($("saved").textContent = ""), 1800);
});

$("connect").addEventListener("click", async () => {
  $("connect").textContent = "Connecting…";
  const resp = await send("syncSession");
  $("connect").textContent = "Connect";
  if (!(resp?.ok && resp.data?.connected)) {
    const reason = resp?.data?.reason;
    $("conn-sub").textContent =
      reason === "not-signed-in" ? "Found Aura Talent, but you're not signed in there yet."
      : reason === "no-tab" || reason === "no-permission" ? "Open Aura Talent in a tab and sign in first."
      : "Couldn't connect — open Aura Talent and sign in.";
  }
  await refreshStatus();
});

$("disconnect").addEventListener("click", async () => {
  await send("signOut");
  await refreshStatus();
});

// The production and localhost origins are declared in the manifest, so no grant
// is needed for them. This button only helps power users point the extension at
// a *different* self-hosted domain; it relies on an optional host permission that
// the published build doesn't ship, so it fails gracefully there.
$("grant").addEventListener("click", async () => {
  const apiBase = ($("apiBase").value || DEFAULTS.apiBase).trim().replace(/\/+$/, "");
  let origin;
  try { origin = new URL(apiBase).origin + "/*"; }
  catch { $("saved").textContent = "Enter a valid URL first"; return; }
  let granted = false;
  try {
    granted = await chrome.permissions.request({ origins: [origin] });
  } catch {
    $("saved").textContent = "This build only supports the built-in domains.";
    setTimeout(() => ($("saved").textContent = ""), 2600);
    return;
  }
  if (granted) {
    try {
      await chrome.scripting.unregisterContentScripts({ ids: ["auto-sync-custom"] }).catch(() => {});
      await chrome.scripting.registerContentScripts([{
        id: "auto-sync-custom",
        matches: [origin],
        js: ["content/sync.js"],
        runAt: "document_idle",
      }]);
    } catch { /* already registered or unsupported — non-fatal */ }
  }
  $("saved").textContent = granted ? "Access granted ✓" : "Access denied";
  setTimeout(() => ($("saved").textContent = ""), 2200);
});

load();
