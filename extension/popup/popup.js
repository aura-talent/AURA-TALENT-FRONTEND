import { extractJobPosting } from "../lib/extract.js";
import { renderMarkdown } from "../lib/markdown.js";
import { getSettings } from "../lib/storage.js";

const $ = (id) => document.getElementById(id);
let job = null; // last captured posting
let activeTab = "match";
const tabData = {
  match: null,
  tailor: null,
  cover: null,
};

const TAB_LABELS = {
  match: "Match against my resume",
  tailor: "Tailor my resume",
  cover: "Write cover letter",
};
const TAB_ACTION = { match: "evaluate", tailor: "tailor", cover: "cover" };

/* ── Capture ── */
$("capture-btn").addEventListener("click", async () => {
  setStatus("loading", "Reading this page…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractJobPosting,
    });
    if (!result || result.chars < 80) {
      throw new Error("Couldn't find a job description here. Try selecting the JD text, or open the posting directly.");
    }
    job = result;
    renderJobMeta(job);
    clearStatus();
    
    // Clear cached tab results for a new job context
    tabData.match = null;
    tabData.tailor = null;
    tabData.cover = null;
    $("result").innerHTML = "";
    
    updateRunButton();
  } catch (err) {
    setStatus("error", err.message);
  }
});

function renderJobMeta(j) {
  $("job-title").textContent = j.title || "(untitled posting)";
  $("job-company").textContent = j.company || new URL(j.url).hostname;
  $("job-chars").textContent = j.chars;
  $("job-meta").classList.remove("hidden");
  $("capture-hint").classList.add("hidden");
}

/* ── Tabs ── */
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeTab = btn.dataset.tab;
    clearStatus();
    updateRunButton();
    
    // Restore cached tab result if it exists, otherwise clear
    const data = tabData[activeTab];
    if (data) {
      if (activeTab === "match") renderEvaluation(data);
      else if (activeTab === "cover") renderCoverLetter(data);
      else if (activeTab === "tailor") renderMarkdownResult("tailor", data);
    } else {
      $("result").innerHTML = "";
    }
  });
});

function updateRunButton() {
  const btn = $("run-btn");
  if (!job) { btn.disabled = true; btn.textContent = "Capture a job first"; return; }
  btn.disabled = false;
  btn.textContent = TAB_LABELS[activeTab];
}

/* ── Run action ── */
$("run-btn").addEventListener("click", async () => {
  if (!job) return;
  const action = TAB_ACTION[activeTab];
  $("run-btn").disabled = true;
  setStatus("loading", "Working with Aura Talent… this can take a few seconds.");
  $("result").innerHTML = "";
  try {
    const resp = await chrome.runtime.sendMessage({
      action,
      payload: { jd_text: job.text, jd_url: job.url },
    });
    if (!resp?.ok) throw Object.assign(new Error(resp?.error || "Request failed"), { status: resp?.status });
    clearStatus();
    
    // Cache the successful result for this tab
    tabData[activeTab] = resp.data;
    
    if (action === "evaluate") renderEvaluation(resp.data);
    else if (action === "cover") renderCoverLetter(resp.data);
    else renderMarkdownResult(action, resp.data);
  } catch (err) {
    setStatus("error", err.message);
  } finally {
    $("run-btn").disabled = false;
  }
});

/* ── Renderers ── */
function renderEvaluation(ev) {
  const pct = Math.round((ev.score / 5) * 100);
  const scores = ev.scores || {};
  const bars = [
    ["CV match", scores.match_cv],
    ["Alignment", scores.alignment],
    ["Comp", scores.comp],
    ["Culture", scores.culture],
    ["Red flags", scores.red_flags],
  ].filter(([, v]) => typeof v === "number");

  const kw = (ev.keywords || []).slice(0, 12)
    .map((k) => `<span class="chip">${escapeText(k)}</span>`).join("");

  $("result").innerHTML = `
    <div class="score-card">
      <div class="score-ring" style="--pct:${pct}%"><span>${ev.score?.toFixed(1) ?? "?"}</span></div>
      <div class="score-meta">
        <div class="rec">${escapeText(ev.recommendation || "Evaluated")}</div>
        <div class="arc">${escapeText(ev.archetype || "")}${ev.company ? " · " + escapeText(ev.company) : ""}</div>
      </div>
    </div>
    <div class="bars">${bars.map(([l, v]) => barRow(l, v)).join("")}</div>
    ${kw ? `<div class="keywords">${kw}</div>` : ""}
    ${toolbar(ev.report_markdown || "")}
    <div class="md">${renderMarkdown(ev.report_markdown || "")}</div>
  `;
  wireToolbar(ev.report_markdown || "");
}

function barRow(label, val) {
  const pct = Math.max(0, Math.min(100, (val / 5) * 100));
  return `<div class="bar-row">
    <span class="label">${label}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
    <span class="num">${val.toFixed(1)}</span>
  </div>`;
}

