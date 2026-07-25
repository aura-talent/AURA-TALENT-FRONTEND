# Work-Animal Frontend ("Aura Menagerie") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The 3D swipe-deck → reveal-ceremony → results experience for the work-animal module, per the approved spec at `docs/superpowers/specs/2026-07-24-work-animal-module-design.md` (sections 3–4). Hackathon priority: the 3D treatment and ceremony are load-bearing, not polish.

**Architecture:** One continuous porcelain "space" — a framework-free three.js scene class (`lib/animal/scene.ts`, same pattern as `lib/career-map/scene.ts`: React never touches three objects) renders the backdrop for all phases. The swipe deck is CSS-3D DOM cards + GSAP over that backdrop; when the last card flies away the same scene condenses into the figurine reveal (no page transition). A client page at `/animal` runs the phase state machine and talks to the backend through the existing `/api/backend` proxy.

**Tech Stack:** Next.js 16 App Router, React 19, three ^0.184 + three/addons (already used by career-map), GSAP ^3.15 (already present), CSS modules (repo convention), `node:test` for pure logic (same harness as `lib/sse.test.mjs`). **No new npm dependencies.**

**Working directory:** `AURA-TALENT-FRONTEND` (this repo). All paths relative to it.

## Global Constraints

- **Backend contract (Plan 1, already implemented):** via proxy paths `animal/deck` (POST `{user_id, count}` → `{cards}`), `animal/swipes` (POST `{user_id, swipes:[{card, direction, decision_ms, direction_changes}]}` → state + `is_new_animal`), `animal/{user_id}` (GET, 404 if never swiped), `animal/{user_id}/shortlist` (GET → `{cards}`). Card = `{id, company, title, url, location, source, traits}`; traits keys exactly `social, motion, visibility, environment, autonomy, north_star`, each in [-1, 1].
- **Right-swipe = save to shortlist, never apply.** The only apply path is the existing `/evaluate?url=...` flow.
- **Animals are lateral** — no copy or UI may rank animals. Alignment copy is self-referential + always shows the "play".
- **12 animal ids:** `owl, beaver, fox, octopus, wolf, hawk, shark, lion, dolphin, deer, tortoise, chameleon`. 4 temperaments: `decisive, analytical, exploratory, selective`.
- **Design tokens only** — colors from `app/globals.css` custom properties (`--porcelain #fafaf8`, `--ink #1a1d29`, `--iris #4e3fd8`, aura `--aura-a #c7b9ff` / `--aura-b #ffd9c2` / `--aura-c #bfead8`, radii `--r-*`, shadows `--shadow-*`). No hardcoded off-palette colors except inside the three.js scene where CSS vars don't reach (use the same hex values, commented).
- **`prefers-reduced-motion`:** every animation collapses — deck becomes button-driven (no fly-off tweens), ceremony is skipped entirely (straight to results), scene renders a static frame. Content is never hidden behind JS.
- **Ceremony plays only when `is_new_animal` is true**, is skippable, ~4–6 s.
- **The user never sees "you got worse"** — alignment meter renders as "aligned with your stated goals" + play.
- **No git actions** — the user handles all commits (standing rule).
- Verification gates per task: `npx tsc --noEmit` clean and `npm run lint` clean. Pure-logic tasks additionally use `node --test` (add `--experimental-strip-types` if the Node version needs it — check how `lib/sse.test.mjs` runs first).

## File Structure

```
lib/api.ts                          (append: animal types + 4 api functions)
lib/animal/manner.ts                (pure swipe-manner tracker — unit tested)
lib/animal/manner.test.mjs          (node:test)
lib/animal/animals.ts               (12-animal registry, axis + temperament metadata)
lib/animal/scene.ts                 (PorcelainScene — three.js, framework-free)
components/animal/SwipeDeck.tsx     (CSS-3D deck + GSAP drag)
components/animal/Ceremony.tsx      (full-bleed reveal orchestration)
components/animal/ResultsPanel.tsx  (trait bars, alignment, shortlist)
components/animal/animal.module.css (all module styles)
app/animal/page.tsx                 (phase state machine)
components/Nav.tsx                  (modify: add WORK_ANIMAL link)
public/animals/README.md            (optional GLB asset drop-point)
```

---

### Task 1: API types + client functions

**Files:**
- Modify: `lib/api.ts` (append types after the existing type block, functions inside the existing `export const api = {...}` object)

**Interfaces:**
- Produces: `AnimalTraits`, `AnimalCard`, `AnimalCopy`, `AnimalState`, `AnimalSwipePayload` types; `api.animalDeck()`, `api.animalSwipes(swipes)`, `api.animalState()`, `api.animalShortlist()`. All use the existing private `request`/`postJson` helpers and `getUserId()` — exactly like the neighboring functions.

- [ ] **Step 1: Append types to `lib/api.ts`** (near the other mirrored FastAPI types)

```typescript
/* ── Work-animal module ── */

export interface AnimalTraits {
  social: number;
  motion: number;
  visibility: number;
  environment: number;
  autonomy: number;
  north_star: number;
}

export interface AnimalCard {
  id: string;
  company: string;
  title: string;
  url: string;
  location: string;
  source: string;
  traits: AnimalTraits;
}

export interface AnimalCopy {
  headline: string;
  why: string;
  play: string;
}

export interface AnimalState {
  animal: string;
  confidence: number;
  temperament: string;
  alignment: number | null;
  vector: AnimalTraits;
  swipe_count: number;
  history: { animal: string; at: string }[];
  copy: AnimalCopy | null;
  is_new_animal: boolean;
}

export interface AnimalSwipePayload {
  card: AnimalCard;
  direction: "left" | "right";
  decision_ms: number;
  direction_changes: number;
}
```

- [ ] **Step 2: Append functions inside the `api` object** (alongside `getResume` etc.)

