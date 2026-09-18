/**
 * Divergence validator — fails a client build whose concept collides with a
 * shipped site. The anti-sameness rules, as a script instead of prose:
 *
 *   npm run validate:divergence                     # docs/concept.md vs docs/portfolio.json
 *   npm run validate:divergence -- --summary        # spent-material frequency tables, exit 0
 *   npm run validate:divergence -- --warn-only      # report, never fail (preflight's mode)
 *   npm run validate:divergence -- --print-template # empty fingerprint block to paste
 *   npm run validate:divergence -- --concept=<path> --portfolio=<path> --json
 *
 * Exit codes: 0 pass/skipped · 1 collision(s) · 2 input problem (no
 * fingerprint block, bad JSON, non-slug field, unreadable portfolio).
 *
 * In the TEMPLATE repo (no docs/concept.md) it prints a note and exits 0 —
 * safe in CI. Rules + fingerprint format: scripts/lib/divergence.ts and
 * docs/PORTFOLIO.md → Fingerprint format.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BUSINESS_JSON_PATH } from "./lib/content";
import {
  checkDivergence,
  FINGERPRINT_TEMPLATE,
  type Finding,
  liveValuesFromBusinessJson,
  parseFingerprintBlock,
  portfolioDirOf,
  readPortfolio,
  type Summary,
} from "./lib/divergence";

const args = process.argv.slice(2);
const hasFlag = (name: string): boolean => args.includes(`--${name}`);
const flagValue = (name: string): string | undefined => {
  const hit = args.findLast((arg) => arg.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3).trim() || undefined;
};

const KNOWN = /^--(summary|warn-only|json|print-template|concept=.*|portfolio=.*)$/;
const unknown = args.filter((a) => !KNOWN.test(a));
if (unknown.length > 0) {
  console.error(`✗ unknown flag(s): ${unknown.join(" ")} — see the header of this script.`);
  process.exit(2);
}

if (hasFlag("print-template")) {
  console.log(FINGERPRINT_TEMPLATE);
  process.exit(0);
}

const conceptPath =
  flagValue("concept") ?? fileURLToPath(new URL("../docs/concept.md", import.meta.url));
const portfolioPath =
  flagValue("portfolio") ?? fileURLToPath(new URL("../docs/portfolio.json", import.meta.url));

const { entries, problems } = readPortfolio(portfolioPath);
if (problems.length > 0 && existsSync(portfolioPath)) {
  console.error(`✗ ${portfolioPath} has problems:\n`);
  for (const p of problems) console.error(`  • ${p}`);
  process.exit(2);
}

function formatCount(map: Map<string, number>): string {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, n]) => `${key} ×${n}`)
    .join(", ");
}

function printSummary(summary: Summary): void {
  console.log(`Portfolio summary — ${summary.entryCount} shipped site(s):\n`);
  console.log(`  metaphorFamily   ${formatCount(summary.metaphorFamilies) || "—"}`);
  console.log(`  pageForm         ${formatCount(summary.pageForms) || "—"}`);
  console.log(`  accent family    ${formatCount(summary.accentFamilies) || "—"}`);
  console.log(`  fontPairing      ${formatCount(summary.fontPairings) || "—"}`);
  console.log(
    `  unused pairings  (${summary.unusedPairings.length} of 15) ${summary.unusedPairings.join(", ")}`,
  );
  if (summary.furniture.size > 0) {
    console.log(`  furniture        ${formatCount(summary.furniture)}`);
  }
  console.log(
    "\n  Everything listed is SPENT MATERIAL — a new concept picks from what is absent,\n" +
      "  or argues the repeat in its fingerprint (docs/PORTFOLIO.md → Fingerprint format).",
  );
}

if (hasFlag("summary")) {
  const { summarize } = await import("./lib/divergence");
  printSummary(summarize(entries));
  process.exit(0);
}

if (!existsSync(conceptPath)) {
  console.log(
    "· no docs/concept.md — template repo or pre-concept stage; divergence check skipped.",
  );
  process.exit(0);
}

const parsed = parseFingerprintBlock(readFileSync(conceptPath, "utf-8"));
if (!parsed.ok) {
  console.error(`✗ ${conceptPath}: ${parsed.message}`);
  process.exit(2);
}
if (parsed.extraBlocks > 0) {
  console.warn("! more than one fingerprint block found — only the first is read.");
}

if (entries.length === 0) {
  console.warn("! portfolio.json has no entries — nothing to diverge from.");
  process.exit(0);
}

const live = liveValuesFromBusinessJson(BUSINESS_JSON_PATH);
const { findings, summary } = checkDivergence(parsed.fingerprint, entries, live, {
  portfolioDir: portfolioDirOf(portfolioPath),
});

const warnOnly = hasFlag("warn-only");
const fails = findings.filter((f) => f.severity === "fail");
const warns = findings.filter((f) => f.severity === "warn");

if (hasFlag("json")) {
  console.log(
    JSON.stringify(
      {
        ok: fails.length === 0,
        findings,
        summary: {
          entryCount: summary.entryCount,
          unusedPairings: summary.unusedPairings,
          metaphorFamilies: Object.fromEntries(summary.metaphorFamilies),
          pageForms: Object.fromEntries(summary.pageForms),
          accentFamilies: Object.fromEntries(summary.accentFamilies),
          fontPairings: Object.fromEntries(summary.fontPairings),
          furniture: Object.fromEntries(summary.furniture),
        },
      },
      null,
      2,
    ),
  );
  process.exit(warnOnly || fails.length === 0 ? 0 : 1);
}

const shownConcept = flagValue("concept") ?? "docs/concept.md";
console.log(
  `Divergence check — ${shownConcept} vs docs/portfolio.json (${entries.length} entries)\n`,
);
const fp = parsed.fingerprint;
const line = (label: string, value: string, verdict: string): void => {
  console.log(`  ${label.padEnd(16)} ${value.padEnd(24)} ${verdict}`);
};
const collides = (rule: string): Finding | undefined => findings.find((f) => f.rule === rule);
const { hueFamily } = await import("./lib/color");
line("metaphorFamily", fp.metaphorFamily, collides("metaphor-repeat") ? "✗ collides" : "✓ unused");
line("pageForm", fp.pageForm, collides("form-metaphor-collision") ? "✗ collides" : "✓ ok");
line(
  "fontPairing",
  fp.fontPairing,
  summary.fontPairings.has(fp.fontPairing)
    ? collides("pairing-accent-collision")
      ? "✗ collides (with accent family)"
      : "! used before (accent family differs)"
    : `✓ unused (${summary.unusedPairings.length} of 15 pairings unused)`,
);
line(
  "accent",
  `${live.accentHex} → ${hueFamily(live.accentHex)}`,
  `portfolio: ${formatCount(summary.accentFamilies)}`,
);
console.log("");

const missingShots = warns.filter(
  (f) => f.rule === "missing-screenshot" && f.message.includes("is missing"),
);
for (const finding of warns) {
  if (missingShots.length > 1 && missingShots.includes(finding)) continue; // compacted below
  console.warn(
    `! ${finding.rule}${finding.entry ? ` [${finding.entry}]` : ""} — ${finding.message}\n`,
  );
}
if (missingShots.length > 1) {
  console.warn(
    `! missing-screenshot — ${missingShots.length} portfolio screenshots are missing (${missingShots
      .map((f) => f.entry)
      .join(
        ", ",
      )}) — design-review's comparative pass degrades; backfill docs/portfolio/ from the client repos.\n`,
  );
}

if (fails.length > 0) {
  const prefix = warnOnly ? "!" : "•";
  console.error(`${warnOnly ? "!" : "✗"} divergence: ${fails.length} collision(s)\n`);
  for (const finding of fails) {
    console.error(
      `  ${prefix} ${finding.rule}${finding.entry ? ` [${finding.entry}]` : ""} — ${finding.message}\n`,
    );
  }
  process.exit(warnOnly ? 0 : 1);
}

console.log("✓ divergence: this concept collides with no shipped site.");
