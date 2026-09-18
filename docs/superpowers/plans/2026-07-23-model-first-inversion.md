# Model-First Inversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invert the template from "prebuilt pages with variant dials" to "quality floor + toolkit + reference library that an LLM designs on, 0→100" per the approved spec at `docs/superpowers/specs/2026-07-23-model-first-inversion-design.md`.

**Architecture:** Structural prescriptions (section-order schema, layout enums, the `custom/` sandbox) dissolve into composition-time props, plain CSS tokens, and doctrine docs. The mechanical floor (RTL, contrast, reduced-motion, `getBusiness()`, SEO machine, test gate) is untouched. Tests become contract-driven: derived from the frozen parts of `business.json` instead of a hardcoded section inventory, so they hold for any bespoke page.

**Tech Stack:** Astro 7 (static), TypeScript strict, Tailwind CSS 4 (CSS-first), Zod (`astro/zod` = v4), GSAP + Lenis, Playwright, Biome.

## Global Constraints

- Windows: save `business.json` (and all files) as UTF-8 **without BOM** — a BOM breaks `JSON.parse` at build time.
- TypeScript: no `any` (use `unknown` + narrowing), no non-null `!`.
- RTL: logical properties/utilities only; never `ml/mr/pl/pr/left-/right-/text-left/text-right`.
- No new dependencies.
- The frozen `content` core is: `nav`, `ui`, `consent`, `notFound`, `legal`. Tests and infrastructure may reference ONLY these plus `locale`, `data`, `voice`. Everything else in `content` is per-client.
- Commit after every task. `npm run test:e2e` builds and serves itself on port 4322 (never point tests at the dev server). The e2e run takes several minutes — use a generous timeout (600000 ms).
- After the final task, visual baselines must be regenerated (`npx playwright test --grep @visual --update-snapshots`) — they are gitignored, nothing to commit.

---

### Task 1: Contract-driven tests (smoke + visual)

Make the test gate independent of the section inventory BEFORE changing the inventory. These tests must pass against the current template unchanged — that is the proof they are contract-driven.

**Files:**
- Create: `tests/contract.ts`
- Modify: `tests/smoke.spec.ts` (full rewrite)
- Modify: `tests/visual.spec.ts`

**Interfaces:**
- Consumes: `src/content/business/business.json` (frozen core only: `locale`, `data`, `content.nav`, `content.ui`, `content.consent`, `content.notFound`, `content.legal`).
- Produces: `tests/contract.ts` exporting `navSectionIds: string[]` and `collectStrings(value: unknown, out?: string[]): string[]` — Task 8 verifies against these; the `/new-client` skill (Task 7) references this contract.

- [ ] **Step 1: Create the shared contract helper**

Write `tests/contract.ts`:

```ts
import business from "../src/content/business/business.json" with { type: "json" };

/**
 * The test contract: expectations tests may derive from business.json.
 * Page composition is per-client (model-designed), so tests must NOT assume
 * specific sections exist. Only the frozen core is safe to reference:
 * locale, data, and content.{nav, ui, consent, notFound, legal}.
 */

/** Section ids the nav promises: "#services" → "services". */
export const navSectionIds: string[] = business.content.nav
  .map((link) => link.href)
  .filter((href) => href.startsWith("#"))
  .map((href) => href.slice(1));

/** Every string anywhere in a JSON value (for content-wide scans). */
export function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, out);
    }
  } else if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectStrings(item, out);
    }
  }
  return out;
}
```

- [ ] **Step 2: Rewrite smoke.spec.ts contract-driven**

Replace the entire contents of `tests/smoke.spec.ts` with:

