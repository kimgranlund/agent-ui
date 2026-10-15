<!-- role=planner level=L3 model=opus effort=xhigh -->
## Goal
Add `packages/agent-ui/a2ui/AGENTS.md` and `packages/agent-ui/components/AGENTS.md`. Each is at most 40 lines, link-first, with no em dashes. Each gets a `CLAUDE.md` sibling copied byte for byte from `docs/CLAUDE.md`. Docs only.

## Step 1: Write the two nested AGENTS.md files and their CLAUDE.md siblings
level: L1
guard timeout: 120
### Do
Depends on: none. This replans `.sdlc/work/nested-agents-md/planner-L1-2.md` and fixes every finding in `.sdlc/work/nested-agents-md/plan-reviewer-L1.md`. This one step is also the gates green step.

Create exactly these four files and touch nothing else: not `.sdlc/`, not the root `AGENTS.md` or `CLAUDE.md`, not any managed block. None of the four exists yet, and no `AGENTS.md` sits in `packages/` or `packages/agent-ui/`.

The two content blocks below are indented four spaces only so the plan parser does not read their `## ` headings as plan sections. Write each file with exactly four leading spaces removed from every line (for example `sed 's/^    //'`), and drop the two fence lines. Criteria 5 and 8 check exact heading lines, so an indented copy fails.

1. `packages/agent-ui/a2ui/CLAUDE.md` and `packages/agent-ui/components/CLAUDE.md`: run `cp docs/CLAUDE.md <dest>` for each. The source is the 3-line managed block wrapping `@AGENTS.md` (checked with `od -c`). `onboard.py check` models only the root entries and `docs/` (`build_model` skips paths outside `docs/`), so these copies cannot change its output.

2. `packages/agent-ui/a2ui/AGENTS.md` (38 lines). Every pointer was settled at plan time:
   - Catalog content is hand-curated under ADR-0173 cl.5, not ADR-0169 (`src/catalog/default/descriptor-agreement.test.ts:1` and `:9`). ADR-0169 is cited only for the upstream interop catalog `a2ui-basic`.
   - ADR-0073 clause 5 makes the proxy the trust boundary. ADR-0200 holds the literal mount `/__a2ui/agent` and the rule that no key or `produce()` enters devtools (`.claude/docs/adr/0200-agent-ui-devtools-package.md:12`, `:28`, `:34`). The mount lives in `tools/agent/dev-proxy-plugin.ts`.
   - `NODE_ALLOWED` (`src/agent/gates.test.ts:105`) covers `src/agent/` modules only (ADR-0137 clause 4, `:115`).
   - `src/renderer/validate.ts` is the one shared validator (its line 1).
   - The recapture command is at `.claude/skills/a2ui-prompt-authoring/SKILL.md:35-36`. Run it from the repo root (vitest project `packages`, `vitest.config.ts:34`).
   - Leave out selection sidecars and `selection.json`: they exist only on unmerged PR #1800.

    ```markdown
    # @agent-ui/a2ui

    The A2UI protocol layer. Root `AGENTS.md` and `CLAUDE.md` hold the package DAG, gates and conventions; this file holds only what is local here.

    ## Byte-pinned prompt stack

    - `src/agent/prompts/` (`src/agent/prompts/grammar.md`, the mode files, `src/agent/prompts/mini-skills/`, `src/agent/prompts/genui-packs/`) is byte-pinned by the golden baseline `src/live-agent/prompt-equivalence.baseline.json`, asserted by `src/live-agent/prompt-equivalence.test.ts`.
    - After a deliberate prompt change, recapture from the repo root, then diff the baseline: `RECAPTURE_BASELINE=1 npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/recapture-baseline.test.ts`

    ## Catalogs

    | Catalog | Path |
    |---|---|
    | default | `src/catalog/default/` |
    | upstream interop (ADR-0169) | `src/catalog/a2ui-basic/` |
    | personas | `src/catalog/personas/` |

    - Catalog content is hand-curated, never generated (ADR-0173 cl.5). The agreement gate `src/catalog/default/descriptor-agreement.test.ts` checks each row against its component descriptor.

    ## Boundaries

    - Trust boundary: provider keys stay server-side behind the dev-proxy mount `/__a2ui/agent` (`tools/agent/dev-proxy-plugin.ts`, ADR-0073 clause 5). No key, provider adapter or `produce()` import may enter `@agent-ui/devtools` (ADR-0200).
    - Node-only fence: under `src/agent/`, only the modules in `NODE_ALLOWED` (`src/agent/gates.test.ts`) may import `node:*` (ADR-0137 clause 4).

    ## Wire and validator spine

    - Wire types `src/protocol.ts`; validator `src/renderer/validate.ts`.
    - SPEC `.claude/docs/spec/a2ui-runtime.spec.md`, `.claude/docs/spec/a2ui-message-lifecycle.spec.md`; LLD `.claude/docs/lld/a2ui-renderer.lld.md`, `.claude/docs/lld/a2ui-validator-finalize.lld.md`. The full set is `.claude/docs/spec/a2ui-*` and `.claude/docs/lld/a2ui-*`.

    ## Skills

    | Task | Skill |
    |---|---|
    | Renderer, catalog, validator, protocol code | `a2ui-build` |
    | Compose or debug a payload | `a2ui-payload-authoring` |
    | Prompt stack and baseline recapture | `a2ui-prompt-authoring` |
    | Add or compose a catalog | `a2ui-multi-catalog` |
    | Corpus seeds and admission | `a2ui-corpus-curation` |
    ```

