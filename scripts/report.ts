/**
 * Owner-side search report for a live client site — closes the "is this site
 * actually working?" loop with data the studio already has access to:
 *
 *   npm run report                # last 28 days vs the 28 before them
 *   npm run report -- --days=90
 *
 * Pulls Search Console Search Analytics (top queries, top pages, totals,
 * period-over-period deltas) using the SAME OAuth credentials `npm run
 * gsc:setup` already uses (GOOGLE_OAUTH_CLIENT_ID / _SECRET /
 * _REFRESH_TOKEN — the webmasters scope covers both). Read-only; changes
 * nothing anywhere.
 */
import { env, fail, loadBusiness } from "./lib/content";

const args = process.argv.slice(2);
const days = Number.parseInt(args.findLast((a) => a.startsWith("--days="))?.slice(7) ?? "28", 10);
if (!Number.isFinite(days) || days < 1 || days > 480) {
  fail("--days must be between 1 and 480 (Search Console keeps ~16 months of data).");
}

const requireEnv = (key: string): string =>
  env(key) ?? fail(`${key} is missing — see scripts/setup-gsc.ts for the one-time OAuth setup`);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

async function accessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
      refresh_token: requireEnv("GOOGLE_OAUTH_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
  });
  const body: unknown = await res.json();
  const token = isRecord(body) ? body.access_token : undefined;
  if (typeof token !== "string") fail("OAuth token refresh failed — re-run gsc:setup --auth?");
  return token;
}

interface Row {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

async function query(
  auth: string,
  property: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  rowLimit: number,
): Promise<Row[]> {
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${auth}`, "content-type": "application/json" },
      body: JSON.stringify({ startDate, endDate, dimensions, rowLimit }),
    },
  );
  const body: unknown = await res.json();
  if (!res.ok) {
    fail(
      `Search Analytics query failed (HTTP ${res.status}): ${JSON.stringify(body).slice(0, 300)}\n` +
        "  Is the property set up? Run `npm run gsc:setup` after the production deploy.",
    );
  }
  const rows = isRecord(body) && Array.isArray(body.rows) ? (body.rows as Row[]) : [];
  return rows;
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function totals(rows: Row[]): { clicks: number; impressions: number } {
  let clicks = 0;
  let impressions = 0;
  for (const r of rows) {
    clicks += r.clicks ?? 0;
    impressions += r.impressions ?? 0;
  }
  return { clicks, impressions };
}

function delta(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "(new)" : "";
  const pct = Math.round(((current - previous) / previous) * 100);
  return `(${pct >= 0 ? "+" : ""}${pct}% vs prev.)`;
}

const business = loadBusiness();
const siteUrl = business.data.seo.siteUrl;
if (siteUrl.includes("example.com")) fail("data.seo.siteUrl is still the placeholder.");
const property = new URL("/", siteUrl).href;

// GSC data lags ~3 days — end the window there so numbers are stable.
const end = isoDaysAgo(3);
const start = isoDaysAgo(3 + days);
const prevEnd = isoDaysAgo(4 + days);
const prevStart = isoDaysAgo(4 + days * 2);

const auth = await accessToken();
// Totals come from DIMENSION-LESS queries (one row = the whole window). Summing
// a top-N query list instead would compare a truncated current subtotal against
// a fuller previous one and report nonsense deltas.
const [curTotals, prevTotals, queries, pages] = await Promise.all([
  query(auth, property, start, end, [], 1),
  query(auth, property, prevStart, prevEnd, [], 1),
  query(auth, property, start, end, ["query"], 15),
  query(auth, property, start, end, ["page"], 10),
]);

const cur = totals(curTotals);
const prev = totals(prevTotals);

console.log(`\nSearch report — ${business.data.name} (${property})`);
console.log(`Window: ${start} → ${end} (${days} days)\n`);
console.log(
  `  Clicks:      ${cur.clicks} ${delta(cur.clicks, prev.clicks)}\n` +
    `  Impressions: ${cur.impressions} ${delta(cur.impressions, prev.impressions)}\n`,
);

if (queries.length === 0) {
  console.log("  No query data yet — new properties take days to weeks to accumulate.");
} else {
  console.log("  Top queries:");
  for (const r of queries) {
    const pos = r.position === undefined ? "?" : r.position.toFixed(1);
    console.log(
      `    ${(r.keys?.[0] ?? "?").padEnd(40)} clicks ${String(r.clicks ?? 0).padStart(4)}  pos ${pos}`,
    );
  }
  console.log("\n  Top pages:");
  for (const r of pages) {
    console.log(
      `    ${(r.keys?.[0] ?? "?").replace(property, "/").padEnd(40)} clicks ${String(r.clicks ?? 0).padStart(4)}`,
    );
  }
}
console.log("");
