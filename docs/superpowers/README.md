# Archive — shipped redesign plans

Historical record, **not instructions**. Every plan and spec in here was written, approved,
and fully implemented; the template already reflects their outcome. They are kept because
they explain *why* the template looks the way it does — not because anything is left to do.

Do not execute these plans. The checkbox steps and "REQUIRED SUB-SKILL" banners inside them
were meant for the session that carried out the work.

| File | Shipped | What it changed |
| --- | --- | --- |
| `specs/2026-07-23-model-first-inversion-design.md` → `plans/2026-07-23-model-first-inversion.md` | 2026-07-23 | Replaced "prebuilt pages with variant dials" with the quality floor + toolkit the model designs on. Tests became contract-driven (`tests/contract.ts`) instead of assuming a fixed section inventory. |
| `specs/2026-07-24-primitives-only-design.md` → `plans/2026-07-24-primitives-only.md` | 2026-07-24 | Deleted every prebuilt section and UI primitive. `src/pages/index.astro` became the bare contract shell; form logic moved to the headless `src/lib/form.ts`; SEO generators became shape-tolerant (optional `content.faq`). |

The living contracts are [AGENTS.md](../../AGENTS.md), [docs/DESIGN-DOCTRINE.md](../DESIGN-DOCTRINE.md),
and [docs/RECIPES.md](../RECIPES.md). When those disagree with anything here, they win.
