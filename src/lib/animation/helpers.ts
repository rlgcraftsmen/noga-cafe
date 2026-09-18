import { gsap } from "gsap";

/**
 * "Aliveness" motion primitives: marquee / parallax / counter.
 *
 * These are plumbing, not design decisions — headless, no markup, no design
 * opinions (same category as form.ts/reveal.ts). Call them ONLY from
 * registerCustomAnimations() in src/lib/animation/custom.ts, which already
 * runs inside the template's
 * gsap.matchMedia("(prefers-reduced-motion: no-preference)") context:
 *
 *   - reduced-motion users never execute this code at all, so the markup's
 *     resting state must already be correct (see "still frame" below);
 *   - every tween/ScrollTrigger created in here is synchronous, so the
 *     lifecycle's mm.revert() (astro:before-swap) tears it all down
 *     automatically. That's why none of these functions start an rAF loop or
 *     attach a listener/observer that would outlive the call — if a job
 *     seems to need one, let gsap own the loop instead (see index.ts).
 *
 * Still-frame rule: the server-rendered markup must already show the FINAL
 * state, because reduced-motion and no-JS visitors only ever see it as-is:
 *   - counter(): el.textContent must already read as the final formatted
 *     number before this runs — counter() only re-animates a value that was
 *     already correct at rest.
 *   - marquee(): el's children, before duplication, must already read as the
 *     complete, correctly-ordered content.
 *
 * RTL: counter() writes numerals via el.textContent — wrap the element in
 * `.force-ltr` in the caller's markup (AGENTS.md's RTL rules); this module
 * never touches classes itself.
 *
 * marquee() duplicates el's children exactly once to build a seamless loop;
 * the duplicate set is marked aria-hidden="true" (and stripped of any `id`
 * attributes, to avoid duplicate DOM ids) so screen readers never read the
 * content twice and duplicated ids never collide. Duplication is guarded by
 * a data attribute, so calling marquee() again on an already-duplicated el
 * (a stray re-init) skips duplication — Astro page swaps give a fresh DOM
 * anyway, but the guard costs nothing and keeps the function idempotent.
 *
 * marquee()'s loop distance is MEASURED, not assumed: it reads the actual
 * pixel gap between the first original child and its cloned duplicate
 * (`firstDuplicate.offsetLeft - first.offsetLeft`), so children spaced with
 * flex `gap` OR margins both loop seamlessly — a hardcoded half-scrollWidth
 * endpoint is wrong the moment `gap` exists (the gap after the last original
 * child isn't part of scrollWidth/2, so the loop would jump by that gap on
 * every repeat).
 *
 * marquee() layout precondition: el must already lay out as a single
 * non-wrapping row — e.g. `flex w-max flex-nowrap`, or `whitespace-nowrap`
 * with inline children — inside an ancestor viewport with `overflow-hidden`.
 * With default block layout (children wrap/stack instead of running past
 * el's width), el.scrollWidth never exceeds its ancestor's clientWidth even
 * after duplication, so there's nothing to translate past — the tween would
 * just sit still or jitter. marquee() checks for this after duplicating
 * by walking the ancestor chain from el.parentElement up to document.body
 * (inclusive) — a shrink-to-fit `el` is always exactly as wide as its
 * content, so el's own clientWidth can never usefully signal overflow; an
 * ancestor viewport is what actually clips it. If any ancestor is narrower
 * than el.scrollWidth, we proceed; if none is found, console.warns once and
 * skips the tween rather than animating a no-op.
 */

function dirFactor(): number {
  // xPercent is a physical (viewport-relative) transform, not a logical one
  // — it does not auto-flip for RTL. Left uncorrected, a single hardcoded
  // sign would scroll the ticker toward a different edge (relative to
  // reading direction) depending on dir. Returning ltr -> 1 / rtl -> -1
  // means the DEFAULT (reverse: false) ticker always scrolls in the same
  // logical direction — toward the inline-start edge — in both LTR and RTL,
  // even though that's the opposite physical (left vs. right) direction in
  // each case; opts.reverse negates this again for a ticker that should run
  // the other way.
  return document.documentElement.dir === "rtl" ? -1 : 1;
}

