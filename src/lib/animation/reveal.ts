import { gsap } from "gsap";

/**
 * Scroll-reveal conventions (the one canonical way to animate content in):
 *
 *   data-reveal               fade + rise
 *   data-reveal="slide-start"  fade + slide in from the inline-start edge (RTL-aware)
 *   data-reveal="slide-end"    fade + slide in from the inline-end edge (RTL-aware)
 *   data-reveal="scale"        fade + subtle scale-up
 *   data-reveal="blur"         fade + blur-out + slight rise (the ONE sanctioned
 *                              exception to transforms/opacity-only — animates
 *                              `filter`)
 *   data-reveal="clip"         inline-start wipe via `clipPath` (dir-aware: reads
 *                              document.documentElement.dir the same way
 *                              inlineStartFactor() does, so it wipes in from the
 *                              inline-start edge in both LTR and RTL)
 *   data-reveal-group          stagger direct children with fade + rise
 *
 * Per-element overrides (all optional; missing/invalid → the defaults below,
 * which are the exact constants the template always used):
 *
 *   data-reveal-duration   seconds, default 0.8 (single) / 0.7 (group)
 *   data-reveal-delay      seconds, default 0
 *   data-reveal-distance   px; replaces the hardcoded y/x travel distance for
 *                          the y-based, slide-*, and blur variants — default 28
 *                          for y-based (including data-reveal-group), 48 for
 *                          slide, 12 for blur
 *   data-reveal-start      ScrollTrigger start, default "top 85%"
 *   data-reveal-stagger    on [data-reveal-group] only, default 0.1
 *
 * Elements are fully visible without JS; gsap.from() only hides them once the
 * animation is actually going to run. Transforms/opacity only, except the
 * blur preset's `filter` and the clip preset's `clipPath`.
 */

const EASE = "power2.out";
const START = "top 85%";

function inlineStartFactor(): number {
  // translateX does not auto-flip in RTL — mirror it here.
  return document.documentElement.dir === "rtl" ? 1 : -1;
}

function isRtl(): boolean {
  return document.documentElement.dir === "rtl";
}

function num(el: HTMLElement, key: string, fallback: number): number {
  const v = Number.parseFloat(el.dataset[key] ?? "");
  return Number.isNaN(v) ? fallback : v;
}

function variant(kind: string, distance: number): gsap.TweenVars {
  switch (kind) {
    case "slide-start":
      return { x: distance * inlineStartFactor() };
    case "slide-end":
      return { x: -distance * inlineStartFactor() };
    case "scale":
      return { scale: 0.94 };
    case "blur":
      return { filter: "blur(12px)", y: distance };
    case "clip":
      return { clipPath: isRtl() ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)" };
    default:
      return { y: distance };
  }
}

export function setupReveals(): void {
  for (const el of document.querySelectorAll<HTMLElement>("[data-reveal]")) {
    const kind = el.dataset.reveal ?? "";
    const distance = num(
      el,
      "revealDistance",
      kind === "slide-start" || kind === "slide-end" ? 48 : kind === "blur" ? 12 : 28,
    );
    const duration = num(el, "revealDuration", 0.8);
    const delay = num(el, "revealDelay", 0);
    const start = el.dataset.revealStart ?? START;

    if (kind === "clip") {
      gsap.fromTo(
        el,
        { ...variant(kind, distance), opacity: 0 },
        {
          clipPath: "inset(0 0% 0 0%)",
          opacity: 1,
          duration,
          delay,
          ease: EASE,
          scrollTrigger: { trigger: el, start },
        },
      );
      continue;
    }

    gsap.from(el, {
      ...variant(kind, distance),
      opacity: 0,
      duration,
      delay,
      ease: EASE,
      scrollTrigger: { trigger: el, start },
    });
  }

  for (const group of document.querySelectorAll<HTMLElement>("[data-reveal-group]")) {
    const distance = num(group, "revealDistance", 28);
    const duration = num(group, "revealDuration", 0.7);
    const delay = num(group, "revealDelay", 0);
    const stagger = num(group, "revealStagger", 0.1);
    const start = group.dataset.revealStart ?? START;

    gsap.from(group.children, {
      y: distance,
      opacity: 0,
      duration,
      delay,
      stagger,
      ease: EASE,
      scrollTrigger: { trigger: group, start },
    });
  }
}
