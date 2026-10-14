---
id: T-0159
title: "Agent-admin presets and producer: retire [scale]/[density] teaching, fix preset drift, gate preset prose against the live catalog"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0152]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The a2ui producer and the agent-admin presets teach only current concepts (ADR-0245 geometry, the live catalog), and a test keeps preset prose from drifting from the catalog again. Kim chose "one lane + new gate", 2026-10-14.

## Intent
- Do:
  1. `packages/agent-ui/a2ui/src/agent/prompts/genui-dogfood-teaching.md:32-34` teaches ancestor `[scale]` and `[density]`, retired by ADR-0245 (cut 1546ed04, #1932). Rewrite to `data-tier` / `data-scale` (the A2UI canvas sits at widget / md). Recapture `live-agent/prompt-equivalence.baseline.json` only through the deliberate flow in skill `a2ui-prompt-authoring`.
  2. Regenerate `dogfood-fleet.gen.ts` (`node scripts/generate-agent-assets.mjs`) so the `ui-theme-provider` line (now :83) advertises `data-tier` / `data-scale`, not scale / density; fix the generator source if the descriptor is the stale input.
  3. `site/pages/agent-admin-presets.ts:217` Croupier `game-hud` skill contradicts `game-table-chrome` (204-211): for blackjack the CardTable owns bankroll, bet, status. Make them agree.
  4. `agent-admin-presets.ts:551` Quizmaster `surfaceStyle` names `QuestionCard`; persona prose is modality-neutral (header 81-83, ADR-0138). Reword.
  5. `site/pages/agent-admin-libraries.ts:109` `body/sm` is not a Text variant; use `caption`.
  6. `agent-admin-presets.ts:482` Stylist promises spacing and size tiers but teaches no `Ladder`; add a Ladder idiom to its skill or drop the promise.
  7. `hotel-booking-form` (`agent-admin-libraries.ts:96-100`) and `booking-flow` (194-199) teach a hand-built Card + Calendar form; the Restaurant still seeds it. Point them at `BookingForm` (date fields are `ui-text-field type=date`, T-0135) or record why the carve-out stays.
  8. Comment-only vocabulary: "Author" (presets.ts:1110, agent-admin.ts comment hits) -> Co-pilot; bare "harness" (presets.ts:25, 82) -> a2ui producer.
  9. `packages/agent-ui/app/src/controls/agent-admin/prompt-lint.ts:31-58` `COMPOUND_CATALOG_TYPES` is a frozen 2026-08-04 list missing 16 default-catalog compounds and the persona-fragment types. Derive it from the catalogs (or a generated list) instead of a hand list.
  10. New gate: a test that extracts catalog type names and Text-style variant claims from preset and library prose (skills, workflows, library packs, surfaceStyle) and checks each against the live catalog.json files and their enums; seed negative controls (a fake type, `body/sm`) that must fail. Prefer extending `site/pages/agent-admin-presets.test.ts` or `site/lib/agent-manifest/` over a new harness.
- Non-goals: new presets, offering ServiceCard (note it), sandbox CSS in genui-packs.
- Done when: `npm run check` exit 0; `site/pages/agent-admin-presets.test.ts`, `site/lib/agent-manifest`, `site/lib/capability-registry.test.ts`, `packages/agent-ui/a2ui/src/live-agent`, `packages/agent-ui/app/src/controls/agent-admin` tests exit 0 (manifest digests refreshed with `AGENT_MANIFEST_WRITE=1` where content changed); the new gate fails on each seeded negative control.

## Context
- Audit 2026-10-14 (read-only, HEAD 305540bd) found the items above; the presets themselves are otherwise current.
- Start after T-0152 (product / md root) lands on main, off fresh origin/main. Commit locally, never push.
- Run heavy tests through `gate_lock.py run` in the foreground; never wait idle on a background monitor.

## Constraints
- Never hand-edit `*.gen.ts`, `assets.gen.ts`, or the prompt-equivalence baseline outside its flow. No em dashes.

## Acceptance criteria
verifier: L3
- `npm run check` exits 0.
- `npx vitest run site/pages/agent-admin-presets.test.ts` exits 0; its T-0159 block asserts the planted `FooWidget` and `Text (body/sm)` claims are flagged and `BookingForm` is unbacked outside the concierge scope.
- `npx vitest run site/lib/agent-manifest` exits 0.
- `npx vitest run site/lib/capability-registry.test.ts` exits 0.
- `npx vitest run packages/agent-ui/a2ui/src/live-agent` exits 0.
- `npx vitest run packages/agent-ui/app/src/controls/agent-admin` exits 0.
- `! grep -q "ui-sm" packages/agent-ui/a2ui/src/agent/prompts/genui-dogfood-teaching.md` exits 0.
- `grep '"ui-theme-provider"' packages/agent-ui/a2ui/src/agent/dogfood-fleet.gen.ts | grep data-tier | grep -v 'scale: enum'` exits 0.
