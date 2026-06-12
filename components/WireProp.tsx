"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Small wireframe props in the hero diorama's drafting style — ink edges,
 * porcelain faces, a patch of grid floor, gentle sway. Used to carry the
 * 3D language into the sections below the fold.
 *
 * The builders are exported so multi-prop scenes (e.g. the dossier
 * exhibit case) can compose them in a single canvas.
 * `tone="porcelain"` inverts the palette for dark (ink) backgrounds.
 */

export type WireKind =
  | "document"
  | "monitor"
  | "dial"
  | "desk"
  | "magnifier"
  | "scale"
  | "stairs"
  | "pencil";
export type WireTone = "ink" | "porcelain";

export const WIRE_PALETTE = {
  ink: {
    line: 0x1a1d29,
    muted: 0x9a9ca6,
    face: 0xfafaf8,
    gridMajor: 0xd8d8d4,
    gridMinor: 0xe6e6e2,
  },
  porcelain: {
    line: 0xfafaf8,
    muted: 0x6b6e7a,
    face: 0x1a1d29,
    gridMajor: 0x3a3d4a,
    gridMinor: 0x2a2d3a,
  },
} as const;

export const WIRE_CAMERA: Record<
  WireKind,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  document: { pos: [2.2, 1.5, 2.8], target: [0, 0.75, 0] },
  monitor: { pos: [2.4, 1.5, 2.9], target: [0, 0.65, 0] },
  dial: { pos: [2.3, 1.5, 2.9], target: [0, 0.75, 0] },
  desk: { pos: [3.4, 2.4, 3.9], target: [0, 0.75, 0] },
  magnifier: { pos: [2.3, 1.7, 2.9], target: [0, 0.5, 0] },
  scale: { pos: [2.5, 1.7, 3.1], target: [0, 0.7, 0] },
  stairs: { pos: [2.6, 1.8, 3.1], target: [0, 0.55, 0] },
  pencil: { pos: [2.3, 1.7, 2.9], target: [0, 0.45, 0] },
};

export interface WireMats {
  line: THREE.LineBasicMaterial;
  dashed: THREE.LineDashedMaterial;
  face: THREE.MeshBasicMaterial;
}

