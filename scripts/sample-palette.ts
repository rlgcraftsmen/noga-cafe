/**
 * Palette sampler — the palette comes from the client's PHOTOGRAPHS, not from
 * taste. PORTFOLIO's #5 lesson (nook-cafe): the rebuild that finally worked
 * sampled its palette from the client's real photos instead of inventing one.
 * This script mechanizes that:
 *
 *   npm run sample:palette                                  # src/assets/images/
 *   npm run sample:palette -- --file=src/assets/images/hero.jpg
 *   npm run sample:palette -- --dir=path --top=8 --dark --json
 *
 * It extracts dominant colors, assigns voice.palette roles, and auto-nudges
 * lightness until ALL of the same 9 WCAG pairs `npm run validate:content`
 * enforces pass (one shared pair list: scripts/lib/color.ts). Paste the
 * suggested block into business.json's voice.palette and validate.
 *
 * Exit 0 always (it proposes; the validator disposes) — including when no
 * images exist yet.
 */
import { existsSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  contrast,
  contrastPairs,
  hexToHsl,
  hslToHex,
  hueFamily,
  MIN_TEXT_CONTRAST,
  type PaletteLike,
  rgbToHex,
} from "./lib/color";
import { readPortfolio, summarize } from "./lib/divergence";

const args = process.argv.slice(2);
const hasFlag = (name: string): boolean => args.includes(`--${name}`);
const flagValues = (name: string): string[] =>
  args.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3).trim());
const flagValue = (name: string): string | undefined => flagValues(name).at(-1);

const root = fileURLToPath(new URL("..", import.meta.url));
const EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".tif", ".tiff"]);

const files: string[] = [];
const explicit = flagValues("file");
if (explicit.length > 0) {
  for (const f of explicit) {
    const full = join(root, f);
    if (!existsSync(full)) {
      console.error(`✗ --file=${f} does not exist.`);
      process.exit(2);
    }
    files.push(full);
  }
} else {
  const dir = join(root, flagValue("dir") ?? join("src", "assets", "images"));
  if (existsSync(dir)) {
    for (const name of readdirSync(dir)) {
      if (name.startsWith(".") || name.startsWith("og-")) continue;
      if (EXTENSIONS.has(extname(name).toLowerCase())) files.push(join(dir, name));
    }
  }
}

if (files.length === 0) {
  console.log(
    "· no images in src/assets/images/ — sample from the client's photos when they exist;\n" +
      "  an invented palette needs a stated reason in docs/concept.md (PORTFOLIO's #5 lesson).",
  );
  process.exit(0);
}

const top = Number.parseInt(flagValue("top") ?? "6", 10) || 6;
const minShare = Number.parseFloat(flagValue("min-share") ?? "0.02") || 0.02;

/* ── 1. Histogram: 4-bit-per-channel bins, true-color means per bin ───────── */

interface Bin {
  count: number;
  r: number;
  g: number;
  b: number;
}

const bins = new Map<number, Bin>();
let totalWeight = 0;
const lightnessSamples: number[] = [];

for (const file of files) {
  const { data, info } = await sharp(file)
    .rotate()
    .resize(96, 96, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = info.width * info.height;
  if (pixels === 0) continue;
  // Normalize per file so a single large photo can't dominate the histogram.
  const weight = 1 / pixels;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bin.count += weight;
    bin.r += r * weight;
    bin.g += g * weight;
    bin.b += b * weight;
    bins.set(key, bin);
    lightnessSamples.push((Math.max(r, g, b) + Math.min(r, g, b)) / 510);
  }
  totalWeight += 1;
}

interface Candidate {
  hex: string;
  share: number;
  h: number;
  s: number;
  l: number;
}

let candidates: Candidate[] = [...bins.values()]
  .map((bin) => {
    const hex = rgbToHex(bin.r / bin.count, bin.g / bin.count, bin.b / bin.count);
    const { h, s, l } = hexToHsl(hex);
    return { hex, share: bin.count / totalWeight, h, s, l };
  })
  .filter((c) => c.share >= minShare)
  .sort((a, b) => b.share - a.share);

// Merge near-identical candidates (|Δh| < 12°, |Δl| < 0.06) into the larger.
const merged: Candidate[] = [];
for (const c of candidates) {
  const twin = merged.find(
    (m) =>
      Math.abs(m.l - c.l) < 0.06 &&
      (Math.min(Math.abs(m.h - c.h), 360 - Math.abs(m.h - c.h)) < 12 || (m.s < 0.1 && c.s < 0.1)),
  );
  if (twin) twin.share += c.share;
  else merged.push({ ...c });
}
candidates = merged.sort((a, b) => b.share - a.share);

/* ── 2. Role assignment ───────────────────────────────────────────────────── */

lightnessSamples.sort((a, b) => a - b);
const medianL = lightnessSamples[Math.floor(lightnessSamples.length / 2)] ?? 0.5;
const dark = hasFlag("dark") || (!hasFlag("dark") && medianL < 0.35);

