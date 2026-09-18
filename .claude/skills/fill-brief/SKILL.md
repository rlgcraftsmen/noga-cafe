---
name: fill-brief
description: Fill docs/brief.md from the client's public web presence — batch-scrape a staged Chrome tab group (Instagram/Facebook/Google Maps/site), enforce verbatim raw-texture rules, intake photos into src/assets/images/, record source conflicts, and print the client WhatsApp checklist. Use when starting client intake, when asked to fill or update the brief, or before /new-client when the brief is empty.
---

# Fill the brief (batch scrape → brief.md → client checklist)

Turn the client's public presence into a completely filled `docs/brief.md`,
photos in place, and a short checklist of the facts only the client can
supply. This is the LAST hand-driven step before `/new-client`; its output
quality decides the build's quality — a rich raw-texture section beats
every other lever (PLAYBOOK: "ten verbatim reviews beat any instruction").

## Step 0 — Inputs

- The operator stages sources in a Chrome tab group before invoking this
  skill: Instagram profile, Facebook page (About + reviews), Google Maps
  listing (reviews sorted by NEWEST + the photos tab), the existing
  site/linktree if any, and one directory (dapei zahav) for NAP
  cross-check. Call `tabs_context_mcp` first; work with the tabs that
  exist. If no browser is connected, fall back to WebSearch/WebFetch for
  public pages and say plainly which sources were unreachable.
- Read `docs/brief.md` (the template) so output matches its structure
  exactly. Never restructure it.
- NEVER log in to anything or ask the operator to. Scrape what's publicly
  visible; a login-walled page is recorded as "not accessible" and its
  fields go on the client checklist instead.

## Step 1 — One batched scrape pass

Read EVERY staged tab in one sweep (scroll where content lazy-loads —
Maps reviews and IG grids need it) before writing anything. Collect:

- NAP (name, address, phone), hours per day, services + prices, socials,
  email/WhatsApp only if explicitly published.
- Geo: from the Maps share link/pin if present.
- Google rating + review count (feeds `data.reviews` — real numbers only).
- Everything for Raw texture (Step 2).

Rules:

- Tag EVERY fact `[scraped]`. Nothing this skill writes is ever
  `[client-confirmed]` — no client spoke.
- **Record conflicts, never resolve them silently.** Hours/phone/address
  that differ between sources are all written down with their source
  (`[scraped: IG bio]`, `[scraped: Maps]`, `[scraped: dapei zahav]`). The
  business's own bio is the default candidate; the conflict list goes into
  the brief's confirm-before-launch section and the client checklist.
  (A real build found SEVEN disagreeing hours sources — the conflicts being
  visible is what made the right call possible.)
- Never invent an email or WhatsApp number. A Google-listed landline is NOT
  a WhatsApp number. Blank is a valid, shippable value for both.

## Step 2 — Raw texture (the design material — the whole point)

- **10+ verbatim review quotes**, star rating and rough date included,
  pasted word-for-word. Summarizing reviews destroys exactly the texture
  the concept feeds on. Prefer recent + concrete ("הפוקצ'ה יוצאת מהטאבון
  ישר לשולחן") over generic praise; include 1–2 critical ones if they
  exist — they reveal what customers actually care about.
- **The business's own words** from posts/bio, verbatim, in the original
  language. Flag recurring phrases separately — a line the business repeats
  is h1/motif material.
- **Describe the photos**: light, color palette, materials, composition,
  mood, and what shows up again and again. This steers the concept's
  palette and hero honestly.
- Who the customers appear to be (from photos, reviews, comment tone).
- Anything iconic a visitor would instantly recognize — an object, a
  ritual, a motion, a phrase.

## Step 3 — Photo intake (BEFORE /new-client, not after)

The concept stage designs around the actual photography — palette, hero
treatment, and section design all derive from what the images really look
like. A build composed on placeholders and re-skinned with real photos
later was designed for images that don't exist.

- If the operator has client-supplied photos (folder/zip/drive): copy them
  into `src/assets/images/` now, with clean kebab-case filenames, and list
  each file in the brief's "Photos provided?" field with a one-line
  description. Client-sent photos are authorized; that closes the rights
  question.
- If not: write "use placeholders for now" AND make photos the TOP item of
  the client checklist (Step 5) — they have the longest lead time after
  the coordinator. Scraped IG/Maps images are low-res and rights-murky;
  never copy them into `src/assets/images/`.
- Once photos are placed, run `npm run sample:palette` and paste its
  candidate block into the brief's Voice & brand section tagged `[scraped]`
  — `/new-client` Step 1 starts its color story from those hexes.

## Step 4 — Write the brief

- Fill every field of `docs/brief.md`; leave a field blank only when
  nothing was findable, and then add it to the client checklist.
- Include the coordinator fields under Legal (the template asks for them —
  they are the single most common launch BLOCKER, ת"י 5568).
- Voice & brand and Creative appetite: infer honestly from the evidence
  (tone of their posts, how bold their branding already is) and mark the
  inference `[scraped]` — the client can correct it via the checklist.
- Save UTF-8 **without BOM**.

## Step 5 — Print the client checklist

End by printing a short WhatsApp-ready message TO THE CLIENT, in the
business's language (Hebrew for he sites), asking ONLY for what cannot be
scraped — one numbered list, no preamble:

1. Photos as files (if Step 3 found none) — "כמה תמונות טובות במייל/דרייב".
2. Accessibility coordinator name + phone + email (explain in one clause
   it's a legal requirement; if under 25 employees, management contact
   works).
3. Hours confirmation — reproduce the scraped hours table inline and ask
   "נכון?" (include the conflicts, let them pick).
4. Contact form wanted? Analytics OK?
5. Prices confirmation for the services table.
6. Anything they DON'T want on the site.

Tell the operator: paste the answers back into the brief tagged
`[client-confirmed]`, then run `/new-client`. Photos and coordinator can
lag — `/new-client` flags them — but the build is measurably better when
photos arrive first.

## Report

Close with: sources read (and any unreachable), conflict list, fields
still blank, photos status (n files placed / awaiting client), and the
checklist. No essays — the brief itself is the deliverable.
