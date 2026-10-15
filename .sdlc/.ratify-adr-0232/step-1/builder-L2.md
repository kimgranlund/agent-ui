<!-- role=builder level=L2 model=opus effort=low -->
## Status
blocked

## Changes
- `.claude/docs/adr/0232-catalog-selection-guidance-sidecar.md`: Status set to `accepted`. `Ratified by` now reads "kimgranlund (repo owner), 2026-10-05, ratified by Kim in the sdlc-lite session (run `ratify-adr-0232`)". Decision, consequences and alternatives are unchanged.
- `.claude/docs/lld/a2ui-live-agent.lld.md`: "ADR-0232 (proposed" changed to "(accepted" on lines 3, 85 and 130. The em dashes already on lines 3 and 85 became hyphens so the no-em-dash guard stays clean.
- `.claude/docs/references/agent-model.md`: "proposed" changed to "accepted".
- `.claude/docs/rubrics/a2ui-catalog.md`: "proposed" changed to "accepted".
- `.claude/docs/spec/a2ui-catalog.spec.md`: changed in the v0.4 note and the §5.2 note. The spec's own `Status: proposed` is left as it was.
- `.claude/docs/spec/a2ui-live-agent.spec.md`: the v0.18 changelog now reads "ACCEPTED, ratified by Kim 2026-10-05". The SPEC-R6 paragraph and the AC7 trace row now read "accepted".
- `.claude/skills/a2ui-build/SKILL.md`: "proposed" changed to "accepted".
- `packages/agent-ui/a2ui/src/agent/index.ts`: comment only.
- `packages/agent-ui/a2ui/src/agent/system-prompt.ts`: comments only.
- `packages/agent-ui/a2ui/src/live-agent/prompt-drift.test.ts`: comment and describe title.
- `packages/agent-ui/a2ui/tools/agent/worker/fs-shim-content.ts`: comments only.
- `packages/agent-ui/a2ui/tools/agent/worker/fs-shim.test.ts`: comments and describe title.
- `packages/agent-ui/a2ui/tools/agent/worker/fs-shim.ts`: comment only.
- `site/pages/choosing.ts`: comment only.

## Checks
- `grep -qiE '\*\*Status\*\* \| accepted' <adr-0232>`: exit 0, pass.
- Criterion 2 (`! git grep ... | grep -i -E 'propos|pending|never self'`): fails. See Notes.
- `! grep -qiE 'pending Kim|never self-ratified' <adr-0232>`: pass.
- (guard) `git diff --quiet $SDLC_BASE_SHA -- .../src/catalog .../selection-guidance.ts`: exit 0, pass.
- (guard) em-dash guard: run as written it exits 0, but only because it never checks anything (see Notes). Rerun with `/usr/bin/grep -F`-safe patterns, it counts 0 em dashes on added lines, so it passes.
- `node scripts/generate-sitemap.mjs`: exit 0. No index file changed.
- (guard) `npx vitest run --project packages .../live-agent .../selection-guidance.test.ts site/lib/sitemap.test.ts`: exit 0, 729 passed, 1 skipped.
- (guard) `npx vitest run --project tools .../fs-shim.test.ts`: exit 0, 15 passed.
- (guard) `npm run check`: exit 0.

## Notes
plan defect: criterion 2 `! git grep -n -i 0232 ... | grep -i -E 'propos|pending|never self'` cannot pass. `git grep` matches whole lines, and several tracked files have single-line minified content where ".0232" (an oklch value) or a hash and the words "pending" or "proposed" sit on the same line. None of these are about ADR-0232:
- `packages/agent-ui/a2ui/corpus/exemplar/v1_0/agent-ui.jsonl:48`
- `packages/agent-ui/components/src/controls/sandbox-frame/dogfood/dogfood-assets.ts:10`
- `site/.fixture-scratch/assets/*`
- `site/lib/__fixtures__/theme-provider-built.css`

It also matches `.claude/docs/spec/a2ui-catalog.spec.md:3`, which Do step 2 says to keep as `Status: proposed`. Do and criterion 2 contradict each other on that line.

With those files excluded, no proposed or pending marker about ADR-0232 is left. The criterion needs to exclude those paths, or match `ADR-0232[^|]{0,20}(propos|pending)` instead of whole lines.

The em-dash guard is vacuous in this environment. `grep -v '^\+\+\+'` errors out under BSD grep ("repetition-operator operand invalid") and under the ugrep alias, so the pipe is always empty and the guard always passes. The verifier should use `grep -v '^+++'`.

Every changed string is a `//` comment or a test describe title. None of them reach the composed prompt, so `prompt-equivalence.baseline.json` is unchanged and no recapture was needed. All work is left uncommitted in the tree.
