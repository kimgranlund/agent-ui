## Task goal
Make the Croupier blackjack preset create a new A2UI surface for each round, stacked as a new chat bubble below the previous one, with the chip bankroll seeded onto each new surface from the last settlement; the action buttons render as a footer Row. A click whose surface marks `context.newRound: true` (Deal again) takes the fresh-bubble path in `#resumeTargetFor`; Hit and Stand still update in place.

## Step 1: Verify the already-built change (PR #1794)
level: L2
guard timeout: 300

### Do
The change is already committed on this branch (`HEAD`, PR #1794). Verifier L2 found one defect (see `## Previous attempt`). Fix only that, in `site/pages/agent-admin-presets.ts`, as an uncommitted edit on top of HEAD; do not commit, push, or touch any other file. Keep `seedVersion: 6`, the `"context":{"newRound":true}` phrase, and the footer Row wording so the other criteria still pass. The ADR-0129 amendment is not part of this step.

### Acceptance criteria
- `git diff --name-only HEAD~1..HEAD | sort | diff - <(printf '%s\n' packages/agent-ui/app/src/controls/agent-admin/agent-admin.test.ts packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts site/pages/agent-admin-presets.ts)`
- `grep -qF '"context":{"newRound":true}' site/pages/agent-admin-presets.ts`
- `! grep -q "ONE persistent game surface" site/pages/agent-admin-presets.ts`
- `grep -q "seedVersion: 6, // one surface per round" site/pages/agent-admin-presets.ts`
- `grep -q "a Row of the action Buttons" site/pages/agent-admin-presets.ts`
- `grep -q "if (isNewRoundAction(message)) return undefined" packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts`
- (guard) `npx vitest run packages/agent-ui/app/src/controls/agent-admin/agent-admin.test.ts site/pages/agent-admin-presets.test.ts`
- (guard) `npx vitest run site/pages/agent-admin-app.test.ts site/pages/persona-library-pattern.test.ts packages/agent-ui/app/src/controls/agent-admin/agent-roster-source.test.ts`
- (guard) `npm run check`

## Previous attempt
Verifier L2 failed the guard `npx vitest run ... site/pages/agent-admin-presets.test.ts`: 2 tests failed (`all fourteen surfaceStyle texts are modality-neutral` and `every persona's ASSEMBLED prompt-section list is clean`) because the new Croupier `surfaceStyle` at `site/pages/agent-admin-presets.ts:159` says "FRESH surfaceId (table-1, ...)" and `prompt-lint.ts:73` lists `surfaceId` as a modality word. At `HEAD~1` the same file passes 15 of 15, so this is not an inherited red. Reword the `surfaceStyle` to drop the literal "surfaceId" (for example "a FRESH surface id" or "a fresh table id (table-1, table-2, ...)") and check that the lint accepts the replacement. The `round-loop` skill content near line 202 also says "surfaceId"; reword it too for consistency. Then `npx vitest run site/pages/agent-admin-presets.test.ts` must be 15 of 15.