```typescript
  animalDeck: (count = 15) =>
    postJson<{ cards: AnimalCard[] }>("animal/deck", {
      user_id: getUserId(),
      count,
    }),

  animalSwipes: (swipes: AnimalSwipePayload[]) =>
    postJson<AnimalState>("animal/swipes", {
      user_id: getUserId(),
      swipes,
    }),

  animalState: () => request<AnimalState>(`animal/${getUserId()}`),

  animalShortlist: () =>
    request<{ cards: AnimalCard[] }>(`animal/${getUserId()}/shortlist`),
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — expect clean. Run: `npm run lint` — expect clean.

---

### Task 2: Swipe-manner tracker (pure, tested)

**Files:**
- Create: `lib/animal/manner.ts`
- Test: `lib/animal/manner.test.mjs`

**Interfaces:**
- Produces: `createMannerTracker()` returning `{ cardShown(now?), drag(dx), commit(now?) }` where `commit` returns `{ decision_ms, direction_changes }`. Timestamps injectable for tests; defaults to `performance.now()`. A "direction change" = the horizontal drag sign flipping after having been nonzero.

- [ ] **Step 1: Write the failing test**

```javascript
// lib/animal/manner.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { createMannerTracker } from "./manner.ts";

test("measures decision time from cardShown to commit", () => {
  const t = createMannerTracker();
  t.cardShown(1000);
  const m = t.commit(3400);
  assert.equal(m.decision_ms, 2400);
  assert.equal(m.direction_changes, 0);
});

test("counts sign flips as direction changes", () => {
  const t = createMannerTracker();
  t.cardShown(0);
  t.drag(20);   // right
  t.drag(60);   // still right — no change
  t.drag(-30);  // flip 1
  t.drag(-80);
  t.drag(40);   // flip 2
  const m = t.commit(1500);
  assert.equal(m.direction_changes, 2);
});

test("zero drag never counts as a change", () => {
  const t = createMannerTracker();
  t.cardShown(0);
  t.drag(0);
  t.drag(-10);
  const m = t.commit(100);
  assert.equal(m.direction_changes, 0);
});

