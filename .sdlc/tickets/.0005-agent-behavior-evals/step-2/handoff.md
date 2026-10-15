## Task goal
A keyless, deterministic eval harness that scores producer turns on four behaviors (concept selection, negative selection against the `notFor` edges, repair from structured validator errors, first-pass versus eventual success) plus a per-persona leg, with a manual live leg for a real model and acceptance cases the generator cannot edit. Tracks GH #1810.

## Step 2: Scrub list applied, gates green
level: L3
guard timeout: 480
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Depends on: step 1. This step stays separate from step 1 only because the merged criteria would exceed the 12-criterion cap.

Apply the handoff's scrub list with these rules:
- Every addition is one pointer line or sentence.
- No line uses an em dash.
- No skill gets a `file.ext:NNN` line anchor, because `scripts/claude_wiring_check.py` flags those as anchor rot. Use symbols or section names.
- The token `eval:agent-behavior` appears in every edited file.

Edits:
- `CLAUDE.md` `## Commands`: a new bullet directly after the `npm run test:browser` bullet. It says:
  - `npm run eval:agent-behavior -- selftest` is keyless and runs inside `check:scripts`.
  - `-- live --leg selection|persona` needs `ANTHROPIC_API_KEY` and is Kim's manual run, exit 0, 1 or 2.
  - Home: `packages/agent-ui/a2ui/tools/agent-eval/`, GH #1810.
