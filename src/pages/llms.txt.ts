import type { APIRoute } from "astro";
import { dialablePhone, getBusiness, whatsappHref } from "@/lib/business";

/**
 * llms.txt — emerging convention that gives AI answer engines a clean,
 * markdown summary of the site (https://llmstxt.org). Generated entirely
 * from business.json, so every client ships an accurate one for free.
 */
export const GET: APIRoute = async ({ site }) => {
  const business = await getBusiness();
  const { data, content } = business;
  const faqItems = content.faq?.items ?? [];

  const lines = [
    `# ${data.name}`,
    "",
    `> ${data.seo.defaultDescription}`,
    "",
    `- Website: ${site?.href ?? data.seo.siteUrl}`,
    ...(data.contact.address ? [`- Address: ${data.contact.address}`] : []),
    `- Phone: ${dialablePhone(data.contact.phone)}`,
    ...(data.contact.whatsapp ? [`- WhatsApp: ${whatsappHref(data.contact.whatsapp)}`] : []),
    ...(data.contact.email ? [`- Email: ${data.contact.email}`] : []),
    ...(data.local.googleBusinessProfile
      ? [`- Google Business Profile: ${data.local.googleBusinessProfile}`]
      : []),
    ...(data.local.wazeUrl ? [`- Waze: ${data.local.wazeUrl}`] : []),
    `- Service areas: ${data.serviceAreas.join(", ")}`,
    "",
    "## Opening hours",
    "",
    ...data.hours.map(
      (h) =>
        `- ${h.day}: ${
          h.ranges.length === 0 ? "Closed" : h.ranges.map((r) => `${r.open}–${r.close}`).join(", ")
        }`,
    ),
    "",
    "## Services",
    "",
    ...data.services.map((s) => `- ${s.title}${s.price ? ` (${s.price})` : ""}: ${s.description}`),
    ...(faqItems.length > 0
      ? [
          "",
          "## Frequently asked questions",
          "",
          ...faqItems.flatMap((item) => [`### ${item.question}`, "", item.answer, ""]),
        ]
      : []),
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
