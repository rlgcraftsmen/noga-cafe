# Design doctrine — constrain quality, never form

The template ships a **floor** (mechanical, testable rules) and a **toolkit**
(tokens, animation system, content pipeline, recipes). You — the model
building a client site — design the page 0→100 on top of them.
Nothing structural is prescribed; everything structural is available. The test
gate, not a list of allowed layouts, decides what ships.

Every structural suggestion in this repo is a suggestion. The recipes, the
starter shell's section list, the compositions below — raw material, not a
mold. Only the floor, the page contract, the divergence rules, and the Craft
bars are binding; discard the rest whenever the concept is better served
without it. A safe page that fills in the suggested structure is a worse
outcome than a bold page that breaks it beautifully.

**A page is a form before it is a list of sections.** The vertical stack of
full-width color bands is ONE form — and a spent one (see `docs/portfolio.json`).
Equally legal on this floor:

- a document/menu the visitor reads (typographic, ruled, almost no "sections")
- a single pinned scene the scroll transforms
- chapters with radically different layout grammars
- a spine/rail the content hangs off
- a conversation answering the visitor's questions in order
- a map- or photo-first page where text annotates the image

The concept names its form FIRST — that name is the fingerprint's `pageForm`
slug — then decides what the nav means inside it (anchors must still resolve;
where they point is the design's call). No form excuses the page contract.

## The floor (non-negotiable)

The engineering floor is canonical in `AGENTS.md` — RTL rules, animation
rules, the business.json contract, conventions, and the gate + Lighthouse
budgets (AGENTS.md → Commands). Design-side additions:

- Text sits only on validated contrast pairs — the 9-pair list lives in
  `scripts/lib/color.ts` and is enforced by `npm run validate:content`;
  `text-primary` on `bg-surface`, text on dark surfaces is `text-surface`.
  A new color-as-text pair → add it to `contrastPairs()` first.
- Reduced motion = static page. Design the still frame first; all motion
  lives inside the matchMedia guard (AGENTS.md → Animation rules).
- Decorative elements: `aria-hidden="true"` + `pointer-events-none`.
- Divergence from shipped sites is mechanized: `npm run validate:divergence`
  must pass on the concept's fingerprint before any page code (rules in
  `scripts/lib/divergence.ts`, story in `docs/PORTFOLIO.md`).

## The page contract (what every site must keep)

- Exactly one `h1`.
- Every `content.nav` link of the form `#id` resolves to a real element id;
  sections use `<section id="…">` + `scroll-mt-20` + the `section-pad` utility.
