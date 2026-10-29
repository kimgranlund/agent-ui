---
id: T-0517
title: "Accessibility sweep: every control's ARIA, focus order and keyboard paths against its descriptor"
type: chore           # feature | bug | chore | spike | idea
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
A ranked list of accessibility defects across the ui-* controls: ARIA that diverges from each control's descriptor contract, roles or states set on host attributes instead of `ElementInternals`, focus order or roving-tabindex gaps, and keyboard paths a descriptor promises but the control or its tests do not deliver.

## Intent
- Do: read-only sweep of `packages/agent-ui/components/src/controls/*` and `packages/agent-ui/app/src/controls/*` against each `{name}.md` descriptor and `component-standards`; spot-check in a real engine (browser tests through `scripts/gate_lock.py`) where reading is not conclusive. Write `## Findings` to this handoff grouped High / Medium / Low, each with file:line, the defect, the evidence and a one-line fix, plus a proposed ticket title per group.
- Non-goals: fixing anything; color contrast of themes.
- Done when: `## Findings` exists in that shape; High findings were confirmed by a reading plus a run or a quoted descriptor line; `git status --short -- . ':!.sdlc'` prints nothing.

## Context
AGENTS.md: ARIA via `ElementInternals`, never host attributes; event names fixed by ADR-0153; light DOM by default.

## Constraints
Read-only outside `.sdlc`. No em dashes. No paid runs.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- `## Findings` exists with High, Medium and Low groups, each finding carrying file:line, the defect, evidence and a one-line fix, and each group a proposed ticket title.
- Each High finding cites a quoted descriptor line or a real-engine run.
- `git status --short -- . ':!.sdlc'` prints nothing.

## Findings

Method: a scripted pass over every `components` and `app` control descriptor (`aria:` role and `keyboard:` keys) against each control's transitive TypeScript sources, then a targeted read of every mismatch and of the known risk classes (separators, tablists, list ownership, focusable regions, overlay naming, host ARIA writes). The script's raw misses were nearly all platform-owned keys (`popover="auto"` and `<dialog>` Escape, native `<button>`/`<summary>` Enter and Space) or lookup-table key maps (otp-field, board-grid); those are not findings. Host ARIA writes: every `setAttribute('role'|'aria-*')` found sits on a control-created part or an author option child, never on a control's own host, except the cases below. Paths are relative to `packages/agent-ui/`. Descriptor quotes are cut before any em dash.

### High

Proposed ticket: "a11y High: fix split separator orientation, give nav-rail tablist a real tab model, give ui-list children listitem semantics"

1. Split separators announce the wrong orientation.
   - Where: `components/src/controls/split/split.ts:358` sets `aria-orientation` to `this.axis`; `components/src/controls/split/split.md:124` makes it the contract ("`aria-orientation` (matching `axis`)").
   - Defect: in WAI-ARIA, a separator's `aria-orientation` is the orientation of the separator itself. An `axis="horizontal"` split lays panes side by side, so its divider is vertical, yet it is announced as horizontal, and the reverse for `axis="vertical"`. AT users are told the wrong arrow axis (the control moves on Left/Right under horizontal). The repo's own `app/src/controls/super-shell/super-shell.ts:625` gets this right (side-by-side panes, `aria-orientation="vertical"`).
   - Evidence: `components/src/controls/split/split.browser.test.ts:85-88`, titled "separators are horizontal dividers", asserts `aria-orientation` is `vertical`; run in a real engine: `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/split/split.browser.test.ts -t "separators are horizontal dividers"` exit 0 (2 files, 2 passed), so the inverted value ships and is pinned. `split.test.ts:117` and `:133` pin it the same way.
   - Fix: set `aria-orientation` to the opposite of `axis` and flip the three assertions plus the split.md line.

