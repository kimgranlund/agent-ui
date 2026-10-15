<!-- role=planner level=L1 model=sonnet effort=medium -->
## Goal
Create nested `AGENTS.md` files (at most 40 lines each) with byte-identical `CLAUDE.md` siblings for `packages/agent-ui/a2ui/` and `packages/agent-ui/components/`, docs only.

## Step 1: Write the two nested AGENTS.md files and their CLAUDE.md siblings
level: L1
guard timeout: 90
### Do
Depends on: none

Create exactly four files and touch nothing else: not `.sdlc/`, not the root `AGENTS.md` or `CLAUDE.md`, not the sdlc-lite managed block. Neither target directory has an `AGENTS.md` or `CLAUDE.md` yet (checked with `ls`).

1. `packages/agent-ui/a2ui/CLAUDE.md` and `packages/agent-ui/components/CLAUDE.md`: copy `docs/CLAUDE.md` byte for byte, e.g. `cp docs/CLAUDE.md <dest>`. It is 3 lines: the `sdlc-lite:managed:start v1 sha256:336cc4fbf19b` marker, `@AGENTS.md`, and the end marker (checked with `od -c`).

2. `packages/agent-ui/a2ui/AGENTS.md`, at most 40 lines. Use terse bullets and tables with no em dashes. Link to paths, ADRs and skills instead of restating them. It covers:
   - **Byte-pinned prompt stack:** `src/agent/prompts/` (grammar.md, mode files, `mini-skills/`, `genui-packs/`). The golden baseline is `src/live-agent/prompt-equivalence.baseline.json`, asserted by `prompt-equivalence.test.ts`. Recapture it only after a deliberate text change, with the command from `.claude/skills/a2ui-prompt-authoring/SKILL.md` lines 35-36: `RECAPTURE_BASELINE=1 npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/recapture-baseline.test.ts`. That test file exists. Diff the baseline afterwards.
   - **Catalogs:** `src/catalog/default`, `src/catalog/a2ui-basic`, `src/catalog/personas/*`. Catalog content is hand-curated under the agreement gate `src/catalog/default/descriptor-agreement.test.ts`. Cite ADR-0169 (`.claude/docs/adr/0169-a2ui-basic-catalog-upstream-interop.md`).
   - **Trust boundary:** keys and `produce()` stay out of `devtools`, and the boundary is `/__a2ui/agent`. Cite ADR-0073 (`0073-a2ui-live-model-provider-seam.md`).
   - **Node-only fence:** `src/agent/gates.test.ts` `NODE_ALLOWED` (line 105). Cite ADR-0137 (`0137-a2ui-agent-producer-toolkit-export.md`).
   - **Wire and validator spine:** `src/protocol.ts`. SPEC files are under `.claude/docs/spec/a2ui-*.spec.md` and LLD files under `.claude/docs/lld/a2ui-*.lld.md`. Before naming any individual file, run `ls` on it.
   - **Skills:** `a2ui-build`, `a2ui-payload-authoring`, `a2ui-prompt-authoring`, `a2ui-multi-catalog`, `a2ui-corpus-curation` (all exist under `.claude/skills/`).
   - Do NOT mention selection sidecars or `selection.json`, because they exist only on unmerged PR #1800.

3. `packages/agent-ui/components/AGENTS.md`, at most 40 lines. It covers:
   - **Layer order:** `src/reactive/` <- `src/dom/` <- `src/traits/` <- `src/controls/`. Imports point downward only, and `a2ui` is never imported. `src/layering.test.ts` enforces it.
   - **Control folders:** one folder per control under `src/controls/`, with a descriptor `{name}.md`. `*.props.gen.ts` files are generated and never hand-edited. The generator is `scripts/generate-props.mjs` at the repo root, not under the package. It is backed by `src/descriptor/generate-props.ts` and drift-gated by `src/descriptor/generate-props.test.ts`. Controls self-define on import.
   - **Naming:** tags `ui-{name}`, classes `UI{Name}Element`, tokens `--ui-{name}-*`.
   - **Sizing:** fill-by-default with the reflected `inline` opt-out. Cite ADR-0223 (`0223-fill-by-default-fleet-sizing-contract.md`). `src/controls/sizing-gates.test.ts` is enforcing.
   - **DOM and ARIA:** light DOM by default, ARIA via `ElementInternals`.
   - **Skills:** `component-design`, `component-build`, `component-standards`, `component-packaging`, `component-testing` (all exist).

4. Do not restate the root `AGENTS.md` (package DAG, gates). Link to it or to `CLAUDE.md`.

5. Run `wc -l` on both `AGENTS.md` files, then `onboard.py check` and `npm run check`. In the final report, list any cited item you could not verify, and add "add the selection-sidecar line after #1800 merges". This step is also the gates green step.

### Acceptance criteria
- `for d in a2ui components; do test -f packages/agent-ui/$d/AGENTS.md || exit 1; done`
- `for d in a2ui components; do cmp -s docs/CLAUDE.md packages/agent-ui/$d/CLAUDE.md || exit 1; done`
- `for d in a2ui components; do test "$(wc -l < packages/agent-ui/$d/AGENTS.md)" -le 40 || exit 1; done`
- `for d in a2ui components; do ! grep -q '—' packages/agent-ui/$d/AGENTS.md || exit 1; done`
- `grep -qF 'RECAPTURE_BASELINE=1 npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/recapture-baseline.test.ts' packages/agent-ui/a2ui/AGENTS.md`
- `for t in prompt-equivalence.baseline.json NODE_ALLOWED ADR-0073 a2ui-prompt-authoring a2ui-multi-catalog a2ui-corpus-curation a2ui-build a2ui-payload-authoring; do grep -qF "$t" packages/agent-ui/a2ui/AGENTS.md || exit 1; done`
- `for t in sizing-gates.test.ts generate-props.mjs ElementInternals component-design component-build component-standards component-packaging component-testing; do grep -qF "$t" packages/agent-ui/components/AGENTS.md || exit 1; done`
- `! grep -qiE 'selection\.json|selection sidecar|sidecar' packages/agent-ui/a2ui/AGENTS.md`
- `test -z "$( { git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc"; } | grep -vxE 'packages/agent-ui/(a2ui|components)/(AGENTS|CLAUDE)\.md' )"`
- (guard) `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.20.5/scripts/onboard.py check`
- (guard) `npm run check`

## Assumptions
- The root `AGENTS.md` and `docs/CLAUDE.md` exist on this base: verified with `cat` and `od -c` of `docs/CLAUDE.md`, and the root file appears in the project context.
- All cited paths, skills and ADRs exist: verified with a `test -e` and `ls` probe of every file path, skill dir and ADR number.
- The recapture command exists: `.claude/skills/a2ui-prompt-authoring/SKILL.md:35` holds `RECAPTURE_BASELINE=1 npx vitest run --project packages \`, and `recapture-baseline.test.ts` exists.
- `npm run check` takes about 28 seconds: the handoff's measured fact, so the guard timeout is 90.
- `onboard.py check` reports the root file as `current`: from the earlier planner's preflight, not re-run in this pass. The guard exit code covers it at build time.

## Risks
- The `onboard.py check` guard may not exit 0 on this tree, because the new nested files are unmanaged and I did not re-run the command. A builder who sees that red should report it.
- Brevity: 40 lines is tight for the a2ui file, so the builder must link rather than restate.
