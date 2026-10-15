<!-- role=planner level=L3 model=opus effort=xhigh -->
## Goal
Ship a keyless, deterministic agent-behavior eval at `packages/agent-ui/a2ui/tools/agent-eval/` (`npm run eval:agent-behavior`). It scores concept selection, negative selection against `notFor` edges, repair, and first-pass versus eventual success, plus a per-persona leg. Its acceptance cases are pin-protected, its selftest runs in `check:scripts`, a live leg needs a key and is run by hand, and the GH #1810 scrub list is applied.

## Step 1: Agent-behavior eval CLI, scorer, protected fixtures, and wiring
level: L3
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Depends on: none. The brief is `.sdlc/0005-agent-behavior-evals/handoff.md`. Forks 1, 2, 3, 5 and 6 are taken as the handoff writes them. Fork 4 is built as option (a) and listed under `unresolved:` in Assumptions.

Targets, all new, under `packages/agent-ui/a2ui/tools/agent-eval/`:
- `cases.ts`
- `observe.ts`
- `score.ts`
- `legs.ts`
- `scripted.ts`
- `pins.ts`
- `eval-agent-behavior.ts` (the CLI entry)
- `fixtures/scripted-turns.json`, `fixtures/persona-cases.json`, `fixtures/pins.json`
- tests: `cases.test.ts`, `legs.test.ts`, `eval-agent-behavior.test.ts`, `wiring.test.ts`

Two existing files change:
- root `package.json`: two script keys only.
- `vitest.config.ts`: one explicit include line.

No other file changes, and no dependency is added.

Settled interfaces and the evidence for each:

1. **Case derivation (`cases.ts`).**
   - `deriveSelectionCases(): SelectionCase[]` emits exactly one case per `notFor` edge across every sidecar. A `SelectionCase` is `{ id, source, catalogId, expectType, forbidType, why, prompt }`:
     - `id` is `<source>:<A>-><B>`, where `source` is the sidecar pin (`agent-ui`, `a2ui-basic`, or a persona id).
     - `expectType` is A and `forbidType` is B.
     - `prompt` is A's first intent, verbatim.
   - Base cases come from `selectionGuidanceFor(loadCatalogById(process.cwd(), id))` for `agent-ui` and `a2ui-basic`, using `tools/catalog-files.ts`.
   - Persona cases:
     - Discover persona ids with `readdirSync` over `packages/agent-ui/a2ui/src/catalog/personas/` (every dir holding `selection.json`).
     - Load each fragment with `loadCatalogFragment(JSON.parse(readFileSync(<persona>/catalog.json)))`.
     - Compose against the `agent-ui` base only, with `composeCatalog(base, fragment, id)`, so the catalog id is `agent-ui--<persona>`.
     - Keep only edges from the fragment's own component keys.
   - Why the persona dir is scanned: `SHIPPED_PERSONA_CATALOG_MANIFESTS` cannot load under plain Node (`ERR_IMPORT_ATTRIBUTE_MISSING`; see the `selection-guidance.ts` header and the `tools/catalog-files.ts` header). A planning probe ran this compose path under `node --experimental-strip-types`, and it worked.
   - Also export:
     - `personaFragmentTypes(): Map<personaId, string[]>`, derived from each fragment's `components` keys.
     - `loadCaseCatalog(catalogId)`, cached per id.
     - `loadPersonaCases(fixturesDir)`.
   - Fork 3 holds: selection cases are derived and never hand-listed. `persona-cases.json` is the hand-authored acceptance set that fork 5 names, and fork 4 protects it. This does not breach fork 3.

