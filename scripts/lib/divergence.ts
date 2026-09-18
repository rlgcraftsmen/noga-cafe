/**
 * Divergence checking — the anti-sameness rules, mechanized.
 *
 * Why this exists (measured, not felt): each client build runs in a fresh
 * repo with no memory of the others, and across the first four shipped
 * builds the model's stable taste chose the same metaphor family 3 times,
 * the same font pairing 3 times, and a gold/amber accent 4 times — while
 * every build's own review scored it "distinctive". Prose rules did not
 * stop this; docs/PORTFOLIO.md tells the story. These functions are the
 * rules as code: a colliding concept FAILS before any page code is written.
 *
 * Pure logic — parsing, comparison, summarizing. No process.exit, no
 * console: scripts/validate-divergence.ts is the CLI, scripts/preflight.ts
 * imports checkDivergence() for a warn-only pass, and tests exercise these
 * functions directly on inline strings.
 *
 * The fingerprint lives in the CLIENT repo's docs/concept.md as a fenced
 * block (info string "json fingerprint"); shipped-site fingerprints live in
 * the template's docs/portfolio.json. Format spec: docs/PORTFOLIO.md →
 * Fingerprint format.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { hueFamily } from "./color";

/** The 15 design.fontPairing keys (astro.config.mjs registers them). */
export const FONT_PAIRINGS = [
  "classic",
  "modern",
  "elegant",
  "warm",
  "bold",
  "editorial",
  "playful",
  "rounded",
  "impact",
  "poster",
  "refined",
  "techsans",
  "serifnote",
  "retro",
  "handmade",
] as const;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

export interface ArguesEntry {
  against: string;
  axis: "metaphorFamily" | "fontPairing+accent" | "pageForm";
  why: string;
}

export interface Fingerprint {
  client: string;
  date?: string;
  businessType?: string;
  metaphorFamily: string;
  metaphorNote?: string;
  pageForm: string;
  paletteFamily?: string;
  accentHex: string;
  fontPairing: string;
  signature?: string;
  motionIdentity?: string;
  furniture?: string[];
  argues?: ArguesEntry[];
}

export interface PortfolioEntry {
  client: string;
  date: string;
  businessType: string;
  metaphorFamily: string;
  metaphorNote?: string;
  pageForm: string;
  paletteFamily?: string;
  accentHex: string;
  accentHexAlt?: string;
  fontPairing: string;
  signature?: string;
  motionIdentity?: string;
  furniture?: string[];
  screenshot?: string;
}

export type Severity = "fail" | "warn";

export interface Finding {
  severity: Severity;
  rule: string;
  entry?: string;
  message: string;
}

/* ── fingerprint parsing ──────────────────────────────────────────────────── */

const BLOCK = /^```json[ \t]+fingerprint[ \t]*\r?\n([\s\S]*?)\r?\n```/m;
const BLOCK_FALLBACK = /^```fingerprint[ \t]*\r?\n([\s\S]*?)\r?\n```/m;

