/**
 * Shared plumbing for the scripts in this folder. Every script needs the
 * same two things — read `.env`, and load+validate business.json — and three
 * hand-copied versions of each is how they silently drift apart (preflight
 * deciding the Web3Forms key is set while deploy decides it isn't).
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type Business, businessSchema } from "../../src/content/business.schema";

export const ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const BUSINESS_JSON_PATH = fileURLToPath(
  new URL("../../src/content/business/business.json", import.meta.url),
);
export const ENV_PATH = fileURLToPath(new URL("../../.env", import.meta.url));

/** Print the message and exit(1). Typed so TS narrows after the call. */
export const fail: (message: string) => never = (message) => {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
};

/**
 * Minimal .env reader — the scripts must not depend on Astro's env loader
 * (they run outside the Astro pipeline, sometimes before a build exists).
 */
export function fromEnvFile(key: string, envPath: string = ENV_PATH): string | undefined {
  if (!existsSync(envPath)) return undefined;
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (match?.[1] === key) {
      return (match[2] ?? "").trim().replace(/^["']|["']$/g, "") || undefined;
    }
  }
  return undefined;
}

/** Shell environment wins over .env — machine-level studio credentials must
 *  override any per-repo copy (see docs/OPERATIONS.md). */
export const env = (key: string): string | undefined => process.env[key] || fromEnvFile(key);

/** Raw business.json with the BOM stripped (a Windows-editor BOM breaks
 *  JSON.parse — see CLAUDE.md). */
export function readBusinessJson(): unknown {
  return JSON.parse(readFileSync(BUSINESS_JSON_PATH, "utf-8").replace(/^﻿/, ""));
}

/** Parsed + schema-validated business.json, or exit with a pointer to the
 *  script that explains the failure properly. */
export function loadBusiness(): Business {
  const parsed = businessSchema.safeParse(readBusinessJson());
  if (!parsed.success) {
    fail("business.json is invalid — run `npm run validate:content` for the full report.");
  }
  return parsed.data;
}
