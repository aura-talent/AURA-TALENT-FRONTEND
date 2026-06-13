# Aura Talent Companion — Browser Extension

A Chrome/Edge (Manifest V3) extension that lets you capture any job posting in
your browser and run it against your Aura Talent account:

- **Match** — score the posting against your stored resume (full A–F evaluation,
  recommendation, score breakdown, keywords).
- **Tailor** — get tailored-resume suggestions for that specific posting.
- **Cover** — draft a cover letter for the posting (returns a subject line,
  key talking points, and the letter body).

It reuses the existing Aura Talent backend through the Next.js `/api/backend` proxy, so
the backend API key never lives in the extension.

## How it works

```
Popup ──message──▶ Service worker ──fetch──▶ {Aura Talent app}/api/backend/* ──▶ FastAPI backend
  │                                                  (X-API-Key added server-side)
  └─ chrome.scripting.executeScript ──▶ active tab: extract job title/company/JD
```

- **JD extraction** (`lib/extract.js`) has site-specific extractors for LinkedIn,
  Indeed, Greenhouse, Lever, Ashby and Workday, plus JSON-LD `JobPosting` and a
  selected-text / `<main>` fallback. It's injected on demand via `activeTab` +
  `scripting` — no broad content-script matches.
- **API calls** run from the service worker, where the configured host
  permission exempts them from page CORS.
- Endpoints used: `jobs/evaluate`, `resume/suggestions`, `resume/cover-letter`,
  `resume/{user_id}`. (A streaming variant, `resume/cover-letter/stream`, exists
  for incremental progress — see the note at the bottom.)

## Load it (development)

1. Make sure the Aura Talent web app is running (`npm run dev` → `http://localhost:3000`).
2. Go to `chrome://extensions`, enable **Developer mode** (top-right).
3. Click **Load unpacked** and select this `extension/` folder.
4. (Only for a non-localhost backend) open **Settings** (⚙), set the **Aura Talent
   app URL**, and click **Grant access to custom domain**.
5. **Sign in.** Open the extension — it shows a connect screen. Click **Sign in
   with Google or LinkedIn**, which opens the web app's login page. Sign in there
   the usual way, then reopen the extension; it adopts that session automatically
   (same `user_id` as the website — no UUID copying).
6. Open a job posting, click the extension, hit **Capture job on this page**,
   then choose a tab and run.

### How sign-in works

The extension never handles your password or runs its own OAuth — it reuses your
existing Aura Talent login. The `user_id` it stores is the same Supabase auth id
the website uses, so both always read the same resume and history.

Three mechanisms keep it in sync:

1. **Auto-sync (`content/sync.js`)** — a content script on the Aura Talent origin
   reads the Supabase session from the page's `localStorage` and pushes it to the
   service worker on load, on cross-tab `storage` events, on tab refocus, and on a
   60s poll. So just having the site open keeps the extension signed in — and
   logging out on the website logs the extension out too. Declared for `localhost`
   in the manifest; for a custom domain it's registered dynamically when you click
   **Grant access to custom domain** in Options.
2. **One-shot connect (`syncSession`)** — the popup/options **Connect** button
   reads the session from an open app tab on demand (`lib/session.js`), covering
   the moment right after install before the content script has run.
3. **Token refresh** — while an app tab is open, supabase-js refreshes the token
   and auto-sync forwards it. When no tab is open, the service worker refreshes the
   expired access token itself using the stored refresh token against Supabase's
   token endpoint, so **after the one-time connect users stay signed in
   indefinitely without ever opening the site again**. The public anon key needed
   for this ships in `lib/config.js` (it's the same publishable key the web app
   already exposes to browsers); **Options** can override the URL + key to target a
   different Supabase project. Backend calls refresh proactively near expiry and
   retry once on a `401`.

**Sign out** in the footer clears the stored session.

## Files

| Path | Purpose |
|------|---------|
| `manifest.json` | MV3 config (activeTab + scripting + storage) |
| `lib/extract.js` | Self-contained JD extractor (injected into the page) |
| `lib/storage.js` | Settings + connection state (`chrome.storage.sync`) |
| `lib/session.js` | Reads the logged-in Supabase session from an app tab |
| `lib/config.js` | Default (public) Supabase URL + anon key for token refresh |
| `lib/markdown.js` | Tiny markdown → HTML renderer |
| `content/sync.js` | Auto-sync content script on the Aura Talent origin |
| `background/service-worker.js` | Backend calls, session sync, token refresh |
| `popup/*` | Popup UI |
| `options/*` | Settings page |

## Publishing

The manifest is already scoped to production
(`https://aura-talent-frontend-new.vercel.app`) plus Supabase and localhost — no
broad host permissions. To package and ship:

```bash
node build-zip.mjs   # → dist/aura-talent-companion-<version>.zip
```

See **[PUBLISHING.md](PUBLISHING.md)** for the full Chrome Web Store walkthrough
(developer account, listing, the privacy disclosures reviewers require, and
updates).

## Streaming cover letters (optional enhancement)

The Cover tab uses the one-shot `POST resume/cover-letter` endpoint and shows a
generic "Working…" state while it runs. The backend also exposes
`POST resume/cover-letter/stream`, which emits SSE `progress` / `result` /
`error` events. To show live progress, swap the Cover branch in `popup.js` to
fetch the stream endpoint directly from the popup (extension pages share the
host permission, so the cross-origin fetch works), read the `ReadableStream`,
and update the status line on each `progress` event until `result` arrives.
