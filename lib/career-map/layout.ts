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
    .force("link", forceLink(simLinks).id((d: any) => d.id as string).distance(RING * 0.9))
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
