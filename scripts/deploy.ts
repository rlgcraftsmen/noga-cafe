/**
 * One-command Cloudflare Pages deploy: validates business.json, builds, and
 * uploads dist/ straight to Cloudflare (direct upload — no CI round-trip).
 *
 *   npm run deploy           # full gate (validate + lint + typecheck) → build → upload
 *   npm run deploy:preview   # build → upload to the "preview" branch (shareable preview URL)
 *   npm run deploy:setup     # one-time: create the Pages project for this client
 *
 * Flags go after `--`, e.g. `npm run deploy -- --project=acme-cafe`:
 *   --project=<name>  Pages project name (see resolveProject() for the lookup order)
 *   --branch=<name>   deployment branch (default: the current git branch)
 *   --skip-build      upload the existing dist/ as-is
 *   --setup           create the Pages project, then stop
 *   --dry-run         print the plan, upload nothing
 */
import { execSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ENV_PATH as envPath, fail, fromEnvFile, loadBusiness, ROOT as root } from "./lib/content";

const distPath = join(root, "dist");

const args = process.argv.slice(2);
const hasFlag = (name: string) => args.includes(`--${name}`);
const flagValue = (name: string) => {
  // findLast, not find: npm appends the user's `-- --branch=x` after the flags
  // baked into the package.json script, so the last occurrence must win.
  const hit = args.findLast((arg) => arg.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3).trim() || undefined;
};

