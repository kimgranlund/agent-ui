---
id: T-0447
title: "Agent authoring S5: natural-language edit from any chat"
type: feature        # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L4             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-24
claimed_by: claude:a8ce3b21 2026-10-24
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
An edit to an agent config asked in natural language from any chat lands as a reviewable, revertible change, through a consumption path that the S5 design intake rules.

## Context
Roadmap candidate arc 3. S5 is parked-IN: the STORE-IDENTITY fence (agent-authoring LLD §15, `.claude/docs/lld/agent-authoring-flow.lld.md`) blocks patching from arbitrary chat with no ruled consumption path. Agent content overlays (T-0161) store each edit as a diff over a seed, and the compiler (T-0163) traces each resolved value to its layer. Decomposition: `.claude/docs/decompositions/agent-authoring-flow.decomp.md`.

## Constraints
ADRs are frozen. The STORE-IDENTITY fence holds until Kim rules the consumption path. Model-read text follows the debate rule (Opus architect plus fable plan-reviewer). The design intake comes first; nothing is built before Kim rules it.

## Done when
- A design intake names the consumption path with rejected alternatives, and Kim rules it.
- The build lands per the ruled plan with an independent verifier.
- Lane: full because size L4, a design intake (Opus architect plus fable plan-reviewer, the debate rule) before any build

## Rulings
Kim, 2026-10-24, on the architect intake (`architect-L1.md`) after the fable plan review:
- F1: an unarmed Co-pilot's first message arms an edit session over the active agent; new agents come only from the roster's New agent item (supersedes the GH #666 first-message-mints entry).
- F2: a host-side `/edit <text>` prefix in Chat hands off to Co-pilot, built last and cuttable; the user's `/edit` bubble stays in the Chat transcript.
- F3: apply live, then Undo on the receipt. F4: undo records are session-scoped and drop with the Co-pilot transcript. F5: a team declaration in an edit session is log-only.
- `SURFACE_AUTHORING_KEY` is dropped from admission in edit sessions only; generate mode stays as shipped.
- Plan review gaps for the planner: the edit-session prompt section needs a mechanism (code-authored beside `vocabularySection()` or a content-schema change), the inertness proof is byte-equality of the generate-mode composed Builder prompt with the `BUILDER_DIGEST` row recaptured, and each undo record needs a per-turn key (not the receipt text).

## Outcome

2026-10-24 · lane: full L4 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 8c4b9fe101bc
- Changed: Agent authoring S5: the Co-pilot edits the active agent from a natural-language ask, with Undo per receipt and a /edit handoff from Chat
- Commits: none
- Check: step-1#1 (red) `npx vitest run --project packages packages/agent-ui/app/src/controls/agent-admin/persona-e...: pass
- Check: step-1#2 (red) `npx vitest run --project packages packages/agent-ui/app/src/controls/agent-admin/agent-adm...: pass
- Check: step-1#3 (red) `grep -qF "deny?: readonly string[]" packages/agent-ui/app/src/controls/agent-admin/persona...: pass
- Check: step-1#4 (red) `grep -qF "onEditRequest(" packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts` e...: pass
- Check: step-1#5 (red) `grep -q "name: authoringMode" packages/agent-ui/app/src/controls/agent-admin/agent-admin.m...: pass
- Check: step-1#6 (red) `grep -q "receipt-undo" packages/agent-ui/app/src/controls/agent-admin/agent-admin.md` exits 0: pass
- Check: step-1#7 (guard) `grep -qF "if (fenced && gateOn && target !== undefined) {" packages/agent-ui/app/src/con...: pass
- Check: step-1#8 (guard) six-file vitest run (agent-admin-authoring, persona-patch, agent-overlay, follow-the-chan...: pass
- Check: step-1#9 (guard) diff-scope `test -z "$( ... | grep -vE '^packages/agent-ui/app/src/controls/agent-admin/'...: pass
- Check: step-2#1 (red) `npx vitest run --project site site/pages/agent-admin-edit-session.test.ts` exits 0: pass
- Check: step-2#2 (red) `! grep -qF "sha256:f68026d14f91395bf3f2861e45bb8ebdfb75a6fc9f4341074f83a983ec8d164a" site/...: pass
- Check: step-2#3 (red) `grep -qF "export function editSessionSection" site/pages/agent-admin-presets.ts` exits 0: pass
- Check: step-2#4 (red) `grep -qF "admin.onEditRequest(" site/pages/agent-admin-app.ts` exits 0: pass
- Check: step-2#5 (guard) `npx vitest run --project site site/pages/agent-admin-app.test.ts site/pages/agent-admin-...: pass
- Check: step-2#6 (guard) `node scripts/generate-agent-content.mjs --check` exits 0: pass
- Check: step-2#7 (guard) scope guard `test -z "$( { git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc'; ...: pass
- Check: step-3#1 (red) handoff test file exits 0: pass
- Check: step-3#2 (red) `grep -qF "EDIT_HANDOFF_PREFIX" agent-admin.ts` exits 0: pass
- Check: step-3#3 (red) ``grep -qF '`/edit <text>`' agent-admin.md`` exits 0: pass
- Check: step-3#4 (guard) authoring and agent-admin tests exit 0: pass
- Check: step-3#5 (guard) scope guard exits 0: pass
- Check: step-4#1 `grep -qF "T-0447"` on the LLD: pass
- Check: step-4#2 `grep -qF "T-0447"` on the decomp: pass
- Check: step-4#3 `grep -qF "T-0447"` on roadmap.md: pass
- Check: step-4#4 `grep -qiF "edit session"` on agent-model.md: pass
- Check: step-4#5 `npm run check`: pass
- Check: step-4#6 agent-admin vitest folder: pass
- Check: step-4#7 site pages + sitemap vitest: pass
- Check: step-4#8 scope guard: pass
- Deviation: step-2: process deviation: red-checkpoint: retrospective: attempt 47a52d6d2e4643f2b78bc4f9ea394be0, handoff sha256 3b210b4bcc8b, 4 of 4 (red) criteria without a pre-edit red control: `npx vitest run --project site site/pages/agent-admin-edit-session.t...`; `! grep -qF "sha256:f68026d14f91395bf3f2861e45bb8ebdfb75a6fc9f434107...`; `grep -qF "export function editSessionSection" site/pages/agent-admi...`; `grep -qF "admin.onEditRequest(" site/pages/agent-admin-app.ts`
- Deviation: step-3: process deviation: red-checkpoint: retrospective: attempt 1cbfe9d62b6c4380a4a6f5441f27f6b3, handoff sha256 f9a4e53bc1c0, 2 of 2 (red) criteria without a pre-edit red control: `npx vitest run --project packages packages/agent-ui/app/src/control...`; `grep -qF "EDIT_HANDOFF_PREFIX" packages/agent-ui/app/src/controls/a...`
- Deviation: step-4: process deviation: red-checkpoint: retrospective: attempt bcdccfcbf044496b9d477bc5e5e4ec5e, handoff sha256 0bdb226b8077, 4 of 4 (red) criteria without a pre-edit red control: `grep -qF "T-0447" .claude/docs/lld/agent-authoring-flow.lld.md`; `grep -qF "T-0447" .claude/docs/decompositions/agent-authoring-flow....`; `grep -qF "T-0447" .claude/docs/roadmap.md`; `grep -qiF "edit session" .claude/docs/references/agent-model.md`
- Follow-up: decide: packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts:3168... -> notes.md
- Follow-up: decide: packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts:2830... -> notes.md
- Follow-up: note: agent-admin.ts:2832-2834 adds one thing the Do did not call for... -> notes.md
