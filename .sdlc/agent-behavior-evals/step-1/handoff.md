## Task goal
A keyless, deterministic eval harness that scores producer turns on four behaviors (concept selection, negative selection against the `notFor` edges, repair from structured validator errors, first-pass versus eventual success) plus a per-persona leg, with a manual live leg for a real model and acceptance cases the generator cannot edit. Tracks GH #1810.

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