2. **Observation (`observe.ts`).**
   - `observeTurn({ catalog, prompt }, deps: { provider, retrieve?, model? }): Promise<TurnObservation>` runs the real `produce()` with `maxRounds: 3` and the input `{ kind: 'intent', text: prompt, session: { turns: [] } }`.
   - It wraps `deps.provider` to count `stream()` calls and to capture each round's raw text. `produce()` makes exactly one `deps.provider.stream` call per round (`produce.ts:1048`, inside the round loop that starts at `:1000`).
   - `TurnObservation` is `{ outcome: 'first-pass' | 'eventual' | 'halt', rounds, failureCodes: string[] | null, emittedTypes: string[], attemptedTypes: string[][] }`.
   - Where `rounds` and `failureCodes` come from:
     - When the meta-line trace rides the turn: `trace.rounds` and `trace.failureCodes`.
     - Otherwise `rounds` is the wrapper's call count.
     - On `ProduceHalt`: `failureCodes` is `failures[].code`.
     - Otherwise `null`, reported as not observed and never invented.
   - The trace rides only when the model emits a note (`produce.ts:1143`, `:1237-1238`). So every successful scripted round carries a leading note line, `{"a2uiMeta":{"note":"scripted"}}`.
   - `emittedTypes` holds the component types of the validated A2UI lines.
   - `attemptedTypes[i]` holds the `updateComponents.components[].component` values parsed from round i's raw text. Lines that fail to parse are skipped.
   - `TurnTrace` is read only, never changed.

3. **Scoring (`score.ts`, pure, no IO).**
   - Negative selection fails when `forbidType` is in `emittedTypes`. This is the handoff's plain reading of "B forbidden".
   - Concept selection fails when `expectType` is absent from `emittedTypes`. A halt fails concept.
   - Persona fails when any round's `attemptedTypes` holds a foreign type, and the failure names the type and the round. Attempted types are used because the Quant plus `PlayingCard` turn halts: the base catalog returns `CATALOG at root` for `PlayingCard` (planning probe) and the derived `agent-ui--croupier` catalog accepts it.
   - A case's foreign types are every fragment type of every persona other than its own. Quant has no fragment (`site/pages/agent-admin-presets.ts:219`), so all fragment types are foreign to it.
   - Repair is reported from `outcome`, `rounds` and `failureCodes`. The rule: `rounds` 1 and valid is first-pass, valid with more rounds is eventual, and a `ProduceHalt` is a halt.

4. **Legs (`legs.ts`).**
   - Signatures:
     - `runSelectionLeg(cases, deps)` and `runPersonaLeg(cases, deps)` return `{ exitCode: 0 | 1, lines: string[], observations }`.
     - The exit code is 1 if any case fails, and each failing line names the offending type.
   - Repair is reported on every turn's line plus summary counts (first-pass, eventual, halt). It is never a separate pass or fail.
   - Retrieval:
     - Scripted runs pass `retrieve: () => []`.
     - Live runs pass `retrieve(loadA2uiShard(process.cwd()), q)`, exactly as `tools/corpus-genui/legs/generate.ts` does.
   - `scripted.ts` exports `scriptedProvider(rounds: readonly string[]): AgentProvider`. It yields `rounds[min(n, len - 1)]` on call n, as the `stubProvider` in `src/live-agent/produce-loop.test.ts` does.

5. **Fixtures.**
   - JSON only, read from `<repoRoot>/packages/agent-ui/a2ui/tools/agent-eval/fixtures/`.
   - Scripted prompts and persona prompts must not match `EXPLICIT_CLOSE_RE` or `CONFIRM_COMMIT_RE` (`produce.ts:871-880`). If one does, a FLOW_END correction round inflates `rounds`.
   - Payloads in the next table were validated by a planning probe:
     - Code root with `code: "npm test"`: valid on `agent-ui`.
     - Text root with `text: "Quarterly report"`: valid on `agent-ui`.
     - PlayingCard root with `rank` and `suit`: valid on `agent-ui--croupier`.
     - The `INVALID` and `VALID` strings from `produce-loop.test.ts`: invalid and valid as named.
   - `scripted-turns.json` has this shape:
     ```json
     { "label": "scripted", "turns": [
       { "id": "<turn id>", "leg": "selection | persona | repair",
         "case": { "...": "a SelectionCase or PersonaCase, inline" },
         "rounds": ["<raw provider text for round 1>", "..."],
         "expect": { "exitCode": 1, "names": "Code", "outcome": "first-pass", "rounds": 1, "failureCodes": ["CATALOG"] } } ] }
     ```
     Each `expect` key is optional. When present, `failureCodes` is an exact array match.
   - The required turns:

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

