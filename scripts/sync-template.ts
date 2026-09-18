/**
 * Pull template improvements into a CLIENT repo.
 *
 * "Use this template" clones share no git history with the template, so a
 * merge is impossible — instead this does a PATH-SCOPED checkout of
 * template-owned files onto a review branch. Per-client surfaces
 * (business.json, business.schema.ts, src/pages/, custom.css, custom.ts,
 * images, docs/brief.md, docs/concept.md) are never touched.
 *
 *   npm run sync:template               # fetch, compare, stage a review branch
 *   npm run sync:template -- --dry-run  # show what would change, touch nothing
 *   npm run sync:template -- --repo=https://github.com/OWNER/REPO.git
 *
 * After it runs: review the staged diff + docs/CHANGELOG.md entries between
 * your version and the template's ([review]-tagged entries name contract
 * changes), diff package.json dependencies manually, run the full gate, and
 * commit the branch.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DEFAULT_REPO = "https://github.com/RLGTEAM/BusinessTemplate.git";

/** Template-owned paths — safe to overwrite in a client repo. Everything
 *  per-client (content, schema, pages, custom.css/ts, images) is absent on
 *  purpose; a path that gains per-client meaning must leave this list. */
const TEMPLATE_PATHS = [
  "TEMPLATE_VERSION",
  "docs/CHANGELOG.md",
  "docs/RECIPES.md",
  "docs/DESIGN-DOCTRINE.md",
  "docs/TRAPS.md",
  "docs/PORTFOLIO.md",
  // A directory pathspec matches on "/" boundaries, so "docs/portfolio" does
  // NOT pick up portfolio.json — both must be listed.
  "docs/portfolio.json",
  "docs/portfolio",
  "docs/PLAYBOOK.md",
  "docs/OPERATIONS.md",
  // Skills are template-owned workflow; a client-authored skill in its own
  // directory survives (checkout only writes files present in the ref).
  // .claude/settings.json is deliberately NOT synced — client repos may
  // carry local permission entries.
  ".claude/skills",
  "scripts",
  "tests",
  ".github",
  ".gitattributes",
  "astro.config.mjs",
  "biome.json",
  "playwright.config.ts",
  "lighthouserc.json",
  "src/content.config.ts",
  "src/lib/business.ts",
  "src/lib/form.ts",
  "src/lib/track.ts",
  "src/lib/jsonld.ts",
  "src/lib/images.ts",
  "src/lib/animation/index.ts",
  "src/lib/animation/reveal.ts",
  "src/lib/animation/helpers.ts",
  "src/components/seo",
  "src/components/ui/ConsentBanner.astro",
  "src/layouts/BaseLayout.astro",
  "src/styles/global.css",
];

/** Template-owned files DELETED upstream. `git checkout <ref> -- <path>`
 *  silently skips paths absent from the ref — it never deletes — so without
 *  this list a client repo keeps a stale copy forever and reads it as
 *  current. Applied on the sync branch after the checkout loop. */
const REMOVED_PATHS = ["docs/CLIENT-SITE-GUIDE.md"];

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const repoFlag = args.findLast((a) => a.startsWith("--repo="))?.slice(7);

const fail: (message: string) => never = (message) => {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
};

function git(command: string): string {
  return execSync(`git ${command}`, { cwd: root, encoding: "utf-8" }).trim();
}

function tryGit(command: string): string | undefined {
  try {
    return git(command);
  } catch {
    return undefined;
  }
}

if (tryGit("status --porcelain")) {
  fail("Working tree is not clean — commit or stash before syncing.");
}

