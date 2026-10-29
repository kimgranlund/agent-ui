---
id: T-0520
title: "The table scroll region is named or not a tab stop, and modal and drawer forward late accessible names"
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
An unlabelled ui-table scroll region is neither a nameless region nor a tab stop when it does not overflow, and ui-modal and ui-drawer forward accessible-name changes made after first connect.

## Intent
- Do: in table.ts drop `role=region` when `label` is empty (or give a default name) and set `tabindex=0` only while the region overflows; in modal.ts and drawer.ts re-forward `aria-label`/`aria-labelledby` from host to the dialog part on every change, leaving none on the host; update table.md and modal.md/drawer.md where they describe this.
- Done when: failing-first browser tests cover an unlabelled non-overflowing table, an overflowing one, and a modal and drawer renamed after open; `npm run check` and those controls' tests exit 0.

## Context
From the T-0517 accessibility sweep (#2322); finding copied:

1. `ui-table` scroll region is an unnamed tab stop when `label` is empty.
   - Where: `components/src/controls/table/table.ts:150-152` always sets `role="region"` and `tabindex="0"`; `:372-375` removes `aria-labelledby` when `label === ''`.
   - Defect: an unlabelled table yields a focusable, nameless region, which AT announces as a bare "region" or skips as a landmark; it is also a Tab stop even when nothing overflows. `table.md:161` frames the region as the APG accessible-overflow pattern, which assumes a name.
   - Fix: when `label` is empty, drop `role="region"` (or fall back to a default `aria-label`), and set `tabindex="0"` only while the region actually overflows.

2. `ui-modal` and `ui-drawer` forward an accessible name only once.
   - Where: `components/src/controls/modal/modal.ts:143-153` and `components/src/controls/drawer/drawer.ts:159-167` move `aria-label`/`aria-labelledby` from host to the dialog part inside `#ensureDialog()`, which returns early after the first build; neither file observes the attributes afterwards.
   - Defect: a name written after first connect (a binding, a renderer update, a reopen with a new title) stays on the host, which breaks the host-ARIA law, and never reaches the `<dialog>`, so the dialog keeps the stale name or none. Descriptor: `modal.md:63` "labelSource: aria-label / aria-labelledby   # an author accessible name is FORWARDED off the host onto the dialog part".
   - Fix: observe `aria-label`/`aria-labelledby` on the host (or expose a `label` prop) and re-forward on every change.

## Constraints
ARIA through ElementInternals, never host attributes (AGENTS.md). Descriptor `{name}.md` changes go with the code; regenerate generated props with `scripts/generate-props.mjs` if attributes change. Browser tests through `scripts/gate_lock.py`. No em dashes.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- An unlabelled ui-table scroll part carries no `role` and, while nothing overflows, no `tabindex`; an overflowing one carries `tabindex="0"`, and a labelled one is a `role="region"` named by its caption; ui-modal and ui-drawer forward an `aria-label`/`aria-labelledby` written after first connect onto the dialog part and keep none on the host. The jsdom and browser suites of the three controls exit 0: `npx vitest run packages/agent-ui/components/src/controls/table packages/agent-ui/components/src/controls/modal packages/agent-ui/components/src/controls/drawer` and `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.39.0/scripts/gate_lock.py run --need compute_units=2 --nice -- npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/table packages/agent-ui/components/src/controls/modal packages/agent-ui/components/src/controls/drawer`
- table.md, modal.md and drawer.md describe the new behaviour, and the standing gate exits 0: `npm run check`

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 0e041ef4fdff
- Changed: An unlabelled table region is not a nameless tab stop, and modal and drawer forward late accessible names
- Commits: none
- Check: 1 Unlabelled ui-table scroll part has no role and (not overflowing) no tabindex; overflowing has ta...: pass
- Check: 2 table.md, modal.md and drawer.md describe the new behaviour, and `npm run check` exits 0: pass
- Follow-up: note: the table tabindex decision lives in #syncFade table.ts:396-406... -> notes.md
