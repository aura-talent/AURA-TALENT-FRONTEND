# Career Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An explorable 3D career constellation at `/career-map`, generated from the user's resume + evaluation history, with dive-into-node details and on-demand branch expansion.

**Architecture:** Backend adds a graph-shaped LangGraph pipeline (`gather_signals → map_graph → normalize`) returning validated nodes+edges JSON, three endpoints (`career/map`, `career/map/stream`, `career/map/expand`), and a `career_maps` Supabase table. Frontend adds a framework-free three.js scene class + thin React wrapper, deterministic sector/ring layout relaxed by d3-force-3d, and a GSAP-choreographed inside-the-node detail overlay.

**Tech Stack:** FastAPI, LangGraph, Pydantic, Supabase (backend); Next.js 16 App Router, three.js (existing dep), d3-force-3d (new dep), GSAP (existing dep), TypeScript strict (frontend).

**Spec:** `docs/superpowers/specs/2026-07-12-career-map-design.md`. **Approved interaction mockup:** https://claude.ai/code/artifact/bae7be18-ed1c-4dd0-a91e-f0599f1f0d44

## Global Constraints

- Two repos: backend tasks run in `/Users/tian/Desktop/personal-repo/aura-talent/AURA-TALENT-BACKEND`, frontend tasks in `/Users/tian/Desktop/personal-repo/aura-talent/AURA-TALENT-FRONTEND`. Commit in the repo you changed.
- Backend commands use `uv run …` from the backend root. Frontend type-check is `npx tsc --noEmit`, build is `npm run build`, from the frontend root.
- **Next.js 16 warning (frontend AGENTS.md):** APIs may differ from training data. Before writing page/component code, check `node_modules/next/dist/docs/` if unsure about an App Router API.
- Brand palette (must match exactly): iris `#4e3fd8`, iris-bright `#8f7dff` (progression), peach `#ffb98f` (pivot), mint `#7fd6b2` (wildcard), porcelain `#fafaf8` (current/root), space bg `#0b0e1c`/`#141830`.
- All frontend animation respects `prefers-reduced-motion` (instant transitions, no auto-rotate).
- Visual polish is a hard requirement (spec §6): typography-led detail view (Bricolage Grotesque / Hanken Grotesk / Space Mono are already loaded by `app/layout.tsx` as CSS vars — use `var(--font-display)`-style tokens found in `app/globals.css`), tight bloom, film grain, no generic chip-soup.
- The page must never white-screen on bad data: client ignores edges referencing missing nodes.
- Frontend testing per spec: strict TS + manual demo-path checklist (Task 14). Backend: pytest.

---

### Task 1: Backend — Career map schemas

**Files:**
- Modify: `AURA-TALENT-BACKEND/app/schemas.py` (add after `CareerPathPlan`, ~line 182)
- Test: `AURA-TALENT-BACKEND/tests/test_career_map_schemas.py`

**Interfaces:**
- Produces: `CareerMapNode`, `CareerMapEdge`, `CareerMapDraft`, `CareerMapOut`, `CareerMapIn`, `CareerMapExpandIn`, `CareerMapExpansion` — imported by Tasks 2, 3, 5, 6.

- [ ] **Step 1: Ensure pytest is available**

Run: `cd /Users/tian/Desktop/personal-repo/aura-talent/AURA-TALENT-BACKEND && uv run pytest --version`
If it fails: `uv add --dev pytest pytest-asyncio`

- [ ] **Step 2: Write the failing test**

```python
# tests/test_career_map_schemas.py
import pytest
from pydantic import ValidationError

from app.schemas import (
    CareerMapDraft, CareerMapEdge, CareerMapNode, CareerMapOut,
)


def _node(id="n1", kind="progression", **kw):
    base = dict(
        id=id, title="Backend Engineer II", kind=kind, duration="6-12 months",
        fit=4.5, why="Natural next rung.",
    )
    base.update(kw)
    return CareerMapNode(**base)


def test_node_defaults():
    n = _node()
    assert n.salary_hint == ""
    assert n.skill_gaps == []
    assert n.moves == []
    assert n.expandable is False


def test_node_rejects_bad_kind():
    with pytest.raises(ValidationError):
        _node(kind="sideways")


def test_node_rejects_fit_out_of_range():
    with pytest.raises(ValidationError):
        _node(fit=5.5)


def test_edge_rejects_current_kind():
    with pytest.raises(ValidationError):
        CareerMapEdge(source="a", target="b", kind="current")


def test_out_extends_draft():
    draft = CareerMapDraft(
        current_assessment="Solid junior.",
        nodes=[_node("you", kind="current", duration="Today")],
        edges=[],
        recommended_node_id="you",
    )
    out = CareerMapOut(**draft.model_dump(), user_id="u1", generated_at="2026-07-12T00:00:00+00:00")
    assert out.user_id == "u1"
    assert out.nodes[0].kind == "current"
```

- [ ] **Step 3: Run test to verify it fails**

Run: `uv run pytest tests/test_career_map_schemas.py -v`
Expected: FAIL with `ImportError: cannot import name 'CareerMapDraft'`

- [ ] **Step 4: Add schemas**

In `app/schemas.py`: add `Literal` to the existing `typing` import line, then add after `CareerPathPlan`:

```python
# ── Career map (graph-shaped career navigator) ──────────────────────


class CareerMapNode(BaseModel):
    id: str = Field(description="Unique kebab-case slug within the map, e.g. 'senior-backend-eng'")
    title: str = Field(description="Concrete role title")
    kind: Literal["current", "progression", "pivot", "wildcard"]
    duration: str = Field(
        description='Distance from today, e.g. "6-12 months", "2-3 years". Use "Today" for the current node'
    )
    fit: float = Field(ge=1, le=5, description="How realistic this role is from the current position")
    salary_hint: str = Field("", description='Rough band, e.g. "~ S$130-165k"; empty if unknown')
    why: str = Field(description="Rationale citing resume/evaluation evidence explicitly")
    skill_gaps: list[str] = []
    moves: list[CareerMove] = []
    expandable: bool = Field(False, description="True on leaf nodes that can be explored further")


class CareerMapEdge(BaseModel):
    source: str = Field(description="Parent node id")
    target: str = Field(description="Child node id")
    kind: Literal["progression", "pivot", "wildcard"]


class CareerMapDraft(BaseModel):
    """LLM structured output — the server adds user_id/generated_at."""

    current_assessment: str = Field(description="Where the candidate stands today")
    nodes: list[CareerMapNode] = Field(description="14-20 nodes incl. exactly one 'current' root")
    edges: list[CareerMapEdge] = Field(description="Directed edges from root outward")
    recommended_node_id: str = Field(description="id of the single best next move")


class CareerMapOut(CareerMapDraft):
    user_id: str
    generated_at: str


class CareerMapIn(BaseModel):
    user_id: str
    force_refresh: bool = False


class CareerMapExpandIn(BaseModel):
    user_id: str
    node_id: str


class CareerMapExpansion(BaseModel):
    """LLM structured output for expanding one leaf node."""

    nodes: list[CareerMapNode] = Field(description="2-4 new child roles beyond the target node")
    edges: list[CareerMapEdge] = Field(description="Edges connecting new nodes (from the target or between them)")
```

- [ ] **Step 5: Run test to verify it passes**

Run: `uv run pytest tests/test_career_map_schemas.py -v`
Expected: 5 PASS

- [ ] **Step 6: Commit**

```bash
git add app/schemas.py tests/test_career_map_schemas.py
git commit -m "feat(career-map): add graph schemas"
```

---

### Task 2: Backend — normalize_map validation

**Files:**
- Create: `AURA-TALENT-BACKEND/app/graphs/career_map.py` (normalize only in this task)
- Test: `AURA-TALENT-BACKEND/tests/test_career_map_normalize.py`

**Interfaces:**
- Consumes: `CareerMapDraft`, `CareerMapNode`, `CareerMapEdge` from Task 1.
- Produces: `normalize_map(draft: CareerMapDraft) -> CareerMapDraft` — used by Task 3's graph node.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_career_map_normalize.py
from app.graphs.career_map import normalize_map
from app.schemas import CareerMapDraft, CareerMapEdge, CareerMapNode


def _n(id, kind="progression", fit=3.0):
    return CareerMapNode(
        id=id, title=id.title(), kind=kind, duration="1-2 years", fit=fit, why="w",
    )


def _e(s, t, kind="progression"):
    return CareerMapEdge(source=s, target=t, kind=kind)


def _draft(nodes, edges, rec="a"):
    return CareerMapDraft(
        current_assessment="ok", nodes=nodes, edges=edges, recommended_node_id=rec,
    )


def test_drops_dangling_edges():
    d = _draft([_n("you", "current"), _n("a")], [_e("you", "a"), _e("you", "ghost")])
    out = normalize_map(d)
    assert [(e.source, e.target) for e in out.edges] == [("you", "a")]


def test_drops_self_loops():
    d = _draft([_n("you", "current"), _n("a")], [_e("you", "a"), _e("a", "a")])
    out = normalize_map(d)
    assert len(out.edges) == 1


def test_demotes_extra_roots():
    d = _draft([_n("you", "current"), _n("me", "current")], [_e("you", "me")], rec="me")
    out = normalize_map(d)
    kinds = {n.id: n.kind for n in out.nodes}
    assert kinds["you"] == "current"
    assert kinds["me"] == "progression"


def test_promotes_first_node_when_no_root():
    d = _draft([_n("a"), _n("b")], [_e("a", "b")], rec="b")
    out = normalize_map(d)
    assert out.nodes[0].kind == "current"


def test_prunes_nodes_unreachable_from_root():
    d = _draft(
        [_n("you", "current"), _n("a"), _n("island")],
        [_e("you", "a")],
    )
    out = normalize_map(d)
    assert {n.id for n in out.nodes} == {"you", "a"}


def test_dedupes_node_ids_keeping_first():
    d = _draft(
        [_n("you", "current"), _n("a", fit=4.0), _n("a", fit=1.0)],
        [_e("you", "a")],
    )
    out = normalize_map(d)
    dupes = [n for n in out.nodes if n.id == "a"]
    assert len(dupes) == 1 and dupes[0].fit == 4.0


def test_invalid_recommendation_falls_back_to_best_ring1():
    d = _draft(
        [_n("you", "current"), _n("a", fit=3.0), _n("b", fit=4.8), _n("c", fit=5.0)],
        [_e("you", "a"), _e("you", "b"), _e("a", "c")],
        rec="ghost",
    )
    out = normalize_map(d)
    assert out.recommended_node_id == "b"  # highest-fit direct child of root
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_career_map_normalize.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.graphs.career_map'`