// ── remote setup ─────────────────────────────────────────────────────────────
// The flag value is interpolated into a shell command — allow only URL-safe
// characters (same guard idiom as deploy.ts's branch check).
if (repoFlag && !/^[A-Za-z0-9._:/@-]+$/.test(repoFlag)) {
  fail(`Refusing --repo="${repoFlag}" — unexpected characters in the URL.`);
}
const repo = repoFlag ?? DEFAULT_REPO;
const existingUrl = tryGit("remote get-url template");
if (existingUrl === undefined) {
  git(`remote add template ${repo}`);
} else if (repoFlag && existingUrl !== repoFlag) {
  git(`remote set-url template ${repoFlag}`);
}

console.log(`Fetching template from ${repoFlag ?? existingUrl ?? DEFAULT_REPO}…`);
const branch = ["master", "main"].find((b) => tryGit(`fetch template ${b}`) !== undefined);
if (!branch) fail("Could not fetch template master/main — check the URL and your access.");
const ref = `template/${branch}`;

// ── version comparison ───────────────────────────────────────────────────────
const localVersionPath = `${root}TEMPLATE_VERSION`;
const localVersion = existsSync(localVersionPath)
  ? readFileSync(localVersionPath, "utf-8").trim()
  : "(pre-versioning)";
const remoteVersion = tryGit(`show ${ref}:TEMPLATE_VERSION`)?.trim() ?? "(unknown)";

console.log(`  this repo:  ${localVersion}`);
console.log(`  template:   ${remoteVersion}`);
if (localVersion === remoteVersion) {
  console.log("\n✓ Already on the template's version — nothing to sync.");
  process.exit(0);
}

// ── dry run: report, touch nothing ───────────────────────────────────────────
const pathspec = TEMPLATE_PATHS.map((p) => `"${p}"`).join(" ");
if (dryRun) {
  console.log("\nTemplate-owned files that differ:\n");
  console.log(tryGit(`diff --stat HEAD ${ref} -- ${pathspec}`) || "  (none)");
  console.log("\nDependency drift (review manually, never auto-synced):\n");
  console.log(tryGit(`diff HEAD ${ref} -- package.json`) || "  (none)");
  console.log("\n✓ Dry run — nothing was changed.");
  process.exit(0);
}

// ── stage the sync on a review branch ────────────────────────────────────────
const syncBranch = `template-sync/${remoteVersion.replaceAll(/[^A-Za-z0-9.-]/g, "-")}`;
if (tryGit(`rev-parse --verify ${syncBranch}`) !== undefined) {
  fail(`Branch ${syncBranch} already exists — finish or delete the previous sync first.`);
}
git(`checkout -b ${syncBranch}`);

let synced = 0;
for (const path of TEMPLATE_PATHS) {
  // Paths that don't exist in the template ref (older template) are skipped.
  if (tryGit(`checkout ${ref} -- "${path}"`) !== undefined) synced += 1;
}

let removed = 0;
for (const path of REMOVED_PATHS) {
  // Delete only when the file exists here AND is really gone from the ref.
  if (existsSync(`${root}${path}`) && tryGit(`cat-file -e ${ref}:"${path}"`) === undefined) {
    git(`rm -q "${path}"`);
    removed += 1;
  }
}

const changed = tryGit("status --porcelain") ?? "";
if (changed === "") {
  git("checkout -");
  git(`branch -D ${syncBranch}`);
  console.log("\n✓ Template-owned files are already identical — nothing to sync.");
  process.exit(0);
}

console.log(
  `\n✓ Synced ${synced} template path groups${removed > 0 ? ` (+ removed ${removed} stale template file(s))` : ""} onto branch ${syncBranch}:\n`,
);
console.log(changed);
console.log(
  [
    "",
    "Next steps (review-first — nothing is committed yet):",
    `  1. Read docs/CHANGELOG.md entries between ${localVersion} and ${remoteVersion};`,
    "     [review]-tagged entries name contract changes your site may build against.",
    `  2. Diff dependencies yourself: git diff HEAD ${ref} -- package.json`,
    "  3. Run the full gate: npm run test && npm run test:e2e && npm run test:ltr-build",
    "  4. Commit and merge the branch when green.",
  ].join("\n"),
);
