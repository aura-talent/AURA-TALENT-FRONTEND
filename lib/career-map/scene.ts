// lib/career-map/scene.ts
// Framework-free three.js scene for the career constellation.
// React never touches three objects; the page talks to this class only.
// Node look matches the approved demo exactly: one flat soft-glow disc per
// node in its branch color, porcelain root with a pulsing ring, labels below.
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
  /** Fired whenever the focus carousel moves (and once per setMap with the root). */
  onFocus(node: CareerMapNode, index: number, total: number): void;
}

const KIND_HEX: Record<CareerMapNode["kind"], string> = {
  current: "#fafaf8",
  progression: "#8f7dff",
  pivot: "#ffb98f",
  wildcard: "#7fd6b2",
};

const CAM_HOME = { pos: new THREE.Vector3(0, 120, 620), target: new THREE.Vector3(0, 0, 0) };

/** Deterministic pseudo-random in [0,1) — the scene must never use Math.random. */
function hash01(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Materials that carry an opacity we tween — base opacity is stashed in userData. */
type OpacityMaterial = { opacity: number; userData: { baseOpacity: number } };

function withBaseOpacity<T extends THREE.Material & { opacity: number }>(mat: T): T {
  mat.userData.baseOpacity = mat.opacity;
  return mat;
}

/**
 * Narrow a three.js material (or material array — never used here, but that's
 * how `Mesh.material`/`Sprite.material` are typed) to the shape applyHighlight
 * and the dive/return tweens need.
 */
function asOpacityMaterial(mat: THREE.Material | THREE.Material[]): OpacityMaterial {
  return mat as unknown as OpacityMaterial;
}

interface NodeVisual {
  node: CareerMapNode;
  group: THREE.Group; // orb + halo + picker + label (+ root pulse ring)
  orb: THREE.Sprite; // the demo disc: flat solid core + soft glow, one texture
  halo: THREE.Sprite; // invisible at rest; becomes the room we stand in on dive
  picker: THREE.Mesh; // invisible raycast target
  ring: THREE.Sprite | null; // root pulse ring
  label: THREE.Sprite;
  baseHaloScale: number;
  baseRingScale: number;
  baseLabelScale: { x: number; y: number };
}

/** Any group child whose material access should go through `asOpacityMaterial`. */
type VisualChild = THREE.Mesh | THREE.Sprite;

function childMaterial(child: THREE.Object3D): OpacityMaterial {
  return asOpacityMaterial((child as VisualChild).material);
}

/* ── canvas textures ────────────────────────────────────────────── */

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

/**
 * The demo's node: a flat, solid color disc wrapped in a soft glow — nothing
 * else. Core occupies 30% of the half-size, glow fades to the edge (~3.3×).
 * Baked once per kind and shared by every node of that kind.
 */
function makeOrbTexture(hex: string, isRoot: boolean): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const glow = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  glow.addColorStop(0, hex + (isRoot ? "cc" : "99"));
  glow.addColorStop(1, hex + "00");
  g.fillStyle = glow;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = hex;
  g.beginPath();
  g.arc(128, 128, 38, 0, Math.PI * 2); // 38/128 = 0.30 of the half-size
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Thin stroked circle — the root node's pulsing aura ring. */
function makeRingTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.strokeStyle = "rgba(199,185,255,0.9)";
  g.lineWidth = 4;
  g.beginPath();
  g.arc(128, 128, 110, 0, Math.PI * 2);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Node label: title (word-wrapped to at most two lines, ellipsized beyond)
 * over the colored duration. Returns the texture plus its aspect ratio so the
 * sprite can be sized per-label without stretching.
 */
function makeLabelTexture(title: string, sub: string, color: string): { tex: THREE.CanvasTexture; aspect: number } {
  const W = 280, TITLE_FONT = "600 19px 'Hanken Grotesk', 'Avenir Next', sans-serif";
  const scale = 2;
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = TITLE_FONT;

  // greedy word wrap into at most 2 lines
  const words = title.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const attempt = cur ? `${cur} ${word}` : word;
    if (measure.measureText(attempt).width <= W - 16 || !cur) {
      cur = attempt;
    } else {
      lines.push(cur);
      cur = word;
      if (lines.length === 2) break;
    }
  }
  if (lines.length < 2 && cur) lines.push(cur);
  else if (cur && lines.length === 2) {
    let last = lines[1];
    while (measure.measureText(last + "…").width > W - 16 && last.length > 1) last = last.slice(0, -1);
    lines[1] = last + "…";
  }

  const LINE_H = 25;
  const H = 10 + lines.length * LINE_H + 24; // title block + duration line
  const c = document.createElement("canvas");
  c.width = W * scale;
  c.height = H * scale;
  const g = c.getContext("2d")!;
  g.scale(scale, scale);
  g.textAlign = "center";
  g.font = TITLE_FONT;
  g.fillStyle = "rgba(250,250,248,0.94)";
  lines.forEach((line, i) => g.fillText(line, W / 2, 24 + i * LINE_H));
  g.font = "13.5px 'Space Mono', ui-monospace, monospace";
  g.fillStyle = color;
  g.fillText(sub, W / 2, 10 + lines.length * LINE_H + 16);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, aspect: H / W };
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
  private ringTex = makeRingTexture();
  private orbTex: Record<CareerMapNode["kind"], THREE.CanvasTexture> = {
    current: makeOrbTexture(KIND_HEX.current, true),
    progression: makeOrbTexture(KIND_HEX.progression, false),
    pivot: makeOrbTexture(KIND_HEX.pivot, false),
    wildcard: makeOrbTexture(KIND_HEX.wildcard, false),
  };

  private visuals = new Map<string, NodeVisual>();
  private edgeLines: { line: THREE.Line; source: string; target: string }[] = [];
  private edgesGroup = new THREE.Group();
  private nodesGroup = new THREE.Group();
  private map: CareerMapOut | null = null;

  /** Starfield layers that twinkle asynchronously in tick(). */
  private starLayers: { points: THREE.Points; baseOpacity: number; phase: number; period: number }[] = [];
  private bgResources: { geometry?: THREE.BufferGeometry; material: THREE.Material }[] = [];

  private hoveredId: string | null = null;
  /** Carousel focus: order (root first) + current index. */
  private focusOrder: string[] = [];
  private focusIndex = 0;
  /** Node currently growing new branches — pulses as a beacon until cleared. */
  private discoveringId: string | null = null;
  private mode: "map" | "diving" | "detail" | "returning" = "map";
  private savedCam: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;
  /** Bumped on every setMap; lets in-flight spawn tweens from a stale build no-op. */
  private mapGeneration = 0;
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

    this.camera = new THREE.PerspectiveCamera(55, w / h, 1, 6000);
    this.camera.position.copy(CAM_HOME.pos);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.autoRotate = !opts.reducedMotion;
    this.controls.autoRotateSpeed = 0.45;
    this.controls.minDistance = 140;
    this.controls.maxDistance = 1400;
    // free navigation: drag-pan (right mouse / two-finger touch). Arrow keys
    // are reserved for the focus carousel (focusPrev/focusNext), not panning.
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.panSpeed = 0.9;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.75, 0.55, 0.72);
    this.composer.addPass(bloom); // tight: high threshold, modest strength
    this.composer.addPass(new FilmPass(0.18, false)); // subtle grain (spec §6)

    this.scene.add(this.edgesGroup, this.nodesGroup);
    this.addStars();
    this.addNebulae();
    this.addDust();

    this.renderer.domElement.addEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.addEventListener("click", this.onClick);
    this.renderer.domElement.addEventListener("dblclick", this.onDblClick);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("resize", this.onResize);
    this.tick();
  }

  /* ── deep space backdrop ── */

  /**
   * Three star layers on a far spherical shell (fibonacci-distributed, fully
   * deterministic), each twinkling on its own slow phase. Fog is disabled and
   * sizes are in screen pixels so they read as infinitely far at any zoom.
   */
  private addStars() {
    const layers: { count: number; color: number; size: number; opacity: number; r0: number; period: number }[] = [
      { count: 900, color: 0xdde3ff, size: 3.0, opacity: 0.8, r0: 1900, period: 1100 },
      { count: 220, color: 0xc7b9ff, size: 4.6, opacity: 0.85, r0: 1700, period: 800 },
      { count: 120, color: 0xffd9c2, size: 3.8, opacity: 0.7, r0: 2100, period: 1400 },
    ];
    layers.forEach((l, li) => {
      const pos = new Float32Array(l.count * 3);
      for (let i = 0; i < l.count; i++) {
        // fibonacci sphere + hashed radial jitter
        const y = 1 - (2 * (i + 0.5)) / l.count;
        const rr = Math.sqrt(Math.max(0, 1 - y * y));
        const phi = i * 2.399963229728653;
        const radius = l.r0 + hash01(i * 7 + li * 131) * 400;
        pos[i * 3] = Math.cos(phi) * rr * radius;
        pos[i * 3 + 1] = y * radius;
        pos[i * 3 + 2] = Math.sin(phi) * rr * radius;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        size: l.size, map: this.haloTex, color: l.color, transparent: true,
        opacity: l.opacity, depthWrite: false, blending: THREE.AdditiveBlending,
        fog: false, sizeAttenuation: false,
      });
      const points = new THREE.Points(geo, mat);
      this.scene.add(points);
      this.starLayers.push({ points, baseOpacity: l.opacity, phase: li * 2.1, period: l.period });
      this.bgResources.push({ geometry: geo, material: mat });
    });
  }

  /** Vast, faint aura-tinted clouds far behind the map — depth, not decoration. */
  private addNebulae() {
    const blobs: { color: number; opacity: number; scale: number; pos: [number, number, number] }[] = [
      { color: 0x4e3fd8, opacity: 0.07, scale: 1900, pos: [-800, 260, -1500] },
      { color: 0xc7b9ff, opacity: 0.05, scale: 1500, pos: [1000, -200, -1700] },
      { color: 0xffd9c2, opacity: 0.045, scale: 1300, pos: [-500, -380, -1300] },
      { color: 0xbfead8, opacity: 0.04, scale: 1200, pos: [700, 420, -1100] },
    ];
    for (const b of blobs) {
      const mat = new THREE.SpriteMaterial({
        map: this.haloTex, color: b.color, transparent: true, opacity: b.opacity,
        depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.setScalar(b.scale);
      sprite.position.set(...b.pos);
      this.scene.add(sprite);
      this.bgResources.push({ material: mat });
    }
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
    this.bgResources.push({ geometry: geo, material: mat });
  }

  /**
   * Kills any tweens still targeting the current visuals/edges, then disposes
   * every GPU resource they own. Shared textures (orb/halo/ring) are freed
   * only in `dispose()`. Each label sprite owns its texture and frees it here.
   */
  private disposeVisuals() {
    for (const v of this.visuals.values()) {
      gsap.killTweensOf(v.group.scale);
      gsap.killTweensOf(v.halo.scale);
      for (const child of v.group.children) {
        gsap.killTweensOf(childMaterial(child));
        const visual = child as VisualChild;
        if (visual instanceof THREE.Mesh) visual.geometry.dispose();
        const mat = visual.material as THREE.Material & { map?: THREE.Texture | null };
        if (visual === v.label) mat.map?.dispose(); // only the label owns its texture
        mat.dispose();
      }
    }
    for (const { line } of this.edgeLines) {
      gsap.killTweensOf(line.material);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    this.visuals.clear();
    this.edgeLines = [];
  }

  /* ── build / update ── */
  setMap(map: CareerMapOut, { animate }: { animate: boolean }) {
    // a rebuild can arrive mid-flight (e.g. expand fires setMap ~200ms after
    // zoomOut()) — kill camera/target tweens and reconcile the mode machine
    // before touching any visuals so stale dive/return onCompletes can't fire
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.controls.target);
    if (this.mode !== "map") {
      // setMap can land mid-return (killed the tweens above) — the saved
      // orbit is the only correct camera home, so snap to it before it's lost
      if (this.savedCam) {
        this.camera.position.copy(this.savedCam.pos);
        this.controls.target.copy(this.savedCam.target);
      }
      this.mode = "map";
      this.savedCam = null;
      this.controls.enabled = true;
      this.controls.autoRotate = !this.opts.reducedMotion;
      this.hoveredId = null;
    }

    const prevIds = new Set(this.visuals.keys());
    this.map = map;
    this.discoveringId = null; // visuals are rebuilt; the page re-flags if still discovering
    const positions = layoutMap(map);
    this.mapGeneration++;
    const gen = this.mapGeneration;

    // clear: disposes every previous visual/edge's GPU resources before the
    // groups are emptied
    this.nodesGroup.clear();
    this.edgesGroup.clear();
    this.disposeVisuals();

    const validIds = new Set(positions.keys());
    let total = 0;

    for (const node of map.nodes) {
      const p = positions.get(node.id);
      if (!p) continue; // unreachable node — client-side defense
      total++;
      const hex = KIND_HEX[node.kind];
      const group = new THREE.Group();
      group.position.set(p.x, p.y, p.z);

      const isRoot = node.kind === "current";
      const coreR = isRoot ? 12 : 5 + node.fit * 1.5;

      // the node itself: the demo's flat disc + glow, one billboard sprite.
      // Texture core is 30% of the half-size, so scale = coreR / 0.15 keeps
      // the visible disc radius at coreR world units.
      const orb = new THREE.Sprite(withBaseOpacity(new THREE.SpriteMaterial({
        map: this.orbTex[node.kind], transparent: true, depthWrite: false,
      })));
      orb.scale.setScalar(coreR / 0.15);
      group.add(orb);

      // dive backdrop halo: invisible at rest, swells into the room on dive
      const halo = new THREE.Sprite(withBaseOpacity(new THREE.SpriteMaterial({
        map: this.haloTex, color: new THREE.Color(hex), transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
      })));
      const haloScale = coreR * 7;
      halo.scale.setScalar(haloScale);
      group.add(halo);

      // invisible raycast target sized generously around the disc
      const picker = new THREE.Mesh(
        new THREE.SphereGeometry(coreR * 2.2, 8, 8),
        withBaseOpacity(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }))
      );
      picker.userData.nodeId = node.id;
      group.add(picker);

      // pulsing aura ring on the root only (the demo's "you" node)
      let ring: THREE.Sprite | null = null;
      const ringScale = coreR * 3.4;
      if (isRoot) {
        ring = new THREE.Sprite(withBaseOpacity(new THREE.SpriteMaterial({
          map: this.ringTex, transparent: true, opacity: 0.75,
          depthWrite: false, blending: THREE.AdditiveBlending,
        })));
        ring.scale.setScalar(ringScale);
        group.add(ring);
      }

      // label sprite (distance-compensated in tick so far nodes stay readable)
      const labelTex = makeLabelTexture(node.title, isRoot ? "you are here" : node.duration, hex);
      const label = new THREE.Sprite(withBaseOpacity(new THREE.SpriteMaterial({
        map: labelTex.tex, transparent: true, depthWrite: false,
      })));
      // width fixed; height follows the texture's aspect so wrapped titles
      // don't stretch. Sprites anchor at center, so offset by half the height.
      const baseLabelScale = { x: 110, y: 110 * labelTex.aspect };
      label.scale.set(baseLabelScale.x, baseLabelScale.y, 1);
      label.position.y = -(coreR + 10 + baseLabelScale.y / 2);
      group.add(label);

      this.nodesGroup.add(group);
      this.visuals.set(node.id, {
        node, group, orb, halo, picker, ring, label,
        baseHaloScale: haloScale, baseRingScale: ringScale, baseLabelScale,
      });
    }

    for (const e of map.edges) {
      if (!validIds.has(e.source) || !validIds.has(e.target)) continue;
      const a = positions.get(e.source)!;
      const b = positions.get(e.target)!;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z),
      ]);
      const color = new THREE.Color(KIND_HEX[e.kind]);
      const mat = e.kind === "wildcard"
        ? withBaseOpacity(new THREE.LineDashedMaterial({ color, transparent: true, opacity: 0.4, dashSize: 6, gapSize: 7 }))
        : withBaseOpacity(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 }));
      const line = new THREE.Line(geo, mat);
      if (e.kind === "wildcard") line.computeLineDistances();
      this.edgesGroup.add(line);
      this.edgeLines.push({ line, source: e.source, target: e.target });
    }

    // focus carousel order: root first, then build order; reset to the root
    const rootId = map.nodes.find((n) => n.kind === "current")?.id;
    const allIds = [...this.visuals.keys()];
    this.focusOrder = rootId && this.visuals.has(rootId)
      ? [rootId, ...allIds.filter((i) => i !== rootId)]
      : allIds;
    this.focusIndex = 0;
    this.emitFocus(false);

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
          if (gen !== this.mapGeneration) return;
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
    const pickers = [...this.visuals.values()].map((v) => v.picker);
    const hit = this.raycaster.intersectObjects(pickers, false)[0];
    const id = hit ? (hit.object.userData.nodeId as string) : null;
    if (id === this.hoveredId) return;
    this.hoveredId = id;
    this.container.style.cursor = id ? "pointer" : "grab";
    this.controls.autoRotate = !this.opts.reducedMotion && !id; // pause on hover
    this.cb.onHover(id ? this.visuals.get(id)!.node : null);
    this.applyHighlight();
  };

  /**
   * Tweens every node material's opacity to `baseOpacity * (on ? 1 : 0.08)`,
   * where `on` means the node is part of the currently hovered route (or
   * nothing is hovered, in which case everything is "on"). Edges follow the
   * same rule except the "on" case is boosted to a flat 0.7 opacity so the
   * highlighted path reads clearly against the dimmed rest of the map.
   */
  private applyHighlight() {
    // hover wins; otherwise the carousel focus lights its route. A focused
    // root is treated as "no focus" — its route is the whole map anyway, and
    // this keeps the resting look calm.
    const focused = this.focusedId ? this.visuals.get(this.focusedId) : null;
    const focusId = focused && focused.node.kind !== "current" ? focused.node.id : null;
    const activeId = this.hoveredId ?? focusId;
    const route = activeId ? this.routeSet(activeId) : null;
    const dur = this.opts.reducedMotion ? 0 : 0.25;
    const DIM = 0.08;
    for (const [id, v] of this.visuals) {
      const on = !route || route.has(id);
      const factor = on ? 1 : DIM;
      for (const child of v.group.children) {
        const mat = childMaterial(child);
        gsap.to(mat, { opacity: mat.userData.baseOpacity * factor, duration: dur, overwrite: "auto" });
      }
    }
    for (const { line, source, target } of this.edgeLines) {
      const mat = asOpacityMaterial(line.material);
      if (!route) {
        // nothing hovered — rest at each edge's own base opacity
        gsap.to(mat, { opacity: mat.userData.baseOpacity, duration: dur, overwrite: "auto" });
        continue;
      }
      const on = route.has(source) && route.has(target);
      gsap.to(mat, { opacity: on ? 0.7 : mat.userData.baseOpacity * DIM, duration: dur, overwrite: "auto" });
    }
  }

  /* ── dive / return ── */
  private onClick = () => {
    if (this.mode !== "map" || !this.hoveredId) return;
    this.diveInto(this.hoveredId);
  };

  private onDblClick = () => {
    if (this.mode !== "map" || this.hoveredId) return;
    this.recenter(); // double-click on empty space brings the map home
  };

  /* ── focus carousel: ‹ node › stepping with camera fly-to ── */

  private get focusedId(): string | null {
    return this.focusOrder[this.focusIndex] ?? null;
  }

  private emitFocus(fly: boolean) {
    const id = this.focusedId;
    const v = id ? this.visuals.get(id) : null;
    if (!v) return;
    this.cb.onFocus(v.node, this.focusIndex + 1, this.focusOrder.length);
    this.applyHighlight();
    if (!fly) return;
    // glide the orbit target onto the node, keeping the current view direction
    const p = v.group.position;
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const dist = THREE.MathUtils.clamp(this.camera.position.distanceTo(this.controls.target), 240, 420);
    const dest = p.clone().add(dir.multiplyScalar(dist));
    const dur = this.opts.reducedMotion ? 0 : 0.7;
    gsap.to(this.controls.target, { x: p.x, y: p.y, z: p.z, duration: dur, ease: "power2.inOut", overwrite: "auto" });
    gsap.to(this.camera.position, { x: dest.x, y: dest.y, z: dest.z, duration: dur, ease: "power2.inOut", overwrite: "auto" });
  }

  focusNext() {
    if (this.mode !== "map" || !this.focusOrder.length) return;
    this.focusIndex = (this.focusIndex + 1) % this.focusOrder.length;
    this.emitFocus(true);
  }

  focusPrev() {
    if (this.mode !== "map" || !this.focusOrder.length) return;
    this.focusIndex = (this.focusIndex - 1 + this.focusOrder.length) % this.focusOrder.length;
    this.emitFocus(true);
  }

  /** Dive into whichever node the carousel is focused on. */
  diveFocused() {
    if (this.focusedId) this.diveInto(this.focusedId);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.mode !== "map") return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      this.focusNext();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      this.focusPrev();
    } else if (e.key === "Enter") {
      e.preventDefault();
      this.diveFocused();
    }
  };

  /**
   * Flag the node currently generating new branches. Its halo breathes as a
   * beacon (driven from tick(), so dive/return/highlight tweens can't kill
   * it). Pass null to clear; the halo settles back to its resting opacity.
   */
  setDiscovering(nodeId: string | null) {
    if (this.discoveringId === nodeId) return;
    const prev = this.discoveringId ? this.visuals.get(this.discoveringId) : null;
    this.discoveringId = nodeId;
    if (prev) {
      const mat = asOpacityMaterial(prev.halo.material);
      gsap.to(mat, { opacity: mat.userData.baseOpacity, duration: 0.4, overwrite: "auto" });
    }
  }

  /** Fly the camera back to the home orbit framing the whole constellation. */
  recenter() {
    if (this.mode !== "map") return;
    const dur = this.opts.reducedMotion ? 0 : 0.9;
    gsap.to(this.camera.position, {
      x: CAM_HOME.pos.x, y: CAM_HOME.pos.y, z: CAM_HOME.pos.z,
      duration: dur, ease: "power3.inOut", overwrite: "auto",
    });
    gsap.to(this.controls.target, {
      x: CAM_HOME.target.x, y: CAM_HOME.target.y, z: CAM_HOME.target.z,
      duration: dur, ease: "power3.inOut", overwrite: "auto",
    });
  }

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

    // fade everything but the target; its halo swells into the ambient backdrop
    // while the disc itself dims so we pass "through the surface"
    this.hoveredId = null;
    for (const [id, ov] of this.visuals) {
      if (id === nodeId) continue;
      for (const child of ov.group.children)
        gsap.to(childMaterial(child),
          { opacity: 0, duration: dur * 0.7, overwrite: "auto" });
    }
    for (const { line } of this.edgeLines)
      gsap.to(asOpacityMaterial(line.material),
        { opacity: 0, duration: dur * 0.6, overwrite: "auto" });
    gsap.to(asOpacityMaterial(v.orb.material),
      { opacity: 0.15, duration: dur, overwrite: "auto" });
    gsap.to(asOpacityMaterial(v.label.material),
      { opacity: 0, duration: dur * 0.5, overwrite: "auto" });
    gsap.to(asOpacityMaterial(v.halo.material),
      { opacity: 0.5, duration: dur, overwrite: "auto" });
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
      for (const child of v.group.children) {
        const mat = childMaterial(child);
        gsap.to(mat, { opacity: mat.userData.baseOpacity, duration: dur, overwrite: "auto" });
      }
      gsap.to(v.halo.scale, { x: v.baseHaloScale, y: v.baseHaloScale, z: 1, duration: dur, overwrite: "auto" });
    }
    for (const { line } of this.edgeLines) {
      const mat = asOpacityMaterial(line.material);
      gsap.to(mat, { opacity: mat.userData.baseOpacity, duration: dur, overwrite: "auto" });
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
    const now = performance.now();

    // starfield twinkle: whole layers breathe slowly out of phase
    if (!this.opts.reducedMotion) {
      for (const l of this.starLayers) {
        (l.points.material as THREE.PointsMaterial).opacity =
          l.baseOpacity * (0.78 + 0.22 * Math.sin(now / l.period + l.phase));
      }
    }

    if (this.mode === "map") {
      for (const v of this.visuals.values()) {
        // labels grow with distance so the far side of the map stays readable
        const d = this.camera.position.distanceTo(v.group.position);
        const f = THREE.MathUtils.clamp(d / 620, 0.95, 1.9);
        v.label.scale.set(v.baseLabelScale.x * f, v.baseLabelScale.y * f, 1);
        if (v.ring && !this.opts.reducedMotion) {
          const s = v.baseRingScale * (1 + 0.05 * Math.sin(now / 480));
          v.ring.scale.set(s, s, 1);
        }
      }
      // discovery beacon: breathe the expanding node's halo. Written every
      // frame so highlight/return tweens can't strand it mid-pulse.
      if (this.discoveringId) {
        const v = this.visuals.get(this.discoveringId);
        if (v) {
          const mat = asOpacityMaterial(v.halo.material);
          mat.opacity = this.opts.reducedMotion
            ? 0.3
            : 0.12 + 0.22 * (0.5 + 0.5 * Math.sin(now / 280));
        }
      }
    }
    this.controls.update();
    this.composer.render();
    this.raf = requestAnimationFrame(this.tick);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.renderer.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.removeEventListener("click", this.onClick);
    this.renderer.domElement.removeEventListener("dblclick", this.onDblClick);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("resize", this.onResize);
    this.controls.dispose();
    // kill in-flight tweens targeting this scene's materials/transforms so none
    // fire onComplete callbacks (e.g. mode transitions) against disposed state,
    // then free every GPU resource the current visuals/edges own
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.controls.target);
    this.disposeVisuals();
    // backdrop resources (stars, nebulae, dust) and shared textures
    for (const r of this.bgResources) {
      r.geometry?.dispose();
      r.material.dispose();
    }
    this.haloTex.dispose();
    this.ringTex.dispose();
    for (const tex of Object.values(this.orbTex)) tex.dispose();
    this.renderer.dispose();
    this.container.replaceChildren();
  }
}
