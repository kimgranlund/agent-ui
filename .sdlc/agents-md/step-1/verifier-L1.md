<!-- role=verifier level=L1 model=sonnet effort=medium -->
## Verdict
pass

## Criteria
- `grep -qF 'prompt-equivalence.baseline.json' AGENTS.md`: pass. Evidence: ran it, the pattern is found.
- `grep -qF 'live-agent/prompt-equivalence.baseline.json' AGENTS.md`: pass. Evidence: ran it, the pattern is found.
- `grep -qF 'generate-props.mjs' AGENTS.md`: pass. Evidence: ran it, the pattern is found.
- `grep -qF 'GH #1798' AGENTS.md`: pass. Evidence: ran it, the pattern is found.
- `grep -qF 'agent-model.md' AGENTS.md`: pass. Evidence: ran it, the pattern is found.
- `grep -qF 'seat-map' AGENTS.md`: pass. Evidence: ran it, the pattern is found.
- `grep -qF '/__a2ui/agent' AGENTS.md`: pass. Evidence: ran it, the pattern is found.
- Router length ≤ 80 lines: pass. Evidence: the awk count prints 67, and 67 ≤ 80.
- (guard) no em dash: pass. Evidence: `grep -q '—' AGENTS.md` found nothing. The file is readable, since I read it back.
- (guard) managed block unchanged and onboard check: pass. Evidence: the `diff` against `$SDLC_BASE_SHA` printed nothing (my script echoed `blockSame`). `onboard.py check` printed exactly `current AGENTS.md`.
- (guard) only `AGENTS.md` changed: pass. Evidence: the file-count pipeline printed 0.
- (guard) `npm run check`: pass. Evidence: exit 0, and the output ends with `selftest: all green`.
- I did not run the pre-build baseline for these guards. The gates are green, so there was no red to compare. A red baseline would not have changed the result. I did not run each check red in a throwaway worktree.
- Cited paths exist. Evidence: `test -e` returned ok for `scripts/generate-props.mjs`, the baseline json under `live-agent/`, the `prompts/` directory, `agent-model.md`, `process.md`, `docs/AGENTS.md`, the `seat-map`, `a2ui-prompt-authoring` and `due-process` skill directories, and `data/src/layering.test.ts`. ADR files 0073, 0139, 0145 and 0202 are present under `.claude/docs/adr`.
- Outline coverage: pass. Evidence: I read the file. It has identity with both exceptions, a package table, the DAG and `layering.test.ts`, a question-to-home table, a never-hand-edit section, gates, conventions, the trust boundary, vocabulary, seat map, process, and landmines.

## Out of scope changes
None. `git status` shows `AGENTS.md` modified and `.sdlc/` untracked, and the guard that excludes `.sdlc` found no other file.

## For the next attempt
None
