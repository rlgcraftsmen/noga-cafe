# Template changelog

The version lives in `TEMPLATE_VERSION` (calver, bumped whenever a change is
worth propagating to client repos). Client repos pull template-owned files
with `npm run sync:template`, which compares versions and stages a review
branch — read the entry for every version between yours and the template's
before merging.

Entry tags:

- **[safe-to-sync]** — template-owned files only; a normal diff review is enough.
- **[review]** — changes a contract (schema shape, test expectations, markup
  contract) that a client site may have built against; read the notes and
  check the named surfaces before merging.

## 2026.08.23

Sources, not filters: the anti-sameness rules stop being prose and become
scripts, and every rule gets exactly one canonical home.

- **[review]** `docs/portfolio.json` + `npm run validate:divergence` — the
  five shipped fingerprints are machine-readable, and `/new-client` Step 1
  fails on a repeated metaphor family, a (fontPairing + accent hue family)
  already shipped, or a (pageForm + metaphorFamily) already shipped (that
  last one can never be argued away). CLIENT REPOS: a `docs/concept.md`
  that predates this version has no fingerprint block — add one
  (`npm run validate:divergence -- --print-template`) before the next
  design-review round, or the validator exits 2.
- **[safe-to-sync]** `npm run sample:palette` (`scripts/sample-palette.ts`) —
  dominant colors from `src/assets/images/`, roles assigned and auto-nudged
  against the same 9 WCAG pairs `validate:content` enforces. The palette is
  sampled from the client's photographs, not invented (PORTFOLIO's #5 lesson).
- **[review]** `scripts/lib/color.ts` — luminance/contrast/the 9-pair table
  factored out of `scripts/validate-content.ts`; the validator, the sampler,
  and the divergence check share one copy. A client repo that ADDED a
  contrast pair to `validate-content.ts` must move it to `contrastPairs()`
  in `scripts/lib/color.ts`, or the sync drops it. Output text unchanged.
- **[safe-to-sync]** `docs/portfolio/<client>.png` — 390-wide full-page
  screenshots of shipped sites; design-review's Distinctiveness axis is now
  COMPARATIVE ("which of these came from a different studio?", citing prior
  entries by name). Screenshots are backfilled by the operator; the pass
  degrades gracefully while any are missing.
- **[safe-to-sync]** Doc restructure — one canonical home per rule. AGENTS.md
  owns the engineering floor (gate + budgets, no-new-deps, palette contract →
  `scripts/lib/color.ts`); DESIGN-DOCTRINE lost its exhortation essays and
  now points instead of restating; RECIPES cites TRAPS by number instead of
  re-explaining (TRAPS 11 absorbed the containing-block property list);
  PORTFOLIO.md is narrative memory + the Fingerprint format spec (the table
  moved to portfolio.json; spent-material counts come from
  `validate:divergence -- --summary`, so they can never drift). Skills are
  process-only and reference the canonical docs.
- **[review]** `docs/CLIENT-SITE-GUIDE.md` DELETED (unique content folded
  into README/PLAYBOOK). `npm run sync:template` now REMOVES it from client
  repos (new REMOVED_PATHS mechanism); if you edited it locally, copy
  anything you still want out before syncing.
- **[safe-to-sync]** `sync:template` now also syncs `docs/TRAPS.md`,
  `docs/PORTFOLIO.md`, `docs/portfolio.json`, `docs/portfolio/` and
  `.claude/skills` — all previously stranded at clone-time versions in every
  client repo.
- **[safe-to-sync]** `preflight` gained a warn-only divergence pass (a samey
  site is not a launch blocker, but launch is the last moment to notice);
  CI runs `validate:divergence` (skips with exit 0 in the template).

## 2026.08.16

Wall-clock + anti-sameness release: the mechanism every build re-derived by
hand now ships headless, and the workflow gained cross-client memory.

- **[safe-to-sync]** `src/lib/nav.ts` — headless nav mechanics behind data
  attributes (RECIPES 2+7): drawer a11y/focus-trap/scroll-lock/Escape,
  frame-deferred `data-open`, `data-scrolled` on `[data-site-header]`,
  `aria-current` scroll-spy, `[data-contact-bar]` tuck. Wired in BaseLayout;
  inert without the attributes, so syncing is safe — but a client site can
  DELETE its hand-rolled drawer/scroll-state scripts on adopting the
  attributes (that adoption step is [review]: keep either the helper or the
  hand-rolled script, never both — double listeners). Scroll STATE now runs
  outside the reduced-motion guard (reduced-motion users previously lost
  `aria-current` and the scrolled tint — an a11y fix).
