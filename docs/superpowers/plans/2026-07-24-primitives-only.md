# Primitives Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every piece of prebuilt design (sections, ui primitives, composed page) so the template ships only rules, gates, and plumbing, per `docs/superpowers/specs/2026-07-24-primitives-only-design.md`.

**Architecture:** Form logic is extracted to a headless helper and PROVEN against the existing ContactForm before anything is deleted. SEO generators become shape-tolerant (optional canonical `content.faq`, OfferCatalog fallback). Then one atomic task deletes all design components and replaces them with a bare contract shell + self-contained legal/404 pages + a slimmed schema. Docs/skills follow; a final gate + judge dry-run proves the shell fails the rubric.

**Tech Stack:** Astro 7 static, TypeScript strict, Tailwind 4, Zod (astro/zod v4), Playwright, Web3Forms.

## Global Constraints

- UTF-8 without BOM, LF endings (`.gitattributes` enforces LF; never write with PowerShell `Out-File`/`Set-Content`).
- TypeScript: no `any` (use `unknown` + narrowing), no non-null `!`.
- The frozen content core (`nav`, `ui`, `consent`, `notFound`, `legal`) is untouched.
- The template build + full gate stays green after EVERY task. `npm run test:e2e` timeout 600000 (builds+serves on port 4322).
- ConsentBanner (`src/components/ui/ConsentBanner.astro`) is legal machinery — never deleted.
- No new dependencies.

---

### Task 1: Headless form helper, proven against the live form

**Files:**
- Create: `src/lib/form.ts`
- Modify: `src/layouts/BaseLayout.astro` (script block)
- Modify: `src/components/sections/ContactForm.astro` (convert to the contract markup; its inline `<script>` is removed)

**Interfaces:**
- Produces: `setupContactForms(): void` from `@/lib/form` — binds every `form[data-contact-form]` on the page; no-op when none exist. Markup contract (Task 4 documents it in RECIPES.md): the form carries `data-contact-form`, message strings via `data-sending-label`, `data-submit-label`, `data-success-message`, `data-error-message`, `data-required-error`, `data-email-error`, `data-subject`; every `input[required]`/`textarea[required]` has an `id` and a sibling error element with id `` `${input.id}-error` ``; a status element `[data-form-status]` inside the form; optional honeypot input named `botcheck`.

- [ ] **Step 1: Create src/lib/form.ts**

Port the logic from `src/components/sections/ContactForm.astro:93-184` (read it first), generalized from `#contact-form` to all `form[data-contact-form]` and from `#form-status` to `[data-form-status]`:

```ts
import { PUBLIC_WEB3FORMS_KEY } from "astro:env/client";

/**
 * Headless contact-form plumbing. The model designs 100% of the form's
 * markup and look; this module provides the tested logic: validation,
 * Web3Forms submission, and idle/sending/success/error states.
 *
 * Markup contract (docs/RECIPES.md): <form data-contact-form> with
 * data-{sending-label,submit-label,success-message,error-message,
 * required-error,email-error,subject}; required fields have an id and an
 * error element with id `${id}-error`; a [data-form-status] element with
 * role="status" aria-live="polite"; optional honeypot input name="botcheck".
 *
 * Wired once in BaseLayout on astro:page-load — a page without a matching
 * form costs nothing.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fieldError(input: HTMLInputElement | HTMLTextAreaElement, form: HTMLFormElement): string {
  if (input.value.trim() === "") return form.dataset.requiredError ?? "";
  if (input.type === "email" && !EMAIL_PATTERN.test(input.value)) {
    return form.dataset.emailError ?? "";
  }
  return "";
}

function validate(form: HTMLFormElement): boolean {
  let firstInvalid: HTMLElement | null = null;
  for (const input of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    "input[required], textarea[required]",
  )) {
    const message = fieldError(input, form);
    const errorEl = document.getElementById(`${input.id}-error`);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.toggle("hidden", message === "");
    }
    input.setAttribute("aria-invalid", message === "" ? "false" : "true");
    if (message !== "" && !firstInvalid) firstInvalid = input;
  }
  firstInvalid?.focus();
  return firstInvalid === null;
}

function showStatus(form: HTMLFormElement, kind: "success" | "error"): void {
  const status = form.querySelector<HTMLElement>("[data-form-status]");
  if (!status) return;
  status.textContent =
    kind === "success" ? (form.dataset.successMessage ?? "") : (form.dataset.errorMessage ?? "");
  status.classList.remove("hidden");
  status.dataset.state = kind;
}

async function submit(form: HTMLFormElement): Promise<void> {
  const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
  if (!button) return;

  button.disabled = true;
  button.textContent = form.dataset.sendingLabel ?? "";
  try {
    const formData = new FormData(form);
    formData.append("access_key", PUBLIC_WEB3FORMS_KEY);
    formData.append("subject", form.dataset.subject ?? "");
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      body: formData,
      headers: { Accept: "application/json" },
    });
    const result: unknown = await response.json();
    const ok =
      typeof result === "object" && result !== null && "success" in result && result.success === true;
    showStatus(form, ok ? "success" : "error");
    if (ok) form.reset();
  } catch {
    showStatus(form, "error");
  } finally {
    button.disabled = false;
    button.textContent = form.dataset.submitLabel ?? "";
  }
}

function bind(form: HTMLFormElement): void {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!validate(form)) return;
    if (PUBLIC_WEB3FORMS_KEY === "") {
      // Endpoint not configured — surface the error state instead of a silent no-op.
      showStatus(form, "error");
      return;
    }
    void submit(form);
  });
}

export function setupContactForms(): void {
  for (const form of document.querySelectorAll<HTMLFormElement>("form[data-contact-form]")) {
    bind(form);
  }
}
```