- `AGENTS.md` `## Gates`: one bullet. The keyless `npm run eval:agent-behavior -- selftest` rides `check:scripts`; its `live` leg needs a key, is a manual measurement, and is never a gate.
- `packages/agent-ui/a2ui/AGENTS.md`: extend the existing `selection.json` sidecar bullet, on the same line, not a new bullet. Add that `npm run eval:agent-behavior` (`tools/agent-eval/`) derives one case per `notFor` edge from these sidecars through `selectionGuidanceFor`.
- `.claude/docs/rubrics/a2ui-catalog.md`:
  - Add one line directly after the dimension table, before `## Gate to promote`: D7 judges the words; whether a model actually picks the right type is measured by `npm run eval:agent-behavior` (GH #1810) and never scored here.
  - Bump the header to the next minor version after the one it holds at build time (v0.3 to v0.4 at today's HEAD), with a note that the bump adds the D7 pointer and moves no dimension or anchor.
  - Leave the `| D7 |` row byte for byte.
- `.claude/skills/a2ui-review-standards/SKILL.md`: one line directly after the paragraph that starts "The middle rows above are the GH #493 siblings". The review agent does not grade "does the model choose the right type (concept, `notFor`, repair, per persona)"; that routes to `npm run eval:agent-behavior`.
- `.claude/skills/a2ui-review-standards/references/grading-standards.md`: one sentence at the end of the `Catalog-page card` bullet, with the same routing.
- `.claude/skills/a2ui-catalog-rendering-review/SKILL.md`: one sentence at the end of item 3, "Probe the gates". `eval-a2ui-catalog.mjs` checks page rendering, never agent selection, which is `npm run eval:agent-behavior`.
- `.claude/skills/a2ui-catalog-rendering-review/references/catalog-pipeline.md`: one sentence appended to the paragraph right after the gate table (the one starting "`npm test` covers every jsdom gate above"), saying the same.
- `.claude/skills/component-testing/references/test-craft.md`: one sentence after the paragraph that starts "A seventh, NON-vitest step runs after these six". The agent-behavior eval's selftest runs in `check:scripts`, its stub tests ride the vitest `tools` project, its live leg is manual, and it adds no browser shard.
- `.claude/skills/a2ui-corpus-curation/SKILL.md`: one sentence in `## Scope: this skill is the exemplar shard only`. A2UI selection and repair behavior is a separate eval, `npm run eval:agent-behavior`, not this skill's.
- `.claude/skills/a2ui-prompt-authoring/SKILL.md`: extend the "Catalog selection sidecars are byte-pinned surface too" bullet. A sidecar edit also moves the derived cases of `npm run eval:agent-behavior`, so run its selftest afterwards.
- `.claude/skills/a2ui-build/SKILL.md`: extend the `Selection guidance` bullet. The sidecars are exercised by `npm run eval:agent-behavior` (`tools/agent-eval/`).
- `.claude/agents/a2ui-review-agent.md`: in the body, not the frontmatter description, extend the NOT clause. Model selection behavior routes to `npm run eval:agent-behavior`.
- `.claude/docs/spec/a2ui-live-agent.spec.md`:
  - One non-normative "Eval coverage" line after SPEC-R4's acceptance criteria. `npm run eval:agent-behavior` reads `TurnTrace.rounds` and `failureCodes` to score first-pass versus eventual success with scripted providers, keylessly, and its live leg is manual.
  - A header changelog entry at the next minor version after the one the header holds at build time (v0.18 to v0.19 at today's HEAD), recorded as a docs-only pointer with no requirement or AC added.
- `.claude/docs/lld/a2ui-live-agent.lld.md`: one sentence in §5's "Provider-agnostic" paragraph saying the same stub seam backs `tools/agent-eval/`, plus a fold note in the header.
- `.claude/docs/lld/genui-b3-judged-eval.lld.md` §4: one cross-reference sentence. The sibling `npm run eval:agent-behavior` mirrors this CLI's key boundary and exit codes for A2UI selection and repair, and writes nothing under `corpus-genui/`.
- `packages/agent-ui/a2ui/corpus-genui/README.md`: one line with the same cross-reference. It must keep everything `tools/corpus-genui/wiring.test.ts` asserts: each leg with its tag, the no-fabrication rule, and README as the only non-data root file.
- `.claude/docs/roadmap.md`: one sentence after the GenUI B3 paragraph (the one holding "B3 shipped 2026-08-23"), recording that the agent-behavior eval shipped (GH #1810), keyless with a manual live leg.

Left untouched on purpose:
- `.claude/agents/a2ui-build-agent.md`: its only selection text routes to the sidecar gate, and the build method's pointer lands in `a2ui-build/SKILL.md`.
- `.claude/docs/spec/a2ui-catalog.spec.md`: §5.2 names `selection.json` as the machine twin, and eval routing lives in the live-agent SPEC.
- Historical ADRs, reports, and `.claude/overhaul-*`.

Shared records: in the 2026-10-05 rollout, T-0006 edits the live-agent SPEC and LLD first, and T-0009 owns `test-craft.md`. If either lands first, rebase onto it. The criteria check membership only.

Run `python3 "$(ls -d ~/.claude/plugins/cache/nonoun-plugins/docs/*/scripts/doc_lint.py | sort -V | tail -1)" <file>` on every touched `.claude/docs` file, as `.claude/docs/process.md` §1 requires. It is not a criterion: a planning probe showed it prints "not a functional document" and exits 0 on all five files, including a fixture holding an em dash, so it cannot go red (rule 11).

Then run every gate, `npm run check` and `npm test`, judged by exit code. Fix any red step 1 or this step introduced, including `scripts/claude_wiring_check.py` and `scripts/harness_wiring_check.py` findings on the edited skill and agent files.
### Acceptance criteria
- `for f in CLAUDE.md AGENTS.md; do grep -qF "eval:agent-behavior" "$f" || exit 1; done`
- `grep -F "selection.json" packages/agent-ui/a2ui/AGENTS.md | grep -qF "eval:agent-behavior"`
- `for f in .claude/skills/a2ui-review-standards/SKILL.md .claude/skills/a2ui-review-standards/references/grading-standards.md .claude/skills/a2ui-catalog-rendering-review/SKILL.md .claude/skills/a2ui-catalog-rendering-review/references/catalog-pipeline.md .claude/skills/component-testing/references/test-craft.md .claude/skills/a2ui-corpus-curation/SKILL.md .claude/skills/a2ui-prompt-authoring/SKILL.md .claude/skills/a2ui-build/SKILL.md .claude/agents/a2ui-review-agent.md; do test -f "$f" || exit 3; grep -qF "eval:agent-behavior" "$f" || exit 1; done`
- `for f in .claude/docs/rubrics/a2ui-catalog.md .claude/docs/spec/a2ui-live-agent.spec.md .claude/docs/lld/a2ui-live-agent.lld.md .claude/docs/lld/genui-b3-judged-eval.lld.md .claude/docs/roadmap.md packages/agent-ui/a2ui/corpus-genui/README.md; do test -f "$f" || exit 3; grep -qF "eval:agent-behavior" "$f" || exit 1; done`
- (guard) `test "$(git show "$SDLC_BASE_SHA":.claude/docs/rubrics/a2ui-catalog.md | grep "^| D7 ")" = "$(grep "^| D7 " .claude/docs/rubrics/a2ui-catalog.md)"`
- (guard) `! { git diff "$SDLC_BASE_SHA" -- . ":(exclude).sdlc" | grep "^+" | grep -v "^+++"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc" | while IFS= read -r f; do cat "$f"; done; } | grep -q "$(printf "\342\200\224")"`
- (guard) `! { git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc"; } | grep -vE "^(packages/agent-ui/a2ui/tools/agent-eval/|package\.json$|vitest\.config\.ts$|CLAUDE\.md$|AGENTS\.md$|packages/agent-ui/a2ui/AGENTS\.md$|packages/agent-ui/a2ui/corpus-genui/README\.md$|\.claude/docs/rubrics/a2ui-catalog\.md$|\.claude/docs/spec/a2ui-live-agent\.spec\.md$|\.claude/docs/lld/(a2ui-live-agent|genui-b3-judged-eval)\.lld\.md$|\.claude/docs/roadmap\.md$|\.claude/skills/(a2ui-review-standards/SKILL|a2ui-review-standards/references/grading-standards|a2ui-catalog-rendering-review/SKILL|a2ui-catalog-rendering-review/references/catalog-pipeline|component-testing/references/test-craft|a2ui-corpus-curation/SKILL|a2ui-prompt-authoring/SKILL|a2ui-build/SKILL)\.md$|\.claude/agents/a2ui-review-agent\.md$)"`
- (guard) `npm run check`
- (guard) `npm test`
