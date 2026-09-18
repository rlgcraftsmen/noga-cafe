/**
 * Google Search Console setup for a deployed production site (meta-tag method).
 *
 *   npm run gsc:setup            # ensure meta tag → verify → add property → submit sitemap
 *   npm run gsc:setup -- --auth  # one-time: mint the Google OAuth refresh token (browser flow)
 *   npm run gsc:setup -- --dry-run
 *
 * Requires in .env (or shell env):
 *   GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET  — a "Desktop app" OAuth
 *     client from any Google Cloud project with the Search Console API and the
 *     Site Verification API enabled (one client serves every client site).
 *   GOOGLE_OAUTH_REFRESH_TOKEN — minted once per Google account via --auth.
 *
 * Verification is the google-site-verification META TAG: the script fetches the
 * token from Google, writes it into `data.seo.googleSiteVerification` in
 * business.json (BaseLayout renders the tag), and on the next run — after the
 * operator rebuilds and deploys — confirms the tag is live, verifies ownership,
 * adds the URL-prefix property, and submits the sitemap. Idempotent throughout.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { env, fail, BUSINESS_JSON_PATH as jsonPath, loadBusiness } from "./lib/content";

const args = process.argv.slice(2);
const hasFlag = (name: string) => args.includes(`--${name}`);
const dryRun = hasFlag("dry-run");

const requireEnv = (key: string): string =>
  env(key) ?? fail(`${key} is missing — see the header of scripts/setup-gsc.ts`);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

async function api(
  url: string,
  init: RequestInit,
  what: string,
  okStatuses: readonly number[] = [200],
): Promise<Record<string, unknown>> {
  const res = await fetch(url, init);
  const body: unknown = await res.json().catch(() => ({}));
  if (!okStatuses.includes(res.status)) {
    fail(`${what} failed (HTTP ${res.status}): ${JSON.stringify(body).slice(0, 400)}`);
  }
  return isRecord(body) ? body : {};
}

// ---------------------------------------------------------------- OAuth

const OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/siteverification",
  "https://www.googleapis.com/auth/webmasters",
].join(" ");

/** --auth: loopback flow. Prints the refresh token to put in .env. */
async function mintRefreshToken(clientId: string, clientSecret: string): Promise<never> {
  const port = 53682;
  const redirect = `http://127.0.0.1:${port}/`;
  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth" +
    `?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirect)}` +
    `&response_type=code&access_type=offline&prompt=consent&scope=${encodeURIComponent(OAUTH_SCOPES)}`;

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const got = new URL(req.url ?? "/", redirect).searchParams.get("code");
      res.end("Search Console auth captured — you can close this tab.");
      if (got) {
        server.close();
        resolve(got);
      }
    });
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => {
      console.log("\nOpen this URL in a browser logged into the STUDIO's Google account:\n");
      console.log(`${authUrl}\n`);
    });
  });

  const token = await api(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirect,
        grant_type: "authorization_code",
      }),
    },
    "OAuth code exchange",
  );
  const refresh = token.refresh_token;
  if (typeof refresh !== "string") fail("Google returned no refresh_token — retry --auth.");
  console.log("Add this line to .env (never commit it):\n");
  console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${refresh}\n`);
  process.exit(0);
}

async function accessToken(
  clientId: string,
  clientSecret: string,
  refresh: string,
): Promise<string> {
  const token = await api(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refresh,
        grant_type: "refresh_token",
      }),
    },
    "OAuth token refresh",
  );
  const access = token.access_token;
  if (typeof access !== "string") fail("token refresh returned no access_token");
  return access;
}

// ---------------------------------------------------------------- Steps

/** Ask Google for the META verification token; the API may wrap it in the full tag. */
async function fetchMetaToken(google: Record<string, string>, property: string): Promise<string> {
  const body = await api(
    "https://www.googleapis.com/siteVerification/v1/token",
    {
      method: "POST",
      headers: google,
      body: JSON.stringify({
        site: { type: "SITE", identifier: property },
        verificationMethod: "META",
      }),
    },
    "site-verification token request",
  );
  const raw = body.token;
  if (typeof raw !== "string") fail("Google returned no verification token");
  return /content="([^"]+)"/.exec(raw)?.[1] ?? raw;
}

/** Persist the token into business.json (UTF-8, no BOM — a BOM breaks the build). */
function writeTokenToBusinessJson(token: string): void {
  const parsed: unknown = JSON.parse(readFileSync(jsonPath, "utf-8").replace(/^﻿/, ""));
  if (!isRecord(parsed) || !isRecord(parsed.data) || !isRecord(parsed.data.seo)) {
    fail("business.json has no data.seo object");
  }
  parsed.data.seo.googleSiteVerification = token;
  writeFileSync(jsonPath, `${JSON.stringify(parsed, null, 2)}\n`, { encoding: "utf-8" });
}

async function main(): Promise<void> {
  const clientId = requireEnv("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_OAUTH_CLIENT_SECRET");
  if (hasFlag("auth")) await mintRefreshToken(clientId, clientSecret);

  const seo = loadBusiness().data.seo;
  const siteUrl = new URL(seo.siteUrl);
  if (siteUrl.hostname.replace(/^www\./, "") === "example.com") {
    fail("data.seo.siteUrl is still the placeholder — set the real domain first.");
  }
  /** URL-prefix property, e.g. "https://example.co.il/" — trailing slash required. */
  const property = new URL("/", siteUrl).href;

  const access = await accessToken(
    clientId,
    clientSecret,
    requireEnv("GOOGLE_OAUTH_REFRESH_TOKEN"),
  );
  const google = { authorization: `Bearer ${access}`, "content-type": "application/json" };
  console.log(`Search Console setup for ${property} (meta-tag verification)`);

  const token = await fetchMetaToken(google, property);

  // Phase 1 — the token must be in business.json (BaseLayout renders the tag).
  if (seo.googleSiteVerification !== token) {
    if (dryRun) {
      console.log(`[dry-run] would write data.seo.googleSiteVerification = ${token}`);
      process.exit(0);
    }
    writeTokenToBusinessJson(token);
    console.log("✓ token written to data.seo.googleSiteVerification in business.json");
    console.log(
      "\nNow ship it, then run this command again to finish verification:\n" +
        "  npm run validate:content   (sanity)\n" +
        "  git add/commit             (the token is not a secret)\n" +
        "  npm run deploy\n" +
        "  npm run gsc:setup\n",
    );
    process.exit(0);
  }

  // Phase 2 — token already in business.json: confirm it is LIVE before asking Google.
  const liveHtml = await fetch(property).then(
    (r) =>
      r.ok
        ? r.text()
        : fail(`could not fetch ${property} (HTTP ${r.status}) — is the site deployed?`),
    () => fail(`could not reach ${property} — is the site deployed?`),
  );
  if (!liveHtml.includes(`content="${token}"`)) {
    fail(
      `the live page at ${property} does not carry the verification meta tag yet —\n` +
        "  run `npm run deploy` (production) and try again.",
    );
  }
  console.log("✓ verification meta tag is live");
  if (dryRun) {
    console.log("[dry-run] would verify ownership, add the property, submit the sitemap");
    process.exit(0);
  }

  // Google fetches the page itself — quick retry loop for CDN propagation.
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(
      "https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=META",
      {
        method: "POST",
        headers: google,
        body: JSON.stringify({ site: { type: "SITE", identifier: property } }),
      },
    );
    if (res.ok) {
      console.log("✓ ownership verified with Google");
      break;
    }
    if (attempt >= 6) {
      const body = await res.text();
      fail(`verification did not succeed after ${attempt} attempts: ${body.slice(0, 300)}`);
    }
    console.log(`… Google can't see the tag yet (attempt ${attempt}/6), retrying in 15s`);
    await new Promise((r) => setTimeout(r, 15_000));
  }

  await api(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}`,
    { method: "PUT", headers: google },
    "Search Console property creation",
    [200, 204],
  );
  console.log("✓ property added to Search Console");

  const sitemap = new URL("/sitemap-index.xml", siteUrl).href;
  await api(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/sitemaps/${encodeURIComponent(sitemap)}`,
    { method: "PUT", headers: google },
    "sitemap submission",
    [200, 204],
  );
  console.log(`✓ sitemap submitted: ${sitemap}`);
  console.log("\nDone. Indexing coverage appears in Search Console within a few days.");
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
