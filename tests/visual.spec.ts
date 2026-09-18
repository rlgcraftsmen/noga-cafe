import { expect, test } from "@playwright/test";
import { navSectionIds } from "./contract";

/**
 * Visual regression snapshots, tagged @visual.
 *
 * Snapshots are platform-specific (filenames carry -win32/-linux/-darwin), so
 * this suite is excluded in CI (which has no committed linux snapshots) via
 * --grep-invert @visual. Run locally; after an intentional visual change:
 *   npx playwright test tests/visual.spec.ts --update-snapshots
 *
 * Motion is disabled via prefers-reduced-motion, which our animation layer
 * fully respects — so every element is in its final, visible state.
 */

// Targets derive from the nav contract; header/hero/footer are conventional
// (a target whose selector is absent on a bespoke page is skipped).
const TARGETS = [
  { name: "header", selector: "body > header" },
  { name: "hero", selector: "#hero" },
  ...navSectionIds.map((id) => ({ name: id, selector: `#${id}` })),
  // Not in the nav, but part of the reference composition — the runtime
  // skip handles bespoke pages without it.
  { name: "cta", selector: "#cta" },
  { name: "footer", selector: "body > footer" },
];

async function preparePage(page: import("@playwright/test").Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  // Sticky header ghosts into element screenshots of tall sections depending
  // on scroll offset (flaky). Make it static for captures — layout-identical.
  await page.addStyleTag({ content: "header { position: static !important }" });
  // Lazy images may never load off-screen — force them eager, then wait for all.
  await page.evaluate(() => {
    for (const img of Array.from(document.images)) {
      img.loading = "eager";
    }
  });
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images)
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise((resolve) => {
              img.addEventListener("load", resolve, { once: true });
              img.addEventListener("error", resolve, { once: true });
            }),
        ),
    ),
  );
}

test.describe("visual regression @visual", () => {
  for (const target of TARGETS) {
    test(`${target.name} looks right (RTL)`, async ({ page }) => {
      await preparePage(page);
      test.skip(
        (await page.locator(target.selector).count()) === 0,
        `no ${target.selector} on this site`,
      );
      await expect(page.locator(target.selector)).toHaveScreenshot(`${target.name}.png`);
    });
  }

  test("LTR flip has no physical-direction leftovers", async ({ page }) => {
    // Runtime dir flip on the same content: catches accidental physical CSS
    // (left/right/ml/mr) that would not mirror. Not a full en-locale build.
    // Raster images are masked: full-page capture re-samples them
    // nondeterministically at high DPR, and they carry no direction info.
    await preparePage(page);
    await page.evaluate(() => {
      document.documentElement.dir = "ltr";
    });
    await expect(page).toHaveScreenshot("full-page-ltr.png", {
      fullPage: true,
      mask: [page.locator("img")],
    });
  });
});