export function marquee(el: HTMLElement, opts?: { speed?: number; reverse?: boolean }): void {
  const speed = opts?.speed ?? 40;
  const reverse = opts?.reverse ?? false;

  let originalCount: number;

  if (el.dataset.marqueeDuplicated !== "true") {
    const originalChildren = Array.from(el.querySelectorAll<HTMLElement>(":scope > *"));
    originalCount = originalChildren.length;
    for (const child of originalChildren) {
      const duplicate = child.cloneNode(true) as HTMLElement;
      duplicate.setAttribute("aria-hidden", "true");
      duplicate.removeAttribute("id");
      for (const nestedIdEl of duplicate.querySelectorAll<HTMLElement>("[id]")) {
        nestedIdEl.removeAttribute("id");
      }
      el.append(duplicate);
    }
    el.dataset.marqueeDuplicated = "true";
  } else {
    // A stray re-init on an already-duplicated el: the duplicate set was
    // appended after the originals, so the original count is exactly half
    // of the current child count.
    originalCount = el.children.length / 2;
  }

  // el must lay out as a single non-wrapping row (see the doc comment
  // above), typically shrink-to-fit (e.g. `w-max`) so it can be wider than
  // its own parent — which means el's children can never overflow EL's OWN
  // clientWidth (a shrink-to-fit box is, by definition, always exactly as
  // wide as its content). The actual clipping viewport is an ancestor, so
  // walk the chain from el.parentElement up to document.body to find it.
  // If nothing overflows, there's nothing to loop — warn once (not on every
  // re-init) and bail instead of animating a no-op.
  let hasClippingViewport = false;

  if (el.parentElement !== null) {
    let ancestor: Element | null = el.parentElement;
    while (ancestor !== null) {
      const ancestorEl = ancestor as HTMLElement;
      if (ancestorEl.clientWidth < el.scrollWidth) {
        hasClippingViewport = true;
        break;
      }
      if (ancestor === document.body) {
        break;
      }
      ancestor = ancestor.parentElement;
    }
  }

  if (!hasClippingViewport && el.parentElement !== null) {
    if (el.dataset.marqueeWarned !== "true") {
      console.warn(
        "[animation/helpers] marquee(): duplicated content doesn't overflow its ancestor viewport after duplication — nothing to loop. el must lay out as a single non-wrapping row (e.g. flex w-max flex-nowrap, or whitespace-nowrap inline children) inside an overflow-hidden ancestor.",
        el,
      );
      el.dataset.marqueeWarned = "true";
    }
    return;
  }

  // The seam is MEASURED, not assumed: a hardcoded 50%/-50% endpoint (half
  // of el's doubled scrollWidth) is only correct when children are flush
  // against each other with zero inter-child spacing. The moment children
  // have a flex `gap` (or margins), the gap AFTER the last original child
  // isn't included in "half of scrollWidth", so a 50%-based loop jumps by
  // that gap on every repeat. Instead, read the real pixel distance between
  // the first original child and its cloned duplicate — offsetLeft is always
  // a physical (left-edge) measurement, never logical, so it does NOT
  // auto-flip for RTL: in RTL flex rows the duplicate ends up at a SMALLER
  // offsetLeft than the original (the row fills right-to-left), the opposite
  // sign from LTR. Math.abs() of the difference is the correct advance
  // either way, without needing a direction branch here.
  const first = el.children[0];
  const firstDuplicate = el.children[originalCount];

  if (!(first instanceof HTMLElement) || !(firstDuplicate instanceof HTMLElement)) return;

  const advance = Math.abs(firstDuplicate.offsetLeft - first.offsetLeft);

  // Covers detached/degenerate cases for free: no children, a single child
  // with nothing to measure against, or a layout that hasn't resolved yet
  // all yield advance <= 0 — bail instead of animating a zero-distance tween.
  if (advance <= 0) return;

  // duration = advance / speed keeps ~pixels/second of the original content
  // regardless of gap; xPercent is expressed as a fraction of el's own
  // (doubled) BORDER box — percentage translate resolves against offsetWidth,
  // not scrollWidth (they differ when el carries inline borders/padding).
  const endXPercent = -(advance / el.offsetWidth) * 100 * dirFactor() * (reverse ? -1 : 1);

  gsap.fromTo(
    el,
    { xPercent: 0 },
    {
      xPercent: endXPercent,
      duration: advance / speed,
      ease: "none",
      repeat: -1,
    },
  );
}

export function parallax(el: HTMLElement, opts?: { speed?: number }): void {
  const speed = opts?.speed ?? 0.2;

  gsap.to(el, {
    yPercent: -100 * speed,
    ease: "none",
    scrollTrigger: {
      trigger: el,
      scrub: true,
      start: "top bottom",
      end: "bottom top",
    },
  });
}

export function counter(el: HTMLElement, opts?: { duration?: number }): void {
  const duration = opts?.duration ?? 1.6;
  const target = Number.parseFloat(el.dataset.counterTarget ?? "");

  if (Number.isNaN(target)) {
    console.warn("[animation/helpers] counter(): el.dataset.counterTarget is not a number", el);
    return;
  }

  const formatter = new Intl.NumberFormat(document.documentElement.lang);
  const state = { value: 0 };

  gsap.to(state, {
    value: target,
    duration,
    ease: "power1.out",
    scrollTrigger: { trigger: el, start: "top 85%", once: true },
    onUpdate: () => {
      el.textContent = formatter.format(Math.round(state.value));
    },
    onComplete: () => {
      // Final frame writes the exact formatted target, independent of any
      // rounding/float drift from the tweened value.
      el.textContent = formatter.format(target);
    },
  });
}