6. **Pins (`pins.ts`, fork 4 option a).**
   - `verifyPins(fixturesDir): { ok, problems: string[] }` hashes the raw file bytes with `node:crypto` sha256. It must never hash re-serialized JSON, so that an appended byte changes the hash.
   - Every file in `fixtures/` except `pins.json` needs a matching entry. A mismatch, an unpinned file, or an entry for a missing file each adds a problem that names the file.
   - The format is:
     ```json
     { "algorithm": "sha256", "files": { "persona-cases.json": "<hex>", "scripted-turns.json": "<hex>" } }
     ```
   - There is no `pin` subcommand. The CLI header says to update a pin by hand with `shasum -a 256 <file>`.

7. **CLI (`eval-agent-behavior.ts`).**
   - It exports `runCli(argv, repoRoot, env): Promise<number>`, and `main()` runs only behind the guard `process.argv[1]?.endsWith('eval-agent-behavior.ts')` (the `eval-genui-corpus.ts` precedent). The vitest `tools` include comment requires this guard before a new line may be armed.
   - Subcommands:
     - `--help` (or no argument): exits 0.
     - Unknown subcommand: exits 2.
     - `selftest [--repo-root <dir>]`:
       - Runs `verifyPins` first. A pin problem exits 1 with each problem listed.
       - Then runs every scripted turn through its leg runner, or through `observeTurn` for repair turns, using `scriptedProvider`, and compares against `expect`.
       - Each result prints one line that starts with `scripted ` (for example `scripted PASS selection-forbidden-code expected exit 1 got 1, names Code`).
       - Exit 0 when everything matches, 1 on any mismatch, 2 when a fixture file is missing or not valid JSON.
     - `live --leg selection|persona [--model <id>] [--only <case-id substring>] [--repo-root <dir>]`, checked in this order:
       1. A missing or unknown `--leg` exits 2.
       2. The model goes through `resolvePair` over `packages/agent-ui/a2ui/tools/agent/providers.json`, read from cwd. An unknown model exits 2.
       3. The key comes from `readAnthropicApiKey(repoRoot, env)` (`tools/corpus-genui/fs.ts`). No key exits 2 with a message that names `ANTHROPIC_API_KEY`.
       4. The CLI then builds `anthropicProvider({ apiKey, endpoint })`.
       5. `--only` with zero matches exits 2.
       6. Results print to stdout prefixed `live model=<id>`. Exit 1 if any case fails.
   - `--repo-root` redirects only the `.env` lookup and the fixtures dir. Everything else reads `process.cwd()`, because `selection-guidance.ts` reads the sidecars from cwd at module load.
   - No module in this dir writes a file, and there is no report file. That makes "no stub score in any report artifact" structural. Only `*.test.ts` files may call a write function, for their own temp copies.
   - Only the CLI entry may name `anthropicProvider`, `readAnthropicApiKey` or `ANTHROPIC_API_KEY`, comments included.
   - No module may import `@agent-ui/app` or `@agent-ui/devtools`, or import `planted.ts`, which `src/layering.test.ts` scans `tools/**` for.
   - No em dashes.

