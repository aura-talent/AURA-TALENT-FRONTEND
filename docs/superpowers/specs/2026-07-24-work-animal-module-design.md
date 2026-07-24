# Work-Animal Module ("Aura Menagerie") — Design

**Date:** 2026-07-24
**Status:** Approved
**Repos touched:** AURA-TALENT-BACKEND, AURA-TALENT-FRONTEND
**Context:** Hackathon feature — visual wow factor is a first-class requirement,
not polish. The 3D treatment and reveal ceremony are load-bearing for the demo.

## 1. Concept

A data-derived work-animal profile — explicitly **not** a self-report personality
quiz. The user swipes through a deck of real job postings from their scan feed.
The system reads two signal streams from that behavior:

- **Drive** (primary, from job *content*): what kinds of roles they chase vs.
  reject, scored across six trait axes.
- **Temperament** (secondary, from swipe *manner*): how they decide — speed,
  hesitation, selectivity.

Together these map the user to one of **12 animals** plus a temperament
modifier. The reveal always explains itself with the user's actual swipes
("You passed on every spotlight role and kept the deep, heads-down ones →
Owl"), which is what makes it feel intelligent rather than arbitrary.

**Right-swipe = add to shortlist.** It is an expression of interest, never an
application. Shortlisted jobs flow into the existing `/evaluate` (A–G report)
pipeline where the user decides whether to actually apply. Nothing bypasses
evaluation; the existing ethical guardrails (no auto-apply, sub-3.5 scores
flagged with guidance) remain fully intact.

### Why this and not a quiz

- Behavioral, not preference-claimed: users can't perform for it.
- Built entirely from data/infrastructure the platform already has
  (`scan` feed, JD evaluation LLM passes, application tracker).
- Produces a unique insight quizzes structurally cannot: the gap between
  **stated** preferences (onboarding) and **revealed** preferences (swipes).

## 2. The engine

### 2.1 Trait axes (drive)

Each job entering the deck gets a cheap LLM tagging pass (same pattern as the
existing JD evaluation) scoring it on six axes, each a bipolar scale:

| Axis | Left pole | Right pole |
|---|---|---|
| Social load | Heads-down | People-facing |
| Core motion | Building / craft | Persuasion / influence |
| Visibility | Behind-the-scenes | Spotlight |
| Environment | Structured / stable | Ambiguous / risky |
| Autonomy | Solo | Team-embedded |
| North star | Mission / impact | Comp / prestige |

Tags are computed once per job and cached with the job record.

### 2.2 Trait vector (evolving profile)

Each user has a **persisted trait vector** over the six axes. Every
right-swipe pulls the vector toward that job's trait scores; every left-swipe
pushes away. The vector is cumulative across sessions (evolving-profile model):
the animal sharpens and can shift over time. Deck swipes are the v1 signal
source; normal feed interactions can feed the same vector later.

### 2.3 Animal classification (deterministic)

The 12 animals are fixed regions in trait space. Classification is a
**deterministic nearest-region mapping** from the user's vector — pure
functions, unit-testable, no LLM involved. The LLM writes only the
explanation copy, citing the user's real swiped cards as evidence.

| Animal | Accepts (signature) | Rejects | Niche |
|---|---|---|---|
| 🦉 Owl | heads-down, craft, analytical | spotlight, sales | Deep thinker / research |
| 🦫 Beaver | building, structured | ambiguity, people-facing | Methodical builder |
| 🦊 Fox | ambiguous, generalist, scrappy | rigid big-co | Startup generalist |
| 🐙 Octopus | high-autonomy, multi-domain | team-embedded, structured | Autonomous problem-solver |
| 🐺 Wolf | prestige, team, ambitious | low-stakes, solo | Ambitious operator |
| 🦅 Hawk | spotlight, leadership, decisive | behind-scenes IC | Executive / leader |
| 🦈 Shark | comp, risk, persuasion | mission-over-money | Dealmaker / closing |
| 🦁 Lion | persuasion, spotlight, charisma | heads-down, solo | Charismatic front / sales lead |
| 🐬 Dolphin | people-facing, collaborative | solo, cutthroat | People-person / CS / community |
| 🦌 Deer | mission, impact-first | comp-max, cutthroat | Mission-driven |
| 🐢 Tortoise | stable, long-game, low-risk | risky startups, churn | Stability-seeker |
| 🦎 Chameleon | broad, low fixation | (nothing consistently) | Adaptable generalist |

Animals are **lateral** — no animal outranks another; each wins a different
niche. This is a hard product rule, not just copy tone.

### 2.4 Temperament (modifier)

From swipe manner (per-card decision time, direction changes, overall
selectivity): one of **decisive / analytical / exploratory / selective**.
Rendered as a modifier on the animal ("Analytical Owl"), not a separate axis
of the 12.

### 2.5 Alignment meter (the thing that can "devolve")

A separate meter measuring the distance between the user's **revealed** trait
vector and their **stated** goals captured at onboarding/profile. It can rise
or fall:

- Falls when swiping behavior drifts from the user's own stated target
  ("You said founder-track; you're swiping like a Tortoise").
- Always paired with an actionable "here's the play" — never a judgment.
- The animal itself never degrades; only alignment moves. Framing is strictly
  self-referential: drift from *your own* goal, not from any ideal.

### 2.6 Feed re-ranking (bonus)

The same trait vector doubles as a preference model to re-rank the user's scan
feed ("more like what you actually swipe toward"). Low-cost add once the
vector exists.

## 3. Flow and surfaces

### 3.1 Route

New page (working name **`/animal`**), listed in the seeker nav.

### 3.2 Swipe deck

- ~**15 cards** per session, drawn from the user's live `scan` feed.
- **Cold start:** a seed deck of representative real postings (spanning the
  trait axes) when the user's feed is empty or thin.
- Card shows the essentials (title, company, comp if known, 2–3 trait chips);
  swipe right = shortlist, left = pass. Manner metrics recorded client-side
  per card (time-to-decision, direction changes).

### 3.3 Reveal ceremony (fresh reveals only)

Full-bleed viewport takeover, 4–6 s, **skippable**, plays only on first
reveal or when the user's animal actually changes:

1. Fade to porcelain; aura colors swirl in loosely.
2. Aura condenses; porcelain figurine materializes on its plinth, slowly
   rotating.
3. Text lands: "You're an Owl" + one-line evidence-based why.
4. Ceremony settles: figurine shrinks into a card; results layout slides up.

Return visits go straight to the card layout.

### 3.4 Results layout (card scale)

- Diorama card (live vitrine or snapshot).
- Trait breakdown across the six axes.
- Temperament badge.
- Alignment meter with "the play."
- **Shortlist**: every right-swiped job with an "Evaluate →" button into the
  existing `/evaluate` flow.

## 4. Rendering

Wow factor is a demo requirement, so the 3D language extends beyond the
reveal — the whole module lives in one continuous porcelain "space":

- **Swipe deck in 3D space:** cards are not flat DOM in a column — they float
  as panels with depth in a soft porcelain void (subtle aura wisps drifting
  in the background), tilt on drag, and fly off-screen in 3D on swipe.
  Upcoming cards visibly wait in a receding stack. Implemented with CSS 3D
  transforms + GSAP (cheap, robust) over a three.js backdrop layer.
- **Continuity:** the deck's backdrop *is* the ceremony scene — when the last
  card flies away, the camera doesn't cut; the same space condenses into the
  reveal. One space, one narrative, no page transition.

**Porcelain figurine in a vitrine** (three.js), leaning directly into the
porcelain/ink design system:

- CC0 low-poly animal models (e.g. Quaternius-style pack), unified by **one
  shared ceramic shader + lighting rig + aura-gradient backdrop**. Visual
  consistency comes from the material, not the modeling — one rig, 12 swaps.
- Matte porcelain-white material, soft studio light, aura colors
  (`--aura-a/b/c`) as the glow behind the figure, slow turntable idle.
- **Alignment** = aura glow intensity/warmth (drifting → cooler, dimmer;
  aligned → full triple-color glow). "Devolving" reads as your glow fading,
  never the figurine degrading.
- **Temperament** = idle animation character (hawk: sharp head-turns; owl:
  slow rotation).
- **Static snapshots** rendered per animal/state for: share cards, list
  views, and `prefers-reduced-motion` (site rule: content never hidden
  behind JS).
- Reuses the existing three/bloom/GSAP stack proven in
  `lib/career-map/scene.ts`; same pattern — framework-free scene class,
  React talks to it through a narrow interface.

## 5. Backend shape

Follows existing router/service/storage patterns in AURA-TALENT-BACKEND:

- **Router** `app/routers/animal.py` under `/api/v1`, behind the existing
  API-key dependency:
  - `GET /animal/deck/{user_id}` — build a deck (feed + seed fallback).
  - `POST /animal/swipes` — batch of swipe events (job id, direction, manner
    metrics).
  - `GET /animal/{user_id}` — current animal, temperament, vector, alignment,
    history.
  - `GET /animal/{user_id}/shortlist` — right-swiped jobs.
- **Service** `app/services/animal.py` — trait-vector math and the
  deterministic classifier (pure functions).
- **Tagging** — LLM trait-tagging pass hooked into scan results, cached per
  job (graph or direct call, same pattern as existing JD passes).
- **Copy** — small LangGraph graph (like `graphs/evaluate.py`) generating the
  explanation text from the vector + cited cards.
- **Storage** — swipe events, per-user trait vector, animal state + history,
  alignment score; same storage layer conventions as career-map.

## 6. Tone guardrails

- Never "you got worse." Alignment copy is self-referential and always ends
  with an actionable play.
- No demeaning animal comparisons anywhere in generated or static copy.
- Animals are lateral by construction (deterministic regions, no scoring).

## 7. Testing

Mirrors the career-map test suite conventions:

- Classifier: region boundaries, tie-breaks, Chameleon (low-fixation) case.
- Vector math: swipe updates, left/right asymmetry, cumulative evolution.
- Alignment: stated-vs-revealed distance, monotonic drift behavior.
- Router: auth, deck cold-start fallback, swipe batch validation.
- Storage: vector persistence, history, shortlist integrity.
- Frontend: deck interaction unit tests where practical; reduced-motion
  fallback renders content without JS animation.

## 8. Out of scope (v1)

- Feeding normal (non-deck) feed interactions into the vector.
- Employer-side mirror of the module.
- Feed re-ranking UI beyond plumbing the vector (can ship dark).
- Custom-modeled figurines; v1 uses CC0 models + shared shader.
