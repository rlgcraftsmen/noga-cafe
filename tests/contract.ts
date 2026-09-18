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
