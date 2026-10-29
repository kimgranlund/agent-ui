<!-- role=planner level=L1 model=sonnet effort=medium -->
## Goal
Create nested `AGENTS.md` (at most 40 lines) plus a byte-identical `CLAUDE.md` for `packages/agent-ui/a2ui/` and `packages/agent-ui/components/`, docs only.

## Step 1: Write the two nested AGENTS.md files and their CLAUDE.md siblings
level: L1
### Do
Depends on: none

Create exactly four files and touch nothing else (not `.sdlc/`, not the root files).

1. `packages/agent-ui/a2ui/CLAUDE.md` and `packages/agent-ui/components/CLAUDE.md`. Copy `docs/CLAUDE.md` byte for byte, e.g. `cp docs/CLAUDE.md <dest>`. It is 3 lines: a `sdlc-lite:managed:start v1 sha256:336cc4fbf19b` marker, `@AGENTS.md`, and the end marker. Verified with `xxd`.

2. `packages/agent-ui/a2ui/AGENTS.md`, at most 40 lines. Use terse bullets and tables, no em dashes, and link to paths, ADRs and skills without restating their text. It covers:
   - **Byte-pinned prompt stack:** `src/agent/prompts/` (grammar.md, mode files, `mini-skills/`, `genui-packs/`). The golden baseline is `src/live-agent/prompt-equivalence.baseline.json`, asserted by `prompt-equivalence.test.ts`. Recapture it only after a deliberate text change, with this command (taken from `.claude/skills/a2ui-prompt-authoring/SKILL.md` lines 35-36, and `recapture-baseline.test.ts` exists): `RECAPTURE_BASELINE=1 npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/recapture-baseline.test.ts`. Diff the baseline afterwards.
   - **Catalogs:** `src/catalog/default`, `src/catalog/a2ui-basic`, `src/catalog/personas/*` (concierge, croupier, fixture-demo). Catalog content is hand-curated under the agreement gate `src/catalog/default/descriptor-agreement.test.ts`. Cite ADR-0169 (`.claude/docs/adr/0169-a2ui-basic-catalog-upstream-interop.md`).
   - **Trust boundary:** keys and `produce()` stay out of `devtools`, and the boundary is `/__a2ui/agent`. Cite ADR-0073 (`0073-a2ui-live-model-provider-seam.md`).
   - **Node-only fence:** `src/agent/gates.test.ts` `NODE_ALLOWED` (line 105). Cite ADR-0137.
   - **Wire and validator spine:** `src/protocol.ts`. SPEC files under `.claude/docs/spec/a2ui-*.spec.md` (for example `a2ui-runtime`, `a2ui-catalog`, `a2ui-message-lifecycle`). LLD files under `.claude/docs/lld/a2ui-*.lld.md` (for example `a2ui-renderer`, `a2ui-validator-finalize`, `a2ui-catalog`).
   - **Skills:** `a2ui-build`, `a2ui-payload-authoring`, `a2ui-prompt-authoring`, `a2ui-multi-catalog`, `a2ui-corpus-curation`.
   - Do NOT mention selection sidecars or `selection.json`.

3. `packages/agent-ui/components/AGENTS.md`, at most 40 lines. It covers:
   - **Layer order:** `src/reactive/` <- `src/dom/` <- `src/traits/` <- `src/controls/`. Imports point downward only, and `a2ui` is never imported. `src/layering.test.ts` enforces it.
   - **Control folders:** one folder per control under `src/controls/`, with a descriptor `{name}.md`. `*.props.gen.ts` files are generated and never hand-edited. The generator is `scripts/generate-props.mjs` at the repo root (not under the package), backed by `src/descriptor/generate-props.ts` and drift-gated by `src/descriptor/generate-props.test.ts`. Controls self-define on import.
   - **Naming:** tags `ui-{name}`, classes `UI{Name}Element`, tokens `--ui-{name}-*`.
   - **Sizing:** fill-by-default with the reflected `inline` opt-out (ADR-0223, `0223-fill-by-default-fleet-sizing-contract.md`). `src/controls/sizing-gates.test.ts` is enforcing.
   - **DOM and ARIA:** light DOM by default, ARIA via `ElementInternals`.
   - **Skills:** `component-design`, `component-build`, `component-standards`, `component-packaging`, `component-testing`.

