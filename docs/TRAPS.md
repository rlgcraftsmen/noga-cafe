# Traps — measured failures from shipped builds

Every entry here cost real hours in a real client build, was measured (not
guessed), and will recur unless checked. Read this BEFORE composing a page
and again before the Lighthouse gate. This file is the memory the promote
loop feeds: when a client build discovers a new trap (a measured regression,
a defect class the gate missed), add it here with numbers, in the same
commit as the fix — that's what makes the next build faster than this one.

## Performance (Lighthouse budgets: LCP ≤ 2.5s, TBT ≤ 200ms, CLS ≤ 0.1)

1. **Preloading both font faces delays the LCP image.** Two `<Font preload>`
   tags put ~36KB of woff2 at high priority in FRONT of the hero photograph;
   measured ~230ms of LCP on a build sitting at the 2.5s ceiling. The
   template now preloads ONLY the display face (the h1 needs it for first
   paint); the body face swaps in. Don't add a second preload back.
2. **SVG-filter backgrounds rasterize on the main thread.** An inline
   `feTurbulence` data-URI grain texture, repeated per section band, took
   measured TBT from 56ms → 195ms against a 200ms budget (reducing
   `numOctaves` did nothing). Fix: bake the tile to a tiny seeded PNG
   (64×64 indexed, ~1KB) and reference that — TBT back to ~53ms. Any
   `filter()`/`feTurbulence`/`feDisplacementMap` in a painted background is
   suspect.
3. **`Intl.DateTimeFormat` with a named `timeZone` pulls ICU data.** First
   construction cost ~160ms of main-thread time under Lighthouse's 4×
   throttle — enough to push a hero LCP from 2.4s → 2.8s with the
   "Load Time 0ms / Render Delay 2358ms" signature (bytes arrived, main
   thread too busy to paint). Fix: defer any timezone computation to
   `requestIdleCallback` and ship the element `hidden` until it resolves —
   `src/lib/hours.ts` already does this; use it instead of reimplementing.
4. **Extra requests competing with the LCP image.** Even a 1KB texture PNG
   on the hero band competed with the hero photograph and pushed LCP to
   2.65s. Keep the hero's request list minimal: the photo, the display
   font, nothing decorative.
5. **Run `npm run build && npm run lhci` at the mid-build checkpoint** (hero
   + first two sections), not only at the final gate — every budget failure
   found at the gate reworks decisions made hours earlier.

## Scroll/animation state

6. **ScrollTrigger `end` ranges go stale as the page grows.** Lazy images
   loading while the user scrolls grew a page ~900px after refresh; a
   scrolled-state trigger ended short, reported inactive over the last
   screen, and the header's ink logo went invisible on the near-black
   footer. Invisible to the test suite because a viewport resize forces the
   refresh that repairs it. Fix: scroll STATE (header tint, aria-current)
   lives in `src/lib/nav.ts` reading the live scroll position — never in a
   ScrollTrigger. ScrollTriggers are for MOTION; if one must span the page,
   use `end: "max"` with an `onUpdate` reading live values, not a cached
   range.
7. **State is not motion.** `data-scrolled`, `aria-current`, a working
   drawer — a reduced-motion user must get all of them. Anything inside the
   `gsap.matchMedia` reduced-motion guard disappears for those users;
   `nav.ts` runs outside it on purpose. Only ANIMATION goes in
   `registerCustomAnimations()`.

## Accessibility / RTL

8. **Focusable at `opacity: 0`.** A header CTA faded out with opacity kept
   receiving keyboard focus — an invisible tab stop. Anything hidden
   visually must also leave the tab order: toggle `visibility` (with a
   delayed transition) or `hidden`/`inert`, never opacity alone. The
   drawer helper already handles this for the drawer.
9. **`.force-ltr` on a Hebrew phrase flips the whole block's alignment.**
   `force-ltr` sets `direction: ltr`, which also left-aligns the BLOCK
   inside an RTL column — a stat figure detached from its label. Use it
   only on bare numeric/Latin runs (phones, prices, emails, times); a
   Hebrew phrase containing a number ("החל מ־₪51") needs `<bdi>` alone.
   When unsure, measure per-character x-positions in the browser rather
   than eyeballing a screenshot.
