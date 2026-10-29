---
id: T-0537
title: "Docs-site examples sweep: demo code samples against the current API and subpaths"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: [T-0526, T-0530]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A ranked list of docs-site demo code samples and prose snippets that no longer match the current API: renamed or removed props and attributes, retired parts, event names outside ADR-0153's set, and imports from barrels that moved to subpaths (T-0521 roving-focus, T-0526 scroll-fade and pane-resize, T-0530 a2ui catalogs).

## Intent
- Do: extract every code sample from `site/pages/**` and the site's rendered docs; resolve each import against the package exports and each attribute or part against the descriptors; run the riskiest samples where cheap. Write `## Findings` to this handoff.
- Non-goals: fixing anything.
- Done when: `## Findings` exists grouped High / Medium / Low, each with file:line, evidence and a one-line fix, plus a proposed ticket per group; High findings confirmed by a run or a quoted line; `git status --short -- . ':!.sdlc'` prints nothing.

## Constraints
Read-only outside `.sdlc`. Browser runs through `scripts/gate_lock.py`. No em dashes. No paid runs.
- Lane: solo because size L2 (steps.py lane)

## Findings

Swept at base 4b1be4538. Coverage: 532 rendered samples (151 fenced blocks and 182 inline-code lines across the 110 `?raw` markdown files the site renders, changelog excluded; 168 sample strings in `site/**/*.ts`; 31 `site/*.html` lines), resolved by a scratch script against every package `exports` map and the TypeScript export list of each entry (34 import statements plus every bare `@agent-ui/...` mention), and 111 parsed descriptors (attributes, parts, slots, events). Live specimen code was checked too: 1405 attribute writes on `ui-*` elements (`el('ui-x', {...})`, `setAttribute`) all name a descriptor attribute. The checker was proven to bite on a planted sample (a root-barrel `scrollFade`, a root `SHIPPED_DOMAIN_CATALOGS`, a bad traits subpath, a bogus attribute, a `ui-change` listener and a fake part were all flagged).

Clean: no sample imports `paneResize`, `scrollFade` or `rovingFocus` from the components root (T-0521, T-0526) or `SHIPPED_*_CATALOGS` from the a2ui root (T-0530); `traits-doc.ts` already teaches the subpaths. Every listener in site code is native or in the ADR-0153 set, and every descriptor `events[]` name is in the set (ui-button's native `click` aside). No rendered sample names a retired part, removed tag (`ui-app-shell`) or retired attribute (`dismissable`, `collapsed-left`, `slot="icon"` on ui-button, ui-icon `glyph`) except as a documented removal.

### High

- H1 `site/pages/getting-started.ts:190`, `:196`, `:200` (Per-control imports, the getting-started page). The filter keeps every `./controls/*` key, sheets included, so the page says "184 controls ship their own subpath today" (92 are `.css` sheets, so 92 controls) and prints lines such as `import '@agent-ui/components/controls/amount-picker.css' // registers ui-amount-picker.css`. Confirmed by running the page's own derivation against `packages/agent-ui/components/package.json`: 184 keys, 92 ending `.css`, second output line as quoted. Fix: filter `!k.endsWith('.css')` for the module list and count modules only (optionally pair each with its sheet line).
- Proposed ticket: "Getting-started per-control import list stops counting and labelling sheet subpaths as controls" (L1, site-only, one test pinning the count to module subpaths).

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

## Acceptance criteria
- `## Findings` above is grouped High / Medium / Low; every finding carries file:line, evidence and a one-line fix, and each group ends with a proposed ticket.
- H1 reproduces: `node -e "const p=require('./packages/agent-ui/components/package.json');const c=Object.keys(p.exports).filter(k=>k.startsWith('./controls/'));process.exit(c.filter(k=>k.endsWith('.css')).length>0?0:1)"` exits 0 (sheet subpaths are in the list the page counts).
- `git status --short -- . ':!.sdlc'` prints nothing.

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 4b1be4538010
- Changed: Docs-site examples sweep: ranked findings in demo samples and prose with proposed tickets
- Commits: none
- Check: 1 Findings grouped High / Medium / Low with file:line, evidence, one-line fix, and a proposed ticke...: pass
- Check: 2 H1 reproduces: pass
- Check: 3 `git status --short -- . ':!.sdlc'` prints nothing: pass
