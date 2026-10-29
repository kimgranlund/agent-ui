---
id: T-0521
title: "A bare ui-nav-rail delivers the keyboard model its tablist role promises, or drops the role"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A bare ui-nav-rail either delivers the APG tabs keyboard model its tablist/tab roles promise (one tab stop, arrow roving, Home/End), or stops claiming those roles.

## Intent
- Do: read nav-rail.md, tabs.md and the rovingFocus trait; pick the option the descriptors and precedent support (wire `rovingFocus` vertically over bare items, or move bare items to the navigation/aria-current shape the link shape uses) and state why in the report; if the descriptors leave it genuinely open, stop and report `blocked` with the two options for Kim. Update nav-rail.md `keyboard:` and `aria:` to match.
- Done when: a failing-first browser test proves the chosen model (arrow keys move focus and only one tab stop, or no tablist role); `npm run check` and the nav-rail tests exit 0.

## Context
From the T-0517 accessibility sweep (#2322); finding copied:

2. A bare `ui-nav-rail` claims tablist semantics with no tab keyboard model.
   - Where: `app/src/controls/nav-rail/nav-rail.ts:160` sets `internals.role = 'tablist'` when every item is bare; `app/src/controls/nav-rail/nav-rail-item.ts:90` stamps `role="tab"` on each item's `<button>`.
   - Defect: the APG tabs pattern the role promises is one tab stop with arrow roving (the repo's own `components/src/controls/tabs/tabs.md:106`: "exactly the selected tab is tabindex=0; the rest are tabindex=-1"). The rail has no keydown handler, no roving tabindex and no Arrow/Home/End handling in any of `nav-rail.ts`, `nav-rail-item.ts`, `nav-rail-group.ts`, so every tab is its own Tab stop and arrows do nothing. No tab carries `aria-controls` to a `tabpanel` either.
   - Evidence: descriptor `app/src/controls/nav-rail/nav-rail.md:53` ("role: navigation | tablist   # DERIVED from item SHAPE") and its `keyboard:` block (`:57-61`) lists only the collapse trigger's Enter/Space/Escape; `grep -c Arrow` over the nav-rail sources is 0, and the only Arrow use in `nav-rail.browser.test.ts` (`:960-976`) is the composed `ui-menu` popover.
   - Fix: either wire `rovingFocus` over the bare items (vertical axis, selection on Enter or follow-focus) and document it in `keyboard:`, or drop the tablist/tab roles for bare items and use `aria-current` like the link shape.

## Constraints
ARIA through ElementInternals, never host attributes (AGENTS.md). Descriptor `{name}.md` changes go with the code; regenerate generated props with `scripts/generate-props.mjs` if attributes change. Browser tests through `scripts/gate_lock.py`. No em dashes.
- Lane: solo because size L2 (steps.py lane)

## Plan review
- scope widened: Kim 2026-10-28 approved publishing rovingFocus as a new `@agent-ui/components/traits/roving-focus` subpath in this ticket (root barrel would break the foundation size budget, 8427 vs 7680 B gz). In scope: packages/agent-ui/components/package.json, scripts/measure-size.mjs, packages/agent-ui/components/src/controls/tree-shake.test.ts, .claude/docs/references/component-packaging.md, site/pages/traits-doc.ts, plus the nav-rail files. Decision already made: keep tablist/tab and deliver the APG keyboard (ADR-0130 cl.4, SPEC-R3 AC2). The first attempt report is at .sdlc/runtime/tasks/0521-nav-rail-tab-model/0521-solo-L2.attempt1.md; its red tests are in the tree.

## Acceptance criteria
- A bare rail is one tab stop on the selected tab, its tablist is vertical, ArrowUp/ArrowDown (wrapping across groups), Home and End rove real focus, and only Enter commits (the `[1a] T-0521` describe, red before the change), and the rest of the nav-rail browser suite holds, in both engines: `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.39.0/scripts/gate_lock.py run --need compute_units=2 --nice -- npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/app/src/controls/nav-rail/nav-rail.browser.test.ts` exits 0.
- The nav-rail jsdom tests, the components tree-shake test (with its new `traits/roving-focus` leaf block) and the trait's own tests pass: `npx vitest run packages/agent-ui/app/src/controls/nav-rail packages/agent-ui/components/src/controls/tree-shake.test.ts packages/agent-ui/components/src/traits/roving-focus.test.ts --exclude '**/*.browser.test.ts'` exits 0.
- The standing gate passes: `npm run check` exits 0.
- `@agent-ui/components/traits/roving-focus` is a declared export in `packages/agent-ui/components/package.json`, has a budgeted row in `scripts/measure-size.mjs` that reports within budget, a row in `.claude/docs/references/component-packaging.md` and a section on `site/pages/traits-doc.ts`; `nav-rail.md` `aria:` and `keyboard:` describe the tablist orientation, the one tab stop, Arrow/Home/End and manual activation. (`node scripts/measure-size.mjs` exits 1 on the base sha already, from rows this ticket does not touch, so it is read, not gated.)

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 0e041ef4fdff
- Changed: A bare ui-nav-rail is one tab stop with vertical arrow roving, through the new @agent-ui/components/traits/roving-focus subpath
- Commits: none
- Check: 1 Bare rail one tab stop, vertical tablist, Arrow/Home/End roving, only Enter commits; nav-rail bro...: pass
- Check: 2 nav-rail jsdom tests, tree-shake test (roving-focus leaf block) and trait tests: pass
- Check: 3 Standing gate: pass
- Check: 4 Published subpath, size row, packaging row, traits-doc section, nav-rail.md aria/keyboard: pass
- Follow-up: note: site/lib/site-manifest.json and site/public/llms.txt still say... -> notes.md
