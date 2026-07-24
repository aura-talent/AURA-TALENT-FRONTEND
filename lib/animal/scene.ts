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
  private wispTex: THREE.Texture;
  private figurine: THREE.Group | null = null;
  private glow: THREE.PointLight;
  private raf = 0;
  private t = 0;
  private spin = 0.004; // idle turntable speed — temperament sets the character
  private lookTarget = new THREE.Vector3(0, 0.6, 0); // camera aim; settle() lowers it to frame the figurine high
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
    this.camera.lookAt(this.lookTarget);

    this.scene.fog = new THREE.Fog(PORCELAIN, 8, 16);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(3, 6, 4);
    this.scene.add(key);
    this.glow = new THREE.PointLight(AURA[0], 0, 12);
    this.glow.position.set(0, 1.4, 1.2);
    this.scene.add(this.glow);

    this.wispTex = wispTexture();
    for (let i = 0; i < WISP_COUNT; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.wispTex,
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
    this.applyFraming();
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
    if (Math.abs(this.dock - this.dockCurrent) > 0.001) {
      this.dockCurrent += (this.dock - this.dockCurrent) * 0.16;
      this.applyFraming();
    }
    this.camera.lookAt(this.lookTarget);
    this.renderer.render(this.scene, this.camera);
  };

  private renderOnce() {
    this.camera.lookAt(this.lookTarget);
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

  /** Porcelain material for the procedural fallback totem (GLB figurines
   * keep their original artist colors). */
  private porcelainize(root: THREE.Object3D) {
    const mat = new THREE.MeshStandardMaterial({
      color: PORCELAIN, roughness: 0.35, metalness: 0.05,
      emissive: INK, emissiveIntensity: 0.02,
    });
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        const m = mesh.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m?.dispose();
        mesh.material = mat;
      }
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

  /** Remove + free the previous figurine before revealing a new one. */
  private clearFigurine() {
    if (!this.figurine) return;
    this.scene.remove(this.figurine);
    this.figurine.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const m = mesh.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m?.dispose();
      }
    });
    this.figurine = null;
  }

  async revealFigurine(
    animalId: string,
    alignment: number | null,
    temperament?: string
  ): Promise<void> {
    this.clearFigurine();
    // spec §4: temperament = idle animation character
    this.spin = { decisive: 0.009, analytical: 0.002, exploratory: 0.006, selective: 0.004 }[
      temperament ?? ""
    ] ?? 0.004;
    let model: THREE.Group;
    try {
      const gltf = await new GLTFLoader().loadAsync(`/animals/${animalId}.glb`);
      model = gltf.scene; // keep the artist's original materials/colors
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      // Fit by max dimension, but hard-cap the HEIGHT so tall animals (hawk,
      // owl) don't poke above the framed window like wide ones stay short.
      const s = Math.min(1.3 / Math.max(size.x, size.y, size.z), 1.0 / size.y);
      model.scale.setScalar(s);
      const box2 = new THREE.Box3().setFromObject(model);
      model.position.y = 0.35 - box2.min.y;
    } catch {
      model = this.totem();
      this.porcelainize(model); // fallback totem has no materials of its own
    }

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

  /** Ceremony → results: reframe so the figurine sits in the TOP band of the
   * viewport (the results layout's figurine window), clear of both the nav
   * bar and the panel text. Uses a view offset so the placement is a fixed
   * FRACTION of the viewport — stable across window sizes, unlike world-space
   * camera aiming. */
  private framing = 0; // 0 = centered (deck/ceremony) … 1 = settled top-band (results)
  private dock = 0; // scroll-driven target: 0 = full figurine … 1 = docked mini emblem
  private dockCurrent = 0; // eased follower for buttery scroll response

  private applyFraming() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    const p = this.framing;
    const d = this.dockCurrent;
    if (p <= 0 && d <= 0) {
      this.camera.clearViewOffset();
      return;
    }
    // Virtual frame up to 1.8x taller, window over its lower part: at p=1 the
    // centered figurine lands ~18% from the top of the real viewport. p is
    // interpolated so the reframe glides instead of jumping; p=0 is identity.
    // Scrolling adds d: extra upward offset that docks the (shrinking)
    // figurine near the top bar, sticky-style.
    this.camera.setViewOffset(w, h * (1 + 0.8 * p), 0, h * (0.72 * p + 0.15 * d), w, h);
    // scale only while docking so resize can never interrupt the reveal pop
    if (this.figurine && d > 0.001) this.figurine.scale.setScalar(1 - 0.5 * d);
  }

  /** Scroll-linked dock (results page): 0 = full-size in the top band,
   * 1 = shrunk + pinned under the nav. Eased in the render loop. */
  setDock(p: number): void {
    this.dock = Math.max(0, Math.min(1, p));
    if (this.reducedMotion) {
      this.dockCurrent = this.dock;
      this.applyFraming();
      this.renderOnce();
    }
  }

  /** Resolves when the reframe finishes — callers sequence the results text
   * entrance after the zoom, never during it. */
  settle(): Promise<void> {
    if (this.reducedMotion) {
      this.framing = 1;
      this.applyFraming();
      this.camera.position.set(0, 1.2, 9);
      this.lookTarget.set(0, 1.0, 0);
      this.renderOnce();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      gsap.to(this, {
        framing: 1, duration: 0.9, ease: "power2.inOut",
        onUpdate: () => this.applyFraming(),
      });
      gsap.to(this.camera.position, {
        x: 0, y: 1.2, z: 9, duration: 0.9, ease: "power2.inOut",
        onComplete: resolve,
      });
      gsap.to(this.lookTarget, { x: 0, y: 1.0, z: 0, duration: 0.9, ease: "power2.inOut" });
    });
  }

  snapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/png");
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    this.clearFigurine();
    this.wisps.forEach((s) => s.material.dispose());
    this.wispTex.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
