---
name: new-client
description: Build a client site 0→100 from a brief — concept generation + self-critique → schema-first content → bespoke page design → validation → full test gate. Runs autonomously without stopping for input. Use when starting a new client site, rebranding one, or applying a client brief.
---

# New client build (autonomous)

Turn `docs/brief.md` into a designed, validated site. Run WITHOUT stopping for
user input: make the best call, record it, and surface every assumption in the
final report. Read `docs/DESIGN-DOCTRINE.md` first — it is the design contract
(the floor, the page contract, the Craft bars); `AGENTS.md` is the engineering
contract. This skill is PROCESS — it references those docs and never restates
their rules.

## Execution plan — pipeline, don't queue

Wall-clock discipline for the whole build. Three rules:

1. **Fail fast, validate continuously.** Run the cheap checks the moment their
   inputs change, never saved up for Step 6: `npm run validate:content` after
   EVERY `business.schema.ts`/`business.json` edit (seconds, and its errors
   are the clearest); `npm run lint` + `npm run typecheck` after each code
   phase. Step 6's slow suites (e2e, ltr-build, visual) then run ONCE as
   confirmation — a schema error discovered in Step 6 costs a full rebuild
   cycle; discovered in Step 2 it costs seconds.
2. **Fan out independent work with subagents** (when an agent-dispatch tool is
   available). The dependency chain is: concept → schema+content+palette →
   `custom.css` tokens/color story → everything else. Once the color story is
   in `custom.css`, run these as parallel subagents while you compose
   `index.astro` (never fan out two agents that write the same file):
   - **Legal-pages restyle**: a subagent that reads `docs/concept.md` +
     `src/styles/custom.css` and restyles ONLY
     `src/pages/accessibility-statement.astro` + `src/pages/privacy.astro`.
   - **OG + icon generation** (`npm run generate:og`): any time after
     `business.json` + palette are final.
3. **Shift the review left.** After the hero and the first two sections
   exist, take ONE 390-wide screenshot of the real page and self-check it
   against the doctrine's Craft bar 4 (anti-AI tells) and the concept's still
   frame. At the SAME checkpoint run `npm run build && npm run lhci` once
   (~90s): every shipped build has failed a Lighthouse budget at the final
   gate, after the expensive decisions (hero LCP strategy, fonts, textures)
   were locked — `docs/TRAPS.md` lists what usually breaks the budgets.
   Course-correct now, while a change costs minutes.

## Step 0 — Ingest the brief

- Facts are tagged `[scraped]` or `[client-confirmed]`. Scraped-only NAP,
  prices, and hours are PROVISIONAL: use them, and list each in the final
  report under "confirm with client before launch".
- Missing required facts: do NOT stall. Insert a clearly-marked placeholder
  and add it to the report's blocking list.
- Geo coordinates (`data.contact.geo.lat`/`.lng`): if the brief has no
  `[client-confirmed]` coordinates, geocode the real address yourself
  (WebSearch — read the lat/lng off a Google Maps pin) and tag the result
  `[scraped]`/provisional in Step 7's confirm-with-client list. NEVER leave
  the skeleton's demo coordinates — they validate fine but ship a wrong map
  pin in the LocalBusiness JSON-LD.
- The "raw texture" section is the design material — Step 1a mines it before
  anything is invented.

## Step 1 — Concept (before any code)

### 1a. From raw texture to concept (sources before filters)

The template's rules are FILTERS. They cannot make a concept distinctive —
only the client's own material can. Derive, don't invent:

1. **Quote-mine the brief.** Pull 6–10 verbatim fragments from its Raw
   texture — reviews, the business's own repeated phrases, the photo
   descriptions — into your working notes.
2. **Metaphor candidates must cite evidence.** Every candidate names ≥ 2 of
   those quotes as its source. A metaphor with no quote behind it is a model
   prior, not a concept — discard it.
3. **Sample the palette, don't imagine it.** `npm run sample:palette` when
   the client's photos are in `src/assets/images/`. The color story starts
   from those hexes; an invented palette needs one sentence in
   `docs/concept.md` saying why the photographs don't serve.
