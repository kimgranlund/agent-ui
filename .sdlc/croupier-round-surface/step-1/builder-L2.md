<!-- role=builder level=L2 model=opus effort=low -->
## Status
done

## Changes
- `site/pages/agent-admin-presets.ts`: in the Croupier `surfaceStyle` (line 159), "FRESH surfaceId" now reads "FRESH table id". In the `round-loop` skill content (line 202), both "surfaceId" mentions now read "table id". The edit is uncommitted on top of HEAD.

## Checks
- Changed-file list check (`git diff --name-only HEAD~1..HEAD ...`): exit 0
- `grep -qF '"context":{"newRound":true}' ...`: exit 0
- `! grep -q "ONE persistent game surface" ...`: exit 0
- `grep -q "seedVersion: 6, // one surface per round" ...`: exit 0
- `grep -q "a Row of the action Buttons" ...`: exit 0
- `grep -q "if (isNewRoundAction(message)) return undefined" ...`: exit 0
- `npx vitest run agent-admin.test.ts site/pages/agent-admin-presets.test.ts`: 2 files, 266 of 266 tests passed
- `npx vitest run agent-admin-app.test.ts persona-library-pattern.test.ts agent-roster-source.test.ts`: 3 files, 77 of 77 tests passed
- `npm run check`: exit 0

## Notes
Line 202 still contains `updateDataModel`, which is also on the lint's wire-term list. The presets suite passes with it, which means the lint does not scan skill content.
