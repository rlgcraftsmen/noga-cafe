/**
 * Launch preflight — the checks that MUST pass before a client site goes
 * live, but that legitimately fail while the site is still being built.
 * This is the mechanized version of the launch checklist that used to live
 * as prose in AGENTS.md / PLAYBOOK.md / the /new-client skill.
 *
 *   npm run preflight
 *
 * Content checks always run. Built-output checks (broken links, contact-form
 * key) run when dist/index.html exists — `npm run deploy` builds first and
 * then runs this automatically for every production (non-preview) branch.
 *
 * The shipped template skeleton FAILS this script by design — that is the
 * point: a site that still looks like the skeleton must not reach a real URL.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix, sep } from "node:path";
import { env, loadBusiness, ROOT, readBusinessJson } from "./lib/content";

const publicDir = join(ROOT, "public");
const distDir = join(ROOT, "dist");

const errors: string[] = [];
const warnings: string[] = [];

const raw: unknown = readBusinessJson();
const business = loadBusiness();
const { data, content } = business;

/* ── 1. Bracketed placeholders anywhere in business.json ──────────────────── */

// Non-numeric bracketed runs, e.g. "[שם העסק]" — "[24/7]" in real copy is fine.
const PLACEHOLDER = /\[[^\d\]][^\]]*\]/;

function walkStrings(node: unknown, path: string): void {
  if (typeof node === "string") {
    if (PLACEHOLDER.test(node)) {
      errors.push(`${path}: bracketed placeholder still present — "${node}"`);
    }
    return;
  }
  if (Array.isArray(node)) {
    for (const [i, item] of node.entries()) {
      walkStrings(item, `${path}[${i}]`);
    }
    return;
  }
  if (node !== null && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      walkStrings(value, path === "" ? key : `${path}.${key}`);
    }
  }
}
walkStrings(raw, "");

/* ── 2. Known skeleton values that pass schema validation ─────────────────── */

const digitsOf = (value: string): string => value.replace(/\D/g, "");

if (/example\.com|localhost/.test(data.seo.siteUrl)) {
  errors.push(
    `data.seo.siteUrl is still "${data.seo.siteUrl}" — canonical URLs, the sitemap, ` +
      "robots.txt and every JSON-LD @id all point at the placeholder domain.",
  );
}
if (digitsOf(data.contact.phone) === "0500000000") {
  errors.push('data.contact.phone is the skeleton\'s fake number ("050-000-0000").');
}
if (data.contact.whatsapp === "972500000000") {
  errors.push("data.contact.whatsapp is the skeleton's fake number.");
}
if (data.contact.email?.endsWith("@example.com")) {
  errors.push(`data.contact.email ("${data.contact.email}") is a placeholder address.`);
}
if (
  Math.abs(data.contact.geo.lat - 31.0461) < 1e-6 &&
  Math.abs(data.contact.geo.lng - 34.8516) < 1e-6
) {
  errors.push(
    "data.contact.geo is still the skeleton's demo pin (the geographic centre of Israel) — " +
      "geocode the real address; a wrong pin ships in the LocalBusiness JSON-LD.",
  );
}

const coordinator = content.legal.accessibility.coordinator;
if (digitsOf(coordinator.phone) === "0500000000") {
  errors.push(
    "content.legal.accessibility.coordinator.phone is the skeleton's fake number — " +
      'the accessibility coordinator must be a REAL person (ת"י 5568 legal requirement).',
  );
}
if (coordinator.email.endsWith("@example.com")) {
  errors.push(
    "content.legal.accessibility.coordinator.email is a placeholder — " +
      'the accessibility coordinator must be reachable (ת"י 5568 legal requirement).',
  );
}

// The statement renders these as "the accessibility audit was performed on
// 01.01.2026" — shipping the skeleton value asserts an audit that never
// happened, on a legally-required page.
const SKELETON_DATE = "2026-01-01";
const legalDates: Array<[string, string]> = [
  ["content.legal.accessibility.auditDate", content.legal.accessibility.auditDate],
  ["content.legal.accessibility.statementDate", content.legal.accessibility.statementDate],
  ["content.legal.privacy.statementDate", content.legal.privacy.statementDate],
];
for (const [label, value] of legalDates) {
  if (value === SKELETON_DATE) {
    errors.push(
      `${label} is still the skeleton date (${SKELETON_DATE}) — set the real date; ` +
        "the accessibility statement publishes it as fact.",
    );
  }
}

// Guarded with `in` rather than a direct property read: /new-client DELETES
// content.shell from the schema when the real site ships, so a bare
// `content.shell` fails typecheck in exactly the repos that did it right.
if ("shell" in content && content.shell) {
  errors.push(
    "content.shell still exists — the starter shell (schema field + JSON block + " +
      "pages/index.astro) must be deleted when the real site is built.",
  );
}

/* ── 3. OG image exists ───────────────────────────────────────────────────── */

const ogPath = join(publicDir, ...data.seo.ogImage.split("/"));
if (!existsSync(ogPath)) {
  errors.push(
    `public/${data.seo.ogImage} does not exist — every WhatsApp/Facebook share renders ` +
      "a broken preview. Run `npm run generate:og`.",
  );
} else if (statSync(ogPath).size < 1024) {
  errors.push(`public/${data.seo.ogImage} is suspiciously small (<1KB) — regenerate it.`);
}

/* ── 4. Analytics ↔ privacy-policy consistency ────────────────────────────── */

