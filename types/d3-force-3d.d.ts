// Deliberately loose — upstream ships no types and every builder is chainable.
// This .d.ts is the one sanctioned `any` zone in the feature.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "d3-force-3d" {
  export function forceSimulation(nodes: any[], numDimensions?: number): any;
  export function forceLink(links: any[]): any;
  export function forceManyBody(): any;
  export function forceCollide(radius: number): any;
}
