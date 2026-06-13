#!/usr/bin/env node
/**
 * Packages the extension into a Chrome Web Store-ready zip.
 * Usage: node extension/build-zip.mjs   (run from repo root or anywhere)
 *
 * Bundles only the files the extension ships — source dirs, the manifest, and
 * icons — and writes dist/aura-talent-companion-<version>.zip.
 */
import { execSync } from "node:child_process";
import { readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const extDir = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(extDir, "manifest.json"), "utf8"));
const version = manifest.version;

const distDir = resolve(extDir, "dist");
const zipPath = resolve(distDir, `aura-talent-companion-${version}.zip`);

// Everything that must be inside the package (relative to extension/).
const INCLUDE = ["manifest.json", "background", "content", "icons", "lib", "options", "popup"];

if (existsSync(zipPath)) rmSync(zipPath);
mkdirSync(distDir, { recursive: true });

// -r recurse, -X strip extra file attrs, exclude macOS cruft.
const cmd = `cd "${extDir}" && zip -r -X "${zipPath}" ${INCLUDE.join(" ")} -x "*.DS_Store" "dist/*"`;
execSync(cmd, { stdio: "inherit" });

console.log(`\n✅ Packaged v${version} → ${zipPath}`);
console.log("   Upload this zip at https://chrome.google.com/webstore/devconsole");
