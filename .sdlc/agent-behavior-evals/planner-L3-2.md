<!-- role=planner level=L3 model=opus effort=xhigh -->
## Goal
Ship a keyless, deterministic agent-behavior eval at `packages/agent-ui/a2ui/tools/agent-eval/`, run as `npm run eval:agent-behavior`. It scores concept selection, negative selection against `notFor` edges, repair, first-pass versus eventual success, and a per-persona leg. Its acceptance cases are protected by a pinned hash file checked in `check:scripts` (Kim's fork 4 ruling). Its selftest runs in `check:scripts`, and a live leg that needs a key is run by hand. The GH #1810 scrub list is applied.

## Step 1: Agent-behavior eval CLI, scorer, pinned fixtures, and wiring
level: L3
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Depends on: none. The brief is `.sdlc/agent-behavior-evals/handoff.md`. Forks 1, 2, 3, 5 and 6 are built as the handoff writes them. Fork 4 is built as option (a), per the handoff's `## Decision (Kim, 2026-10-05): fork 4` section.

Targets, all new, under `packages/agent-ui/a2ui/tools/agent-eval/`:
- `cases.ts`, `observe.ts`, `score.ts`, `legs.ts`, `scripted.ts`, `pins.ts`
- `eval-agent-behavior.ts` (the CLI entry)
- `fixtures/scripted-turns.json`, `fixtures/persona-cases.json`, `fixtures/pins.json`
- tests: `cases.test.ts`, `legs.test.ts`, `eval-agent-behavior.test.ts`, `wiring.test.ts`

Two existing files change: root `package.json` (two script keys only) and `vitest.config.ts` (one explicit include line). No other file changes, and no dependency is added.

Settled interfaces, with the evidence for each:

1. Case derivation, `cases.ts`.
   - `deriveSelectionCases(): SelectionCase[]` emits exactly one case per `notFor` edge across every sidecar. A `SelectionCase` is `{ id, source, catalogId, expectType, forbidType, why, prompt }`. `id` is `<source>:<A>-><B>`, where `source` is the sidecar pin (`agent-ui`, `a2ui-basic`, or a persona id). `expectType` is A, `forbidType` is B, and `prompt` is A's first intent, verbatim.
   - Base cases come from `selectionGuidanceFor(loadCatalogById(process.cwd(), id))` for `agent-ui` and `a2ui-basic`, with `loadCatalogById` from `tools/catalog-files.ts`.
   - Persona cases:
     - Discover persona ids with `readdirSync` over `packages/agent-ui/a2ui/src/catalog/personas/`, keeping every dir that holds a `selection.json`.
     - Load each fragment with `loadCatalogFragment(JSON.parse(readFileSync(<persona>/catalog.json)))` (`src/catalog/compose.ts:48`).
     - Compose it against the `agent-ui` base with `composeCatalog(base, fragment, id)` (`compose.ts:107`), which gives the catalog id `agent-ui--<persona>`.
     - Keep only edges from the fragment's own component keys.
   - Why the persona dir is scanned: `SHIPPED_PERSONA_CATALOG_MANIFESTS` cannot load under plain Node (`ERR_IMPORT_ATTRIBUTE_MISSING`; see the headers of `src/agent/selection-guidance.ts` and `tools/catalog-files.ts`). A planning probe ran this exact compose path under `node --experimental-strip-types`. It printed 144 + 20 base edges, plus 3 (concierge), 1 (croupier) and 1 (fixture-demo).
   - Also export:
     - `personaFragmentTypes(): Map<personaId, string[]>`, built from each fragment's `components` keys.
     - `loadCaseCatalog(catalogId)`, cached per id.
     - `loadPersonaCases(fixturesDir)`.
   - Fork 3 holds: selection cases are derived, never hand-listed. `persona-cases.json` is the hand-authored acceptance set fork 5 names, and fork 4 protects it.

2. Observation, `observe.ts`.
   - `observeTurn({ catalog, prompt }, deps: { provider, retrieve?, model? }): Promise<TurnObservation>` runs the real `produce()` (`src/agent/produce.ts:962`). It passes `opts.maxRounds: 3`, the input `{ kind: 'intent', text: prompt, session: { turns: [] } }`, and `ProduceDeps` `{ provider, retrieve, catalog }` (`produce.ts:93`).
   - It wraps `deps.provider` to count `stream()` calls and to capture each round's raw text. `produce()` makes exactly one `deps.provider.stream` call per round (`produce.ts:1048`, inside the loop at `:1000`). Repair accounting therefore counts `produce()` rounds only. A provider-level retry lives inside one `stream()` call and is never counted (GH #1797).
   - `TurnObservation` is `{ outcome: 'first-pass' | 'eventual' | 'halt', rounds, failureCodes: string[] | null, emittedTypes: string[], attemptedTypes: string[][] }`.
   - Where `rounds` and `failureCodes` come from:
     - When the meta-line trace rides the turn, use `trace.rounds` and `trace.failureCodes` (`TurnTrace`, `src/agent/meta-line.ts:84-95`).
     - Otherwise `rounds` is the wrapper's call count.
     - On `ProduceHalt`, `failureCodes` is `failures[].code`.
     - Otherwise it is `null`, reported as not observed and never invented.
   - The trace rides only when the model emits a note (`produce.ts:1143`, `:1238`). A planning probe showed a note-less valid round yields no trace. So every successful scripted round carries a leading note line, `{"a2uiMeta":{"note":"scripted"}}`.
   - `emittedTypes` holds the component types of the validated A2UI lines.
   - `attemptedTypes[i]` holds the `updateComponents.components[].component` values parsed from round i's raw text. Lines that fail to parse are skipped.
   - `TurnTrace` is read, never changed.

3. Scoring, `score.ts`: pure, no IO.
   - Negative selection fails when `forbidType` is in `emittedTypes`.
   - Concept selection fails when `expectType` is absent from `emittedTypes`. A halt fails concept.
   - Persona fails when any round's `attemptedTypes` holds a foreign type. The failure names the type and the round.
     - Attempted types are used because a Quant turn with `PlayingCard` halts: the probe showed base `agent-ui` returns `CATALOG at root` for three rounds, while `agent-ui--croupier` accepts the same payload.
     - A case's foreign types are every fragment type of every persona other than its own. Quant has no fragment (`site/pages/agent-admin-presets.ts:219`), so every fragment type is foreign to it.
   - Repair outcome: rounds 1 and valid is first-pass; valid in more rounds is eventual; a `ProduceHalt` is a halt.

4. Legs, `legs.ts`.
   - `runSelectionLeg(cases, deps)` and `runPersonaLeg(cases, deps)` each return `{ exitCode: 0 | 1, lines: string[], observations }`. The exit code is 1 when any case fails, and each failing line names the offending type.
   - Repair is reported on every turn's line, plus summary counts (first-pass, eventual, halt). It is never a separate pass or fail.
   - Retrieval:
     - Scripted runs pass `retrieve: () => []`.
     - Live runs pass `(q) => retrieve(loadA2uiShard(process.cwd()), q)`, as `tools/corpus-genui/legs/generate.ts:64,92` does.
   - `scripted.ts` exports `scriptedProvider(rounds: readonly string[]): AgentProvider`. On call n it yields `rounds[min(n, len - 1)]`, like `stubProvider` in `src/live-agent/produce-loop.test.ts`.

5. Fixtures.
   - JSON only, read from `<repoRoot>/packages/agent-ui/a2ui/tools/agent-eval/fixtures/`.
   - No scripted or persona prompt may match `EXPLICIT_CLOSE_RE` or `CONFIRM_COMMIT_RE` (`produce.ts:871-880`). A match would trigger a FLOW_END correction round that inflates `rounds`.
   - These payloads were validated by the planning probe:
     - a Code root with `code: "npm test"` and a Text root with `text: "Quarterly report"`, valid on `agent-ui`
     - a PlayingCard root with `rank` and `suit`, valid on `agent-ui--croupier`
     - the `INVALID` and `VALID` strings from `produce-loop.test.ts:29-35`
   - Probed outcomes:
     - `INVALID` then note plus `VALID`: trace rounds 2, failureCodes `["CATALOG"]`.
     - Note plus `VALID`: rounds 1, failureCodes `[]`.
     - `INVALID` alone: halt after 3 calls, codes `["CATALOG"]`.
   - `scripted-turns.json` shape:
     ```json
     { "label": "scripted", "turns": [
       { "id": "<turn id>", "leg": "selection | persona | repair",
         "case": { "...": "a SelectionCase or PersonaCase, inline" },
         "rounds": ["<raw provider text for round 1>", "..."],
         "expect": { "exitCode": 1, "names": "Code", "outcome": "first-pass", "rounds": 1, "failureCodes": ["CATALOG"] } } ] }
     ```
     Each `expect` key is optional. When present, `failureCodes` is an exact array match.
   - Required turns:

     | Turn | Leg | Case | Rounds | Expect |
     |---|---|---|---|---|
     | `selection-forbidden-code` | selection | `agent-ui:Text->Code`, prompt "headings and prose" | note plus Code root | exitCode 1, names Code |
     | `selection-clean-text` | selection | same case | note plus Text root | exitCode 0 |
     | `repair-eventual` | repair | `agent-ui` | `INVALID`, then note plus `VALID` | outcome eventual, rounds 2, failureCodes `["CATALOG"]` |
     | `repair-first-pass` | repair | `agent-ui` | note plus `VALID` | outcome first-pass, rounds 1 |
     | `repair-halt` | repair | `agent-ui` | `INVALID` | outcome halt, rounds 3 |
     | `persona-quant-playing-card` | persona | persona quant on `agent-ui` | note plus PlayingCard root | exitCode 1, names PlayingCard |
     | `persona-croupier-clean` | persona | persona croupier on `agent-ui--croupier` | note plus PlayingCard | exitCode 0 |

   - `persona-cases.json` holds the live persona cases:
     ```json
     { "label": "acceptance", "cases": [
       { "id": "croupier-playing-card", "persona": "croupier", "catalogId": "agent-ui--croupier", "prompt": "Deal me one playing card", "expectType": "PlayingCard" },
       { "id": "concierge-booking-form", "persona": "concierge", "catalogId": "agent-ui--concierge", "prompt": "I want to book a table for two on Friday", "expectType": "BookingForm" },
       { "id": "quant-no-persona-types", "persona": "quant", "catalogId": "agent-ui", "prompt": "What are the odds of drawing an ace from a standard deck?" } ] }
     ```

6. Pins, `pins.ts` (fork 4, Kim's ruling: a pinned hash file verified in `check:scripts`).
   - `verifyPins(dir: string): { ok: boolean, problems: string[] }` reads `<dir>/pins.json` and hashes each file's raw bytes with `node:crypto` sha256. It never hashes re-serialized JSON, so appending one byte changes the hash.
   - Checked files: every regular file directly in `dir` whose name does not start with `.`, except `pins.json`. Dotfiles are skipped so a macOS `.DS_Store` never reds `check:scripts`.
   - Each of these adds a problem that names the file: a hash mismatch, an unpinned file, or a pin entry for a missing file.
   - Format:
     ```json
     { "algorithm": "sha256", "files": { "persona-cases.json": "<hex>", "scripted-turns.json": "<hex>" } }
     ```
   - `verifyPins` is generic over any dir that holds a `pins.json`. The handoff's decision says the same rule will cover T-0011's seeded-defect fixtures, which can import it. This step builds and wires nothing for T-0011.
   - There is no `pin` subcommand. The CLI header says to update a pin by hand with `shasum -a 256 <file>`, in the same change as the fixture edit.

7. CLI, `eval-agent-behavior.ts`.
   - It exports `runCli(argv, repoRoot, env): Promise<number>`. `main()` runs only behind `process.argv[1]?.endsWith('eval-agent-behavior.ts')`, the `eval-genui-corpus.ts:217` precedent. The vitest `tools` include comment requires this guard.
   - Subcommands:
     - `--help`, or no argument: exits 0.
     - An unknown subcommand: exits 2.
     - `selftest [--repo-root <dir>]`, in this order:
       1. Read and parse `scripted-turns.json`, `persona-cases.json` and `pins.json`. A missing or unparseable file exits 2.
       2. Run `verifyPins` on the fixtures dir. Any problem exits 1 and lists each problem.
       3. Run every scripted turn with `scriptedProvider`, through its leg runner, or through `observeTurn` for repair turns, and compare against `expect`.
       4. Print one line per result, starting with `scripted ` (for example `scripted PASS selection-forbidden-code expected exit 1 got 1, names Code`).
       5. Exit 0 when all match, 1 on any mismatch.
     - `live --leg selection|persona [--model <id>] [--only <case-id substring>] [--repo-root <dir>]`, mirroring `eval-genui-corpus.ts:111-129`, in this order:
       1. A missing or unknown `--leg` exits 2.
       2. Read `packages/agent-ui/a2ui/tools/agent/providers.json` from `process.cwd()` and check it with `validateProvidersConfig`. The default model is `providers.anthropic.defaultModel`. `resolvePair(cfg, 'anthropic', model)` from `tools/agent/providers-config.ts:96` must succeed, or the CLI exits 2.
       3. `readAnthropicApiKey(repoRoot, env)` (`tools/corpus-genui/fs.ts:285`) returning nothing exits 2, with a message that names `ANTHROPIC_API_KEY`.
       4. Build `anthropicProvider({ apiKey, endpoint })`.
       5. `--only` with zero matches exits 2.
       6. Print results to stdout, prefixed `live model=<id>`. Exit 1 if any case fails.
   - `--repo-root` redirects only the `.env` lookup and the fixtures dir. `providers.json`, the catalogs and the sidecars always come from `process.cwd()`, because `selection-guidance.ts:22` reads the sidecars from cwd at module load. This is why `live --leg selection --repo-root <tmp>` reaches the key check and exits 2.
   - No module in this dir writes a file, and there is no report file, so "no stub score in any report artifact" holds by construction. Only `*.test.ts` files may write, and only to their own temp copies.
   - Only the CLI entry may name `anthropicProvider`, `readAnthropicApiKey` or `ANTHROPIC_API_KEY`, comments included.
   - No module may import `@agent-ui/app` or `@agent-ui/devtools`, or `planted.ts` (`src/layering.test.ts` scans `tools/**` for it).
   - No em dashes.

8. Tests. Stub outputs are loaded from `fixtures/scripted-turns.json` by turn id, so the pinned cases are the acceptance proofs. Use these exact `it` titles:
   - `selection leg exits 1 and names the forbidden notFor type`
   - `a clean scripted selection turn passes concept and negative selection`
   - `invalid then valid scores eventual success with rounds 2 and the fed-back failureCodes`
   - `first valid scores first-pass with rounds 1`
   - `never valid scores a halt`
   - `every notFor edge across the five sidecars yields exactly one case`: walk `src/catalog/` for `selection.json` on its own, parse the raw JSON, and compare sorted id lists. Never compare against a literal count.
   - `a Quant turn containing a Croupier-only type fails the persona leg and names the type`
   - `a croupier turn with PlayingCard on its derived catalog passes the persona leg`
   - `live with no key exits 2`: spawn the entry at the real cwd with `--repo-root <tmp>` and an env without the key, the GH #1592 precedent. The main checkout carries a `.env`.
   - `no agent-eval test constructs the real anthropicProvider`: build the regex from split string parts so the file never matches itself. As the anti-vacuous control, assert that the entry file does match.
   - `editing a protected fixture without its pin fails the pin check`
   - `an unpinned new fixture fails the pin check`
   - `check:scripts runs the selftest and no standing gate runs the live leg`: mirror `tools/corpus-genui/wiring.test.ts`, and also assert the literal `vitest.config.ts` include line.
   - `every selftest result line is labeled scripted`

9. Wiring.
   - `package.json` adds the key `"eval:agent-behavior": "node --experimental-strip-types packages/agent-ui/a2ui/tools/agent-eval/eval-agent-behavior.ts"`.
   - It appends ` && node --experimental-strip-types packages/agent-ui/a2ui/tools/agent-eval/eval-agent-behavior.ts selftest` to the end of `check:scripts`. No other key changes. CI runs `npm run check` on Node 24 (`.github/workflows/ci.yml:32,38`), so the flag is available.
   - `vitest.config.ts` gets the explicit line `'packages/agent-ui/a2ui/tools/agent-eval/*.test.ts',` in the `tools` project include, never a wildcard (the GH #112 rule), with a comment citing GH #1810.

Contract dependents:
- `tools/corpus-genui/wiring.test.ts` asserts that no standing gate names `eval-genui-corpus` and that its own include line exists. Both stay true, and the file is untouched.
- `site/pages/code-demo.ts:50` names only the `check` sub-script chain, so it is unaffected.
- `tsconfig.tools.json` already includes `packages/agent-ui/*/tools` with Node types, so the new files ride `check:tools`.
- `src/agent/gates.test.ts` scans only `src/`, and `build-key-safety.test.ts` lists fixed files. Neither sees the new dir.

Focused checks: `npx vitest run --project tools packages/agent-ui/a2ui/tools/agent-eval/`, `npm run check:tools`, and the selftest. The whole-suite gates are step 2's.
### Acceptance criteria
- `out=$(mktemp) && { npx vitest run --project tools packages/agent-ui/a2ui/tools/agent-eval/ --reporter=json --outputFile="$out" >/dev/null 2>&1; rc=$?; }; node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const ok=new Set(r.testResults.flatMap(f=>f.assertionResults).filter(a=>a.status==="passed").map(a=>a.title));const miss=process.argv.slice(2).filter(t=>!ok.has(t));if(miss.length){console.error("not passed: "+miss.join("; "));process.exit(1)}' "$out" "selection leg exits 1 and names the forbidden notFor type" "a clean scripted selection turn passes concept and negative selection" "invalid then valid scores eventual success with rounds 2 and the fed-back failureCodes" "first valid scores first-pass with rounds 1" "never valid scores a halt" "every notFor edge across the five sidecars yields exactly one case" "a Quant turn containing a Croupier-only type fails the persona leg and names the type" "a croupier turn with PlayingCard on its derived catalog passes the persona leg" && test "${rc:-x}" = 0`
- `out=$(mktemp) && { npx vitest run --project tools packages/agent-ui/a2ui/tools/agent-eval/ --reporter=json --outputFile="$out" >/dev/null 2>&1; rc=$?; }; node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const ok=new Set(r.testResults.flatMap(f=>f.assertionResults).filter(a=>a.status==="passed").map(a=>a.title));const miss=process.argv.slice(2).filter(t=>!ok.has(t));if(miss.length){console.error("not passed: "+miss.join("; "));process.exit(1)}' "$out" "live with no key exits 2" "no agent-eval test constructs the real anthropicProvider" "editing a protected fixture without its pin fails the pin check" "an unpinned new fixture fails the pin check" "check:scripts runs the selftest and no standing gate runs the live leg" "every selftest result line is labeled scripted" && test "${rc:-x}" = 0`
- `node --experimental-strip-types packages/agent-ui/a2ui/tools/agent-eval/eval-agent-behavior.ts selftest`
- `tmp=$(mktemp -d) && d="$tmp/packages/agent-ui/a2ui/tools/agent-eval" && mkdir -p "$d" && cp -R packages/agent-ui/a2ui/tools/agent-eval/fixtures "$d/" && { node --experimental-strip-types packages/agent-ui/a2ui/tools/agent-eval/eval-agent-behavior.ts selftest --repo-root "$tmp" >/dev/null 2>&1; rc0=$?; } && printf " " >> "$d/fixtures/scripted-turns.json" && { node --experimental-strip-types packages/agent-ui/a2ui/tools/agent-eval/eval-agent-behavior.ts selftest --repo-root "$tmp" >/dev/null 2>&1; rc1=$?; }; test "${rc0:-x}" = 0 && test "${rc1:-x}" = 1`
- `tmp=$(mktemp -d) && { env -u ANTHROPIC_API_KEY node --experimental-strip-types packages/agent-ui/a2ui/tools/agent-eval/eval-agent-behavior.ts live --leg selection --repo-root "$tmp" >/dev/null 2>&1; rc=$?; }; test "${rc:-x}" = 2`
- `test "$(grep -rlE "anthropicProvider|readAnthropicApiKey|ANTHROPIC_API_KEY" packages/agent-ui/a2ui/tools/agent-eval --include="*.ts" | grep -v "\.test\.ts$")" = "packages/agent-ui/a2ui/tools/agent-eval/eval-agent-behavior.ts"`
- `node -e 'const {execSync}=require("child_process");const b=JSON.parse(execSync("git show "+process.env.SDLC_BASE_SHA+":package.json","utf8"));const h=require("./package.json");const eq=(x,y)=>JSON.stringify(x)===JSON.stringify(y);const keys=[...new Set([...Object.keys(b.scripts),...Object.keys(h.scripts)])];const changed=keys.filter(k=>b.scripts[k]!==h.scripts[k]).sort().join(",");const ok=(h.scripts["eval:agent-behavior"] ?? "").includes("packages/agent-ui/a2ui/tools/agent-eval/eval-agent-behavior.ts")&&(h.scripts["check:scripts"] ?? "").startsWith(b.scripts["check:scripts"]+" && ")&&h.scripts["check:scripts"].endsWith("eval-agent-behavior.ts selftest")&&eq(b.dependencies,h.dependencies)&&eq(b.devDependencies,h.devDependencies)&&changed==="check:scripts,eval:agent-behavior";process.exit(ok?0:1)'`
- (guard) `! grep -rlE "(writeFileSync|appendFileSync|writeFile|appendFile|createWriteStream)\(" packages/agent-ui/a2ui/tools/agent-eval --include="*.ts" | grep -v "\.test\.ts$"`
- (guard) `! grep -rnE "(from|import\()[[:space:]]*['\"][^'\"]*(@agent-ui/(app|devtools)|/(app|devtools)/src/)" packages/agent-ui/a2ui/tools/agent-eval`
- (guard) `! { git diff "$SDLC_BASE_SHA" -- package.json vitest.config.ts | grep "^+"; cat packages/agent-ui/a2ui/tools/agent-eval/*.ts packages/agent-ui/a2ui/tools/agent-eval/fixtures/*.json 2>/dev/null; } | grep -q "$(printf "\342\200\224")"`
- (guard) `! { git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc"; } | grep -vE "^(packages/agent-ui/a2ui/tools/agent-eval/|package\.json$|vitest\.config\.ts$)"`

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

## Assumptions
- Fork 4 is settled as option (a), a pinned hash file verified in `check:scripts`: verified by the handoff's `## Decision (Kim, 2026-10-05): fork 4` section, which also says no unresolved assumption remains on fork 4. The rerun changes the first plan's step 1 only by recording this ruling, skipping dotfiles in `verifyPins`, and stating the CLI's file-read order and the `--repo-root` scope.
- HEAD is `f348f2bb`, the same commit the first plan was written against: verified with `git reflog` (last move 08:55, before the first planner ran).
- `produce()` calls `deps.provider.stream` once per round: verified at `packages/agent-ui/a2ui/src/agent/produce.ts:1048`, inside the loop at `:1000`, and by a probe that counted 1, 2 and 3 calls for the first-pass, eventual and halt stubs.
- `TurnTrace` rides the output only when a note is present: verified at `produce.ts:1143` and `:1238`, and by a probe in which a note-less valid round gave a null trace. `trace.failureCodes` holds the codes fed back into the successful round: the probe gave `["CATALOG"]` for `INVALID` followed by note plus `VALID`.
- Base `agent-ui` rejects `PlayingCard` (halt, `CATALOG at root`, 3 calls) and `agent-ui--croupier` accepts it: verified by a plain-Node probe through `loadCatalogById`, `loadCatalogFragment`, `composeCatalog` and `produce`.
- Code with `code`, Text with `text`, and PlayingCard with `rank`/`suit` are valid scripted payloads: verified by the same probe. The `agent-ui` Text entry's first intent is "headings and prose", and its first `notFor` edge is Code.
- 169 `notFor` edges exist at HEAD (144, 20, 3, 1, 1): verified by the probe. The plan pins no count.
- `selection-guidance.ts` reads all five sidecars from `process.cwd()` at module load: verified at `selection-guidance.ts:22` and `:181-186`.
- `resolvePair` and `validateProvidersConfig` live in `tools/agent/providers-config.ts` (`:96`, `:42`), and `readAnthropicApiKey(repoRoot, env)` is at `tools/corpus-genui/fs.ts:285`: verified with `git grep`.
- Vitest exits 0 when `-t` matches nothing, so the title criteria parse the JSON reporter: the first plan verified this shape. At HEAD, both title criteria exit 1.
- Every step 1 and step 2 criterion was probed at HEAD. The new-behavior criteria are red because the dir, the script keys and the doc lines are missing. Every guard is green, and each was seen red on a fixture (a write call, an `@agent-ui/app` import, an em dash in a tracked diff and in an untracked file, an out-of-scope path, an edited D7 row). The probes ran under both `bash -c` with BSD grep and the zsh shell, where `grep` is ugrep, with the same results.
- At HEAD, `npm run check` exits 0 in 46s and `npm test` exits 0 in 117s (12,654 passed) at load 17: measured during this planning run, so `guard timeout: 480` is about three times the slowest guard plus load slack.
- No code pins the `check:scripts` string, and `tools/corpus-genui/wiring.test.ts` only forbids standing gates from naming `eval-genui-corpus`: verified with `git grep`.
- Quant has no catalog fragment: verified at `site/pages/agent-admin-presets.ts:219` (handoff context).

## Risks
- Pins make edits visible but do not stop them. A seat that edits a fixture and `pins.json` together passes `check:scripts`, and only the diff shows it. Kim accepted this with option (a).
- Live negative selection is strict. A forbidden type anywhere in the validated payload fails the case, so an edge whose target is a common building block (Text, Column, Card) will fail composite surfaces that also use the expected type. The live leg is a manual measurement, not a gate.
- Live persona cases run on the derived catalog without the persona's `personaSystem` voice section, because the persona manifests cannot load under plain Node. They measure catalog-driven selection, not the full persona prompt.
- Some derived intents match the close or commit regexes. For example, BookingConfirmation's "confirm a completed booking" matches `CONFIRM_COMMIT_RE`. On a live turn this spends a FLOW_END correction round, so `failureCodes` shows `FLOW_END_MISSING` and `rounds` counts the turn as eventual. The scripted fixtures avoid such words.
- Lanes that land first can move the case source. T-0007 rewrites sidecar `why` text, and GH #1812 may add personas. The bijection test derives at run time and stays green, but `persona-cases.json` and its pin would then need a deliberate update. GH #1811 may move the catalog paths that `catalog-files.ts` and the persona dir scan read.
- Shared docs will conflict on rebase: the live-agent SPEC/LLD (T-0006, T-0003), `test-craft.md` (T-0009), and `CLAUDE.md`/`AGENTS.md` (#1814). The criteria check membership only, so a rebase keeps them green, and the version bumps are relative to the header at build time.
- Host load has ranged from 7 to 40. Under heavy load `npm test` could exceed the 480s guard timeout and need a rerun; `flaky-gates` covers that triage.