- A `body > footer` containing links to the two legal pages
  (accessibility statement is a legal requirement in Israel, ת"י 5568).
- The frozen `content` core stays intact: `nav`, `ui`, `consent`, `notFound`,
  `legal`. Hebrew sites keep a bidi test line (Hebrew + Latin + ₪) in visible
  body copy.
- A clear contact path (form, WhatsApp, or phone) reachable from the nav.
- The two legal pages (`/accessibility-statement/`, `/privacy/`) are part of
  the design, not an appendix: every build restyles them into the concept's
  design language — typography scale, color story, back-link treatment.
- `content.faq` is the canonical OPTIONAL shape feeding FAQPage JSON-LD +
  llms.txt — include it (real Q&A) whenever the business has FAQs.
- The contract-driven smoke suite passes with ZERO edits. New user-visible
  behavior gets **added** tests in the client repo; never weaken the suite.

## Divergence (hard rules)

A site that passes the floor and the page contract can still be the
reference template with different words on it. These are binding for every
client build, enforced at the concept stage in `/new-client` Step 1:

1. A bespoke hero treatment — a hero designed for this client, not a generic
   centered-headline default.
2. At least one fully bespoke section.
3. A signature motion implemented in `registerCustomAnimations()`
   (`src/lib/animation/custom.ts`).
4. A non-default color story — no all-default-white page unless
   `docs/concept.md` explicitly argues light-minimal serves THIS client.
5. The page must not contain shell markup or `content.shell`.
6. A **nav concept** and a **choreography plan** written in `docs/concept.md`
   (Craft bars 2 and 3 below name what they must cover).
7. The concept's fingerprint collides with no shipped site:
   `npm run validate:divergence` exits 0 (format: `docs/PORTFOLIO.md` →
   Fingerprint format; spent material: `npm run validate:divergence -- --summary`).

The design-review skill (`.claude/skills/design-review/SKILL.md`) is the
single source for how the built result is judged — this doc doesn't restate
the scoring. A site that fails that review isn't finished, even with a green
test gate.

## Craft bars (what top-tier means)

Passing the floor, the page contract, and divergence proves the site is legal
and different — not that it's good. Design to these from the first pass:

1. **Mobile-first — the phone is the primary canvas.**
   - Compose at 390px FIRST; desktop is the adaptation, never the reverse.
   - Primary CTA thumb-reachable; a sticky mobile contact bar (RECIPES 9) is
     the strong default for service businesses.
   - Type scale holds at 390 — no truncation, no horizontal overflow; no
     information exists only on hover; full-height heroes use `100dvh` +
     safe-area-insets.
   - **Mobile-first is NOT stack-first**: design the unusual form AT 390 from
     the start — a pinned scene, a document page, a rail all have native 390
     expressions that are not a band stack. A concept may not be rejected FOR
     its 390 behavior unless its 390-native composition was actually attempted.
2. **The header is a designed component, not chrome.** All three mandatory:
   - scroll-aware response past a threshold (mechanics: RECIPES 7);
   - active-section indication — `aria-current` plus a visible state, not
     color alone;
   - a DESIGNED mobile drawer — staggered entrance, full styling (a11y floor:
     RECIPES 2).
   Before design review, OPERATE the nav in a real browser at 390 and desktop,
   at scroll-0 AND mid-page (the verify pass in `/new-client` Step 4).
3. **Aliveness — one identity, MANY expressions.** One motion IDENTITY —
   consistent easing, direction, character — expressed across a REQUIRED
   five-part inventory, never as a single repeated trick: (a) hero entrance
   choreography, a sequenced timeline, never one fade; (b) at least two
   scroll-driven moments — parallax, scrub, pin, or counter (helpers in
   `src/lib/animation/helpers.ts`); (c) micro-interactions on EVERY
   interactive element — hover/focus/press with motion on buttons, links,
   cards; (d) at least one continuous ambient motion — marquee, drift, slow
   rotation; (e) varied `data-reveal` presets tuned per section, never the
   same preset everywhere. All five stay inside the reduced-motion guard —
   the still frame remains complete without any of them.
4. **Anti-AI tells.** Named list to avoid — the judge checks for these:
   - *Classic tells*: uniform same-radius card grids of three; emoji as icons
     (inline SVG only); center-aligning everything; generic gradient blobs or
     purple-indigo defaults; a hero that's headline + two buttons + a
     stock-photo overlay; identical section rhythm down the page (same
     padding, same alternation); Tailwind-default shadows everywhere;
     decorative English labels sprinkled on a Hebrew site.
   - *Editorial-courage tells*: more than two distinct corner radii on the
     page (pick ONE shape idea and commit); the page's largest content block
     rendered as a uniform bordered-card grid (a menu is a menu, a list is a
     list); nothing beyond the hero bleeding, overlapping, or breaking the
     column at 390 (16–32px "broken grid" offsets are invisible on a phone);
     the accent color appearing ONLY as button fill.
   - *Prescribe instead*: intentional asymmetry; at least one overlap or
     broken-grid moment that survives at 390; display-to-body type-scale
     contrast of 3x or more; bespoke inline-SVG iconography/motifs derived
     from the concept.

## The toolkit (pointers, not restatements)

- **Tokens**: `src/styles/global.css` — brand colors + neutrals from
  `voice.palette` (dark sites are first-class); shape/rhythm via
  `--shape-radius-card` / `--shape-radius-button` / `--section-py`,
  overridden per client in `custom.css`, never literal radii or `py-*`.
- **Fonts**: `design.fontPairing` — fifteen self-hosted Hebrew-capable
  pairings; `astro.config.mjs` documents each one's personality. `handmade`
  (Amatic SC) is display-only — headings, never body copy, never long
  headings. Components only use `font-display` / `font-sans`.
- **Recipes**: `docs/RECIPES.md` — the markup contracts for nav, form,
  sections, contact bar, subpages, open-now.
- **Animation**: presets, tuning attributes, `registerCustomAnimations()`,
  and the three aliveness helpers are specified in AGENTS.md → Animation
  rules and `src/lib/animation/helpers.ts`'s doc comment.
- **Composition**: `src/pages/index.astro` ships as an unbuilt contract
  shell — replace it entirely; delete `content.shell`.
- **Schema**: `data` + `voice` are frozen; the per-client `content` region is
  reshaped schema-first (`business.schema.ts` → `business.json` →
  components via `getBusiness()`).

## The design process (before any code)

Write the concept in four lines — if you can't, it isn't one concept yet:

1. **Metaphor** — one thing from the client's world their customers instantly
   recognize, derived from quoted brief evidence (see `/new-client` Step 1a).
   Name it as a kebab-case family slug; `npm run validate:divergence` rejects
   a family already in `docs/portfolio.json`.
2. **Color story** — the LOGIC by which color moves through the page and
   where the accent burns brightest (usually the CTA). A band rhythm is one
   logic among many — a single dramatic turn, one saturated world,
   ink-on-paper with a single burning object, a duotone all qualify.
   Coherent intent, not stripes.
3. **Composition** — name the page FORM first (the list at the top of this
   doc), then the actual page: what exists, in what order, and why that
   order serves this business.
4. **Motion identity** — one recognizable identity (easing, direction,
   character), expressed across the aliveness inventory (Craft bar 3),
   including which `data-reveal` presets each section gets.

Then write the fingerprint block into `docs/concept.md` (format:
`docs/PORTFOLIO.md` → Fingerprint format) and run `npm run validate:divergence`
before any code.

Plus the reduced-motion still frame: the page must look complete without any
motion. ONE concept, expressed everywhere it helps — incoherence, not
quantity, is what reads as noise.
