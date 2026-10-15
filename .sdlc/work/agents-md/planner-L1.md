<!-- role=planner level=L1 model=sonnet effort=medium -->
## Goal
Rewrite the hand-written part of the repo-root `AGENTS.md` as a short harness-neutral router (identity, package map, truth homes, generated surfaces, gates, conventions, trust boundary, vocabulary, seats, process, landmines), leaving the managed block byte-identical.

## Step 1: Rewrite AGENTS.md router and run gates
level: L2
guard timeout: 1800
### Do
Depends on: none. Edit only `AGENTS.md`. Replace everything above `<!-- sdlc-lite:managed:start` (currently lines 1 to 27: "What this repository is", "Shared rules", "Checks") with a roughly 60-line router. The managed block stays byte-identical. Keep `# agent-ui` as the first line and a blank line before the managed marker. Use terse tables and bullets, no prose paragraphs, no em dashes, no bold inline labels. Link to `CLAUDE.md` and `.claude/docs/` instead of restating them. The handoff outline fixes the section order, 11 items:

1. Identity in two lines, with the two ruled exceptions: CodeMirror 6 on `@agent-ui/code/editor` (ADR-0139) and pdfjs-dist on the `@agent-ui/app` ingestion seam (ADR-0202).
2. Package map. Ten packages under `packages/agent-ui/*`, one line each: components, shared, a2ui, a2a, icons, app, router, code, data, devtools. State the DAG: `shared <- components <- a2ui <- {app, devtools}`, with `router`/`code`/`data` as siblings off `components`, and `a2a`/`icons` importing nothing. Say it is enforced by each package's `layering.test.ts`, to be consulted on any edge question. The `layering.test.ts` files exist, for example `packages/agent-ui/data/src/layering.test.ts`.
3. A question-to-home table:
   - `.claude/docs/plan.md`, `goals.md`, `roadmap.md` and `process.md`.
   - ADR/PRD/SPEC/LLD under `.claude/docs/`.
   - Descriptors `{name}.md` beside each control.
   - Catalogs `catalog.json` under `packages/agent-ui/a2ui/src/catalog/` (they live in subfolders such as `default/` and `a2ui-basic/`, so cite the directory, not a flat file).
   - Prompt stack under `packages/agent-ui/a2ui/src/agent/prompts/`.
   - Work items are GitHub issues; `.claude/docs/tickets/` is frozen (ADR-0145).
   - Docs entry `docs/AGENTS.md`.
4. Generated or byte-pinned surfaces, never hand-edit:
   - `*.props.gen.ts` are generated from descriptors by `scripts/generate-props.mjs` and drift-gated. Do not invent an npm script name, because none wraps it.
   - `packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json` is recaptured only through the deliberate flow in skill `a2ui-prompt-authoring`. Its true path is under `live-agent/`, not under `prompts/`.
5. Gates: `npm run check`, `npm test`, `npm run test:browser`. Judge by exit code. Docs-only diffs gate on `doc_lint` plus `check` (`.claude/docs/process.md` section 1).
6. Hard conventions, few: `erasableSyntaxOnly`, `import type`, explicit `.ts`, light-DOM, ARIA via `ElementInternals`, `ui-{name}` naming, event names `change input select open close toggle action`.
7. Trust boundary: keys and `produce()` never enter `devtools`; the boundary sits at `/__a2ui/agent` (ADR-0073, file `0073-a2ui-live-model-provider-seam.md`).
8. Vocabulary: bare "the harness" is retired; point at `.claude/docs/references/agent-model.md` section 2 (heading "Harness", disambiguated).
9. Seat map: skill `seat-map` says which agent or skill owns UI controls, a2ui code, payloads, docs and review.
10. Process: momentum rules in `.claude/docs/process.md`, the `size:big` `due-process` loop (GH #969), worktree traps in `seat-map` Dispatch laws.
11. Landmines: stale context is a defect, so a change that invalidates a record repairs it in the same change. No em dashes anywhere. GH #1798 tracks skills that name plugin agents that are currently disabled.

Leave out the ADR list, component inventory, tokens, anything a gate already fails loudly on, and dated status.

Before finishing, verify every path, skill and ADR number you cite exists with `ls` or `git ls-files`. Evidence for the paths above is in the planner probes (all existed on the current tree). Then run the docs-only gates: `python3 ~/.claude/plugins/cache/nonoun-plugins/docs/1.22.5/scripts/doc_lint.py` on `AGENTS.md` if it applies to that file (check its `--help` first), then `npm run check`. This is a one-step plan, so this step is also the gates green step. Fix any new red your edit causes. A gate already red at base comes back as `inherited red`.
### Acceptance criteria
- `grep -qF 'prompt-equivalence.baseline.json' AGENTS.md`
- `grep -qF 'live-agent/prompt-equivalence.baseline.json' AGENTS.md`
- `grep -qF 'generate-props.mjs' AGENTS.md`
- `grep -qF 'GH #1798' AGENTS.md`
- `grep -qF 'agent-model.md' AGENTS.md`
- `grep -qF 'seat-map' AGENTS.md`
- `grep -qF '/__a2ui/agent' AGENTS.md`
- `test "$(awk '/sdlc-lite:managed:start/{exit} {n++} END{print n}' AGENTS.md)" -le 80`
- (guard) `! grep -q '—' AGENTS.md`
- (guard) `diff <(git show "$SDLC_BASE_SHA":AGENTS.md | sed -n '/sdlc-lite:managed:start/,/sdlc-lite:managed:end/p') <(sed -n '/sdlc-lite:managed:start/,/sdlc-lite:managed:end/p' AGENTS.md)` shows the managed block unchanged, and `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.20.5/scripts/onboard.py check 2>&1 | grep -qx 'current AGENTS.md'`
- (guard) `{ git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc"; } | grep -vx 'AGENTS.md' | wc -l | grep -qx 0`
- (guard) `npm run check`

## Assumptions
- Cited homes exist: verified by `ls` on `.claude/docs/{plan,goals,roadmap,process}.md`, `references/agent-model.md`, `docs/AGENTS.md`, the `seat-map`, `due-process` and `a2ui-prompt-authoring` skills, ADR-0073 and ADR-0145 files, `scripts/generate-props.mjs`, and `live-agent/prompt-equivalence.baseline.json`.
- `onboard.py check` reports `current AGENTS.md` at base: verified by running it.
- No single line holds `-- . ":(exclude).sdlc"` with a nonzero count for the scope check at base: the working tree has only untracked `.sdlc/`.
- doc_lint applicability and CLI are unverified: the builder checks `--help` and skips it if it does not apply to `AGENTS.md`.
- ADR-0139 and ADR-0202 numbers come from `CLAUDE.md`. The builder confirms with `ls .claude/docs/adr | grep -E '0139|0202'`.
- `npm run check` runtime is untimed, so the 1800s guard timeout is a generous guess.

## Risks
- The `<=80` line cap or the managed-block diff may be hit if the builder over-writes.
- `npm run check` could be red for reasons unrelated to this docs-only edit, which would surface as `inherited red`.