2. A bare `ui-nav-rail` claims tablist semantics with no tab keyboard model.
   - Where: `app/src/controls/nav-rail/nav-rail.ts:160` sets `internals.role = 'tablist'` when every item is bare; `app/src/controls/nav-rail/nav-rail-item.ts:90` stamps `role="tab"` on each item's `<button>`.
   - Defect: the APG tabs pattern the role promises is one tab stop with arrow roving (the repo's own `components/src/controls/tabs/tabs.md:106`: "exactly the selected tab is tabindex=0; the rest are tabindex=-1"). The rail has no keydown handler, no roving tabindex and no Arrow/Home/End handling in any of `nav-rail.ts`, `nav-rail-item.ts`, `nav-rail-group.ts`, so every tab is its own Tab stop and arrows do nothing. No tab carries `aria-controls` to a `tabpanel` either.
   - Evidence: descriptor `app/src/controls/nav-rail/nav-rail.md:53` ("role: navigation | tablist   # DERIVED from item SHAPE") and its `keyboard:` block (`:57-61`) lists only the collapse trigger's Enter/Space/Escape; `grep -c Arrow` over the nav-rail sources is 0, and the only Arrow use in `nav-rail.browser.test.ts` (`:960-976`) is the composed `ui-menu` popover.
   - Fix: either wire `rovingFocus` over the bare items (vertical axis, selection on Enter or follow-focus) and document it in `keyboard:`, or drop the tablist/tab roles for bare items and use `aria-current` like the link shape.

3. `ui-list` exposes `role=list` with no `listitem` children.
   - Where: `components/src/controls/list/list.ts:50` sets `internals.role = 'list'`; nothing gives its children a `listitem` role.
   - Defect: `list` requires owned `listitem` elements (ARIA required owned elements). The descriptor relies on items that do not exist: `components/src/controls/list/list.md:65` "childRole: listitem  # the children are the list items" and "(the list does not impose them)". No control in `components` sets `listitem` except the charts and `timeline-item`. The descriptor's own example (`list.md:87-91`) puts `ui-row` children inside, and `components/src/controls/row/row.md:67` says ui-row "exposes NO ARIA role". The A2UI `List` type maps straight onto it (`a2ui/src/catalog/default/factories.ts:830`, `accessorFactory('ui-list')`), so every agent-composed List reads as a list of zero items or fails `aria-required-children`.
   - Fix: give each direct child `listitem` semantics (wrap in a part or set the role on the child), or document and gate that only listitem-carrying children are legal.

### Medium

Proposed ticket: "a11y Medium: name the table scroll region and keep it out of the tab order when it cannot scroll; forward late modal and drawer names"

1. `ui-table` scroll region is an unnamed tab stop when `label` is empty.
   - Where: `components/src/controls/table/table.ts:150-152` always sets `role="region"` and `tabindex="0"`; `:372-375` removes `aria-labelledby` when `label === ''`.
   - Defect: an unlabelled table yields a focusable, nameless region, which AT announces as a bare "region" or skips as a landmark; it is also a Tab stop even when nothing overflows. `table.md:161` frames the region as the APG accessible-overflow pattern, which assumes a name.
   - Fix: when `label` is empty, drop `role="region"` (or fall back to a default `aria-label`), and set `tabindex="0"` only while the region actually overflows.

2. `ui-modal` and `ui-drawer` forward an accessible name only once.
   - Where: `components/src/controls/modal/modal.ts:143-153` and `components/src/controls/drawer/drawer.ts:159-167` move `aria-label`/`aria-labelledby` from host to the dialog part inside `#ensureDialog()`, which returns early after the first build; neither file observes the attributes afterwards.
   - Defect: a name written after first connect (a binding, a renderer update, a reopen with a new title) stays on the host, which breaks the host-ARIA law, and never reaches the `<dialog>`, so the dialog keeps the stale name or none. Descriptor: `modal.md:63` "labelSource: aria-label / aria-labelledby   # an author accessible name is FORWARDED off the host onto the dialog part".
   - Fix: observe `aria-label`/`aria-labelledby` on the host (or expose a `label` prop) and re-forward on every change.

### Low

Proposed ticket: "a11y Low: distinct names for split separators"

1. Every split separator is named "Resize panel".
   - Where: `components/src/controls/split/split.ts:360`.
   - Defect: in a split with three or more panes, all separators share one name, so a screen reader user cannot tell which pair a separator resizes.
   - Fix: name each separator from its leading pane (its `aria-label` or position, for example "Resize panel 1 of 3").

2. `ui-pagination` writes `aria-current` as a host attribute on composed `ui-button` stops.
   - Where: `components/src/controls/pagination/pagination.ts:8-10`, `:132-138`.
   - Defect: a host ARIA attribute on another control's host. It is a sanctioned, documented exception there and works, so it is listed for the record only.
   - Fix: none needed unless the sanction is revisited; a `current` prop on ui-button would remove it.

Not findings (checked and clean): the overlay family's `aria-expanded` sync (menu, select, combo-box, popover, form-popover) follows platform toggles; combo-box `aria-activedescendant`; board-grid two-axis roving; amount-picker and color-picker drop `tabindex` when disabled; swiper single track stop with inert clones; tabs internals ARIA; disclosure native `<summary>`; table interactive parts in normal tab order.

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 833bd7dd69a1
- Changed: Accessibility sweep: ranked ARIA, focus and keyboard findings across the ui-* controls
- Commits: none
- Check: 1 `## Findings` has High, Medium and Low groups, each finding with file:line, defect, evidence and ...: pass
- Check: 2 Each High finding cites a quoted descriptor line or a real-engine run: pass
- Check: 3 `git status --short -- . ':!.sdlc'` prints nothing: pass
- Follow-up: note: .sdlc/tickets/0517-a11y-sweep/handoff.md:57 says no control in... -> notes.md
- Follow-up: note: handoff.md:64 cites table.ts:150-152 for the region and tabindex... -> notes.md