```ts
import { expect, test } from "@playwright/test";
import business from "../src/content/business/business.json" with { type: "json" };
import { collectStrings, navSectionIds } from "./contract";

/**
 * Contract-driven smoke tests. Expectations derive from the frozen parts of
 * business.json plus generic invariants that hold for every site. Per-client
 * content shapes (hero copy, section strings) are off-limits here — a bespoke
 * page must pass this suite without edits. Site-specific behavior gets ADDED
 * tests in the client repo, never edits to these.
 */

test.describe("home page", () => {
  test("renders with correct language and direction", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("lang", business.locale);
    await expect(html).toHaveAttribute("dir", business.locale === "he" ? "rtl" : "ltr");
  });

  test("has exactly one non-empty h1", async ({ page }) => {
    await page.goto("/");
    const h1 = page.locator("h1");
    await expect(h1).toHaveCount(1);
    await expect(h1).not.toBeEmpty();
  });

  test("every nav link resolves to a real section id", async ({ page }) => {
    expect(navSectionIds.length, "nav must contain at least one #section link").toBeGreaterThan(0);
    await page.goto("/");
    for (const id of navSectionIds) {
      await expect(page.locator(`#${id}`), `nav promises #${id}`).toBeAttached();
    }
  });

  test("renders a bidi test string (Hebrew sites)", async ({ page }) => {
    test.skip(business.locale !== "he", "bidi line only required for Hebrew sites");
    // Longest qualifying string — bidi test lines are full sentences kept in
    // visible body copy (the /new-client skill maintains one).
    const bidiLine = collectStrings(business.content)
      .filter((s) => /[א-ת]/.test(s) && /[A-Za-z]/.test(s) && /₪/.test(s))
      .sort((a, b) => b.length - a.length)[0];
    expect(bidiLine, "content must keep a bidi test line (Hebrew + Latin + ₪)").toBeTruthy();
    await page.goto("/");
    await expect(page.getByText(bidiLine as string)).toBeVisible();
  });

  test("renders JSON-LD structured data", async ({ page }) => {
    await page.goto("/");
    // LocalBusiness, Organization, WebSite, FAQPage
    const scripts = page.locator('script[type="application/ld+json"]');
    await expect(scripts).toHaveCount(4);
    const first = await scripts.first().textContent();
    expect(first).toContain("LocalBusiness");
  });

  test("contact form blocks an empty submit", async ({ page }) => {
    await page.goto("/");
    const form = page.locator("#contact-form");
    test.skip((await form.count()) === 0, "site has no #contact-form");
    await form.scrollIntoViewIfNeeded();
    await form.locator('button[type="submit"]').click();
    await expect(form.locator('[id$="-error"]').first()).not.toBeEmpty();
  });

  test("contact form flags an invalid email", async ({ page }) => {
    await page.goto("/");
    const form = page.locator("#contact-form");
    test.skip((await form.count()) === 0, "site has no #contact-form");
    test.skip((await form.locator("#email").count()) === 0, "form has no #email field");
    for (const field of ["#name", "#phone", "#message"]) {
      const input = form.locator(field);
      if ((await input.count()) > 0) {
        await input.fill("בדיקה 050-1234567");
      }
    }
    await form.locator("#email").fill("not-an-email");
    await form.locator('button[type="submit"]').click();
    await expect(form.locator("#email-error")).not.toBeEmpty();
  });

  test("404 page renders", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist/");
    expect(response?.status()).toBe(404);
    await expect(page.locator("h1")).toHaveText(business.content.notFound.title);
  });

  test("legal pages render and are linked from the footer", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("body > footer");
    await expect(
      footer.getByRole("link", { name: business.content.legal.accessibility.title }),
    ).toBeAttached();
    await expect(
      footer.getByRole("link", { name: business.content.legal.privacy.title }),
    ).toBeAttached();

    await page.goto("/accessibility-statement/");
    await expect(page.locator("h1")).toHaveText(business.content.legal.accessibility.title);
    await expect(
      page.getByText(business.content.legal.accessibility.coordinator.name),
    ).toBeVisible();

    await page.goto("/privacy/");
    await expect(page.locator("h1")).toHaveText(business.content.legal.privacy.title);
  });

  test("consent banner absent when no cookie-based trackers are configured", async ({ page }) => {
    const hasTracking =
      business.data.analytics.gtagId !== "" || business.data.analytics.metaPixelId !== "";
    await page.goto("/");
    if (hasTracking) {
      await expect(page.locator("#consent-banner")).toBeVisible();
    } else {
      await expect(page.locator("#consent-banner")).toHaveCount(0);
    }
  });

  test("AEO/PWA endpoints respond", async ({ request }) => {
    const llms = await request.get("/llms.txt");
    expect(llms.status()).toBe(200);
    expect(await llms.text()).toContain(business.data.name);

    const manifest = await request.get("/site.webmanifest");
    expect(manifest.status()).toBe(200);
    const parsed = (await manifest.json()) as { name: string };
    expect(parsed.name).toBe(business.data.name);
  });
});
```

Deliberately dropped from the old suite (they referenced per-client content): the `h1` text assertion against `content.hero.headline`, the hardcoded section-id list, and error-string assertions against `content.contactForm.*`.

- [ ] **Step 3: Make visual.spec.ts targets nav-derived**

In `tests/visual.spec.ts`, add the import at the top:

```ts
import { navSectionIds } from "./contract";
```

Replace the `TARGETS` constant (currently the hardcoded 10-entry list) with:

```ts
// Targets derive from the nav contract; header/hero/footer are conventional
// (a target whose selector is absent on a bespoke page is skipped).
const TARGETS = [
  { name: "header", selector: "body > header" },
  { name: "hero", selector: "#hero" },
  ...navSectionIds.map((id) => ({ name: id, selector: `#${id}` })),
  { name: "footer", selector: "body > footer" },
];
```

In the per-target test body, add a runtime skip before the screenshot line:

```ts
    test(`${target.name} looks right (RTL)`, async ({ page }) => {
      await preparePage(page);
      test.skip(
        (await page.locator(target.selector).count()) === 0,
        `no ${target.selector} on this site`,
      );
      await expect(page.locator(target.selector)).toHaveScreenshot(`${target.name}.png`);
    });
```

Note: `navSectionIds` includes `contact` (nav has `#contact`), and the old list had both `cta` and `contact` — `cta` is not in the nav, so it drops out of visual targets. That is correct contract behavior.

- [ ] **Step 4: Run the gate to prove the tests pass against the unchanged template**

Run: `npm run test` — expected: validate + lint + typecheck all pass.
Run: `npm run test:e2e` (timeout 600000) — expected: all smoke + a11y tests pass (contact-form tests run, nothing skipped except possibly none).

- [ ] **Step 5: Commit**

```
git add tests/contract.ts tests/smoke.spec.ts tests/visual.spec.ts
git commit -m "test: contract-driven smoke/visual suites (no hardcoded section inventory)"
```

---

### Task 2: Dissolve shape/density into plain tokens

**Files:**
- Modify: `src/styles/global.css:36-72`
- Modify: `src/layouts/BaseLayout.astro:31-38`
- Modify: `src/styles/custom.css` (header comment)

