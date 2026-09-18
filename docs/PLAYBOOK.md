# Playbook — from client call to live site

The owner's operating procedure, condensed. One repo per client; run this
top to bottom for every new engagement. Details of each step live elsewhere
([README.md](../README.md), [docs/brief.md](./brief.md),
[docs/DESIGN-DOCTRINE.md](./DESIGN-DOCTRINE.md)) — this page is the order of
operations, not a replacement for them.

1. **Duplicate.** Template repo → **Use this template** → a new private
   `client-name` repo → `git clone <client-repo-url> && cd client-name` →
   `npm install`. First time on a machine, also run
   `npx playwright install chromium` AND `npm run setup:skills` (both once
   per machine, not per client). `setup:skills` installs the studio's
   required agent-skill set — the build workflow invokes these skills by
   name (Hebrew copy, CRO, web-quality audits, GSAP…), so a machine without
   them produces weaker builds. Idempotent; rerun with `-- --force` to pull
   upstream skill updates. Restart Claude Code after installing.

2. **Scrape.** Open the client's socials and Google Business profile in a
   Chrome tab group (Instagram, Facebook About+reviews, Maps with reviews
   sorted by newest + photos tab, existing site, one directory), then run
   **`/fill-brief`** — it reads all tabs in one pass, fills `docs/brief.md`,
   places any client-supplied photos in `src/assets/images/`, records
   source conflicts instead of resolving them, and ends with the
   WhatsApp checklist of the facts only the client can supply (coordinator
   first — longest lead time). Paste the client's answers back tagged
   `[client-confirmed]`. Get real photos BEFORE `/new-client` whenever
   possible — photos beat every other choice you make, and the concept
   designs around the actual photography. With photos in
   `src/assets/images/`, run `npm run sample:palette` — the color story
   starts from the client's real photographs, not an invented palette
   (PORTFOLIO's #5 lesson). Tag every fact `[scraped]` (found online, unverified) or
   `[client-confirmed]` (the client said it directly) — `/new-client` treats
   scraped-only NAP, prices, and hours as provisional and lists them for
   confirmation before launch. Dump raw texture into the brief's "Raw
   texture" section too: verbatim reviews, the business's own words, what
   their photos look and feel like — the design concept gets built from this
   material, not from generic prompting. A thin brief produces a generic
   concept, every time; ten verbatim reviews beat any instruction you could
   write. Don't skip the newer brief fields either: GPS coordinates (paste a
   Google Maps pin, or the model geocodes and flags it as unverified),
   persona, and whether the client wants analytics.

