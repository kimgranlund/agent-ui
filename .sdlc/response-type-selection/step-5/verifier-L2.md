<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
pass

## Criteria
- (red) no "You do NOT reply in prose" in grammar.md: pass. Evidence: `! grep -qF ...` exit 0; red-checkpoint.jsonl records it exit 1 pre-edit.
- (red) grammar.md names render_surface: pass. Evidence: grep exit 0; pre-edit red recorded.
- (red) both response-preference files non-empty: pass. Evidence: `test -s` both, exit 0 (3 lines each); pre-edit red recorded.
- (red) K6 / composition probe: pass. Evidence: probe verbatim from the handoff, exit 0, printed `43270 43521 43557` (default+tool, text+tool, surface+tool), all under the 46,400 bound; 'auto' equals base, text and surface each grow the text and carry a non-empty `response-preference` section, and the two differ. Pre-edit red recorded.
- (red) PromptSectionId and SECTION_ORDER gain 'response-preference': pass. Evidence: grep in meta-line.ts and prompt-budget.test.ts exit 0.
- (red) persona-hint test: pass. Evidence: vitest `-t "persona hint"` exit 0, `Tests 5 passed (5)`. The tests assert the paragraph is in `req.system`, the other is absent, `tools` is exactly `['render_surface']`, no `toolChoice`, 'auto' is byte-identical to no hint, and the A2UI-off turn composes none. Builder's negative control (dropping the a2ui-off gate reds one test) is recorded in the builder report; the tests assert on the real request, not on constants.
- (guard) live-agent + agent vitest dir: pass. Evidence: `--maxWorkers=4` exit 0, 57 files passed 1 skipped, 1002 tests passed 1 skipped. No pre-build run needed (green).
- (guard) `node scripts/generate-agent-assets.mjs --check`: pass. Evidence: exit 0.
- (guard) eval-agent-behavior selftest and testkit `kit.ts selftest`: pass. Evidence: both exit 0.
- (guard) scope loop against `$SDLC_BASE_SHA` (10cc47df): pass. Evidence: exit 0 with `SDLC_BASE_SHA` exported; the diff has exactly 10 files, all in the allowed list (`git diff --stat`).

Extra checks from the brief:
- Baseline recapture: only the documented flow is claimed (`RECAPTURE_BASELINE=1 ... recapture-baseline.test.ts`, per `packages/agent-ui/a2ui/AGENTS.md:9`). I diffed the old and new `default` composition line by line against the `grammar.md` line diff: 39 changed lines each, and the sorted line sets are identical, so the baseline moved only by the grammar rewrite. The four composed keys moved by +614 chars each (42209 to 42823; 38304 to 38918; 39586 to 40200); `miniSkills`, `genuiPacks`, `genuiDogfoodTeaching` unchanged. The `response-preference` paragraphs are not in the baseline (default has no `prefers`), as RTS-R7 AC1 requires.
- Generated files match their generator (`--check` exit 0). `dogfood-fleet.gen.ts` has no diff.
- Em dashes: 0 on added non-generated lines.
- grammar.md read as a prompt author: the old rules not being changed survive. One-meta-line rule is kept and now also covers a second meta-line in prose or in the render_surface JSONL. Ask arm (fresh `ask-<n>`, one commit button, `wantResponse` omitted, note carries the question) is intact and re-pointed at "the render_surface JSONL". Plan, flowEnd, target, personaPatch, validity, output-rules block unchanged beyond the header. New text teaches the prose reply, render_surface only when the UI changes, update an open surface before creating one (PRD-G5), and that earlier assistant turns show reply then rendered JSONL, not a format to copy (RTS-R12). "Never write A2UI JSONL or HTML into your prose reply" matches produce.ts, where a legacy-shape stray is still handled and `render_surface` carries the payload (`produce.ts:1124-1130`).
- Residue (not a defect): about 40 clauses still say "note"/"the note line"; the intro bridges them ("Your prose reply IS your note"). RTS-R3 accepts both shapes, so behavior is consistent.
- A2UI-off gate: `responsePreferenceBlock` returns '' when `a2uiEnabled === false` (`system-prompt.ts:318-319`), the same condition under which `produce.ts:1129` withholds `render_surface`. This is consistent with RTS-R7 ("never changes the tool offer", AC1 compares against the A2UI-enabled nine-argument call). Pinned by the fifth test. It is a small addition beyond the spec text; worth a one-line SPEC note in a later docs step, but it contradicts nothing.

## Out of scope changes
None. The diff is the 10 allowed files; `git log` shows three step commits (a7861d0e, c1fcdd7d, 52be6c56). `prompt-budget.ts` MEASURED notes are now slightly stale (+614 grammar, +287 surface paragraph), left untouched as out of scope, as the builder noted; a later step or loose-ends should re-measure.

## For the next attempt
None.
