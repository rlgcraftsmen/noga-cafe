# Recipes — patterns, not components

Every prebuilt section was deleted (`docs/superpowers/specs/2026-07-24-primitives-only-design.md`).
There is nothing to gut or reskin — you build every component from zero, per
client. These recipes are the RTL/a11y-correct patterns worth not
re-deriving from scratch each time. Each is a **minimal snippet plus the rules
that make it correct** — deliberately incomplete, never a paste-able
component. Where a recipe's MECHANICS ship as a headless helper (nav,
form, hours), the recipe is the markup contract for it — author markup +
CSS, never the script. Consult `docs/DESIGN-DOCTRINE.md` for the floor and
page contract these patterns exist to satisfy, and `docs/TRAPS.md` for the
measured failures these patterns encode.

## 1. Section skeleton

Why: every section must satisfy the page contract (nav ids resolve, decor
never covers content, entrances respect reduced motion) regardless of what
you design inside it.

```astro
<section id="services" class="relative isolate scroll-mt-20 section-pad">
  {/* decorative layer, if any, goes here first: aria-hidden + -z-10 */}
  <div data-reveal>
    <!-- content -->
  </div>
</section>
```

Rules:

- `id` must equal the `#fragment` of the matching `content.nav` href, exactly.
- `scroll-mt-20` — the sticky header eats space above the anchor otherwise.
- `section-pad` utility for vertical rhythm — never a literal `py-*` on a
  `<section>` (it reads `--section-py`, overridden per client in `custom.css`).
- `relative isolate` on the section root if it has any decorative/background
  layer — that layer sits at `-z-10` between the background and the content,
  never `position: absolute` floating loose.
- `data-reveal` (or `data-reveal-group` for a list of children) on the content
  you want animated in — never a bespoke GSAP instance per section.

## 2. Accessible mobile nav

Why: a disclosure pattern that's keyboard-operable and doesn't leave
screen-reader users guessing at open/closed state. The MECHANICS are shipped
and tested in `src/lib/nav.ts` (wired once in BaseLayout, like the form
helper) — every shipped build used to re-derive them by hand and every one
shipped a different subset of the behaviors. **Write NO drawer script.**
Author only the markup contract and the design:

```astro
<button
  type="button"
  id="menu-toggle"
  data-nav-toggle
  aria-expanded="false"
  aria-controls="mobile-menu"
  aria-label={content.ui.openMenu}
  data-open-label={content.ui.openMenu}
  data-close-label={content.ui.closeMenu}
>
  <!-- icon — the toggle's design is yours -->
</button>

<div id="mobile-menu" data-close-ms="300" hidden>
  <!-- nav links; optionally a [data-nav-close] button.
       Style the OPEN state off [data-open]:
       #mobile-menu[data-open] { opacity: 1; ... }  -->
</div>
```

`nav.ts` then provides, for free: `aria-expanded` + label swap, the
frame-deferred `data-open` (so entrance transitions/staggers actually run),
`hidden` landing after `data-close-ms` (links never tabbable while
invisible), focus into the panel, focus trap, Escape + focus return, body
scroll lock (`.is-locked`, released on page swap), and close-on-link-click
via `pointerdown` (beats the capture-phase Lenis anchor handler) + `click`
(keyboard).

Rules:

- `id="menu-toggle"` is REQUIRED, not decorative (TRAPS 18 — without it the
  drawer tests, including the containing-block test that must FAIL the
  build, silently skip).
- Labels come from `content.ui.openMenu` / `content.ui.closeMenu` — never
  hardcode "פתח תפריט"/"Menu".
- Design the open drawer's entrance off `[data-open]` in CSS (stagger via
  `--i` custom properties on items if wanted) — JS never styles anything.
- Set `data-close-ms` to match your close transition's duration.
- Add `data-lenis-prevent` to the drawer's scrollable region so a long menu
  scrolls inside the open drawer.

Known failure modes — these are the defects real builds keep shipping;
verify each one by OPERATING the nav in a browser (the new-client skill's
Step 4 nav pass), never by reading the markup — **and always AFTER scrolling
to mid-page first**, because the worst failure below only appears in the
scrolled state:

- **The containing-block trap** (full write-up + CSS-property list: TRAPS 11 —
  it only breaks in the SCROLLED state, which is why a scroll-0 check always
  passes). Canonical structure that makes it impossible:

  ```astro
  <header class="sticky top-0 z-50">      <!-- positioning ONLY: sticky + z. NEVER filter/blur/transform here -->
    <div class="header-bar bg-surface/90 backdrop-blur-md">…toggle + desktop nav…</div>
    <div id="mobile-menu" class="fixed inset-0 z-50" hidden>…</div>  <!-- sibling of the bar, NOT inside it -->
  </header>
  ```

  Visual effects (blur, tint, shadow — including every `[data-scrolled]`
  response) live on the inner bar; the header root and the drawer's ancestor
  chain stay effect-free. (The pre-deletion reference `Header.astro` puts
  `backdrop-blur-md` on the header root — copy its a11y mechanics, NOT that
  class placement; it only survives there because that drawer is in-flow,
  not fixed.)
- **Stacking**: the open drawer must sit ABOVE all page content — give the
  header root its own elevated stacking context (e.g. `relative z-50`, panel
  included). Section-level `isolate` + `-z-10` decor only protects within
  that section; an un-z-indexed drawer WILL render beneath a later section
  or a hero's decorative layer.
- **Animated drawers still need `hidden`**: closed must end at `hidden` (or
  `inert`) after the close transition — an `opacity-0` drawer whose links
  remain tabbable is an a11y failure (TRAPS 8).
- **Scroll lock**: a full-height drawer locks body scroll while open
  (`overflow: hidden` on `<body>`, restored on close AND on
  `astro:before-swap`) — an open drawer over a still-scrolling page reads as
  broken.
- **RTL slide direction**: the drawer enters from the inline-start edge —
  any `translateX` offset multiplies by `var(--dir-factor)`; a hardcoded
  left-slide is wrong on every Hebrew site.

## 3. Contact form (headless contract)

Why: `src/lib/form.ts` ships tested validation/submission logic and expects
an exact markup contract — quote it, don't reinvent it. **Forms are
OPTIONAL.** A phone link and a WhatsApp link (`whatsappHref()`) are a complete
contact path on their own — as is a phone link alone when
`data.contact.whatsapp` is absent (the field is optional); only build a form
if the client actually wants one.

Contract, verbatim from `src/lib/form.ts`'s doc comment:

> `<form data-contact-form>` with `data-{sending-label,submit-label,
> success-message,error-message,required-error,email-error,subject}`;
> required fields have an `id` and an error element with id `${id}-error`; a
> `[data-form-status]` element with `role="status"` `aria-live="polite"`;
> optional honeypot input `name="botcheck"`.

Optional extras the helper understands:

- A designed submit button wraps its label in `<span data-submit-text>` — the
  sending-state swap then only touches that span, so icons/markup survive.
- `data-captcha-error` — the message shown when hCaptcha is present but
  unsolved (falls back to `data-error-message`).

Minimal shape:

```astro
<form
  data-contact-form
  data-sending-label={copy.sendingLabel}
  data-submit-label={copy.submitLabel}
  data-success-message={copy.successMessage}
  data-error-message={copy.errorMessage}
  data-required-error={copy.requiredError}
  data-email-error={copy.emailError}
  data-subject={`${copy.title} — ${business.data.name}`}
  novalidate
>
  <input type="checkbox" name="botcheck" tabindex="-1" aria-hidden="true" class="pointer-events-none absolute size-px opacity-0" />

  <label for="email">{copy.emailLabel}</label>
  <input id="email" name="email" type="email" dir="ltr" required aria-describedby="email-error" />
  <p id="email-error" data-field-error class="hidden"></p>

  <button type="submit">{copy.submitLabel}</button>
  <p data-form-status role="status" aria-live="polite" class="hidden"></p>
</form>
```

Rules:

- The helper toggles the `hidden` CSS class (Tailwind's), never the HTML `hidden` attribute
  — don't use the bare `hidden` attribute on these elements, or errors stay permanently
  invisible regardless of form state.

- Every string is `data-*` from client-authored content (a form section you
  add to the schema yourself — there is no canonical `content.contactForm`
  shape shipped) — never a literal in the markup or the script.
- The honeypot input is unlabeled, `tabindex="-1"`, `aria-hidden="true"`, and
  visually hidden but still in the DOM (not `display:none` on the field
  itself — bots that skip hidden fields must still see it as fillable).
- `${id}-error` must match the field's `id` exactly; `form.ts` looks it up by
  string concatenation.
- Style `[data-state="success"]` / `[data-state="error"]` on the
  `[data-form-status]` element yourself — `form.ts` only sets the attribute
  and the text, never a class or color.
- No wiring needed beyond markup: `setupContactForms()` binds automatically
  to every `form[data-contact-form]` on `astro:page-load` (already called
  once in `BaseLayout`).
- `.env` needs `PUBLIC_WEB3FORMS_KEY` (copy `.env.example`) — created from a
  free Web3Forms key using the CLIENT's email, so submissions land in their
  inbox. Without it, submission surfaces the error state instead of a silent
  no-op. The key is baked in at BUILD time, and `npm run deploy` builds
  locally — so it has to be in your `.env`, not only in the Cloudflare
  dashboard.

**Spam protection (recommended whenever a form ships).** The access key is
public in the bundle by design, so the honeypot alone is bypassable by
POSTing to the API directly. Web3Forms' zero-config hCaptcha closes that:
they verify the token server-side, no keys or registration needed.

```astro
<!-- inside the form, before the submit button -->
<div class="h-captcha" data-captcha="true"></div>
```

```html
<!-- once per page that renders the form, before </body> -->
<script is:inline src="https://web3forms.com/client/script.js" async defer></script>
```

`form.ts` refuses to submit while the widget is unsolved (shows
`data-captcha-error`). Also enable hCaptcha in the Web3Forms dashboard so
direct API posts without a token are rejected server-side — that setting is
what actually closes the bypass.

(No `integrity` hash on that script tag on purpose: it is a living
third-party loader — Web3Forms updates it, and a pinned SRI hash would
silently kill the captcha on their next release. The trust boundary here is
the Web3Forms service itself, which already holds every submission.)

## 4. RTL survival kit

Why: the properties that DON'T auto-flip under `dir="rtl"`, and the two
markup patterns for mixed-direction text. Distilled from the pre-deletion
`ContactForm.astro` and `Footer.astro`.

- Logical utilities only: `ms-* me-* ps-* pe-* start-* end-* text-start
  inset-inline-*`. Never `ml/mr/pl/pr/left-/right-/text-left/text-right`.
- `<bdi>` around any run that mixes Hebrew with Latin/numbers so bidi
  reordering can't scramble it — business names, addresses, "© {year}
  {legalName}".
- `class="force-ltr"` on phone numbers, prices, emails, times — text that must
  read left-to-right even inside an RTL page. Combine with `<bdi>` when the
  surrounding sentence is Hebrew: `<bdi class="force-ltr">{phone}</bdi>`.
- `dir="ltr"` directly on `<input type="email">` / `<input type="tel">` — the
  cursor and placeholder must behave LTR regardless of page direction (text
  inputs stay unset/default).
- X-offsets that don't auto-flip (box-shadow, `translateX`) multiply by
  `var(--dir-factor)`; gradients use `var(--angle-brand)`; `transform-origin`
  reads `var(--origin-inline-start)`; `background-position` reads
  `var(--bg-pos-inline-start)`. GSAP x-slides go through
  `src/lib/animation/reveal.ts`, which already mirrors — don't hand-roll a
  parallel path.
- Never `tracking-*`/`letter-spacing` on Hebrew text (global.css guards this;
  don't fight it with an inline style).

## 5. Images

Why: `business.json` references images by filename; `resolveImage()` is the
only bridge to the optimized asset Astro needs at build time.

```astro
---
import { Image } from "astro:assets";
import { resolveImage } from "@/lib/images";
---

<Image
  src={resolveImage(item.src)}
  alt={item.alt}
  widths={[320, 640]}
  sizes="(max-width: 767px) 50vw, 33vw"
  loading="lazy"
  class="aspect-square w-full rounded-card object-cover"
/>
```

Rules:

- Files live in `src/assets/images/`; `business.json` stores only the
  filename (`resolveImage()` throws with the list of available files if it
  doesn't match).
- Always pass explicit `widths`/`sizes` (or `width`/`height`) — an
  unconstrained `<Image>` is a CLS and LCP risk.
- `alt` is client-authored copy from `business.json`, never a literal.
- The hero/LCP image should skip `loading="lazy"` (it needs to paint
  immediately); everything below the fold should keep it.

## 6. Footer with legal links

Why: the page contract requires a `body > footer` reaching both mandatory
legal pages, plus NAP rendered with the RTL rules above. Distilled from the
pre-deletion `Footer.astro`.

```astro
<footer>
  <p><bdi>{data.legalName}</bdi> © <bdi class="force-ltr">{new Date().getFullYear()}</bdi></p>

  <ul>
    {data.hours.map((entry) => (
      <li>
        <span>{entry.label}</span>
        {entry.ranges.length === 0 ? (
          <span>{copy.closedLabel}</span>
        ) : (
          entry.ranges.map((range) => (
            <bdi class="force-ltr tabular-nums">{range.open}–{range.close}</bdi>
          ))
        )}
      </li>
    ))}
  </ul>

  <a href={telHref(data.contact.phone)}><bdi class="force-ltr">{data.contact.phone}</bdi></a>
  {data.contact.email && (
    <a href={`mailto:${data.contact.email}`}><bdi class="force-ltr">{data.contact.email}</bdi></a>
  )}

  <ul>
    <li><a href="/accessibility-statement/">{content.legal.accessibility.title}</a></li>
    <li><a href="/privacy/">{content.legal.privacy.title}</a></li>
  </ul>
</footer>
```

Rules:

- Both legal links are mandatory, exact hrefs: `/accessibility-statement/`
  and `/privacy/`. Their link text comes from `content.legal.*.title`.
- Business/legal names get `<bdi>`; phone, email, hours get `force-ltr`
  (stack both on a value embedded in an otherwise-Hebrew sentence).
- Each day carries `ranges: [{open, close}]`, NOT a single open/close pair:
  a split shift (09:00–13:00 + 16:00–19:00) is two entries, and an EMPTY
  array means closed. Render the closed state explicitly ("שבת: סגור") —
  the label is client-authored copy you add to your own content shape
  (`copy.closedLabel` above), never a literal. `data.specialHours` (חגים)
  overrides specific dates and is worth rendering near the hours block
  whenever it is non-empty.
- Hours render from `data.hours` (one entry per day) — don't hardcode a
  day list; a client with different hours per day shouldn't need a code
  change.
- `telHref()` / `whatsappHref()` from `src/lib/business.ts` build the href —
  never hand-format a `tel:`/`wa.me` URL.

## 7. Scroll-aware header

Why: `docs/DESIGN-DOCTRINE.md`'s header bar mandates a scroll-past-threshold
state and an active-section indicator. Both are shipped in `src/lib/nav.ts`
— **write no scroll-state script**; they are STATE, not motion, so they live
OUTSIDE the reduced-motion guard (a reduced-motion user still gets the
tinted header and `aria-current`) and read the live scroll position, immune
to the stale-`maxScroll` trap that shipped in a real build (docs/TRAPS.md).

```astro
<header data-site-header data-scrolled-threshold="80" class="sticky top-0 z-50">
  <div class="header-bar">…toggle + desktop nav…</div>
  <div id="mobile-menu" hidden>…</div>
</header>
```

`nav.ts` provides: `data-scrolled` on `[data-site-header]` past the
threshold (default 80px), and `aria-current="true"` on every `a[href="#id"]`
copy (desktop nav AND drawer) while its `section[id]` crosses the viewport
center. Your CSS owns every visual response:

```css
/* the component's own <style>, or custom.css */
[data-site-header][data-scrolled] .header-bar {
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.nav-link[aria-current] {
  color: var(--color-primary);
  text-decoration: underline; /* a visible state, not color alone */
}
```

Rules:

- The header stays `position: sticky; top: 0` regardless of `data-scrolled` —
  the attribute changes appearance, never position.
- `[data-scrolled]` styling targets the INNER bar
  (`[data-scrolled] .header-bar { ... }`), never the header root, and
  never adds `backdrop-filter`/`filter`/`transform` to the root or to any
  ancestor of a fixed drawer — that creates a containing block and breaks
  the drawer in the scrolled state only (recipe 2's containing-block trap;
  the contract smoke suite fails the build on it).
- `scroll-mt-20` on sections assumes the sticky header is ≤ 5rem tall. A
  taller designed header needs a matching larger `scroll-mt-*` on EVERY
  section, or anchored content lands clipped beneath the header — verify by
  clicking every nav link at 390, not by eyeballing the CSS.
- Bespoke scroll-driven header MOTION (a wordmark that shrinks, a CTA that
  rides in) still belongs in `registerCustomAnimations()` — but drive it off
  the same `[data-scrolled]` attribute or its own trigger; never duplicate
  the state logic.
- Sticky contact bar tuck: give the bar `data-contact-bar
  data-tuck-when="#hero-ctas"` and style `[data-tucked]` in CSS — the bar
  hides while the hero's own CTAs are on screen and returns after. JS only
  ever adds the attribute, so no-JS visitors keep the contact path.

## 8. Motion helpers

Why: `src/lib/animation/helpers.ts` ships three headless "aliveness"
primitives — `marquee`, `parallax`, `counter` — no markup opinions, same
category as `form.ts`/`reveal.ts`. Quote the contract, don't reinvent it.

```ts
// src/lib/animation/custom.ts
import { counter, marquee, parallax } from "@/lib/animation/helpers";

export function registerCustomAnimations(_ctx: CustomAnimationContext): undefined {
  const ticker = document.querySelector<HTMLElement>("[data-marquee]");
  if (ticker) marquee(ticker, { speed: 40 });

  const hero = document.querySelector<HTMLElement>("[data-parallax]");
  if (hero) parallax(hero, { speed: 0.3 });

  for (const stat of document.querySelectorAll<HTMLElement>("[data-counter-target]")) {
    counter(stat);
  }

  return undefined;
}
```

Rules:

- Import `{ marquee, parallax, counter }` from `@/lib/animation/helpers`
  INSIDE `registerCustomAnimations` only — never from a component's own
  inline script.
- Still-frame contract, verbatim from the file's doc comment: "the
  server-rendered markup must already show the FINAL state, because
  reduced-motion and no-JS visitors only ever see it as-is" — `counter()`
  "only re-animates a value that was already correct at rest"; `marquee()`'s
  children, before duplication, "must already read as the complete,
  correctly-ordered content".
- `marquee()` layout precondition, verbatim: "el must already lay out as a
  single non-wrapping row — e.g. `flex w-max flex-nowrap`, or
  `whitespace-nowrap` with inline children — inside an ancestor viewport with
  `overflow-hidden`." The guard warns once and skips the tween when the walk
  finds no clipping ancestor (a detached element with no parent bypasses the
  guard — always call on connected DOM). Duplicated children are marked
  `aria-hidden` automatically (ids stripped) so screen readers never read the
  content twice — if the marquee's own content repeats text already visible
  elsewhere on the page (a purely decorative ticker), the AUTHOR must
  `aria-hidden` the whole element too; the helper only hides the duplicate
  half.
- `counter()`: the element's server-rendered `textContent` must already be
  the real final formatted number (no placeholder "0"); wrap it in
  `force-ltr` (numerals read LTR even inside an RTL page); `data-counter-target`
  holds the numeric value the tween counts up to. `counter()` overwrites the
  element's ENTIRE `textContent` on every tick — a unit/suffix ("+", "%",
  "₪") baked into the same text node gets clobbered on the first frame. Put
  the suffix in a sibling `<span>` outside the counted element, never inside
  it. `data-counter-target` is also parsed with `Number.parseFloat` but
  animated toward with `Math.round()` on every write — author integer
  targets only (counting up to "4.5" reads as a rounding glitch mid-tween,
  not a design choice).
- `parallax()`: keep `speed` between 0.1 and 0.5; it's a pure `yPercent`
  transform driven by a scrub `ScrollTrigger` — no layout properties touched,
  so no CLS. Apply it to a decorative or purely visual inner layer (a
  background image/shape, never the element carrying the actual copy) —
  a scrub-driven `ScrollTrigger` renders the element at its scrubbed offset
  on FIRST paint if the trigger's scroll range is already partially crossed
  (e.g. the element starts in view), so content whose resting position
  matters (headings, CTAs, anything read at rest) must never be the
  parallaxed element itself.

## 9. Mobile sticky contact bar

Why: DESIGN-DOCTRINE's mobile-first bar requires the primary CTA stay
thumb-reachable, and the page contract requires a contact path reachable
from the page — a fixed bottom bar (tel/WhatsApp) is the strong default for
service businesses on a phone-sized canvas.

```astro
---
import { telHref, whatsappHref } from "@/lib/business";
---

<div
  class="fixed inset-x-0 bottom-0 z-40 flex min-h-14 items-center gap-2 border-t border-line bg-surface p-2 md:hidden"
  style="padding-block-end: env(safe-area-inset-bottom)"
>
  <a
    href={telHref(data.contact.phone)}
    aria-label={copy.callLabel}
    class="flex min-h-11 flex-1 items-center justify-center rounded-button bg-primary text-surface"
  >
    <bdi class="force-ltr">{data.contact.phone}</bdi>
  </a>
  {data.contact.whatsapp && (
    <a
      href={whatsappHref(data.contact.whatsapp)}
      aria-label={copy.whatsappLabel}
      class="flex min-h-11 flex-1 items-center justify-center rounded-button bg-secondary text-surface"
    >
      {copy.whatsappLabel}
    </a>
  )}
</div>

<div class="min-h-14 md:hidden" aria-hidden="true" style="padding-block-end: env(safe-area-inset-bottom)"></div>
```

Rules:

- `md:hidden fixed inset-x-0 bottom-0 z-40 min-h-14` — mobile-only,
  spans the full inline axis; `padding-block-end: env(safe-area-inset-bottom)`
  clears the iOS home-indicator area.
- Phone via `telHref()`, WhatsApp via `whatsappHref()` (or
  `resolveHref("whatsapp", business)` when the href comes from a JSON
  sentinel) — never hand-format a `tel:`/`wa.me` URL. `data.contact.whatsapp`
  is optional — guard the link and let the bar go phone-only when it's
  absent (`resolveHref` already falls back to `tel:` on its own).
- Labels and `aria-label`s are client-authored content — there's no
  canonical `content.contactBar` shape shipped (same situation as the
  contact form: add the field to the schema yourself) — never a literal
  string.
- The bar's background sits on one of AGENTS.md's validated contrast pairs
  (e.g. `bg-surface` with `text-ink`/`text-primary`) — never a color outside
  the palette contract.
- Thumb-zone sizing: `min-h-14` on the bar, `min-h-11` (or larger) on each
  tap target — no target smaller than 44px effective.
- Add a matching spacer (or bottom padding on the last content block), sized
  to the bar's height and `md:hidden` — otherwise the fixed bar permanently
  covers the footer's last lines on mobile. The bar's REAL rendered height is
  `min-h-14` PLUS `env(safe-area-inset-bottom)` (the bar's own bottom
  padding) — a spacer that only matches `min-h-14` undercounts on devices
  with a home-indicator inset, so the spacer needs the same
  `padding-block-end: env(safe-area-inset-bottom)`, not just the same
  `min-h-14`.
- `inset-x-0`, never `left-0 right-0` written separately and never
  `inset-inline-0` (TRAPS 17 — it compiles to nothing and the bar becomes
  shrink-to-fit). `inset-x-0` is direction-agnostic anyway.
- This bar counts toward the page contract's "clear contact path reachable"
  — it doesn't replace the nav's own contact link, but on mobile it's
  usually the one visitors actually use.

## 10. Subpages (service pages, service × city landing pages)

Why: the one-pager is the DEFAULT, not the ceiling. When a client needs
service detail pages or service-per-city landing pages (the highest-yield
local-SEO play: "אינסטלטור בחולון"), the plumbing is already here — this
recipe is the canonical way to use it. Everything stays schema-first.

1. **Content model** — add a per-client pages shape to `business.schema.ts`
   (there is deliberately no canonical `content.pages` shipped: its fields
   depend on the design). The non-negotiables are a `slug`, a per-page
   `title`, and a per-page `description`:

```ts
// business.schema.ts — inside content, per-client region
servicePages: z
  .array(
    z.object({
      slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
      /** Per-page <title> — targets THIS page's query, not the homepage's. */
      title: z.string().min(1).max(70),
      description: z.string().min(1).max(170),
      heading: z.string().min(1),
      body: z.array(z.string().min(1)).min(1),
    }).strict(),
  )
  .optional(),
```

2. **Route** — one dynamic route generates them all:

```astro
---
// src/pages/[slug].astro
import BaseLayout from "@/layouts/BaseLayout.astro";
import JsonLd from "@/components/seo/JsonLd.astro";
import { getBusiness } from "@/lib/business";
import { breadcrumbJsonLd } from "@/lib/jsonld";

export async function getStaticPaths() {
  const business = await getBusiness();
  return (business.content.servicePages ?? []).map((page) => ({
    params: { slug: page.slug },
    props: { page },
  }));
}

const { page } = Astro.props;
const business = await getBusiness();
---

<BaseLayout title={page.title} description={page.description}>
  <JsonLd
    data={breadcrumbJsonLd(business, [
      { name: business.data.name, path: "/" },
      { name: page.heading, path: `/${page.slug}/` },
    ])}
    slot="head"
  />
  <!-- header/nav/footer: same components as the homepage -->
  <main id="main">
    <h1>{page.heading}</h1>
    {page.body.map((paragraph) => <p>{paragraph}</p>)}
  </main>
</BaseLayout>
```

(If `BaseLayout` has no head slot in your clone, render the `<JsonLd>` at the
top of `<main>` — JSON-LD is valid anywhere in the document.)

Rules:

- **Per-page SEO is the whole point**: every page gets its own `title` /
  `description` via BaseLayout props, its own canonical (automatic — SEO.astro
  canonicalizes per pathname), and a `BreadcrumbList` via `breadcrumbJsonLd()`.
  Never let subpages fall back to the homepage's default title.
- The sitemap picks new routes up automatically (`@astrojs/sitemap`).
- Nav: cross-PAGE links use full paths (`/plumbing/`) — the contract tests
  ignore non-`#` hrefs by design. Mark the current page's nav link with
  `aria-current="page"` (recipe 7's scroll-spy `aria-current` handles
  `#section` links on the one-pager only).
- Coverage does NOT extend automatically: `tests/a11y.spec.ts` scans a fixed
  path list and the smoke suite targets `/`. ADD a client-repo spec that
  loops over the new slugs (axe + the h1 rule) — the contract suite is
  add-only, never edited.
- City pages must have REAL differentiated content (local proof, areas,
  testimonials from that city) — a template paragraph with the city name
  swapped is doorway-page territory and Google treats it accordingly.
- The FAQ stays on the page that renders it (`withFaqJsonLd` on that page
  only).

## 11. Open-now status (headless)

Why: "are they open RIGHT NOW" is the question a phone visitor arrives with,
and the naive implementation ships two real bugs (wrong after midnight,
wrong time zone abroad) and one measured perf trap (docs/TRAPS.md: ICU
timezone data on the critical path delaying the hero LCP). The logic ships
tested in `src/lib/hours.ts`, wired in BaseLayout — author only the markup
and labels:

```astro
---
import { getBusiness } from "@/lib/business";
import { serializeSchedule } from "@/lib/hours";

const business = await getBusiness();
// Labels come from the CLIENT's own content schema (schema-first, as ever).
const { openNow } = business.content.hero;
---

<p
  data-open-now
  data-schedule={serializeSchedule(business.data)}
  data-label-open={openNow.open}
  data-label-closed={openNow.closed}
  data-label-until={openNow.until}
  data-label-opens={openNow.opensAt}
  hidden
>
  <span data-open-now-text></span>
</p>
```

Rules:

- The element ships `hidden` — the full hours table elsewhere on the page is
  the no-JS answer; a status that is silently WRONG is worse than one that
  is absent. The helper reveals it (idle-deferred, off the LCP path) and
  toggles `data-open` while the business is open — style both states in CSS.
- The computation runs in Asia/Jerusalem regardless of the device's zone,
  honors `data.specialHours` (חגים), and handles ranges that cross midnight
  in both directions — covered by `tests/hours.spec.ts`; don't reimplement.
- The rendered text is `<open-label> · <until-label> 23:30` — times are
  numeric runs; if your design wraps them differently, keep `.force-ltr`
  off Hebrew phrases and on bare numeric runs only (docs/TRAPS.md).
