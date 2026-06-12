"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Wireframe workspace diorama behind the hero: a desk, two floating
 * monitors, a dashed calibration volume, and a radar-style scan that
 * sweeps the floor — the "Aura reading a workspace" metaphor.
 * Ink lines on porcelain, iris for the scan. Reduced motion gets a
 * single static frame.
 */

const INK = 0x1a1d29;
const INK_MUTED = 0x9a9ca6;
const GRID_MAJOR = 0xd8d8d4;
const GRID_MINOR = 0xe6e6e2;
// iris #4e3fd8
const SCAN_RGB: [number, number, number] = [78, 63, 216];

export default function HeroScene() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 1000);
    camera.position.set(16, 12, 20);
    camera.lookAt(0, 1.5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    const lineMaterial = new THREE.LineBasicMaterial({ color: INK });
    const dashedMaterial = new THREE.LineDashedMaterial({
      color: INK_MUTED,
      dashSize: 0.2,
      gapSize: 0.1,
      transparent: true,
      opacity: 0.5,
    });
    // porcelain faces hide lines behind solids, like a blueprint model
    const solidMaterial = new THREE.MeshBasicMaterial({
      color: 0xfafaf8,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });

    function createWiredMesh(geometry: THREE.BufferGeometry) {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(geometry, solidMaterial));
      group.add(
        new THREE.LineSegments(new THREE.EdgesGeometry(geometry), lineMaterial)
      );
      return group;
    }

    const grid = new THREE.GridHelper(30, 30, GRID_MAJOR, GRID_MINOR);
    grid.position.y = -0.01;
    scene.add(grid);

    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // desk
    const deskGroup = new THREE.Group();
    const deskTop = createWiredMesh(new THREE.BoxGeometry(5, 0.15, 2.5));
    deskTop.position.y = 2.5;
    deskGroup.add(deskTop);

    const legPositions: [number, number, number][] = [
      [-2.3, 1.25, -1.1],
      [2.3, 1.25, -1.1],
      [-2.3, 1.25, 1.1],
      [2.3, 1.25, 1.1],
    ];
    legPositions.forEach((pos) => {
      const leg = createWiredMesh(new THREE.BoxGeometry(0.15, 2.5, 0.15));
      leg.position.set(...pos);
      deskGroup.add(leg);
    });

    // floating monitors
    const monitorGeo = new THREE.PlaneGeometry(2.4, 1.4);
    const mon1 = new THREE.LineSegments(
      new THREE.EdgesGeometry(monitorGeo),
      lineMaterial
    );
    mon1.position.set(-1.3, 4.0, -0.8);
    mon1.rotation.y = 0.4;
    deskGroup.add(mon1);

    const mon2 = new THREE.LineSegments(
      new THREE.EdgesGeometry(monitorGeo),
      lineMaterial
    );
    mon2.position.set(1.3, 4.0, -0.8);
    mon2.rotation.y = -0.4;
    deskGroup.add(mon2);

    worldGroup.add(deskGroup);

    // wavy floor boundary
    const points: THREE.Vector3[] = [];
    const radius = 5.5;
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const r = radius + Math.sin(a * 4) * 0.4 + Math.cos(a * 7) * 0.2;
      points.push(new THREE.Vector3(Math.cos(a) * r, 0.05, Math.sin(a) * r));
    }
    const boundaryLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      dashedMaterial
    );
    boundaryLine.computeLineDistances();
    worldGroup.add(boundaryLine);

    // dashed calibration volume
    const volumeBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(7, 5.5, 6)),
      dashedMaterial
    );
    volumeBox.position.y = 2.75;
    volumeBox.computeLineDistances();
    worldGroup.add(volumeBox);

    // corner sensors with drop lines
    const sensorGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    const sensorLocs: [number, number, number][] = [
      [-3.5, 5.5, -3],
      [3.5, 5.5, -3],
      [-3.5, 5.5, 3],
      [3.5, 5.5, 3],
    ];
    sensorLocs.forEach((pos) => {
      const sensor = createWiredMesh(sensorGeo);
      sensor.position.set(...pos);
      worldGroup.add(sensor);

      const dropLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(...pos),
          new THREE.Vector3(pos[0], 0, pos[2]),
        ]),
        dashedMaterial
      );
      dropLine.computeLineDistances();
      worldGroup.add(dropLine);
    });

    // radar scan sweeping the floor, drawn on a coarse pixel texture
    const pixelGridSize = 16;
    const pixelData = new Uint8Array(pixelGridSize * pixelGridSize * 4);
    const pixelTexture = new THREE.DataTexture(
      pixelData,
      pixelGridSize,
      pixelGridSize
    );
    pixelTexture.minFilter = THREE.NearestFilter;
    pixelTexture.magFilter = THREE.NearestFilter;

    const pixelPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30, pixelGridSize, pixelGridSize),
      new THREE.MeshBasicMaterial({
        map: pixelTexture,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      })
    );
    pixelPlane.rotation.x = -Math.PI / 2;
    pixelPlane.position.y = 0.01;
    scene.add(pixelPlane);

    let scanRow = 0;
    let scanDirection = 1;

    function drawScan() {
      const centerX = 8;
      const centerY = 8;
      for (let x = 0; x < pixelGridSize; x++) {
        for (let y = 0; y < pixelGridSize; y++) {
          const idx = (y * pixelGridSize + x) * 4;
          const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
          if (dist <= scanRow) {
            const intensity = 1 - dist / scanRow;
            pixelData[idx] = SCAN_RGB[0];
            pixelData[idx + 1] = SCAN_RGB[1];
            pixelData[idx + 2] = SCAN_RGB[2];
            pixelData[idx + 3] = Math.floor(intensity * 180);
          } else if (dist <= scanRow + 2) {
            const fade = 1 - (dist - scanRow) / 2;
            pixelData[idx] = SCAN_RGB[0];
            pixelData[idx + 1] = SCAN_RGB[1];
            pixelData[idx + 2] = SCAN_RGB[2];
            pixelData[idx + 3] = Math.floor(fade * 60);
          } else {
            pixelData[idx + 3] = 0;
          }
        }
      }
      pixelTexture.needsUpdate = true;
    }

    function resize() {
      const { clientWidth: w, clientHeight: h } = el!;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let raf = 0;
    function animate() {
      raf = requestAnimationFrame(animate);

      const time = Date.now() * 0.001;
      mon1.position.y = 4.0 + Math.sin(time * 0.8) * 0.03;
      mon2.position.y = 4.0 + Math.sin(time * 0.8 + 0.5) * 0.03;
      worldGroup.rotation.y = Math.sin(time * 0.1) * 0.05;

      drawScan();
      scanRow += scanDirection * 0.075;
      if (scanRow >= 11 || scanRow < 0) {
        scanDirection *= -1;
        scanRow += scanDirection * 0.3;
      }

      renderer.render(scene, camera);
    }

    if (reducedMotion) {
      scanRow = 6;
      drawScan();
      renderer.render(scene, camera);
    } else {
      animate();
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Line) {
          obj.geometry.dispose();
        }
      });
      lineMaterial.dispose();
      dashedMaterial.dispose();
      solidMaterial.dispose();
      pixelTexture.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="hero-scene" ref={container} aria-hidden="true" />;
}