Note two deliberate generalizations vs the original: status styling moves from hardcoded green/red utility classes to `data-state="success|error"` (the model styles `[data-form-status][data-state=...]` itself — recipe documents it), and multiple forms per page are supported.

- [ ] **Step 2: Wire it in BaseLayout**

In `src/layouts/BaseLayout.astro`'s existing `<script>` block, add the import and listener alongside the animation wiring:

```ts
import { destroyAnimations, initAnimations } from "@/lib/animation";
import { setupContactForms } from "@/lib/form";

document.addEventListener("astro:page-load", initAnimations);
document.addEventListener("astro:before-swap", destroyAnimations);
document.addEventListener("astro:page-load", setupContactForms);
```

- [ ] **Step 3: Convert ContactForm.astro to the contract markup**

In `src/components/sections/ContactForm.astro`: add `data-contact-form` to the `<form>` (keep `id="contact-form"` — the smoke test targets it), replace `id="form-status"` with `data-form-status` on the status `<p>` (keep `role="status" aria-live="polite"` and the `hidden` class), and delete the entire inline `<script>` block. No replacement styling is needed: the helper signals state via `data-state="success|error"` and the smoke tests assert only error-element text (`[id$="-error"]`, `#email-error`) — they never assert status colors. This component is deleted in Task 3 anyway; here it only serves as the proof harness.

- [ ] **Step 4: Verify the helper against the real form**

Run: `npm run test` — pass.
Run: `npm run test:e2e` (timeout 600000) — the two contact-form smoke tests must RUN and PASS (they exercise validate() + error elements through the new helper). This is the proof the helper works before the component is deleted.

- [ ] **Step 5: Commit**

```
git add src/lib/form.ts src/layouts/BaseLayout.astro src/components/sections/ContactForm.astro
git commit -m "feat: headless contact-form helper (form.ts), proven against the live form"
```

---

### Task 2: Shape-tolerant SEO machine

**Files:**
- Modify: `src/lib/jsonld.ts:50-52` (OfferCatalog name), `:100-110` (faqJsonLd)
- Modify: `src/layouts/BaseLayout.astro` (conditional FAQ JsonLd)
- Modify: `src/pages/llms.txt.ts` (read it first; make the FAQ section conditional)
- Modify: `tests/smoke.spec.ts` (JSON-LD count conditional)

**Interfaces:**
- Produces: `faqJsonLd(business): JsonLd | null` (null when `content.faq` is absent/empty). OfferCatalog `name` falls back to `data.name`. Task 3 relies on both: the shell site ships without `content.faq` and without `content.services`.

- [ ] **Step 1: jsonld.ts**

OfferCatalog name (works both before Task 3, when `content.services` still exists, and after):