**Interfaces:**
- Produces: `:root` tokens `--shape-radius-card`, `--shape-radius-button`, `--section-py` with reference defaults; per-client overrides go in `custom.css`. The `rounded-card` / `rounded-button` / `section-pad` utilities are unchanged.

- [ ] **Step 1: Replace the data-attribute blocks in global.css**

Replace the two commented blocks — "Shape personality …" (`:root, [data-shape="rounded"] { … }` through `[data-shape="pill"] { … }`) and "Vertical rhythm …" (`:root, [data-density="regular"] { … }` through `[data-density="compact"] { … }`) — keeping the `@utility section-pad` rule, with:

```css
/*
 * Shape + rhythm tokens — per-client design decisions.
 * Defaults give the reference look; override per client in
 * src/styles/custom.css (see docs/DESIGN-DOCTRINE.md).
 * Components use rounded-card / rounded-button / section-pad utilities,
 * never a literal radius or py-* on a section.
 */
:root {
  --shape-radius-card: 1.25rem;
  --shape-radius-button: 9999px;
  --section-py: clamp(4rem, 8vw, 6rem);
}

@utility section-pad {
  padding-block: var(--section-py);
}
```

- [ ] **Step 2: Drop the data attributes from BaseLayout**

In `src/layouts/BaseLayout.astro`, change the `<html …>` open tag from:

```astro
<html
  lang={business.locale}
  dir={dir}
  style={brandVars}
  data-shape={business.design.shape}
  data-density={business.design.density}
>
```

to:

```astro
<html lang={business.locale} dir={dir} style={brandVars}>
```

- [ ] **Step 3: Point custom.css at the doctrine**

Replace the header comment of `src/styles/custom.css` (whatever references CREATIVE-CONTRACT / "experience layer") with:

```css
/*
 * Per-client design surface — loaded after global.css.
 * Color story, section re-skins, and token overrides
 * (--shape-radius-card / --shape-radius-button / --section-py) live here.
 * Tokens + color-mix() only; never literal hex. See docs/DESIGN-DOCTRINE.md.
 * Empty in the template.
 */
```

(Keep any existing non-comment content — the template ships it empty.)

- [ ] **Step 4: Verify**

Run: `npm run test` — expected: pass (schema still carries the now-unused `shape`/`density` fields; they are removed in Task 5).
Run: `npm run build` — expected: build succeeds.

- [ ] **Step 5: Commit**

```
git add src/styles/global.css src/layouts/BaseLayout.astro src/styles/custom.css
git commit -m "refactor: shape/density become plain :root tokens overridable in custom.css"
```

---

### Task 3: Layout variants become props; index.astro composes explicitly

**Files:**
- Modify: `src/components/sections/Hero.astro` (frontmatter)
- Modify: `src/components/sections/Services.astro` (frontmatter)
- Modify: `src/components/sections/Gallery.astro` (frontmatter)
- Modify: `src/pages/index.astro` (full rewrite)

**Interfaces:**
- Produces: `Hero` accepts `variant?: "split" | "centered" | "full-bleed"` (default `"split"`); `Services` accepts `layout?: "cards" | "list" | "panels"` (default `"cards"`); `Gallery` accepts `layout?: "grid" | "masonry" | "featured"` (default `"grid"`). Composition is a code decision in `index.astro`, not data in `business.json`.

- [ ] **Step 1: Hero variant → prop**

In `src/components/sections/Hero.astro` frontmatter, replace:

```ts
const variant = business.design.hero;
```

with:

```ts
interface Props {
  /** Layout variant — a composition-time choice made in index.astro. */
  variant?: "split" | "centered" | "full-bleed";
}
const { variant = "split" } = Astro.props;
```

(If the file has no `interface Props` yet, add it exactly as above; keep every other line of the frontmatter unchanged.)

- [ ] **Step 2: Services layout → prop**

In `src/components/sections/Services.astro` frontmatter, replace:

```ts
const layout = business.design.servicesLayout;
```

with:

```ts
interface Props {
  /** Layout variant — a composition-time choice made in index.astro. */
  layout?: "cards" | "list" | "panels";
}
const { layout = "cards" } = Astro.props;
```

- [ ] **Step 3: Gallery layout → prop**

In `src/components/sections/Gallery.astro` frontmatter, replace:

```ts
const layout = business.design.galleryLayout;
```

with:

```ts
interface Props {
  /** Layout variant — a composition-time choice made in index.astro. */
  layout?: "grid" | "masonry" | "featured";
}
const { layout = "grid" } = Astro.props;
```

- [ ] **Step 4: Rewrite index.astro as an explicit default composition**

Replace the entire contents of `src/pages/index.astro` with:

