---
id: T-0570
title: "Rendered docs stop teaching the retired scale and density attributes"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L1
priority: P3
depends: []
created: 2026-10-29
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
Rendered docs and their comments stop teaching the retired `[scale]` / `[density]` attributes, and the Low doc nits are fixed.

## Intent
- Do: fix M1 to M5 and L1 to L4 below; prose and comments only (descriptor edits stay outside the `attributes[]` fence).
- Done when: a grep for the retired `[scale]` / `[density]` wording in the cited files finds nothing outside negations that name the replacement; `doc_lint` and `npm run check` exit 0; the sitemap step runs if an L1 descriptor changes.

## Context
From the T-0537 docs-site sweep (PR 2367):

### Medium

Rendered prose still teaches the `[scale]` / `[density]` attributes that T-0169 removed. `theme-provider.md:77-79` states they "now do nothing" and the token sheets keep no live `[scale]` / `[density]` selector (only comments), while the live demos already use `data-scale` / `data-tier` / `data-density` (`component-preview.ts:2098`, `bar-chart-demo.ts:118`, `button-permutations.ts:5`).

- M1 `packages/agent-ui/components/src/controls/checkbox/checkbox.md:153-154` (checkbox-doc): "at the default `ui-md` scale. An ancestor `[scale]` attribute re-tables the ramp for its subtree." Fix: "An ancestor `data-scale` (with `data-tier`) re-tables the ramp for its subtree", and drop "`ui-md` scale" for "the md step".
- M2 `site/pages/tokens.ts:156-157` (tokens page lead): "before a [scale] ancestor re-tables it ... the full [scale] × [size] stepping demo". Fix: say `data-scale` ancestor and "data-scale × size".
- M3 `site/pages/tokens.ts:189`: "size (the one leg that rides [scale])". Fix: "rides data-scale".
- M4 `site/main.ts:148`, `:223`, `:274` (home index card blurbs for Sizing, button Permutations, text-field Permutations): "[scale] × [size] matrix", "the [scale]/[density] subtree-geometry demo". The pages they link say the axes are retired (`button-permutations.ts:5`, `text-field-permutations.ts:6`). Fix: "data-scale / data-tier".
- M5 `packages/agent-ui/components/src/controls/badge/badge.md:123` (badge-doc): "an ancestor `[density]`". Fix: `[data-density]`.
- Proposed ticket: "Rendered docs stop teaching the retired [scale] / [density] attributes" (L1, prose only across checkbox.md, badge.md, tokens.ts and main.ts; descriptor edits outside the `attributes[]` fence, so doc_lint plus check).

### Low

- L1 `packages/agent-ui/components/src/controls/icon/icon.md:72-73` (icon-doc): cites `@agent-ui/icons/src/types.ts` as the source of truth, a deep path the package does not export, and says "twenty names" while `ICON_NAMES` holds 103 (counted by importing `packages/agent-ui/icons/src/types.ts`). Fix: cite `ICON_NAMES` from `@agent-ui/icons` and drop the count.
- L2 `packages/agent-ui/components/src/controls/text/text.md:221` (text-doc, Tooltip pairing sample): `<ui-text slot="content">` inside `ui-tooltip`, which has no named slots (`tooltip.md:47-53`: first child is the anchor, the rest move into the panel). The attribute is inert and suggests a slot that does not exist. Fix: drop `slot="content"`.
- L3 `site/pages/description-list-doc.ts:19`, `site/pages/image-doc.ts:37`, `site/pages/source-list-doc.ts:20`, `site/pages/stat-doc.ts:35` (page intros): "no [size]/[scale] control geometry" names the retired axis. Fix: "no size or data-scale control geometry".
- L4 stale comments, not rendered: `site/lib/component-preview.css:90` says `.preview-knobs` carries `scale="ui-sm"` (the code sets `data-scale="sm"`, `component-preview.ts:2098`); `site/pages/bar-chart-demo.ts:5` and `site/pages/segment-demo.ts:85` speak of an ancestor `[density]` / `[scale]`; `site/pages/layout-permutations.ts:70` and `site/pages/permutations.css:134` the same. Fix: reword to the `data-*` axes.
- Proposed ticket: "Docs nits: icon.md deep path and stale count, text.md inert slot, [scale] negations and stale comments" (L1, fold into the Medium ticket if it lands first).

## Constraints
No em dashes. No paid runs. ADRs are frozen.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-29 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 0d03f6fe4c64
- Changed: Rendered docs and comments stop teaching the retired scale and density attributes, and the doc nits are fixed
- Commits: none
- Check: 1 grep for the retired `[scale]` / `[density]` wording in the cited files finds nothing outside neg...: pass
- Check: 2 `doc_lint` exit 0: pass
- Check: 3 `npm run check` exit 0: pass
- Follow-up: note: site/pages/bar-chart-demo.ts:5... -> notes.md