const trackersConfigured = data.analytics.gtagId !== "" || data.analytics.metaPixelId !== "";
const privacyText = content.legal.privacy.body.join("\n");
if (trackersConfigured && /ללא עוגיות/.test(privacyText)) {
  errors.push(
    "data.analytics configures a cookie-based tracker, but the privacy policy still claims " +
      '"ללא עוגיות מעקב" — rewrite content.legal.privacy.body to disclose the tracking cookies.',
  );
}
if (trackersConfigured && !/עוגיות|cookies/i.test(privacyText)) {
  warnings.push(
    "cookie trackers are configured but the privacy policy never mentions cookies — " +
      "the policy should disclose them.",
  );
}
if (data.analytics.cloudflareToken === "") {
  warnings.push(
    "data.analytics.cloudflareToken is empty — the site ships with zero measurement. " +
      "Cloudflare Web Analytics is cookieless and free (dashboard → Analytics → Web Analytics).",
  );
}

/* ── 5. Divergence (warn-only) ────────────────────────────────────────────── */
// A samey site is not a LAUNCH blocker — but launching is the last moment to
// notice one. The hard gate is /new-client Step 1 and design-review; here the
// findings surface as warnings only.
const conceptPath = join(ROOT, "docs", "concept.md");
const portfolioPath = join(ROOT, "docs", "portfolio.json");
if (existsSync(conceptPath) && existsSync(portfolioPath)) {
  const { checkDivergence, parseFingerprintBlock, readPortfolio } = await import(
    "./lib/divergence"
  );
  const parsed = parseFingerprintBlock(readFileSync(conceptPath, "utf-8"));
  if (!parsed.ok) {
    warnings.push(
      `divergence: docs/concept.md has no readable fingerprint block (${parsed.reason}) — ` +
        "run `npm run validate:divergence` for the full report.",
    );
  } else {
    const { entries } = readPortfolio(portfolioPath);
    const { findings } = checkDivergence(parsed.fingerprint, entries, {
      fontPairing: business.design.fontPairing,
      accentHex: business.voice.palette.accent,
    });
    for (const finding of findings.filter((f) => f.severity === "fail")) {
      warnings.push(`divergence: ${finding.message}`);
    }
  }
}

/* ── 6. Built-output checks (when dist/ exists) ───────────────────────────── */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function htmlFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...htmlFiles(full));
    else if (entry.name.endsWith(".html")) found.push(full);
  }
  return found;
}

if (existsSync(join(distDir, "index.html"))) {
  const files = htmlFiles(distDir);
  let formPresent = false;
  let faqJsonLdPresent = false;

  for (const file of files) {
    const html = readFileSync(file, "utf-8");
    const rel = `/${file
      .slice(distDir.length + 1)
      .split(sep)
      .join("/")}`;
    if (html.includes("data-contact-form")) formPresent = true;
    if (html.includes('"FAQPage"')) faqJsonLdPresent = true;

    // The leading boundary matters: without it `data-src="…"` and
    // `data-href="…"` match on their tails and report phantom broken links.
    for (const match of html.matchAll(/[\s"'](?:href|src)="([^"]*)"/g)) {
      const url = match[1];
      if (url === undefined || url === "" || url === "#") continue;
      if (/^(https?:|mailto:|tel:|sms:|data:|javascript:|\/\/)/.test(url)) continue;

      if (url.startsWith("#")) {
        const id = url.slice(1);
        if (!new RegExp(`id="${escapeRegExp(id)}"`).test(html)) {
          errors.push(`${rel}: dead fragment link "${url}" — no element with that id on the page.`);
        }
        continue;
      }

      const clean = url.split("#")[0]?.split("?")[0] ?? "";
      if (clean === "") continue;
      const target = clean.startsWith("/") ? clean : posix.join(posix.dirname(rel), clean);
      const fsTarget = join(distDir, ...target.split("/").filter(Boolean));
      if (!existsSync(fsTarget) && !existsSync(join(fsTarget, "index.html"))) {
        errors.push(`${rel}: broken internal link "${url}".`);
      }
    }
  }

  // content.faq exists but no page emits FAQPage: the FAQ renders visibly
  // while its structured data is missing everywhere (BaseLayout's
  // withFaqJsonLd prop was never passed on the page that renders it).
  if (content.faq && content.faq.items.length > 0 && !faqJsonLdPresent) {
    errors.push(
      "content.faq has items but no built page emits FAQPage JSON-LD — pass " +
        "`withFaqJsonLd` to BaseLayout on the page that renders the FAQ (it must be " +
        "the page where the questions are visible).",
    );
  }

  if (formPresent && !env("PUBLIC_WEB3FORMS_KEY")) {
    errors.push(
      "the built site contains a contact form but PUBLIC_WEB3FORMS_KEY is not set — " +
        "every submission will fail. Put the key in .env and rebuild (direct uploads " +
        "build locally; a key set only in the Cloudflare dashboard never applies).",
    );
  }
} else {
  warnings.push(
    "dist/ not found — built-output checks (broken links, contact-form key) were skipped. " +
      "Run `npm run build` first for full coverage.",
  );
}

/* ── Report ───────────────────────────────────────────────────────────────── */

for (const warning of warnings) {
  console.warn(`! ${warning}\n`);
}
if (errors.length > 0) {
  console.error(`✗ preflight failed — ${errors.length} launch blocker(s):\n`);
  for (const error of errors) {
    console.error(`  • ${error}\n`);
  }
  process.exit(1);
}
console.log(
  warnings.length > 0
    ? `✓ preflight passed with ${warnings.length} warning(s) — review them before launch`
    : "✓ preflight passed — clear for launch",
);
