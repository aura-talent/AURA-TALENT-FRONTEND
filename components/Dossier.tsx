"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import Reveal from "@/components/Reveal";
import {
  buildWireProp,
  createWireMats,
  disposeWireMats,
  disposeWireScene,
  WIRE_PALETTE,
  type WireKind,
} from "@/components/WireProp";

/**
 * The report section as an exhibit case: hovering a dossier row swaps the
 * wireframe model in the sticky column to the block's instrument, with a
 * placard label to match. All models live in one canvas; swaps pop in.
 */

const DEFAULT_EXHIBIT = {
  kind: "desk" as WireKind,
  tag: "WORKSPACE_MODEL [B_01] // FURNITURE_MESH",
};

const BLOCKS: {
  letter: string;
  title: string;
  body: string;
  kind: WireKind;
  tag: string;
}[] = [
    {
      letter: "A",
      title: "Role summary",
      body: "What this job actually is — archetype, seniority, remote policy, one-line truth.",
      kind: "monitor",
      tag: "EXHIBIT_A // ROLE_FEED",
    },
    {
      letter: "B",
      title: "Resume match",
      body: "Every requirement mapped to evidence in your resume, gaps named with a fix for each.",
      kind: "document",
      tag: "EXHIBIT_B // RESUME_MESH",
    },
    {
      letter: "C",
      title: "Level strategy",
      body: "Their level vs. yours, and how to present senior without overstating anything.",
      kind: "stairs",
      tag: "EXHIBIT_C // LEVEL_MAP",
    },
    {
      letter: "D",
      title: "Compensation",
      body: "What the posting says against what the market pays, stated plainly when data is thin.",
      kind: "scale",
      tag: "EXHIBIT_D // COMP_BALANCE",
    },
    {
      letter: "E",
      title: "Resume edits",
      body: "The five changes that most move your match for this specific job.",
      kind: "pencil",
      tag: "EXHIBIT_E // EDIT_PASS",
    },
    {
      letter: "F",
      title: "Interview plan",
      body: "Your stories mapped to their requirements, plus the awkward questions and good answers.",
      kind: "desk",
      tag: "EXHIBIT_F // INTERVIEW_RIG",
    },
    {
      letter: "G",
      title: "Posting legitimacy",
      body: "Freshness, specificity, reposting patterns — is this opening real or a pipeline ad?",
      kind: "magnifier",
      tag: "EXHIBIT_G // LEGIT_SCAN",
    },
  ];

// the desk reads larger than the single-object props
const KIND_SCALE: Partial<Record<WireKind, number>> = {
  desk: 0.92,
  monitor: 1.05,
  document: 1.05,
  stairs: 1,
  scale: 1,
  pencil: 1.1,
  magnifier: 1.05,
};

function ExhibitCase({ active }: { active: WireKind }) {
  const container = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const renderOnce = useRef<(() => void) | null>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    const colors = WIRE_PALETTE.ink;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 100);
    camera.position.set(4.3, 3.1, 5.0);
    camera.lookAt(0, 0.85, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    el.appendChild(renderer.domElement);

    const mats = createWireMats("ink");
    const grid = new THREE.GridHelper(2.8, 6, colors.gridMajor, colors.gridMinor);
    grid.position.y = -0.01;
    scene.add(grid);

    // every exhibit is built once; hover just toggles visibility
    const kinds = Array.from(new Set<WireKind>([DEFAULT_EXHIBIT.kind, ...BLOCKS.map((b) => b.kind)]));
    const props = new Map<WireKind, THREE.Group>();
    kinds.forEach((k) => {
      const g = buildWireProp(k, mats);
      g.visible = false;
      scene.add(g);
      props.set(k, g);
    });

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

    let shown: WireKind = activeRef.current;
    let pop = 1; // 0→1 entrance progress for the current exhibit
    let last = performance.now();
    let raf = 0;

    function renderFrame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (activeRef.current !== shown) {
        shown = activeRef.current;
        pop = 0;
      }
      pop = Math.min(1, pop + dt * 3.5);
      const eased = 1 - (1 - pop) * (1 - pop); // easeOutQuad

      const t = now * 0.001;
      props.forEach((g, k) => {
        g.visible = k === shown;
        if (k === shown) {
          const s = (0.7 + 0.3 * eased) * (KIND_SCALE[k] ?? 1.1);
          g.scale.setScalar(s);
          g.rotation.y = Math.sin(t * 0.4) * 0.14 + (1 - eased) * 0.5;
          g.position.y = Math.sin(t * 0.8) * 0.02;
        }
      });
      renderer.render(scene, camera);
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      renderFrame(now);
    }

    const io = new IntersectionObserver(([entry]) => {
      if (reducedMotion) {
        renderFrame(performance.now());
        return;
      }
      if (entry.isIntersecting && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
      if (!entry.isIntersecting && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(el);

    renderOnce.current = () => {
      pop = 1; // no entrance animation for static renders
      renderFrame(performance.now());
    };
    if (reducedMotion) renderOnce.current();

    return () => {
      renderOnce.current = null;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      disposeWireScene(scene);
      disposeWireMats(mats);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
    // scene is built once; `active` flows in via activeRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reduced-motion users still get the swap, just as a static re-render
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      renderOnce.current?.();
    }
  }, [active]);

  return <div ref={container} style={{ height: 340, width: "100%" }} aria-hidden="true" />;
}

export default function Dossier() {
  const [hovered, setHovered] = useState<number | null>(null);
  const exhibit = hovered === null ? DEFAULT_EXHIBIT : BLOCKS[hovered];

  return (
    <section className="section" id="report">
      <div className="container dossier">
        <div className="dossier-intro">
          <div className="section-kicker">(03) // THE_REPORT</div>
          <h2>Seven blocks. The whole picture.</h2>
          <p className="section-lede">
            Every evaluation is a full dossier — the same structure a careful
            career coach would build, in about a minute.
          </p>
          <Link href="/evaluate" className="btn btn-ghost">
            Run one on a real job
          </Link>
          <div className="dossier-prop">
            <ExhibitCase active={exhibit.kind} />
            <span className="dossier-prop-label">{exhibit.tag}</span>
          </div>
        </div>
        <Reveal className="dossier-index" variant="row">
          <span className="rule" data-reveal-line />
          {BLOCKS.map((b, i) => (
            <div
              className="dossier-row"
              key={b.letter}
              data-reveal
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="dossier-letter" aria-hidden="true">
                {b.letter}
              </span>
              <div>
                <h3>{b.title}</h3>
                <p>{b.body}</p>
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