3. `packages/agent-ui/components/AGENTS.md` (35 lines). Settled pointers:
   - The props drift gate is `src/descriptor/props-gen-driftwire.test.ts` (ADR-0173 cl.4b, its line 1). Never cite `src/descriptor/generate-props.test.ts` as the drift gate: it is the generator's synthetic unit test (`generate-props.test.ts:4-9`).
   - Only converted controls carry a `{name}.props.gen.ts`: 11 of 79 control folders today (`CONVERTED` at `props-gen-driftwire.test.ts:20`). So the text says "a converted control". The CLI usage `node scripts/generate-props.mjs <name>`, run from the repo root, is at `scripts/generate-props.mjs:11-13`.
   - The layer line writes `src/reactive/` and so on, not the root file's `reactive/`. The file sits at the package root, and criterion 3 resolves every code-span path against the package folder, then the repo root. `src/layering.test.ts` allows only `@agent-ui/shared` and `@agent-ui/icons` as outside imports, and that is what bars `@agent-ui/a2ui`.

    ```markdown
    # @agent-ui/components

    The framework: signals kernel, base elements, traits and the `ui-*` controls. Root `AGENTS.md` and `CLAUDE.md` hold the package DAG, gates and conventions; this file holds only what is local here.

    ## Layers

    - `src/reactive/` <- `src/dom/` <- `src/traits/` <- `src/controls/`. A file imports only from its own or a lower layer, and never from `@agent-ui/a2ui`. Gate: `src/layering.test.ts`.

    ## Controls

    - One folder per control under `src/controls/`, holding its descriptor `{name}.md`. A control self-defines its tag on import.
    - A converted control carries a generated `{name}.props.gen.ts`. Never hand-edit it; regenerate from the repo root with `node scripts/generate-props.mjs <name>`. Drift gate: `src/descriptor/props-gen-driftwire.test.ts` (ADR-0173).

    ## Naming

    | Thing | Shape |
    |---|---|
    | Tag | `ui-{name}` |
    | Class | `UI{Name}Element` |
    | Tokens | `--ui-{name}-*` |

    ## Sizing, DOM and ARIA

    - Fill-by-default: a control is block-level and fills its container; the reflected `inline` boolean is the one opt-out (ADR-0223). `src/controls/sizing-gates.test.ts` is enforcing.
    - Light DOM by default; ARIA goes through `ElementInternals`, never host attributes.

    ## Skills

    | Task | Skill |
    |---|---|
    | Design intake for a new control | `component-design` |
    | Build or upgrade a control | `component-build` |
    | Anatomy, geometry, states, tokens | `component-standards` |
    | Folder, descriptor, exports | `component-packaging` |
    | Test bar | `component-testing` |
    ```