- **[safe-to-sync]** `src/lib/hours.ts` + `tests/hours.spec.ts` — headless
  open-now (Asia/Jerusalem, midnight-crossing ranges, specialHours,
  idle-deferred off the LCP path), `serializeSchedule()`, RECIPES recipe 11.
- **[review]** BaseLayout preloads ONLY the display font face — the second
  preload measurably delayed the LCP image (~230ms on a build at the 2.5s
  ceiling). If a client's LCP is TEXT rendered in the body face, re-add its
  preload locally with a comment.
- **[safe-to-sync]** `docs/TRAPS.md` — measured failures from shipped
  builds (SVG-filter TBT, ICU timezone cost, stale ScrollTrigger ends,
  focusable-at-opacity-0, force-ltr block flips, tap targets). The
  new-client report now REQUIRES a "Promote candidates" section so the
  promote loop actually runs.
- **[safe-to-sync]** `docs/PORTFOLIO.md` — design fingerprints of shipped
  sites; the anti-sameness memory. Doctrine: page forms, de-banded color
  story, "mobile-first ≠ stack-first", editorial-courage anti-AI tells.
  new-client: portfolio distance requirements + selection rules + prose
  budgets + mid-build lhci checkpoint. design-review: fresh-eyes subagent
  is authorized by skill invocation; Distinctiveness judged against the
  portfolio; Color story accepts any coherent logic.
- **[safe-to-sync]** `.is-locked` body scroll-lock utility in `global.css`
  (used by nav.ts).

## 2026.08.14

First versioned release. Includes the full audit-hardening pass:

- **[review]** Hours rendering changed shape — `docs/RECIPES.md` recipe 6
  (footer) now maps `entry.ranges` and renders an explicit closed state. A
  client footer copied from the old recipe (`entry.open`/`entry.close`) will
  fail `astro check` until it is updated.
- **[safe-to-sync]** Guards proven by tests rather than trusted:
  `tests/schema.spec.ts` (unknown keys, duplicate weekdays, zero-length
  ranges, impossible dates, wa.me/gtag formats) and `tests/consent.spec.ts`
  (consent is actually withdrawable). `validate:content` now also walks the
  schema and fails if any object is non-strict.
- **[safe-to-sync]** Fixes found by adversarial review of this same pass:
  the reopened consent banner had dead Accept/Decline buttons; a production
  deploy after a preview deploy could re-upload the preview's
  `X-Robots-Tag: noindex` and de-index the live site (`--skip-build` path);
  `npm run report` compared a top-15 current window against a top-1000
  previous one, making every delta wrong; preflight now rejects the skeleton
  audit/statement dates and catches a missing FAQPage emission.

- **[safe-to-sync]** `scripts/preflight.ts` launch gate (+ `npm run preflight`,
  wired into production deploys); validator additions (star codes, hours
  ranges, real-date checks); generator overwrite guards; OG generation moved
  to headless Chromium (correct Hebrew rendering).
- **[safe-to-sync]** Runtime fixes: capture-phase anchor scrolling with
  scroll-margin + focus handling (skip link works under Lenis); consent
  banner single-load + canonical gtag/fbq stubs; form status/label/timeout
  fixes; conversion tracking (`src/lib/track.ts` — tel:/wa.me/lead events).
- **[review]** `business.schema.ts` is now `.strict()` everywhere — a client
  JSON with a stray key that was previously ignored will now FAIL the build
  (that key was dead weight; delete it or add it to the schema).
- **[review]** Hours shape changed: `{open, close}` → `ranges: [{open,
  close}]` with explicit closed days, plus optional `specialHours`. Client
  components that render hours must switch to `h.ranges`.
- **[review]** JSON-LD: single business node (Organization node removed),
  `@type` from new `data.schemaType`; new fields `data.local.*`,
  `data.reviews`, `data.companyId`, `data.seo.logo`, optional address +
  `city`. Smoke test JSON-LD assertion updated accordingly.
- **[review]** Legal frozen core extended: statement gains known
  limitations, physical accessibility, coordinator role, audit date +
  labels; privacy gains statement date; optional `legal.terms` shape.
  Client `business.json` files need the new fields (copy from the skeleton
  and fill).