const provenance = new Map<string, string>();

function pick(predicate: (c: Candidate) => boolean): Candidate | undefined {
  return candidates.find(predicate);
}

let surface: string;
const surfaceCandidate = dark ? pick((c) => c.l <= 0.22) : pick((c) => c.l >= 0.82);
if (surfaceCandidate) {
  surface = surfaceCandidate.hex;
  provenance.set("surface", `sampled ${surfaceCandidate.hex}, unchanged`);
} else {
  const populous = candidates[0];
  const hue = populous ? populous.h : 40;
  surface = hslToHex(hue, 0.18, dark ? 0.12 : 0.96);
  provenance.set("surface", `synthesized from the dominant hue at l=${dark ? "0.12" : "0.96"}`);
}

const surfaceHsl = hexToHsl(surface);
const inkDirection = dark ? 1 : -1; // dark surface → lighter ink; light → darker

// surfaceAlt: surface shifted 5% toward ink.
const surfaceAlt = hslToHex(
  surfaceHsl.h,
  surfaceHsl.s,
  Math.min(1, Math.max(0, surfaceHsl.l + inkDirection * 0.05)),
);
provenance.set("surfaceAlt", "surface shifted 5% toward ink");

// ink: the extreme-lightness candidate, pushed until ≥7:1 against surface.
const inkCandidate = dark
  ? [...candidates].sort((a, b) => b.l - a.l)[0]
  : [...candidates].sort((a, b) => a.l - b.l)[0];
let ink = inkCandidate?.hex ?? (dark ? "#f2ede4" : "#221812");
provenance.set("ink", inkCandidate ? `sampled ${inkCandidate.hex}` : "default");
{
  let { h, s, l } = hexToHsl(ink);
  let steps = 0;
  while (contrast(ink, surface) < 7 && steps < 40) {
    l = Math.min(1, Math.max(0, l + inkDirection * 0.02));
    ink = hslToHex(h, s, l);
    steps += 1;
  }
  if (steps > 0) provenance.set("ink", `${provenance.get("ink")} → adjusted ${steps * 2}% for 7:1`);
}

// primary/secondary: the two most populous saturated candidates ≥25° apart.
const saturated = candidates.filter((c) => c.s >= 0.25);
let primaryC = saturated[0];
let secondaryC = saturated.find(
  (c) =>
    primaryC !== undefined &&
    c !== primaryC &&
    Math.min(Math.abs(c.h - primaryC.h), 360 - Math.abs(c.h - primaryC.h)) >= 25,
);
if (primaryC && secondaryC && secondaryC.s > primaryC.s) {
  [primaryC, secondaryC] = [secondaryC, primaryC];
}
const primary = primaryC?.hex ?? hslToHex(surfaceHsl.h, 0.45, dark ? 0.7 : 0.35);
provenance.set("primary", primaryC ? `sampled ${primaryC.hex}` : "synthesized from surface hue");
const secondary = secondaryC?.hex ?? ink;
provenance.set("secondary", secondaryC ? `sampled ${secondaryC.hex}` : "fell back to ink");

// accent: highest-chroma candidate furthest in hue from primary.
const primaryHue = hexToHsl(primary).h;
const accentC = [...saturated]
  .filter((c) => c !== primaryC && c !== secondaryC)
  .sort((a, b) => {
    const distA = Math.min(Math.abs(a.h - primaryHue), 360 - Math.abs(a.h - primaryHue));
    const distB = Math.min(Math.abs(b.h - primaryHue), 360 - Math.abs(b.h - primaryHue));
    return distB * b.s - distA * a.s;
  })[0];
const accent = accentC?.hex ?? secondaryC?.hex ?? primary;
provenance.set("accent", accentC ? `sampled ${accentC.hex}, unchanged` : "fell back");

// inkMuted: ink pulled toward surface until it JUST passes 4.5 on both surfaces.
let inkMuted = ink;
{
  const { h, s } = hexToHsl(ink);
  let l = hexToHsl(ink).l;
  let last = inkMuted;
  for (let i = 0; i < 40; i += 1) {
    l = Math.min(1, Math.max(0, l - inkDirection * 0.02));
    const next = hslToHex(h, s, l);
    if (
      contrast(next, surface) < MIN_TEXT_CONTRAST ||
      contrast(next, surfaceAlt) < MIN_TEXT_CONTRAST
    ) {
      break;
    }
    last = next;
  }
  inkMuted = last;
  provenance.set("inkMuted", "ink softened to just-pass 4.5:1 on both surfaces");
}

/* ── 3. Nudge until the SAME 9 pairs validate:content enforces all pass ───── */

const palette: PaletteLike & Record<string, string> = {
  primary,
  secondary,
  accent,
  surface,
  surfaceAlt,
  ink,
  inkMuted,
};