test("cardShown resets the tracker for the next card", () => {
  const t = createMannerTracker();
  t.cardShown(0);
  t.drag(10);
  t.drag(-10);
  t.commit(500);
  t.cardShown(2000);
  const m = t.commit(2100);
  assert.equal(m.decision_ms, 100);
  assert.equal(m.direction_changes, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

First check how the existing harness runs: `node --test lib/sse.test.mjs` (add `--experimental-strip-types` if it complains about the `.ts` import — use whichever form makes the sse test pass, then use the same for manner).
Run: `node --test lib/animal/manner.test.mjs`
Expected: FAIL — cannot find module `./manner.ts`.

- [ ] **Step 3: Implement**

```typescript
// lib/animal/manner.ts
/**
 * Swipe *manner* tracker — the temperament signal. Pure logic, no DOM:
 * decision time per card and horizontal-drag sign flips (hesitation).
 * Timestamps are injectable so tests never depend on wall clock.
 */

export interface MannerReading {
  decision_ms: number;
  direction_changes: number;
}

export function createMannerTracker() {
  let shownAt = 0;
  let changes = 0;
  let lastSign = 0;

  return {
    cardShown(now: number = performance.now()) {
      shownAt = now;
      changes = 0;
      lastSign = 0;
    },
    drag(dx: number) {
      const sign = Math.sign(dx);
      if (sign === 0) return;
      if (lastSign !== 0 && sign !== lastSign) changes += 1;
      lastSign = sign;
    },
    commit(now: number = performance.now()): MannerReading {
      return {
        decision_ms: Math.max(0, Math.round(now - shownAt)),
        direction_changes: changes,
      };
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test lib/animal/manner.test.mjs` (same flags as Step 2). Expected: 4 pass.
Run: `npx tsc --noEmit` — clean.

---

### Task 3: Animal registry + axis metadata

**Files:**
- Create: `lib/animal/animals.ts`

**Interfaces:**
- Produces: `ANIMALS: Record<AnimalId, AnimalMeta>` (12 entries: `name`, `emoji`, `tagline`, `niche`, `accent` hex); `AXES_META` (6 entries with `key`, `left`, `right` pole labels); `TEMPERAMENTS: Record<string, {label, blurb}>`; `topTraitChips(traits, n)` helper returning the n strongest pole labels for a card.

- [ ] **Step 1: Implement** (static data — no test file; exercised via Task 2's harness in Step 2)

```typescript
// lib/animal/animals.ts
import type { AnimalTraits } from "@/lib/api";

export type AnimalId =
  | "owl" | "beaver" | "fox" | "octopus" | "wolf" | "hawk"
  | "shark" | "lion" | "dolphin" | "deer" | "tortoise" | "chameleon";

export interface AnimalMeta {
  name: string;
  emoji: string;
  tagline: string;   // <= 8 words, lateral — never comparative
  niche: string;     // one sentence, the habitat it thrives in
  accent: string;    // aura-family hex for the scene glow
}

/** All 12 are niches, not ranks — copy must never imply one beats another. */
export const ANIMALS: Record<AnimalId, AnimalMeta> = {
  owl:       { name: "Owl",       emoji: "🦉", tagline: "Deep work, quiet hours.",
    niche: "Thrives on hard problems, long focus, and rooms nobody is watching.",
    accent: "#8f7dff" },
  beaver:    { name: "Beaver",    emoji: "🦫", tagline: "Builds, methodically, every day.",
    niche: "Thrives on structure, craft, and shipping something solid each week.",
    accent: "#c7b9ff" },
  fox:       { name: "Fox",       emoji: "🦊", tagline: "Sharp in ambiguity.",
    niche: "Thrives where the map is unfinished — early stages, odd problems, improvised plays.",
    accent: "#ffb98f" },
  octopus:   { name: "Octopus",   emoji: "🐙", tagline: "Eight projects, zero supervision.",
    niche: "Thrives with full autonomy across many domains at once.",
    accent: "#8f7dff" },
  wolf:      { name: "Wolf",      emoji: "🐺", tagline: "Hunts big goals, in packs.",
    niche: "Thrives on ambitious targets chased with a tight, driven team.",
    accent: "#7fd6b2" },
  hawk:      { name: "Hawk",      emoji: "🦅", tagline: "Sees far, decides fast.",
    niche: "Thrives with the wide view — leading, deciding, being accountable in the open.",
    accent: "#ffd9c2" },
  shark:     { name: "Shark",     emoji: "🦈", tagline: "Moves toward the upside.",
    niche: "Thrives on stakes, negotiation, and outcomes you can count.",
    accent: "#bfead8" },
  lion:      { name: "Lion",      emoji: "🦁", tagline: "The room notices.",
    niche: "Thrives out front — persuading, presenting, carrying the story.",
    accent: "#ffb98f" },
  dolphin:   { name: "Dolphin",   emoji: "🐬", tagline: "Work is a team sport.",
    niche: "Thrives in collaboration — people-facing, high-trust, high-empathy work.",
    accent: "#bfead8" },
  deer:      { name: "Deer",      emoji: "🦌", tagline: "Led by what matters.",
    niche: "Thrives where the mission is the point, not the perk.",
    accent: "#7fd6b2" },
  tortoise:  { name: "Tortoise",  emoji: "🐢", tagline: "Plays the long game.",
    niche: "Thrives on stability, compounding skill, and roles built to last.",
    accent: "#c7b9ff" },
  chameleon: { name: "Chameleon", emoji: "🦎", tagline: "Adapts to any habitat.",
    niche: "Thrives on variety — genuinely at home across many kinds of work.",
    accent: "#bfead8" },
};

export const AXES_META: { key: keyof AnimalTraits; left: string; right: string }[] = [
  { key: "social",      left: "Heads-down",   right: "People-facing" },
  { key: "motion",      left: "Building",     right: "Persuading" },
  { key: "visibility",  left: "Backstage",    right: "Spotlight" },
  { key: "environment", left: "Structured",   right: "Ambiguous" },
  { key: "autonomy",    left: "Solo",         right: "Team-embedded" },
  { key: "north_star",  left: "Mission",      right: "Comp & prestige" },
];

export const TEMPERAMENTS: Record<string, { label: string; blurb: string }> = {
  decisive:    { label: "Decisive",    blurb: "You know within seconds." },
  analytical:  { label: "Analytical",  blurb: "You weigh every card." },
  exploratory: { label: "Exploratory", blurb: "You keep an open field." },
  selective:   { label: "Selective",   blurb: "Few make your cut." },
};

/** The n strongest pole labels for a card — shown as trait chips. */
export function topTraitChips(traits: AnimalTraits, n = 2): string[] {
  return AXES_META
    .map((a) => ({ a, v: traits[a.key] }))
    .sort((x, y) => Math.abs(y.v) - Math.abs(x.v))
    .slice(0, n)
    .filter(({ v }) => Math.abs(v) >= 0.3)
    .map(({ a, v }) => (v < 0 ? a.left : a.right));
}
```

- [ ] **Step 2: Add a chips test to the manner test file** (same harness, avoids a new runner file)

Append to `lib/animal/manner.test.mjs`:

```javascript
import { topTraitChips } from "./animals.ts";

test("topTraitChips picks strongest poles and drops weak axes", () => {
  const chips = topTraitChips({
    social: -0.9, motion: -0.2, visibility: 0.7,
    environment: 0.1, autonomy: 0.0, north_star: 0.05,
  });
  assert.deepEqual(chips, ["Heads-down", "Spotlight"]);
});
```

- [ ] **Step 3: Verify**

Run: `node --test lib/animal/manner.test.mjs` → 5 pass. `npx tsc --noEmit` clean. `npm run lint` clean.

---

### Task 4: PorcelainScene (three.js)

**Files:**
- Create: `lib/animal/scene.ts`
- Create: `public/animals/README.md`

**Interfaces:**
- Produces: `class PorcelainScene` with: `constructor(container: HTMLElement, opts?: { reducedMotion?: boolean })`; `condense(): Promise<void>` (wisps gather to center, ~1.2 s, resolves immediately under reduced motion); `revealFigurine(animalId: string, alignment: number | null): Promise<void>` (loads `/animals/<id>.glb` if present, else a procedural porcelain totem; applies the shared porcelain material; turntable idle; aura glow intensity from alignment); `settle(): void` (camera eases back so the figurine sits in the upper part of the frame for the results layout); `snapshot(): string` (PNG data-URL); `dispose(): void`. React never touches three objects (career-map convention).

- [ ] **Step 1: Write `public/animals/README.md`** (asset drop-point — optional, fallback always works)

```markdown
# Animal figurine models (optional)

Drop 12 GLB files here, named by animal id:
owl.glb beaver.glb fox.glb octopus.glb wolf.glb hawk.glb
shark.glb lion.glb dolphin.glb deer.glb tortoise.glb chameleon.glb

Recommended source: any CC0 low-poly animal pack (e.g. Quaternius
"Ultimate Animals", quaternius.com) — export each animal as .glb.
Materials are IGNORED at runtime: the scene applies its own porcelain
shader, which is what makes any pack look on-brand.

If a file is missing the scene renders a procedural porcelain totem
instead — the flow never breaks without assets.
```

- [ ] **Step 2: Implement `lib/animal/scene.ts`**

```typescript
// lib/animal/scene.ts
// Framework-free three.js scene for the work-animal module: one continuous
// porcelain space behind the swipe deck that condenses into the reveal.
// React never touches three objects; pages talk to this class only.
// (Same contract style as lib/career-map/scene.ts.)
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import gsap from "gsap";

// Design tokens (CSS vars can't reach WebGL — keep in sync with globals.css)
const PORCELAIN = 0xfafaf8;
const AURA = [0xc7b9ff, 0xffd9c2, 0xbfead8]; // --aura-a / -b / -c
const INK = 0x1a1d29;

const WISP_COUNT = 26;

function wispTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/** Deterministic pseudo-random in [0,1) — no Math.random (matches career-map). */
function hash01(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export class PorcelainScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private wisps: THREE.Sprite[] = [];
  private figurine: THREE.Group | null = null;
  private glow: THREE.PointLight;
  private raf = 0;
  private t = 0;
  private spin = 0.004; // idle turntable speed — temperament sets the character
  private condensed = false;
  private reducedMotion: boolean;
  private container: HTMLElement;
  private onResize = () => this.resize();

  constructor(container: HTMLElement, opts?: { reducedMotion?: boolean }) {
    this.container = container;
    this.reducedMotion = opts?.reducedMotion ?? false;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(0, 1.2, 7);
    this.camera.lookAt(0, 0.6, 0);

    this.scene.fog = new THREE.Fog(PORCELAIN, 8, 16);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(3, 6, 4);
    this.scene.add(key);
    this.glow = new THREE.PointLight(AURA[0], 0, 12);
    this.glow.position.set(0, 1.4, 1.2);
    this.scene.add(this.glow);

    const tex = wispTexture();
    for (let i = 0; i < WISP_COUNT; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex,
        color: AURA[i % 3],
        transparent: true,
        opacity: 0.35 + hash01(i) * 0.25,
        depthWrite: false,
      });
      const s = new THREE.Sprite(mat);
      const r = 2.2 + hash01(i * 7) * 3.2;
      const a = hash01(i * 13) * Math.PI * 2;
      s.position.set(Math.cos(a) * r, -0.5 + hash01(i * 3) * 3.4, -1.5 - hash01(i * 5) * 3);
      const sc = 0.5 + hash01(i * 11) * 1.3;
      s.scale.set(sc, sc, 1);
      s.userData = { r, a, y: s.position.y, speed: 0.05 + hash01(i * 17) * 0.12 };
      this.wisps.push(s);
      this.scene.add(s);
    }

    this.resize();
    window.addEventListener("resize", this.onResize);
    if (this.reducedMotion) this.renderOnce();
    else this.loop();
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.reducedMotion) this.renderOnce();
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    this.t += 0.008;
    if (!this.condensed) {
      for (const s of this.wisps) {
        const { r, a, y, speed } = s.userData;
        s.position.x = Math.cos(a + this.t * speed) * r;
        s.position.y = y + Math.sin(this.t * speed * 2 + a) * 0.35;
      }
    }
    if (this.figurine) this.figurine.rotation.y += this.spin;
    this.renderer.render(this.scene, this.camera);
  };

  private renderOnce() {
    this.renderer.render(this.scene, this.camera);
  }

  /** Phase 1→2: the deck is done; wisps gather toward the pedestal. */
  condense(): Promise<void> {
    this.condensed = true;
    if (this.reducedMotion) return Promise.resolve();
    return new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve });
      this.wisps.forEach((s, i) => {
        tl.to(s.position, { x: 0, y: 0.9, z: 0.2, duration: 1.1, ease: "power2.inOut" }, i * 0.012);
        tl.to(s.material, { opacity: 0.85, duration: 1.1 }, "<");
      });
      tl.to(this.glow, { intensity: 6, duration: 0.9 }, "-=0.6");
    });
  }

  /** The porcelain look that makes ANY model on-brand. */
  private porcelainize(root: THREE.Object3D) {
    const mat = new THREE.MeshStandardMaterial({
      color: PORCELAIN, roughness: 0.35, metalness: 0.05,
      emissive: INK, emissiveIntensity: 0.02,
    });
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = mat;
    });
  }

  /** Procedural fallback when no GLB exists — a faceted porcelain totem. */
  private totem(): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0));
    body.position.y = 0.75;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0));
    head.position.y = 1.45;
    g.add(body, head);
    return g;
  }

  async revealFigurine(
    animalId: string,
    alignment: number | null,
    temperament?: string
  ): Promise<void> {
    // spec §4: temperament = idle animation character
    this.spin = { decisive: 0.009, analytical: 0.002, exploratory: 0.006, selective: 0.004 }[
      temperament ?? ""
    ] ?? 0.004;
    let model: THREE.Group;
    try {
      const gltf = await new GLTFLoader().loadAsync(`/animals/${animalId}.glb`);
      model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const s = 1.7 / Math.max(size.x, size.y, size.z);
      model.scale.setScalar(s);
      const box2 = new THREE.Box3().setFromObject(model);
      model.position.y = 0.35 - box2.min.y;
    } catch {
      model = this.totem();
    }
    this.porcelainize(model);

    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.05, 0.35, 48),
      new THREE.MeshStandardMaterial({ color: PORCELAIN, roughness: 0.6 })
    );
    plinth.position.y = 0.17;

    this.figurine = new THREE.Group();
    this.figurine.add(plinth, model);
    this.figurine.scale.setScalar(0.001);
    this.scene.add(this.figurine);

    // alignment drives the aura: 100 → warm triple glow, low/null → faint
    const strength = alignment == null ? 2.5 : 1.5 + (alignment / 100) * 5;
    if (this.reducedMotion) {
      this.figurine.scale.setScalar(1);
      this.glow.intensity = strength;
      this.wisps.forEach((s) => (s.material.opacity = 0.15));
      this.renderOnce();
      return;
    }
    return new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve });
      tl.to(this.figurine!.scale, { x: 1, y: 1, z: 1, duration: 1.4, ease: "elastic.out(1, 0.55)" });
      this.wisps.forEach((s, i) => {
        const a = hash01(i * 13) * Math.PI * 2;
        tl.to(s.position, { x: Math.cos(a) * 2.4, y: 0.4 + hash01(i * 3) * 2.2, z: -1.5, duration: 1.2, ease: "power2.out" }, 0.15);
        tl.to(s.material, { opacity: 0.2, duration: 1.2 }, "<");
      });
      tl.to(this.glow, { intensity: strength, duration: 1.0 }, "-=0.8");
    });
  }

  /** Ceremony → results: ease the camera so the figurine tops the layout. */
  settle(): void {
    if (this.reducedMotion) {
      this.camera.position.set(0, 1.6, 8.5);
      this.renderOnce();
      return;
    }
    gsap.to(this.camera.position, { x: 0, y: 1.6, z: 8.5, duration: 0.9, ease: "power2.inOut" });
  }

  snapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/png");
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — clean. `npm run lint` — clean. (Visual verification happens in Task 7's walkthrough — the scene has no page yet.)

---

### Task 5: SwipeDeck component

**Files:**
- Create: `components/animal/SwipeDeck.tsx`
- Create: `components/animal/animal.module.css` (shared by Tasks 5–7 — this task creates it with the deck styles; later tasks append)

**Interfaces:**
- Consumes: `AnimalCard`, `AnimalSwipePayload` from `@/lib/api`; `createMannerTracker` from `@/lib/animal/manner`; `topTraitChips` from `@/lib/animal/animals`.
- Produces: `<SwipeDeck cards onComplete reducedMotion />` — collects every swipe locally and calls `onComplete(swipes: AnimalSwipePayload[])` after the last card. Right = SAVE (shortlist), left = PASS. Pointer drag + buttons + ArrowLeft/ArrowRight keys.

- [ ] **Step 1: Implement `components/animal/SwipeDeck.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import type { AnimalCard, AnimalSwipePayload } from "@/lib/api";
import { createMannerTracker } from "@/lib/animal/manner";
import { topTraitChips } from "@/lib/animal/animals";
import styles from "./animal.module.css";

interface Props {
  cards: AnimalCard[];
  onComplete: (swipes: AnimalSwipePayload[]) => void;
  reducedMotion: boolean;
}

const FLY_THRESHOLD = 110;

export default function SwipeDeck({ cards, onComplete, reducedMotion }: Props) {
  const [index, setIndex] = useState(0);
  const swipesRef = useRef<AnimalSwipePayload[]>([]);
  const tracker = useMemo(() => createMannerTracker(), []);
  const topRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const busy = useRef(false);

  useEffect(() => {
    if (index < cards.length) tracker.cardShown();
  }, [index, cards.length, tracker]);

  const commit = useCallback(
    (direction: "left" | "right") => {
      if (busy.current || index >= cards.length) return;
      busy.current = true;
      const card = cards[index];
      const manner = tracker.commit();
      swipesRef.current.push({ card, direction, ...manner });
      const advance = () => {
        busy.current = false;
        if (index + 1 >= cards.length) onComplete(swipesRef.current);
        else setIndex((i) => i + 1);
      };
      const el = topRef.current;
      if (!el || reducedMotion) return advance();
      gsap.to(el, {
        x: direction === "right" ? window.innerWidth : -window.innerWidth,
        rotation: direction === "right" ? 24 : -24,
        opacity: 0,
        duration: 0.45,
        ease: "power2.in",
        onComplete: () => {
          gsap.set(el, { x: 0, y: 0, rotation: 0, opacity: 1 });
          advance();
        },
      });
    },
    [cards, index, onComplete, reducedMotion, tracker]
  );

  // keyboard: left = pass, right = save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") commit("left");
      if (e.key === "ArrowRight") commit("right");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (reducedMotion || busy.current) return;
    dragging.current = true;
    start.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !topRef.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    tracker.drag(dx);
    gsap.set(topRef.current, { x: dx, y: dy * 0.4, rotation: dx / 18 });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging.current || !topRef.current) return;
    dragging.current = false;
    const dx = e.clientX - start.current.x;
    if (dx > FLY_THRESHOLD) commit("right");
    else if (dx < -FLY_THRESHOLD) commit("left");
    else gsap.to(topRef.current, { x: 0, y: 0, rotation: 0, duration: 0.35, ease: "elastic.out(1,0.6)" });
  };

  if (index >= cards.length) return null;
  const visible = cards.slice(index, index + 3);

  return (
    <div className={styles.deckWrap}>
      <p className={`mono ${styles.deckProgress}`}>
        {index + 1} / {cards.length}
      </p>
      <div className={styles.deckStack}>
        {visible.map((card, i) => (
          <div
            key={card.id}
            ref={i === 0 ? topRef : undefined}
            className={styles.card}
            style={{
              zIndex: 3 - i,
              transform: `translateY(${i * 14}px) translateZ(${-i * 60}px) scale(${1 - i * 0.05})`,
            }}
            onPointerDown={i === 0 ? onPointerDown : undefined}
            onPointerMove={i === 0 ? onPointerMove : undefined}
            onPointerUp={i === 0 ? onPointerUp : undefined}
          >
            <p className={`mono ${styles.cardCompany}`}>{card.company}</p>
            <h3 className={styles.cardTitle}>{card.title}</h3>
            {card.location && <p className={styles.cardLoc}>{card.location}</p>}
            <div className={styles.chips}>
              {topTraitChips(card.traits).map((c) => (
                <span key={c} className={styles.chip}>{c}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={styles.deckActions}>
        <button className={styles.passBtn} onClick={() => commit("left")} aria-label="Pass">
          ✕ Pass
        </button>
        <button className={styles.saveBtn} onClick={() => commit("right")} aria-label="Save to shortlist">
          ♥ Save
        </button>
      </div>
      <p className={`mono ${styles.hint}`}>drag, tap, or use ← →&nbsp;&nbsp;·&nbsp;&nbsp;save ≠ apply — you evaluate later</p>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/animal/animal.module.css`** (deck section)

```css
/* ── Swipe deck ─────────────────────────────────────────── */
.deckWrap {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  padding-top: 1rem;
}

.deckProgress { color: var(--ink-55); }

.deckStack {
  position: relative;
  width: min(380px, 88vw);
  height: 300px;
  perspective: 900px;
  transform-style: preserve-3d;
}

.card {
  position: absolute;
  inset: 0;
  background: var(--surface);
  border-radius: var(--r-l);
  box-shadow: var(--shadow-lift);
  padding: 1.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  cursor: grab;
  touch-action: none;
  user-select: none;
  will-change: transform;
}
.card:active { cursor: grabbing; }

.cardCompany { color: var(--iris); letter-spacing: 0.06em; }
.cardTitle { font-size: 1.4rem; }
.cardLoc { color: var(--ink-55); font-size: 0.9rem; }

.chips { display: flex; gap: 0.5rem; margin-top: auto; flex-wrap: wrap; }
.chip {
  font-family: var(--font-mono), monospace;
  font-size: 0.72rem;
  padding: 0.25rem 0.7rem;
  border-radius: var(--r-pill);
  background: var(--iris-08);
  color: var(--iris-deep);
}

.deckActions { display: flex; gap: 1rem; }
.passBtn, .saveBtn {
  border: none;
  border-radius: var(--r-pill);
  padding: 0.7rem 1.5rem;
  font-weight: 600;
  transition: transform 0.15s ease;
}
.passBtn { background: var(--ink-06); color: var(--ink-72); }
.saveBtn { background: var(--iris); color: #fff; }
.passBtn:hover, .saveBtn:hover { transform: translateY(-2px); }

.hint { color: var(--ink-30); font-size: 0.72rem; }
```

- [ ] **Step 3: Verify**

`npx tsc --noEmit` clean; `npm run lint` clean.

---

### Task 6: Ceremony + ResultsPanel components

**Files:**
- Create: `components/animal/Ceremony.tsx`
- Create: `components/animal/ResultsPanel.tsx`
- Modify: `components/animal/animal.module.css` (append)

**Interfaces:**
- Consumes: `AnimalState`, `AnimalCard` from `@/lib/api`; `ANIMALS`, `AXES_META`, `TEMPERAMENTS` from `@/lib/animal/animals`; `PorcelainScene` from `@/lib/animal/scene`.
- Produces: `<Ceremony state scene onSettle />` — drives `scene.condense()` → `scene.revealFigurine()` → headline/why text → Skip button → calls `onSettle()` (also immediately under reduced motion). `<ResultsPanel state shortlist scene />` — trait bars, temperament, alignment meter + play, shortlist with `/evaluate?url=` links, PNG snapshot download.

- [ ] **Step 1: Implement `components/animal/Ceremony.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { AnimalState } from "@/lib/api";
import { ANIMALS, type AnimalId } from "@/lib/animal/animals";
import type { PorcelainScene } from "@/lib/animal/scene";
import styles from "./animal.module.css";

interface Props {
  state: AnimalState;
  scene: PorcelainScene | null;
  reducedMotion: boolean;
  onSettle: () => void;
}

export default function Ceremony({ state, scene, reducedMotion, onSettle }: Props) {
  const [phase, setPhase] = useState<"condensing" | "revealed">("condensing");
  const textRef = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const meta = ANIMALS[state.animal as AnimalId] ?? ANIMALS.chameleon;

  const settle = () => {
    if (done.current) return;
    done.current = true;
    scene?.settle();
    onSettle();
  };

  useEffect(() => {
    if (reducedMotion || !scene) {
      settle();
      return;
    }
    let cancelled = false;
    (async () => {
      await scene.condense();
      if (cancelled) return;
      await scene.revealFigurine(state.animal, state.alignment, state.temperament);
      if (cancelled) return;
      setPhase("revealed");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "revealed" || !textRef.current) return;
    const tl = gsap.timeline();
    tl.fromTo(textRef.current.children, { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, stagger: 0.35, ease: "power3.out" });
    tl.call(settle, [], "+=2.2");
    return () => { tl.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <div className={styles.ceremony}>
      {phase === "revealed" && (
        <div ref={textRef} className={styles.ceremonyText}>
          <h1 className={styles.ceremonyHeadline}>
            {state.copy?.headline ?? `You're ${/^[aeiou]/i.test(meta.name) ? "an" : "a"} ${meta.name}. ${meta.emoji}`}
          </h1>
          <p className={styles.ceremonyWhy}>{state.copy?.why ?? meta.niche}</p>
        </div>
      )}
      <button className={`mono ${styles.skipBtn}`} onClick={settle}>
        skip →
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Implement `components/animal/ResultsPanel.tsx`**

```tsx
"use client";

import Link from "next/link";
import type { AnimalCard, AnimalState } from "@/lib/api";
import { ANIMALS, AXES_META, TEMPERAMENTS, type AnimalId } from "@/lib/animal/animals";
import type { PorcelainScene } from "@/lib/animal/scene";
import styles from "./animal.module.css";

interface Props {
  state: AnimalState;
  shortlist: AnimalCard[];
  scene: PorcelainScene | null;
}

export default function ResultsPanel({ state, shortlist, scene }: Props) {
  const meta = ANIMALS[state.animal as AnimalId] ?? ANIMALS.chameleon;
  const temp = TEMPERAMENTS[state.temperament] ?? TEMPERAMENTS.decisive;

  const download = () => {
    if (!scene) return;
    const a = document.createElement("a");
    a.href = scene.snapshot();
    a.download = `aura-${state.animal}.png`;
    a.click();
  };

  return (
    <section className={styles.results}>
      <header className={styles.resultsHead}>
        <div>
          <p className="mono" style={{ color: "var(--ink-55)" }}>
            YOUR_WORK_ANIMAL · {state.swipe_count} swipes read
          </p>
          <h2>
            {meta.emoji} {meta.name}
            <span className={styles.tempBadge}>{temp.label}</span>
          </h2>
          <p className={styles.niche}>{meta.niche}</p>
          {state.copy && <p className={styles.why}>{state.copy.why}</p>}
        </div>
        <button className={`mono ${styles.snapBtn}`} onClick={download}>
          ↓ save card
        </button>
      </header>

      <div className={styles.traitGrid}>
        {AXES_META.map(({ key, left, right }) => {
          const v = state.vector[key]; // -1..1 → 0..100%
          return (
            <div key={key} className={styles.traitRow}>
              <span className={`mono ${styles.pole}`}>{left}</span>
              <div className={styles.track}>
                <div className={styles.marker} style={{ left: `${((v + 1) / 2) * 100}%` }} />
              </div>
              <span className={`mono ${styles.pole}`}>{right}</span>
            </div>
          );
        })}
      </div>

      {state.alignment != null && (
        <div className={styles.alignBox}>
          <div className={styles.alignHead}>
            <span className="mono">ALIGNMENT_WITH_YOUR_STATED_GOALS</span>
            <strong>{state.alignment}/100</strong>
          </div>
          <div className={styles.alignTrack}>
            <div className={styles.alignFill} style={{ width: `${state.alignment}%` }} />
          </div>
          {state.copy?.play && <p className={styles.play}>▸ {state.copy.play}</p>}
        </div>
      )}

      <div className={styles.shortlist}>
        <h3>Your shortlist ({shortlist.length})</h3>
        <p className={styles.shortlistNote}>
          Saved, not applied — run each through a full evaluation first.
        </p>
        {shortlist.length === 0 && (
          <p style={{ color: "var(--ink-55)" }}>Nothing saved this round — swipe again anytime.</p>
        )}
        <ul>
          {shortlist.map((c) => (
            <li key={c.id} className={styles.shortRow}>
              <div>
                <p className="mono" style={{ color: "var(--iris)" }}>{c.company}</p>
                <p>{c.title}</p>
              </div>
              <Link
                className={styles.evalLink}
                href={`/evaluate?url=${encodeURIComponent(c.url)}`}
              >
                Evaluate →
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Append ceremony + results styles to `components/animal/animal.module.css`**

```css
/* ── Ceremony ───────────────────────────────────────────── */
.ceremony {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 14vh;
  pointer-events: none;
}
.ceremonyText { text-align: center; max-width: 560px; padding: 0 1.5rem; }
.ceremonyHeadline { font-size: clamp(2rem, 5vw, 3.4rem); }
.ceremonyWhy { color: var(--ink-72); margin-top: 0.8rem; font-size: 1.05rem; }
.skipBtn {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  pointer-events: auto;
  background: none;
  border: 1px solid var(--ink-12);
  border-radius: var(--r-pill);
  padding: 0.4rem 1rem;
  color: var(--ink-55);
}

/* ── Results ────────────────────────────────────────────── */
.results {
  position: relative;
  z-index: 2;
  max-width: 720px;
  margin: 0 auto;
  padding: 1rem 1.5rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}
.resultsHead { display: flex; justify-content: space-between; align-items: start; gap: 1rem; }
.resultsHead h2 { display: flex; align-items: center; gap: 0.75rem; font-size: 2rem; }
.tempBadge {
  font-family: var(--font-mono), monospace;
  font-size: 0.7rem;
  padding: 0.3rem 0.8rem;
  border-radius: var(--r-pill);
  background: var(--iris-12);
  color: var(--iris-deep);
}
.niche { color: var(--ink-72); margin-top: 0.4rem; }
.why { margin-top: 0.6rem; }
.snapBtn {
  white-space: nowrap;
  background: var(--ink-06);
  border: none;
  border-radius: var(--r-pill);
  padding: 0.5rem 1rem;
  color: var(--ink-72);
}

.traitGrid {
  background: var(--surface);
  border-radius: var(--r-l);
  box-shadow: var(--shadow-card);
  padding: 1.4rem 1.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.traitRow { display: grid; grid-template-columns: 7.5rem 1fr 7.5rem; align-items: center; gap: 0.8rem; }
.pole { font-size: 0.7rem; color: var(--ink-55); }
.pole:last-child { text-align: right; }
.track { position: relative; height: 6px; border-radius: 3px; background: var(--ink-06); }
.marker {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--iris);
  transform: translate(-50%, -50%);
  box-shadow: 0 0 0 4px var(--iris-12);
}

.alignBox {
  background: var(--surface);
  border-radius: var(--r-l);
  box-shadow: var(--shadow-card);
  padding: 1.4rem 1.6rem;
}
.alignHead { display: flex; justify-content: space-between; margin-bottom: 0.7rem; }
.alignTrack { height: 8px; border-radius: 4px; background: var(--ink-06); overflow: hidden; }
.alignFill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--aura-a), var(--aura-b), var(--aura-c));
}
.play { margin-top: 0.8rem; color: var(--iris-deep); font-weight: 600; }

.shortlist h3 { margin-bottom: 0.2rem; }
.shortlistNote { color: var(--ink-55); font-size: 0.85rem; margin-bottom: 0.8rem; }
.shortlist ul { list-style: none; display: flex; flex-direction: column; gap: 0.6rem; }
.shortRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--surface);
  border-radius: var(--r-m);
  box-shadow: var(--shadow-card);
  padding: 0.9rem 1.2rem;
}
.evalLink { color: var(--iris); font-weight: 600; text-decoration: none; white-space: nowrap; }
```

- [ ] **Step 4: Verify**

`npx tsc --noEmit` clean; `npm run lint` clean.

---

### Task 7: Page assembly, nav link, end-to-end walkthrough

**Files:**
- Create: `app/animal/page.tsx`
- Modify: `components/Nav.tsx` (add one link to the seeker `links` array, after the SCAN_JOBS entry: `{ href: "/animal", label: "WORK_ANIMAL" },`)

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: the `/animal` route with the phase machine `loading → deck → submitting → ceremony → results` (ceremony only when `is_new_animal`; returning users with an existing state land on `results` with a "Swipe a new deck" CTA).

- [ ] **Step 1: Implement `app/animal/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { AnimalCard, AnimalState, AnimalSwipePayload } from "@/lib/api";
import { PorcelainScene } from "@/lib/animal/scene";
import SwipeDeck from "@/components/animal/SwipeDeck";
import Ceremony from "@/components/animal/Ceremony";
import ResultsPanel from "@/components/animal/ResultsPanel";

type Phase = "loading" | "deck" | "submitting" | "ceremony" | "results" | "error";

export default function AnimalPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [cards, setCards] = useState<AnimalCard[]>([]);
  const [state, setState] = useState<AnimalState | null>(null);
  const [shortlist, setShortlist] = useState<AnimalCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PorcelainScene | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  // scene mounts once and persists across phases — one continuous space
  useEffect(() => {
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReducedMotion(rm);
    if (containerRef.current && !sceneRef.current) {
      sceneRef.current = new PorcelainScene(containerRef.current, { reducedMotion: rm });
    }
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  // returning users go straight to results; everyone else gets a deck
  useEffect(() => {
    (async () => {
      try {
        const existing = await api.animalState();
        const list = await api.animalShortlist();
        setState(existing);
        setShortlist(list.cards);
        await sceneRef.current?.revealFigurine(existing.animal, existing.alignment, existing.temperament);
        sceneRef.current?.settle();
        setPhase("results");
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          try {
            const deck = await api.animalDeck();
            setCards(deck.cards);
            setPhase("deck");
          } catch {
            setError("Couldn't build a deck — is the backend running?");
            setPhase("error");
          }
        } else {
          setError("Couldn't reach the backend.");
          setPhase("error");
        }
      }
    })();
  }, []);

  const newDeck = useCallback(async () => {
    setPhase("loading");
    try {
      const deck = await api.animalDeck();
      setCards(deck.cards);
      setPhase("deck");
    } catch {
      setError("Couldn't build a deck.");
      setPhase("error");
    }
  }, []);

  const onDeckComplete = useCallback(async (swipes: AnimalSwipePayload[]) => {
    setPhase("submitting");
    try {
      const result = await api.animalSwipes(swipes);
      const list = await api.animalShortlist();
      setState(result);
      setShortlist(list.cards);
      if (result.is_new_animal && !reducedMotion) {
        setPhase("ceremony");
      } else {
        await sceneRef.current?.revealFigurine(result.animal, result.alignment, result.temperament);
        sceneRef.current?.settle();
        setPhase("results");
      }
    } catch {
      setError("Couldn't read your swipes — try again.");
      setPhase("error");
    }
  }, [reducedMotion]);

  return (
    <main style={{ position: "relative", minHeight: "100vh" }}>
      {/* the continuous porcelain space — behind everything, all phases */}
      <div
        ref={containerRef}
        style={{ position: "fixed", inset: 0, zIndex: 0 }}
        aria-hidden="true"
      />

      <div style={{ position: "relative", zIndex: 1, paddingTop: "5.5rem" }}>
        {phase === "loading" && (
          <p className="mono" style={{ textAlign: "center", color: "var(--ink-55)" }}>
            dealing your deck…
          </p>
        )}

        {phase === "deck" && (
          <>
            <header style={{ textAlign: "center", marginBottom: "1rem", padding: "0 1.5rem" }}>
              <h1 style={{ fontSize: "1.6rem" }}>What are you at work?</h1>
              <p style={{ color: "var(--ink-55)" }}>
                Swipe real roles. Your instincts do the talking.
              </p>
            </header>
            <SwipeDeck cards={cards} onComplete={onDeckComplete} reducedMotion={reducedMotion} />
          </>
        )}

        {phase === "submitting" && (
          <p className="mono" style={{ textAlign: "center", color: "var(--ink-55)" }}>
            reading your instincts…
          </p>
        )}

        {phase === "ceremony" && state && (
          <Ceremony
            state={state}
            scene={sceneRef.current}
            reducedMotion={reducedMotion}
            onSettle={() => setPhase("results")}
          />
        )}

        {phase === "results" && state && (
          <>
            <div style={{ height: "34vh" }} aria-hidden="true" /> {/* figurine window */}
            <ResultsPanel state={state} shortlist={shortlist} scene={sceneRef.current} />
            <div style={{ textAlign: "center", paddingBottom: "3rem" }}>
              <button className="btn btn-primary" onClick={newDeck}>
                Swipe a new deck
              </button>
            </div>
          </>
        )}

        {phase === "error" && (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <p style={{ color: "var(--score-weak)" }}>{error}</p>
            <button className="btn" onClick={newDeck} style={{ marginTop: "1rem" }}>
              Retry
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add the nav link**

In `components/Nav.tsx`, in the seeker links array after the `/scan` entry, add:

```typescript
  { href: "/animal", label: "WORK_ANIMAL" },
```

- [ ] **Step 3: Static verification**

`npx tsc --noEmit` clean; `npm run lint` clean; `npm run build` succeeds.

- [ ] **Step 4: End-to-end walkthrough** (requires backend: `cd ../AURA-TALENT-BACKEND && uv run uvicorn app.main:app --port 8000`; frontend `.env` needs `BACKEND_URL` + `BACKEND_API_KEY`)

Start `npm run dev`, open `/animal`, and verify:
1. Fresh user (clear `aura_uid` from localStorage): deck of 15 cards appears over drifting aura wisps; drag physics work; ← → keys work; trait chips show.
2. Complete all 15 swipes → "reading your instincts…" → wisps condense → figurine materializes (porcelain totem if no GLBs) → headline + why → auto-settles into results.
3. Results: trait markers match swipe behavior directionally; temperament badge present; alignment box only if a resume exists for the user; shortlist rows link to `/evaluate?url=...` and that page loads with the URL prefilled.
4. Reload `/animal`: goes straight to results (no ceremony), figurine already posed.
5. "Swipe a new deck" → new deck; finishing with the SAME animal skips the ceremony (is_new_animal false).
6. Emulate `prefers-reduced-motion` (DevTools → Rendering): no drag tweens, no ceremony, static scene frame, all content reachable.
7. No console errors throughout; nav shows WORK_ANIMAL highlighted.

---

## Done means

- `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean; `node --test lib/animal/manner.test.mjs` green (5 tests).
- The Task 7 walkthrough passes end-to-end against the live backend.
- Optional GLB drop (`public/animals/`) documented; flow works with zero assets.
- No git actions taken — user commits.
