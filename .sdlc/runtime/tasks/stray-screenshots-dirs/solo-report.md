# Solo report: Lane D (T-0228, T-0226, T-0227, T-0224)

Commits (base 73b567b2, local, not pushed): 4878de4b T-0228, 4f247373 T-0226, 568b203b T-0227, b6a9632f T-0224, d37bd3b5 acceptance criteria.

## Files changed
- T-0228: packages/agent-ui/a2ui/src/registry/selection.test.ts (scan reads only folders with selection.json, plus a planted `__screenshots__` case), .claude/skills/seat-map/SKILL.md (merge-queue trap names the removal command). `.gitignore` already had `**/__screenshots__/`.
- T-0226: packages/agent-ui/a2ui/src/renderer/validate.ts (each epoch replays its batches through applyComponentBatch over the seed), component-merge.ts header, agent/surface-seeds.test.ts (seeded and unseeded single-payload cases with real-renderer agreement).
- T-0227: packages/agent-ui/app/src/controls/agent-admin/agent-admin-click-turn.browser.test.ts (poison is now a dangling child `root->ghost`).
- T-0224: tools/agent/chat-validation.ts (PERSONA_SYSTEM_MAX_CHARS, validatePersonaSystem), dev-proxy-plugin.ts (400 + rejected trace line), worker/index.ts (400), prompt-budget-matrix.ts comment, site/lib/admin-live-runner.ts (4xx reason in the chat error), new src/live-agent/persona-cap.test.ts, site/lib/admin-live-runner.test.ts.

## Checks
- `npm run check` exit 0
- `npx vitest run packages/agent-ui/a2ui/src/registry/selection.test.ts` exit 0 (red with the old filter: 1 failed)
- `npx vitest run packages/agent-ui/a2ui/src/agent/surface-seeds.test.ts` exit 0 (red with old validate.ts: 2 failed)
- `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/app/src/controls/agent-admin/agent-admin-click-turn.browser.test.ts` exit 0 (red on base; red again with the budget halt disabled)
- `npx vitest run packages/agent-ui/a2ui/src/live-agent/persona-cap.test.ts site/lib/admin-live-runner.test.ts` exit 0 (red with the old sources: 3 failed)
- `npx vitest run packages/agent-ui/a2ui site/lib packages/agent-ui/app/src/controls/agent-admin` exit 0 (293 files)
- `npx vitest run --project scripts scripts/e2e-admin/probe/replays/` exit 0 (22 replays, none flipped by T-0226)

## Open
- Worker leg of T-0224 is structural (handleProduce is not importable under vitest), as chat-route.test.ts does.
- The dev proxy checks the persona after the key and dispatch checks, so a keyless host still answers 503 first.

verify: needed