export type ParseResult =
  | { ok: true; fingerprint: Fingerprint; extraBlocks: number }
  | { ok: false; reason: "no-block" | "bad-json" | "bad-field"; message: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function fieldError(message: string): ParseResult {
  return { ok: false, reason: "bad-field", message };
}

export function parseFingerprintBlock(markdown: string): ParseResult {
  const text = markdown.replace(/^﻿/, "");
  const match = BLOCK.exec(text) ?? BLOCK_FALLBACK.exec(text);
  if (!match || match[1] === undefined) {
    return {
      ok: false,
      reason: "no-block",
      message:
        "no ```json fingerprint``` block found in the concept — " +
        "`npm run validate:divergence -- --print-template` prints an empty one to fill in.",
    };
  }
  const extraBlocks =
    (text.match(new RegExp(BLOCK.source, "gm"))?.length ?? 0) +
    (text.match(new RegExp(BLOCK_FALLBACK.source, "gm"))?.length ?? 0) -
    1;

  let raw: unknown;
  try {
    raw = JSON.parse(match[1]);
  } catch (error) {
    return {
      ok: false,
      reason: "bad-json",
      message: `the fingerprint block is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!isRecord(raw)) return fieldError("the fingerprint block must be a JSON object.");

  // Slug fields are the comparison keys — a free-text value would let a
  // rephrasing ("arc-of-the-day") defeat the check, so non-slugs hard-fail.
  for (const key of ["client", "metaphorFamily", "pageForm"] as const) {
    const value = raw[key];
    if (typeof value !== "string" || !SLUG.test(value)) {
      return fieldError(
        `"${key}" must be a kebab-case slug (got ${JSON.stringify(value)}) — ` +
          "the check compares family slugs so it can't be defeated by rephrasing.",
      );
    }
  }
  const fontPairing = raw.fontPairing;
  if (
    typeof fontPairing !== "string" ||
    !(FONT_PAIRINGS as readonly string[]).includes(fontPairing)
  ) {
    return fieldError(
      `"fontPairing" must be one of the 15 pairing keys (got ${JSON.stringify(fontPairing)}).`,
    );
  }
  const accentHex = raw.accentHex;
  if (typeof accentHex !== "string" || !HEX.test(accentHex)) {
    return fieldError(
      `"accentHex" must be a 6-digit hex color (got ${JSON.stringify(accentHex)}).`,
    );
  }

  let argues: ArguesEntry[] | undefined;
  if (raw.argues !== undefined) {
    if (!Array.isArray(raw.argues)) return fieldError('"argues" must be an array.');
    argues = [];
    for (const item of raw.argues) {
      if (
        !isRecord(item) ||
        typeof item.against !== "string" ||
        !["metaphorFamily", "fontPairing+accent", "pageForm"].includes(String(item.axis)) ||
        typeof item.why !== "string"
      ) {
        return fieldError(
          '"argues" entries must be { "against": "<client-slug>", "axis": "metaphorFamily" | "fontPairing+accent" | "pageForm", "why": "<text>" }.',
        );
      }
      if (item.why.trim().length < 40) {
        return fieldError(
          `"argues" against "${item.against}": "why" must be at least 40 characters and specific to THIS client — a repeat is only legitimate when the client's world genuinely demands it.`,
        );
      }
      argues.push({
        against: item.against,
        axis: item.axis as ArguesEntry["axis"],
        why: item.why,
      });
    }
  }

  const str = (key: string): string | undefined =>
    typeof raw[key] === "string" ? (raw[key] as string) : undefined;

  const fingerprint: Fingerprint = {
    client: raw.client as string,
    metaphorFamily: raw.metaphorFamily as string,
    pageForm: raw.pageForm as string,
    accentHex,
    fontPairing,
  };
  const date = str("date");
  if (date !== undefined) fingerprint.date = date;
  const businessType = str("businessType");
  if (businessType !== undefined) fingerprint.businessType = businessType;
  const metaphorNote = str("metaphorNote");
  if (metaphorNote !== undefined) fingerprint.metaphorNote = metaphorNote;
  const paletteFamily = str("paletteFamily");
  if (paletteFamily !== undefined) fingerprint.paletteFamily = paletteFamily;
  const signature = str("signature");
  if (signature !== undefined) fingerprint.signature = signature;
  const motionIdentity = str("motionIdentity");
  if (motionIdentity !== undefined) fingerprint.motionIdentity = motionIdentity;
  if (Array.isArray(raw.furniture)) {
    fingerprint.furniture = raw.furniture.filter((f): f is string => typeof f === "string");
  }
  if (argues !== undefined) fingerprint.argues = argues;

  return { ok: true, fingerprint, extraBlocks: Math.max(0, extraBlocks) };
}

/* ── portfolio reading ────────────────────────────────────────────────────── */

