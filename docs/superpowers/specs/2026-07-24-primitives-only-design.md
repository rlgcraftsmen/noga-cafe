# Primitives only — no prebuilt design (Phase 3)

**Date:** 2026-07-24
**Status:** Approved (design)

## Problem

After the model-first inversion (2026-07-23) and Loosening Phase 2 (2026-07-24),
generated client sites still converge. Root cause: any shipped, working design is
an anchor. As long as `components/sections/` renders a complete site, the model
gravitates toward it — "reference library" in practice becomes "the default."

## Decision

**The template ships rules, quality gates, and plumbing — zero prebuilt design.**
Every section, page composition, header, footer, and UI primitive is built from
nothing, per client, under the doctrine, the recipes, and the design-review judge.

Owner decisions (binding):
- Form logic survives as a **headless opt-in helper** (`src/lib/form.ts`) — not
  every client needs a form; the helper activates only when contract markup exists.
- Fresh clone renders a **bare contract shell**: deliberately unstyled markup that
  satisfies the page contract and visibly says "not designed yet — run /new-client".
- **All three ui/ primitives are deleted** (Container, SectionHeading, Button) —
  a shared Button is a sameness vector like any other.

## Deletions

- `src/components/sections/` — all ten files (Header, Hero, Services, About,
  Testimonials, Gallery, FAQ, CTA, ContactForm, Footer).
- `src/components/ui/Container.astro`, `SectionHeading.astro`, `Button.astro`
  (ConsentBanner stays — legal machinery).
- The composed default page in `src/pages/index.astro`.
- The per-client content shapes in `business.schema.ts` and the `business.json`
  skeleton (hero/services/about/testimonials/gallery/faq/cta/contactForm/footer
  as shipped shapes). The model authors the per-client region per client,
  schema-first, as already established.

## The starter shell

`src/pages/index.astro` becomes plain, unstyled, semantic markup that:
- satisfies the page contract: nav whose `#id` links resolve, exactly one `h1`,
  `body > footer` with the two legal links, a tel/WhatsApp contact link, the
  bidi test line visible (Hebrew locale);
- reads ONLY the frozen content core + `data` + a new optional `content.shell`
  block (`headline`, `note`, `bidiSample`) that exists solely for the shell;
- displays clearly that the site is not built ("run /new-client");
- passes the full gate (smoke, axe, LTR build, Lighthouse — trivially).

`/new-client` deletes `content.shell` (schema + JSON) when it builds the real
site; the shell block ships in the template skeleton only.

## Headless form plumbing — `src/lib/form.ts`

- `setupContactForms()` wired once in BaseLayout on `astro:page-load`; no-op when
  the page has no `form[data-contact-form]`.
- Markup contract (documented in RECIPES): `data-contact-form` on the form;
  fields declare `data-required` / `data-type="email"`; per-field error elements;
  message strings (required/email/sending/success/error) arrive via `data-*`
  attributes sourced from business.json; submit posts to Web3Forms with
  `PUBLIC_WEB3FORMS_KEY`; state machine (idle/sending/success/error) toggled via
  `data-form-state`.
- The model designs all form markup and styling; logic is tested plumbing.
- Behavior ports from the deleted ContactForm.astro script — same validation and
  submission semantics, generalized to the markup contract.

## Recipes replace components — `docs/RECIPES.md`

Distill the deleted components' correctness into patterns (snippets + rules,
nothing mountable):
- Section skeleton: `<section id>` matching nav, `scroll-mt-20`, `section-pad`,
  `relative isolate` for decor layering, `data-reveal` usage.
- Accessible mobile nav: disclosure button with `aria-expanded`/`aria-controls`,
  labels from `content.ui`, focus behavior, astro:page-load binding pattern.
- Contact form markup contract (the `form.ts` interface) + honeypot if present
  in the ported logic.
- RTL patterns: `<bdi>` for mixed runs, `.force-ltr` for phones/prices,
  `--dir-factor` for x-offsets, logical utilities.
- Images: `resolveImage()` + `astro:assets` Image with explicit dimensions.
- Footer-with-legal: the two required legal links, hours/NAP rendering with
  `force-ltr` where needed.

## SEO machine becomes shape-tolerant

- `content.faq` becomes a canonical OPTIONAL shape (title optional,
  `items: [{question, answer}]`): when present it feeds FAQPage JSON-LD and the
  llms.txt FAQ section; when absent both skip it. Doctrine encourages including
  it for AEO when the business has FAQs.
- OfferCatalog name in `localBusinessJsonLd` falls back to `data.name` when no
  `content.services.title` exists.
- Smoke JSON-LD count becomes conditional: 4 blocks when `content.faq` exists,
  3 otherwise.

## Skill + judge updates

- `/new-client`: remove "use/gut/ignore reference sections" — every component is
  built from zero under DESIGN-DOCTRINE + RECIPES; Step for deleting
  `content.shell`; the five divergence hard rules adapt (no reference order to
  diverge from — rule becomes "composition must serve THIS client's concept").
- `/design-review` automatic fails: (a) "reference composition kept" → replaced
  by "starter shell markup still present on the page"; (c) "stock footer" →
  removed (nothing stock exists); (b) client-authored color story and (d) bespoke
  motion stay. Distinctiveness scoring judges against previous client sites (if
  known) and the generic-AI-site look, not a reference template.
- DESIGN-DOCTRINE: toolkit section drops "reference sections"; points to RECIPES;
  page contract unchanged; AGENTS/README/CLIENT-SITE-GUIDE folder maps and flow
  descriptions updated.

## What does not change

BaseLayout plumbing (lang/dir/fonts/SEO/JSON-LD/consent/skip-link), `lib/`
(business, images, jsonld, animation incl. custom.ts + reveals), legal pages,
404, generated endpoints, tokens + 9-pair validator, 15 font pairings, contract
smoke tests (already shape-agnostic with runtime skips), axe, LTR build,
Lighthouse budgets, the autonomous /new-client + judge flow.

## Accepted trade-offs

- Full construction cost per client — nothing is assembled from stock.
- Form/nav correctness rides on recipes + plumbing + the gate instead of shipped
  components; the headless helper keeps the riskiest logic (form submission)
  tested.
- The 404/legal pages keep their (minimal) shipped markup — they are legal/SEO
  machinery, not design surfaces; the model may restyle them per client.

## Out of scope

- Changing the frozen content core, the deploy flow, CI structure, or fonts.
- Any new dependencies.
