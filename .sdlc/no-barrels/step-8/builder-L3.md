<!-- role=builder level=L3 model=opus effort=high -->
## Status
done

## Changes
- `scripts/measure-size.mjs`:
  - The family row budget is now `72 * KB`, with a `RE-BASED 2026-10-05 (ADR-0233, Kim ruling)` ledger entry.
  - `APP_MARGINAL_BUDGET` goes from 106559 to 72027, with a ledger note under ADR-0197 cl.5.
  - Lines 721 and 740 now say "the retired CSS barrel", and every figure is kept.
- `.claude/docs/adr/0040-foundation-barrel-budget-7kb.md`: rewrote the one 2026-10-05 amendment sentence to the 73728 B gz re-base.
- `.claude/docs/goals.md`: the G1 scope line (about :192) is rewritten and cites ADR-0233. The done item (about :442) now says "superseded by ADR-0233" and no longer names the old files.
- `.claude/docs/references/component-packaging.md`: the barrel rows are gone. The CSS-order note, the host-page contract (per-control entries plus `shared-styles.css`, with `all`/`all.css` demo-only) and the add-a-control sentence are rewritten.
- `.claude/skills/component-build/SKILL.md`, `.claude/skills/component-packaging/SKILL.md`: barrel mentions rewritten to the generated registry and ADR-0233.
- `packages/agent-ui/components/AGENTS.md`: dropped the `component-styles.css` mention.
- CSS comments rewritten to the ADR-0233 cl.3 host contract:
  - the four named in the handoff: `foundation-styles.css`, `_surface/container.css` (:3 and :33), `_surface/container-box.css` and `app/.../agent-admin.css`;
  - five more grep hits: `calendar.css`, `color-picker.css`, `drawer.css`, `modal.css`, `row.css`.
- Descriptor YAML `#` comments, inside the frontmatter fence: `attachment`, `avatar`, `badge`, `bar-chart`, `code`, `ladder`, `progress`, `ramp`, `sandbox-frame`, `sparkline`, `stat`, `swatch` and `tabs` `.md`.
- Code comments:
  - a2ui: `examples/index.ts`, `examples/types.ts`.
  - components: `_base/index.ts`, `text-field.ts`, `file-set.test.ts`, `loader.browser.test.ts`, `site-coverage.test.ts`.
  - components browser tests: `attachment` (plus its visual test), `avatar`, `badge`, `column-chart`, `gauge`, `disclosure`, `progress`, `sparkline`, `stat` (plus its visual test).
- `packages/agent-ui/components/src/descriptor/generate-controls.test.ts:125`: the not-owned list now uses `'./loader'` and `'./shared-styles.css'`. Both are in the exports map and neither is generator-owned.
- Regenerated:
  - `packages/agent-ui/components/src/controls/sandbox-frame/dogfood/dogfood-assets.ts`
  - `site/lib/__fixtures__/theme-provider-built.css`
- Retained from the first attempt and checked, not redone: both barrels deleted; their exports keys, vitest entries and the `vite.config.ts` mention removed; the `barrels.test.ts` and `family-coherence.test.ts` rewrites; `sideEffects` in the nine packages; `scripts/side-effects.test.mjs`; the registry size row.

## Checks
- Criterion 1 (guard), the barrel deletion and `registry.gen.ts` in both tests: exit 0.
- Criterion 2 (guard), the `sideEffects` node check plus `npx vitest run scripts/side-effects.test.mjs`: exit 0, 27 passed. The clean rerun also exited 0.
- Criterion 3, the `git grep --untracked` barrel grep plus `ADR-0233` in goals.md: exit 0.
- Criterion 4, the three greps plus `npm run size`: exit 0.
  - all: 72993 B gz against 73728.
  - registry + loader: 3155 against 3840.
  - app marginal: 69981 against 72027.
- Criterion 5, the measure-size figures and the no-U+2014 check: exit 0.
- Criterion 6, the ADR-0040 checks: exit 0.
- `npm run regen:dogfood-assets`: exit 0, DOGFOOD_JS 319244 B, 88 tags. `npm run regen:theme-provider-fixture`: exit 0.
- Criterion 7, `npm test`: exit 0, 639 files passed and 1 skipped; 13295 tests passed.
- Criterion 8 (guard), `npm run check`: exit 0.
- Criterion 9 (guard), the app, rest, focus-timing and eval-catalog chain:
  - app: exit 0, 48 of 48 files.
  - rest: exit 0, 18 of 18.
  - focus-timing: exit 0, 30 of 30.
  - eval-catalog: exit 0, 0 cards with red gates.
- Criterion 10 (guard), baselines: exit 0.
- Criterion 11 (guard), the filtered browser shards with `--retry 2`:
  - components: exit 0, 176 files and 2420 tests passed.
  - site: exit 0, 170 files and 946 tests passed.
  - visual: exit 0, 25 files and 61 tests passed.
- Criterion 12 (guard), scope: exit 0, run after all gates.

## Notes
- The last `npm run size` measured the app marginal at 69981 B gz, not the 69979 the handoff gives. The ledger keeps 69979 as instructed. The 2 B gap is not a transcription error and does not block: the row is within the 72027 budget with 2046 B of headroom.
- About 80 comment lines still say "component-styles barrel" without `.css`. They sit in control-sheet banners and several `*.browser.test.ts` headers, for example `super-shell.browser.test.ts:10`. The criterion's regex does not match them and the handoff does not name them, so they stay under the smallest-change rule. I fixed only the ones inside comment blocks I was already editing (`container.css:33`, `drawer.css`, `modal.css`, `row.css`). The planner may want a follow-up ticket.
- `DOGFOOD_TAGS` is unchanged: 88 tags and no tag line in the diff. `DOGFOOD_JS` came out at 319244 B, as the handoff predicted.
- Newly written text has no em dashes. Diff lines that still carry one were already there in the rewritten comments.
- No commit was made. The throwaway logs under `$SDLC_TMP_WORKTREES` were removed, and the scope guard is green after eval-catalog, so nothing it wrote under `screenshots/` is tracked.