export function readPortfolio(path: string): { entries: PortfolioEntry[]; problems: string[] } {
  const problems: string[] = [];
  if (!existsSync(path)) {
    return { entries: [], problems: [`${path} does not exist`] };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf-8").replace(/^﻿/, ""));
  } catch (error) {
    return {
      entries: [],
      problems: [
        `${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
  if (!isRecord(raw) || !Array.isArray(raw.entries)) {
    return { entries: [], problems: [`${path} must be { "version": 1, "entries": [...] }`] };
  }
  const entries: PortfolioEntry[] = [];
  for (const [i, item] of raw.entries.entries()) {
    if (
      !isRecord(item) ||
      typeof item.client !== "string" ||
      typeof item.metaphorFamily !== "string" ||
      typeof item.pageForm !== "string" ||
      typeof item.accentHex !== "string" ||
      typeof item.fontPairing !== "string"
    ) {
      problems.push(
        `entries[${i}] is missing a required field (client/metaphorFamily/pageForm/accentHex/fontPairing)`,
      );
      continue;
    }
    for (const key of ["client", "metaphorFamily", "pageForm"] as const) {
      if (!SLUG.test(item[key] as string)) {
        problems.push(`entries[${i}].${key} ("${String(item[key])}") is not a kebab-case slug`);
      }
    }
    if (!HEX.test(item.accentHex)) {
      problems.push(`entries[${i}].accentHex ("${item.accentHex}") is not a 6-digit hex color`);
    }
    entries.push(item as unknown as PortfolioEntry);
  }
  return { entries, problems };
}

/* ── family comparison (anti-gaming) ──────────────────────────────────────── */

const STOP_TOKENS = new Set(["the", "of", "a"]);

function tokens(slug: string): Set<string> {
  return new Set(slug.split("-").filter((t) => t !== "" && !STOP_TOKENS.has(t)));
}

function jaccard(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection += 1;
  return intersection / (ta.size + tb.size - intersection);
}

/** Exact match, or token-set Jaccard ≥ 0.5 — "time-of-day-arc" vs
 *  "arc-of-the-day" is the SAME family however it's spelled. */
export function sameFamily(a: string, b: string): boolean {
  return a === b || jaccard(a, b) >= 0.5;
}

/** [0.34, 0.5) — close enough to deserve a warning, not a fail. */
export function nearFamily(a: string, b: string): boolean {
  if (sameFamily(a, b)) return false;
  const j = jaccard(a, b);
  return j >= 0.34;
}

/* ── the rules ────────────────────────────────────────────────────────────── */

export interface Summary {
  entryCount: number;
  metaphorFamilies: Map<string, number>;
  pageForms: Map<string, number>;
  accentFamilies: Map<string, number>;
  fontPairings: Map<string, number>;
  unusedPairings: string[];
  furniture: Map<string, number>;
}

export function summarize(entries: PortfolioEntry[]): Summary {
  const count = (map: Map<string, number>, key: string): void => {
    map.set(key, (map.get(key) ?? 0) + 1);
  };
  const metaphorFamilies = new Map<string, number>();
  const pageForms = new Map<string, number>();
  const accentFamilies = new Map<string, number>();
  const fontPairings = new Map<string, number>();
  const furniture = new Map<string, number>();
  for (const entry of entries) {
    count(metaphorFamilies, entry.metaphorFamily);
    count(pageForms, entry.pageForm);
    if (HEX.test(entry.accentHex)) count(accentFamilies, hueFamily(entry.accentHex));
    count(fontPairings, entry.fontPairing);
    for (const f of entry.furniture ?? []) count(furniture, f);
  }
  const unusedPairings = FONT_PAIRINGS.filter((p) => !fontPairings.has(p));
  return {
    entryCount: entries.length,
    metaphorFamilies,
    pageForms,
    accentFamilies,
    fontPairings,
    unusedPairings,
    furniture,
  };
}

function hasArgues(fp: Fingerprint, against: string, axis: ArguesEntry["axis"]): boolean {
  return (fp.argues ?? []).some((a) => a.against === against && a.axis === axis);
}

/**
 * The check. `live` is the values from the CURRENT repo's business.json —
 * the fingerprint must agree with them (a stale fingerprint would make every
 * other verdict meaningless).
 */
export function checkDivergence(
  fp: Fingerprint,
  entries: PortfolioEntry[],
  live: { fontPairing: string; accentHex: string },
  options?: { portfolioDir?: string },
): { findings: Finding[]; summary: Summary } {
  const findings: Finding[] = [];
  const summary = summarize(entries);

  // 0. Stale fingerprint — business.json wins, always.
  if (fp.fontPairing !== live.fontPairing) {
    findings.push({
      severity: "fail",
      rule: "stale-fingerprint",
      message: `the fingerprint says fontPairing "${fp.fontPairing}" but business.json says "${live.fontPairing}" — one of them is stale; make them agree.`,
    });
  }
  const fpAccentFamily = hueFamily(fp.accentHex);
  const liveAccentFamily = hueFamily(live.accentHex);
  if (fpAccentFamily !== liveAccentFamily) {
    findings.push({
      severity: "fail",
      rule: "stale-fingerprint",
      message: `the fingerprint's accent ${fp.accentHex} (${fpAccentFamily}) and business.json's voice.palette.accent ${live.accentHex} (${liveAccentFamily}) are different hue families — one is stale.`,
    });
  } else if (fp.accentHex.toLowerCase() !== live.accentHex.toLowerCase()) {
    findings.push({
      severity: "warn",
      rule: "stale-fingerprint",
      message: `the fingerprint's accent ${fp.accentHex} differs from business.json's ${live.accentHex} (same hue family) — update the fingerprint to the shipped hex.`,
    });
  }

  for (const entry of entries) {
    // 1. Metaphor family repeat — spent material.
    if (sameFamily(fp.metaphorFamily, entry.metaphorFamily)) {
      const argued = hasArgues(fp, entry.client, "metaphorFamily");
      findings.push({
        severity: argued ? "warn" : "fail",
        rule: "metaphor-repeat",
        entry: entry.client,
        message:
          `metaphorFamily "${fp.metaphorFamily}" already shipped as "${entry.metaphorFamily}" ` +
          `(${entry.client}, ${entry.date}, ${entry.businessType}). A family already shipped is spent material.` +
          (argued
            ? " (argued in the fingerprint — downgraded to a warning; the design-review judge reads the argument.)"
            : ' Choose another, or add to the fingerprint\'s "argues": ' +
              `{ "against": "${entry.client}", "axis": "metaphorFamily", "why": "<40+ chars, specific to THIS client>" }`),
      });
    } else if (nearFamily(fp.metaphorFamily, entry.metaphorFamily)) {
      findings.push({
        severity: "warn",
        rule: "metaphor-near-miss",
        entry: entry.client,
        message: `metaphorFamily "${fp.metaphorFamily}" is close to ${entry.client}'s "${entry.metaphorFamily}" — make sure it is genuinely a different family, not a rephrasing.`,
      });
    }

    // 2. Same pairing + same accent hue family = the same brand voice.
    if (
      fp.fontPairing === entry.fontPairing &&
      HEX.test(entry.accentHex) &&
      hueFamily(live.accentHex) === hueFamily(entry.accentHex)
    ) {
      const argued = hasArgues(fp, entry.client, "fontPairing+accent");
      findings.push({
        severity: argued ? "warn" : "fail",
        rule: "pairing-accent-collision",
        entry: entry.client,
        message:
          `fontPairing "${fp.fontPairing}" + accent hue family "${hueFamily(entry.accentHex)}" already shipped ` +
          `(${entry.client}, accent ${entry.accentHex}). ${summary.unusedPairings.length} pairings are unused: ${summary.unusedPairings.join(", ")}.` +
          (argued ? " (argued in the fingerprint — downgraded to a warning.)" : ""),
      });
    }

    // 3. Same form + same metaphor = the same site twice. Never overridable.
    if (fp.pageForm === entry.pageForm && sameFamily(fp.metaphorFamily, entry.metaphorFamily)) {
      findings.push({
        severity: "fail",
        rule: "form-metaphor-collision",
        entry: entry.client,
        message:
          `pageForm "${fp.pageForm}" + metaphorFamily "${fp.metaphorFamily}" together match ${entry.client} — ` +
          "that is the same site with new words. This collision cannot be argued away; change the form or the metaphor.",
      });
    }
  }

  // 4. Furniture frequency — a prop used twice is on its way to house style.
  for (const item of fp.furniture ?? []) {
    const priorUses = summary.furniture.get(item) ?? 0;
    if (priorUses >= 2) {
      findings.push({
        severity: "warn",
        rule: "furniture-frequency",
        message: `furniture "${item}" already appears in ${priorUses} shipped sites — it is becoming the house style.`,
      });
    }
  }

  // 5. Screenshot hygiene for the comparative-judging set.
  if (options?.portfolioDir !== undefined) {
    for (const entry of entries) {
      if (entry.screenshot === undefined) continue;
      const file = join(options.portfolioDir, ...entry.screenshot.split("/"));
      if (!existsSync(file)) {
        findings.push({
          severity: "warn",
          rule: "missing-screenshot",
          entry: entry.client,
          message: `docs/${entry.screenshot} is missing — design-review's comparative pass has one fewer site to compare against (backfill from the client repo).`,
        });
      } else if (statSync(file).size > 1.5 * 1024 * 1024) {
        findings.push({
          severity: "warn",
          rule: "missing-screenshot",
          entry: entry.client,
          message: `docs/${entry.screenshot} is over 1.5MB — re-encode it (sharp: resize width 390, png quality 80).`,
        });
      }
    }
  }

  return { findings, summary };
}

