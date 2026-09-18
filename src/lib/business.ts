import { getEntry } from "astro:content";
import type { Business } from "@/content/business.schema";

/**
 * Canonical accessor for the business entry. Use this in every component —
 * never import business.json directly.
 */
export async function getBusiness(): Promise<Business> {
  const entry = await getEntry("business", "site");
  if (!entry) {
    throw new Error("business.json entry not found — check src/content/business/business.json");
  }
  return entry.data;
}

/** "he" → dir="rtl"; anything else → "ltr". */
export function getDir(locale: Business["locale"]): "rtl" | "ltr" {
  return locale === "he" ? "rtl" : "ltr";
}

/** ISO "2026-07-22" → reader-facing date ("22.07.2026" for Hebrew sites,
 *  "22/07/2026" for English) — raw ISO reads as machine output. */
export function formatDate(locale: Business["locale"], iso: string): string {
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/**
 * Canonical dialable form of a display phone string (also used verbatim as
 * the JSON-LD `telephone` value):
 *   "050-123-4567" → "+972501234567"   (Israeli local — leading 0 → +972)
 *   "972501234567" → "+972501234567"   (already international)
 *   "*3455"        → "*3455"           (star codes have no E.164 form but are
 *                                       dialable as-is on Israeli networks)
 */
export function dialablePhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("*")) return trimmed.replace(/[^\d*]/g, "");
  const digits = trimmed.replace(/\D/g, "");
  return digits.startsWith("0") ? `+972${digits.slice(1)}` : `+${digits}`;
}

/** "050-123-4567" → "tel:+972501234567"; "*3455" → "tel:*3455". */
export function telHref(phone: string): string {
  return `tel:${dialablePhone(phone)}`;
}

/** wa.me link from the digits-only whatsapp field. */
export function whatsappHref(whatsapp: string): string {
  return `https://wa.me/${whatsapp}`;
}

/**
 * Section links in business.json may use the sentinel "whatsapp" instead of a
 * URL — resolve it here so the number lives in exactly one place. When
 * data.contact.whatsapp is absent the sentinel degrades to the tel: link, so
 * a phone-only business never ships a broken wa.me URL.
 */
export function resolveHref(href: string, business: Business): string {
  if (href !== "whatsapp") return href;
  const { whatsapp, phone } = business.data.contact;
  return whatsapp ? whatsappHref(whatsapp) : telHref(phone);
}
