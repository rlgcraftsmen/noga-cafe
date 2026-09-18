import { defineCollection } from "astro:content";
import { file } from "astro/loaders";
import { businessSchema } from "./content/business.schema";

/**
 * Single-entry data collection. The entire site reads from
 * `getEntry("business", "site")` — see src/lib/business.ts.
 * An invalid business.json fails the build here.
 */
const business = defineCollection({
  loader: file("src/content/business/business.json", {
    parser: (text) => [{ id: "site", ...JSON.parse(text.replace(/^\uFEFF/, "")) }],
  }),
  schema: businessSchema,
});

export const collections = { business };