```ts
const content = business.content as Record<string, unknown>;
const services =
  typeof content.services === "object" && content.services !== null
    ? (content.services as Record<string, unknown>)
    : null;
const offerCatalogName = typeof services?.title === "string" ? services.title : data.name;
```

(place near the top of `localBusinessJsonLd`, use `name: offerCatalogName` in `hasOfferCatalog`).

`faqJsonLd` becomes null-tolerant:

```ts
export function faqJsonLd(business: Business): JsonLd | null {
  const content = business.content as Record<string, unknown>;
  const faq = typeof content.faq === "object" && content.faq !== null ? content.faq : null;
  const items = Array.isArray((faq as Record<string, unknown> | null)?.items)
    ? ((faq as Record<string, unknown>).items as Array<{ question: string; answer: string }>)
    : [];
  if (items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
```

(After Task 3 the schema types `content.faq` as an optional canonical shape, so these casts can be simplified then — Task 3 Step 4 does that cleanup.)

- [ ] **Step 2: BaseLayout renders FAQ JSON-LD conditionally**

```astro
const faq = faqJsonLd(business);
...
{faq && <JsonLd data={faq} />}
```

- [ ] **Step 3: llms.txt.ts**

Read the file; wherever it iterates `business.content.faq.items`, guard with the same shape-check pattern (emit the FAQ block only when items exist). Keep everything else identical.

- [ ] **Step 4: smoke.spec.ts JSON-LD count**

Replace the fixed `toHaveCount(4)` with:

```ts
    const content = business.content as Record<string, unknown>;
    const faq = typeof content.faq === "object" && content.faq !== null ? content.faq : null;
    const hasFaq =
      Array.isArray((faq as Record<string, unknown> | null)?.items) &&
      ((faq as Record<string, unknown>).items as unknown[]).length > 0;
    await expect(scripts).toHaveCount(hasFaq ? 4 : 3);
```

- [ ] **Step 5: Verify (template still HAS faq → count 4 branch exercised)**

Run: `npm run test` then `npm run test:e2e` (timeout 600000) — all green.

- [ ] **Step 6: Commit**

```
git add src/lib/jsonld.ts src/layouts/BaseLayout.astro src/pages/llms.txt.ts tests/smoke.spec.ts
git commit -m "feat: SEO machine tolerates any content shape (optional faq, OfferCatalog fallback)"
```

---

### Task 3: The deletion — shell, standalone pages, slim schema

This task is atomic (the build is only green with all parts together).

**Files:**
- Delete: `src/components/sections/` (all 10 files), `src/components/ui/Container.astro`, `src/components/ui/SectionHeading.astro`, `src/components/ui/Button.astro`, `docs/examples/demo-salon.business.json`
- Rewrite: `src/pages/index.astro`, `src/pages/404.astro`, `src/pages/privacy.astro`, `src/pages/accessibility-statement.astro`
- Modify: `src/content/business.schema.ts` (per-client region), `src/content/business/business.json`

**Interfaces:**
- Consumes: `setupContactForms` wiring (already global, no form on the shell → no-op); `faqJsonLd` null path (shell ships no faq → 3 JSON-LD blocks).
- Produces: schema per-client region = `faq` (optional canonical: `{ title?: string, items: [{question, answer}] min 1 }`) + `shell` (optional: `{ headline: string, note: string, bidiSample: string }`). Everything else in `content` beyond the frozen core is gone; clients author their own shapes schema-first. Task 4's docs/skills describe exactly this.

- [ ] **Step 1: Schema — slim the per-client region**

In `src/content/business.schema.ts` content object: KEEP the frozen core block unchanged. Under the PER-CLIENT banner, DELETE `hero`, `services`, `about`, `testimonials`, `gallery`, `cta`, `contactForm`, `footer` and replace the banner + region with:

```ts
    /* ────────────────────────────────────────────────────────────────────
     * PER-CLIENT — the template ships NO content shapes here beyond two
     * optional canonical blocks. When building a client site, author the
     * content model to match the page you designed (schema first, then
     * JSON, then components via getBusiness()). Copy NEVER lives in
     * components.
     *
     * - `faq` is the canonical shape for FAQPage JSON-LD + llms.txt (AEO):
     *   include it whenever the business has real FAQs.
     * - `shell` exists ONLY for the template's unbuilt starter page —
     *   delete it (schema + JSON) when building the real site.
     * ──────────────────────────────────────────────────────────────────── */
    faq: z
      .object({
        title: z.string().optional(),
        items: z
          .array(z.object({ question: z.string().min(1), answer: z.string().min(1) }))
          .min(1),
      })
      .optional(),
    shell: z
      .object({
        headline: z.string().min(1),
        note: z.string().min(1),
        bidiSample: z.string().min(1),
      })
      .optional(),
```