4. **Pick the pairing from what's unused.**
   `npm run validate:divergence -- --summary` prints which of the fifteen
   pairings, metaphor families, page forms, and accent families the portfolio
   has already spent. Choose from the unused sets unless `docs/concept.md`
   argues the repeat. (No shell available? Read `docs/portfolio.json`
   directly.) Read `docs/PORTFOLIO.md` once for WHY this matters — the
   measured sameness story and the nook-cafe lesson.

### 1b. Three candidates

Generate THREE distinct concept candidates in the doctrine's four-line format
(metaphor / color story / composition / motion identity + still frame).
When an agent-dispatch tool is available, generate them as three PARALLEL
subagents, each given the brief + doctrine + the `--summary` output and a
different forcing lens (e.g. "the client's craft as material", "the
customer's moment of need", "break the section-stack"). Judge and pick
inline yourself.

- Each candidate NAMES its page form (doctrine's forms list) as a kebab-case
  slug, and the three candidates must not all share one form. At least ONE
  candidate breaks from the section-stack structure in some real way — and
  per Craft bar 1, that candidate is sketched AT 390 FIRST, as a native phone
  composition, before any judgment about it.
- Self-critique each against: (a) would this client's customers recognize it
  instantly, (b) feasibility on the floor (contrast pairs, RTL, reduced-motion
  still frame), (c) distance from every shipped fingerprint AND from the
  generic AI-site look, stated explicitly per candidate.
- **Selection rules:** a candidate may be rejected only for failing THIS
  client or the floor — never for being unusual; "degrades at 390" is not a
  valid rejection unless its 390-native sketch was actually attempted; if the
  safe section-stack wins over the structure-breaker, `docs/concept.md` must
  argue in one or two sentences why the breaker fails this client
  specifically. When two candidates serve the client equally, the one further
  from the portfolio wins.

The chosen concept MUST satisfy the doctrine's Divergence hard rules 1–7 —
including the **nav concept** (how the header expresses the concept, its
scroll-aware behavior, the drawer's design) and the **choreography plan**
(Craft bar 3's five categories mapped to actual sections; a 5-row table
works well) as written prose in `docs/concept.md`.

Write `docs/concept.md`: the chosen concept in at most ~500 words plus the
nav-concept and choreography-plan sections; each rejected candidate in ~60
words including why it lost and what was kept. The build reads the concept,
not an essay.

### 1c. Fingerprint + validate (gate — before any code)

Write the fingerprint block into `docs/concept.md` (format:
`docs/PORTFOLIO.md` → Fingerprint format;
`npm run validate:divergence -- --print-template` prints an empty one), then:

    npm run validate:divergence

It must exit 0 before you write a line of page code. On a collision: change
the concept, or — only when the client's world genuinely demands the repeat —
add an `argues` entry naming the specific prior client and why. A
(pageForm + metaphorFamily) collision cannot be argued away; that is the same
site twice.

Commit the concept alone: `feat: design concept for <client>`.

## Step 2 — Schema-first content

- `data` + `voice` + the frozen content core (`nav`, `ui`, `consent`,
  `notFound`, `legal`): fill completely, never reshape.
- Author the per-client content region from scratch (only canonical optional
  `faq` is predefined): reshape `business.schema.ts` to match the page you
  designed in Step 1, then write the JSON. Copy NEVER lives in components.
  (`content.shell` is deleted in Step 4, in the same change that replaces
  `index.astro` — not here; the starter page throws if `shell` is missing
  while it's still the page rendering.)
- `legal.accessibility.coordinator` needs REAL details (legal requirement,
  ת"י 5568). If the brief lacks them, use a placeholder AND flag it as
  BLOCKING — first line of the final report.
- Trackers only if explicitly requested (auto-enables consent banner; rewrite
  `legal.privacy` to disclose them).
- Author ALL `content` copy in `business.locale`'s language — the bidi test
  line below is the one deliberate, isolated exception. Hebrew sites keep a
  bidi test line (Hebrew + Latin name + ₪ price) in visible body copy — the
  smoke suite scans for it. Make it read as real copy the client's own
  business would plausibly say (an imported product, a partner brand, a
  delivery-app mention at a real ₪ price) — never a sentence invented purely
  to pass the test.
- Respect `voice` in every sentence. Save UTF-8 WITHOUT BOM.
- Hebrew sites: invoke the `hebrew-content-writer` skill (if installed)
  before authoring copy — pick the register deliberately (dugri vs. business
  vs. formal) from `voice`, use ktiv maleh, and keep gendered address
  consistent across every string. Copy quality is a rubric axis, not polish.
- Sweep: `rg '\[[^0-9"][^"]*\]' src/content/business/business.json` — only
  deliberate flagged placeholders may remain, and every one goes in the
  report. (Don't use a bare `rg "\["` — it matches every JSON array opening.)

## Step 3 — Palette

Run `npm run sample:palette` first: with client photos in
`src/assets/images/`, the palette is sampled, not invented — inventing one
needs a stated reason in `docs/concept.md` (PORTFOLIO's #5 lesson). The
sampler pre-checks the same 9 WCAG pairs `validate:content` enforces
(contract: AGENTS.md → Palette contract; pair list: `scripts/lib/color.ts`).
Paste the suggestion into `voice.palette` (adjusting for the concept's color
story), run `npm run validate:content`, and note any nudge in the report.
Dark or deep-tinted palettes are first-class. A new color-as-text pair → add
it to `contrastPairs()` in `scripts/lib/color.ts` in the same commit.
If the palette's accent changed hue family from the fingerprint, update the
fingerprint and rerun `npm run validate:divergence`.

## Step 4 — Design and build the page

Execute the committed concept, 0→100:

- Build order is mobile-first: compose at 390, then adapt up (Craft bar 1) —
  never desktop-first.
- Compose `src/pages/index.astro` yourself, replacing the starter shell
  entirely, and in the SAME change DELETE `content.shell` from schema+JSON.
  Build every component from zero. Consult `docs/RECIPES.md` for the
  RTL/a11y-correct markup contracts — recipe 7 (scroll-aware header) and
  recipe 9 (mobile sticky contact bar) are mandatory for the Craft bars.
  Forms are optional — only if the client wants one, wired to the headless
  helper (RECIPES 3).
- Shape/rhythm: override `--shape-radius-card`, `--shape-radius-button`,
  `--section-py` in `src/styles/custom.css`; color story with tokens +
  `color-mix()` there too. Pick `design.fontPairing` to match the concept
  (Step 1a rule 4).
- Honor the page contract (doctrine): one `h1`, nav `#id` links resolve,
  footer with legal links, contact path reachable, decorative =
  `aria-hidden` + `pointer-events-none`.
- The header's MECHANICS are shipped: `src/lib/nav.ts` provides the drawer
  behavior, `data-scrolled`, `aria-current`, and the contact-bar tuck off
  the markup contract in RECIPES recipes 2 + 7 — **write no drawer or
  scroll-state script; author markup + CSS only** (bespoke header MOTION
  still goes in `custom.ts`, driven off the same attributes). An open-now
  status, if the design wants one, is `src/lib/hours.ts` via RECIPES
  recipe 11 — never reimplemented.
- **Nav verify pass** (the judge automatic-fails broken nav mechanics): open
  the REAL page in the Playwright MCP browser at 390 and at desktop width
  and OPERATE the nav — toggle open/close, press Escape, click a nav link
  (drawer closes, page lands on the right section, nothing clipped under
  the sticky header), confirm the scrolled state and `aria-current` styling
  trigger, confirm the open drawer sits fully styled ABOVE all page content.
  **Run the 390 pass at the top of the page AND after scrolling to
  mid-page** — the containing-block trap (TRAPS 11) is CSS-side and only
  breaks in the scrolled state; follow RECIPES 2's canonical structure.
- Restyle the legal pages into the concept's design language — this is the
  Execution plan's parallel subagent: dispatch it as soon as the color story
  lands in `custom.css`. They are part of every build, not an appendix (page
  contract).
- Motion: the concept's ONE motion identity across the aliveness inventory
  (Craft bar 3). Entrances via `data-reveal` presets and their tuning
  attributes; bespoke motion in `registerCustomAnimations()`
  (`src/lib/animation/custom.ts`); helpers per AGENTS.md → Animation rules.
- New user-visible behavior → ADD a test in the client repo. The contract
  smoke suite is never edited.
- Section order and CTA placement are conversion decisions, not aesthetics:
  the contact path must be reachable within one thumb-move at every scroll
  depth, and the first viewport answers "what, where, why you" before any
  decorative band. The `cro` skill (if installed) is the checklist — apply
  it while composing, not after.
- Before Step 5.5, self-check against DOCTRINE Craft bar 3 (the five-part
  aliveness inventory) and Craft bar 4 (the named anti-AI tells) — read them
  there; do not work from memory. The judge automatic-fails an incomplete
  inventory. Run the `web-design-guidelines` skill's checklist (if
  installed) in the same pass.
- Also verify `docs/concept.md` actually contains the nav concept and the
  choreography plan AS WRITTEN PROSE — design-review caps Concept expression
  at 2 if either is missing.

## Step 5 — Images + OG

Client photos into `src/assets/images/`; add image fields to the client
schema as the design needs (schema-first, resolved via `resolveImage()` per
`docs/RECIPES.md` recipe 5). Regenerate the OG image + favicon/icon set:
`npm run generate:og`. Every image still showing a placeholder goes in the
report.

## Step 5.5 — Design review (the judge)

Invoke the `design-review` skill against the built site. It owns the rubric,
the automatic-fail checks, and the comparative distinctiveness pass — do not
inline them here. The build must reach PASS, or exhaust the skill's 3 rounds
with every round's verdict logged to `docs/design-review.md`, before moving
to the final gate.

## Step 6 — Gate (all must pass; fix, don't skip)

```
npm run test
npm run test:e2e
npm run test:ltr-build
npm run build && npm run lhci
npx playwright test --grep @visual --update-snapshots
npm run validate:divergence
npm run preflight
```

If the Execution plan's continuous validation was followed, `npm run test`
is a seconds-long confirmation. The slow suites run once, in this order
(ltr-build rebuilds `dist/` to the EN locale, so the plain `npm run build`
after it restores the real locale for `lhci` and the snapshots). The
budgets are AGENTS.md → Commands; a budget failure is a build defect, not an
ops problem. The `--update-snapshots` run CREATES the visual baselines for
this fresh design. `validate:divergence` re-confirms the fingerprint after
any fix-round accent/pairing changes.

`npm run preflight` last: it reports every remaining launch blocker — copy
its output verbatim into the report's BLOCKING section. Do not "fix" a
preflight failure by inventing data.

## Step 7 — Report

End with exactly these sections:

1. **BLOCKING** — placeholder accessibility coordinator, missing legal facts.
2. **Confirm with client before launch** — every `[scraped]`-only NAP /
   price / hours fact, verbatim, plus any unverified/geocoded geo
   coordinates (Step 0).
3. **Placeholders remaining** — images, testimonials, copy awaiting real
   content.
4. **Design decisions** — concept (link `docs/concept.md`), palette
   provenance (which hexes came from `sample:palette`, which were nudged for
   contrast, any invented with the stated reason), fontPairing, composition
   summary — plus TWO handoff artifacts:
   a. the **fingerprint object** copied verbatim out of `docs/concept.md`'s
      block, with `"screenshot": "portfolio/<client>.png"` added, ready to
      append to the TEMPLATE repo's `docs/portfolio.json` `entries` array;
   b. the **390-wide full-page screenshot** taken in Step 5.5, named
      `<client>.png`, for the template's `docs/portfolio/`.
   PLAYBOOK step 9 is where the operator files both. Skipping either
   re-creates the sameness problem for the next client.
4b. **Promote candidates** — REQUIRED, even if empty (then say why). Every
   trap discovered (a measured regression → `docs/TRAPS.md` entry), and
   every broadly-useful invention (a pattern → RECIPES, logic → a headless
   `src/lib` helper, a token/preset) with a one-line generalization sketch.
   Past builds fixed template-level defects in the client repo only, and
   every later client paid for them again.
5. **Deploy checklist** — `data.seo.siteUrl` matches the real domain;
   `PUBLIC_WEB3FORMS_KEY` is in the local `.env`, created with the CLIENT's
   email; then `npx wrangler login` → `npm run deploy:setup` →
   `npm run deploy:preview`. Do NOT run any deploy command yourself — list
   them for the operator.
6. **After production deploy (operator steps, list them)** — Google Search
   Console: `npm run gsc:setup` twice (write token → commit + redeploy →
   verify + submit; OAuth setup in `docs/PLAYBOOK.md`). Then the local-SEO
   basics: Google Business Profile exists and links to the site, NAP on the
   site matches the GBP listing exactly (the `local-seo` skill, if
   installed, is the checklist).
