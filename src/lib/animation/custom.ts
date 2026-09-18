import type { gsap } from "gsap";
import type { ScrollTrigger } from "gsap/ScrollTrigger";
import type Lenis from "lenis";

export interface CustomAnimationContext {
  gsap: typeof gsap;
  ScrollTrigger: typeof ScrollTrigger;
  lenis: Lenis;
}

/**
 * Per-client bespoke motion — THE entry point for a site's signature
 * animations (docs/DESIGN-DOCTRINE.md). Called INSIDE the template's
 * gsap.matchMedia("(prefers-reduced-motion: no-preference)") context:
 *
 * - Reduced-motion users never execute this code — design the still frame first.
 * - Tweens/ScrollTriggers created synchronously here are auto-reverted on
 *   page swap (astro:before-swap). Return a cleanup function ONLY for
 *   listeners/observers/rAF loops you own.
 * - Lenis and ScrollTrigger are already synced; importing gsap here adds
 *   ~0 bytes (already in the bundle).
 * - RTL: raw `x:` values don't auto-mirror — multiply by the CSS var
 *   --dir-factor (1 in LTR, -1 in RTL; defined in global.css). Note:
 *   reveal.ts's own inlineStartFactor() helper uses the OPPOSITE sign
 *   (-1 in LTR, 1 in RTL) — that inversion is intentional for its
 *   slide-start/slide-end math, not a second source of truth for
 *   --dir-factor. Don't reuse its return value assuming it equals
 *   --dir-factor.
 *
 * Ships as a no-op in the template.
 */
export function registerCustomAnimations(_ctx: CustomAnimationContext): undefined | (() => void) {
  return undefined;
}