4. Run every criterion below, then `npm run check`. It took 39 s on this host at plan time, so `guard timeout: 120` is about three times that. The handoff's 90 came from an earlier 28 s run and would be only 2.3 times this one. Its red form is any nonzero exit, such as a tsc error. In the final report, list any cited item you could not verify (none expected: every path, ADR and skill above resolved at plan time). Also add the follow-up "add the selection-sidecar line after #1800 merges".

### Acceptance criteria
- `for d in a2ui components; do test -f packages/agent-ui/$d/AGENTS.md || exit 1; cmp -s docs/CLAUDE.md packages/agent-ui/$d/CLAUDE.md || exit 1; done`
- `e=$(printf '\342\200\224'); for d in a2ui components; do f=packages/agent-ui/$d/AGENTS.md; test "$(wc -l < "$f")" -le 40 || exit 1; test "$(grep -c "$e" "$f")" = 0 || exit 1; done`
- `b=$(printf '\140'); for d in a2ui components; do f=packages/agent-ui/$d/AGENTS.md; test -f "$f" || exit 1; for p in $(grep -oE "$b[^$b*{} ]+/[^$b*{} ]*$b" "$f" | tr -d "$b" | grep -v '^[/@]'); do if test -e "packages/agent-ui/$d/$p"; then :; elif test -e "$p"; then :; else echo "missing: $p"; exit 1; fi; done; for n in $(grep -oE 'ADR-[0-9]{4}' "$f" | cut -c5- | sort -u); do ls .claude/docs/adr/"$n"-*.md >/dev/null 2>&1 || exit 1; done; done`
- `grep -qF 'RECAPTURE_BASELINE=1 npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/recapture-baseline.test.ts' packages/agent-ui/a2ui/AGENTS.md`
- `f=packages/agent-ui/a2ui/AGENTS.md; grep -qx '# @agent-ui/a2ui' "$f" || exit 1; grep -qx '## Skills' "$f" || exit 1; for t in src/agent/prompts/ src/agent/prompts/mini-skills/ src/live-agent/prompt-equivalence.baseline.json src/live-agent/prompt-equivalence.test.ts src/catalog/default/ src/catalog/a2ui-basic/ src/catalog/personas/ src/catalog/default/descriptor-agreement.test.ts 'ADR-0173 cl.5' ADR-0169 /__a2ui/agent tools/agent/dev-proxy-plugin.ts 'produce()' @agent-ui/devtools ADR-0073 ADR-0200 NODE_ALLOWED src/agent/gates.test.ts ADR-0137 src/protocol.ts src/renderer/validate.ts .claude/docs/spec/a2ui- .claude/docs/lld/a2ui-; do grep -qF -- "$t" "$f" || exit 1; done`
- `b=$(printf '\140'); for s in a2ui-build a2ui-payload-authoring a2ui-prompt-authoring a2ui-multi-catalog a2ui-corpus-curation; do test -f .claude/skills/$s/SKILL.md || exit 1; grep -qF "$b$s$b" packages/agent-ui/a2ui/AGENTS.md || exit 1; done`
- `test "$(grep -ciE 'selection\.json|sidecar|selection-guidance' packages/agent-ui/a2ui/AGENTS.md)" = 0`
- `f=packages/agent-ui/components/AGENTS.md; b=$(printf '\140'); grep -qx '# @agent-ui/components' "$f" || exit 1; grep -qx '## Skills' "$f" || exit 1; test "$(grep -cF generate-props.test.ts "$f")" = 0 || exit 1; grep -qF "${b}src/reactive/$b <- ${b}src/dom/$b <- ${b}src/traits/$b <- ${b}src/controls/$b" "$f" || exit 1; for t in src/layering.test.ts @agent-ui/a2ui '{name}.md' '{name}.props.gen.ts' scripts/generate-props.mjs src/descriptor/props-gen-driftwire.test.ts ADR-0173 "${b}ui-{name}$b" "${b}UI{Name}Element$b" "${b}--ui-{name}-*$b" "${b}inline$b" ADR-0223 src/controls/sizing-gates.test.ts ElementInternals; do grep -qF -- "$t" "$f" || exit 1; done; grep -qi 'light DOM' "$f"`
- `b=$(printf '\140'); for s in component-design component-build component-standards component-packaging component-testing; do test -f .claude/skills/$s/SKILL.md || exit 1; grep -qF "$b$s$b" packages/agent-ui/components/AGENTS.md || exit 1; done`
- (guard) `test -z "$( { git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc"; } | grep -vxE 'packages/agent-ui/(a2ui|components)/(AGENTS|CLAUDE)\.md' )"`
- (guard) `out=$(python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.20.5/scripts/onboard.py check) && printf '%s\n' "$out" | grep -qx 'current AGENTS.md'`
- (guard) `npm run check`