8. **Tests.** Stub outputs come from `fixtures/scripted-turns.json` by turn id, so the protected cases are the acceptance proofs. Use these exact `it` titles:
   - `selection leg exits 1 and names the forbidden notFor type`
   - `a clean scripted selection turn passes concept and negative selection`
   - `invalid then valid scores eventual success with rounds 2 and the fed-back failureCodes`
   - `first valid scores first-pass with rounds 1`
   - `never valid scores a halt`
   - `every notFor edge across the five sidecars yields exactly one case`: walk `src/catalog/` for `selection.json` independently, parse the raw JSON, and compare sorted id lists. Never use a literal count (169 today).
   - `a Quant turn containing a Croupier-only type fails the persona leg and names the type`
   - `a croupier turn with PlayingCard on its derived catalog passes the persona leg`
   - `live with no key exits 2`: spawn the entry at the real cwd with `--repo-root <tmp>` and an env without the key. The main checkout carries a `.env`, so this is the GH #1592 precedent.
   - `no agent-eval test constructs the real anthropicProvider`: build the regex from split string parts so the test file never matches itself. As the anti-vacuous control, assert that the entry file does match.
   - `editing a protected fixture without its pin fails the pin check`
   - `an unpinned new fixture fails the pin check`
   - `check:scripts runs the selftest and no standing gate runs the live leg`: mirror `tools/corpus-genui/wiring.test.ts`. Also assert that the literal `vitest.config.ts` include is present.
   - `every selftest result line is labeled scripted`