Also simplify the Task-2 casts now that types exist: in `jsonld.ts`, `faqJsonLd` can read `business.content.faq` directly (`if (!business.content.faq || business.content.faq.items.length === 0) return null;`) and OfferCatalog name becomes `data.name` (no `content.services` exists any more — drop the shape-check helper). Same simplification in `llms.txt.ts` and the smoke count (`business.content.faq` may be typed absent in the template JSON import — keep the `"faq" in business.content` runtime check there, since tests import the JSON, not the schema type).

- [ ] **Step 2: business.json — the new skeleton**

`content` keeps: `nav`, `ui`, `consent`, `notFound`, `legal` exactly as they are, plus:

```json
    "shell": {
      "headline": "[שם העסק — האתר עוד לא עוצב]",
      "note": "זהו שלד התבנית. הריצו /new-client עם הבריף כדי לבנות את האתר האמיתי.",
      "bidiSample": "שלום John 050-1234567 ₪1,234 — שורת בדיקה דו־כיוונית (עברית, לטינית, מספרים ומטבע)."
    }
```

Delete `hero`, `services`, `about`, `testimonials`, `gallery`, `faq`, `cta`, `contactForm`, `footer` from `content`. `data`/`voice`/`design` unchanged. UTF-8 no BOM, LF.

- [ ] **Step 3: The starter shell — src/pages/index.astro**

```astro
---
import BaseLayout from "@/layouts/BaseLayout.astro";
import { getBusiness, telHref, whatsappHref } from "@/lib/business";

/*
 * The UNBUILT starter shell (docs/superpowers/specs/2026-07-24-primitives-only-design.md).
 * Deliberately unstyled: it satisfies the page contract (nav ids resolve, one
 * h1, footer with legal links, contact path, bidi line) so a fresh clone
 * passes the gate — and nothing more. It is NOT a design and must not be
 * styled. /new-client replaces this file entirely and deletes content.shell.
 */
const business = await getBusiness();
const { shell } = business.content;
if (!shell) {
  throw new Error(
    "content.shell is missing. The starter shell needs it — or replace index.astro with the client site.",
  );
}
const sections = business.content.nav
  .filter((link) => link.href.startsWith("#"))
  .map((link) => ({ id: link.href.slice(1), label: link.label }));
---

<BaseLayout>
  <header>
    <p><bdi>{business.data.name}</bdi></p>
    <nav>
      <ul>
        {business.content.nav.map((link) => (
          <li><a href={link.href}>{link.label}</a></li>
        ))}
      </ul>
    </nav>
  </header>
  <main id="main">
    <h1>{shell.headline}</h1>
    <p><strong>{shell.note}</strong></p>
    <p>{shell.bidiSample}</p>
    {sections.map((section) => (
      <section id={section.id} class="scroll-mt-20">
        <h2>{section.label}</h2>
        {section.id === "contact" ? (
          <ul>
            <li><a href={telHref(business.data.contact.phone)} class="force-ltr">{business.data.contact.phone}</a></li>
            <li><a href={whatsappHref(business.data.contact.whatsapp)}>WhatsApp</a></li>
          </ul>
        ) : (
          <p>{shell.note}</p>
        )}
      </section>
    ))}
  </main>
  <footer>
    <p><bdi>{business.data.legalName}</bdi> © {new Date().getFullYear()}</p>
    <ul>
      <li><a href="/accessibility-statement/">{business.content.legal.accessibility.title}</a></li>
      <li><a href="/privacy/">{business.content.legal.privacy.title}</a></li>
    </ul>
  </footer>
</BaseLayout>
```

(Check `resolveHref`/`whatsappHref` exports in `src/lib/business.ts` first and use whatever actually exists.)

- [ ] **Step 4: Standalone legal/404 pages**

All three currently import Header/Footer/Container/Button — rewrite each as self-contained plain markup. Pattern for `src/pages/404.astro`:

```astro
---
import BaseLayout from "@/layouts/BaseLayout.astro";
import { getBusiness } from "@/lib/business";

const business = await getBusiness();
const copy = business.content.notFound;
---

<BaseLayout title={copy.title}>
  <main id="main">
    <h1>{copy.title}</h1>
    <p>{copy.body}</p>
    <p><a href="/">{copy.backLabel}</a></p>
  </main>
</BaseLayout>
```

`privacy.astro` and `accessibility-statement.astro`: same skeleton — read the current files first and keep their EXACT content rendering (paragraph arrays, coordinator details with `force-ltr` phone/email, statementDate, adjustments list) minus Header/Footer/Container; add a plain `<p><a href="/">← {business.data.name}</a></p>` link at top and keep the h1s the smoke tests assert. These pages are legal machinery — minimal semantic markup, tokens-only classes where any are kept.

- [ ] **Step 5: Delete**

```
git rm src/components/sections/*.astro src/components/ui/Container.astro src/components/ui/SectionHeading.astro src/components/ui/Button.astro docs/examples/demo-salon.business.json
```

Then `rg "components/(sections|ui)/(?!ConsentBanner)" src/ tests/ scripts/ --pcre2` → only ConsentBanner references remain (BaseLayout).

- [ ] **Step 6: Verify**

Run: `npm run validate:content` → valid + contrast pass.
Run: `npm run test` → green.
Run: `npm run test:e2e` (timeout 600000) → green: nav ids resolve on the shell, one h1, footer legal links, bidi visible, JSON-LD count 3 (no faq), contact-form tests SKIP (no `#contact-form`), axe green on the plain pages.
Run: `npm run test:ltr-build` (timeout 600000) → green.
Visual: `npx playwright test --grep @visual --update-snapshots` then `npm run test:visual` — REBASELINE IS EXPECTED AND CORRECT here (the shell is an intentional total visual change; baselines are local/gitignored).

- [ ] **Step 7: Commit**

```
git add -A
git commit -m "feat!: primitives only — all prebuilt design deleted; bare contract shell; slim schema"
```

---

### Task 4: RECIPES.md + docs + skills

**Files:**
- Create: `docs/RECIPES.md`
- Modify: `docs/DESIGN-DOCTRINE.md`, `AGENTS.md`, `README.md`, `docs/CLIENT-SITE-GUIDE.md`, `.claude/skills/new-client/SKILL.md`, `.claude/skills/design-review/SKILL.md`, `docs/brief.md` (only if it references demo-salon)

**Interfaces:**
- Consumes: the deleted components' markup — retrieve with `git show <task-3-parent-sha>:src/components/sections/Header.astro` etc. (find the sha with `git log --oneline`, the commit BEFORE the Task 3 commit).

- [ ] **Step 1: docs/RECIPES.md**

Author these recipes (each: a short "why", a minimal RTL-correct snippet distilled from the deleted component via git history, and the rules that make it correct — snippets are PATTERNS, deliberately incomplete, never full components):

1. **Section skeleton** — `<section id>` matching a `content.nav` href, `scroll-mt-20`, `section-pad`, `relative isolate` (decor at `-z-10`), `data-reveal` on content.
2. **Accessible mobile nav** — disclosure `<button aria-expanded aria-controls>` with labels from `content.ui.openMenu/closeMenu`, panel toggling, binding inside a named `setup*()` on `astro:page-load` (distill from the deleted Header.astro).
3. **Contact form (headless contract)** — the full `form[data-contact-form]` attribute contract from `src/lib/form.ts`'s doc comment, the honeypot, `${id}-error` elements, `[data-form-status]` + styling `[data-state="success"|"error"]` yourself, strings from the client-authored content schema via `data-*`, `.env` key note. State explicitly: forms are OPTIONAL — only build one if the client wants it; phone/WhatsApp links are a complete contact path.
4. **RTL survival kit** — `<bdi>`, `.force-ltr`, logical utilities, `--dir-factor`/`--angle-brand`, `dir="ltr"` on email/tel inputs (from the deleted ContactForm), no tracking on Hebrew.
5. **Images** — `resolveImage()` + `astro:assets` `<Image>` with explicit dimensions; files in `src/assets/images/`.
6. **Footer with legal links** — the two mandatory legal page links, hours/NAP rendering with `force-ltr` phones, `<bdi>` around names.