```astro
---
import About from "@/components/sections/About.astro";
import ContactForm from "@/components/sections/ContactForm.astro";
import CTA from "@/components/sections/CTA.astro";
import FAQ from "@/components/sections/FAQ.astro";
import Footer from "@/components/sections/Footer.astro";
import Gallery from "@/components/sections/Gallery.astro";
import Header from "@/components/sections/Header.astro";
import Hero from "@/components/sections/Hero.astro";
import Services from "@/components/sections/Services.astro";
import Testimonials from "@/components/sections/Testimonials.astro";
import BaseLayout from "@/layouts/BaseLayout.astro";

/*
 * Per-client page composition (docs/DESIGN-DOCTRINE.md).
 * This default composes the reference sections in a sensible order so a fresh
 * clone builds and passes the gate. For a client: reorder, swap variants, gut
 * or replace sections, add bespoke ones — keep content.nav consistent (every
 * "#id" nav link must resolve; the smoke suite enforces it), keep exactly one
 * h1, and keep the footer with its legal links.
 */
---

<BaseLayout>
  <Header />
  <main id="main">
    <Hero variant="split" />
    <Services layout="cards" />
    <About />
    <Testimonials />
    <Gallery layout="grid" />
    <FAQ />
    <CTA />
    <ContactForm />
  </main>
  <Footer />
</BaseLayout>
```

(This drops the `Signature` import, the `sections` record, the `SectionKey` import, and the `getBusiness()` call — none are needed. The order matches the old default `sectionOrder`, so visual output is identical.)

- [ ] **Step 5: Verify**

Run: `npm run test` — expected: pass.
Run: `npm run test:e2e` (timeout 600000) — expected: pass — the contract suite from Task 1 must be green with zero edits, proving composition changes don't touch tests.

- [ ] **Step 6: Commit**

```
git add src/components/sections/Hero.astro src/components/sections/Services.astro src/components/sections/Gallery.astro src/pages/index.astro
git commit -m "refactor: layout variants are component props; index.astro composes explicitly"
```

---

### Task 4: Remove the custom/ sandbox

**Files:**
- Delete: `src/components/custom/Signature.astro`, `src/components/custom/SectionDecor.astro`, `src/components/custom/SignatureBackdrop.astro`, `src/components/custom/signature.ts`
- Modify: `src/lib/animation/index.ts`
- Modify: `src/components/sections/{Services,About,Testimonials,Gallery,FAQ,CTA,ContactForm}.astro` (remove `SectionDecor` import + render line)
- Modify: `src/components/sections/Hero.astro` (remove `SignatureBackdrop` import + its 3 render sites)

**Interfaces:**
- Consumes: nothing new. After this task nothing imports from `@/components/custom/`.
- Produces: section roots stay `relative isolate` — bespoke decor per client is written directly in that client's components, not through a sandbox.

- [ ] **Step 1: Unhook the signature registration from the animation lifecycle**

In `src/lib/animation/index.ts`: delete the import `import { registerSignature } from "@/components/custom/signature";` and replace:

```ts
    setupReveals();
    // Per-client signature animations (no-op in the template). Runs inside
    // this matchMedia context, so its tweens revert with everything else.
    const cleanupSignature = registerSignature();

    return () => {
      cleanupSignature?.();
```

with:

```ts
    setupReveals();

    return () => {
```

(Per-client GSAP work now registers via `setup*()` functions the client repo adds inside this same matchMedia context — document that in the doctrine, Task 6.)

- [ ] **Step 2: Strip SectionDecor from the seven sections**

In each of `Services.astro`, `About.astro`, `Testimonials.astro`, `Gallery.astro`, `FAQ.astro`, `CTA.astro`, `ContactForm.astro`: delete the line `import SectionDecor from "@/components/custom/SectionDecor.astro";` and the render line `<SectionDecor section="…" />`. Touch nothing else — the section roots keep `relative isolate`.

- [ ] **Step 3: Strip SignatureBackdrop from Hero**

In `Hero.astro`: delete `import SignatureBackdrop from "@/components/custom/SignatureBackdrop.astro";` and all three `<SignatureBackdrop />` render lines (one per variant).

- [ ] **Step 4: Delete the sandbox files**

```
git rm src/components/custom/Signature.astro src/components/custom/SectionDecor.astro src/components/custom/SignatureBackdrop.astro src/components/custom/signature.ts
```

- [ ] **Step 5: Verify nothing references the sandbox, then run the gate**

Run: `rg "components/custom" src/ tests/ scripts/` — expected: no matches.
Run: `npm run test` — expected: pass.
Run: `npm run test:e2e` (timeout 600000) — expected: pass.

- [ ] **Step 6: Commit**

```
git add -A
git commit -m "refactor: remove the custom/ sandbox — everything is designable, custom.css remains"
```

---

### Task 5: Schema inversion — design enums out, content core/per-client split in

**Files:**
- Modify: `src/content/business.schema.ts`
- Modify: `src/content/business/business.json:3-10` (design block)
- Modify: `docs/examples/demo-salon.business.json:3-10` (design block)

**Interfaces:**
- Consumes: Tasks 2–4 already removed every reader of the deleted fields (`astro.config.mjs` reads only `design?.fontPairing`, which stays).
- Produces: `businessSchema` with `design: { fontPairing }` only; `content` split into a frozen core and a per-client region; exports `orderableSections`, `sectionKeys`, `SectionKey` removed; `content.signature` removed. Type `Business` unchanged in name.

- [ ] **Step 1: Rewrite the design block and remove section-key exports**

In `src/content/business.schema.ts`, delete the `orderableSections` / `sectionKeys` / `SectionKey` declarations (lines 35–52) and replace the whole `design:` object (lines 63–93) with:

