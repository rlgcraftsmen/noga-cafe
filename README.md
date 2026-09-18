# Business Template (Astro · Static · RTL-first)

Production-grade starter for small-business sites. One repo per client; all client-specific
content, branding, and SEO live in a single file — `src/content/business/business.json` —
validated by Zod at build time. Hebrew/RTL by default, flips to LTR with one flag.

Ships with: Astro 7 (static output), Tailwind CSS 4 (CSS-first), GSAP + ScrollTrigger + Lenis
(reduced-motion safe), fifteen self-hosted Hebrew-capable font pairings, JSON-LD (LocalBusiness
subtype with hours/reviews/GBP links / WebSite / FAQPage / BreadcrumbList), sitemap + robots,
Web3Forms contact form (+ optional hCaptcha), conversion tracking for tel/WhatsApp taps, a
mechanized launch gate (`npm run preflight`), template→client sync (`npm run sync:template`),
Biome, Husky, Playwright, Lighthouse CI.

Note on scope: `locale` flips direction and chrome, not copy — the template is a
single-locale, Israel-only product by design (₪, +972, ת"י 5568 legal pages). An `en` build
is "an Israeli business in English" and needs its content authored in English.

## One-time agency setup (owner, ~15 minutes)

Do this once; every client site afterwards starts from here.

1. **The template lives at github.com/RLGTEAM/BusinessTemplate (PUBLIC).** Rationale: on the GitHub Free plan,
   branch protection is only enforced on public repos, and public repos get unlimited free
   Actions minutes. The template contains no client data or secrets (`.env` is gitignored;
   `business.json` holds demo content only), and the `LICENSE` file keeps it
   all-rights-reserved — public to view, not licensed for reuse.
   **Client repos are always PRIVATE** — they hold real client data and don't need branch
   protection (Actions minutes on private repos: 2000 free/month, plenty for client CI).
2. **Settings → General → check "Template repository"** — enables "Use this template" for
   client repos with clean history.
3. **Branch protection** on `master`: require the three CI jobs (quality / e2e / lighthouse)
   to pass, require one review. (The job names appear in the checks picker after CI has run
   once — type e.g. "Validate" in the search box.)
4. **Enable the [Renovate GitHub App](https://github.com/apps/renovate)** on the template repo
   only — dependencies stay fresh here; client clones stay frozen at known-good versions.
5. **Cloudflare account**: one agency account; invite developers as members. Each developer
   runs `npx wrangler login` once per machine to be able to deploy.
6. **Onboard a developer**: they need Node ≥ 22 + git. First time in any clone:
   `npm install`, `npx playwright install chromium`, `npx wrangler login`, open the folder in
   Claude Code (MCP servers self-configure — see below), and read [AGENTS.md](./AGENTS.md).
   That's the whole onboarding.

## New client → live site (the per-client flow)

A new client asked for a website. Step by step (the condensed operating
procedure lives in [docs/PLAYBOOK.md](./docs/PLAYBOOK.md)):

1. **Collect the brief** (sales call / intake form) — copy [docs/brief.md](./docs/brief.md)
   and fill it in; it's paste-ready for `/new-client`. Minimum needed — this list mirrors
   Step 0 of the `/new-client` skill, which will ask for anything missing:
   business name + legal name, what they do, address, phone, email, WhatsApp, hours,
   3–6 services with prices, service areas, socials, brand colors (if any), tone/voice
   preferences, photos, and the desired domain.
2. **Create the repo**: template repo → **Use this template → Create a new repository** →
   `client-name` (private). Enable **Dependabot security updates** on it (Settings →
   Advanced Security) — client clones stay version-frozen by design, so security-only PRs
   are their only patch path. Then
   `git clone <client-repo-url> && cd client-name && npm install`.
3. **Fill the site**: open the folder in Claude Code and run **`/new-client`**, pasting the
   brief. It reads the brief (including the scraped raw-texture material), generates three
   design concepts and self-critiques them, commits the chosen concept to `docs/concept.md`,
   reshapes the per-client part of `business.json` + schema, builds every component from
   zero (see [docs/RECIPES.md](./docs/RECIPES.md)) on the quality floor (see
   [docs/DESIGN-DOCTRINE.md](./docs/DESIGN-DOCTRINE.md)),
   enforces the WCAG palette contract, judges the result against the design-review rubric
   (screenshots, max 3 fix rounds), regenerates the OG image + favicon/icon set, and runs the
   full test gate — autonomously, surfacing every provisional fact and placeholder in its final report.
   Doing it by hand instead: edit `src/content/business/business.json`, then
   `npm run validate:content` → `npm run generate:og` → `npm run test` → `npm run test:e2e`.
4. **Real photos**: the skeleton ships no image fields — once the design adds them
   (schema-first, resolved via `resolveImage()`, see `docs/RECIPES.md` recipe 5), drop client
   photos into `src/assets/images/` keeping the filenames (or update the refs in
   business.json). Rebaseline visuals: `npx playwright test --grep @visual --update-snapshots`.
5. **Contact form key**: create a free [Web3Forms](https://web3forms.com) access key **using
   the client's email** (submissions go to that inbox). Put it in `.env` locally
   (copy `.env.example`) — `npm run deploy` builds on your machine, so this is where the
   key has to be.
6. **Push** to the client repo. CI must be green.
7. **Deploy a preview**: `npm run deploy:setup` once, then `npm run deploy:preview`
   (see Deploy section below). The `*.pages.dev` URL is your client-approval link.
8. **Client feedback loop**: every copy/color/price change is a `business.json` edit →
   `npm run deploy:preview`. No code changes for content feedback.
9. **Go live**: buy/point the domain, add it as a custom domain in Cloudflare Pages, set
   `data.seo.siteUrl` in business.json to the final domain, commit (this fixes canonical URLs,
   sitemap, robots, and JSON-LD), then `npm run deploy`.
10. **Post-launch checks**: `npm run deploy` already ran `npm run preflight` (the launch
    gate) — additionally run `npm run build && npm run lhci` against the budgets; validate
    the structured data at [validator.schema.org](https://validator.schema.org) and Google's
    Rich Results test; then `npm run gsc:setup` verifies the domain, adds the Search Console
    property, and submits the sitemap in one command (one-time OAuth setup in
    [docs/PLAYBOOK.md](./docs/PLAYBOOK.md) → Search Console).
11. **Handoff**: confirm the client receives form submissions, hand over Search Console
    access, archive the brief in the client repo (e.g. `docs/brief.md`), and record the
    client in the studio registry + uptime monitor
    ([docs/OPERATIONS.md](./docs/OPERATIONS.md)).

## Commands

| Command                    | Purpose                                            |
| -------------------------- | -------------------------------------------------- |
| `npm run dev`              | Dev server at `http://localhost:4321`              |
| `npm run build`            | Static build to `dist/`                            |
| `npm run preview`          | Serve the built site                               |
| `npm run test`             | Content validation + Biome + `astro check`         |
| `npm run preflight`        | Launch gate: placeholders, skeleton values, OG file, broken links, form key — fails on the skeleton by design; runs inside production deploys |
| `npm run validate:divergence` | Anti-sameness gate: the concept's fingerprint vs `docs/portfolio.json` (skips when no `docs/concept.md`) |
| `npm run sample:palette`   | Dominant colors from `src/assets/images/` → suggested `voice.palette`, pre-checked on the WCAG pairs |
| `npm run test:e2e`         | Playwright smoke + axe a11y tests (builds + serves itself) |
| `npm run test:ltr-build`   | Builds the English/LTR variant and checks its structure    |
| `npm run test:visual`      | Visual regression snapshots (local; rebaseline with `--update-snapshots`) |
| `npm run generate:placeholders` | Starter placeholder art — rename outputs to match your image fields |
| `npm run generate:og`      | Regenerate the OG image + favicon/icon set from business.json name + palette |
| `npm run lhci`             | Lighthouse CI budgets (LCP ≤ 2.5s, TBT ≤ 200ms as the INP lab proxy, CLS ≤ 0.1) — run `build` first |
| `npm run deploy:setup`     | One-time per client: create the Cloudflare Pages project              |
| `npm run deploy`           | Test gate → build → upload `dist/` to Cloudflare Pages                |
| `npm run deploy:preview`   | Build → upload to the `preview` branch (shareable, noindex client-approval URL) |
| `npm run gsc:setup`        | Search Console: verify + add property + submit sitemap (after production deploy) |
| `npm run report`           | Owner report: Search Console clicks/queries/pages + period deltas |
| `npm run setup:skills`     | Install the pinned agent-skill set (once per machine)  |
| `npm run sync:template`    | CLIENT repos: pull template-owned fixes onto a review branch (see `docs/CHANGELOG.md`) |

First e2e run needs `npx playwright install chromium`.

**CI**: `.github/workflows/ci.yml` runs the quality/build/e2e/lighthouse commands above
(including axe-core accessibility checks and the Lighthouse budgets) on every push/PR — the
visual regression suite is local-only (gitignored, per-machine baselines) and `test:e2e` itself
excludes it (`--grep-invert @visual`) everywhere it runs, not just in CI. Recommended: protect
`master` and require the three jobs to pass before merge.

Notes:

- **The template ships as an unbuilt starter shell** — `src/pages/index.astro` is a
  deliberately unstyled contract shell (satisfies the page contract, nothing more) and
  business.json contains `[bracketed]` placeholders plus a neutral palette. `/new-client`
  replaces the shell entirely and deletes `content.shell`.
- Every site auto-generates its SEO/AEO surface from business.json: meta/OG/canonical,
  JSON-LD (one LocalBusiness-subtype node with hours/GBP/reviews + WebSite; FAQPage on the
  page rendering the FAQ; `breadcrumbJsonLd()` for subpages), sitemap, robots.txt,
  **llms.txt** (AI answer engines), web manifest + icon set, a noindex 404 page, and
  security/cache headers (`public/_headers`). Preview deploys ship `X-Robots-Tag: noindex`
  automatically.
- **Legal pages** ship built-in: `/accessibility-statement/` (mandatory for Israeli businesses,
  ת"י 5568 — fill the real coordinator details per client!) and `/privacy/`, both generated
  from `content.legal` and linked in the footer.
- **Cookies & consent**: the template is cookieless by default (self-hosted fonts, cookieless
  Cloudflare Analytics) — no banner needed. Setting `data.analytics.gtagId` or `metaPixelId`
  automatically shows a consent banner and keeps those trackers blocked until the visitor
  accepts (choice persists in localStorage). When enabling a tracker, also update the
  `content.legal.privacy` text to disclose it.
- Visual snapshots are per-machine and NOT committed (gitignored): the first
  `npm run test:visual` creates baselines (that run reports "missing snapshot" — rerun to go
  green). Rebaseline after intentional design changes with
  `npx playwright test --grep @visual --update-snapshots`.
- `renovate.json` keeps the pinned dependencies fresh (enable the Renovate GitHub App on the
  **template** repo only — grouped PRs, majors held for approval). Client clones stay frozen —
  their two patch paths are Dependabot **security** updates (enable per client repo) and
  `npm run sync:template` for template-owned code fixes (`TEMPLATE_VERSION` +
  `docs/CHANGELOG.md` make fleet triage possible; `docs/OPERATIONS.md` is the studio runbook).
- Claude Code users get three skills (`.claude/skills/`): `/fill-brief` (scrape the client's
  public presence into `docs/brief.md`), `/new-client` (the whole concept-build-validate-test
  pipeline), and `/design-review` (the judge that scores the built result).

## MCP setup for AI agents (first time — nothing to install)

The repo ships with `.mcp.json` (declares the servers) and `.claude/settings.json`
(auto-enables them and pre-approves the safe ones). If you use Claude Code, **it just
works on your first session in this folder** — the local servers run via `npx` on demand,
the remote ones connect over HTTP. Run `/mcp` inside Claude Code to see server status.

| Server | What it's for | First-time action needed |
| --- | --- | --- |
| `context7` | Current docs for Tailwind 4, GSAP, Lenis, Zod, Playwright | None |
| `astro-docs` | Official Astro docs (remote, always current) | None |
| `playwright` | Drive a real browser to verify UI/RTL changes | None |
| `chrome-devtools` | Console, network, performance traces | None |
| `lighthouse` | Core Web Vitals / a11y / SEO audits (budgets: LCP ≤ 2.5s, TBT ≤ 200ms as the INP lab proxy, CLS ≤ 0.1) | None (needs Node ≥ 22) |
| `a11y` | axe-core WCAG audits, contrast + ARIA checks | None |
| `github` | Repos, PRs, Actions for the per-client workflow | Set the `GITHUB_MCP_PAT` env var (see below) |
| `cloudflare` | Cloudflare API — Pages deploys, DNS, domains | `/mcp` → authenticate (OAuth). Only needed in CLIENT repos when deploying |

Notes:

- `github` and `cloudflare` are intentionally **not** pre-approved — they can change real
  infrastructure, so Claude asks before each action. The other six are read-only/local and
  pre-approved in `.claude/settings.json`.
- **GitHub auth**: GitHub's MCP server doesn't support the OAuth flow Claude Code uses
  ("does not support dynamic client registration"), so it authenticates with a token instead.
  Create a fine-grained PAT (github.com → Settings → Developer settings → Personal access
  tokens; scope it to your org's repos), then set it once:
  `setx GITHUB_MCP_PAT "github_pat_..."` and restart the terminal. The token is read from
  the environment — never committed. Until it's set, the `github` server just shows as
  disconnected in `/mcp`, which is harmless.
- Skip both infra servers entirely if you don't need them; everything else works without them.
  (`gh` CLI is a fine alternative for GitHub tasks.)
- Other MCP clients (Cursor, VS Code, Windsurf): copy the entries from `.mcp.json` into your
  client's MCP config — the format is identical or near-identical.

## Deploy — Cloudflare Pages

The site is fully static, so **no adapter is needed** (the Cloudflare adapter is only for SSR).

### One-time setup (per client)

```
npx wrangler login          # once per machine
npm run deploy:setup        # creates the Cloudflare Pages project
```

`deploy:setup` names the project from `CLOUDFLARE_PAGES_PROJECT` in `.env` if set, otherwise
from `data.seo.siteUrl` (`https://acme-cafe.co.il` → `acme-cafe-co-il`). It refuses to run
while `siteUrl` is still the placeholder — set the real domain first, or pass
`npm run deploy:setup -- --project=acme-cafe`. The project's production branch is the git
branch you run it from.

### Shipping a new version

```
npm run deploy              # validate + lint + typecheck → build → upload
npm run deploy:preview      # build → upload to the "preview" branch (shareable preview URL)
```

Both print the deployment URL when they finish. Useful flags (after `--`):
`--project=<name>`, `--branch=<name>`, `--skip-build` (upload the existing `dist/`),
`--dry-run`. Deployment history: `npx wrangler pages deployment list --project-name <name>`.

> **`PUBLIC_WEB3FORMS_KEY` must be in your local `.env`.** These commands build on your
> machine, so a key set only in the Cloudflare dashboard is not baked into the upload and the
> contact form ships disabled. The deploy script warns when it is missing.

### Git-connected builds (optional)

If you'd rather have Cloudflare build on every push: dashboard → **Workers & Pages → Create →
Pages → Connect to Git**, framework preset **Astro**, build command `npm run build`, output
directory `dist`, and add `PUBLIC_WEB3FORMS_KEY` as an env var (Production + Preview).
`npm run deploy` still works against a Git-connected project as a manual deploy.

Either way: after setting the custom domain, make sure `data.seo.siteUrl` in business.json
matches it and redeploy — it drives canonical URLs, sitemap, robots and JSON-LD.

## Where things live

See [AGENTS.md](./AGENTS.md) for the folder map, the business.json contract, RTL rules, and
coding conventions. `CLAUDE.md` points AI agents at the same contract. For humans:
[docs/PLAYBOOK.md](./docs/PLAYBOOK.md) is the owner's operating procedure from client call to
live site, and [docs/DESIGN-DOCTRINE.md](./docs/DESIGN-DOCTRINE.md) is the design contract —
the quality floor, the page contract, the divergence hard rules, and the required design
process for building each client site 0→100. [docs/PORTFOLIO.md](./docs/PORTFOLIO.md) +
`docs/portfolio.json` are the anti-sameness memory (`npm run validate:divergence` enforces it). The `design-review` skill
(`.claude/skills/design-review/`) is the judge that scores the built result against that
doctrine's rubric — client repos only, it never ships a `docs/design-review.md` in the template.
