# Portfolio — the anti-sameness memory

**Why this file exists:** each client build runs in a fresh repo with no
memory of the others, and the model's stable taste re-derives its favorite
moves every time believing they're original. The measured result across the
first four builds: **three of four chose the same metaphor family**
(time-of-day mapped to a color arc down the page), **three of four chose
the same font pairing** (`poster` / Suez One), and **all four chose a
gold/amber accent** on a warm cream/dark palette. Each looked distinctive
alone; the portfolio looks like one designer repeating themselves.

This memory is the cross-client record that breaks that loop — and since
TEMPLATE_VERSION 2026.08.23 it is mechanized, not prose:

- The fingerprints live in **`docs/portfolio.json`** (machine-readable; one
  entry per shipped site, appended at handoff — PLAYBOOK step 9).
- The binding checks run in **`npm run validate:divergence`**: a repeated
  metaphor family, a (fontPairing + accent hue family) already shipped, or a
  (pageForm + metaphorFamily) already shipped FAILS the concept before any
  page code is written. `-- --summary` prints the spent-material frequency
  tables straight from the JSON, so they can never drift from the truth.
- The design rule is `docs/DESIGN-DOCTRINE.md` → Divergence; the scoring
  consequence is the design-review skill's Distinctiveness axis, which
  compares the new build's screenshot against **`docs/portfolio/*.png`**
  (390-wide full-page screenshots of the shipped sites).
- No shell to run? Read `docs/portfolio.json` directly — it is the same data.

A repeat is only legitimate when the client's world genuinely demands it —
declared explicitly in the fingerprint's `argues` array, naming the specific
prior entry, never silently. A (pageForm + metaphorFamily) repeat cannot be
argued at all: same form + same metaphor is the same site with new words.

All clients so far are food businesses — some SECTION overlap (menu, hours,
reviews) is the client mix, not a failure. The fingerprint axes are design
choices, and those have no such excuse.

## Fingerprint format

Two places, one shape:

1. **`docs/concept.md`** (client repo — written by `/new-client` Step 1) —
   a fenced block with info string `json fingerprint`, anywhere in the file.
   `npm run validate:divergence -- --print-template` prints an empty one:

   ````markdown
   ```json fingerprint
   {
     "client": "acme-bakery",
     "date": "2026-08-23",
     "businessType": "bakery",
     "metaphorFamily": "proofing-basket",
     "metaphorNote": "the coiled rings the dough leaves behind",
     "pageForm": "spine-rail",
     "paletteFamily": "flour white + rye",
     "accentHex": "#3f6f8f",
     "fontPairing": "editorial",
     "signature": "the rail of proof rings the content hangs off",
     "motionIdentity": "rise — everything settles upward, nothing drops",
     "furniture": [],
     "argues": []
   }
   ```
   ````

   `client` / `metaphorFamily` / `pageForm` are kebab-case slugs — the
   validator compares family slugs (with token-set matching, so a rephrasing
   like "arc-of-the-day" still matches "time-of-day-arc") and hard-errors on
   free text. `fontPairing` is one of the 15 pairing keys; `accentHex` must
   agree with `business.json`'s `voice.palette.accent` (business.json wins —
   a stale fingerprint fails). `furniture` lists reusable props by slug
   (e.g. `"marquee-ticker"`) so their frequency can be tracked. `argues` is
   the explicit-repeat escape hatch:
   `{ "against": "<client-slug>", "axis": "metaphorFamily" | "fontPairing+accent" | "pageForm", "why": "<≥40 chars, specific to THIS client>" }`.

2. **`docs/portfolio.json`** (template repo) — the same object per shipped
   site, plus `accentHexAlt` (informational secondary accent) and
   `screenshot` (`"portfolio/<client>.png"`). `accentHex` records the site's
   DOMINANT brand accent as judged — what the page reads as, which is what
   sameness was measured on — not necessarily the literal
   `voice.palette.accent` field.

Screenshot capture spec (identical for every entry, so the comparison is
fair): Playwright, viewport 390×844, deviceScaleFactor 1, `fullPage: true`,
production build, page scrolled once end-to-end first so lazy images settle.
Keep each PNG under 1.5MB (the validator warns above it; re-encode with
sharp at width 390, png quality 80).

## What #5 cost, and why it is written here

nook-cafe is the first photo-led build and the first with a video hero — but
only on the second attempt. The first shipped typographically because the
client's photographs were withheld as "scraped from Instagram", and the
operator rejected the result as cold and dated. The rebuild around their real
photography was a different site entirely: new palette (sampled from the
photos, not invented), new font, new composition.

The lesson is the one `/fill-brief` already states and that build ignored:
**settle the photography question before concepting, never after.** A page
composed without images was designed for images that do not exist, and
re-skinning it later is not a substitute. When the operator supplies client
media, ASK whether it may be used rather than silently applying the
scraped-images rule — that rule exists to protect against unknown rights, not
to override the operator's own client material. `npm run sample:palette`
mechanizes the palette half of this lesson: with photos in
`src/assets/images/`, the palette is sampled from reality, not invented.