- [ ] **Step 3: Implement normalize_map**

```python
# app/graphs/career_map.py
"""Career map graph — graph-shaped evolution of the Career Path Navigator.

    gather_signals ──> map_graph ──> normalize
"""

from ..schemas import CareerMapDraft


def normalize_map(draft: CareerMapDraft) -> CareerMapDraft:
    """Pure-Python cleanup of LLM graph output. Never trust it blindly:
    dedupe ids, enforce a single root, drop dangling edges/self-loops,
    prune nodes unreachable from the root, repair the recommendation."""
    seen: set[str] = set()
    nodes = []
    for n in draft.nodes:
        if n.id in seen:
            continue
        seen.add(n.id)
        nodes.append(n)

    roots = [n for n in nodes if n.kind == "current"]
    if not roots and nodes:
        nodes[0].kind = "current"
        roots = [nodes[0]]
    for extra in roots[1:]:
        extra.kind = "progression"
    root = roots[0] if roots else None

    ids = {n.id for n in nodes}
    edges = [
        e for e in draft.edges
        if e.source in ids and e.target in ids and e.source != e.target
    ]

    if root:
        children: dict[str, list[str]] = {}
        for e in edges:
            children.setdefault(e.source, []).append(e.target)
        reachable = {root.id}
        stack = [root.id]
        while stack:
            for t in children.get(stack.pop(), []):
                if t not in reachable:
                    reachable.add(t)
                    stack.append(t)
        nodes = [n for n in nodes if n.id in reachable]
        ids = reachable
        edges = [e for e in edges if e.source in ids and e.target in ids]

    rec = draft.recommended_node_id
    if rec not in ids and root:
        ring1_ids = {e.target for e in edges if e.source == root.id}
        ring1 = [n for n in nodes if n.id in ring1_ids]
        pool = ring1 or [n for n in nodes if n.kind != "current"] or nodes
        rec = max(pool, key=lambda n: n.fit).id if pool else ""

    return CareerMapDraft(
        current_assessment=draft.current_assessment,
        nodes=nodes,
        edges=edges,
        recommended_node_id=rec,
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_career_map_normalize.py -v`
Expected: 7 PASS

- [ ] **Step 5: Commit**

```bash
git add app/graphs/career_map.py tests/test_career_map_normalize.py
git commit -m "feat(career-map): add normalize_map graph validation"
```

---

### Task 3: Backend — prompt + LangGraph pipeline

**Files:**
- Modify: `AURA-TALENT-BACKEND/app/prompts.py` (append at end)
- Modify: `AURA-TALENT-BACKEND/app/graphs/career_map.py` (add state, nodes, graph)
- Test: `AURA-TALENT-BACKEND/tests/test_career_map_graph.py`

