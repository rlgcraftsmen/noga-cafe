/**
 * Headless site-nav mechanics. The model designs 100% of the header, drawer,
 * and contact bar — markup, layout, and every visual response. This module
 * provides only the tested behavior underneath, the part every shipped build
 * used to re-derive by hand and every one of them shipped with a different
 * defect (see docs/TRAPS.md).
 *
 * All hooks are optional data attributes — a page using none of them costs
 * nothing. JS only ever flips attributes; ALL visual response lives in the
 * client's CSS.
 *
 * Markup contract (docs/RECIPES.md recipes 2 + 7):
 *
 * 1. Drawer — `<button data-nav-toggle aria-controls="<drawer-id>"
 *    aria-expanded="false" data-open-label="…" data-close-label="…">` plus a
 *    drawer element with that id carrying the `hidden` attribute. Optional:
 *    `[data-nav-close]` button(s) inside the drawer; `data-close-ms` on the
 *    drawer to match its close transition (default 300). Provided behavior:
 *    - `aria-expanded` + label swap (labels from content.ui via data-*).
 *    - Open: `hidden` clears, then `data-open` is set on the NEXT frame so
 *      CSS transitions/staggers actually run (same-frame set cancels them).
 *    - Close: `data-open` clears immediately; `hidden` lands after
 *      `data-close-ms` so the close transition is visible but the links are
 *      never tabbable while invisible.
 *    - Focus moves into the drawer on open, is trapped while open (the
 *      drawer covers the page — Tab must not walk onto content behind it),
 *      Escape closes, and focus returns to the toggle on close.
 *    - Body scroll locks while open (`.is-locked`), released on close and
 *      on `astro:before-swap`.
 *    - A link click closes on `pointerdown` (before the animation layer's
 *      capture-phase anchor handler starts a Lenis scroll against a locked
 *      body) AND on `click` (keyboard activation fires no pointer event).
 * 2. Scrolled state — `[data-site-header]` gets `data-scrolled` once the
 *    page is scrolled past `data-scrolled-threshold` px (default 80), read
 *    from the LIVE scroll position on every scroll event — never from a
 *    ScrollTrigger range that can go stale as lazy images grow the page.
 * 3. Active section — every `a[href="#id"]` whose target is a `section[id]`
 *    gets `aria-current="true"` while that section crosses the viewport
 *    center (all copies: desktop nav + drawer). Pair with a visible CSS
 *    state, not color alone.
 * 4. Contact bar tuck — `[data-contact-bar data-tuck-when="<selector>"]`
 *    gets `data-tucked` while the selector's first match is on screen (e.g.
 *    tuck the sticky bar while the hero's own CTAs are visible). JS only
 *    ever ADDS the attribute — a no-JS visitor keeps the contact path.
 *
 * These are deliberately NOT inside the reduced-motion matchMedia guard:
 * a drawer that opens, a header that responds to scroll, and aria-current
 * are STATE, not motion — a reduced-motion user must get all of them (their
 * CSS simply transitions instantly).
 *
 * Wired once in BaseLayout on astro:page-load; document/window listeners are
 * scoped to an AbortController torn down on astro:before-swap, so page swaps
 * never accumulate duplicates.
 */

let controller: AbortController | null = null;

function releaseScrollLock(): void {
  document.body.classList.remove("is-locked");
}