export function createWireMats(tone: WireTone): WireMats {
  const colors = WIRE_PALETTE[tone];
  return {
    line: new THREE.LineBasicMaterial({ color: colors.line }),
    dashed: new THREE.LineDashedMaterial({
      color: colors.muted,
      dashSize: 0.1,
      gapSize: 0.06,
      transparent: true,
      opacity: 0.55,
    }),
    face: new THREE.MeshBasicMaterial({
      color: colors.face,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
  };
}

export function disposeWireMats(mats: WireMats) {
  mats.line.dispose();
  mats.dashed.dispose();
  mats.face.dispose();
}

export function buildWireProp(kind: WireKind, mats: WireMats): THREE.Group {
  const prop = new THREE.Group();

  function wired(geo: THREE.BufferGeometry) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, mats.face));
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), mats.line));
    return g;
  }

  function dashedCircle(radius: number, y: number) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius));
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mats.dashed);
    line.computeLineDistances();
    return line;
  }

  function paperSheet() {
    // a posting/resume lying flat with printed lines
    const sheet = wired(new THREE.BoxGeometry(1.15, 0.04, 0.8));
    sheet.position.y = 0.04;
    sheet.rotation.y = 0.15;
    prop.add(sheet);
    for (let i = 0; i < 3; i++) {
      const seg = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.4, 0.065, -0.2 + i * 0.18),
        new THREE.Vector3(0.35 - (i % 2) * 0.2, 0.065, -0.2 + i * 0.18),
      ]);
      const line = new THREE.Line(seg, mats.line);
      line.rotation.y = 0.15;
      prop.add(line);
    }
  }

  if (kind === "document") {
    // a resume sheet, slightly tilted, with printed lines
    const sheet = wired(new THREE.BoxGeometry(1.05, 1.45, 0.05));
    sheet.position.y = 0.78;
    sheet.rotation.y = -0.25;
    prop.add(sheet);
    for (let i = 0; i < 5; i++) {
      const w = i === 0 ? 0.5 : 0.7 - (i % 2) * 0.12;
      const y = 1.25 - i * 0.2;
      const seg = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.38, y, 0.035),
        new THREE.Vector3(-0.38 + w, y, 0.035),
      ]);
      const line = new THREE.Line(seg, mats.line);
      line.rotation.y = -0.25;
      prop.add(line);
    }
    prop.add(dashedCircle(0.95, 0.03));
  }

  if (kind === "monitor") {
    // the hero's floating monitor, landed on a stand
    const screen = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.5, 0.9)),
      mats.line
    );
    screen.position.y = 1.0;
    screen.rotation.y = -0.2;
    prop.add(screen);
    const stand = wired(new THREE.BoxGeometry(0.07, 0.45, 0.07));
    stand.position.y = 0.28;
    prop.add(stand);
    const base = wired(new THREE.BoxGeometry(0.55, 0.05, 0.3));
    base.position.y = 0.03;
    prop.add(base);
    prop.add(dashedCircle(1.0, 0.03));
  }

  if (kind === "dial") {
    // the fit-score gauge as a standing instrument
    const face = new THREE.Group();
    const ringPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0));
    }
    face.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), mats.line));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const seg = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0),
        new THREE.Vector3(Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0),
      ]);
      face.add(new THREE.Line(seg, mats.line));
    }
    // needle parked at ~4.2 of 5
    const needleAngle = Math.PI * (1.1 - 1.2 * (4.2 / 5));
    const needle = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0.01),
        new THREE.Vector3(Math.cos(needleAngle) * 0.46, Math.sin(needleAngle) * 0.46, 0.01),
      ]),
      mats.line
    );
    face.add(needle);
    face.position.y = 0.85;
    face.rotation.y = -0.2;
    prop.add(face);
    const stand = wired(new THREE.BoxGeometry(0.07, 0.3, 0.07));
    stand.position.y = 0.12;
    prop.add(stand);
    prop.add(dashedCircle(0.9, 0.03));
  }

  if (kind === "magnifier") {
    // Aura reading a posting: a lens hovering over the sheet
    paperSheet();
    const lens = new THREE.Group();
    const ringPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42));
    }
    lens.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), mats.line));
    const handle = wired(new THREE.BoxGeometry(0.07, 0.55, 0.07));
    handle.position.set(0.62, 0.28, 0);
    handle.rotation.z = 0.6;
    lens.add(handle);
    lens.position.y = 0.72;
    lens.rotation.x = -0.18;
    lens.rotation.z = -0.12;
    prop.add(lens);
    // sight line from lens centre to the sheet
    const sight = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.7, 0),
        new THREE.Vector3(0, 0.07, 0),
      ]),
      mats.dashed
    );
    sight.computeLineDistances();
    prop.add(sight);
    prop.add(dashedCircle(0.95, 0.03));
  }

  if (kind === "scale") {
    // judgment: a balance tipped toward the better offer
    const base = wired(new THREE.BoxGeometry(0.55, 0.06, 0.32));
    base.position.y = 0.03;
    prop.add(base);
    const post = wired(new THREE.BoxGeometry(0.07, 1.1, 0.07));
    post.position.y = 0.6;
    prop.add(post);

    const beamGroup = new THREE.Group();
    beamGroup.position.y = 1.18;
    const beam = wired(new THREE.BoxGeometry(1.5, 0.05, 0.07));
    beamGroup.add(beam);
    ([-0.7, 0.7] as const).forEach((x) => {
      const drop = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, 0, 0),
          new THREE.Vector3(x, -0.38, 0),
        ]),
        mats.dashed
      );
      drop.computeLineDistances();
      beamGroup.add(drop);
      const panPts: THREE.Vector3[] = [];
      for (let i = 0; i <= 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        panPts.push(new THREE.Vector3(x + Math.cos(a) * 0.24, -0.38, Math.sin(a) * 0.24));
      }
      beamGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(panPts), mats.line));
    });
    beamGroup.rotation.z = 0.09;
    prop.add(beamGroup);
    prop.add(dashedCircle(1.0, 0.03));
  }

  if (kind === "stairs") {
    // level strategy: three ascending blocks with a dashed trajectory
    const heights = [0.3, 0.62, 0.95];
    heights.forEach((h, i) => {
      const block = wired(new THREE.BoxGeometry(0.5, h, 0.5));
      block.position.set(-0.58 + i * 0.58, h / 2, 0);
      prop.add(block);
    });
    const path = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.58, 0.42, 0),
        new THREE.Vector3(0, 0.74, 0),
        new THREE.Vector3(0.58, 1.07, 0),
        new THREE.Vector3(0.95, 1.28, 0),
      ]),
      mats.dashed
    );
    path.computeLineDistances();
    prop.add(path);
    prop.add(dashedCircle(1.05, 0.03));
  }

  if (kind === "pencil") {
    // resume edits: a pencil mid-stroke on the sheet
    paperSheet();
    const pencil = new THREE.Group();
    const body = wired(new THREE.BoxGeometry(0.09, 0.85, 0.09));
    body.position.y = 0.62;
    pencil.add(body);
    const tip = wired(new THREE.ConeGeometry(0.065, 0.2, 4));
    tip.rotation.x = Math.PI;
    tip.position.y = 0.1;
    pencil.add(tip);
    pencil.position.set(0.28, 0.05, 0.08);
    pencil.rotation.z = -0.5;
    pencil.rotation.x = 0.15;
    prop.add(pencil);
    // the stroke being drawn
    const stroke = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.35, 0.07, 0.18),
        new THREE.Vector3(0.18, 0.07, 0.14),
      ]),
      mats.dashed
    );
    stroke.computeLineDistances();
    prop.add(stroke);
    prop.add(dashedCircle(0.95, 0.03));
  }

  if (kind === "desk") {
    // the hero diorama in miniature: desk, legs, twin monitors
    const top = wired(new THREE.BoxGeometry(2.2, 0.07, 1.05));
    top.position.y = 1.0;
    prop.add(top);
    (
      [
        [-1.0, 0.5, -0.45],
        [1.0, 0.5, -0.45],
        [-1.0, 0.5, 0.45],
        [1.0, 0.5, 0.45],
      ] as const
    ).forEach((pos) => {
      const leg = wired(new THREE.BoxGeometry(0.07, 1.0, 0.07));
      leg.position.set(pos[0], pos[1], pos[2]);
      prop.add(leg);
    });
    const monGeo = new THREE.PlaneGeometry(0.95, 0.55);
    const m1 = new THREE.LineSegments(new THREE.EdgesGeometry(monGeo), mats.line);
    m1.position.set(-0.52, 1.62, -0.3);
    m1.rotation.y = 0.35;
    prop.add(m1);
    const m2 = new THREE.LineSegments(new THREE.EdgesGeometry(monGeo), mats.line);
    m2.position.set(0.52, 1.62, -0.3);
    m2.rotation.y = -0.35;
    prop.add(m2);
    prop.add(dashedCircle(1.55, 0.03));
  }

  return prop;
}

