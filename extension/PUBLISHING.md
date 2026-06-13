# Publishing — Aura Talent Companion

The extension is configured for production
(`https://aura-talent-frontend-new.vercel.app`). This is the end-to-end process
to get it onto the Chrome Web Store.

## 0. Pre-flight (do once)

- **Make production publicly reachable.** If your Vercel project has *Deployment
  Protection* (password / Vercel Authentication) on the production domain, the
  extension's API calls and session read will fail. Disable protection for
  production, or the store reviewer (and users) can't use it.
- **Confirm Supabase redirect URLs** include the production origin
  (`…vercel.app/auth/callback`). The extension reuses the web app's own login, so
  if Google/LinkedIn sign-in already works on the site, you're set.
- **Bump `version`** in `manifest.json` for every upload (Store rejects re-uploads
  of the same version). Use `1.0.0`, `1.0.1`, …

## 1. Build the package

```bash
node extension/build-zip.mjs
```

Produces `extension/dist/aura-talent-companion-<version>.zip` containing only the
shipped files. That zip is what you upload.

## 2. Create a developer account

1. Go to https://chrome.google.com/webstore/devconsole
2. Sign in with the Google account that will own the listing.
3. Pay the **one-time $5 USD** registration fee (required before your first
   publish). Verify your email/identity if prompted.

## 3. Create the listing & upload

1. In the dashboard: **Add new item** → upload the zip from step 1.
2. Fill the **Store listing** tab:
   - **Description** — what it does (capture a job, match vs résumé, tailor, cover
     letter). The short summary is already in `manifest.json`.
   - **Category** — *Productivity*.
   - **Language** — English.
   - **Icon** — the 128px icon is bundled; the console may also ask for a store
     icon (same image is fine).
   - **Screenshots** — at least one **1280×800** (or 640×400) PNG/JPG. Capture the
     popup on a real job page (Match view + Cover view make good shots).
   - Optional: a small promo tile (440×280).

## 4. Privacy & permissions (required — this is where reviews stall)

In the **Privacy practices** tab:

- **Single purpose** — one sentence, e.g. *"Evaluates the job posting on the
  current tab against the user's Aura Talent résumé and drafts tailored
  application materials."*
- **Permission justifications** — fill each:
  - `activeTab` + `scripting` — *"Read the job description from the page the user
    is viewing, only when they click the extension."*
  - `storage` — *"Store the user's session and settings locally."*
  - host `…vercel.app` — *"Send the captured job text to the user's Aura Talent
    backend and read their logged-in session."*
  - host `*.supabase.co` — *"Refresh the user's expired login token."*
- **Data usage** — disclose that you collect/transmit the job text and résumé
  data to your own backend. Tick *"not sold to third parties"* and that it's used
  only to provide the feature.
- **Privacy policy URL** — **mandatory** because the extension handles personal
  data. Publish a short policy page (e.g.
  `https://aura-talent-frontend-new.vercel.app/privacy`) and paste the URL here.

## 5. Submit

1. **Save draft** → **Submit for review**.
2. Choose visibility: **Public**, **Unlisted** (anyone with the link — good for a
   soft launch), or **Private** (specific testers / Google Workspace org).
3. Review typically takes a few hours to a few business days. You'll get an email
   on approval or with the rejection reason.

## Updating later

1. Edit code → bump `version` in `manifest.json`.
2. `node extension/build-zip.mjs`
3. Dashboard → your item → **Package** → upload the new zip → **Submit**.
   Approved updates roll out to users automatically.

## Notes

- **No OAuth setup needed in the extension.** It never runs its own OAuth — it
  reuses the web app's Google/LinkedIn login and reads the resulting session from
  an open Aura Talent tab. So there are no Chrome OAuth client IDs to register.
- **Firefox / Edge** use the same code. Edge: https://partner.microsoft.com/dashboard/microsoftedge
  (free). Firefox: https://addons.mozilla.org — Manifest V3 is supported but
  `background.service_worker` may need a `background.scripts` fallback; ask if you
  want a Firefox build.
