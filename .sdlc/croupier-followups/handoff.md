---
id: T-0194
title: "A surface turn must carry a human reply line (Sonnet 5.5 greeting ships only 'Emitted N A2UI message(s)')"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: [T-0172]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
T-0172 shipped items 1, 2 and 4 of the original list (settle check, plain-button picker plus lone-button-frame lint, probe click-target). Left: on Sonnet 5.5 a Croupier "hello" turn still calls render_surface with no text, so the chat shows "Emitted 2 A2UI message(s): createSurface, updateComponents." (live probe 2026-10-14 about 23:10, after T-0172 changed the tool description).

## Intent
- Do: make a text line on every surface turn reliable, not just requested: e.g. a required `reply` field in the structured render_surface input (one short line), or a repair round when a surface turn has no text, or a producer-side fallback that asks the model once. Pick the least costly that works on Sonnet 5.5 and Haiku 5.5; never show the "Emitted N A2UI message(s)" fallback to a guest (keep it in the activity details). Add a chat:probe check `reply-text` (a surface turn must have visible reply text) with a seeded failing fixture.
- Done when: `npm run check` exit 0; live `npm run chat:probe -- --agent croupier --say hello` on Haiku 5.5 and Sonnet 5.5 shows reply text (conductor runs live); a2ui and probe tests exit 0.

## Context
- Commit off origin/main after T-0172 merges; never push. Keys only through the dev proxy.

## Constraints
- No em dashes.

## Acceptance criteria
- `npm run check` exits 0.
- `npx vitest run --project packages packages/agent-ui/a2ui packages/agent-ui/app/src/controls/conversation` exits 0: `render_surface` requires `reply`; a tool round with no text ships the trimmed `reply` as the note and channel text wins over it; a step-mode turn with no reply text shows no tally in the bubble and one `data-activity="tally"` strip row.
- `npm run chat:probe -- selftest` exits 0: `reply-text` is in `CHECK_NAMES`, the canned green records exercise it, and `seeded-no-reply.json` fails exactly `reply-text` offline.
- `npx vitest run --project scripts scripts/e2e-admin/probe` exits 0.
- Live (conductor, key needed): `npm run chat:probe -- --agent croupier --say hello` on Haiku 5.5 and Sonnet 5.5 passes `reply-text`.
