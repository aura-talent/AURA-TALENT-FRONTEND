// A tiny framework-free three.js scene: one porcelain figurine that rotates to
// "look at" the cursor. React never touches three objects — the component talks
// to this class only (same convention as lib/animal/scene.ts).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MAX_YAW = 0.62; // radians the animal will turn left/right toward the cursor
const MAX_PITCH = 0.34; // radians up/down

export class EmblemScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private model: THREE.Group | null = null;
  private raf = 0;
  private targetYaw = 0;
  private targetPitch = 0;
  private curYaw = 0;
  private curPitch = 0;
  private baseYaw: number;
  private reduced: boolean;
  private container: HTMLElement;
  private onResize = () => this.resize();

  constructor(container: HTMLElement, opts?: { reducedMotion?: boolean; baseYaw?: number }) {
    this.container = container;
    this.reduced = opts?.reducedMotion ?? false;
    this.baseYaw = opts?.baseYaw ?? 0;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.set(0, 0, 3.0);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(2.5, 3.5, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xc7b9ff, 0.4); // faint aura rim
    rim.position.set(-3, 1, -2);
    this.scene.add(rim);

    this.resize();
    window.addEventListener("resize", this.onResize);
    this.loop();
  }

  /** Keep the model's own colours, just switch to flat (faceted / origami)
   * shading for the crisp MetaMask-style look. */
  private facet(root: THREE.Object3D) {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const sm = mat as THREE.MeshStandardMaterial;
        if (sm && "flatShading" in sm) {
          sm.flatShading = true;
          sm.needsUpdate = true;
        }
      }
    });
  }

  private disposeModel() {
    if (!this.model) return;
    this.scene.remove(this.model);
    this.model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mm = m.material;
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
        else mm?.dispose();
      }
    });
    this.model = null;
  }

  async load(animalId: string): Promise<void> {
    let mesh: THREE.Group;
    try {
      const gltf = await new GLTFLoader().loadAsync(`/animals/${animalId}.glb`);
      mesh = gltf.scene;
    } catch {
      return; // no asset → leave the ring empty rather than crash
    }
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    mesh.scale.setScalar(1.5 / Math.max(size.x, size.y, size.z));
    // It's already a head model — just centre it in the ring; it turns in place.
    const b = new THREE.Box3().setFromObject(mesh);
    mesh.position.sub(b.getCenter(new THREE.Vector3()));
    mesh.rotation.set(0, Math.PI, 0); // orient the face toward the camera (tunable)
    this.facet(mesh);

    const pivot = new THREE.Group();
    pivot.add(mesh);
    this.disposeModel();
    this.model = pivot;
    this.scene.add(pivot);
  }

  /** nx, ny in [-1, 1] relative to the emblem centre (right/down positive). */
  setPointer(nx: number, ny: number): void {
    const cx = Math.max(-1, Math.min(1, nx));
    const cy = Math.max(-1, Math.min(1, ny));
    this.targetYaw = this.baseYaw + cx * MAX_YAW;
    this.targetPitch = cy * MAX_PITCH;
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (this.model) {
      const k = this.reduced ? 1 : 0.1;
      this.curYaw += (this.targetYaw - this.curYaw) * k;
      this.curPitch += (this.targetPitch - this.curPitch) * k;
      this.model.rotation.set(this.curPitch, this.curYaw, 0);
    }
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    this.disposeModel();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