function renderMarkdownResult(action, data) {
  const md = data.suggestions_markdown || data.cover_letter_markdown || data.markdown || JSON.stringify(data, null, 2);
  $("result").innerHTML = `${toolbar(md)}<div class="md">${renderMarkdown(md)}</div>`;
  wireToolbar(md);
}

function renderCoverLetter(data) {
  const letter = data.cover_letter_markdown || "";
  const subject = data.subject_line || "";
  const points = Array.isArray(data.key_points) ? data.key_points : [];
  // Copy/download the subject + letter together so it's paste-ready into email.
  const full = subject ? `Subject: ${subject}\n\n${letter}` : letter;

  $("result").innerHTML = `
    ${subject ? `<div class="subject"><span class="subject-label">Subject</span>${escapeText(subject)}</div>` : ""}
    ${points.length ? `<ul class="key-points">${points.map((p) => `<li>${escapeText(p)}</li>`).join("")}</ul>` : ""}
    ${toolbar(full)}
    <div class="md letter">${renderMarkdown(letter)}</div>
  `;
  wireToolbar(full);
}

function toolbar(md) {
  return `<div class="toolbar">
    <button data-act="copy">Copy</button>
    <button data-act="download">Download .md</button>
  </div>`;
}
function wireToolbar(md) {
  const tb = $("result").querySelector(".toolbar");
  if (!tb) return;
  tb.querySelector('[data-act="copy"]').addEventListener("click", async (e) => {
    await navigator.clipboard.writeText(md);
    e.target.textContent = "Copied ✓";
    setTimeout(() => (e.target.textContent = "Copy"), 1500);
  });
  tb.querySelector('[data-act="download"]').addEventListener("click", () => {
    const slug = (job?.company || "aura").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${activeTab}-${slug}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

/* ── Helpers ── */
function setStatus(kind, msg) {
  const s = $("status");
  s.className = `status ${kind}`;
  s.textContent = msg;
  s.classList.remove("hidden");
}
function clearStatus() { $("status").classList.add("hidden"); }
function escapeText(s) { const d = document.createElement("div"); d.textContent = String(s ?? ""); return d.innerHTML; }

async function send(action, payload) {
  return chrome.runtime.sendMessage({ action, payload });
}

/* ── Settings ── */
$("settings-btn").addEventListener("click", () => chrome.runtime.openOptionsPage());

/* ── Auth gate ── */
$("signin-btn").addEventListener("click", async () => {
  const { apiBase } = await getSettings();
  // Opening a tab closes the popup; the user signs in, reopens us, and init()
  // auto-syncs from the now-logged-in tab.
  chrome.tabs.create({ url: `${apiBase.replace(/\/+$/, "")}/login` });
});

$("connect-btn").addEventListener("click", async () => {
  const btn = $("connect-btn");
  btn.disabled = true; btn.textContent = "Connecting…";
  const resp = await send("syncSession");
  btn.disabled = false; btn.textContent = "I've signed in — connect";
  if (resp?.ok && resp.data?.connected) showConnected(resp.data);
  else showGate(resp?.data?.reason);
});

function showGate(reason) {
  $("auth-gate").classList.remove("hidden");
  $("app").classList.add("hidden");
  const msg = $("auth-msg");
  if (reason === "not-signed-in") {
    msg.textContent = "You're on Aura Talent but not signed in yet. Sign in, then click connect.";
  } else if (reason === "no-tab" || reason === "no-permission") {
    msg.textContent = "Open Aura Talent and sign in, then come back and click connect.";
  } else {
    msg.textContent = "Sign in to Aura Talent so the extension uses the same resume and history as the website.";
  }
  const conn = $("conn-state");
  conn.textContent = "Not connected";
  conn.className = "conn bad";
  const action = $("footer-action");
  action.textContent = "Open Aura Talent →";
  action.onclick = async (e) => {
    e.preventDefault();
    const { apiBase } = await getSettings();
    chrome.tabs.create({ url: apiBase });
  };
}

function showConnected(status) {
  $("auth-gate").classList.add("hidden");
  $("app").classList.remove("hidden");
  const conn = $("conn-state");
  conn.textContent = status.email ? `Signed in: ${status.email}` : "Signed in";
  conn.className = "conn ok";
  const action = $("footer-action");
  action.textContent = "Sign out";
  action.onclick = async (e) => {
    e.preventDefault();
    await send("signOut");
    showGate();
  };
  checkResume();
}

async function checkResume() {
  const conn = $("conn-state");
  try {
    const resp = await send("checkResume");
    if (resp?.ok && resp.data) return; // signed-in label already shown
    if (resp?.ok && resp.data === null) {
      conn.textContent = "Signed in — no resume yet, upload in Aura Talent";
      conn.className = "conn bad";
    }
  } catch { /* leave the signed-in label */ }
}

/* ── Init: adopt the web app session, else show the gate ── */
(async function init() {
  const status = (await send("getStatus"))?.data;
  if (status?.connected) {
    showConnected(status);
    send("syncSession"); // best-effort: refresh token if an app tab is open
  } else {
    const synced = (await send("syncSession"))?.data;
    if (synced?.connected) showConnected(synced);
    else showGate(synced?.reason);
  }
})();
