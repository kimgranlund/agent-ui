---
id: T-0432
title: "The A2UI catalog page shows every catalog's components accurately and its display works"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-23
claimed_by: claude:a8ce3b21 2026-10-23
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
https://ui.nonoun.io/a2ui-catalog is current and accurate for every catalog in its picker (default, each domain and persona): each component is listed under the right tab with its real description (not the generic "A2UI catalog component" placeholder), its props knobs match the catalog schema, and every preview renders and responds to its knobs.

## Context
Kim 2026-10-23 screenshot: catalog `a2ui-basic--croupier`, 82 components, tabs Widget 24 / Primitive 8 / Compound 26 / Feature 5 / Input 19; the Attachment entry reads "A2UI catalog component" as its description. Tonight's changes that the page must reflect: OptionDeck single-pick (T-0419, T-0421), OptionCompare, ConfirmReceipt, the surface title scale (T-0418), DescriptionList (T-0417), Suggestions radius (T-0427). Page: site/pages/a2ui-catalog.ts, .css, .browser.test.ts.

## Constraints
Descriptions come from the existing sources of truth (descriptor `description:` for control-backed types, catalog.json or selection.json text for composites), never hand-written copies on the page. A2UI surfaces render at the widget tier. Fix display bugs at the page or the owning control; a control-level defect becomes its own ticket if it is more than a small fix.

## Done when
A browser test walks every catalog in the picker and every component and asserts a non-placeholder description, a rendered preview with non-zero size and no console error, and knobs equal to the schema's props; screenshots of a few composites (OptionDeck, OptionCompare, ConfirmReceipt, QuestionCard) at desktop and 400px are the look evidence; npm run check plus the a2ui-catalog tests pass. The report lists anything wrong that was not fixed.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Acceptance criteria
- `env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project site site/pages/a2ui-catalog.browser.test.ts` exits 0: it picks every catalog option by a real trigger and option click, asserts each type's description is present and is not the generic kind label, each live preview lays out a box (a closed overlay after its `open` knob), the default catalog's knob labels equal its schema props and a text knob edit re-renders the root, and no console error over the run. The non-default catalogs are seed renders with no knob rail (T-0064 design), so their knobs are not walked.
- `env -u NODE_OPTIONS npx vitest run site/lib/a2ui-type-description.test.ts site/lib/a2ui-catalog-selector.test.ts site/lib/component-preview-catalog.test.ts` exits 0.
- `npm run check` exits 0.
- Look evidence: the eight PNGs under this ticket's `shots/` (OptionDeck, OptionCompare, ConfirmReceipt, QuestionCard at 1400 and 400 px).

## Outcome

2026-10-23 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: b1646add4286
- Changed: The A2UI catalog page switches catalogs, shows each type's real description, lists the hospitality catalogs and previews ConfirmReceipt with a sample
- Commits: none
- Check: 1 browser walk: pass
- Check: 2 unit tests: pass
- Check: 3 npm run check: pass
- Check: 4 look evidence: pass
- Follow-up: note: builder-reported unfixed items not criteria: about 30 descriptors... -> notes.md