**Interfaces:**
- Consumes: `gather_signals` from `app/graphs/career_path.py` (reused verbatim); `get_llm` from `app/llm.py`; `normalize_map` from Task 2.
- Produces: `career_map_graph` (compiled LangGraph; input state keys `resume_md`, `profile`, `evaluations`; output key `draft: CareerMapDraft`) and prompt `CAREER_MAP_SYSTEM` — used by Task 6. Graph node names are exactly `gather_signals`, `map_graph`, `normalize` (Task 6's SSE labels rely on these).

- [ ] **Step 1: Add CAREER_MAP_SYSTEM to app/prompts.py**

```python
CAREER_MAP_SYSTEM = """\
You are career-ops, a career strategist. Given a candidate's resume/profile and
their full history of evaluated job offers, produce a CAREER MAP: a directed
graph of realistic career futures radiating out from where they are NOW.

## What you receive
- The candidate's master resume and structured profile (skills, seniority,
  target archetypes).
- A history of evaluated offers with per-dimension fit scores. May be empty —
  if so, lean on the resume and SAY SO in the rationales; never fabricate
  patterns from thin data.

## Graph shape (hard requirements)
- 14-20 nodes total. EXACTLY ONE node with kind="current": the candidate's
  position today (id it "you"; duration "Today"; fit 5).
- A PROGRESSION chain: the natural next rungs, 2-3 levels deep
  (e.g. mid -> senior -> staff/manager fork). kind="progression".
- 2-3 PIVOT lanes: realistic lane changes reachable from the current position
  or from an early progression node. kind="pivot". Each lane may chain one
  level deeper.
- 2-3 WILDCARDS: roles that look unrelated but reuse the candidate's actual
  skill set (state WHICH skills transfer in `why`). kind="wildcard". Attach
  each wildcard edge to whichever node shares those skills — not necessarily
  the root.
- Edges are directed from the earlier role to the later role. Edge kind matches
  the target node's kind. Every node must be reachable from the root. No cycles.
- Node ids: short kebab-case slugs, unique.

## Node content
- duration: distance FROM TODAY ("6-12 months", "2-3 years", "4+ years").
- fit (1-5): how realistic from the current position; decays with distance.
- why: 2-3 sentences citing the resume and/or evaluation history explicitly.
- skill_gaps: the specific gaps for THIS role.
- moves: 2-3 tactical plays (same standard as the Career Path Navigator:
  concrete, decision-grade, spanning more than one category).
- salary_hint: rough local band if inferable from the data, else "".
- expandable: true only on LEAF nodes (no outgoing edges) that plausibly have
  further futures beyond them.
- recommended_node_id: the single best next move, usually ring 1.
"""
```

- [ ] **Step 2: Write the failing test (fake LLM, no network)**

```python
# tests/test_career_map_graph.py
import pytest

from app.graphs import career_map
from app.schemas import CareerMapDraft, CareerMapEdge, CareerMapNode


def _draft():
    return CareerMapDraft(
        current_assessment="Solid junior backend engineer.",
        nodes=[
            CareerMapNode(id="you", title="You", kind="current", duration="Today", fit=5, why="w"),
            CareerMapNode(id="be2", title="Backend Eng II", kind="progression",
                          duration="6-12 months", fit=4.7, why="w", expandable=True),
            CareerMapNode(id="ghost-child", title="Orphan", kind="pivot",
                          duration="2 years", fit=3.0, why="w"),
        ],
        edges=[CareerMapEdge(source="you", target="be2", kind="progression")],
        recommended_node_id="nope",
    )


class FakeLLM:
    def with_structured_output(self, schema):
        return self

    async def ainvoke(self, messages):
        return _draft()


@pytest.mark.asyncio
async def test_graph_produces_normalized_draft(monkeypatch):
    monkeypatch.setattr(career_map, "get_llm", lambda **kw: FakeLLM())
    result = await career_map.career_map_graph.ainvoke({
        "resume_md": "# Resume",
        "profile": {"headline": "Junior Backend Engineer"},
        "evaluations": [],
    })
    draft = result["draft"]
    assert {n.id for n in draft.nodes} == {"you", "be2"}  # orphan pruned
    assert draft.recommended_node_id == "be2"             # repaired


def test_graph_node_names():
    names = set(career_map.career_map_graph.get_graph().nodes.keys())
    assert {"gather_signals", "map_graph", "normalize"} <= names
```

If `pytest-asyncio` was just added, ensure `pyproject.toml` has `[tool.pytest.ini_options] asyncio_mode = "auto"` or keep the `@pytest.mark.asyncio` decorator with default strict mode configured; run `uv add --dev pytest-asyncio` if missing.

- [ ] **Step 3: Run test to verify it fails**

Run: `uv run pytest tests/test_career_map_graph.py -v`
Expected: FAIL with `AttributeError: module 'app.graphs.career_map' has no attribute 'career_map_graph'`

- [ ] **Step 4: Implement the graph (append to app/graphs/career_map.py)**

Add imports at the top of the file:

```python
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from ..llm import get_llm
from ..prompts import CAREER_MAP_SYSTEM
from .career_path import gather_signals
```

Append after `normalize_map`:

```python
class CareerMapState(TypedDict, total=False):
    resume_md: str
    profile: dict
    evaluations: list[dict]
    data_brief: str
    draft: CareerMapDraft


async def map_graph(state: CareerMapState) -> dict:
    llm = get_llm(temperature=0.4).with_structured_output(CareerMapDraft)
    draft = await llm.ainvoke([
        ("system", CAREER_MAP_SYSTEM),
        ("human",
         f"## Candidate resume\n\n{state['resume_md']}\n\n"
         f"## Data signals\n\n{state['data_brief']}"),
    ])
    return {"draft": draft}


def normalize(state: CareerMapState) -> dict:
    return {"draft": normalize_map(state["draft"])}


def build_career_map_graph():
    g = StateGraph(CareerMapState)
    g.add_node("gather_signals", gather_signals)
    g.add_node("map_graph", map_graph)
    g.add_node("normalize", normalize)
    g.add_edge(START, "gather_signals")
    g.add_edge("gather_signals", "map_graph")
    g.add_edge("map_graph", "normalize")
    g.add_edge("normalize", END)
    return g.compile()


career_map_graph = build_career_map_graph()
```

Note: `gather_signals` (from career_path) reads optional `goal`/`horizon` keys with `.get()` — absent keys are fine. `map_graph` must reference `get_llm` via the module global (as written) so the test's monkeypatch works.

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/test_career_map_graph.py tests/test_career_map_normalize.py -v`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add app/prompts.py app/graphs/career_map.py tests/test_career_map_graph.py pyproject.toml uv.lock
git commit -m "feat(career-map): add generation prompt and LangGraph pipeline"
```

---

### Task 4: Backend — career_maps storage

**Files:**
- Modify: `AURA-TALENT-BACKEND/app/storage.py` (add after `get_resume`, ~line 63)
- Test: `AURA-TALENT-BACKEND/tests/test_career_map_storage.py`
- Manual: run SQL in the Supabase dashboard SQL editor

**Interfaces:**
- Produces: `get_career_map(user_id) -> dict | None`, `save_career_map(user_id, map_json: dict) -> None` — used by Task 6.

- [ ] **Step 1: Create the Supabase table (manual, do first)**

In the Supabase project dashboard → SQL editor, run:

```sql
create table if not exists career_maps (
  user_id text primary key,
  map_json jsonb not null,
  updated_at timestamptz default now()
);
```

- [ ] **Step 2: Write the failing test**

```python
# tests/test_career_map_storage.py
import json
from unittest.mock import MagicMock

from app import storage


def _wire(mock_rows):
    client = MagicMock()
    table = MagicMock()
    client.table.return_value = table
    select = MagicMock()
    table.select.return_value = select
    eq = MagicMock()
    select.eq.return_value = eq
    eq.execute.return_value = MagicMock(data=mock_rows)
    return client, table


def test_get_career_map_missing_returns_none(monkeypatch):
    client, _ = _wire([])
    monkeypatch.setattr(storage, "supabase", client)
    assert storage.get_career_map("u1") is None


def test_get_career_map_parses_json_string(monkeypatch):
    payload = {"user_id": "u1", "nodes": []}
    client, _ = _wire([{"user_id": "u1", "map_json": json.dumps(payload)}])
    monkeypatch.setattr(storage, "supabase", client)
    assert storage.get_career_map("u1") == payload


def test_save_career_map_upserts(monkeypatch):
    client, table = _wire([])
    monkeypatch.setattr(storage, "supabase", client)
    storage.save_career_map("u1", {"nodes": []})
    args = table.upsert.call_args[0][0]
    assert args["user_id"] == "u1"
    assert args["map_json"] == {"nodes": []}
    assert "updated_at" in args
```

- [ ] **Step 3: Run test to verify it fails**

Run: `uv run pytest tests/test_career_map_storage.py -v`
Expected: FAIL with `AttributeError: module 'app.storage' has no attribute 'get_career_map'`

- [ ] **Step 4: Implement storage functions**

Add to `app/storage.py` after `get_resume` (match the file's existing style; it already imports `json` — if it doesn't import `datetime`, add `from datetime import datetime, timezone`):

```python
def get_career_map(user_id: str) -> dict | None:
    res = supabase.table("career_maps").select("*").eq("user_id", user_id).execute()
    if not res.data:
        return None
    map_json = res.data[0]["map_json"]
    if isinstance(map_json, str):
        map_json = json.loads(map_json)
    return map_json


def save_career_map(user_id: str, map_json: dict) -> None:
    supabase.table("career_maps").upsert({
        "user_id": user_id,
        "map_json": map_json,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).execute()
```

- [ ] **Step 5: Run test to verify it passes**

Run: `uv run pytest tests/test_career_map_storage.py -v`
Expected: 3 PASS

- [ ] **Step 6: Commit**

```bash
git add app/storage.py tests/test_career_map_storage.py
git commit -m "feat(career-map): add career_maps storage"
```

---

### Task 5: Backend — expansion (expand_node + merge_expansion)

**Files:**
- Modify: `AURA-TALENT-BACKEND/app/prompts.py` (append)
- Modify: `AURA-TALENT-BACKEND/app/graphs/career_map.py` (append)
- Test: `AURA-TALENT-BACKEND/tests/test_career_map_expand.py`

**Interfaces:**
- Consumes: `CareerMapExpansion` (Task 1), `get_llm`.
- Produces: `async expand_node(map_dict: dict, node_id: str) -> CareerMapExpansion` and `merge_expansion(map_dict: dict, expansion: CareerMapExpansion, node_id: str) -> dict` (mutates + returns `map_dict`) — used by Task 6.

- [ ] **Step 1: Add CAREER_MAP_EXPAND_SYSTEM to app/prompts.py**

```python
CAREER_MAP_EXPAND_SYSTEM = """\
You are career-ops, extending an existing career map. The candidate chose one
leaf node and wants to see what lies beyond it.

Given the map summary and the target node, produce 2-4 NEW child roles that
follow AFTER the target role (durations measured from today, so later than the
target's). Rules:
- kind: "progression" for the natural continuation, "pivot"/"wildcard" where a
  lane change or skill-adjacent jump beyond the target is more interesting.
  NEVER "current".
- New ids must be new kebab-case slugs not in the existing map.
- Edges connect the target node (or a new node) to each new node.
- Same content standards as the original map: grounded `why`, concrete moves,
  fit decaying with distance. Mark a new node expandable only if a further
  future beyond IT is plausible.
"""
```

- [ ] **Step 2: Write the failing tests (merge logic is pure — TDD it hard)**

```python
# tests/test_career_map_expand.py
from app.graphs.career_map import merge_expansion
from app.schemas import CareerMapEdge, CareerMapExpansion, CareerMapNode


def _map():
    return {
        "user_id": "u1",
        "current_assessment": "ok",
        "generated_at": "2026-07-12T00:00:00+00:00",
        "recommended_node_id": "be2",
        "nodes": [
            {"id": "you", "title": "You", "kind": "current", "duration": "Today",
             "fit": 5, "salary_hint": "", "why": "w", "skill_gaps": [], "moves": [],
             "expandable": False},
            {"id": "be2", "title": "BE II", "kind": "progression", "duration": "1 year",
             "fit": 4.5, "salary_hint": "", "why": "w", "skill_gaps": [], "moves": [],
             "expandable": True},
        ],
        "edges": [{"source": "you", "target": "be2", "kind": "progression"}],
    }


def _exp_node(id, kind="progression"):
    return CareerMapNode(id=id, title=id, kind=kind, duration="3 years", fit=3.5, why="w")


def test_merge_adds_nodes_and_edges():
    exp = CareerMapExpansion(
        nodes=[_exp_node("sbe")],
        edges=[CareerMapEdge(source="be2", target="sbe", kind="progression")],
    )
    merged = merge_expansion(_map(), exp, "be2")
    assert {n["id"] for n in merged["nodes"]} == {"you", "be2", "sbe"}
    assert {"source": "be2", "target": "sbe", "kind": "progression"} in merged["edges"]


def test_merge_skips_duplicate_ids():
    exp = CareerMapExpansion(nodes=[_exp_node("be2")], edges=[])
    merged = merge_expansion(_map(), exp, "be2")
    assert len([n for n in merged["nodes"] if n["id"] == "be2"]) == 1


def test_merge_auto_links_unconnected_new_nodes_to_target():
    exp = CareerMapExpansion(nodes=[_exp_node("sbe")], edges=[])
    merged = merge_expansion(_map(), exp, "be2")
    assert {"source": "be2", "target": "sbe", "kind": "progression"} in merged["edges"]


def test_merge_coerces_current_kind_to_progression():
    exp = CareerMapExpansion(nodes=[_exp_node("boss", kind="current")], edges=[])
    merged = merge_expansion(_map(), exp, "be2")
    boss = next(n for n in merged["nodes"] if n["id"] == "boss")
    assert boss["kind"] == "progression"


def test_merge_flips_target_expandable_off():
    exp = CareerMapExpansion(nodes=[_exp_node("sbe")], edges=[])
    merged = merge_expansion(_map(), exp, "be2")
    be2 = next(n for n in merged["nodes"] if n["id"] == "be2")
    assert be2["expandable"] is False


def test_merge_drops_edges_to_unknown_nodes():
    exp = CareerMapExpansion(
        nodes=[_exp_node("sbe")],
        edges=[CareerMapEdge(source="be2", target="ghost", kind="progression")],
    )
    merged = merge_expansion(_map(), exp, "be2")
    assert not any(e["target"] == "ghost" for e in merged["edges"])
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `uv run pytest tests/test_career_map_expand.py -v`
Expected: FAIL with `ImportError: cannot import name 'merge_expansion'`

- [ ] **Step 4: Implement (append to app/graphs/career_map.py)**

Add `CAREER_MAP_EXPAND_SYSTEM` to the existing prompts import, `CareerMapExpansion` to the schemas import, then:

```python
async def expand_node(map_dict: dict, node_id: str) -> CareerMapExpansion:
    """One-shot LLM call: grow 2-4 children beyond a leaf node."""
    target = next(n for n in map_dict["nodes"] if n["id"] == node_id)
    summary = "\n".join(
        f"- {n['id']}: {n['title']} ({n['kind']}, {n['duration']}, fit {n['fit']})"
        for n in map_dict["nodes"]
    )
    llm = get_llm(temperature=0.4).with_structured_output(CareerMapExpansion)
    return await llm.ainvoke([
        ("system", CAREER_MAP_EXPAND_SYSTEM),
        ("human",
         f"## Existing map\n\n{summary}\n\n"
         f"## Target node to expand\n\n"
         f"{target['title']} (id: {target['id']}, {target['duration']} from today)\n"
         f"Why it fits: {target['why']}"),
    ])


def merge_expansion(map_dict: dict, expansion: CareerMapExpansion, node_id: str) -> dict:
    """Merge expansion output into a stored map dict. Defensive: dedupe ids,
    coerce illegal kinds, guarantee every new node hangs off the target."""
    existing = {n["id"] for n in map_dict["nodes"]}
    new_nodes = []
    for n in expansion.nodes:
        if n.id in existing:
            continue
        row = n.model_dump()
        if row["kind"] == "current":
            row["kind"] = "progression"
        existing.add(row["id"])
        new_nodes.append(row)

    new_ids = {n["id"] for n in new_nodes}
    new_edges = [
        e.model_dump() for e in expansion.edges
        if e.source in existing and e.target in new_ids and e.source != e.target
    ]
    linked = {e["target"] for e in new_edges}
    for n in new_nodes:
        if n["id"] not in linked:
            new_edges.append({"source": node_id, "target": n["id"], "kind": n["kind"]})

    map_dict["nodes"].extend(new_nodes)
    map_dict["edges"].extend(new_edges)
    for n in map_dict["nodes"]:
        if n["id"] == node_id:
            n["expandable"] = False
    return map_dict
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/test_career_map_expand.py -v`
Expected: 6 PASS

- [ ] **Step 6: Commit**

```bash
git add app/prompts.py app/graphs/career_map.py tests/test_career_map_expand.py
git commit -m "feat(career-map): add node expansion and merge logic"
```

---

### Task 6: Backend — router endpoints

**Files:**
- Modify: `AURA-TALENT-BACKEND/app/routers/career.py`
- Test: `AURA-TALENT-BACKEND/tests/test_career_map_router.py`

**Interfaces:**
- Consumes: `career_map_graph`, `expand_node`, `merge_expansion` (Tasks 3, 5); `storage.get_career_map`/`save_career_map` (Task 4); schemas (Task 1); existing `_sse` helper and `verify_user_role`.
- Produces: `POST /api/v1/career/map`, `POST /api/v1/career/map/stream`, `POST /api/v1/career/map/expand` — consumed by the frontend (Tasks 7, 9).

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_career_map_router.py
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import career


STORED = {
    "user_id": "u1",
    "current_assessment": "ok",
    "generated_at": "2026-07-12T00:00:00+00:00",
    "recommended_node_id": "be2",
    "nodes": [
        {"id": "you", "title": "You", "kind": "current", "duration": "Today",
         "fit": 5, "salary_hint": "", "why": "w", "skill_gaps": [], "moves": [],
         "expandable": False},
        {"id": "be2", "title": "BE II", "kind": "progression", "duration": "1 year",
         "fit": 4.5, "salary_hint": "", "why": "w", "skill_gaps": [], "moves": [],
         "expandable": True},
    ],
    "edges": [{"source": "you", "target": "be2", "kind": "progression"}],
}


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(career, "verify_user_role", lambda uid, roles: None)
    app = FastAPI()
    app.include_router(career.router, prefix="/api/v1")
    return TestClient(app)


def test_map_returns_cached(client, monkeypatch):
    monkeypatch.setattr(career.storage, "get_career_map", lambda uid: dict(STORED))
    r = client.post("/api/v1/career/map", json={"user_id": "u1"})
    assert r.status_code == 200
    assert r.json()["recommended_node_id"] == "be2"


def test_map_404_without_resume_when_generating(client, monkeypatch):
    monkeypatch.setattr(career.storage, "get_career_map", lambda uid: None)
    monkeypatch.setattr(career.storage, "get_resume", lambda uid: None)
    r = client.post("/api/v1/career/map", json={"user_id": "u1"})
    assert r.status_code == 404


def test_expand_merges_and_saves(client, monkeypatch):
    from app.schemas import CareerMapEdge, CareerMapExpansion, CareerMapNode

    saved = {}
    monkeypatch.setattr(career.storage, "get_career_map", lambda uid: dict(STORED, nodes=[dict(n) for n in STORED["nodes"]], edges=[dict(e) for e in STORED["edges"]]))
    monkeypatch.setattr(career.storage, "save_career_map", lambda uid, m: saved.update(m))

    async def fake_expand(map_dict, node_id):
        return CareerMapExpansion(
            nodes=[CareerMapNode(id="sbe", title="Senior BE", kind="progression",
                                 duration="3 years", fit=4.0, why="w")],
            edges=[CareerMapEdge(source="be2", target="sbe", kind="progression")],
        )

    monkeypatch.setattr(career, "expand_node", fake_expand)
    r = client.post("/api/v1/career/map/expand", json={"user_id": "u1", "node_id": "be2"})
    assert r.status_code == 200
    assert {n["id"] for n in r.json()["nodes"]} == {"you", "be2", "sbe"}
    assert saved  # persisted


def test_expand_404_without_map(client, monkeypatch):
    monkeypatch.setattr(career.storage, "get_career_map", lambda uid: None)
    r = client.post("/api/v1/career/map/expand", json={"user_id": "u1", "node_id": "x"})
    assert r.status_code == 404


def test_expand_404_unknown_node(client, monkeypatch):
    monkeypatch.setattr(career.storage, "get_career_map", lambda uid: dict(STORED))
    r = client.post("/api/v1/career/map/expand", json={"user_id": "u1", "node_id": "ghost"})
    assert r.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_career_map_router.py -v`
Expected: FAIL (404 route not found on `/career/map`)

- [ ] **Step 3: Implement endpoints (append to app/routers/career.py)**

Extend the imports at the top of the file:

```python
from datetime import datetime, timezone

from ..graphs.career_map import career_map_graph, expand_node, merge_expansion
from ..schemas import (
    CareerMapExpandIn, CareerMapIn, CareerMapOut, CareerPathIn, CareerPathOut,
)
```

Append:

```python
_MAP_NODE_LABELS = {
    "gather_signals": "Gathering your resume and evaluation history...",
    "map_graph": "Mapping your career space...",
    "normalize": "Validating the map...",
}


def _map_state(user_id: str) -> dict:
    verify_user_role(user_id, ["candidate"])
    resume = storage.get_resume(user_id)
    if not resume:
        raise HTTPException(404, "Upload a resume first")
    return {
        "resume_md": resume["markdown"],
        "profile": resume.get("profile") or {},
        "evaluations": storage.list_evaluations(user_id),
    }


def _map_out(user_id: str, draft) -> CareerMapOut:
    return CareerMapOut(
        **draft.model_dump(),
        user_id=user_id,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


@router.post("/map", response_model=CareerMapOut)
async def career_map(body: CareerMapIn):
    """Return the stored career map, generating (and persisting) it if absent
    or if force_refresh is set."""
    if not body.force_refresh:
        stored = storage.get_career_map(body.user_id)
        if stored:
            return CareerMapOut(**stored)
    state = _map_state(body.user_id)
    logger.info(f"🗺️ Career map for user {body.user_id}")
    try:
        result = await career_map_graph.ainvoke(state)
    except ValueError as e:
        raise HTTPException(422, str(e))
    out = _map_out(body.user_id, result["draft"])
    storage.save_career_map(body.user_id, out.model_dump())
    return out


@router.post("/map/stream")
async def career_map_stream(body: CareerMapIn):
    """Same as /map but SSE: stage progress events, then the result. A cached
    map is yielded immediately as the result event."""
    if not body.force_refresh:
        stored = storage.get_career_map(body.user_id)
        if stored:
            async def cached():
                yield _sse("result", stored)
            return StreamingResponse(cached(), media_type="text/event-stream")

    state = _map_state(body.user_id)

    async def generate():
        try:
            final_result = None
            async for event in career_map_graph.astream_events(state, version="v2"):
                if event["event"] == "on_chain_start" and event["name"] in _MAP_NODE_LABELS:
                    yield _sse("progress", {
                        "node": event["name"],
                        "message": _MAP_NODE_LABELS[event["name"]],
                    })
                if event["event"] == "on_chain_end" and event.get("name") == "LangGraph":
                    final_result = event.get("data", {}).get("output")

            if not final_result:
                final_result = await career_map_graph.ainvoke(state)

            out = _map_out(body.user_id, final_result["draft"])
            storage.save_career_map(body.user_id, out.model_dump())
            yield _sse("result", out.model_dump())
        except ValueError as e:
            log_error(e, context="career_map_stream")
            yield _sse("error", {"detail": str(e)})
        except Exception as e:
            log_error(e, context="career_map_stream")
            yield _sse("error", {"detail": "Internal server error"})

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/map/expand", response_model=CareerMapOut)
async def career_map_expand(body: CareerMapExpandIn):
    """Grow 2-4 child roles beyond one expandable leaf node; persist the merge."""
    verify_user_role(body.user_id, ["candidate"])
    stored = storage.get_career_map(body.user_id)
    if not stored:
        raise HTTPException(404, "Generate a career map first")
    if not any(n["id"] == body.node_id for n in stored["nodes"]):
        raise HTTPException(404, f"Node '{body.node_id}' not in map")
    logger.info(f"🌱 Expanding career map node {body.node_id} for user {body.user_id}")
    expansion = await expand_node(stored, body.node_id)
    merged = merge_expansion(stored, expansion, body.node_id)
    storage.save_career_map(body.user_id, merged)
    return CareerMapOut(**merged)
```

- [ ] **Step 4: Run all backend tests**

Run: `uv run pytest tests/ -v --ignore=tests/scratch_test.py`
Expected: all career-map tests PASS (test_rbac.py is script-style; ignore failures unrelated to this feature)

- [ ] **Step 5: Commit**

```bash
git add app/routers/career.py tests/test_career_map_router.py
git commit -m "feat(career-map): add map, stream, and expand endpoints"
```

---

### Task 7: Frontend — API types + client methods + d3-force-3d dep

**Files:**
- Modify: `AURA-TALENT-FRONTEND/lib/api.ts` (types near `CareerPathIn` ~line 248; methods inside `export const api`)
- Create: `AURA-TALENT-FRONTEND/types/d3-force-3d.d.ts`

**Interfaces:**
- Consumes: existing `CareerMove` interface, `postJson`, `getUserId` in `lib/api.ts`.
- Produces: `CareerMapNode`, `CareerMapEdge`, `CareerMapOut`, `CareerMapNodeKind` types; `api.careerMap(force_refresh?)`, `api.careerMapExpand(node_id)` — used by Tasks 8-12.

- [ ] **Step 1: Install d3-force-3d**

Run: `cd /Users/tian/Desktop/personal-repo/aura-talent/AURA-TALENT-FRONTEND && npm install d3-force-3d`
Expected: added to package.json dependencies.

- [ ] **Step 2: Add module declaration**

```ts
// types/d3-force-3d.d.ts
// Deliberately loose — upstream ships no types and every builder is chainable.
// This .d.ts is the one sanctioned `any` zone in the feature.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "d3-force-3d" {
  export function forceSimulation(nodes: any[], numDimensions?: number): any;
  export function forceLink(links: any[]): any;
  export function forceManyBody(): any;
  export function forceCollide(radius: number): any;
}
```

- [ ] **Step 3: Add types + methods to lib/api.ts**

After `CareerPathIn` (~line 252):

```ts
/* ── Career map ── */

export type CareerMapNodeKind = "current" | "progression" | "pivot" | "wildcard";

export interface CareerMapNode {
  id: string;
  title: string;
  kind: CareerMapNodeKind;
  duration: string;
  fit: number;
  salary_hint: string;
  why: string;
  skill_gaps: string[];
  moves: CareerMove[];
  expandable: boolean;
}

export interface CareerMapEdge {
  source: string;
  target: string;
  kind: Exclude<CareerMapNodeKind, "current">;
}

export interface CareerMapOut {
  user_id: string;
  current_assessment: string;
  nodes: CareerMapNode[];
  edges: CareerMapEdge[];
  recommended_node_id: string;
  generated_at: string;
}
```

Inside `export const api = { … }`, after the `compare` entry:

```ts
  careerMap: (force_refresh = false) =>
    postJson<CareerMapOut>("career/map", { user_id: getUserId(), force_refresh }),

  careerMapExpand: (node_id: string) =>
    postJson<CareerMapOut>("career/map/expand", { user_id: getUserId(), node_id }),
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/api.ts types/d3-force-3d.d.ts package.json package-lock.json
git commit -m "feat(career-map): api types, client methods, d3-force-3d dep"
```

---

### Task 8: Frontend — deterministic layout module

**Files:**
- Create: `AURA-TALENT-FRONTEND/lib/career-map/layout.ts`

**Interfaces:**
- Consumes: `CareerMapOut`, `CareerMapNode` from `lib/api.ts`; `d3-force-3d`.
- Produces: `layoutMap(map: CareerMapOut): Map<string, NodePosition>` with `interface NodePosition { x: number; y: number; z: number; depth: number }` — used by Task 10's scene.

- [ ] **Step 1: Implement layout.ts**

```ts
// lib/career-map/layout.ts
// Deterministic sector/ring seeding + brief d3-force-3d relaxation.
// Same map in → same layout out, every visit (spec §3.2).
import { forceCollide, forceLink, forceManyBody, forceSimulation } from "d3-force-3d";
import type { CareerMapNode, CareerMapOut } from "@/lib/api";

export interface NodePosition {
  x: number;
  y: number;
  z: number;
  depth: number;
}

const RING = 165; // world units per depth ring

/** Deterministic pseudo-random in [0,1) from a string — replaces Math.random. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

const KIND_ORDER: Record<CareerMapNode["kind"], number> = {
  current: 0,
  progression: 0,
  pivot: 1,
  wildcard: 2,
};

export function layoutMap(map: CareerMapOut): Map<string, NodePosition> {
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const root = map.nodes.find((n) => n.kind === "current") ?? map.nodes[0];
  const out = new Map<string, NodePosition>();
  if (!root) return out;

  // children adjacency, defensive against edges to missing nodes
  const children = new Map<string, string[]>();
  for (const e of map.edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    children.set(e.source, [...(children.get(e.source) ?? []), e.target]);
  }

  // BFS: depth + inherited sector angle
  const angle = new Map<string, number>([[root.id, 0]]);
  const depth = new Map<string, number>([[root.id, 0]]);
  // ring-1: sectors ordered progression → pivot → wildcard, evenly spaced
  const ring1 = (children.get(root.id) ?? [])
    .map((id) => byId.get(id)!)
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.id.localeCompare(b.id));
  ring1.forEach((n, i) => {
    angle.set(n.id, (i / Math.max(ring1.length, 1)) * Math.PI * 2);
    depth.set(n.id, 1);
  });
  const queue = ring1.map((n) => n.id);
  while (queue.length) {
    const id = queue.shift()!;
    const kids = (children.get(id) ?? []).filter((k) => !depth.has(k));
    kids.sort().forEach((kid, i) => {
      depth.set(kid, depth.get(id)! + 1);
      // children fan out around the parent's angle, deterministic
      angle.set(kid, angle.get(id)! + (i - (kids.length - 1) / 2) * 0.38);
      queue.push(kid);
    });
  }

  // seed positions
  const simNodes = map.nodes
    .filter((n) => depth.has(n.id))
    .map((n) => {
      const d = depth.get(n.id)!;
      const a = angle.get(n.id)!;
      return {
        id: n.id,
        x: Math.sin(a) * d * RING,
        y: (hash01(n.id) - 0.5) * 140,
        z: Math.cos(a) * d * RING,
        fx: d === 0 ? 0 : null,
        fy: d === 0 ? 0 : null,
        fz: d === 0 ? 0 : null,
      };
    });
  const simLinks = map.edges
    .filter((e) => depth.has(e.source) && depth.has(e.target))
    .map((e) => ({ source: e.source, target: e.target }));

  // brief synchronous relaxation — organic, but sectors hold
  const sim = forceSimulation(simNodes, 3)
    .force("link", forceLink(simLinks).id((d) => d.id as string).distance(RING * 0.9))
    .force("charge", forceManyBody().strength(-90))
    .force("collide", forceCollide(30))
    .alphaDecay(0.05)
    .stop();
  for (let i = 0; i < 120; i++) sim.tick();

  for (const sn of simNodes) {
    out.set(sn.id as string, {
      x: sn.x,
      y: sn.y,
      z: sn.z,
      depth: depth.get(sn.id as string)!,
    });
  }
  return out;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (adjust the `.d.ts` from Task 7 if chaining types complain).

- [ ] **Step 3: Commit**

```bash
git add lib/career-map/layout.ts
git commit -m "feat(career-map): deterministic sector/ring layout with force relaxation"
```

---

### Task 9: Frontend — useCareerMap data hook

**Files:**
- Create: `AURA-TALENT-FRONTEND/hooks/useCareerMap.ts`

**Interfaces:**
- Consumes: `useStream` from `lib/useStream.ts` (signature: `useStream<T, B>(path)` → `{ run, reset, progress, result, error, loading }`); `api.careerMapExpand`, `ApiError`, `CareerMapOut` from `lib/api.ts`.
- Produces: `useCareerMap()` returning `{ map, progress, loading, error, expanding, expand, regenerate }` — used by Task 12's page. Always streams via `career/map/stream` (backend yields cached maps instantly), per spec.

- [ ] **Step 1: Implement the hook**

```ts
// hooks/useCareerMap.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type CareerMapOut } from "@/lib/api";
import { useStream } from "@/lib/useStream";

export interface UseCareerMap {
  map: CareerMapOut | null;
  progress: { node: string; message: string }[];
  loading: boolean;
  error: string | null;
  expanding: string | null; // node id being expanded, or null
  expandError: string | null;
  expand: (nodeId: string) => Promise<CareerMapOut | null>;
  regenerate: () => void;
}

export function useCareerMap(): UseCareerMap {
  const stream = useStream<CareerMapOut, { force_refresh?: boolean }>("career/map/stream");
  const [map, setMap] = useState<CareerMapOut | null>(null);
  const [expanding, setExpanding] = useState<string | null>(null);
  const [expandError, setExpandError] = useState<string | null>(null);
  const started = useRef(false);

  // The stream endpoint returns a cached map instantly when one exists,
  // so streaming is the single load path (first visit and return visits).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void stream.run({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stream.result) setMap(stream.result);
  }, [stream.result]);

  const expand = useCallback(
    async (nodeId: string): Promise<CareerMapOut | null> => {
      setExpanding(nodeId);
      setExpandError(null);
      try {
        const updated = await api.careerMapExpand(nodeId);
        setMap(updated);
        return updated;
      } catch (e) {
        setExpandError(e instanceof ApiError ? e.message : "Expansion failed — try again.");
        return null;
      } finally {
        setExpanding(null);
      }
    },
    []
  );

  const regenerate = useCallback(() => {
    setMap(null);
    void stream.run({ force_refresh: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.run]);

  return {
    map,
    progress: stream.progress,
    loading: stream.loading,
    error: stream.error,
    expanding,
    expandError,
    expand,
    regenerate,
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/useCareerMap.ts
git commit -m "feat(career-map): data hook (stream load, expand, regenerate)"
```

---

### Task 10: Frontend — three.js scene class

**Files:**
- Create: `AURA-TALENT-FRONTEND/lib/career-map/scene.ts`

**Interfaces:**
- Consumes: `layoutMap`/`NodePosition` (Task 8), `CareerMapOut`/`CareerMapNode` types (Task 7), `three`, `three/addons/*`, `gsap`.
- Produces: class `CareerMapScene` — used by Task 12:
  - `constructor(container: HTMLElement, callbacks: SceneCallbacks, opts: { reducedMotion: boolean })`
  - `setMap(map: CareerMapOut, opts: { animate: boolean }): void` — full rebuild; when a previous map exists, only genuinely new nodes pop in.
  - `diveInto(nodeId: string): void` — camera push-in; fires `callbacks.onDiveComplete(node)` when the overlay should appear.
  - `zoomOut(): void` — reverse dive back to the saved camera state.
  - `dispose(): void`
  - `interface SceneCallbacks { onHover(node: CareerMapNode | null): void; onDiveComplete(node: CareerMapNode): void; onSpawn(born: number, total: number): void }`

This is the wow-factor core. Polish requirements from spec §6 are implemented here: layered node forms per kind, tight bloom, dust particles, route-highlight hover, pause-rotation-on-hover, continuous dive (no page wipe).

- [ ] **Step 1: Implement scene.ts**

```ts
// lib/career-map/scene.ts
// Framework-free three.js scene for the career constellation.
// React never touches three objects; the page talks to this class only.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { FilmPass } from "three/addons/postprocessing/FilmPass.js";
import gsap from "gsap";
import type { CareerMapNode, CareerMapOut } from "@/lib/api";
import { layoutMap } from "./layout";

export interface SceneCallbacks {
  onHover(node: CareerMapNode | null): void;
  onDiveComplete(node: CareerMapNode): void;
  onSpawn(born: number, total: number): void;
}

const KIND_COLOR: Record<CareerMapNode["kind"], number> = {
  current: 0xfafaf8,
  progression: 0x8f7dff,
  pivot: 0xffb98f,
  wildcard: 0x7fd6b2,
};

interface NodeVisual {
  node: CareerMapNode;
  group: THREE.Group;          // core + accent + halo + label
  core: THREE.Mesh;
  halo: THREE.Sprite;
  label: THREE.Sprite;
  baseHaloScale: number;
}

function makeHaloTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,0.85)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.28)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function makeLabelTexture(title: string, sub: string, color: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  const scale = 2;
  c.width = 340 * scale;
  c.height = 64 * scale;
  const g = c.getContext("2d")!;
  g.scale(scale, scale);
  g.textAlign = "center";
  g.font = "600 15px 'Hanken Grotesk', 'Avenir Next', sans-serif";
  g.fillStyle = "rgba(250,250,248,0.92)";
  g.fillText(title, 170, 22);
  g.font = "11px 'Space Mono', ui-monospace, monospace";
  g.fillStyle = color;
  g.fillText(sub, 170, 44);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class CareerMapScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private composer: EffectComposer;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private haloTex = makeHaloTexture();

  private visuals = new Map<string, NodeVisual>();
  private edgeLines: { line: THREE.Line; source: string; target: string }[] = [];
  private edgesGroup = new THREE.Group();
  private nodesGroup = new THREE.Group();
  private map: CareerMapOut | null = null;

  private hoveredId: string | null = null;
  private mode: "map" | "diving" | "detail" | "returning" = "map";
  private savedCam: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;
  private raf = 0;
  private disposed = false;

  constructor(
    private container: HTMLElement,
    private cb: SceneCallbacks,
    private opts: { reducedMotion: boolean }
  ) {
    const w = container.clientWidth, h = container.clientHeight;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x0b0e1c);
    this.scene.fog = new THREE.FogExp2(0x0b0e1c, 0.00085);

    this.camera = new THREE.PerspectiveCamera(55, w / h, 1, 4000);
    this.camera.position.set(0, 120, 620);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.autoRotate = !opts.reducedMotion;
    this.controls.autoRotateSpeed = 0.45;
    this.controls.minDistance = 180;
    this.controls.maxDistance = 1400;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.75, 0.55, 0.72);
    this.composer.addPass(bloom); // tight: high threshold, modest strength
    this.composer.addPass(new FilmPass(0.18, false)); // subtle grain (spec §6)

    this.scene.add(this.edgesGroup, this.nodesGroup);
    this.addDust();

    this.renderer.domElement.addEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.addEventListener("click", this.onClick);
    window.addEventListener("resize", this.onResize);
    this.tick();
  }

  /* ── ambient dust ── */
  private addDust() {
    const count = 350;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // deterministic spherical scatter
      const t = i / count;
      const a = t * Math.PI * 40;
      const r = 250 + (i % 97) * 6;
      pos[i * 3] = Math.sin(a) * r;
      pos[i * 3 + 1] = ((i % 53) - 26) * 14;
      pos[i * 3 + 2] = Math.cos(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 1.6, map: this.haloTex, transparent: true, opacity: 0.16,
      color: 0xc7b9ff, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.scene.add(new THREE.Points(geo, mat));
  }

  /* ── build / update ── */
  setMap(map: CareerMapOut, { animate }: { animate: boolean }) {
    const prevIds = new Set(this.visuals.keys());
    this.map = map;
    const positions = layoutMap(map);

    // clear
    this.nodesGroup.clear();
    this.edgesGroup.clear();
    for (const v of this.visuals.values()) {
      (v.label.material as THREE.SpriteMaterial).map?.dispose();
    }
    this.visuals.clear();
    this.edgeLines = [];

    const validIds = new Set(positions.keys());
    let total = 0;

    for (const node of map.nodes) {
      const p = positions.get(node.id);
      if (!p) continue; // unreachable node — client-side defense
      total++;
      const color = new THREE.Color(KIND_COLOR[node.kind]);
      const group = new THREE.Group();
      group.position.set(p.x, p.y, p.z);

      const isRoot = node.kind === "current";
      const coreR = isRoot ? 13 : 5.5 + node.fit * 1.7;

      // core: sphere for progression/pivot/current, octahedron for wildcard
      const coreGeo = node.kind === "wildcard"
        ? new THREE.OctahedronGeometry(coreR)
        : new THREE.SphereGeometry(coreR, 24, 24);
      const core = new THREE.Mesh(
        coreGeo,
        new THREE.MeshBasicMaterial({ color, transparent: true })
      );
      core.userData.nodeId = node.id;
      group.add(core);

      // kind accent: tilted ring (progression), vertical ring (pivot), pulsing ring (current)
      if (node.kind !== "wildcard") {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(coreR + 5, 0.45, 8, 48),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 })
        );
        if (node.kind === "progression") ring.rotation.x = Math.PI / 2.4;
        if (node.kind === "pivot") ring.rotation.y = Math.PI / 2;
        if (isRoot) ring.rotation.x = Math.PI / 2;
        group.add(ring);
      }

      // halo sprite
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.haloTex, color, transparent: true, opacity: 0.55,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      const haloScale = coreR * 7;
      halo.scale.setScalar(haloScale);
      group.add(halo);

      // label sprite
      const hex = `#${color.getHexString()}`;
      const label = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeLabelTexture(node.title, isRoot ? "you are here" : node.duration, hex),
        transparent: true, depthWrite: false,
      }));
      label.scale.set(110, 20.7, 1);
      label.position.y = -(coreR + 20);
      group.add(label);

      this.nodesGroup.add(group);
      this.visuals.set(node.id, { node, group, core, halo, label, baseHaloScale: haloScale });
    }

    for (const e of map.edges) {
      if (!validIds.has(e.source) || !validIds.has(e.target)) continue;
      const a = positions.get(e.source)!;
      const b = positions.get(e.target)!;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z),
      ]);
      const color = KIND_COLOR[e.kind];
      const mat = e.kind === "wildcard"
        ? new THREE.LineDashedMaterial({ color, transparent: true, opacity: 0.34, dashSize: 6, gapSize: 7 })
        : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3 });
      const line = new THREE.Line(geo, mat);
      if (e.kind === "wildcard") line.computeLineDistances();
      this.edgesGroup.add(line);
      this.edgeLines.push({ line, source: e.source, target: e.target });
    }

    // spawn animation: full stagger on fresh build, pop-in for new nodes only
    let born = 0;
    for (const [id, v] of this.visuals) {
      const isNew = !prevIds.has(id);
      if (!animate && !isNew) {
        v.group.scale.setScalar(1);
        born++;
        continue;
      }
      v.group.scale.setScalar(0.001);
      const depth = positions.get(id)!.depth;
      gsap.to(v.group.scale, {
        x: 1, y: 1, z: 1,
        duration: this.opts.reducedMotion ? 0 : 0.7,
        ease: "back.out(2.2)",
        delay: this.opts.reducedMotion ? 0 : (animate ? 0.25 + depth * 0.45 + (born % 5) * 0.08 : 0.05),
        onStart: () => {
          born++;
          this.cb.onSpawn(born, total);
        },
      });
    }
    if (this.opts.reducedMotion) this.cb.onSpawn(total, total);
  }

  /* ── hover: route highlight + pause rotation ── */
  private routeSet(id: string): Set<string> {
    const set = new Set([id]);
    if (!this.map) return set;
    // all ancestor paths (walk every incoming edge — DAG-safe)
    const up = [id];
    while (up.length) {
      const cur = up.pop()!;
      for (const e of this.map.edges)
        if (e.target === cur && !set.has(e.source)) { set.add(e.source); up.push(e.source); }
    }
    // full descendant subtree
    const down = [id];
    while (down.length) {
      const cur = down.pop()!;
      for (const e of this.map.edges)
        if (e.source === cur && !set.has(e.target)) { set.add(e.target); down.push(e.target); }
    }
    return set;
  }

  private onPointerMove = (ev: PointerEvent) => {
    if (this.mode !== "map") return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const cores = [...this.visuals.values()].map((v) => v.core);
    const hit = this.raycaster.intersectObjects(cores, false)[0];
    const id = hit ? (hit.object.userData.nodeId as string) : null;
    if (id === this.hoveredId) return;
    this.hoveredId = id;
    this.container.style.cursor = id ? "pointer" : "grab";
    this.controls.autoRotate = !this.opts.reducedMotion && !id; // pause on hover
    this.cb.onHover(id ? this.visuals.get(id)!.node : null);
    this.applyHighlight();
  };

  private applyHighlight() {
    const route = this.hoveredId ? this.routeSet(this.hoveredId) : null;
    const dur = this.opts.reducedMotion ? 0 : 0.25;
    for (const [id, v] of this.visuals) {
      const on = !route || route.has(id);
      const op = on ? 1 : 0.08;
      for (const child of v.group.children) {
        const mat = (child as THREE.Mesh | THREE.Sprite).material as THREE.Material & { opacity: number };
        gsap.to(mat, { opacity: op * (child === v.halo ? 0.55 : child === v.label ? 1 : mat.opacity > 0.54 ? 0.55 : 1), duration: dur, overwrite: "auto" });
      }
      // simpler override: core/label full, halo 0.55, accent ring 0.55 — scaled by `op`
    }
    for (const { line, source, target } of this.edgeLines) {
      const on = !route || (route.has(source) && route.has(target));
      gsap.to(line.material as THREE.Material & { opacity: number }, {
        opacity: on ? (route ? 0.7 : 0.3) : 0.04, duration: dur, overwrite: "auto",
      });
    }
  }

  /* ── dive / return ── */
  private onClick = () => {
    if (this.mode !== "map" || !this.hoveredId) return;
    this.diveInto(this.hoveredId);
  };

  diveInto(nodeId: string) {
    const v = this.visuals.get(nodeId);
    if (!v || this.mode !== "map") return;
    this.mode = "diving";
    this.controls.autoRotate = false;
    this.controls.enabled = false;
    this.savedCam = {
      pos: this.camera.position.clone(),
      target: this.controls.target.clone(),
    };
    const nodePos = v.group.position.clone();
    const dir = nodePos.clone().sub(this.camera.position).normalize();
    const dest = nodePos.clone().sub(dir.multiplyScalar(46)); // just short of the surface
    const dur = this.opts.reducedMotion ? 0 : 1.15;

    // fade everything but the target; swell its halo into the ambient backdrop
    this.hoveredId = null;
    for (const [id, ov] of this.visuals) {
      if (id === nodeId) continue;
      for (const child of ov.group.children)
        gsap.to((child as THREE.Mesh).material as THREE.Material & { opacity: number },
          { opacity: 0, duration: dur * 0.7, overwrite: "auto" });
    }
    for (const { line } of this.edgeLines)
      gsap.to(line.material as THREE.Material & { opacity: number },
        { opacity: 0, duration: dur * 0.6, overwrite: "auto" });
    gsap.to((v.core.material as THREE.Material & { opacity: number }),
      { opacity: 0.25, duration: dur, overwrite: "auto" });
    gsap.to((v.label.material as THREE.Material & { opacity: number }),
      { opacity: 0, duration: dur * 0.5, overwrite: "auto" });
    gsap.to(v.halo.scale, { x: v.baseHaloScale * 6, y: v.baseHaloScale * 6, z: 1, duration: dur, ease: "power2.inOut" });

    gsap.to(this.camera.position, {
      x: dest.x, y: dest.y, z: dest.z, duration: dur, ease: "power3.inOut",
    });
    gsap.to(this.controls.target, {
      x: nodePos.x, y: nodePos.y, z: nodePos.z, duration: dur, ease: "power3.inOut",
      onComplete: () => {
        this.mode = "detail";
        this.cb.onDiveComplete(v.node);
      },
    });
  }

  zoomOut() {
    if (this.mode !== "detail" || !this.savedCam) return;
    this.mode = "returning";
    const dur = this.opts.reducedMotion ? 0 : 0.9;
    for (const v of this.visuals.values()) {
      gsap.to(v.core.material as THREE.Material & { opacity: number }, { opacity: 1, duration: dur, overwrite: "auto" });
      gsap.to(v.label.material as THREE.Material & { opacity: number }, { opacity: 1, duration: dur, overwrite: "auto" });
      gsap.to(v.halo.material as THREE.Material & { opacity: number }, { opacity: 0.55, duration: dur, overwrite: "auto" });
      gsap.to(v.halo.scale, { x: v.baseHaloScale, y: v.baseHaloScale, z: 1, duration: dur, overwrite: "auto" });
      for (const child of v.group.children) {
        if (child !== v.core && child !== v.halo && child !== v.label)
          gsap.to((child as THREE.Mesh).material as THREE.Material & { opacity: number }, { opacity: 0.55, duration: dur, overwrite: "auto" });
      }
    }
    for (const { line, source, target } of this.edgeLines) {
      const isWild = this.map?.edges.find((e) => e.source === source && e.target === target)?.kind === "wildcard";
      gsap.to(line.material as THREE.Material & { opacity: number }, { opacity: isWild ? 0.34 : 0.3, duration: dur, overwrite: "auto" });
    }
    gsap.to(this.camera.position, {
      x: this.savedCam.pos.x, y: this.savedCam.pos.y, z: this.savedCam.pos.z,
      duration: dur, ease: "power3.inOut",
    });
    gsap.to(this.controls.target, {
      x: this.savedCam.target.x, y: this.savedCam.target.y, z: this.savedCam.target.z,
      duration: dur, ease: "power3.inOut",
      onComplete: () => {
        this.mode = "map";
        this.controls.enabled = true;
        this.controls.autoRotate = !this.opts.reducedMotion;
      },
    });
  }

  /* ── loop / teardown ── */
  private onResize = () => {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  };

  private tick = () => {
    if (this.disposed) return;
    this.controls.update();
    this.composer.render();
    this.raf = requestAnimationFrame(this.tick);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.renderer.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.removeEventListener("click", this.onClick);
    window.removeEventListener("resize", this.onResize);
    this.renderer.dispose();
    this.container.replaceChildren();
  }
}
```

Implementation note for the executor: the `applyHighlight` opacity juggling has a simpler correct form — store each material's base opacity in `userData.baseOpacity` when created, then tween to `baseOpacity * (on ? 1 : 0.08)`. Prefer that refactor while implementing; the behavior contract is: hovered route at full/boosted opacity, everything else at ~8%, edges on the route boosted to 0.7.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (If `three/addons/...` imports fail to resolve, use `three/examples/jsm/...` paths instead — check which one `node_modules/three/package.json` `exports` maps.)

- [ ] **Step 3: Commit**

```bash
git add lib/career-map/scene.ts
git commit -m "feat(career-map): three.js constellation scene with dive and route highlight"
```

---

### Task 11: Frontend — NodeDetail overlay

**Files:**
- Create: `AURA-TALENT-FRONTEND/components/career-map/NodeDetail.tsx`

**Interfaces:**
- Consumes: `CareerMapNode` type (Task 7); brand CSS vars from `app/globals.css` (`--iris`, `--ink`, score colors, `.mono`/`.page-kicker` utility classes as used by `components/CareerPathNavigator.tsx`).
- Produces: `<NodeDetail node={CareerMapNode | null} open={boolean} onClose={() => void} onExpand={(id: string) => void} expanding={boolean} expandError={string | null} />` — used by Task 12. Content fades/scales in over the scene's glow backdrop (the scene itself provides the "inside the node" ambience; this component is transparent apart from a readability vignette).

- [ ] **Step 1: Implement NodeDetail.tsx**

```tsx
// components/career-map/NodeDetail.tsx
"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { CareerMapNode } from "@/lib/api";

