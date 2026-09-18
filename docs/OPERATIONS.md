# OPERATIONS — the studio layer

Everything here is OWNER/studio-level: it manages the fleet of client sites,
not any single repo. The file ships in the template so every clone carries
the current copy (template-owned, synced by `npm run sync:template`), but the
actual registry data lives OUTSIDE client repos.

## Client registry

Keep ONE `clients.json` in a private studio location (a private ops repo or
drive — never inside a client repo). At N=5 memory works; at N=30 this file
IS the business. One entry per client:

```json
{
  "name": "מאפיית לונה",
  "domain": "luna-bakery.co.il",
  "repo": "https://github.com/OWNER/luna-bakery-site",
  "pagesProject": "luna-bakery-co-il",
  "gscProperty": "https://luna-bakery.co.il/",
  "web3formsEmail": "owner@luna-bakery.co.il",
  "launchDate": "2026-08-01",
  "templateVersion": "2026.08.14",
  "domainRegistrar": "…",
  "domainOwner": "client",
  "domainRenewal": "2027-08-01",
  "plan": "basic"
}
```

- `web3formsEmail`: whose inbox the form key is bound to (`""` = no form).
- `templateVersion`: copy of the clone's `TEMPLATE_VERSION` — when the
  template ships a fix, filter the registry for clones below that version
  and run `npm run sync:template` in each.
- Update the registry at launch (PLAYBOOK step 9) and on every domain/plan
  change.

## Monitoring — nothing checks a shipped site unless you set this up

- **Uptime**: add each production URL to a free uptime monitor (UptimeRobot /
  Better Stack / a Cloudflare Worker on a cron). Alert to the studio email.
- **Form canary**: for form clients, submit one test message per month and
  confirm it reaches the CLIENT's inbox. The Web3Forms key is silently bound
  to a mailbox — a changed or full mailbox loses every lead with zero
  signal. Calendar reminder, deliberately manual (an automated canary would
  spam the client's inbox).
- **Weekly CI cron** (already in `.github/workflows/ci.yml`) re-runs the full
  gate on every repo — a red weekly run on an untouched repo means
  dependency or browser drift, not a code change.
- **Search**: `npm run report` inside a client repo pulls its Search Console
  numbers (top queries/pages, period-over-period deltas). Run monthly for
  maintained clients; it reuses the `gsc:setup` OAuth credentials.

## Domains & DNS runbook

- `.co.il` registration goes through an ISOC-IL–accredited registrar. Decide
  and RECORD who owns the domain (studio vs client) — ownership disputes are
  the most common agency/client fight. Client-owned with the studio as
  technical contact is the clean default.
- Connecting a domain to Cloudflare Pages: when the client has working email
  on the domain, prefer the CNAME setup on their EXISTING DNS. Moving
  nameservers to Cloudflare migrates all records — copy every MX and TXT
  (SPF/DKIM) record BEFORE switching, or you take the client's email down.
  Verify mail flow after any nameserver change.
- Cutover on a domain with existing traffic: lower TTL a day ahead, deploy
  first, switch DNS second, keep the old host alive for 48h.
- Renewals: record dates in the registry. An expired domain is the #1
  "site is down and it's nobody's code" incident.

## Deploys, rollback, recovery

- **Rollback**: `npx wrangler pages deployment list --project-name <p>`,
  then re-activate a previous deployment in the dashboard (Deployments → ⋯ →
  Rollback) — or `git checkout <good-sha>` and `npm run deploy`.
- **Post-deploy**: open the production URL, confirm the change is live. The
  real risk with direct upload is deploying to the WRONG project — the
  printed project name must match the registry entry (it is pinned to
  `.env → CLOUDFLARE_PAGES_PROJECT` at setup so a later domain change can't
  silently retarget it).
- **"Laptop dies" recovery**: everything re-materializes from (1) the client
  repo on GitHub and (2) `.env` values. Keep per-client `.env` values
  (Web3Forms key, Pages project) in the studio password manager. Keep the
  STUDIO-level Google OAuth credentials as machine environment variables or
  password-manager entries — NEVER in per-client `.env` files: one leaked
  client checkout must not expose Search Console access for every client
  (all scripts read `process.env` before `.env`, so machine-level wins).

## Dependencies across the fleet

- The template stays fresh (Renovate). Client clones are frozen by design —
  BUT enable **Dependabot security updates** (repo Settings → Advanced
  Security) when creating every client repo: security-only PRs, no version
  churn; the weekly CI cron validates them.
- Code fixes reach clients via `npm run sync:template`; read
  `docs/CHANGELOG.md` for what each version changed and which entries are
  `[review]`-tagged.

## Maintenance plans — sell the edit path

Every post-launch change routes through the repo + a deploy. That is the
ceiling on how many clients one operator carries, so it must be priced,
never given away silently:

- **none** — changes billed per request.
- **basic** — N content edits/month (hours, prices, copy) + uptime/form
  monitoring.
- **full** — basic + monthly `npm run report` review + a quarterly
  content/SEO pass.

Record the plan in the registry. The client handoff tells the client HOW to
request a change (message the studio — never direct file access); a
`business.json` edit + `npm run deploy` is the entire fulfillment path.
