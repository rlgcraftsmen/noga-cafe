---
name: design-review
description: Judge a built client site against the design rubric: screenshot with a real browser, score distinctiveness/concept/color/typography/motion/craft/navigation/aliveness/mobile-craft, iterate targeted fixes (max 3 rounds), log verdicts to docs/design-review.md. Use after building or changing a client site's design, or when asked to review the design.
---

# Design review (the judge)

## Purpose

The mechanical gate (`npm run test` + `test:e2e` + `test:ltr-build`) proves the
site isn't broken. It says nothing about whether the site is bland. This skill
is the judge that closes that gap — it scores the REAL rendered site, not the
intentions in `docs/concept.md`. A site that passes every test and reads as
the reference template with new colors has not passed this review.

## Setup

**Step 0 — divergence + the comparison set (before the browser):**

- Run `npm run validate:divergence` and record its exact output. A `fail`
  (non-zero exit) is automatic fail #6 below; a `warn`-level finding caps
  Distinctiveness at 2 this round.
- List `docs/portfolio/` and READ every `<client>.png` there — that is the
  comparison set for the Distinctiveness axis. Note how many screenshots
  exist vs. entries in `docs/portfolio.json`; the log records the count.

Then:

```
npm run build
npm run preview
```

Preview serves on `:4321`; if occupied, `npm run preview -- --port 4323`. Use
the Playwright MCP browser tools, not a manual eyeball — mobile-first and
interactive:

1. `browser_navigate` to the preview URL.
2. `browser_resize` to `390x844` FIRST → `browser_take_screenshot` with
   `fullPage: true` (save it as `review-390-full.png` — a plain relative
   filename; an absolute path with non-ASCII segments is rejected. This shot
   becomes `docs/portfolio/<client>.png` at handoff), AND a viewport-sized
   screenshot of the hero.
3. `browser_click` the nav toggle (locate via `[aria-controls]`) →
   screenshot the OPEN mobile menu. If no `[aria-controls]` toggle exists,
   record that absence as Navigation evidence (the axis scores 1). If a menu
   was opened, CLOSE it (Escape or the toggle) before step 4 — an open
   drawer corrupts the desktop screenshot.
4. `browser_resize` to `1280x900` → `browser_take_screenshot` with `fullPage: true`.
5. `browser_navigate` to `/accessibility-statement/` → resize back to
   `390x844` → viewport screenshot. One legal page stands in for both — it
   is evidence for the Craft/coherence axis.
6. Read all screenshots before scoring anything — judge MOBILE evidence
   before desktop on every axis; the verdict is evidence-based.

Caveat: full-page screenshots downsample heavily on long pages. When judging
a specific band, take an additional viewport-sized or element screenshot.

## Automatic fails

Any ONE of these fails the round regardless of scores:

1. **Starter shell present** — `src/pages/index.astro` still renders the
   starter-shell markup, or `content.shell` still exists in schema/JSON.
2. **All-default palette** — ALL palette neutrals at schema defaults AND
   `src/styles/custom.css` contains no client-authored color story.
3. **Zero bespoke motion** — `src/lib/animation/custom.ts` is still the
   template no-op AND there is no `data-reveal` usage anywhere on the page.
4. **Motion inventory incomplete** — any of Craft bar 3's five aliveness
   categories (`docs/DESIGN-DOCTRINE.md`) is missing, verified in code:
   `custom.ts` content, `data-reveal` preset variety (grep which presets are
   used), `helpers.ts` imports (`marquee`/`parallax`/`counter`), and CSS
   hover/focus/press transitions on interactive elements.
5. **Broken nav mechanics** — during Setup step 3 the drawer fails to open
   or close, or the open drawer renders unstyled or BENEATH other page
   content. A nav that doesn't mechanically work is a build defect, not a
   low Navigation score — fail the round and fix it first.
6. **Divergence validator FAILS** — `npm run validate:divergence` exits
   non-zero: the fingerprint collides with a shipped site, is missing, or is
   stale against `business.json`. Fix the concept or the fingerprint, not
   the score.

## Pre-check (before scoring)

Read `docs/concept.md`. It must contain, as written prose for the CHOSEN
concept, both the nav concept and the choreography plan (Divergence rule 6,
`docs/DESIGN-DOCTRINE.md`) — not just code that happens to realize them. If
either is missing or too thin to judge, cap **Concept expression** at 2
regardless of what the rendered page shows, and say so in the log. The
fingerprint block must also be present and current (Step 0's validator run
says so).

## Fresh eyes