## Assumptions
- `docs/CLAUDE.md` is the 3-line managed block wrapping `@AGENTS.md`: verified by `od -c docs/CLAUDE.md`.
- Every cited path, ADR and skill exists on this base. Verified by:
  - a `test -e` loop over every path in both content blocks
  - `ls .claude/docs/adr` (0073, 0137, 0169, 0173, 0200, 0223)
  - `ls .claude/skills`
  
  Criterion 3 re-runs the path and ADR check on the written files.
- The recapture command is real: it is at `.claude/skills/a2ui-prompt-authoring/SKILL.md:35-36`, `src/live-agent/recapture-baseline.test.ts` exists, and the vitest project `packages` is at `vitest.config.ts:34`.
- The props drift gate is `props-gen-driftwire.test.ts`, not `generate-props.test.ts`: verified at `props-gen-driftwire.test.ts:1-2` and `generate-props.test.ts:4-9`.
- Catalog hand-curation is ADR-0173 cl.5: verified at `descriptor-agreement.test.ts:1` and `:9`.
- ADR-0200 states `/__a2ui/agent` and the rule that devtools gets no key and no `produce()` (`:12`, `:28`, `:34`). ADR-0073 clause 5 (`:67`) makes the proxy the trust boundary.
- The new files cannot change `onboard.py check`: `build_model` in onboard.py only models paths under `docs/`, and `render_templates` lists only root and `docs/` entries. The guard passes on the current tree and fails on a /tmp fixture with an edited root block.
- No code reads package-root Markdown: `git grep` for `import.meta.glob` over `.md`, and for `readdirSync` over package dirs, finds only `prompts/`, ADR, skill-reference and package-name listings.
- `npm run check` passes and writes nothing: exit 0 in 39 s, with `git status --porcelain` identical before and after.
- The plan parses: `steps.py lint`, `specgate.py check` and `steps.py split` pass on a /tmp copy. The split handoff holds all 12 criteria, and both content blocks round-trip byte-identical through `sed 's/^    //'`.
- Every new-behavior criterion fails on the current tree because the files are missing, and passes on a /tmp fixture holding the two content blocks.
- Criteria 2, 3, 5 and 8 also fail on fixtures with an over-cap file, an em dash, a bogus path, the wrong ADR, the wrong drift gate, and indented headings.
- The scope guard fails with `SDLC_BASE_SHA` at `HEAD~1`.

## Risks
- An L1 builder may copy the blocks with the four-space indent intact. Criteria 5 and 8 catch it and force a rebuild.
- If a main sync changes `docs/CLAUDE.md` (an onboard template bump) between build and verify, criterion 1's `cmp` fails. The handoff asks for a byte-for-byte copy, so the criterion matches that.
- `npm run check` can fail from a main sync unrelated to these docs-only files (inherited red).
- The plan carries the full file text. A reviewer who prefers an outline may push back, but settled text removes both false-pointer findings from the last review.
