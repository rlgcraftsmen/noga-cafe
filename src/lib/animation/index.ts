import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
// Lenis's own stylesheet: neutralizes CSS scroll-behavior while Lenis drives
// the scroll, and enables [data-lenis-prevent] for nested scrollers (drawers).
import "lenis/dist/lenis.css";
import { registerCustomAnimations } from "./custom";
import { setupReveals } from "./reveal";

gsap.registerPlugin(ScrollTrigger);

/**
 * Animation lifecycle. Wired once in BaseLayout.astro:
 *   astro:page-load  → initAnimations()
 *   astro:before-swap → destroyAnimations()
 *
 * Everything is created inside gsap.matchMedia() guarded by
 * prefers-reduced-motion, so reduced-motion users get a static page and
 * mm.revert() reliably kills every tween + ScrollTrigger between page swaps.
 *
 * Anchor scrolling is handled here (NOT via Lenis's `anchors` option): Lenis
 * ignores CSS scroll-margin-top, which every section sets via scroll-mt-20,
 * and it never moves keyboard focus — which would strand the skip link.
 * Reduced-motion users get native fragment navigation, which does both.
 */

let mm: gsap.MatchMedia | null = null;
let rafCallback: ((time: number) => void) | null = null;

function setupAnchorScrolling(lenis: Lenis): () => void {
  const onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const element = event.target instanceof Element ? event.target : null;
    const anchor = element?.closest('a[href^="#"]');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    // A malformed percent-escape throws URIError; fall back to the raw hash
    // rather than letting the handler die mid-click.
    let id: string;
    try {
      id = decodeURIComponent(anchor.hash.slice(1));
    } catch {
      id = anchor.hash.slice(1);
    }
    if (id === "") return;
    const target = document.getElementById(id);
    if (!target) return;

    event.preventDefault();
    // Native fragment navigation honors scroll-margin-top; Lenis does not —
    // read it off the target so the mandated scroll-mt-20 keeps working.
    const marginTop = Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    history.pushState(null, "", anchor.hash);
    // Fragment navigation also moves keyboard focus — replicate it BEFORE the
    // scroll (focus-first pattern), or the skip link scrolls without focus
    // ever leaving the header (WCAG 2.4.1) and nav jumps strand Tab order at
    // the menu. Not in onComplete: Lenis skips the callback when the target
    // is already at the current scroll position.
    if (!target.hasAttribute("tabindex") && target.tabIndex < 0) {
      target.setAttribute("tabindex", "-1");
    }
    target.focus({ preventScroll: true });

    // Where native navigation would have landed. preventDefault() has already
    // cancelled the browser's own jump, so if the smooth scroll fails to move
    // the page, nothing else will — the link would simply be dead.
    const startY = window.scrollY;
    const targetY = Math.max(
      0,
      Math.round(target.getBoundingClientRect().top + startY - marginTop),
    );
    const needsToMove = Math.abs(targetY - startY) > 2;

    // No `offset` here: current Lenis honours scroll-margin-top itself, so
    // passing it again subtracted it twice and anchors landed at 2x the
    // margin. Lenis also derives its scroll from the viewport height; some
    // contexts report window.innerHeight === 0 (embedded/automated/offscreen
    // tabs) and it then computes a zero-length scroll and moves nothing at
    // all, while native scrolling still works. Don't hand it the scroll then.
    if (window.innerHeight > 0) {
      lenis.scrollTo(target);
    }

    if (!needsToMove) return;

    // Safety net for every other way the smooth scroll can fail to start: if
    // the page hasn't budged shortly after the click, jump natively. A
    // smooth-scroll library failing must degrade to a jump, never to nothing.
    window.setTimeout(() => {
      if (Math.abs(window.scrollY - startY) < 2) {
        window.scrollTo({ top: targetY, behavior: "auto" });
      }
    }, 250);
  };

  // Capture phase: Astro's ClientRouter also handles same-page hash links on
  // a document-level bubble listener and would preventDefault first. Running
  // in capture wins the race; our preventDefault then makes the router skip
  // the event (it checks defaultPrevented). Propagation is NOT stopped, so
  // bubble listeners (e.g. a drawer's close-on-link-click) still run.
  document.addEventListener("click", onClick, { capture: true });
  return () => document.removeEventListener("click", onClick, { capture: true });
}

export function initAnimations(): void {
  destroyAnimations();

  mm = gsap.matchMedia();
  mm.add("(prefers-reduced-motion: no-preference)", () => {
    const lenisInstance = new Lenis({ autoRaf: false });
    lenisInstance.on("scroll", ScrollTrigger.update);

    rafCallback = (time: number) => {
      lenisInstance.raf(time * 1000);
    };
    gsap.ticker.add(rafCallback);
    gsap.ticker.lagSmoothing(0);

    const teardownAnchors = setupAnchorScrolling(lenisInstance);

    setupReveals();
    // ClientRouter swaps fire no `load` event, so trigger positions are
    // computed against pre-font-swap layout — refresh once fonts settle.
    void document.fonts.ready.then(() => ScrollTrigger.refresh());

    // Per-client signature motion (no-op in the template) — runs inside this
    // matchMedia context, so synchronous tweens revert with everything else.
    const customCleanup = registerCustomAnimations({ gsap, ScrollTrigger, lenis: lenisInstance });

    return () => {
      if (typeof customCleanup === "function") {
        customCleanup();
      }
      teardownAnchors();
      if (rafCallback) {
        gsap.ticker.remove(rafCallback);
        rafCallback = null;
      }
      // Restore the GSAP default changed above — global state must not leak
      // past this context's lifetime.
      gsap.ticker.lagSmoothing(500, 33);
      lenisInstance.destroy();
    };
  });
}

export function destroyAnimations(): void {
  // revert() runs the cleanup returned from mm.add() and reverts all
  // tweens/ScrollTriggers created inside it.
  mm?.revert();
  mm = null;
}
