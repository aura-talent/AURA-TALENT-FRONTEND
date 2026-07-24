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
    niche: "Thrives on purpose-driven work — mission first, always.",
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