const KIND_COLOR: Record<CareerMapNode["kind"], string> = {
  current: "#fafaf8",
  progression: "#8f7dff",
  pivot: "#ffb98f",
  wildcard: "#7fd6b2",
};
const KIND_LABEL: Record<CareerMapNode["kind"], string> = {
  current: "You today",
  progression: "Progression",
  pivot: "Pivot",
  wildcard: "Skill-adjacent wildcard",
};

export default function NodeDetail({
  node, open, onClose, onExpand, expanding, expandError,
}: {
  node: CareerMapNode | null;
  open: boolean;
  onClose: () => void;
  onExpand: (id: string) => void;
  expanding: boolean;
  expandError: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (open) {
      gsap.fromTo(
        ref.current,
        { opacity: 0, scale: 0.96 },
        { opacity: 1, scale: 1, duration: reduced ? 0 : 0.45, ease: "power2.out" }
      );
    }
  }, [open, node?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !node) return null;
  const col = KIND_COLOR[node.kind];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={node.title}
      style={{
        position: "fixed", inset: 0, zIndex: 20,
        background:
          "radial-gradient(ellipse at 50% 42%, rgba(11,14,28,0) 0%, rgba(11,14,28,0.5) 58%, rgba(11,14,28,0.85) 100%)",
        overflowY: "auto",
      }}
    >
      <div
        ref={ref}
        style={{
          maxWidth: 980, margin: "0 auto", minHeight: "100%", boxSizing: "border-box",
          padding: "clamp(20px, 4.5vh, 44px) clamp(20px, 4vw, 44px)",
          display: "flex", flexDirection: "column", gap: "clamp(12px, 2.6vh, 26px)",
          color: "#fafaf8",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(250,250,248,0.5)", paddingTop: 10 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", marginRight: 8, background: col, boxShadow: `0 0 10px ${col}` }} />
            {KIND_LABEL[node.kind]}
            {node.kind !== "current" && " · from your current position"}
          </div>
          <button
            onClick={onClose}
            aria-label="Zoom back out to the map"
            style={{
              border: "1px solid rgba(250,250,248,0.16)", background: "rgba(11,14,28,0.4)",
              color: "#fafaf8", width: 42, height: 42, borderRadius: "50%",
              fontSize: 17, cursor: "pointer", flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <div>
          <h1 style={{
            fontFamily: "var(--font-display, inherit)", fontWeight: 700,
            letterSpacing: "-0.02em", fontSize: "clamp(1.9rem, 5vw, 3.3rem)",
            margin: "0 0 12px", lineHeight: 1.03, textWrap: "balance",
          }}>
            {node.title}
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <span className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 99, padding: "5px 13px", background: "rgba(250,250,248,0.05)", border: "1px solid rgba(250,250,248,0.16)" }}>
              {node.kind === "current" ? "You are here" : `${node.duration} away`}
            </span>
            {node.salary_hint && (
              <span className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", borderRadius: 99, padding: "5px 13px", background: "rgba(127,214,178,0.1)", color: "#7fd6b2", border: "1px solid rgba(127,214,178,0.35)" }}>
                {node.salary_hint}
              </span>
            )}
            <span style={{ display: "flex", alignItems: "center", gap: 9 }} role="img" aria-label={`Fit ${node.fit.toFixed(1)} out of 5`}>
              <span style={{ display: "flex", gap: 3 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <i key={i} style={{
                    width: 17, height: 6, borderRadius: 3,
                    background: i <= Math.round(node.fit) ? col : "rgba(250,250,248,0.15)",
                    boxShadow: i <= Math.round(node.fit) ? `0 0 8px ${col}` : "none",
                  }} />
                ))}
              </span>
              <span className="mono" style={{ fontSize: 11.5, color: "rgba(250,250,248,0.5)" }}>
                {node.fit.toFixed(1)} / 5 fit
              </span>
            </span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "clamp(16px, 3vw, 36px)", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <section>
              <h2 className="mono" style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(250,250,248,0.5)", fontWeight: 400, margin: "0 0 12px", borderBottom: "1px solid rgba(250,250,248,0.14)", paddingBottom: 9 }}>
                Why this fits you
              </h2>
              <p style={{ fontSize: 15, lineHeight: 1.65, margin: 0, maxWidth: "48ch" }}>{node.why}</p>
            </section>
            {node.skill_gaps.length > 0 && (
              <section>
                <h2 className="mono" style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(250,250,248,0.5)", fontWeight: 400, margin: "0 0 12px", borderBottom: "1px solid rgba(250,250,248,0.14)", paddingBottom: 9 }}>
                  Skill gaps to close
                </h2>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {node.skill_gaps.map((g) => (
                    <span key={g} style={{ background: "rgba(250,250,248,0.05)", border: "1px solid rgba(250,250,248,0.16)", borderLeft: `2px solid ${col}`, borderRadius: 8, fontSize: 13, padding: "6px 12px" }}>
                      {g}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
          {node.moves.length > 0 && (
            <section>
              <h2 className="mono" style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(250,250,248,0.5)", fontWeight: 400, margin: "0 0 12px", borderBottom: "1px solid rgba(250,250,248,0.14)", paddingBottom: 9 }}>
                Moves that get you there
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {node.moves.map((m) => (
                  <div key={m.action} style={{ background: "rgba(11,14,28,0.45)", border: "1px solid rgba(250,250,248,0.14)", borderRadius: 12, padding: "11px 14px", display: "flex", flexDirection: "column", gap: 3 }}>
                    <span className="mono" style={{ fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: col }}>{m.category}</span>
                    <b style={{ fontSize: 14, fontWeight: 600 }}>{m.action}</b>
                    <small style={{ fontSize: 12.5, color: "rgba(250,250,248,0.5)", lineHeight: 1.45 }}>{m.why}</small>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", paddingBottom: 8 }}>
          {node.expandable && (
            <button
              onClick={() => onExpand(node.id)}
              disabled={expanding}
              style={{
                fontSize: 14.5, fontWeight: 600, borderRadius: 12, padding: "12px 22px",
                cursor: expanding ? "wait" : "pointer", background: "#fafaf8", color: "#1a1d29",
                border: "1px solid transparent", opacity: expanding ? 0.6 : 1,
              }}
            >
              {expanding ? "Discovering branches…" : "Explore further from here →"}
            </button>
          )}
          <button
            onClick={onClose}
            style={{ fontSize: 14.5, fontWeight: 600, borderRadius: 12, padding: "12px 22px", cursor: "pointer", background: "transparent", color: "#fafaf8", border: "1px solid rgba(250,250,248,0.16)" }}
          >
            Zoom back out
          </button>
          {expandError && (
            <span className="mono" style={{ fontSize: 11.5, color: "#ffb98f" }}>{expandError}</span>
          )}
        </div>
      </div>
    </div>
  );
}
```

Note: check `app/globals.css` for the actual display-font variable name (the layout registers Bricolage Grotesque — find its `--font-…` var and use it in the `h1`).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/career-map/NodeDetail.tsx
git commit -m "feat(career-map): inside-the-node detail overlay"
```

---

### Task 12: Frontend — /career-map page + RouteGuard

**Files:**
- Create: `AURA-TALENT-FRONTEND/app/career-map/page.tsx`
- Modify: `AURA-TALENT-FRONTEND/components/RouteGuard.tsx` (add `/career-map` to `isCandidateRoute`)

**Interfaces:**
- Consumes: `CareerMapScene`/`SceneCallbacks` (Task 10), `NodeDetail` (Task 11), `useCareerMap` (Task 9), `api.getResume`/`ApiError` (existing).
- Produces: the `/career-map` route.

- [ ] **Step 1: Add the route to RouteGuard**

In `components/RouteGuard.tsx`, extend `isCandidateRoute`:

```ts
  const isCandidateRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/evaluate") ||
    pathname.startsWith("/scan") ||
    pathname.startsWith("/compare") ||
    pathname.startsWith("/report") ||
    pathname.startsWith("/career-map") ||
    pathname.startsWith("/onboarding");
```

- [ ] **Step 2: Implement the page**

```tsx
// app/career-map/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, type CareerMapNode } from "@/lib/api";
import { CareerMapScene } from "@/lib/career-map/scene";
import NodeDetail from "@/components/career-map/NodeDetail";
import { useCareerMap } from "@/hooks/useCareerMap";

const LEGEND: { color: string; label: string }[] = [
  { color: "#8f7dff", label: "progression" },
  { color: "#ffb98f", label: "pivot" },
  { color: "#7fd6b2", label: "skill-adjacent" },
];

export default function CareerMapPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CareerMapScene | null>(null);
  const { map, progress, loading, error, expanding, expandError, expand, regenerate } = useCareerMap();

  const [selected, setSelected] = useState<CareerMapNode | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [spawn, setSpawn] = useState<{ born: number; total: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const firstBuild = useRef(true);

  // resume gate — mirrors backend 404 behavior
  useEffect(() => {
    api.getResume().catch((e) => {
      if (e instanceof ApiError && e.status === 404) router.push("/onboarding");
    });
  }, [router]);

  // scene lifecycle
  useEffect(() => {
    if (!containerRef.current || sceneRef.current) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sceneRef.current = new CareerMapScene(
      containerRef.current,
      {
        onHover: () => {},
        onDiveComplete: (node) => {
          setSelected(node);
          setDetailOpen(true);
        },
        onSpawn: (born, total) => setSpawn({ born, total }),
      },
      { reducedMotion }
    );
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  // feed maps into the scene
  useEffect(() => {
    if (!map || !sceneRef.current) return;
    sceneRef.current.setMap(map, { animate: firstBuild.current });
    firstBuild.current = false;
  }, [map]);

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
    sceneRef.current?.zoomOut();
  }, []);

  const handleExpand = useCallback(async (nodeId: string) => {
    const before = map?.nodes.length ?? 0;
    const updated = await expand(nodeId);
    if (updated) {
      const added = updated.nodes.length - before;
      setDetailOpen(false);
      sceneRef.current?.zoomOut();
      setToast(`✦ ${added} new branch${added === 1 ? "" : "es"} discovered`);
      setTimeout(() => setToast(null), 3200);
    }
  }, [expand, map]);

  const mapping = loading || (spawn !== null && spawn.born < spawn.total);
  const statusLine = loading
    ? progress[progress.length - 1]?.message ?? "Mapping your career space…"
    : spawn && spawn.born < spawn.total
      ? `Mapping your career space… ${spawn.born}/${spawn.total} roles`
      : map
        ? `${map.nodes.length} routes mapped from your resume`
        : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0b0e1c", color: "rgba(250,250,248,0.78)" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {/* HUD */}
      <div style={{ position: "absolute", top: 22, left: 26, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none" }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.22em", color: "rgba(250,250,248,0.45)" }}>
          <Link href="/dashboard" style={{ color: "#fafaf8", pointerEvents: "auto", textDecoration: "none" }}>AURA</Link> · CAREER MAP
        </div>
        {statusLine && (
          <div className="mono" aria-live="polite" style={{ fontSize: 11, letterSpacing: "0.08em", color: "#c7b9ff", opacity: mapping ? 1 : 0.6 }}>
            {statusLine}
          </div>
        )}
      </div>

      <div style={{ position: "absolute", top: 22, right: 26, display: "flex", flexDirection: "column", gap: 7, alignItems: "flex-end" }}>
        {LEGEND.map((l) => (
          <div key={l.label} className="mono" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, letterSpacing: "0.1em", color: "rgba(250,250,248,0.45)", textTransform: "uppercase" }}>
            <i style={{ width: 9, height: 9, borderRadius: "50%", background: l.color }} />
            {l.label}
          </div>
        ))}
        <button
          onClick={regenerate}
          disabled={loading}
          className="mono"
          style={{ marginTop: 10, fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", background: "transparent", color: "rgba(250,250,248,0.45)", border: "1px solid rgba(250,250,248,0.16)", borderRadius: 99, padding: "6px 14px", cursor: loading ? "wait" : "pointer" }}
        >
          Regenerate
        </button>
      </div>

      <div className="mono" style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", fontSize: 10.5, letterSpacing: "0.14em", color: "rgba(250,250,248,0.45)", textTransform: "uppercase", whiteSpace: "nowrap", pointerEvents: "none" }}>
        drag to orbit · scroll to zoom · click a node
      </div>

      {toast && (
        <div className="mono" style={{ position: "absolute", bottom: 54, left: "50%", transform: "translateX(-50%)", background: "rgba(20,24,48,0.92)", border: "1px solid rgba(199,185,255,0.35)", color: "#c7b9ff", fontSize: 11.5, padding: "8px 16px", borderRadius: 99 }}>
          {toast}
        </div>
      )}

      {error && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(11,14,28,0.85)" }}>
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
            <p style={{ margin: 0, maxWidth: "42ch" }}>{error}</p>
            <button
              onClick={regenerate}
              style={{ fontSize: 14.5, fontWeight: 600, borderRadius: 12, padding: "12px 22px", cursor: "pointer", background: "#fafaf8", color: "#1a1d29", border: "none" }}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      <NodeDetail
        node={selected}
        open={detailOpen}
        onClose={closeDetail}
        onExpand={handleExpand}
        expanding={expanding !== null}
        expandError={expandError}
      />
    </div>
  );
}
```

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both clean. (`three` and the scene are client-only; the `"use client"` directive keeps them out of server bundles.)

- [ ] **Step 4: Commit**

```bash
git add app/career-map/page.tsx components/RouteGuard.tsx
git commit -m "feat(career-map): /career-map page with HUD, stream states, and detail flow"
```

---

### Task 13: Frontend — dashboard teaser card

**Files:**
- Modify: `AURA-TALENT-FRONTEND/app/dashboard/page.tsx` (~line 501, where `<CareerPathNavigator />` renders)

**Interfaces:**
- Consumes: existing dashboard auth/resume state (`authLoading`, `user`, `hasResume`), `next/link`.

- [ ] **Step 1: Add the teaser above CareerPathNavigator**

Find `{!authLoading && user && hasResume === true && <CareerPathNavigator />}` and change to:

```tsx
{!authLoading && user && hasResume === true && (
  <>
    <Link
      href="/career-map"
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: "1rem", padding: "1rem 1.2rem", marginBottom: "1rem",
        borderRadius: "var(--r-m, 12px)", textDecoration: "none",
        background: "linear-gradient(120deg, #10132a, #1c1440)",
        border: "1px solid rgba(143,125,255,0.35)", color: "#fafaf8",
      }}
    >
      <span style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
        <span style={{ fontWeight: 700 }}>Career Map</span>
        <span style={{ fontSize: "0.8rem", color: "rgba(250,250,248,0.6)" }}>
          Explore your next roles, pivots, and wildcards in 3D
        </span>
      </span>
      <span className="mono" style={{ fontSize: "0.75rem", color: "#c7b9ff", whiteSpace: "nowrap" }}>
        Open map →
      </span>
    </Link>
    <CareerPathNavigator />
  </>
)}
```

If `Link` isn't imported in the file, add `import Link from "next/link";`. Match surrounding card idioms in the file (radius/spacing tokens) if they differ — the visual intent is a slim dark banner with an iris-tinted border that stands out on the porcelain dashboard.

- [ ] **Step 2: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat(career-map): dashboard teaser card"
```

---

### Task 14: End-to-end verification (manual demo-path checklist)

**Files:** none (verification only). Backend + frontend running locally.

- [ ] **Step 1: Start both servers**

```bash
cd /Users/tian/Desktop/personal-repo/aura-talent/AURA-TALENT-BACKEND && uv run uvicorn app.main:app --reload --port 8000
# separate terminal:
cd /Users/tian/Desktop/personal-repo/aura-talent/AURA-TALENT-FRONTEND && npm run dev
```

- [ ] **Step 2: Run the backend test suite once more**

Run: `uv run pytest tests/ -v --ignore=tests/scratch_test.py`
Expected: all career-map tests PASS.

- [ ] **Step 3: Walk the demo path** (use a logged-in account with an uploaded resume; spec §5)

1. Dashboard shows the Career Map teaser → click → `/career-map` loads.
2. First visit: progress lines ("Gathering… / Mapping… / Validating…"), then nodes spawn ring-by-ring with the "n/N roles" counter.
3. Idle: slow auto-rotation. Drag orbits; wheel zooms.
4. Hover a mid-path node: rotation pauses; the full route back to "You" plus everything beyond lights up; the rest dims; edges on the route brighten. Un-hover: rotation resumes.
5. Click a node: camera pushes into it, constellation fades, halo becomes the backdrop, details fade up. Duration/fit/salary/why/gaps/moves all render.
6. Escape / ✕ / "Zoom back out": camera returns to the exact prior orbit; graph fades back.
7. On an `expandable` node: "Explore further" → "Discovering branches…" → auto zoom-out → new nodes pop in → toast.
8. Reload the page: map loads instantly from cache (no counter).
9. "Regenerate": full re-stream + spawn animation.
10. Reduced motion (macOS: System Settings → Accessibility → Display → Reduce motion): no auto-rotate, instant transitions, everything still reachable.
11. Narrow the window to ~390px: HUD legible, detail view single-column scrolls.

- [ ] **Step 4: Fix anything that fails, re-run the relevant checklist line, commit fixes**

```bash
git add -A && git commit -m "fix(career-map): demo-path polish fixes"
```
