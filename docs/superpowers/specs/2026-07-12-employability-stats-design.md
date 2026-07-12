# Employability + Salary Statistics — Design Spec (v2: real data only)

**Date:** 2026-07-12 (v2 — user directive: no AI estimation; rely on actual data for a fixed set of universities)
**Repos:** AURA-TALENT-BACKEND (dataset + one endpoint) + AURA-TALENT-FRONTEND (/insights page)
**Context:** Hackathon feature, candidate-side. Employer-side view parked (todo). NO git actions — all work stays uncommitted.

## 1. What it is

A candidate research page answering: *"How employable is my degree, and what does this role pay?"* — built exclusively on **published real data** for a fixed set of MY + SG universities and common tech roles. No LLM anywhere in the feature. Every number carries a source.

## 2. Data (curated only)

One static dataset file: `AURA-TALENT-BACKEND/app/data/employability_dataset.json`.

Sources:
- **SG:** MOE Graduate Employment Survey (data.gov.sg) — per-university, per-degree employment rate and gross salary P25/median/P75. Universities: NUS, NTU, SMU (+ SIT/SUTD if data is clean).
- **MY:** MOHE Graduate Tracer Study — per-institution graduate employability %. Universities: APU, UM, USM, UTM, Sunway, Taylor's, Monash Malaysia (best-effort per published figures).
- **MY salaries:** published salary guides (JobStreet/TalentCorp/Hays) — per-role P25/P50/P75 bands in MYR.

Dataset shape:

```json
{
  "updated": "2026-07",
  "sources": [{ "id": "ges2024", "label": "...", "url": "..." }],
  "universities": [{
    "id": "apu", "name": "Asia Pacific University", "country": "MY",
    "employment_rate_pct": 96.0, "rate_basis": "employed within 6 months (GTS 2023)",
    "source_ids": ["gts2023"],
    "degrees": [{        // SG unis only — GES gives per-degree rows
      "field": "Computer Science", "employment_rate_pct": 94.3,
      "salary": { "p25": 5200, "p50": 5800, "p75": 6800, "currency": "SGD", "period": "month" },
      "source_ids": ["ges2024"]
    }]
  }],
  "roles": [{
    "id": "backend-engineer", "title": "Backend Engineer",
    "salary": {
      "MY": { "p25": 4500, "p50": 6500, "p75": 9000, "currency": "MYR", "period": "month", "source_ids": ["jobstreet2025"] },
      "SG": { "p25": 4800, "p50": 6200, "p75": 8200, "currency": "SGD", "period": "month", "source_ids": ["ges2024"] }
    },
    "demand_note": "one sentence, cited"
  }]
}
```

Numbers are compiled by research from the published sources, each row citing `source_ids`. Nothing derived or invented: uni employability and role salary are shown side by side as separate facts, never blended into a synthetic score. Unknown university/role = not selectable.

## 3. Backend (tiny)

- `GET /api/v1/stats/employability/dataset` — returns the JSON file verbatim (loaded once at import). Behind the existing API-key middleware like everything else; no roles, no user data, no Supabase, no LLM.
- Tests: file parses; every `source_ids` entry resolves to a listed source; every university has either `employment_rate_pct` or ≥1 degree row; endpoint returns 200 + expected top-level keys.

## 4. Frontend — `/insights`

Files: `app/insights/page.tsx`, `components/insights/PercentDial.tsx`, `components/insights/SalaryBandBar.tsx`; `lib/api.ts` types + `api.employabilityDataset()`; RouteGuard `/insights`; Nav APP_LINKS `INSIGHTS` entry.

- Dataset fetched once on load (instant); everything after is client-side.
- **Pickers (dropdowns, fixed options):** country (MY/SG) → university → role (and degree, for SG unis with per-degree rows). Prefill: match the resume profile's university/role against the dataset; fall back to first options.
- **Hero:** `PercentDial` showing the *real* employment rate % (count-up, ScoreDial visual language; ScoreDial itself untouched) + `SalaryBandBar` (P25→P75 brand-gradient bar, median marker, currency/period) + rate basis line + demand note + source citations (linked).
- **Comparison grid:** toggle — "this role across universities" (employment rate ranked, salary shown per-degree for SG) / "this university across roles" (salary bands ranked). Client-side, instant, sortable. Color bands: ≥90% strong, 80–89 good, 70–79 fair, <70 weak.
- **Sources footer:** every source with label + link + dataset "updated" stamp.
- Reduced motion: static dial/no shimmer. No loading theater needed — everything is local after one fetch.

## 5. Error handling

- Dataset fetch failure → retry button (only failure mode left).
- Resume prefill misses → default selections; page fully usable without a resume.

## 6. Out of scope

Employer-side view (parked); AI estimation of any kind; universities/roles beyond the dataset; historical trends.