4. Do not restate the root `AGENTS.md` (DAG, gates). Link to it or `CLAUDE.md` instead.

5. Run the checks: `wc -l` on both `AGENTS.md`, the `git ls-files`/`ls` path verifications, `onboard.py check`, and `npm run check`. In the final report, list any cited item you could not verify, and add "add the selection-sidecar line after #1800 merges".

Preflight facts (read-only probes, run during planning):
- Root `AGENTS.md` exists on this base, and `onboard.py check` reports it, `CLAUDE.md`, `docs/AGENTS.md` and `docs/CLAUDE.md` as `current`.
- Neither target directory has an `AGENTS.md`, `CLAUDE.md` or `scripts/` yet.
### Acceptance criteria
- `for d in a2ui components; do test -f packages/agent-ui/$d/AGENTS.md || exit 1; done`
- `for d in a2ui components; do cmp -s docs/CLAUDE.md packages/agent-ui/$d/CLAUDE.md || exit 1; done`
- `for d in a2ui components; do test "$(wc -l < packages/agent-ui/$d/AGENTS.md)" -le 40 || exit 1; done`
- `for d in a2ui components; do ! grep -q '—' packages/agent-ui/$d/AGENTS.md || exit 1; done`
- `grep -qF 'RECAPTURE_BASELINE=1 npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/recapture-baseline.test.ts' packages/agent-ui/a2ui/AGENTS.md`
- `for t in prompt-equivalence.baseline.json NODE_ALLOWED ADR-0073 a2ui-prompt-authoring a2ui-multi-catalog a2ui-corpus-curation a2ui-build a2ui-payload-authoring; do grep -qF "$t" packages/agent-ui/a2ui/AGENTS.md || exit 1; done`
- `! grep -qiE 'selection\.json|selection-guidance|sidecar' packages/agent-ui/a2ui/AGENTS.md`
- `for t in generate-props.mjs sizing-gates.test.ts ElementInternals component-design component-build component-standards component-packaging component-testing; do grep -qF "$t" packages/agent-ui/components/AGENTS.md || exit 1; done`
- Scope: `{ git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc"; } | sort -u | diff - <(printf '%s\n' packages/agent-ui/a2ui/AGENTS.md packages/agent-ui/a2ui/CLAUDE.md packages/agent-ui/components/AGENTS.md packages/agent-ui/components/CLAUDE.md)` exits 0
- (guard) `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.20.5/scripts/onboard.py check | grep -qE '^current AGENTS.md'`
- (guard) `npm run check` exits 0 (this is a one-step plan, so this step is the gates green step). Run it as `npm run check`; the exit code is the judge.

guard timeout: 900

## Assumptions
- Root `AGENTS.md` is on this base: verified by the preamble listing in the system context and by `onboard.py check` printing `current AGENTS.md`.
- The recapture command exists: verified at `.claude/skills/a2ui-prompt-authoring/SKILL.md` lines 35-36, and `recapture-baseline.test.ts` is in `src/live-agent/`.
- `scripts/generate-props.mjs` is at the repo root, not inside the components package: verified by `git ls-files`.
- `docs/CLAUDE.md` is the 3-line managed-block shape and a copy of it passes `onboard.py check`: verified by `xxd` and by `current docs/CLAUDE.md`.
- ADR-0073, ADR-0137, ADR-0169 and ADR-0223 files exist: verified by `ls .claude/docs/adr`.
- unresolved: the `npm run check` runtime was not timed, so the 900s guard timeout is a guess: the builder's first run settles it. Docs-only files cannot break `tsc`, so the risk is only the timeout.

## Risks
- The `npm run check` guard may be red from an inherited failure unrelated to this change. That comes back as builder `inherited red`.
- A builder may cite an ADR or LLD filename that does not exist. The path-verification step in the Do mitigates this.
- Packages whose `AGENTS.md` already mentions the root file's content may duplicate it. The 40-line cap and link-first rule limit this.
