---
id: T-0518
title: "Split separators announce their own orientation and each carries a distinct name"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L1
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
Split separators announce their own orientation (vertical for side-by-side panes) and each separator has a distinct accessible name.

## Intent
- Do: set `aria-orientation` to the opposite of `axis` in split.ts, flip the assertions in split.browser.test.ts and split.test.ts that pin the inverted value, fix the split.md contract line; name each separator from its position or leading pane (for example "Resize panel 1 of 3").
- Done when: the corrected tests fail on base and pass after; a three-pane split shows three distinct names; `npm run check` and the split jsdom and browser tests exit 0.

## Context
From the T-0517 accessibility sweep (#2322); finding copied:

1. Split separators announce the wrong orientation.
   - Where: `components/src/controls/split/split.ts:358` sets `aria-orientation` to `this.axis`; `components/src/controls/split/split.md:124` makes it the contract ("`aria-orientation` (matching `axis`)").
   - Defect: in WAI-ARIA, a separator's `aria-orientation` is the orientation of the separator itself. An `axis="horizontal"` split lays panes side by side, so its divider is vertical, yet it is announced as horizontal, and the reverse for `axis="vertical"`. AT users are told the wrong arrow axis (the control moves on Left/Right under horizontal). The repo's own `app/src/controls/super-shell/super-shell.ts:625` gets this right (side-by-side panes, `aria-orientation="vertical"`).
   - Evidence: `components/src/controls/split/split.browser.test.ts:85-88`, titled "separators are horizontal dividers", asserts `aria-orientation` is `vertical`; run in a real engine: `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/split/split.browser.test.ts -t "separators are horizontal dividers"` exit 0 (2 files, 2 passed), so the inverted value ships and is pinned. `split.test.ts:117` and `:133` pin it the same way.
   - Fix: set `aria-orientation` to the opposite of `axis` and flip the three assertions plus the split.md line.

1. Every split separator is named "Resize panel".
   - Where: `components/src/controls/split/split.ts:360`.
   - Defect: in a split with three or more panes, all separators share one name, so a screen reader user cannot tell which pair a separator resizes.
   - Fix: name each separator from its leading pane (its `aria-label` or position, for example "Resize panel 1 of 3").

## Constraints
ARIA through ElementInternals, never host attributes (AGENTS.md). Descriptor `{name}.md` changes go with the code; regenerate generated props with `scripts/generate-props.mjs` if attributes change. Browser tests through `scripts/gate_lock.py`. No em dashes.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 0e041ef4fdff
- Changed: Split separators announce their own orientation and each carries a distinct name
- Commits: none
- Check: 1 the corrected tests fail on base and pass after: pass
- Check: 2 a three-pane split shows three distinct names: pass
- Check: 3 `npm run check` and the split jsdom and browser tests exit 0: pass
- Follow-up: note: packages/agent-ui/components/src/controls/split/split.md:124... -> notes.md
