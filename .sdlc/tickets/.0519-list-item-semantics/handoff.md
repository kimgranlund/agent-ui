---
id: T-0519
title: "ui-list children carry listitem semantics"
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
Every direct child of a ui-list is exposed as a listitem, so role=list owns the listitem children ARIA requires.

## Intent
- Do: give each direct child listitem semantics without host attributes (for example a slotted wrapper part with the role, or a child-role mechanism the repo already uses, such as timeline-item's); update list.md (`childRole`) to match; cover A2UI `List` rendering.
- Done when: a browser test reads the accessibility tree (or computed role) and finds listitem for each child, failing on base; `npm run check`, the list tests and the a2ui catalog tests exit 0.

## Context
From the T-0517 accessibility sweep (#2322); finding copied:

3. `ui-list` exposes `role=list` with no `listitem` children.
   - Where: `components/src/controls/list/list.ts:50` sets `internals.role = 'list'`; nothing gives its children a `listitem` role.
   - Defect: `list` requires owned `listitem` elements (ARIA required owned elements). The descriptor relies on items that do not exist: `components/src/controls/list/list.md:65` "childRole: listitem  # the children are the list items" and "(the list does not impose them)". No control in `components` sets `listitem` except the charts and `timeline-item`. The descriptor's own example (`list.md:87-91`) puts `ui-row` children inside, and `components/src/controls/row/row.md:67` says ui-row "exposes NO ARIA role". The A2UI `List` type maps straight onto it (`a2ui/src/catalog/default/factories.ts:830`, `accessorFactory('ui-list')`), so every agent-composed List reads as a list of zero items or fails `aria-required-children`.
   - Fix: give each direct child `listitem` semantics (wrap in a part or set the role on the child), or document and gate that only listitem-carrying children are legal.

## Constraints
ARIA through ElementInternals, never host attributes (AGENTS.md). Descriptor `{name}.md` changes go with the code; regenerate generated props with `scripts/generate-props.mjs` if attributes change. Browser tests through `scripts/gate_lock.py`. No em dashes.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- In Chromium, the full AX tree shows a named ui-list whose unignored children are exactly one `listitem` per light child (3, then 4 after an append), with no `role` attribute on any child: `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/list/list.browser.test.ts` exits 0 (run through gate_lock.py), and the same leg failed on base 0e041ef4f (received `generic` x3).
- Each `item` part computes `display: contents` and its slot is assigned exactly its child, in Chromium and WebKit (same file).
- A2UI `List` with three `Text` children renders three `[part="item"][role="listitem"]` parts in the ui-list shadow root, children without a `role` attribute: `npx vitest run packages/agent-ui/components/src/controls/list packages/agent-ui/a2ui/src/catalog` exits 0.
- list.md `parts`, `slots`, `aria.childRole` and the Accessibility prose describe the item part; `node scripts/generate-llms-full.mjs --check` exits 0.
- `npm run check` exits 0.

## Plan review
- ruling: Kim 2026-10-28 accepted the shadow-root listitem parts as a narrow light-DOM exception for ui-list ("Merge on pass").

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 0e041ef4fdff
- Changed: ui-list children carry listitem semantics through shadow-root item parts (Kim's narrow light-DOM exception)
- Commits: none
- Check: 1 AX tree shows named ui-list with exactly one listitem per child (3, then 4), no role attribute on...: pass
- Check: 2 item part computes display:contents and its slot is assigned exactly its child, Chromium and WebKit: pass
- Check: 3 A2UI List with three Text children renders three [part=item][role=listitem], children without role: pass
- Check: 4 list.md parts/slots/aria.childRole/Accessibility describe the item part; llms-full check: pass
- Check: 5 `npm run check` exits 0: pass
- Follow-up: note: redck.py deviations printed no process deviation: lines. -> notes.md
- Follow-up: note: the Chromium AX leg returns early on WebKit no CDP Accessibility... -> notes.md