The agent that built the site scoring its own work grades generously — every
shipped build scored itself inline and PASSED work the operator then rejected
as boring. When an agent-dispatch tool is available, run the scoring pass
(automatic fails + rubric) as a FRESH subagent that receives ONLY: this skill
file, `docs/portfolio.json`, every `docs/portfolio/*.png`, the validator
output from Step 0, the screenshots just taken, and the relevant code paths
(`docs/concept.md`, `src/pages/index.astro`, `src/lib/animation/custom.ts`,
`src/styles/custom.css`) — not the building session's own reasoning or prior
self-assessment. **Invoking this skill IS the user's request to dispatch that
scoring subagent** — a general "don't use subagents unprompted" session rule
does not apply to this step. Treat the subagent's verdict as authoritative;
fold it into the log and fix/loop from there. If no dispatch tool exists,
score inline but stay skeptical — and say in the log that scoring was inline.

## Scored rubric

Score each 1–5 with one line of evidence — cite what you SAW in a screenshot
or read in the code, never an assumption:

- **Distinctiveness — COMPARATIVE.** Lay the shipped screenshots from
  `docs/portfolio/` beside this build's 390 full-page shot and answer, in
  writing: **which of these came from a different studio?** The score must
  cite at least two prior entries BY NAME and say what visibly differs —
  form, color logic, typographic voice, motif. "Feels distinctive" with no
  comparison is not evidence. Mechanized collisions come from Step 0's
  validator, not from your reading: a `fail` is automatic fail #6; a `warn`
  caps this axis at 2. Then check Craft bar 4's named tells
  (`docs/DESIGN-DOCTRINE.md` — classic + editorial-courage lists): 2 or more
  present caps this axis at 2. If `docs/portfolio/` holds fewer screenshots
  than `portfolio.json` has entries, say how many you compared against.
- **Concept expression** — is the concept from `docs/concept.md` visible on
  the page (motifs, color story, composition), not just claimed in prose?
- **Color story** — does color move through the page with intent, following
  the concept's OWN logic (any coherent logic qualifies; a band stack is not
  required)? Is the accent focused where it matters, not scattered?
- **Typography** — does the pairing carry the concept? Warn if `handmade`
  (Amatic SC) carries long headings — display-only, illegible past a few
  words.
- **Motion evidence** — screenshots are static; judge from code. Inspect
  `src/lib/animation/custom.ts` and grep `data-reveal` usage — ONE coherent
  motion identity, or default reveals with no signature?
- **Craft/coherence** — alignment, spacing, contrast comfort; does the page
  read as ONE design? Includes the legal-page screenshot from Setup step 5:
  a legal page still wearing the template's neutral baseline caps this axis
  at 3.
- **Navigation** — scroll-aware response past a threshold? active-section
  indication (`aria-current` plus a visible state, not color alone)? is the
  mobile drawer DESIGNED — judged from the open-menu screenshot, never
  assumed?
- **Aliveness** — density and coherence of the motion inventory (the five
  categories are Craft bar 3, `docs/DESIGN-DOCTRINE.md` — read them there)
  while keeping ONE identity.
- **Mobile craft** — primary CTA thumb-reachable? type scale holds at 390 —
  no truncation or horizontal-scroll artifacts? a sticky contact bar or
  equivalent always-reachable contact access?

**PASS bar**: no automatic fail, no score below 3, average ≥ 4 across all 9
axes.

## The loop

On FAIL: pick the 2–3 highest-leverage fixes (not a redesign), apply them,
rebuild, re-shoot the Setup screenshots, re-score. Maximum 3 rounds total.

- If the Pre-check capped Concept expression at 2 for missing nav-concept or
  choreography prose, writing that prose IS fix #1 of the round — even when
  invoked standalone, so the loop doesn't deadlock.
- A fix that changes `voice.palette.accent` or `design.fontPairing` must
  update the fingerprint block in the same round — the validator fails on a
  stale one (rerun it before re-scoring).

After every round (pass or not), append to `docs/design-review.md` — a
CLIENT-repo artifact; the template repo must never contain this file:

- Round number, screenshots taken (viewport + what they showed), how many
  portfolio screenshots the comparison ran against.
- Scores with their one-line evidence (Distinctiveness names the compared
  entries).
- Verdict (PASS/FAIL) and which automatic fails, if any, triggered.
- Fixes applied going into the next round.

If still failing after 3 rounds, say so plainly — in the log and in your
final report. Never quietly stop or claim a pass that didn't happen.

## Rules

- Judging never edits the contract smoke suite.
- Fixes stay on the quality floor: new color-as-text pair →
  `contrastPairs()` in `scripts/lib/color.ts` first; RTL logical properties
  only; reduced-motion still frame intact.
- Rerun `npm run test` after any fix round that touched code or content.
- Kill the preview server when the review concludes, pass or fail — find the
  process bound to the preview port and stop it. Windows/PowerShell:
  `Get-NetTCPConnection -LocalPort 4321 | Select-Object -ExpandProperty
  OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }` (swap the
  port if Setup bound another) — or close the shell that ran
  `npm run preview`.