10. **Tap targets under 24×24.** WCAG 2.2 AA floor; six links in one build
    were under it (20px-tall footer links, a 285×30 hero phone link).
    Check every `<a>`/`<button>` at 390 during the mobile pass — the axe
    suite does not fully catch this.
11. **The containing-block drawer trap (every shipped site has hit this).**
    `filter`, `backdrop-filter`, `transform`, `perspective`,
    `will-change: transform`, or `contain: layout|paint` on `<header>` — or
    ANY ancestor of the drawer — makes that element the containing block for
    `position: fixed` descendants: a fixed full-screen drawer inside it stops
    covering the viewport and gets trapped in the header's box ("won't open",
    or paints behind the page). The killer variant applies a glass effect
    only in the scrolled state (`header[data-scrolled] { backdrop-filter: … }`):
    the drawer works at the top of the page and breaks the moment the user
    scrolls — which is why a nav check performed at scroll-0 always passes
    and the bug ships anyway. Canonical structure that makes this impossible:
    RECIPES recipe 2 (effects on the inner bar, header root positioning-only,
    drawer a sibling of the bar). The contract smoke suite fails the build on
    it — in the scrolled state, where it actually breaks.

## Build hygiene

12. **UTF-8 BOM in `business.json`** breaks `JSON.parse` at config load
    (PowerShell `Out-File -Encoding utf8` writes one). Write UTF-8 without
    BOM.
13. **`test:ltr-build` leaves an English build in `dist/`** — rebuild before
    serving or measuring dist afterwards (the gate's ordering in
    `/new-client` Step 6 already accounts for this).

## Navigation

14. **A drawer that closes on `pointerdown` eats its own link activations.**
    Closing starts the drawer's exit transition while the finger is still
    down; the link slides out from under the pointer and the browser never
    fires `click` at all. Measured on a shipped site: a 0ms tap navigated, and
    120ms / 250ms / 400ms presses all did nothing — i.e. it worked for every
    automated test and for no human being. The operator reported it three
    times before it was reproduced. `nav.ts` now releases only the scroll lock
    on `pointerdown` and closes on `click`. **Test drawer links with a HELD
    press (`mouse.down()` → wait 200ms → `mouse.up()`), never `tap()`/`click()`
    alone — an instant tap cannot catch this class of bug.**
15. **`preventDefault()` + a smooth scroll that no-ops = a dead link.** The
    anchor handler cancels the browser's native jump before delegating to
    Lenis. Any condition where `lenis.scrollTo()` fails to move the page
    therefore kills in-page navigation outright, silently. Observed when
    `window.innerHeight` reports 0 (embedded/automated/offscreen tabs): Lenis
    derives its scroll from the viewport height, computes a zero-length
    scroll, and moves nothing while native scrolling still works perfectly.
    `index.ts` now skips Lenis at zero height and falls back to a native jump
    if the page hasn't moved 250ms after the click.
16. **Lenis applies `scroll-margin-top` itself.** Passing
    `{ offset: -marginTop }` on top of that subtracts it twice, so anchors
    landed at 2x the margin under Lenis and 1x via any native path — two
    different landings depending on which code path ran. Pass no offset.
17. **`inset-inline-0` is not a Tailwind utility.** It compiles to nothing, so
    a `fixed` bar written with it is shrink-to-fit instead of spanning the
    viewport. The mobile contact bar and a client header both shipped visibly
    broken this way. Use `inset-x-0`.
18. **The drawer tests skip themselves without `id="menu-toggle"`.**
    `smoke.spec.ts` and `a11y.spec.ts` select the toggle by that id and
    `test.skip()` when it is missing — so a build that follows only the
    documented `data-nav-toggle` contract runs neither the drawer tests nor
    the containing-block-trap test that is meant to fail the build. Green
    output, zero coverage. RECIPES recipe 2 now documents the id.