export function disposeWireScene(scene: THREE.Scene) {
  scene.traverse((obj) => {
    if (
      obj instanceof THREE.Mesh ||
      obj instanceof THREE.LineSegments ||
      obj instanceof THREE.Line
    ) {
      obj.geometry.dispose();
    }
  });
}

export default function WireProp({
  kind,
  height = 140,
  className,
  tone = "ink",
}: {
  kind: WireKind;
  height?: number;
  className?: string;
  tone?: WireTone;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    const colors = WIRE_PALETTE[tone];
    const scene = new THREE.Scene();
    const cam = WIRE_CAMERA[kind];
    const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 100);
    camera.position.set(...cam.pos);
    camera.lookAt(...cam.target);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // CSS owns the layout size so grid cells can shrink the canvas freely
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    el.appendChild(renderer.domElement);

    const mats = createWireMats(tone);

    const grid = new THREE.GridHelper(2.6, 6, colors.gridMajor, colors.gridMinor);
    grid.position.y = -0.01;
    scene.add(grid);

    const prop = buildWireProp(kind, mats);
    scene.add(prop);

    function resize() {
      const w = el!.clientWidth || 1;
      const h = el!.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const phase = Math.random() * Math.PI * 2; // desync siblings
    let raf = 0;

    function frame() {
      raf = requestAnimationFrame(frame);
      const t = Date.now() * 0.001 + phase;
      prop.rotation.y = Math.sin(t * 0.4) * (kind === "desk" ? 0.12 : 0.22);
      prop.position.y = Math.sin(t * 0.8) * 0.02;
      renderer.render(scene, camera);
    }

    // only animate while on screen
    const io = new IntersectionObserver(([entry]) => {
      if (reducedMotion) {
        renderer.render(scene, camera);
        return;
      }
      if (entry.isIntersecting && !raf) frame();
      if (!entry.isIntersecting && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(el);

    if (reducedMotion) renderer.render(scene, camera);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      disposeWireScene(scene);
      disposeWireMats(mats);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
    // kind/tone are fixed per placement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={container}
      className={className}
      style={{ height, width: "100%" }}
      aria-hidden="true"
    />
  );
}
