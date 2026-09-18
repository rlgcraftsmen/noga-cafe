import type { APIRoute } from "astro";
import { getBusiness, getDir } from "@/lib/business";

export const GET: APIRoute = async () => {
  const business = await getBusiness();
  const manifest = {
    name: business.data.name,
    short_name: business.data.name,
    description: business.data.seo.defaultDescription,
    lang: business.locale,
    dir: getDir(business.locale),
    start_url: "/",
    display: "browser",
    theme_color: business.voice.palette.primary,
    background_color: business.voice.palette.surface,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
  });
};
