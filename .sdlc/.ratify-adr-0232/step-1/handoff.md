## Task goal
Record Kim's ratification of ADR-0232 (catalog selection guidance sidecar) and repair every record that still calls it proposed.

## Step 1: Flip ADR-0232 to accepted and repair the proposed markers
level: L2
guard timeout: 600

### Read first
- `.claude/skills/doc-standards/SKILL.md`

### Do
1. In `.claude/docs/adr/0232-catalog-selection-guidance-sidecar.md`, set Status to the accepted value used by recently accepted ADRs (read ADR-0231's header and the doc-standards ADR rules first), set `Ratified by` to Kim with the date 2026-10-05 and the note that she ratified it in the sdlc-lite session, and remove wording that says it is pending or never self-ratified from the header. Leave the decision, consequences and alternatives text unchanged.
2. Replace the "proposed", "PROPOSED" and "pending" markers about ADR-0232 with the accepted wording in each of these (find them with `git grep -n -i 0232 -- . ':(exclude).sdlc' | grep -i -E 'propos|pending|never self'`): `.claude/docs/lld/a2ui-live-agent.lld.md`, `.claude/docs/references/agent-model.md`, `.claude/docs/rubrics/a2ui-catalog.md`, `.claude/docs/spec/a2ui-catalog.spec.md` (only the v0.4 changelog note about ADR-0232; the spec's own `Status: proposed` is unrelated, leave it), `.claude/docs/spec/a2ui-live-agent.spec.md`, `.claude/skills/a2ui-build/SKILL.md`, `packages/agent-ui/a2ui/src/agent/index.ts`, `.../system-prompt.ts`, `.../live-agent/prompt-drift.test.ts` (including the describe title), `.../tools/agent/worker/fs-shim-content.ts`, `.../worker/fs-shim.test.ts` (including the describe title), `.../worker/fs-shim.ts`, `site/pages/choosing.ts`. If any of these strings reaches the composed prompt (not a `//` comment), the prompt baseline moves: then recapture it with the deliberate flow in skill `a2ui-prompt-authoring` and say so in Notes; otherwise the baseline must not change.
3. Regenerate the indexes the ADR title or status feeds: `node scripts/generate-sitemap.mjs`, and run `site/lib/sitemap.test.ts`.
4. Run the gates below and fix any red this change causes.

### Acceptance criteria
- `grep -qiE '\*\*Status\*\* \| accepted' .claude/docs/adr/0232-catalog-selection-guidance-sidecar.md`
- `! git grep -n -o -i -E 'ADR-0232[^|]{0,40}(propos|pending|never self)|(propos|pending|never self)[^|]{0,40}ADR-0232' -- . ':(exclude).sdlc' ':(exclude).claude/docs/adr/0232-catalog-selection-guidance-sidecar.md'`
- `! grep -qiE 'pending Kim|never self-ratified' .claude/docs/adr/0232-catalog-selection-guidance-sidecar.md`
- (guard) `git diff --quiet "$SDLC_BASE_SHA" -- packages/agent-ui/a2ui/src/catalog packages/agent-ui/a2ui/src/agent/selection-guidance.ts`
- (guard) `! git diff -U0 HEAD -- . ':(exclude).sdlc' | grep -E '^[+]' | grep -v '^[+][+][+]' | grep -q $'\xe2\x80\x94'`
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/src/catalog/selection-guidance.test.ts site/lib/sitemap.test.ts`
- (guard) `npx vitest run --project tools packages/agent-ui/a2ui/tools/agent/worker/fs-shim.test.ts`
- (guard) `npm run check`

## Previous attempt
The first builder run did the edits (all 14 files, left uncommitted in the tree) and blocked on two defective criteria, a conductor error in this handoff, not in the work: criterion 2 matched whole lines of minified files, and the em-dash guard errored under BSD grep. Both criteria are now fixed above. Do not redo or revert the edits; re-run every criterion on the current tree and report. Fix only a real red.