/** The empty fingerprint block --print-template emits (kept here so the CLI,
 *  PORTFOLIO.md's spec, and the skills all describe the same shape). */
export const FINGERPRINT_TEMPLATE = `\`\`\`json fingerprint
{
  "client": "<kebab-slug>",
  "date": "YYYY-MM-DD",
  "businessType": "<vertical, e.g. bakery>",
  "metaphorFamily": "<kebab-slug family, e.g. proofing-basket>",
  "metaphorNote": "<one human-readable line>",
  "pageForm": "<kebab-slug, e.g. band-stack | document-menu | pinned-scene | chapters | spine-rail | conversation | photo-led-scene>",
  "paletteFamily": "<free text, e.g. flour white + rye>",
  "accentHex": "#000000",
  "fontPairing": "<one of the 15 pairing keys>",
  "signature": "<the element only this site has>",
  "motionIdentity": "<one line>",
  "furniture": [],
  "argues": []
}
\`\`\``;

/** Convenience for callers that need the repo's live values. */
export function liveValuesFromBusinessJson(businessJsonPath: string): {
  fontPairing: string;
  accentHex: string;
} {
  const raw = JSON.parse(readFileSync(businessJsonPath, "utf-8").replace(/^﻿/, "")) as {
    design?: { fontPairing?: string };
    voice?: { palette?: { accent?: string } };
  };
  return {
    fontPairing: raw.design?.fontPairing ?? "classic",
    accentHex: raw.voice?.palette?.accent ?? "#000000",
  };
}

/** Resolve docs/ for a portfolio path (screenshot checks are relative to docs/). */
export function portfolioDirOf(portfolioPath: string): string {
  return dirname(portfolioPath);
}
