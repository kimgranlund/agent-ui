---
id: T-0169
title: "Remove dead lint plumbing: adr_ratify, docs-grammar S8, census lane code, ADR wording in gates, [scale]/[density] bridge"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: [T-0152, T-0159]  # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Gates carry no code for finished campaigns or the retired ADR workflow.

## Intent
- Do:
  1. Delete `scripts/adr_ratify.py`, its test, and its `check:scripts` entry (`package.json`); update `doc-standards` `gates-and-citation-law.md` §5.
  2. `site/lib/docs-grammar.test.ts` S8 (ADR numbering contiguity, `KNOWN_GAPS`, about :230-258): replace with a frozen-set snapshot (the ADR folder never changes) or delete.
  3. `scripts/foundations-census.mjs` lane plumbing (`LANES`, `PACKAGE_LANES`, `laneOf`, `reasonFor`, about :33-67) and `SCALE_TO_TIER` in `scripts/lib/foundations-rules.mjs`: delete if nothing reads them; derive `DERIVED` from the tokens `generate-foundations` emits instead of a hand list.
  4. ADR wording in gates: `sizing-gates.test.ts` ("extended only by ADR" lists) and `dogfood-rules.json` `adr` fields become `source` (ticket or reference doc); derive `WHOLE_SHAPE_FLOORS` from descriptors if practical.
  5. Retire the `[scale]` / `[density]` bridge (deprecated for one release by ADR-0245; T-0159 removes the last producer teaching): the bridge CSS, `theme-provider` props, `foundations.test.ts:99-121`, `foundations.browser.test.ts:146`, the 16 `foundations-alias` markers. Confirm no consumer reads them first (rg across packages and site).
- Done when: `npm run check` exit 0; `npm test` for touched folders exit 0; foundations browser tests exit 0 in both engines; `rg -n "\[scale\]|\[density\]|adr_ratify" packages site scripts` returns only changelog or frozen-history lines.

## Context
- Lint audit 2026-10-14. Start after T-0152 and T-0159 (both touch the bridge or producer). Commit locally, never push.

## Constraints
- No em dashes. Generated files only through their scripts.

## Acceptance criteria
- `npm run check` exits 0.
- `npx vitest run packages/agent-ui/components packages/agent-ui/shared packages/agent-ui/icons site/lib packages/agent-ui/a2ui/src/agent` exits 0.
- `npx vitest run --config vitest.browser.config.ts --project packages-rest packages/agent-ui/shared/src/tokens/foundations.browser.test.ts` exits 0 in chromium and webkit.
- `node scripts/foundations-census.mjs --gate` exits 0 with an empty allowlist: no unmarked `[scale]` / `[density]` / ui-icon `glyph` use in code (comments blanked).
- `git ls-files scripts/adr_ratify.py scripts/adr_ratify_test.py` prints nothing, and `package.json` `check:scripts` no longer names them.
- `site/lib/docs-grammar.test.ts` has no `KNOWN_GAPS` set; S8 is listed as RETIRED in its header.
- `scripts/foundations-census.mjs` defines no `LANES`, `PACKAGE_LANES`, `laneOf` or `reasonFor`.
- `foundations-bridge.gen.css` and `foundations.gen.css` carry no `[scale=` or `[density=` selector, and `node scripts/generate-foundations.mjs --check` exits 0.
- `ui-theme-provider` props are exactly `scheme`, `theme`; `ui-icon` props are exactly `symbol`, `label`.
- `scripts/dogfood-rules.json` rows carry `source`, never `adr`.
