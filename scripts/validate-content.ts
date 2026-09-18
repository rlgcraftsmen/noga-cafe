/**
 * Standalone business.json validation (also enforced at build time via the
 * content collection schema). Run with: npm run validate:content
 */
import { businessSchema } from "../src/content/business.schema";
import { failingPairs, MIN_TEXT_CONTRAST } from "./lib/color";
import { readBusinessJson } from "./lib/content";

const raw: unknown = readBusinessJson();
const result = businessSchema.safeParse(raw);

if (!result.success) {
  console.error("✗ business.json is invalid:\n");
  for (const issue of result.error.issues) {
    console.error(`  ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  process.exit(1);
}

console.log("✓ business.json is valid");

/*
 * Schema strictness self-check.
 *
 * Every object in the schema must reject unknown keys, so a typo'd JSON key
 * ("emial") fails the build instead of being silently dropped — the worst
 * failure mode for a schema-first workflow. Enforcing that by remembering to
 * write `.strict()` on each new nested object does not survive contact with
 * a per-client schema that grows every build, so the tree is walked here:
 * a plain z.object() anywhere fails THIS check with the path to fix.
 */
interface ZodInternals {
  _zod?: { def?: { type?: string; catchall?: unknown; shape?: Record<string, unknown> } };
  def?: { type?: string; catchall?: unknown; shape?: Record<string, unknown> };
  // Wrapper types (optional/default/array/refine…) keep the payload in one of these.
  unwrap?: () => unknown;
  element?: unknown;
}

const nonStrict: string[] = [];
const seen = new WeakSet<object>();

function walkSchema(node: unknown, path: string): void {
  if (typeof node !== "object" || node === null) return;
  if (seen.has(node)) return;
  seen.add(node);

  const zod = node as ZodInternals;
  const def = zod._zod?.def ?? zod.def;
  if (!def) return;

  if (def.type === "object") {
    // catchall === undefined is "strip" (the silent default); .strict() sets
    // a ZodNever catchall.
    if (def.catchall === undefined) nonStrict.push(path || "(root)");
    for (const [key, child] of Object.entries(def.shape ?? {})) {
      walkSchema(child, path === "" ? key : `${path}.${key}`);
    }
    return;
  }

  // Wrappers: array element, optional/default/refine inner type, union options.
  for (const key of ["element", "innerType", "in", "out", "type"] as const) {
    const child = (def as Record<string, unknown>)[key];
    if (typeof child === "object" && child !== null) walkSchema(child, path);
  }
  const options = (def as Record<string, unknown>).options;
  if (Array.isArray(options)) {
    for (const option of options) walkSchema(option, path);
  }
}

walkSchema(businessSchema, "");

if (nonStrict.length > 0) {
  console.error("\n✗ business.schema.ts has non-strict objects (unknown keys silently dropped):\n");
  for (const path of nonStrict) {
    console.error(`  ${path}`);
  }
  console.error("\n  Add .strict() to each — a typo'd JSON key must fail the build.");
  process.exit(1);
}

console.log("✓ every schema object is strict (typo'd keys fail the build)");

/*
 * WCAG contrast validation for voice.palette.
 *
 * Pairs are computed against the ACTUAL palette (neutrals included, schema
 * defaults applied) — dark themes are validated for real. `line` is
 * border-only decoration, not text, so it is deliberately not
 * contrast-checked. See AGENTS.md → "Palette contract"; the pair list lives
 * in scripts/lib/color.ts (contrastPairs) — shared with sample-palette.ts.
 */
const failures = failingPairs(result.data.voice.palette);

if (failures.length > 0) {
  console.error(`\n✗ voice.palette fails WCAG AA contrast (need ≥ ${MIN_TEXT_CONTRAST}:1):\n`);
  for (const f of failures) {
    console.error(
      `  ${f.label}: ${f.ratio.toFixed(2)}:1 (${f.a} vs ${f.b}) — used for: ${f.usage}`,
    );
  }
  console.error("\n  Adjust the palette in business.json until every pair passes.");
  process.exit(1);
}

console.log("✓ palette passes WCAG AA contrast on all used pairs");

/*
 * Cross-field content checks. Unlike the schema (shape) and the palette
 * (contrast), these are rules about VALUES — all failures are collected and
 * reported together so one run shows everything that needs fixing.
 *
 * Phones: dialablePhone() (src/lib/business.ts) assumes any digit-string
 * starting with "0" is Israeli local format and strips it in favor of a
 * "+972" prefix; anything else is assumed to already be international and
 * just gets a "+" prepended. A mis-formatted phone (e.g. missing the
 * leading 0) silently produces a real-looking but WRONG country code on the
 * tel: link with no build-time signal — this check catches that class of
 * mistake before it ships. Star codes ("*3455") pass through unchanged.
 * The same rules apply to legal.accessibility.coordinator.phone on the
 * accessibility statement page. (whatsapp format is enforced by the schema.)
 */
const errors: string[] = [];

function checkPhone(label: string, value: string): void {
  const trimmed = value.trim();
  // Israeli star codes are dialable as-is — dialablePhone() keeps them verbatim.
  if (/^\*\d{3,6}$/.test(trimmed)) return;
  const digits = trimmed.replace(/\D/g, "");
  const isIsraeliLocal = /^0\d{8,9}$/.test(digits);
  const isInternational = /^972\d{8,9}$/.test(digits);

  if (!isIsraeliLocal && !isInternational) {
    errors.push(
      `${label} ("${value}") is not a recognized phone format.\n` +
        '    dialablePhone() assumes a leading 0 means Israeli local format and prefixes "+972"\n' +
        "    for any other digit string — a mis-formatted number silently produces a wrong\n" +
        "    (but valid-looking) country code on the tel: link. Use Israeli local format\n" +
        "    (0 + 8-9 digits), international (972 + 8-9 digits), or a star code (*3455).",
    );
  }
}

checkPhone("data.contact.phone", result.data.data.contact.phone);
checkPhone(
  "content.legal.accessibility.coordinator.phone",
  result.data.content.legal.accessibility.coordinator.phone,
);

// Hours shape, duplicate days, zero-length ranges and impossible dates are
// enforced by the SCHEMA (business.schema.ts refinements), so every parse
// path — build, preflight, deploy — rejects them, not just this script.

if (errors.length > 0) {
  console.error("\n✗ business.json content checks failed:\n");
  for (const e of errors) {
    console.error(`  ${e}\n`);
  }
  process.exit(1);
}

console.log("✓ contact phone formats are valid");
