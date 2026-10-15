---
id: T-0152
title: "Page root moves to product / md (controls 24 / 32 / 40)"
type: feature        # feature | bug | chore | spike | idea
status: done
size: L3
priority: P1
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-14: "product md should be the pages default". The page root moves from product / sm (n 5 / 6 / 7, heights 20 / 24 / 28) to product / md (n 6 / 8 / 10, heights 24 / 32 / 40; body 13 / 15 / 17, control type 12 / 14 / 16). Margins, gutters and radii follow n. The A2UI canvas stays widget / md (24 at md) unless Kim rules otherwise; report how it sits next to 32px page controls.

## Scope (one brief paragraph, per the Inner loop rule)
Work as T-0120 did for the shrink. Change ROOT_INPUTS in scripts/generate-foundations.mjs to { tier: 'product', scale: 'md' } and regenerate foundations.gen.css and the bridge by script; the vendored scale.mjs stays byte for byte (its sha pin unchanged). Record it as ADR-0245 Amendment 8 (append-only) with the new root table, and repair the records the change makes stale in the same change: CLAUDE.md Inner loop line ("Controls take the library ramp (sm 24 / md 28 / lg 32 px...)" is already stale; write the new ramp), AGENTS.md if it names px, geometry.md, geometry-sizing-spec.md, tokens.md, derive.mjs and derive.out.md (a new section). The local glyphBox() floor and the field outline role stay. Land the production change and get npm run check, census and probe --strict green; then run the unit suite and the six browser shards once, each in the foreground through gate_lock.py (never wait on a background monitor), and write .sdlc/0152-root-product-md/repin-list.md (tracked, grouped by census lane, law checks called out) instead of re-pinning the fleet yourself; I fan out the re-pin lanes. Then shoot before (origin/main) and after screenshots of the docs pages button, text-field, card, select, tabs, table, a2ui-catalog, agent-admin and the a2ui-chat page at 400 and 1000, light and dark, with one labelled side-by-side contact sheet per theme, viewed, not committed. One-line progress message after each major step. Commit locally, do not push, no em dashes.

## Closed

2026-10-14: merged as PR #1969