- [ ] **Step 2: DESIGN-DOCTRINE.md**

- Toolkit: remove the "Reference sections" entry and the `Hero variant`/`Services layout`/`Gallery layout` prop references entirely; remove "UI primitives" entry; add "**Recipes** (`docs/RECIPES.md`) — RTL/a11y-correct patterns distilled from experience; consult before building nav, forms, sections."
- Composition: "`src/pages/index.astro` ships as an unbuilt contract shell — replace it entirely; delete `content.shell`."
- Page contract: replace the FAQ/JSON-LD bullet with: "`content.faq` is the canonical OPTIONAL shape feeding FAQPage JSON-LD + llms.txt — include it (real Q&A) whenever the business has FAQs; without it the site emits 3 JSON-LD blocks and that is fine."
- Divergence hard rules: drop "composition order must differ from the reference default" (nothing to differ from); replace with "the page must not contain shell markup or `content.shell`".

- [ ] **Step 3: Skills**

`new-client/SKILL.md`: Step 2 content: "author the per-client content region from scratch (only canonical optional `faq` is predefined); DELETE `content.shell` from schema+JSON". Step 4: remove "Reference sections … use as-is with their variant props, gut and redesign, or replace"; replace with "Build every component from zero. Consult `docs/RECIPES.md` for the RTL/a11y-correct patterns (nav, form contract, section skeleton). Forms are optional — only if the client wants one, wired to the headless helper." Remove any remaining demo-salon reference. Hard rules: swap rule (5) to "no shell markup / content.shell remains".

`design-review/SKILL.md`: automatic fails become: (a) starter-shell markup or `content.shell` still present; (b) no client-authored color story (unchanged wording from current (b) minus "stock components" clause); (c) REMOVED (no stock footer exists — renumber); (d→c) zero bespoke motion: `custom.ts` no-op AND no `data-reveal` usage anywhere (there are no stock sections any more — any reveal usage is client-authored). Distinctiveness axis: judge against "previous client sites if known, and the generic AI-site look" instead of "the reference template look".

- [ ] **Step 4: AGENTS.md / README / CLIENT-SITE-GUIDE**

- AGENTS.md folder map: `components/sections/` line → removed; `components/ui/` → "ConsentBanner only (legal machinery)"; add `lib/form.ts` and `docs/RECIPES.md` lines; remove demo-salon line ("A fully-filled reference lives at…" sentence in the contract section too). Contract section: per-client region wording per Task 3 Step 1's banner. Conventions "Sections" bullet: keep id/scroll-mt/section-pad/one-h1 (now sourced from RECIPES).
- README: "The template ships as a placeholder skeleton" note → describe the shell; remove the demo-salon sentence; flow step 3 unchanged except "builds every component from zero (see docs/RECIPES.md)".
- CLIENT-SITE-GUIDE: remove references to reference sections/variant props/demo-salon; point at RECIPES + doctrine.

- [ ] **Step 5: Verify + commit**

Run: `npm run test` green. `rg -i "demo-salon|reference section|SectionHeading|components/ui/Container|variant props" docs/ README.md AGENTS.md .claude/ --glob "!docs/superpowers/**"` → no stale hits.

```
git add -A
git commit -m "docs: RECIPES replace components; doctrine/skills/judge follow primitives-only"
```

---

### Task 5: Full gate + judge dry-run on the shell

**Files:** none (verification; fixes only if forced).

- [ ] **Step 1: Full gate**

`npm run test` · `npm run test:e2e` (600000) · `npm run test:ltr-build` (600000) · `npm run test:visual` (green against the Task-3 rebaselines) · `npm run build && npm run lhci` (budgets hold — the shell is trivially fast; report numbers).

- [ ] **Step 2: Judge dry-run**

Follow `.claude/skills/design-review/SKILL.md` for ONE judgment round against the shell (no fixes, no docs/design-review.md, no commits): expected verdict FAIL with automatic fail (a) "shell markup present" firing. Report scores + which fails fired. Tree ends clean.

- [ ] **Step 3: Residue sweep**

`rg "content\.(hero|services|about|testimonials|gallery|cta|contactForm|footer)\b" src/ scripts/ tests/` → no matches. `git status` clean.
