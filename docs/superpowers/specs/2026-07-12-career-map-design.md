# Career Map — Design Spec

**Date:** 2026-07-12
**Status:** Approved pending final user review
**Repos:** AURA-TALENT-FRONTEND (primary UX) + AURA-TALENT-BACKEND (generation & persistence)
**Context:** Hackathon feature. Wow factor is a requirement, but not at the expense of UX. Visual polish is a hard requirement — the feature must read as crafted, not generated (see §6).
**Interactive mockup (approved):** https://claude.ai/code/artifact/bae7be18-ed1c-4dd0-a91e-f0599f1f0d44 — validates the constellation look, dive-into-node interaction, route-highlight hover, and progressive expansion.

## 1. What it is

A new candidate-side page, `/career-map`, that turns the user's resume + evaluation history into an explorable 3D constellation of career futures:

- **Center node ("You today")** — current position/studies, drawn from the parsed resume.
- **Progression branch** — the natural next rungs (e.g. BE-II → Senior → Staff/EM), chained over 2–3 rings.
- **Pivot branches** — realistic lane changes (e.g. Data Engineer, Technical PM).
- **Skill-adjacent wildcards** — unrelated-looking roles that reuse the same skill set (e.g. Quant Developer, DevRel), rendered with dashed edges.

Every node is a **role + duration** ("6–12 months away") with a fit score. The full map (14–20 nodes) is generated upfront in one LLM call; leaf nodes marked `expandable` can be grown further on demand ("Explore further from here").

This feature is the graph-shaped evolution of the existing Career Path Navigator (`app/graphs/career_path.py`, `components/CareerPathNavigator.tsx`), which stays as-is on the dashboard.

## 2. Backend

### 2.1 Schemas (`app/schemas.py`)

```
CareerMapNode:
  id: str                 # slug, unique within map
  title: str              # "Senior Backend Engineer"
  kind: Literal["current", "progression", "pivot", "wildcard"]
  duration: str           # "6–12 months", "2–3 years" — distance from today
  fit: float (1–5)
  salary_hint: str        # "≈ S$130–165k", may be empty
  why: str                # rationale grounded in resume/eval history
  skill_gaps: list[str]
  moves: list[CareerMove] # reuse existing schema
  expandable: bool

CareerMapEdge:
  source: str
  target: str
  kind: Literal["progression", "pivot", "wildcard"]

CareerMapOut:
  current_assessment: str
  nodes: list[CareerMapNode]
  edges: list[CareerMapEdge]
  recommended_node_id: str
  generated_at: str
```

### 2.2 LangGraph pipeline (`app/graphs/career_map.py`)

`gather_signals → map_graph → normalize`

- **gather_signals** — reuse the existing implementation from `career_path.py` (profile + full evaluation history brief).
- **map_graph** — LLM with structured output `CareerMapOut`-shaped schema. Prompt requires: exactly one `current` root; a progression chain 2–3 rings deep; 2–3 pivot lanes; 2–3 wildcards attached to whichever node shares the skills (not necessarily the root); every `why` must cite resume/evaluation evidence; leaves marked expandable.
- **normalize** — pure Python, no LLM. Enforces: exactly one root (demote extras), all edge endpoints exist (drop dangling edges), graph connected from root (prune orphan nodes), node ids unique, `recommended_node_id` valid (else pick highest-fit ring-1 node). Never trust raw LLM graph output.

Expansion is a separate single-node LLM call (no graph needed): context = stored map summary + target node; output = 2–4 child `CareerMapNode`s + edges. Result is merged into the stored map server-side, then the updated map is returned.

### 2.3 Endpoints (extend `app/routers/career.py`)

| Method | Path | Behavior |
|--------|------|----------|
| POST | `/api/v1/career/map` | Returns stored map if present; generates + stores otherwise. Body: `{user_id, force_refresh?: bool}` |
| POST | `/api/v1/career/map/stream` | SSE variant (same event protocol as existing `/career/path/stream`): `progress` events per pipeline stage (gathering signals / mapping routes / validating), `result` with full `CareerMapOut` |
| POST | `/api/v1/career/map/expand` | Body: `{user_id, node_id}`. Generates children, merges into stored map, returns updated `CareerMapOut` |

Auth/roles identical to existing career endpoints (X-API-Key via frontend proxy, candidate role).

### 2.4 Persistence (`app/storage.py`)

New Supabase table `career_maps`, following the `resumes` pattern:

```
career_maps: user_id (PK), map_json (jsonb), updated_at
```

`get_career_map(user_id)`, `save_career_map(user_id, map_json)`. Regeneration overwrites; expansion updates in place.

## 3. Frontend

### 3.1 Files

