/**
 * Conversion-event tracking. For most clients the lead path is a tel: or
 * WhatsApp tap — not the form — so those clicks are the numbers that matter.
 *
 * Events fire to whichever trackers are live: gtag/fbq exist only after the
 * visitor accepted cookies (ConsentBanner loads them), so without consent —
 * or on the many sites with no GA/Pixel configured — this is a silent no-op.
 * Cloudflare Web Analytics is pageview-only and cannot receive these.
 *
 * GA4 events: click_to_call / click_whatsapp / generate_lead (standard).
 * Meta events: Contact for taps, Lead for a sent form.
 *
 * Wired once in BaseLayout on astro:page-load.
 */

type TrackerFn = (...args: unknown[]) => void;

export function trackConversion(kind: "click_to_call" | "click_whatsapp" | "generate_lead"): void {
  // Local casts, not a global augmentation — ConsentBanner owns the Window
  // declarations for gtag/fbq.
  const w = window as { gtag?: TrackerFn; fbq?: TrackerFn };
  w.gtag?.("event", kind);
  w.fbq?.("track", kind === "generate_lead" ? "Lead" : "Contact");
}

let bound = false;

export function setupConversionTracking(): void {
  // A document-level listener survives ClientRouter swaps — bind exactly once.
  if (bound) return;
  bound = true;
  document.addEventListener("click", (event) => {
    const element = event.target instanceof Element ? event.target : null;
    const anchor = element?.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const href = anchor.getAttribute("href") ?? "";
    if (href.startsWith("tel:")) {
      trackConversion("click_to_call");
    } else if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(href)) {
      trackConversion("click_whatsapp");
    }
  });
}
