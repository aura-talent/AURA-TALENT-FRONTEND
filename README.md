# Aura Talent — frontend

Next.js (App Router) web app for the Career OS backend. Porcelain/ink design system with the **Aura Score Dial** as the signature element; GSAP for the hero demo and scroll reveals.

## Pages

| Route | What it does |
|---|---|
| `/` | Landing — animated evaluation demo, how it works, the seven blocks, ethos |
| `/onboarding` | Resume upload (PDF/DOCX/TXT/MD drag-drop) or paste text |
| `/evaluate` | Paste a job URL or description → score dial, breakdown bars, full A–G report |
| `/dashboard` | Pipeline tracker — statuses, scores, report links |
| `/report/[id]` | Full evaluation report |
| `/compare` | Select 2+ evaluations → ranked comparison |
| `/scan` | Live scan of tracked company job boards → one-click "Score it" |

## Architecture notes

- **API key never reaches the browser.** All backend calls go through `app/api/backend/[...path]/route.ts`, a server-side proxy that injects `X-API-Key` from `.env.local`.
- **User identity** is a `localStorage` UUID (`aura_uid`) for now — replace with real auth before charging users.
- **Performance**: server components by default, GSAP only in animating client components, `next/font` (zero CLS), no UI framework, every page static-prerendered except the proxy and `/report/[id]`.
- **Motion**: `prefers-reduced-motion` collapses all animation; content is never hidden behind JS.
- Design tokens live in `app/globals.css` (`:root`) — colors, type roles, radii, score bands.

## Run

```bash
npm install
# edit .env.local: BACKEND_URL + BACKEND_API_KEY (matches the backend's .env)
npm run dev                        # http://localhost:3000 (use -p 3100 if 3000 is taken)
```

The FastAPI backend must be running (`cd ../backend && uvicorn app.main:app --port 8000`).
