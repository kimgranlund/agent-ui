---
doc-type: ticket
id: tkt-0007
status: open
date: 2026-07-10
owner:
kind: feature
size: big
---
# TKT-0007 — design-system surfaces: token displays · panes + settings chrome · code + prose

## Summary
Kim's ask (2026-07-09, the `/feature` intake seed; interrupted by session loss, resumed and completed
2026-07-10): *"use skills and agents from agent-ui/.claude/ and create a plan for what you think would
be helpful components and shells to add to agent-ui library. examples: settings shell, canvases, etc ·
token swatches, ranges (palettes), ladders (sizes) for colors, typography, shapes, etc. · code
viewers · various UI patterns for panes. this should become one or several PRDs for Agent UI to
decompose when ready."*

**Dedup findings (verified against the tree at intake):**
- **Canvases: already queued, not re-minted.** `agent-app-surfaces.prd.md` (accepted v1.0) owns the
  canvas/surface-host as PRD-G3, milestone M2, unspecced — the seed's "canvases" is that queued work.
- Everything else is a verified gap: no swatch/ramp/ladder control, no split-pane/splitter/resizable
  control anywhere (42 descriptors checked; `ui-app-shell` is a fixed grid with `collapse: "toggle"`
  reserved-unbuilt per SPEC-R5/ADR-0084), no settings surface, no markdown rendering, `ui-code`
  deliberately highlight-inert (the ADR-0113 fence, escape hatch (b) explicitly deferred to "its own
  intake").

**Kim's intake fork answers (2026-07-10, on record):**
1. **Record shape** — sibling family PRDs + one ticket (this record).
2. **Families** — all four: token surfaces · panes · code + prose · settings surface.
3. **Tier ruling** — panes + settings are *chrome* → extend `agent-app-surfaces` (M4), not siblings.
4. **Zero-dep fork** — swappable pack adapter on the `@agent-ui/icons` model: `@agent-ui/code` (new)
   → pure core + `./highlight` + `./markdown`.

**The Q1↔Q3 reconciliation** (answers 1 and 3 collided on panes — Q1's sketch listed
`pane-family.prd.md` as a sibling; Q3 rules panes into the chrome PRD): resolved by DAG mechanics in
[ADR-0120](../adr/0120-app-surfaces-m4-panes-settings.md) — **no pane-family sibling PRD** (Q3 honored
at the ownership altitude); the split-pane *primitive* (`ui-split`) lands **components-tier** because
no `a2ui` import forces it upward and apex placement would strand it (nothing imports `app`; the
catalog reaches only `components`). Chrome patterns (master-detail, realized `collapse: "toggle"`,
settings surface) land app-tier as M4.

**The record map minted by this intake:**
- [`prd/token-surfaces.prd.md`](../prd/token-surfaces.prd.md) + [ADR-0118](../adr/0118-token-surfaces-v1-scope.md)
  — `ui-swatch` · `ui-ramp` · `ui-ladder` (promotes `site/pages/tokens.ts`'s display, the ADR-0117
  promotion pattern).
- [`prd/code-prose-family.prd.md`](../prd/code-prose-family.prd.md) + [ADR-0119](../adr/0119-code-prose-family-v1-scope.md)
  — `@agent-ui/code`: core seams + `./highlight` + `./markdown` packs, diff at M2 (realizes ADR-0113's
  named escape hatch; Kim's Q4 shape).
- [`prd/agent-app-surfaces.prd.md`](../prd/agent-app-surfaces.prd.md) **v1.1** + [ADR-0120](../adr/0120-app-surfaces-m4-panes-settings.md)
  — PRD-G7/PRD-G8 + milestone M4 (panes + settings; the tier split).

## Acceptance
- The three ADRs pass the ADR gates (bare-keyword Status, parseable frontmatter, indexed in the ADR
  README) and every cross-reference above resolves.
- Both new PRDs land as **proposed v0.1 scope intakes** in the house shape (the chart-family
  pattern); the agent-app-surfaces amendment is additive (PRD-D1–D6 and M1–M3 targets untouched) and
  header-flagged pending doc-review.
- Doc-review dispatched on the five records; ratification is Kim's (fork answers on 0118 F1–F4,
  0119 F1–F4, 0120 F1–F3 — each carries a firm recommendation as the no-objection default).
- **No build is authorized by this record** — builds are dispatched per-milestone after ratification
  (`/build`'s contract).

## Links
- The three ADRs + three PRDs in the record map above (the ID spine).
- [ADR-0113](../adr/0113-content-family-v1-scope.md) — the fence this intake's code+prose family was
  foreseen by · [ADR-0117](../adr/0117-theme-provider-shipped-component.md) — the site-local →
  shipped-control promotion precedent (token surfaces) · [ADR-0084](../adr/0084-app-shell-narrow-reflow-collapse.md)
  — the `collapse: "toggle"` reservation M4 realizes · [ADR-0065](../adr/0065-icon-adapter-swappable-pack-architecture.md)
  — the pack-adapter architecture `@agent-ui/code` reuses.
- `site/pages/tokens.ts` + `site/lib/token-parse.ts` — the site-local token display being promoted.
- Provenance: the intake ran under `/scribe:feature` in the ultimate-tokens host session (2026-07-09
  → 10); the fork answers were given there and are restated verbatim in Summary.

## Scope / Open
- **Ratification order is Kim's**: the three families are independently ratifiable/sequenceable;
  nothing here couples them.
- **Naming sliver (0119 F1):** `@agent-ui/code` will export prose surfaces — Kim may prefer a
  different name at ratification; geometry unchanged.
- **Named, unauthored intents** (from the seed's "etc.", deliberately NOT minted — each is a future
  intake if earned): typography specimen surfaces (waterfalls/pangrams) · contrast-verdict badges ·
  token diff views · a schema-driven preferences framework · N-pane split groups.
- **Non-goal:** no default-catalog widening for `@agent-ui/code` surfaces (two-tier consumer
  extension only, ADR-0119 cl.7); no router import into `app` for the settings surface (ADR-0115
  law).

## Findings
