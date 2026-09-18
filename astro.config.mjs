// @ts-check
import { readFileSync } from "node:fs";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField, fontProviders } from "astro/config";

// business.json is the single source of truth — even the deploy URL comes from it.
// BOM strip: this file reads the JSON before Zod can produce a friendly error,
// so a Windows-editor BOM must not crash the config load with a raw parse error.
const business = JSON.parse(
  readFileSync(new URL("./src/content/business/business.json", import.meta.url), "utf-8").replace(
    /^﻿/,
    "",
  ),
);

// design.fontPairing → actual families (all vetted for Hebrew + Latin subsets).
// Registered under fixed cssVariables so components/CSS never change per client.
// Personalities: classic (default, warm neutral) · modern (geometric, confident) ·
// elegant (literary serif display) · warm (soft humanist) · bold (condensed impact) ·
// editorial (serif-forward, magazine) · playful (rounded, friendly) ·
// rounded (soft geometric, single-weight display) · impact (humanist display, single-weight) ·
// poster (contemporary serif display, single-weight) · refined (Hebrew/Latin serif-sans pairing) ·
// techsans (engineering/technical, monolithic display+body) · serifnote (literary serif display,
// wide weight range) · retro (understated serif display, single-weight) ·
// handmade (handwritten display — display-only, short headings only, never body text).
// Single-weight display fonts (rounded/impact/poster/retro) set displayWeights: [400].
const FONT_PAIRINGS = {
  classic: { display: "Assistant", body: "Heebo" },
  modern: { display: "Rubik", body: "Assistant" },
  elegant: { display: "Frank Ruhl Libre", body: "Heebo" },
  warm: { display: "Alef", body: "Rubik" },
  bold: { display: "Karantina", body: "Heebo" },
  editorial: { display: "David Libre", body: "Assistant" },
  playful: { display: "Fredoka", body: "Rubik" },
  rounded: { display: "Varela Round", displayWeights: [400], body: "Assistant" },
  impact: { display: "Secular One", displayWeights: [400], body: "Heebo" },
  poster: { display: "Suez One", displayWeights: [400], body: "Assistant" },
  refined: { display: "Miriam Libre", body: "Heebo" },
  techsans: { display: "IBM Plex Sans Hebrew", body: "IBM Plex Sans Hebrew" },
  serifnote: { display: "Noto Serif Hebrew", body: "Heebo" },
  retro: { display: "Bellefair", displayWeights: [400], body: "Frank Ruhl Libre" },
  handmade: { display: "Amatic SC", body: "Assistant" },
};
const pairingKey = business.design?.fontPairing ?? "classic";
const pairing = FONT_PAIRINGS[pairingKey] ?? FONT_PAIRINGS.classic;
if (!FONT_PAIRINGS[pairingKey]) {
  // The schema enum still fails the build later with a proper message; this
  // guard only prevents an opaque `undefined.display` crash before it runs.
  console.warn(`Unknown design.fontPairing "${pairingKey}" — falling back to "classic".`);
}

export default defineConfig({
  site: business.data.seo.siteUrl,
  output: "static",
  // The 404 page must never appear in the sitemap (it also carries noindex).
  integrations: [sitemap({ filter: (page) => !page.includes("/404") })],
  vite: {
    plugins: [tailwindcss()],
  },
  env: {
    schema: {
      PUBLIC_WEB3FORMS_KEY: envField.string({
        context: "client",
        access: "public",
        optional: true,
        default: "",
      }),
    },
  },
  fonts: [
    {
      // Downloaded at build time and served from this origin (self-hosted).
      provider: fontProviders.google(),
      name: pairing.display,
      cssVariable: "--font-brand-display",
      weights: pairing.displayWeights ?? [400, 700],
      styles: ["normal"],
      subsets: ["hebrew", "latin"],
      display: "swap",
      fallbacks: ["Arial", "sans-serif"],
    },
    {
      provider: fontProviders.google(),
      name: pairing.body,
      cssVariable: "--font-brand-body",
      weights: pairing.bodyWeights ?? [400, 500, 700],
      styles: ["normal"],
      subsets: ["hebrew", "latin"],
      display: "swap",
      fallbacks: ["Arial", "sans-serif"],
    },
  ],
});
