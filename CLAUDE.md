@AGENTS.md

## MCP tools (mandatory)

Declared in `.mcp.json`, pre-allowed in `.claude/settings.json` — use them, don't work from memory:

- **astro-docs** — REQUIRED for Astro questions (config, content collections, fonts, images, view transitions). Official docs server; prefer it over context7 for anything Astro.
- **context7** — REQUIRED before writing code against Tailwind 4, GSAP, Lenis, Zod, or Playwright APIs. These move fast (`astro/zod` is zod v4 — memory will be stale). Resolve the library, query the specific concept, then code.
- **playwright** — REQUIRED for verifying user-visible changes in a real browser (or run `npm run test:e2e`). Don't claim a visual/RTL/animation change works without one of the two.
- **chrome-devtools** — use for performance traces, console errors, and Core Web Vitals checks against the dev server.
- **lighthouse** — run after performance-relevant changes (images, fonts, scripts); budgets are LCP ≤ 2.5s, TBT ≤ 200ms as the INP lab proxy, CLS ≤ 0.1.
- **a11y** — run axe-core checks after touching forms, nav, color tokens, or heading structure.
- **github** / **cloudflare** — available but NOT pre-approved (they mutate real infrastructure and need OAuth via `/mcp`). Always confirm with the user before deploy/DNS/repo mutations. Routine deploys don't need the `cloudflare` server at all — `npm run deploy` covers them (see AGENTS.md → Deploy); reach for the MCP server only for DNS, custom domains, or dashboard-level settings.

## Required agent skills (mandatory)

The build workflow depends on a pinned set of globally-installed agent skills
(`scripts/setup-skills.ts` is the authoritative list): `accessibility`,
`core-web-vitals`, `seo`, `web-design-guidelines`, `gsap-core`, `seo-audit`,
`cro`, `local-seo`, `hebrew-rtl-best-practices`, `hebrew-content-writer`,
`israeli-accessibility-compliance`.

- **Before starting a client build (`/new-client`) or a design/SEO/a11y task**,
  check your available-skills list for these names. If ANY is missing, run
  `npm run setup:skills` first (installs only what's missing; needs network),
  then tell the user to restart the session so the new skills load — newly
  installed skills are not visible until restart.
- Use them at the steps where `/new-client` and `docs/PLAYBOOK.md` call for
  them — don't work from memory in a domain one of these skills covers.

## Claude-specific notes

- After editing `business.json` or `business.schema.ts`, run `npm run validate:content` before anything else — it gives the fastest, clearest error messages (schema, palette contrast, phone/WhatsApp formats).
- `docs/concept.md` (client repos) must carry the machine-readable fingerprint block (`docs/PORTFOLIO.md` → Fingerprint format) — `npm run validate:divergence` reads it and fails the concept on a collision with a shipped site. Write it in `/new-client` Step 1; keep it current when `voice.palette.accent` or `design.fontPairing` change.
- NEVER run `npm run deploy` / `deploy:preview` / `deploy:setup` unprompted — they publish to a real client-facing URL and create real Cloudflare projects. Ask first, every time.
- `npm run test:e2e` builds and serves itself on port 4322, so it can run alongside `npm run dev` (4321). Never point tests at the dev server — dev image transforms are flaky under parallel load and poison visual baselines.
- Windows note: write files as UTF-8 **without BOM** — a BOM in `business.json` breaks `JSON.parse` at build time.
- When asked to "re-theme" or "rebrand", touch only `business.json` (`voice.palette` + copy). If that isn't enough, override tokens (`--shape-radius-*`, `--section-py`, color story) in `src/styles/custom.css` — never inline colors in components.
- The skeleton ships no image fields. When a client design needs images, add fields
  schema-first, then generate starter placeholders with `npm run generate:placeholders`;
  real client photos replace files in `src/assets/images/` keeping the same filenames (or
  update `business.json`).
