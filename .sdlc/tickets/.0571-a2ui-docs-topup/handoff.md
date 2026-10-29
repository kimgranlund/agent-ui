---
id: T-0571
title: "A2UI docs cover the AmountPicker receipt check, Basic Image.url media format and the Basic media rows"
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
The A2UI docs also cover T-0550 (the AmountPicker receipt check, PR 2364) and T-0565 (a2ui-basic Image.url media format, PR 2368), and the catalog spec stops calling Basic Image, Video and AudioPlayer excluded.

## Intent
- Do: add T-0550's SURFACE_MISSING AmountPicker row to the spec and LLD tables T-0568 updated (agent-closed-loop, response-type-selection, a2ui-live-agent); add the a2ui-basic `Image.url` `media-src` format to `a2ui-catalog.spec.md` 5.1 and the catalog-pipeline skill reference; fix `a2ui-catalog.spec.md` 5.2 / 5.2.1 and SPEC-R10 AC1 so they match the shipped Basic Image, Video and AudioPlayer rows; regenerate generated docs with their scripts.
- Non-goals: ADRs (frozen), grammar.md, producer prompt text.
- Done when: `doc_lint` on the touched docs and `npm run check` exit 0; the report lists each doc changed.

## Context
Follow-up of T-0568 (PR 2371), whose solo listed these gaps: T-0565 and T-0550 had not merged when it ran; the catalog spec still lists Image/Video as excluded (5.2 line 266, 5.2.1) and SPEC-R10 AC1 says Basic Video/AudioPlayer are excluded. Describe the media format as hardening only.

## Constraints
No em dashes. No paid runs. Public repo: no exploit detail. If PR 2371 has not merged yet, rebase-sensitive edits may conflict; edit only lines T-0568 did not change where possible.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-29 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: ff5ebf0daa41
- Changed: A2UI docs cover the AmountPicker receipt check and the Basic Image.url media format, and the catalog spec states the shipped media rows
- Commits: none
- Check: 1 Done when: `doc_lint` on the touched docs exits 0: pass
- Check: 2 Done when: `npm run check` exits 0: pass
- Check: 3 Done when: the report lists each doc changed: pass
- Check: 4 Do: T-0550 AmountPicker row in agent-closed-loop, response-type-selection, a2ui-live-agent: pass
- Check: 5 Do: a2ui-basic Image.url media-src in catalog spec 5.1 and catalog-pipeline reference: pass
- Check: 6 Do: 5.2 / 5.2.1 and SPEC-R10 AC1 match shipped rows: pass
- Follow-up: note: .claude/docs/spec/a2ui-catalog.spec.md SPEC-R10 AC1 and the 5.2... -> notes.md
- Follow-up: note: packages/agent-ui/a2ui/src/catalog/a2ui-basic/index.test.ts:26... -> notes.md
