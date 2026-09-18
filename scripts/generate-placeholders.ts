/**
 * Generates a generic placeholder image starter set for local preview during
 * design work: src/assets/images/{hero,about,gallery-1..6}.png, colored from
 * the client palette in business.json.
 *
 * The skeleton schema ships with no image fields — a per-client build adds
 * fields to business.schema.ts as the design needs them (schema-first, then
 * resolveImage() per docs/RECIPES.md recipe 5) and should rename or replace
 * these files to match whatever names it chooses. This script does NOT write
 * public/og-default.png — that image is owned by scripts/generate-og.ts.
 *
 * Uses sharp, which ships with Astro. Run with: npx tsx scripts/generate-placeholders.ts
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { businessSchema } from "../src/content/business.schema";

const root = fileURLToPath(new URL("..", import.meta.url));
// Real client photos land in src/assets/images/ under these same names —
// an existing file is NEVER overwritten unless --force is passed.
const force = process.argv.includes("--force");

function placeholderSvg(width: number, height: number, from: string, to: string): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${from}"/>
          <stop offset="1" stop-color="${to}"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#g)"/>
      <circle cx="${width * 0.75}" cy="${height * 0.3}" r="${Math.min(width, height) * 0.25}" fill="#ffffff" opacity="0.12"/>
      <circle cx="${width * 0.2}" cy="${height * 0.8}" r="${Math.min(width, height) * 0.35}" fill="#000000" opacity="0.08"/>
    </svg>`,
  );
}

// Placeholders take their colors from the client palette in business.json.
const business = businessSchema.parse(
  JSON.parse(
    readFileSync(join(root, "src/content/business/business.json"), "utf-8").replace(/^﻿/, ""),
  ),
);
const palette = business.voice.palette;

interface Spec {
  path: string;
  width: number;
  height: number;
  from: string;
  to: string;
}

const specs: Spec[] = [
  {
    path: "src/assets/images/hero.png",
    width: 1200,
    height: 900,
    from: palette.primary,
    to: palette.secondary,
  },
  {
    path: "src/assets/images/about.png",
    width: 1000,
    height: 750,
    from: palette.secondary,
    to: palette.primary,
  },
  ...Array.from({ length: 6 }, (_, i) => ({
    path: `src/assets/images/gallery-${i + 1}.png`,
    width: 800,
    height: 800,
    from: i % 2 === 0 ? palette.primary : palette.accent,
    to: palette.secondary,
  })),
];

for (const spec of specs) {
  const target = join(root, spec.path);
  if (!force && existsSync(target)) {
    console.log(`↷ ${spec.path} exists — skipped (pass --force to overwrite placeholders)`);
    continue;
  }
  mkdirSync(dirname(target), { recursive: true });
  const svg = placeholderSvg(spec.width, spec.height, spec.from, spec.to);
  await sharp(svg).png({ compressionLevel: 9 }).toFile(target);
  console.log(`✓ ${spec.path}`);
}