function tryExec(command: string): string | undefined {
  try {
    return execSync(command, { cwd: root, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return undefined;
  }
}

function run(command: string): void {
  execSync(command, { cwd: root, stdio: "inherit" });
}

// business.json is the single source of truth here too: the fallback project
// name and the production URL both come out of it.
const business = loadBusiness();

/** Cloudflare Pages project names: lowercase alphanumeric + dashes, max 58 chars. */
const PROJECT_NAME = /^[a-z0-9][a-z0-9-]{0,57}$/;

function slugFromSiteUrl(siteUrl: string): string | undefined {
  let hostname: string;
  try {
    hostname = new URL(siteUrl).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
  // The skeleton ships example.com — never auto-create a project from a placeholder.
  if (hostname === "example.com" || hostname === "localhost") return undefined;
  const slug = hostname
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 58);
  return PROJECT_NAME.test(slug) ? slug : undefined;
}

/** --project= → CLOUDFLARE_PAGES_PROJECT (shell or .env) → slug of data.seo.siteUrl. */
function resolveProject(): string {
  const explicit =
    flagValue("project") ||
    process.env.CLOUDFLARE_PAGES_PROJECT ||
    fromEnvFile("CLOUDFLARE_PAGES_PROJECT");
  if (explicit) {
    if (!PROJECT_NAME.test(explicit)) {
      fail(
        `"${explicit}" is not a valid Cloudflare Pages project name — ` +
          "lowercase letters, digits and dashes only (max 58 chars).",
      );
    }
    return explicit;
  }
  const derived = slugFromSiteUrl(business.data.seo.siteUrl);
  if (!derived) {
    fail(
      "Could not work out which Cloudflare Pages project to deploy to.\n" +
        `  data.seo.siteUrl is "${business.data.seo.siteUrl}" (still the placeholder).\n` +
        "  Fix: set the real domain in business.json, or add\n" +
        "  CLOUDFLARE_PAGES_PROJECT=my-client to .env, or pass --project=my-client.",
    );
  }
  return derived;
}

const project = resolveProject();
const gitBranch = tryExec("git rev-parse --abbrev-ref HEAD")?.trim();
const branch = flagValue("branch") || gitBranch || "main";
if (!/^[A-Za-z0-9._/-]+$/.test(branch)) {
  fail(`Refusing to deploy to branch "${branch}" — unexpected characters in the branch name.`);
}

// ── setup: create the project once, then stop ────────────────────────────────
if (hasFlag("setup")) {
  console.log(`Creating Cloudflare Pages project "${project}" (production branch: ${branch})…`);
  try {
    run(`npx wrangler pages project create ${project} --production-branch ${branch}`);
    console.log(`\n✓ Project created. Deploy it with: npm run deploy`);
  } catch {
    fail(
      "Could not create the project. If it already exists you are done — just run `npm run deploy`.\n" +
        "  Otherwise check you are logged in (`npx wrangler login`) and on the right account\n" +
        "  (`npx wrangler whoami`).",
    );
  }
  // Pin the resolved name into .env: a later siteUrl change (rebrand, new
  // domain) must not silently re-derive a DIFFERENT project and orphan this
  // one while it keeps serving the live site.
  if (!fromEnvFile("CLOUDFLARE_PAGES_PROJECT")) {
    appendFileSync(
      envPath,
      `${existsSync(envPath) ? "\n" : ""}CLOUDFLARE_PAGES_PROJECT="${project}"\n`,
    );
    console.log(`✓ Pinned CLOUDFLARE_PAGES_PROJECT="${project}" in .env`);
  }
  process.exit(0);
}

// ── preflight ────────────────────────────────────────────────────────────────
// Wrangler only reads the token from process env — surface a .env value so
// "put it in .env" (the obvious place) actually works.
if (!process.env.CLOUDFLARE_API_TOKEN && fromEnvFile("CLOUDFLARE_API_TOKEN")) {
  process.env.CLOUDFLARE_API_TOKEN = fromEnvFile("CLOUDFLARE_API_TOKEN");
}
const authenticated =
  Boolean(process.env.CLOUDFLARE_API_TOKEN) ||
  !/not authenticated|you are not logged in/i.test(
    tryExec("npx wrangler whoami") ?? "not authenticated",
  );
if (!authenticated) {
  fail("Not logged in to Cloudflare. Run `npx wrangler login` (once per machine), then retry.");
}

// The contact form key is baked in at BUILD time. With direct upload the build
// runs here, not on Cloudflare — so a key set only in the dashboard is ignored.
if (!(process.env.PUBLIC_WEB3FORMS_KEY || fromEnvFile("PUBLIC_WEB3FORMS_KEY"))) {
  console.warn(
    "! PUBLIC_WEB3FORMS_KEY is not set locally — the contact form will ship disabled.\n" +
      "  Direct uploads build on THIS machine, so the Cloudflare dashboard env var does not apply.\n" +
      "  Put the key in .env before deploying.",
  );
}

if (business.data.seo.siteUrl.includes("example.com")) {
  console.warn(
    "! data.seo.siteUrl is still https://example.com — canonical URLs, sitemap, robots.txt\n" +
      "  and JSON-LD will all point at the placeholder domain.",
  );
}

if (tryExec("git status --porcelain")?.trim()) {
  console.warn("! Working tree has uncommitted changes — deploying them anyway.");
}

console.log(
  [
    "",
    `  project   ${project}`,
    `  branch    ${branch}`,
    `  source    dist/${hasFlag("skip-build") ? " (existing build — --skip-build)" : ""}`,
    "",
  ].join("\n"),
);

if (hasFlag("dry-run")) {
  console.log("✓ Dry run — nothing was uploaded.");
  process.exit(0);
}

// ── build + upload ───────────────────────────────────────────────────────────
if (!hasFlag("skip-build")) {
  run("npx astro build");
} else if (!existsSync(distPath)) {
  fail("--skip-build was passed but dist/ does not exist. Run `npm run build` first.");
}

// A public *.pages.dev draft must never be indexed, so preview uploads get an
// X-Robots-Tag appended to the built _headers. That edit lands in the dist/
// ARTIFACT, so production must strip it again — otherwise
// `deploy:preview` followed by `deploy --skip-build` (upload the exact
// artifact the client approved) silently de-indexes the live site.
const headersPath = join(distPath, "_headers");
const NOINDEX_BLOCK =
  "\n# Preview deploys must not be indexed (appended by deploy.ts)\n/*\n  X-Robots-Tag: noindex\n";

if (branch === "preview") {
  if (!existsSync(headersPath) || !readFileSync(headersPath, "utf-8").includes(NOINDEX_BLOCK)) {
    appendFileSync(headersPath, NOINDEX_BLOCK);
    console.log("  (preview) appended X-Robots-Tag: noindex to dist/_headers");
  }
} else {
  if (existsSync(headersPath)) {
    const headers = readFileSync(headersPath, "utf-8");
    if (headers.includes(NOINDEX_BLOCK)) {
      writeFileSync(headersPath, headers.replace(NOINDEX_BLOCK, ""), "utf-8");
      console.log("  (production) removed the preview X-Robots-Tag: noindex from dist/_headers");
    } else if (/X-Robots-Tag:\s*noindex/i.test(headers)) {
      // A hand-written noindex we did not add — refuse rather than guess.
      fail(
        "dist/_headers contains an X-Robots-Tag: noindex rule that this script did not add.\n" +
          "  Uploading it would de-index the live site. Remove it (or rebuild without\n" +
          "  --skip-build) and deploy again.",
      );
    }
  }

  // Production branches must also clear the launch gate (placeholders, broken
  // links, missing form key, OG image…). Previews are working drafts.
  try {
    run("npx tsx scripts/preflight.ts");
  } catch {
    fail(
      "Preflight failed — fix the launch blockers above before a production deploy.\n" +
        "  (Shareable drafts go through `npm run deploy:preview`, which skips this gate.)",
    );
  }
}

try {
  run(
    `npx wrangler pages deploy dist --project-name ${project} --branch ${branch} --commit-dirty=true`,
  );
} catch {
  fail(
    "Upload failed. Most common causes:\n" +
      `  • the project "${project}" does not exist yet → run \`npm run deploy:setup\`\n` +
      "  • wrong Cloudflare account → check `npx wrangler whoami`\n" +
      "  • the deployment URL above is a preview because this branch is not the\n" +
      "    project's production branch → deploy from the production branch, or set it\n" +
      "    in the dashboard under Settings → Builds & deployments.",
  );
}

console.log(
  `\n✓ Deployed "${project}" (branch: ${branch}). The live URL is printed above.\n` +
    `  Recent deployments: npx wrangler pages deployment list --project-name ${project}`,
);

if (branch !== "preview") {
  console.log(
    "\nProduction deploy next step — Google Search Console:\n" +
      "  npm run gsc:setup   (verifies the domain, adds the property, submits the sitemap;\n" +
      "  one-time OAuth setup: docs/PLAYBOOK.md → Search Console)",
  );
}