```ts
  /**
   * The one design decision that must be data (astro.config.mjs registers
   * fonts at build time): a self-hosted, Hebrew-capable font pairing.
   * Every other design decision — layout, composition, shape, rhythm,
   * color story — is made in code per client (docs/DESIGN-DOCTRINE.md).
   */
  design: z
    .object({
      /** display font / body font — all pairs support Hebrew + Latin. */
      fontPairing: z
        .enum(["classic", "modern", "elegant", "warm", "bold", "editorial"])
        .default("classic"),
    })
    .default({ fontPairing: "classic" }),
```

- [ ] **Step 2: Split content into frozen core and per-client regions**

Reorder the `content:` object so the frozen core comes first under a banner comment, the per-client fields follow under a second banner, and `signature` (lines 317–329) is deleted entirely:

```ts
  content: z.object({
    /* ────────────────────────────────────────────────────────────────────
     * FROZEN CORE — never remove or rename these fields; infrastructure
     * (Header nav, legal pages, 404, consent banner, skip link) and the
     * contract-driven smoke tests depend on them in every client repo.
     * ──────────────────────────────────────────────────────────────────── */
    nav: z.array(link).min(1),
    ui: z.object({ /* …unchanged… */ }),
    consent: z.object({ /* …unchanged… */ }),
    notFound: z.object({ /* …unchanged… */ }),
    legal: z.object({ /* …unchanged… */ }),

    /* ────────────────────────────────────────────────────────────────────
     * PER-CLIENT — this region describes the default reference composition.
     * When designing a client site, reshape it freely (schema first, then
     * JSON, then components via getBusiness()) to match the page you
     * designed. Copy still NEVER lives in components.
     * ──────────────────────────────────────────────────────────────────── */
    hero: z.object({ /* …unchanged… */ }),
    services: z.object({ /* …unchanged… */ }),
    about: z.object({ /* …unchanged… */ }),
    testimonials: z.object({ /* …unchanged… */ }),
    gallery: z.object({ /* …unchanged… */ }),
    faq: z.object({ /* …unchanged… */ }),
    cta: z.object({ /* …unchanged… */ }),
    contactForm: z.object({ /* …unchanged… */ }),
    footer: z.object({ /* …unchanged… */ }),
  }),
```

"…unchanged…" means: move each existing field definition verbatim — this step only reorders, adds the two banner comments, and deletes `signature`. Also update the file's top doc comment (lines 3–14): replace the `content` line with "`content` — every piece of visible copy. A frozen core (nav/ui/consent/notFound/legal) is identical in every repo; the rest is reshaped per client to match the designed page."

