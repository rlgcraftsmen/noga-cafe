import { expect, test } from "@playwright/test";
import business from "../src/content/business/business.json" with { type: "json" };

/**
 * Consent withdrawal contract.
 *
 * Consent must be withdrawable: a visitor who accepted cookies has to be able
 * to come back and decline. That path runs through the privacy page's
 * [data-consent-reopen] control, and it is easy to ship a banner that
 * re-appears with dead buttons (the accept/decline listeners only bound on
 * the first-visit branch). These tests pin the behaviour.
 *
 * The template skeleton configures no cookie trackers, so the banner does not
 * render there and these tests skip. They run for real client sites — which
 * is exactly where the legal requirement applies.
 */
const hasTracking =
  business.data.analytics.gtagId !== "" || business.data.analytics.metaPixelId !== "";

test.describe("cookie consent", () => {
  test.skip(!hasTracking, "no cookie trackers configured — the banner does not render");

  test("a stored choice can be withdrawn from the privacy page", async ({ page }) => {
    await page.goto("/");
    const banner = page.locator("#consent-banner");
    await expect(banner).toBeVisible();

    // Accept, then confirm the choice persisted and the banner is gone.
    await banner.locator("[data-consent-accept]").click();
    await expect(banner).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem("cookie-consent"))).toBe("granted");

    // Withdraw via the privacy page.
    await page.goto("/privacy/");
    await page.locator("[data-consent-reopen]").click();
    const reopened = page.locator("#consent-banner");
    await expect(reopened).toBeVisible();

    // The decline button must actually work on the REOPENED banner.
    await reopened.locator("[data-consent-decline]").click();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("cookie-consent")))
      .toBe("denied");
  });

  test("declining keeps trackers out of the document", async ({ page }) => {
    await page.goto("/");
    await page.locator("#consent-banner [data-consent-decline]").click();
    await expect(page.locator("#consent-banner")).toBeHidden();
    const trackerScripts = await page.evaluate(
      () =>
        [...document.querySelectorAll("script[src]")].filter((s) =>
          /googletagmanager|connect\.facebook\.net/.test((s as HTMLScriptElement).src),
        ).length,
    );
    expect(trackerScripts, "no tracking script may load after declining").toBe(0);
  });
});