9. **Wiring.**
   - `package.json` adds `"eval:agent-behavior": "node --experimental-strip-types packages/agent-ui/a2ui/tools/agent-eval/eval-agent-behavior.ts"`.
   - It appends ` && node --experimental-strip-types packages/agent-ui/a2ui/tools/agent-eval/eval-agent-behavior.ts selftest` to the end of `check:scripts`. No other key changes.
   - `vitest.config.ts` gains the explicit line `'packages/agent-ui/a2ui/tools/agent-eval/*.test.ts',` in the `tools` project include, never a wildcard (the GH #112 rule), with a comment citing GH #1810.

Contract dependents:
- `tools/corpus-genui/wiring.test.ts` asserts that no standing gate names `eval-genui-corpus` and that its own include line exists. This step leaves both true and leaves the file untouched.
- `site/pages/code-demo.ts:50` names only the `check` sub-script chain. It is unaffected.
- `tsconfig.tools.json` already includes `packages/agent-ui/*/tools`, so the new files ride `check:tools`.

Focused checks to run:
- `npx vitest run --project tools packages/agent-ui/a2ui/tools/agent-eval/`
- `npm run check:tools`
- the selftest

The final whole-suite gates are step 2's.
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
guard timeout: 420
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Depends on: step 1. Apply the handoff's scrub list. Every addition is one pointer line, no line uses an em dash, and none uses a `file.ext:NNN` line anchor in a skill: `scripts/claude_wiring_check.py` flags those as advisory anchor rot. Use symbols or sections instead. The token `eval:agent-behavior` appears in every edited file.

- `CLAUDE.md` Commands: a new bullet after the `npm run test:browser` bullet covering:
  - `npm run eval:agent-behavior -- selftest` is keyless and runs inside `check:scripts`.
  - `-- live --leg selection|persona` needs `ANTHROPIC_API_KEY` and is Kim's manual run, exit 0, 1 or 2.
  - Home: `packages/agent-ui/a2ui/tools/agent-eval/`, GH #1810.
- `AGENTS.md` `## Gates`: one bullet saying the keyless `npm run eval:agent-behavior -- selftest` rides `check:scripts`, and its `live` leg needs a key, is a manual measurement, and is never a gate.
- `packages/agent-ui/a2ui/AGENTS.md`: append to the existing `selection.json` sidecar bullet, the same line and not a new bullet, that `npm run eval:agent-behavior` (`tools/agent-eval/`) derives one case per `notFor` edge from these sidecars through `selectionGuidanceFor`.
- `.claude/docs/rubrics/a2ui-catalog.md`:
  - One line directly after the dimension table, before `## Gate to promote`: D7 judges the words, and whether a model actually picks the right type is measured by `npm run eval:agent-behavior` (GH #1810), never scored here.
  - In the header, v0.3 becomes v0.4, with a note that v0.4 adds the D7 pointer and moves no dimension or anchor.
  - The `| D7 |` row stays byte for byte.
- `.claude/skills/a2ui-review-standards/SKILL.md`: one routing-table row or line saying the review agent does not grade "does the model choose the right type (concept, `notFor`, repair, per persona)"; route it to `npm run eval:agent-behavior`.
- `.claude/skills/a2ui-review-standards/references/grading-standards.md`: one sentence beside the catalog-page card bullet with the same routing.
- `.claude/skills/a2ui-catalog-rendering-review/SKILL.md`: one sentence in the "Probe the gates" item. `eval-a2ui-catalog.mjs` checks page rendering and never agent selection, which is `npm run eval:agent-behavior`.
- `.claude/skills/a2ui-catalog-rendering-review/references/catalog-pipeline.md`: one line saying the same, beside the standing catalog-gate table row.
- `.claude/skills/component-testing/references/test-craft.md`: one sentence after the seventh-step (`test:eval-catalog`) paragraph. The agent-behavior eval's selftest runs in `check:scripts`, its stub tests ride the vitest `tools` project, and its live leg is manual. It adds no browser shard.
- `.claude/skills/a2ui-corpus-curation/SKILL.md`: one sentence in "Scope: this skill is the exemplar shard only". A2UI selection and repair behavior is a separate eval, `npm run eval:agent-behavior`, not this skill's.
- `.claude/skills/a2ui-prompt-authoring/SKILL.md`: add to the sidecar bullet that a sidecar edit also moves the derived cases of `npm run eval:agent-behavior`, and to run its selftest afterwards.
- `.claude/skills/a2ui-build/SKILL.md`: add to the Selection guidance bullet that the sidecars are exercised by `npm run eval:agent-behavior` (`tools/agent-eval/`).
- `.claude/agents/a2ui-review-agent.md`: in the body, not the frontmatter description, add to the NOT clause that model selection behavior routes to `npm run eval:agent-behavior`.
- `.claude/docs/spec/a2ui-live-agent.spec.md`:
  - One non-normative "Eval coverage" line after SPEC-R4 AC2. `npm run eval:agent-behavior` reads `TurnTrace.rounds` and `failureCodes` to score first-pass versus eventual success with scripted providers, keylessly, and its live leg is manual.
  - A header changelog entry: v0.19, a docs-only pointer, no requirement or AC added.
- `.claude/docs/lld/a2ui-live-agent.lld.md`: one sentence in §5's "Provider-agnostic" paragraph saying the same stub seam backs `tools/agent-eval/`, plus a fold note in the header.
- `.claude/docs/lld/genui-b3-judged-eval.lld.md` §4: one cross-reference sentence. The sibling `npm run eval:agent-behavior` mirrors this CLI's key boundary and exit codes for A2UI selection and repair, and writes nothing under `corpus-genui/`.
- `packages/agent-ui/a2ui/corpus-genui/README.md`: one line with the same cross-reference. It must keep everything `tools/corpus-genui/wiring.test.ts` asserts: each leg with its tag, the no-fabrication rule, and README as the sole non-data root file.
- `.claude/docs/roadmap.md`: one sentence after the GenUI B3 paragraph (about line 137) recording that the agent-behavior eval shipped (GH #1810), keyless with a manual live leg.

Left untouched on purpose:
- `.claude/agents/a2ui-build-agent.md`: its only selection text routes to the sidecar gate, and the build method's pointer lands in `a2ui-build/SKILL.md`.
- `.claude/docs/spec/a2ui-catalog.spec.md`: its §5.2 intro names `selection.json` as the machine twin, and eval routing lives in the live-agent SPEC.
- Historical ADRs, reports, and `.claude/overhaul-*`.

Shared records: per `.sdlc/rollout-2026-10-05.md`, T-0006 edits the live-agent SPEC/LLD first and T-0009 owns `test-craft.md`. Rebase onto theirs. The criteria check membership only.

Run `python3 "$(ls -d ~/.claude/plugins/cache/nonoun-plugins/docs/*/scripts/doc_lint.py | sort -V | tail -1)"` on every touched `.claude/docs` file, as `.claude/docs/process.md` §1 requires. It is not a criterion: a planning probe showed it prints "not a functional document" and exits 0 on all five files, so it cannot go red (rule 11).

Then run every gate, `npm run check` and `npm test`, judged by exit code, and fix any red that step 1 or this step introduced. That includes `scripts/claude_wiring_check.py` and `scripts/harness_wiring_check.py` findings on the edited skill and agent files.
### Acceptance criteria
- `for f in CLAUDE.md AGENTS.md; do grep -qF "eval:agent-behavior" "$f" || exit 1; done`
- `grep -F "selection.json" packages/agent-ui/a2ui/AGENTS.md | grep -qF "eval:agent-behavior"`
- `for f in .claude/skills/a2ui-review-standards/SKILL.md .claude/skills/a2ui-review-standards/references/grading-standards.md .claude/skills/a2ui-catalog-rendering-review/SKILL.md .claude/skills/a2ui-catalog-rendering-review/references/catalog-pipeline.md .claude/skills/component-testing/references/test-craft.md .claude/skills/a2ui-corpus-curation/SKILL.md .claude/skills/a2ui-prompt-authoring/SKILL.md .claude/skills/a2ui-build/SKILL.md .claude/agents/a2ui-review-agent.md; do test -f "$f" || exit 3; grep -qF "eval:agent-behavior" "$f" || exit 1; done`
- `for f in .claude/docs/rubrics/a2ui-catalog.md .claude/docs/spec/a2ui-live-agent.spec.md .claude/docs/lld/a2ui-live-agent.lld.md .claude/docs/lld/genui-b3-judged-eval.lld.md .claude/docs/roadmap.md packages/agent-ui/a2ui/corpus-genui/README.md; do test -f "$f" || exit 3; grep -qF "eval:agent-behavior" "$f" || exit 1; done`
- (guard) `test "$(git show "$SDLC_BASE_SHA":.claude/docs/rubrics/a2ui-catalog.md | grep "^| D7 ")" = "$(grep "^| D7 " .claude/docs/rubrics/a2ui-catalog.md)"`
- (guard) `! git diff "$SDLC_BASE_SHA" -- . ":(exclude).sdlc" | grep "^+" | grep -v "^+++" | grep -q "$(printf "\342\200\224")"`
- (guard) `! { git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc"; } | grep -vE "^(packages/agent-ui/a2ui/tools/agent-eval/|package\.json$|vitest\.config\.ts$|CLAUDE\.md$|AGENTS\.md$|packages/agent-ui/a2ui/AGENTS\.md$|packages/agent-ui/a2ui/corpus-genui/README\.md$|\.claude/docs/rubrics/a2ui-catalog\.md$|\.claude/docs/spec/a2ui-live-agent\.spec\.md$|\.claude/docs/lld/(a2ui-live-agent|genui-b3-judged-eval)\.lld\.md$|\.claude/docs/roadmap\.md$|\.claude/skills/(a2ui-review-standards/SKILL|a2ui-review-standards/references/grading-standards|a2ui-catalog-rendering-review/SKILL|a2ui-catalog-rendering-review/references/catalog-pipeline|component-testing/references/test-craft|a2ui-corpus-curation/SKILL|a2ui-prompt-authoring/SKILL|a2ui-build/SKILL)\.md$|\.claude/agents/a2ui-review-agent\.md$)"`
- (guard) `npm run check`
- (guard) `npm test`

## Assumptions
- `produce()` calls `deps.provider.stream` once per round: verified at `packages/agent-ui/a2ui/src/agent/produce.ts:1048`, inside the round loop that starts at `:1000`.
- `TurnTrace` rides the output only when a note (or an ask) is present: verified at `produce.ts:1143` and `:1237-1238`. `trace.failureCodes` holds the codes fed back into the successful round (`:1001`, `:1134`).
- The base `agent-ui` catalog rejects `PlayingCard` with `CATALOG at root`, and `agent-ui--croupier` accepts it: verified by a plain-Node probe using `loadCatalogById`, `loadCatalogFragment`, `composeCatalog` and `validateA2ui`. The same probe confirmed this compose path runs under `node --experimental-strip-types`.
- Code with `code`, Text with `text`, and PlayingCard with `rank`/`suit` are valid scripted payloads: verified by the same probe.
- `selection-guidance.ts` reads all five sidecars from `process.cwd()` at module load: verified at `selection-guidance.ts:21` and `readPinned`.
- At HEAD there are 169 `notFor` edges (144 default, 20 a2ui-basic, 3 concierge, 1 croupier, 1 fixture-demo): verified by a raw JSON count. They are not pinned anywhere in the plan.
- Vitest exits 0 when `-t` matches nothing, so criteria use the JSON reporter: verified on `tools/catalog-files.test.ts`. The JSON-reporter criterion shape exits 1 at HEAD and 0 on a real passing title (verified).
- At HEAD, `npm run check` exits 0 in 29s and `npm test` exits 0 in 132s (12,654 tests): measured 2026-10-05 in this worktree.
- `doc_lint.py` reports "not a functional document" (exit 0) for every touched `.claude/docs` file: verified, so it is not a criterion.
- The main checkout has a `.env` and this worktree has none: verified with `test -f`. The no-key proof therefore always uses `--repo-root <tmp>`.
- Quant has no catalog fragment: verified at `site/pages/agent-admin-presets.ts:219`.
- No code pins the `check:scripts` string: verified with `git grep`. `tools/corpus-genui/wiring.test.ts` only forbids standing gates from naming `eval-genui-corpus`.
- Forks 1, 2, 3, 5 and 6 are accepted as the handoff writes them: per `.sdlc/rollout-2026-10-05.md`, only fork 4 is listed under "Decisions only Kim can make".
- unresolved: fork 4 (protecting acceptance cases from the generator): Kim rules on one of three options.
  - (a) A pinned hash file verified in `check:scripts`. This is what the plan builds: `pins.ts`, `fixtures/pins.json`, step 1's tamper criterion, and the two pin test titles.
  - (b) CODEOWNERS plus review: drop those pieces and add `.github/CODEOWNERS` for `packages/agent-ui/a2ui/tools/agent-eval/fixtures/`.
  - (c) A path build seats cannot write: drop those pieces, and Kim names the path and the enforcement.
  - Whichever option Kim picks, the change is a replan of step 1 only.

## Risks
- **Live negative selection is strict.** A forbidden type anywhere in the validated payload fails the case. Edges whose target is a common building block (Text, Column, Card) will fail composite surfaces that also use the expected type. The live leg is a manual measurement, not a gate.
- **Some derived intents match the close or commit regexes.** For example, BookingConfirmation's "confirm a completed booking" matches `CONFIRM_COMMIT_RE` (`produce.ts:871-880`). On a live turn this spends a FLOW_END correction round, so `failureCodes` shows `FLOW_END_MISSING` and `rounds` counts it as eventual. Scripted fixtures avoid such words.
- **Pins only make edits visible.** Under option (a), a seat that edits both a fixture and `pins.json` passes `check:scripts`; only the diff shows it. This is fork 4's open question.
- **Lanes landing first can move the case source.**
  - T-0007 rewrites sidecar `why` text, and GH #1812 may add personas. The bijection test derives at run time, so it stays green, but `persona-cases.json` and its pin would need a deliberate update.
  - GH #1811 may move catalog paths that `catalog-files.ts` and the personas dir scan read.
- **Shared docs will conflict on rebase.** The live-agent SPEC/LLD (T-0006, T-0003), `test-craft.md` (T-0009), and `CLAUDE.md`/`AGENTS.md` (#1814) are also being edited. The criteria check membership only, so a rebase keeps them green.
- **Host load can exceed the guard timeout.** Host load has run between 7 and 40. `npm test` could exceed the 420s guard timeout and need a rerun; `flaky-gates` covers that triage.