3. **Pre-flight** (before you run `/new-client`, confirm):
   - `docs/brief.md` is saved and filled in.
   - Accessibility-coordinator details if the client has them ready — this
     is BLOCKING at launch if still missing (ת"י 5568 is a legal
     requirement for Israeli businesses; ship without it and the site
     isn't launch-ready no matter how green the test gate is).
   - Client photos are in `src/assets/images/` if available (placeholders
     are fine to start from otherwise — `npm run generate:placeholders`).
   - `.env` exists (copy `.env.example`) with a Web3Forms key created on the
     **client's** email — only if they actually want a contact form.
   - Nothing to prepare for distinctiveness — `docs/portfolio.json` +
     `npm run validate:divergence` carry the cross-client memory into the
     concept stage automatically.

4. **Run `/new-client`** from the repo root. It runs unattended, start to
   finish: three design concepts → self-critique → the chosen concept
   committed to `docs/concept.md` → schema-first content (schema, then
   `business.json`) → a mobile-first build of every section from zero →
   design-review rounds (screenshots, scored against the rubric, logged to
   `docs/design-review.md`) → the full test gate → a final report.

5. **Read the report bottom-up** — BLOCKING items first, then anything
   flagged "confirm with client." Run `npm run preview` and review the site
   on your **phone** first; desktop is the adaptation, not the primary
   canvas.

6. **Feedback loop.** Copy, price, or fact changes are always a
   `business.json` edit → commit → redeploy — never a code change. Design
   feedback ("this feels off") goes to Claude as a description of what's
   wrong, not a prescribed fix; after any design change, invoke
   `/design-review` again to re-judge the result and log the new verdict.

7. **Deploy a preview.** `npx wrangler login` once per machine, then
   `npm run deploy:setup` (creates the Pages project) and
   `npm run deploy:preview` — see README's Deploy section, including the
   Git-connected alternative. Put `PUBLIC_WEB3FORMS_KEY` in your local `.env`
   first: these commands build on your machine, so a key set only in the
   dashboard never reaches the upload. The `*.pages.dev` URL Cloudflare prints
   is the client-approval link — send that, not a custom domain, and run the
   feedback loop (step 6) against it until the client actually signs off.
   Every round of feedback is then just `npm run deploy:preview` again.

8. **Go live.** Only after client approval: buy/point the domain (DNS
   runbook — incl. how NOT to break the client's email — in
   [docs/OPERATIONS.md](./OPERATIONS.md)), set it as the custom domain in
   Cloudflare Pages, update `data.seo.siteUrl` in `business.json` to match
   it, and create a **Cloudflare Web Analytics** token (dashboard →
   Analytics → Web Analytics — cookieless, free, one click) into
   `data.analytics.cloudflareToken`: without it the site ships with zero
   measurement and nobody ever knows whether it works. Commit, then
   `npm run deploy` — it runs `npm run preflight` automatically and refuses
   to upload while any launch blocker (placeholders, fake coordinator,
   broken links, missing OG/form key) remains. Post-launch:
   `npm run build && npm run lhci` against the budgets; validate the
   structured data at [validator.schema.org](https://validator.schema.org)
   and Google's Rich Results test; then `npm run gsc:setup` (see Search
   Console below) to verify the domain, add the Search Console property,
   and submit the sitemap in one command.

9. **Handoff.** Send a real test submission through the contact form and
   CONFIRM it actually landed in the client's inbox — a bad Web3Forms key
   fails silently and loses every lead with nothing in the test gate to
   catch it (repeat this canary monthly for maintained form clients). Hand
   over Google Search Console access to the client (or their marketing
   contact). Archive the filled `docs/brief.md` in the client repo as the
   record of what was agreed. **File the site's fingerprint in the TEMPLATE repo**: append the
   JSON object the `/new-client` report ends with to `docs/portfolio.json`'s
   `entries` array, and save the review's 390-wide full-page screenshot as
   `docs/portfolio/<client>.png` (capture spec: `docs/PORTFOLIO.md` →
   Fingerprint format). Then run `npm run validate:divergence -- --summary`
   in the template to confirm the entry parses. This is what stops the next
   build from rhyming with this one — skipping either artifact re-creates
   the sameness problem.
   Finally, register the client in the studio
   layer ([docs/OPERATIONS.md](./OPERATIONS.md)): the `clients.json` entry
   (domain, repo, Pages project, `TEMPLATE_VERSION`, maintenance plan,
   domain renewal date) and the uptime monitor.

## Search Console (`npm run gsc:setup`)

One command wires a launched site into Google Search Console using the
**meta-tag** verification method — no DNS access or extra Cloudflare
permissions needed. It fetches the site's verification token from Google and
writes it into `data.seo.googleSiteVerification` in `business.json`
(BaseLayout renders the `google-site-verification` meta tag); after you
commit + `npm run deploy`, running it again confirms the tag is live,
verifies ownership, adds the URL-prefix property, and submits the sitemap.
Idempotent — safe to rerun at any point; it tells you which phase you're in.

**One-time studio setup** (once ever, not per client):

1. In any Google Cloud project (the studio's), enable the **Search Console
   API** and the **Site Verification API**, and create an OAuth client of
   type **Desktop app**. Set its id/secret as **machine-level environment
   variables** `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`
   (Windows: `setx`, then restart the terminal) — NOT in per-repo `.env`
   files: these are studio-wide credentials, and one leaked client checkout
   must not expose Search Console access for every client. All scripts read
   `process.env` first, so machine-level values work everywhere.
2. `npm run gsc:setup -- --auth` — opens a browser consent flow on the
   studio's Google account and prints `GOOGLE_OAUTH_REFRESH_TOKEN`; store it
   the same machine-level way. The token works for every client site owned
   by that account (it also powers `npm run report`).

**Per client**, after the production deploy: `npm run gsc:setup` (writes the
token) → commit → `npm run deploy` → `npm run gsc:setup` again (verifies +
submits). The token is site-specific but NOT a secret — committing it is
correct. At handoff (step 9), add the client as a user on the property in
Search Console — ownership stays with the studio account that verified it.

## Getting the best out of it

- **Brief richness beats everything.** Every downstream artifact — concept,
  palette, motion identity, copy voice — derives from the brief's raw
  texture. If a run disappoints, the highest-leverage fix is a richer brief,
  not more adjectives in your feedback. Photos are the strongest single
  input (a full-bleed hero lives or dies by the photo behind it) — settle
  the photography question before concepting, never after.
- **Use the judge adversarially.** If a delivered site feels samey or dead,
  open `docs/design-review.md` and read what was scored and why — then
  challenge it ("Aliveness got 4 but I count two animations; re-judge with
  fresh eyes"). The design-review skill supports running the scoring round
  as a fresh subagent precisely so the builder doesn't grade its own work.
- **The promote loop compounds the template.** When a client build invents
  something broadly useful (a section type, a motion pattern, a palette
  trick), generalize it and PR it into the TEMPLATE as a recipe, token, or
  reveal preset — never copy client code between client repos. Every client
  makes the next one better.
- **Never edit the contract smoke suite in a client repo — only add tests.**
  It's the safety net that lets the model be radical everywhere else.
- **When something breaks, run `npm run validate:content` first.** It gives
  the clearest errors and now catches schema mistakes, contrast failures,
  and phone/hours/date slips before the build ever runs. `npm run preflight`
  is the second diagnostic layer — it knows what "launch-ready" means.
- **Monthly, per maintained client: `npm run report`.** Search Console
  clicks/queries/pages with period deltas — the two minutes that tell you
  (and the client) whether the site is actually working. Pair it with the
  form canary and the uptime monitor (docs/OPERATIONS.md).
- **When the template improves, fixes reach shipped clients via
  `npm run sync:template`** — check `docs/CHANGELOG.md` for what each
  `TEMPLATE_VERSION` changed and which entries need a careful review.