- `app/career-map/page.tsx` — thin server shell + route guard (auth + resume required; otherwise redirect to `/onboarding`).
- `components/career-map/CareerMapScene.tsx` — three.js scene (client).
- `components/career-map/NodeDetail.tsx` — inside-the-node DOM overlay (client).
- `hooks/useCareerMap.ts` — data layer: cached fetch → streamed generation fallback → expand merges.
- `lib/api.ts` — mirrored `CareerMapOut`/node/edge types + `api.careerMap()`, `api.careerMapExpand()`; streaming via existing `useStream`.

### 3.2 Rendering stack

Direct **three.js** (already a dependency) + **d3-force-3d** (new dep) for layout physics, **GSAP** (already a dependency) for camera + DOM choreography. Layout is seeded deterministically — nodes placed on rings by depth, at angles by branch sector (progression / pivots / wildcards each own a sector) — then relaxed with a brief force simulation so it looks organic but branches never cross sectors and the same map always lays out the same way. No graph-wrapper library — full control of materials and camera is required for the polish bar (§6). Post-processing via `EffectComposer`: tight UnrealBloom, film grain, vignette, subtle depth-of-field.

### 3.3 Interaction spec (validated in mockup)

- **Load (first visit):** SSE generation with stage progress lines; once the `result` arrives, nodes spawn ring-by-ring as a client-side staggered animation with a "Mapping your career space… n/16 roles" counter. Return visits load the cached map instantly and skip the counter.
- **Idle:** slow auto-rotation.
- **Drag** orbits; **wheel/pinch** zooms.
- **Hover:** auto-rotation pauses. Highlight = full route: all ancestor paths back to the root (DAG-safe — walk every incoming edge) + the entire descendant subtree. Everything else dims to near-invisible. Edges light only when both endpoints are in the highlight set.
- **Click → dive-into-node:** one continuous camera move. Node rotates to face camera → camera pushes through it → rest of graph and HUD fade out → node core dissolves, its glow expands into a full-screen ambient backdrop tinted by branch color → detail content fades up in place. **No page-wipe/overlay-page effect.**
- **Detail view content:** kind + "from your current position" crumb, role title, duration chip, salary chip, 5-segment fit meter, "Why this fits you", skill-gap list, tactical moves, and — on expandable leaves — "Explore further from here →".
- **Close (button / ✕ / Escape):** reverse dive; camera returns to the exact pre-dive orbit position.
- **Explore further:** in-place "Discovering branches…" state → zoom back out → new nodes pop in → toast "✦ n new branches discovered beyond X".
- **Regenerate:** quiet HUD control; calls `force_refresh` and replays the spawn-in.
- **Reduced motion:** `prefers-reduced-motion` disables auto-rotation, spawn stagger, and dive animation (instant transitions).
- **Mobile:** same scene with touch orbit/pinch; detail view is single-column.

### 3.4 Entry point

Dashboard gains a small teaser card ("Career Map — explore your routes →") linking to `/career-map`. The existing CareerPathNavigator card is untouched.

## 4. Error handling

- No resume → redirect to onboarding with message.
- Generation/stream failure → retry state, same pattern as `/evaluate`.
- Expand failure → toast; node remains expandable.
- Malformed graphs: `normalize` guards server-side; client additionally ignores edges referencing missing nodes. The page must never white-screen over bad data.

## 5. Testing (hackathon-scaled)

- **Backend (pytest):** `normalize` unit tests — dangling edges, multiple roots, disconnected subgraphs, invalid `recommended_node_id`; endpoint tests for map/expand with mocked LLM + storage (follow `tests/test_rbac.py` mocking pattern).
- **Frontend:** strict TypeScript on shared types; manual demo-path checklist: load → stream spawn → orbit/zoom → hover route highlight → dive → close → expand → regenerate → reduced-motion pass.

## 6. Visual polish requirements (hard requirement)

The mockup's look is a wireframe, not the target. The real page must not read as "AI-generated":

- **Typography-led detail view** — Bricolage Grotesque display, Hanken Grotesk body, Space Mono data accents; editorial hierarchy and asymmetry; no generic glassmorphism chip-soup, no uniform rounded cards.
- **Node design** — layered forms (core + ring + halo) that differ by kind, not just color; tight bloom, film grain, faint dust particles, subtle DOF. Palette stays on brand: iris `#4e3fd8`/`#8f7dff` progression, peach `#ffb98f` pivots, mint `#7fd6b2` wildcards, porcelain root with aura ring.
- **Motion design** — GSAP with designed easing curves and staggering; no default linear lerps for hero moments.
- Implementation must apply the frontend-design skill guidance when building the page.

## 7. Out of scope

- Employer-side career maps.
- Editing/annotating the map by hand.
- Live web-search grounding of salary hints (uses the same LLM+Adzuna machinery evaluations already use).
- Replacing the existing CareerPathNavigator.
