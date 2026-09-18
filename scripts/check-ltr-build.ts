/**
 * Structural check for the LTR/English path: temporarily builds the site with
 * locale "en" and asserts the output flips lang/dir correctly, then restores
 * business.json. Run with: npm run test:ltr-build (also runs in CI).
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const jsonPath = fileURLToPath(new URL("../src/content/business/business.json", import.meta.url));
const distIndex = fileURLToPath(new URL("../dist/index.html", import.meta.url));

const original = readFileSync(jsonPath, "utf-8");

// process.exit() does not unwind the stack, so it would skip the finally
// block below and leave business.json patched to locale:"en" on disk. Track
// failure in a flag instead and exit only after the finally has run.
let failed = false;
try {
  const patched = JSON.parse(original.replace(/^﻿/, "")) as { locale: string };
  patched.locale = "en";
  writeFileSync(jsonPath, JSON.stringify(patched, null, 2));

  execSync("npx astro build", { stdio: "inherit" });

  const html = readFileSync(distIndex, "utf-8");
  const checks: Array<[string, boolean]> = [
    ['lang="en"', html.includes('lang="en"')],
    ['dir="ltr"', html.includes('dir="ltr"')],
    ["no dir=rtl leftover", !html.includes('dir="rtl"')],
    ["og:locale en_US", html.includes('content="en_US"')],
  ];
  failed = checks.some(([, ok]) => !ok);
  for (const [label, ok] of checks) {
    console.log(`${ok ? "✓" : "✗"} ${label}`);
  }
  if (!failed) {
    console.log("✓ LTR/English build is structurally correct");
  }
} finally {
  writeFileSync(jsonPath, original);
  // Rebuild so dist/ matches the real locale again (cheap, keeps local state sane).
  try {
    execSync("npx astro build", { stdio: "inherit" });
  } catch {
    console.error(
      "\n✗ Failed to rebuild dist/ after restoring business.json to its original contents. " +
        "business.json on disk is safe (already restored), but dist/ may still reflect the " +
        'locale:"en" variant — run `npm run build` manually.\n',
    );
    process.exit(1);
  }
}
if (failed) process.exit(1);
