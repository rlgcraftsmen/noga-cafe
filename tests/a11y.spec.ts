import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// The statement claims WCAG 2.2 AA (ת"י 5568) — scan with the 2.2 tags too.
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

function violationSummary(results: Awaited<ReturnType<AxeBuilder["analyze"]>>) {
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => n.target),
  }));
}

test.describe("accessibility", () => {
  for (const path of [
    "/",
    "/accessibility-statement/",
    "/privacy/",
    "/this-page-does-not-exist/",
  ]) {
    test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
      await page.goto(path);
      // Let scroll-reveal animations settle so axe sees final opacity values.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1500);

      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();

      expect(violationSummary(results)).toEqual([]);
    });
  }

  test("open mobile drawer has no WCAG A/AA violations", async ({ page }) => {
    // The drawer is the component every shipped site has had a defect in —
    // scan its OPEN state (focus order, names, contrast), not just the page.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const toggle = page.locator("#menu-toggle");
    test.skip((await toggle.count()) === 0, "site has no #menu-toggle");
    test.skip(!(await toggle.isVisible()), "menu toggle not shown at mobile width");

    await toggle.click();
    await expect(page.locator("#mobile-menu")).toBeVisible();
    await page.waitForTimeout(400); // let the entrance animation finish

    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violationSummary(results)).toEqual([]);
  });
});