// Which side of each pair is "text" (the side we may nudge).
const TEXT_SIDE: Record<string, keyof typeof palette> = {
  "ink ↔ surface": "ink",
  "ink ↔ surface-alt": "ink",
  "ink-muted ↔ surface": "inkMuted",
  "ink-muted ↔ surface-alt": "inkMuted",
  "primary ↔ surface": "primary",
  "primary ↔ surface-alt": "primary",
  "secondary ↔ surface": "secondary",
  "secondary ↔ surface-alt": "secondary",
  "accent ↔ secondary": "accent",
};

const nudged = new Map<string, number>();
const unresolved: string[] = [];
for (let iteration = 0; iteration < 40; iteration += 1) {
  const failing = contrastPairs(palette)
    .map((pair) => ({ ...pair, ratio: contrast(pair.a, pair.b) }))
    .filter((pair) => pair.ratio < MIN_TEXT_CONTRAST);
  if (failing.length === 0) break;
  const pair = failing[0];
  if (!pair) break;
  const role = TEXT_SIDE[pair.label];
  if (!role) {
    unresolved.push(pair.label);
    break;
  }
  const current = palette[role];
  if (current === undefined) break;
  const { h, s, l } = hexToHsl(current);
  // Push the text side away from its background's lightness.
  const bgLuma = hexToHsl(pair.b === current ? pair.a : pair.b).l;
  const direction = l > bgLuma ? 1 : -1;
  const nextL = Math.min(1, Math.max(0, l + direction * 0.02));
  if (nextL === l) {
    unresolved.push(pair.label);
    break;
  }
  palette[role] = hslToHex(h, s, nextL);
  nudged.set(role, (nudged.get(role) ?? 0) + 2);
  if (iteration === 39) unresolved.push(pair.label);
}

const finalFailing = contrastPairs(palette)
  .map((pair) => ({ ...pair, ratio: contrast(pair.a, pair.b) }))
  .filter((pair) => pair.ratio < MIN_TEXT_CONTRAST);

/* ── 4. Output ────────────────────────────────────────────────────────────── */

const ratios = contrastPairs(palette).map((pair) => ({
  label: pair.label,
  ratio: contrast(pair.a, pair.b),
}));
const minPair = [...ratios].sort((a, b) => a.ratio - b.ratio)[0];

// Divergence cross-check — the sampler must not feed the portfolio's spent
// accent family straight back in (warm photos → warm accent, five times
// running). This line is load-bearing, not polish.
const portfolioPath = join(root, "docs", "portfolio.json");
let accentWarning: string | undefined;
if (existsSync(portfolioPath)) {
  const { entries } = readPortfolio(portfolioPath);
  const family = hueFamily(palette.accent);
  const priorUses = summarize(entries).accentFamilies.get(family) ?? 0;
  if (priorUses > 0) {
    accentWarning =
      `accent hue family "${family}" already appears in docs/portfolio.json (×${priorUses}). ` +
      "Run `npm run validate:divergence -- --summary` before locking the color story.";
  }
}

if (hasFlag("json")) {
  console.log(
    JSON.stringify(
      {
        files: files.length,
        dark,
        candidates: candidates.slice(0, top).map((c) => ({ hex: c.hex, share: c.share })),
        palette,
        contrast: Object.fromEntries(ratios.map((r) => [r.label, Number(r.ratio.toFixed(2))])),
        unresolved: [...new Set(unresolved)],
        accentWarning: accentWarning ?? null,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

console.log(
  `Sampled ${files.length} image(s) (96×96, 4-bit bins) — ${dark ? "dark" : "light"} proposal\n`,
);
console.log(
  `  candidates   ${candidates
    .slice(0, top)
    .map((c) => `${c.hex} ${(c.share * 100).toFixed(0)}%`)
    .join("   ")}\n`,
);
console.log(`  suggested voice.palette (${dark ? "dark" : "light"}):`);
for (const role of ["primary", "secondary", "accent", "surface", "surfaceAlt", "ink", "inkMuted"]) {
  const value = palette[role];
  const note = [
    provenance.get(role),
    nudged.has(role) ? `nudged ${nudged.get(role)}% for contrast` : undefined,
  ]
    .filter(Boolean)
    .join(" → ");
  const familyNote = role === "accent" ? `   hue family: ${hueFamily(value ?? "#000000")}` : "";
  console.log(`    "${role}": "${value}"   ${note}${familyNote}`);
}

if (finalFailing.length > 0) {
  console.log("\n  ! UNRESOLVED contrast pairs (fix by hand before pasting):");
  for (const pair of finalFailing) {
    console.log(`    ${pair.label}: ${pair.ratio.toFixed(2)}:1`);
  }
} else if (minPair) {
  console.log(`\n  all 9 WCAG pairs pass (min ${minPair.ratio.toFixed(2)}:1 — ${minPair.label})`);
}

if (accentWarning) console.log(`\n  ! ${accentWarning}`);