No code change for JSON-LD in this task: `content.faq` remains a required field in the template schema, so `faqJsonLd` keeps working. The client-repo case (a design without an FAQ section) is handled by doctrine (Task 6's page contract already tells the model to keep `content.faq` for AEO or adapt `faqJsonLd` and the smoke JSON-LD count together).

- [ ] **Step 3: Trim both JSON files**

In `src/content/business/business.json` and `docs/examples/demo-salon.business.json`, replace the `design` object (currently `fontPairing`, `hero`, `shape`, `density`, `servicesLayout`, `galleryLayout`, `sectionOrder`) with:

```json
  "design": {
    "fontPairing": "classic"
  },
```

(demo-salon keeps whatever `fontPairing` it currently declares.) Save both files UTF-8 without BOM.

- [ ] **Step 4: Verify**

Run: `rg "sectionOrder|servicesLayout|galleryLayout|SectionKey|data-shape|data-density|content\.signature" src/ scripts/ tests/` — expected: no matches.
Run: `npm run validate:content` — expected: `✓ business.json is valid` + contrast pass.
Run: `npm run test` — expected: pass.
Run: `npm run test:e2e` (timeout 600000) — expected: pass.

- [ ] **Step 5: Commit**

```
git add src/content/business.schema.ts src/content/business/business.json docs/examples/demo-salon.business.json
git commit -m "refactor!: schema inversion — design enums dissolve, content splits into frozen core + per-client"
```

---

### Task 6: Docs — design doctrine replaces the creative contract

**Files:**
- Create: `docs/DESIGN-DOCTRINE.md`
- Delete: `docs/CREATIVE-CONTRACT.md`
- Modify: `AGENTS.md`, `README.md`, `docs/CLIENT-SITE-GUIDE.md`

**Interfaces:**
- Produces: `docs/DESIGN-DOCTRINE.md` — referenced by Task 7's skill rewrite and by comments added in Tasks 2–5.

- [ ] **Step 1: Write docs/DESIGN-DOCTRINE.md**

```markdown
# Design doctrine — constrain quality, never form

The template ships a **floor** (mechanical, testable rules) and a **toolkit**
(tokens, primitives, animation system, content pipeline, reference sections).
You — the model building a client site — design the page 0→100 on top of them.
Nothing structural is prescribed; everything structural is available. The test
gate, not a list of allowed layouts, decides what ships.

## The floor (non-negotiable, unchanged)

- RTL: logical properties/utilities only; `--dir-factor` / `--angle-brand` /
  `--origin-inline-start` / `--bg-pos-inline-start` for what doesn't auto-flip;
  `<bdi>` for mixed runs; `.force-ltr` for phones/prices/emails; no
  letter-spacing on Hebrew.
- Copy lives in `business.json`, read via `getBusiness()` — never hardcoded.
  Images via `resolveImage()`; hrefs via `resolveHref()`.
- Colors are tokens (`--color-primary|secondary|accent|surface|…`); tints via
  `color-mix()`. Text sits only on validated contrast pairs (`text-primary` on
  `bg-surface`; on dark surfaces use `text-surface`). New color-as-text pair →
  add it to `scripts/validate-content.ts` first.
- Reduced motion = static page. Design the still frame first. All motion lives
  inside the matchMedia context in `src/lib/animation/index.ts`; entrances via
  `data-reveal`; animate transforms/opacity only.
- Decorative elements: `aria-hidden="true"` + `pointer-events-none`.
- No new dependencies. TypeScript strict, no `any`, Zod at runtime boundaries.
- The gate: `npm run test` + `npm run test:e2e` + `npm run test:ltr-build`
  green; Lighthouse budgets hold (LCP ≤ 2.5s, TBT ≤ 200ms, CLS ≤ 0.1).

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
- `lib/jsonld.ts` reads `content.faq` for FAQPage JSON-LD — if your design has
  no FAQ, keep the field with real Q&A anyway (it still feeds AEO) or adapt
  `faqJsonLd` and the smoke JSON-LD count together, in the same commit.
- The contract-driven smoke suite passes with ZERO edits. New user-visible
  behavior gets **added** tests in the client repo; never weaken the suite.

## The toolkit

- **Tokens** (`global.css`): brand colors from `voice.palette`; shape/rhythm
  via `--shape-radius-card`, `--shape-radius-button`, `--section-py` —
  override per client in `custom.css`, never literal radii or `py-*`.
- **Fonts**: `design.fontPairing` — six self-hosted Hebrew-capable pairings
  (the one design decision that stays data; fonts register at build time).
  Components only use `font-display` / `font-sans`.
- **Reference sections** (`src/components/sections/`): tested, RTL-correct
  worked examples. Use them as-is, pass their variant props
  (`Hero variant`, `Services layout`, `Gallery layout`), gut and redesign
  them, or ignore them and build fresh — per client, per section. They are
  examples of the rules, not the product.
- **Composition**: `src/pages/index.astro` is yours. The shipped default
  composes the references so a fresh clone builds green.
- **UI primitives**: `Container`, `SectionHeading`, `Button`.
- **Animation**: `data-reveal` presets for entrances; bespoke GSAP/ScrollTrigger
  registered from a `setup*()` you add inside the matchMedia context in
  `src/lib/animation/index.ts` (tweens created synchronously revert on swap;
  return cleanup only for listeners/observers you own). Lenis + ScrollTrigger
  are pre-synced; importing gsap adds ~0 bytes.
- **Schema**: `data` + `voice` are frozen. The per-client region of `content`
  is reshaped schema-first: `business.schema.ts` → `business.json` →
  components via `getBusiness()`.

## The design process (before any code)

Write the concept in four lines — if you can't, it isn't one concept yet:

1. **Metaphor** — one thing from the client's world their customers instantly
   recognize (vinyl / steam / thread / clipper lines).
2. **Color story** — which sections go light / tinted / dark; where the accent
   burns brightest (usually the CTA). Rhythm, not stripes.
3. **Composition** — the actual page: which sections exist, what each one *is*,
   in what order, and why that order serves this business.
4. **Motion identity** — the ONE characteristic movement reused everywhere
   motion appears, including the `data-reveal` choices.

Plus the reduced-motion still frame: the page must look complete without any
motion. ONE concept, expressed everywhere it helps — incoherence, not
quantity, is what reads as noise.

## The promote loop

When a client-repo idea proves broadly useful, generalize it (tokens, props,
`data-reveal` preset, or a new reference section) and PR it into the template.
Client repos stay free to be weird; the template absorbs only the winners.
Never copy client-specific code between client repos.
```

- [ ] **Step 2: Delete the creative contract**

```
git rm docs/CREATIVE-CONTRACT.md
```

- [ ] **Step 3: Rewrite the structural parts of AGENTS.md**

Apply these edits (locate by quoted text; keep everything else):

1. Intro line: replace "then filled by editing **one file**: `src/content/business/business.json`" framing with: "then designed 0→100 per client on a fixed quality floor — see `docs/DESIGN-DOCTRINE.md`. Facts, voice, and copy live in `src/content/business/business.json`."
2. Folder map: change the `components/sections/` line to `components/sections/ ← reference library: tested, RTL-correct worked examples (use, gut, or ignore per client)`; delete the `components/custom/` line; change `styles/custom.css` description to "per-client design surface (color story, token overrides)"; change `pages/index.astro` line to "per-client page composition (ships a default that passes the gate)"; in the `docs/` line replace `CREATIVE-CONTRACT.md (signature sandbox)` with `DESIGN-DOCTRINE.md (design doctrine)`.
3. In "The business.json contract": delete the entire "**Design variants (`design` block)**" bullet (all sub-bullets) and the entire "**Experience layer**" bullet. In their place add:
   - "**Model-first design** — the page is designed per client under `docs/DESIGN-DOCTRINE.md`: composition, section design, shape/rhythm tokens, color story are all code decisions. The only design data in `business.json` is `design.fontPairing` (six self-hosted Hebrew-capable pairings mapped in astro.config.mjs; components only use `font-display`/`font-sans`)."
   - "**Content split** — `data` + `voice` + the `content` frozen core (`nav`, `ui`, `consent`, `notFound`, `legal`) are identical in every repo; the rest of `content` is reshaped per client, schema-first. Components still read ONLY via `getBusiness()`."
4. In "Conventions": in the sections bullet, drop "exactly one way"/variant phrasing if present and keep: `<section id>` matching nav, `scroll-mt-20`, `section-pad`, one `h1` (Hero owns it in the reference composition).
5. In "Do / Don't": add "DO write new user-visible behavior a test in the client repo (the contract smoke suite is never edited, only added to)."

Then verify: `rg "CREATIVE-CONTRACT|sectionOrder|servicesLayout|galleryLayout|data-shape|data-density|components/custom" AGENTS.md CLAUDE.md README.md docs/ --glob "!docs/superpowers/**"` — fix any remaining hits (CLAUDE.md's own notes contain none of these today, but check).

- [ ] **Step 4: Update README.md**

In the "New client → live site" flow, replace step 3's description (the text from "It fills `business.json` (facts, voice, palette, every visible string), picks a distinct **design variant combo**…" through "…runs the full test gate.") with:

"It reads the brief (including the scraped raw-texture material), generates three design concepts and self-critiques them, commits the chosen concept to `docs/concept.md`, reshapes the per-client part of `business.json` + schema, designs and builds the page 0→100 on the quality floor (see [docs/DESIGN-DOCTRINE.md](./docs/DESIGN-DOCTRINE.md)), enforces the WCAG palette contract, regenerates the OG image, and runs the full test gate — autonomously, surfacing every provisional fact and placeholder in its final report."

In "Where things live", replace the sentence referencing `docs/CREATIVE-CONTRACT.md` ("…defines the per-client "signature moment" creative sandbox (mount points, rules, worked example)") with: "[docs/DESIGN-DOCTRINE.md](./docs/DESIGN-DOCTRINE.md) is the design contract — the quality floor, the toolkit, and the required design process for building each client site 0→100."

- [ ] **Step 5: Update docs/CLIENT-SITE-GUIDE.md**

Run: `rg -n "CREATIVE-CONTRACT|design variant|sectionOrder|servicesLayout|galleryLayout|shape|density|signature" docs/CLIENT-SITE-GUIDE.md`. Rewrite each hit to match the new reality: variants are component props, composition is `index.astro`, doctrine doc replaces the contract, the `custom/` sandbox no longer exists. Keep the guide's walkthrough structure; this is a terminology-and-pointers pass, not a rewrite.

- [ ] **Step 6: Verify + commit**

Run: `npm run test` — expected: pass (docs don't affect it; this catches accidental code edits).
Run: `rg "CREATIVE-CONTRACT" . --glob "!docs/superpowers/**" --glob "!.git/**"` — expected: no matches.

```
git add -A
git commit -m "docs: DESIGN-DOCTRINE replaces CREATIVE-CONTRACT; AGENTS/README/guide follow the inversion"
```

---

### Task 7: Brief pipeline + autonomous /new-client skill

**Files:**
- Modify: `docs/brief.md`
- Modify: `.claude/skills/new-client/SKILL.md` (full rewrite)

**Interfaces:**
- Consumes: `docs/DESIGN-DOCTRINE.md` (Task 6), the contract test suite (Task 1), the schema split (Task 5).
- Produces: `docs/concept.md` convention (written by the skill in client repos, committed as its own first commit).

- [ ] **Step 1: Update docs/brief.md**

Replace the "Design differentiation" and "Signature moment" sections (from `## Design differentiation` to end of file) with:

```markdown
## Raw texture (from scraping — the design material)

> Paste unstructured findings here verbatim. This is what the design concept
> gets built from — more is better.

- Verbatim review quotes (with star rating if visible):
- How the business describes itself in its own posts/bio:
- What their photos look like (materials, light, colors, mood):
- Who their customers appear to be:
- Anything iconic a visitor would instantly recognize (object, ritual, motion):

## Creative appetite

- Client's appetite for a bold design (subtle / confident / go wild):
- Existing sites the client likes or hates (URLs + why, if known):
```

And add directly under the file's intro blockquote (after "…anything left blank."):

```markdown
> Tag every fact with its provenance: `[scraped]` (found online, unverified) or
> `[client-confirmed]`. `/new-client` treats scraped-only NAP, prices, and hours
> as provisional and lists them for client confirmation before launch.
```

- [ ] **Step 2: Rewrite .claude/skills/new-client/SKILL.md**

Replace the entire file with:

```markdown
---
name: new-client
description: Build a client site 0→100 from a brief — concept generation + self-critique → schema-first content → bespoke page design → validation → full test gate. Runs autonomously without stopping for input. Use when starting a new client site, rebranding one, or applying a client brief.
---

# New client build (autonomous)

Turn `docs/brief.md` into a designed, validated site. Run WITHOUT stopping for
user input: make the best call, record it, and surface every assumption in the
final report. Read `docs/DESIGN-DOCTRINE.md` first — it is the contract for
everything below (the floor, the page contract, the toolkit, the process).

## Step 0 — Ingest the brief

- Facts are tagged `[scraped]` or `[client-confirmed]`. Scraped-only NAP,
  prices, and hours are PROVISIONAL: use them, and list each in the final
  report under "confirm with client before launch".
- Missing required facts: do NOT stall. Insert a clearly-marked placeholder
  and add it to the report's blocking list.
- The "raw texture" section is your design material — read it before
  inventing anything. The concept must come from the client's world, not from
  a generic industry stereotype.

## Step 1 — Concept (before any code)

Generate THREE distinct concept candidates in the doctrine's four-line format
(metaphor / color story / composition / motion identity + still frame).
Self-critique each against: (a) would this client's customers recognize it
instantly, (b) feasibility on the floor (contrast pairs, RTL, reduced-motion
still frame), (c) distance from the reference-template look and from previous
clients if known. Pick the strongest. Write `docs/concept.md` containing the
chosen concept in full plus the two rejected candidates with one line each on
why they lost. Commit it alone: `feat: design concept for <client>`.

## Step 2 — Schema-first content

- `data` + `voice` + the frozen content core (`nav`, `ui`, `consent`,
  `notFound`, `legal`): fill completely, never reshape.
- The per-client `content` region: reshape `business.schema.ts` to match the
  page you designed in Step 1, then write the JSON. Copy NEVER lives in
  components.
- `legal.accessibility.coordinator` needs REAL details (legal requirement,
  ת"י 5568). If the brief lacks them, use a placeholder AND flag it as
  BLOCKING — first line of the final report.
- Trackers only if explicitly requested (auto-enables consent banner; rewrite
  `legal.privacy` to disclose them).
- Hebrew sites keep a bidi test line (Hebrew + Latin name + ₪ price) in
  visible body copy — the smoke suite scans for it.
- Respect `voice` in every sentence. Save UTF-8 WITHOUT BOM.
- Sweep: `rg "\[" src/content/business/business.json` — only the bidi line
  and deliberate flagged placeholders may remain, and every one of the
  latter goes in the report.

## Step 3 — Palette

`voice.palette` drives the theme. `npm run validate:content` enforces WCAG AA
(≥ 4.5:1) on primary↔surface, secondary↔surface, secondary↔surface-alt,
accent↔secondary. If a brand color fails, adjust until it passes and note the
change in the report. New color-as-text pairs → add to
`scripts/validate-content.ts` in the same commit.

## Step 4 — Design and build the page

Execute the committed concept, 0→100:

- Compose `src/pages/index.astro` yourself. Reference sections
  (`src/components/sections/`) are examples: use as-is with their variant
  props, gut and redesign, or replace with bespoke sections.
- Shape/rhythm: override `--shape-radius-card`, `--shape-radius-button`,
  `--section-py` in `src/styles/custom.css`; color story with tokens +
  `color-mix()` there too. Pick `design.fontPairing` to match the concept.
- Honor the page contract: one `h1`, nav `#id` links all resolve, footer with
  legal links, contact path reachable, decorative = `aria-hidden` +
  `pointer-events-none`.
- Motion: the concept's ONE motion identity via `data-reveal` choices and, if
  needed, a `setup*()` registered inside the matchMedia context in
  `src/lib/animation/index.ts`.
- New user-visible behavior → ADD a test in the client repo. The contract
  smoke suite is never edited.

## Step 5 — Images + OG

Client photos into `src/assets/images/` (keep filenames or update refs).
Regenerate: `npm run generate:og`. Every image still showing a placeholder
goes in the report.

## Step 6 — Gate (all must pass; fix, don't skip)

```
npm run validate:content
npm run test
npm run test:e2e
npm run test:ltr-build
npx playwright test --grep @visual --update-snapshots
npm run test:visual
```

## Step 7 — Report

End with exactly these sections:

1. **BLOCKING** — placeholder accessibility coordinator, missing legal facts.
2. **Confirm with client before launch** — every `[scraped]`-only NAP /
   price / hours fact, verbatim.
3. **Placeholders remaining** — images, testimonials, copy awaiting real
   content.
4. **Design decisions** — the concept (link `docs/concept.md`), palette
   adjustments, fontPairing, composition summary.
5. **Deploy checklist** — Cloudflare Pages + `PUBLIC_WEB3FORMS_KEY` (created
   with the CLIENT's email) + `data.seo.siteUrl` matches the domain.
```

- [ ] **Step 3: Verify + commit**

Run: `rg "CREATIVE-CONTRACT|sectionOrder|servicesLayout" .claude/ docs/brief.md` — expected: no matches.

```
git add docs/brief.md .claude/skills/new-client/SKILL.md
git commit -m "feat: autonomous /new-client with concept self-critique; brief gains raw-texture + provenance"
```

---

### Task 8: Full gate + final sweep

**Files:** none created — verification only (plus any fixes it forces).

- [ ] **Step 1: Full test gate**

Run each; all must pass:

```
npm run test
npm run test:e2e          # timeout 600000
npm run test:ltr-build
```

- [ ] **Step 2: Rebaseline visuals (baselines are gitignored)**

Run: `npx playwright test --grep @visual --update-snapshots` (first run creates baselines / reports missing) then `npm run test:visual` — expected: green.

- [ ] **Step 3: Residue sweep**

Run: `rg "CREATIVE-CONTRACT|sectionOrder|servicesLayout|galleryLayout|data-shape|data-density|components/custom|registerSignature|content\.signature" . --glob "!docs/superpowers/**" --glob "!.git/**"` — expected: no matches.

- [ ] **Step 4: Lighthouse budgets (build must exist from e2e; else `npm run build` first)**

Run: `npm run build` then `npm run lhci` — expected: budgets hold (LCP ≤ 2.5s, TBT ≤ 200ms, CLS ≤ 0.1). The page is visually identical to pre-inversion, so no regression is expected.

- [ ] **Step 5: Commit any fixes; final state check**

Run: `git status` — expected: clean tree, all work committed.
