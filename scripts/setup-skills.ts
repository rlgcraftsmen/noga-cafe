/**
 * Install the studio's required agent-skill set (one command, idempotent).
 *
 *   npm run setup:skills             # install whatever is missing
 *   npm run setup:skills -- --force  # reinstall everything (picks up upstream updates)
 *
 * These skills are part of the template's build workflow — the /new-client and
 * design-review skills invoke them by name — so every developer machine that
 * builds client sites needs them. They install GLOBALLY (user scope, via the
 * skills.sh CLI), matching how agent skills are shared across client repos;
 * nothing is vendored into this repo.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** owner/repo@skill — the skill name after "@" is also its install directory name. */
const REQUIRED_SKILLS = [
  // Web quality (Addy Osmani)
  "addyosmani/web-quality-skills@accessibility",
  "addyosmani/web-quality-skills@core-web-vitals",
  "addyosmani/web-quality-skills@seo",
  // Design + animation
  "vercel-labs/agent-skills@web-design-guidelines",
  "greensock/gsap-skills@gsap-core",
  // Marketing / conversion
  "coreyhaines31/marketingskills@seo-audit",
  "coreyhaines31/marketingskills@cro",
  "kostja94/marketing-skills@local-seo",
  // Hebrew / Israeli market
  "skills-il/localization@hebrew-rtl-best-practices",
  "skills-il/localization@hebrew-content-writer",
  "skills-il/localization@israeli-accessibility-compliance",
] as const;

const force = process.argv.includes("--force");
const skillsDir = join(homedir(), ".agents", "skills");

let installed = 0;
let skipped = 0;
const failed: string[] = [];

for (const spec of REQUIRED_SKILLS) {
  const name = spec.split("@")[1] ?? spec;
  if (!force && existsSync(join(skillsDir, name))) {
    skipped++;
    continue;
  }
  console.log(`→ installing ${spec}`);
  try {
    // CLI version pinned — an unpinned `npx skills` would run whatever was
    // published last, on every developer machine, auto-confirmed.
    execSync(`npx -y skills@1.5.22 add ${spec} -g -y`, { stdio: "inherit" });
    installed++;
  } catch {
    failed.push(spec);
  }
}

console.log(
  `\nSkills: ${installed} installed, ${skipped} already present` +
    (failed.length > 0 ? `, ${failed.length} FAILED` : ""),
);
if (failed.length > 0) {
  console.error(`\n✗ failed to install:\n  ${failed.join("\n  ")}\n`);
  console.error("Retry: npm run setup:skills (needs network access to github.com)");
  process.exit(1);
}
console.log("Restart any running Claude Code session to pick up new skills.");
