import type { Business } from "@/content/business.schema";
import { dialablePhone, whatsappHref } from "./business";

/**
 * JSON-LD generators. All structured data derives from business.json.
 * Validate output at https://validator.schema.org after content changes.
 *
 * One entity, one node: the business is a single LocalBusiness (an
 * Organization subtype), referenced by WebSite.publisher — not two
 * disconnected LocalBusiness + Organization nodes describing the same thing.
 */

type JsonLd = Record<string, unknown>;

function absoluteUrl(siteUrl: string, path: string): string {
  return new URL(path, `${siteUrl}/`).href;
}

/** Closed days/dates use the Google-documented "00:00"–"00:00" convention. */
function hoursSpec(
  ranges: Array<{ open: string; close: string }>,
  extra: Record<string, unknown>,
): JsonLd[] {
  if (ranges.length === 0) {
    return [{ "@type": "OpeningHoursSpecification", ...extra, opens: "00:00", closes: "00:00" }];
  }
  return ranges.map((r) => ({
    "@type": "OpeningHoursSpecification",
    ...extra,
    opens: r.open,
    closes: r.close,
  }));
}

export function localBusinessJsonLd(business: Business): JsonLd {
  const { data } = business;
  const { local } = data;
  const sameAs = [
    data.socials.instagram,
    data.socials.facebook,
    data.socials.tiktok,
    local.googleBusinessProfile,
  ].filter((url) => url !== "");
  const logo = data.seo.logo
    ? absoluteUrl(data.seo.siteUrl, data.seo.logo)
    : absoluteUrl(data.seo.siteUrl, data.seo.ogImage);
  const hasAddress = data.contact.address !== undefined || data.contact.city !== undefined;

  return {
    "@context": "https://schema.org",
    "@type": data.schemaType,
    "@id": `${data.seo.siteUrl}/#business`,
    name: data.name,
    legalName: data.legalName,
    taxID: data.companyId,
    description: data.seo.defaultDescription,
    url: data.seo.siteUrl,
    image: absoluteUrl(data.seo.siteUrl, data.seo.ogImage),
    logo,
    telephone: dialablePhone(data.contact.phone),
    email: data.contact.email,
    // Service-area businesses have no storefront — Google policy forbids
    // inventing one, so the address block is simply omitted (areaServed +
    // geo still localize the business).
    address: hasAddress
      ? {
          "@type": "PostalAddress",
          streetAddress: data.contact.address,
          addressLocality: data.contact.city,
          // The template is Israel-only by design (dialablePhone assumes +972,
          // the legal content is scoped to ת"י 5568) — an English-locale build
          // is still the same Israeli business, so this is never
          // locale-conditional.
          addressCountry: "IL",
        }
      : undefined,
    geo: {
      "@type": "GeoCoordinates",
      latitude: data.contact.geo.lat,
      longitude: data.contact.geo.lng,
    },
    hasMap: local.googleBusinessProfile !== "" ? local.googleBusinessProfile : undefined,
    openingHoursSpecification: data.hours.flatMap((h) =>
      hoursSpec(h.ranges, { dayOfWeek: `https://schema.org/${h.day}` }),
    ),
    specialOpeningHoursSpecification:
      data.specialHours.length > 0
        ? data.specialHours.flatMap((s) =>
            hoursSpec(s.ranges, { validFrom: s.date, validThrough: s.date }),
          )
        : undefined,
    areaServed: data.serviceAreas.map((name) => ({ "@type": "City", name })),
    priceRange: data.priceRange !== "" ? data.priceRange : undefined,
    aggregateRating: data.reviews
      ? {
          "@type": "AggregateRating",
          ratingValue: data.reviews.ratingValue,
          reviewCount: data.reviews.reviewCount,
        }
      : undefined,
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: data.name,
      itemListElement: data.services.map((service) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: service.title,
          description: service.description,
        },
      })),
    },
    sameAs: sameAs.length > 0 ? sameAs : undefined,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: dialablePhone(data.contact.phone),
      // undefined keys drop out at JSON.stringify time (same as email above).
      url: data.contact.whatsapp ? whatsappHref(data.contact.whatsapp) : undefined,
    },
  };
}

export function websiteJsonLd(business: Business): JsonLd {
  const { data } = business;
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${data.seo.siteUrl}/#website`,
    name: data.name,
    url: data.seo.siteUrl,
    inLanguage: business.locale,
    publisher: { "@id": `${data.seo.siteUrl}/#business` },
  };
}

/** BreadcrumbList for subpages (service/city landing pages) — pass the trail
 *  from the homepage down, e.g. [{name, path: "/"}, {name, path: "/plumbing/"}]. */
export function breadcrumbJsonLd(
  business: Business,
  items: Array<{ name: string; path: string }>,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(business.data.seo.siteUrl, item.path),
    })),
  };
}

export function faqJsonLd(business: Business): JsonLd | null {
  if (!business.content.faq || business.content.faq.items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: business.content.faq.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
