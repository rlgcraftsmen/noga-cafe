import { expect, test } from "@playwright/test";

/**
 * Regression: drawer links must survive a HELD press.
 *
 * The drawer used to close on `pointerdown`, which starts its exit transition
 * while the finger is still down — the link slides out from under the pointer
 * and the browser never fires `click`. A 0ms tap navigated; 120ms+ did
 * nothing. Every existing suite tapped instantly, so the site was broken for
 * every human being and green for every test (docs/TRAPS.md 14).
 *
 * This spec presses and HOLDS, which is the only way to catch it.
 */

const HOLD_MS = [120, 250, 400];

test.describe("mobile drawer — held press", () => {
  for (const hold of HOLD_MS) {
    test(`a ${hold}ms press on a drawer link still navigates`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/");

      const toggle = page.locator("#menu-toggle");
      test.skip((await toggle.count()) === 0, "site has no #menu-toggle");
      test.skip(!(await toggle.isVisible()), "menu toggle not shown at mobile width");

      // First in-page link in the drawer — whatever this client's nav is.
      const link = page.locator('#mobile-menu a[href^="#"]').first();
      await toggle.click();
      await expect(page.locator("#mobile-menu")).toBeVisible();
      await page.waitForTimeout(500);

      const target = await link.getAttribute("href");
      test.skip(!target || target === "#", "no in-page drawer link to test");
      const box = await link.boundingBox();
      test.skip(box === null, "drawer link has no box");
      if (box === null) return;

      const before = await page.evaluate(() => window.scrollY);

      // Press and hold, like a person — not tap(), which takes ~1ms.
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(hold);
      await page.mouse.up();
      await page.waitForTimeout(1500);

      const after = await page.evaluate(() => window.scrollY);
      const section = page.locator(`section${target}`);
      const needsToMove =
        (await section.count()) > 0 &&
        (await section.evaluate((el) => el.getBoundingClientRect().top + window.scrollY > 200));

      if (needsToMove) {
        expect(
          after,
          `a ${hold}ms press must navigate — a drawer that closes on pointerdown eats its own clicks`,
        ).toBeGreaterThan(before + 50);
      }

      // And the drawer must still close, and release the scroll lock.
      await expect(page.locator("#mobile-menu")).toBeHidden();
      expect(await page.evaluate(() => document.body.classList.contains("is-locked"))).toBe(false);
    });
  }
});
