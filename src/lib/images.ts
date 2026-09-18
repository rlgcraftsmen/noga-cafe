import type { ImageMetadata } from "astro";

/**
 * business.json references images by filename (e.g. "hero.svg"); the files
 * live in src/assets/images/ so Astro can optimize them. This resolver is the
 * one canonical bridge between the two.
 */
const images = import.meta.glob<{ default: ImageMetadata }>(
  "/src/assets/images/*.{svg,png,jpg,jpeg,webp,avif}",
  { eager: true },
);

export function resolveImage(src: string): ImageMetadata {
  const image = images[`/src/assets/images/${src}`];
  if (!image) {
    const available = Object.keys(images)
      .map((path) => path.replace("/src/assets/images/", ""))
      .join(", ");
    throw new Error(`Image "${src}" not found in src/assets/images/. Available: ${available}`);
  }
  return image.default;
}
