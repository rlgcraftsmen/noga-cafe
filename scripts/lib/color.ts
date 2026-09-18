/**
 * Shared color math — ONE copy of the WCAG contrast machinery and the
 * hue-family bucketing used across the scripts:
 *
 *   - scripts/validate-content.ts  — enforces the 9-pair palette contract
 *   - scripts/sample-palette.ts    — proposes palettes pre-checked on the SAME pairs
 *   - scripts/lib/divergence.ts    — compares accent hue families across shipped sites
 *
 * New color-as-text usage in a client build → add the pair to contrastPairs()
 * HERE (see AGENTS.md → Palette contract) — the validator and the sampler
 * both pick it up automatically.
 */

export const MIN_TEXT_CONTRAST = 4.5; // WCAG AA, normal text

/** "#ABC" / "#AaBbCc" → "#aabbcc". Throws on anything that isn't a hex color. */
export function normalizeHex(hex: string): string {
  const trimmed = hex.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(trimmed)) return trimmed;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(trimmed);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  throw new Error(`Not a hex color: "${hex}"`);
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex);
  return [
    Number.parseInt(h.slice(1, 3), 16),
    Number.parseInt(h.slice(3, 5), 16),
    Number.parseInt(h.slice(5, 7), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const channel = (v: number): string =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** h ∈ [0,360), s ∈ [0,1], l ∈ [0,1]. */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r8, g8, b8] = hexToRgb(hex);
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

export function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = ((h % 360) + 360) % 360;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb: [number, number, number];
  if (hh < 60) rgb = [c, x, 0];
  else if (hh < 120) rgb = [x, c, 0];
  else if (hh < 180) rgb = [0, c, x];
  else if (hh < 240) rgb = [0, x, c];
  else if (hh < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return rgbToHex((rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255);
}

/*
 * Hue families — the buckets the divergence check compares accents on.
 * A family is deliberately coarser than a hex: "#d9a441 and #e09a2e are both
 * amber-gold" is exactly the judgment the portfolio's sameness post-mortem
 * made by eye ("all four chose a gold/amber accent").
 *
 * The amber-gold/yellow boundary sits at 52° ON PURPOSE: under-the-tree's
 * accent #a99841 is at hue 50.2°, and the portfolio's own reading counts it
 * in the gold/amber 4-of-4 — a boundary at 50 would silently flip that
 * verdict. Don't "clean this up" to a round number.
 */
export type HueFamily =
  | "neutral"
  | "red"
  | "rust-orange"
  | "amber-gold"
  | "yellow"
  | "lime"
  | "green"
  | "teal"
  | "cyan"
  | "blue"
  | "indigo-violet"
  | "purple-magenta"
  | "pink";

export const HUE_FAMILIES: ReadonlyArray<{ name: HueFamily; from: number; to: number }> = [
  { name: "red", from: 345, to: 360 },
  { name: "red", from: 0, to: 15 },
  { name: "rust-orange", from: 15, to: 30 },
  { name: "amber-gold", from: 30, to: 52 }, // 52: see the boundary note above
  { name: "yellow", from: 52, to: 70 },
  { name: "lime", from: 70, to: 100 },
  { name: "green", from: 100, to: 150 },
  { name: "teal", from: 150, to: 180 },
  { name: "cyan", from: 180, to: 200 },
  { name: "blue", from: 200, to: 250 },
  { name: "indigo-violet", from: 250, to: 285 },
  { name: "purple-magenta", from: 285, to: 320 },
  { name: "pink", from: 320, to: 345 },
];

/** Desaturated colors have no meaningful hue — they compare as "neutral". */
const NEUTRAL_SATURATION = 0.15;

export function hueFamily(hex: string): HueFamily {
  const { h, s } = hexToHsl(hex);
  if (s < NEUTRAL_SATURATION) return "neutral";
  const bucket = HUE_FAMILIES.find((f) => h >= f.from && h < f.to);
  return bucket?.name ?? "red"; // h === 360 is unreachable, but keep TS honest
}

export function luminance(hex: string): number {
  const h = normalizeHex(hex);
  const channel = (i: number): number => {
    const c = Number.parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Structural palette shape so sampler candidates validate the same way the
 *  real voice.palette does. `line` is border-only decoration — never checked. */
export interface PaletteLike {
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  inkMuted: string;
  line?: string;
}

export interface ContrastPair {
  label: string;
  a: string;
  b: string;
  usage: string;
}

/**
 * The 9 text pairs the template actually uses (AGENTS.md → Palette contract).
 * validate-content.ts fails the build on any pair under MIN_TEXT_CONTRAST;
 * sample-palette.ts auto-nudges its proposals until every pair passes.
 */
export function contrastPairs(p: PaletteLike): ContrastPair[] {
  return [
    { label: "ink ↔ surface", a: p.ink, b: p.surface, usage: "body copy on the base background" },
    {
      label: "ink ↔ surface-alt",
      a: p.ink,
      b: p.surfaceAlt,
      usage: "body copy on alternate sections",
    },
    { label: "ink-muted ↔ surface", a: p.inkMuted, b: p.surface, usage: "muted/secondary text" },
    {
      label: "ink-muted ↔ surface-alt",
      a: p.inkMuted,
      b: p.surfaceAlt,
      usage: "muted text on alternate sections",
    },
    {
      label: "primary ↔ surface",
      a: p.primary,
      b: p.surface,
      usage: "links/prices on base bg; surface text on primary buttons",
    },
    {
      label: "primary ↔ surface-alt",
      a: p.primary,
      b: p.surfaceAlt,
      usage: "primary-colored text on alternate sections",
    },
    {
      label: "secondary ↔ surface",
      a: p.secondary,
      b: p.surface,
      usage:
        "headings on base bg; symmetric, so also covers text-surface on bg-secondary (footer, skip link)",
    },
    {
      label: "secondary ↔ surface-alt",
      a: p.secondary,
      b: p.surfaceAlt,
      usage: "headings/labels on alternate bg",
    },
    {
      label: "accent ↔ secondary",
      a: p.accent,
      b: p.secondary,
      usage: "CTA button text on accent bg",
    },
  ];
}

export function failingPairs(p: PaletteLike): Array<ContrastPair & { ratio: number }> {
  return contrastPairs(p)
    .map((pair) => ({ ...pair, ratio: contrast(pair.a, pair.b) }))
    .filter((pair) => pair.ratio < MIN_TEXT_CONTRAST);
}