function setupDrawer(toggle: HTMLButtonElement, signal: AbortSignal): void {
  const drawerId = toggle.getAttribute("aria-controls") ?? "";
  const drawer = document.getElementById(drawerId);
  if (!(drawer instanceof HTMLElement)) return;

  const closeMs = Number.parseInt(drawer.dataset.closeMs ?? "", 10) || 300;
  let closeTimer = 0;

  const isOpen = (): boolean => toggle.getAttribute("aria-expanded") === "true";

  const focusables = (): HTMLElement[] =>
    Array.from(
      drawer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );

  const setOpen = (open: boolean): void => {
    window.clearTimeout(closeTimer);
    toggle.setAttribute("aria-expanded", String(open));
    const label = open ? toggle.dataset.closeLabel : toggle.dataset.openLabel;
    if (label) toggle.setAttribute("aria-label", label);
    document.body.classList.toggle("is-locked", open);

    if (open) {
      drawer.hidden = false;
      // Next frame: an element revealed from display:none in the same frame
      // never runs its entrance transitions/staggers.
      requestAnimationFrame(() => {
        drawer.setAttribute("data-open", "");
        focusables()[0]?.focus();
      });
      return;
    }

    drawer.removeAttribute("data-open");
    closeTimer = window.setTimeout(() => {
      drawer.hidden = true;
    }, closeMs);
  };

  const close = (): void => {
    if (!isOpen()) return;
    setOpen(false);
    toggle.focus();
  };

  toggle.addEventListener("click", () => setOpen(!isOpen()), { signal });

  for (const button of drawer.querySelectorAll("[data-nav-close]")) {
    button.addEventListener("click", close, { signal });
  }

  for (const link of drawer.querySelectorAll("a")) {
    // pointerdown releases the SCROLL LOCK only — it must NOT close the
    // drawer. Closing here starts the drawer's exit transition while the
    // pointer is still down, so the link slides out from under it and the
    // browser never fires `click` at all: every press longer than a few
    // milliseconds silently did nothing (docs/TRAPS.md). Automated taps are
    // ~1ms, which is why no suite ever caught it. Unlocking is the part the
    // animation layer actually needs before its capture-phase handler starts
    // a Lenis scroll against a locked body.
    link.addEventListener("pointerdown", releaseScrollLock, { signal });
    // The drawer closes on click — after the capture-phase anchor handler has
    // already started the scroll. Also covers keyboard activation, which
    // fires no pointer event.
    link.addEventListener("click", () => setOpen(false), { signal });
  }

  document.addEventListener(
    "keydown",
    (event) => {
      if (!isOpen()) return;

      if (event.key === "Escape") {
        close();
        return;
      }

      if (event.key !== "Tab") return;
      // The drawer covers the viewport — Tab must cycle inside it, never walk
      // onto the (invisible) page behind.
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    { signal },
  );
}

function setupScrolledState(header: HTMLElement, signal: AbortSignal): void {
  const threshold = Number.parseInt(header.dataset.scrolledThreshold ?? "", 10) || 80;
  let ticking = false;

  const update = (): void => {
    ticking = false;
    // Live position every time — a cached range (ScrollTrigger's default
    // `end: max`) goes stale as lazy images grow the page, and the header
    // loses its background over the footer (docs/TRAPS.md).
    header.toggleAttribute("data-scrolled", window.scrollY > threshold);
  };

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true, signal },
  );
  update();
}

function setupActiveSection(signal: AbortSignal): void {
  const sections: HTMLElement[] = [];
  const linksBySection = new Map<HTMLElement, HTMLElement[]>();

  for (const section of document.querySelectorAll<HTMLElement>("section[id]")) {
    // Nav links usually exist twice (desktop nav + drawer) — collect all
    // copies; CSS decides what an active link looks like in each place.
    const links = Array.from(
      document.querySelectorAll<HTMLElement>(`a[href="#${CSS.escape(section.id)}"]`),
    );
    if (links.length === 0) continue;
    sections.push(section);
    linksBySection.set(section, links);
  }
  if (sections.length === 0) return;

  const apply = (active: HTMLElement | null): void => {
    for (const [section, links] of linksBySection) {
      for (const link of links) {
        if (section === active) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      }
    }
  };

  // A section is "active" while it crosses the viewport's vertical center —
  // the zero-height band at 50% means at most one section matches at a time.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.target instanceof HTMLElement) {
          apply(entry.target);
          return;
        }
      }
      // Only clear when the section that LEFT was the active one — entries
      // only contain elements whose intersection changed.
      const current = sections.find((s) =>
        linksBySection.get(s)?.[0]?.hasAttribute("aria-current"),
      );
      if (current && entries.some((e) => e.target === current && !e.isIntersecting)) {
        apply(null);
      }
    },
    { rootMargin: "-50% 0px -50% 0px" },
  );
  for (const section of sections) observer.observe(section);
  signal.addEventListener("abort", () => observer.disconnect());
}

function setupContactBarTuck(bar: HTMLElement, signal: AbortSignal): void {
  const selector = bar.dataset.tuckWhen;
  if (!selector) return;
  let target: Element | null = null;
  try {
    target = document.querySelector(selector);
  } catch {
    return; // malformed selector — leave the bar permanently visible
  }
  if (!target) return;

  const observer = new IntersectionObserver(([entry]) => {
    // JS only ever tucks — with no JS (or before this runs) the bar shows,
    // so the contact path is never lost.
    bar.toggleAttribute("data-tucked", entry?.isIntersecting ?? false);
  });
  observer.observe(target);
  signal.addEventListener("abort", () => observer.disconnect());
}

export function setupSiteNav(): void {
  controller?.abort();
  controller = new AbortController();
  const { signal } = controller;

  for (const toggle of document.querySelectorAll("[data-nav-toggle]")) {
    if (toggle instanceof HTMLButtonElement) setupDrawer(toggle, signal);
  }

  const header = document.querySelector("[data-site-header]");
  if (header instanceof HTMLElement) setupScrolledState(header, signal);

  setupActiveSection(signal);

  for (const bar of document.querySelectorAll<HTMLElement>("[data-contact-bar]")) {
    setupContactBarTuck(bar, signal);
  }
}

export function teardownSiteNav(): void {
  controller?.abort();
  controller = null;
  releaseScrollLock();
}
