/**
 * Generates public/<ogImage> (1200×630) plus the favicon/icon set from
 * business.json — client name, tagline, and brand palette:
 *   npm run generate:og
 *
 * Rendering happens in headless Chromium (via @playwright/test, already a
 * dependency) — NOT librsvg/sharp SVG text: Chromium shapes Hebrew and bidi
 * correctly with any installed system font, auto-shrinks long names, and the
 * output is verified non-blank. sharp only compresses and resizes.
 *
 * The OG image is regenerated on every run (it derives from business.json).
 * favicon.svg + the PNG icon set are written only when MISSING — a real
 * designed logo dropped into public/ survives re-runs (--force overwrites).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { businessSchema } from "../src/content/business.schema";

const force = process.argv.includes("--force");

const root = new URL("..", import.meta.url);
const jsonPath = fileURLToPath(new URL("src/content/business/business.json", root));
const raw: unknown = JSON.parse(readFileSync(jsonPath, "utf-8").replace(/^﻿/, ""));
const business = businessSchema.parse(raw);

const { name, tagline } = business.data;
const { primary, secondary, accent } = business.voice.palette;
const dir = business.locale === "he" ? "rtl" : "ltr";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// A Hebrew-capable stack exists on every desktop OS (Segoe UI on Windows,
// SF/Arial Hebrew on macOS, Noto on Linux) — Chromium picks per-script.
const FONT_STACK = 'system-ui, "Segoe UI", "Noto Sans Hebrew", Arial, sans-serif';

const ogHtml = `<!doctype html>
<html dir="${dir}"><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden; position: relative;
    background: linear-gradient(135deg, ${secondary}, ${primary});
    font-family: ${FONT_STACK}; color: #ffffff;
    display: flex; align-items: center; justify-content: center;
  }
  .glow-a { position: absolute; top: -100px; inset-inline-end: -70px; width: 440px; height: 440px;
    border-radius: 50%; background: #ffffff; opacity: 0.06; }
  .glow-b { position: absolute; bottom: -210px; inset-inline-start: -160px; width: 560px; height: 560px;
    border-radius: 50%; background: #000000; opacity: 0.10; }
  .wrap { max-width: 1020px; padding: 0 60px; text-align: center; position: relative; }
  h1 { font-size: 88px; font-weight: 700; line-height: 1.15; text-wrap: balance; }
  .rule { width: 80px; height: 6px; border-radius: 3px; background: ${accent}; margin: 30px auto; }
  p { font-size: 40px; line-height: 1.4; opacity: 0.88; }
</style></head><body>
  <div class="glow-a"></div><div class="glow-b"></div>
  <div class="wrap">
    <h1 id="name">${escapeHtml(name)}</h1>
    <div class="rule"></div>
    <p>${escapeHtml(tagline)}</p>
  </div>
</body></html>`;

const iconHtml = (initial: string): string => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; }
  body { width: 512px; height: 512px; background: transparent; }
  .tile {
    width: 512px; height: 512px; border-radius: 112px;
    background: linear-gradient(135deg, ${secondary}, ${primary});
    font-family: ${FONT_STACK}; color: #ffffff;
    display: flex; align-items: center; justify-content: center;
    font-size: 272px; font-weight: 700;
  }
</style></head><body><div class="tile">${escapeHtml(initial)}</div></body></html>`;

async function assertNotBlank(buffer: Buffer, label: string): Promise<void> {
  const stats = await sharp(buffer).stats();
  const maxStdev = Math.max(...stats.channels.map((c) => c.stdev));
  if (maxStdev < 2) {
    throw new Error(`${label} rendered blank/uniform — check the palette and system fonts.`);
  }
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });

  // ── OG image (always regenerated — it derives from business.json) ─────────
  await page.setContent(ogHtml, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    // Long business names shrink until the block fits two comfortable lines.
    const h1 = document.getElementById("name");
    if (!h1) return;
    let size = 88;
    while (size > 40 && h1.getBoundingClientRect().height > 230) {
      size -= 4;
      h1.style.fontSize = `${size}px`;
    }
  });
  const ogBuffer = await page.screenshot({ type: "png" });
  await assertNotBlank(ogBuffer, "OG image");
  const ogTarget = fileURLToPath(new URL(`public/${business.data.seo.ogImage}`, root));
  await sharp(ogBuffer).png({ compressionLevel: 9 }).toFile(ogTarget);
  console.log(`✓ ${business.data.seo.ogImage} generated (1200×630) for "${name}"`);

  // ── Favicon + icon set (never overwrite a real logo without --force) ──────
  // First actual letter — skips brackets/digits in placeholder names.
  const initial = [...name].find((ch) => /\p{L}/u.test(ch)) ?? "•";

  const faviconPath = fileURLToPath(new URL("public/favicon.svg", root));
  if (force || !existsSync(faviconPath)) {
    // The SVG favicon renders with the VISITOR's fonts — browsers shape a
    // single letter fine; no rasterization involved.
    const favicon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
  <title>${escapeHtml(name)}</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${secondary}"/>
      <stop offset="1" stop-color="${primary}"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#bg)"/>
  <text x="32" y="44" text-anchor="middle" font-family="${FONT_STACK.replaceAll('"', "'")}"
    font-size="34" font-weight="700" fill="#ffffff">${escapeHtml(initial)}</text>
</svg>`;
    writeFileSync(faviconPath, favicon);
    console.log(`✓ favicon.svg generated ("${initial}")`);
  } else {
    console.log(
      "↷ favicon.svg exists — skipped (a real logo is never overwritten; --force regenerates)",
    );
  }

  const iconSpecs = [
    { file: "apple-touch-icon.png", size: 180 },
    { file: "icon-192.png", size: 192 },
    { file: "icon-512.png", size: 512 },
  ];
  const missing = iconSpecs.filter(
    ({ file }) => force || !existsSync(fileURLToPath(new URL(`public/${file}`, root))),
  );
  if (missing.length > 0) {
    await page.setViewportSize({ width: 512, height: 512 });
    await page.setContent(iconHtml(initial), { waitUntil: "networkidle" });
    const tileBuffer = await page.screenshot({ type: "png", omitBackground: true });
    await assertNotBlank(tileBuffer, "icon tile");
    for (const { file, size } of missing) {
      await sharp(tileBuffer)
        .resize(size, size)
        .png({ compressionLevel: 9 })
        .toFile(fileURLToPath(new URL(`public/${file}`, root)));
      console.log(`✓ ${file} generated (${size}×${size})`);
    }
  }
  for (const { file } of iconSpecs) {
    if (!missing.some((m) => m.file === file)) {
      console.log(`↷ ${file} exists — skipped (--force regenerates)`);
    }
  }
} finally {
  await browser.close();
}
