## Task goal
Give every agent-emittable catalog type machine-readable selection guidance (`intents` and `notFor`, with confusable pairs) that the catalog-derived prompt inventory shows to the model and that evals and validators can read, then update every skill, command, agent and doc that describes the catalog, descriptors, or prompt inventory so none goes stale.

## Step 2: Render the clause in the inventory, bound it, serve it in the Worker, recapture the baseline
level: L3
### Do
**Inventory.** In `packages/agent-ui/a2ui/src/agent/system-prompt.ts` `catalogInventory(catalog)`:
- Compute `const guidance = selectionGuidanceFor(catalog)` once.
- After each line's closing `)`, append `renderSelectionClause(guidance[id], catalog)` only when `Object.hasOwn(guidance, id)`.
- A catalog with no sidecar, or a type planted with no entry, composes today's line byte-identically. This keeps the `PlantedGhostComponent` and `PlantedTypeShapes` legs in `prompt-drift.test.ts` and the `^- (.+?) \(` id regex green (architect-L1.md Constraints).
- No `buildSystemPrompt` signature change, so `site/pages/a2ui-agent.ts`, which slices that signature, is untouched on purpose.
- Add an `ADR-0232 (proposed)` bullet to the file's ADR index header.

**Barrels.** `src/agent/index.ts` gains `export * from './selection-guidance.ts'` and a header mention. The root barrel is untouched; `scripts/publish/publish-packages.mjs` already excludes `./agent` from publish (unchanged on purpose). In `src/agent/gates.test.ts`, the root-barrel identity list gains `'selectionGuidanceFor'` and `'loadSelectionGuidance'`.

**`live-agent/prompt-drift.test.ts`** gains these legs, and the existing legs stay:
- every default type's inventory line ends with its rendered clause
- `{ ...defaultCatalog, catalogId: 'planted-no-sidecar' }` composes no ` · use: ` in its components section
- a budget leg: the summed default clause length is at most `SELECTION_GUIDANCE_CHAR_BUDGET`, importing that symbol by name
- the derived catalog `composeCatalog(defaultCatalog, croupierFragment, 'croupier')` composes `PlayingCard` and `Badge` lines carrying their clauses

**Baseline.** Recapture with `RECAPTURE_BASELINE=1 npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/recapture-baseline.test.ts`, the writer named in architect-L1.md Carry forward. Only the four composed keys move.

**Worker.** In `packages/agent-ui/a2ui/tools/agent/worker/fs-shim-content.ts`:
- Import the five sidecars as JSON, e.g. `import defaultSelection from '../../../src/catalog/default/selection.json'`. That is esbuild's default JSON loader, the one `worker/index.ts` already uses for `catalog.json`. wrangler's Text rule covers only `*.md` and `*.jsonl`.
- Add `FILES` entries keyed `/packages/agent-ui/a2ui/src/catalog/<dir>/selection.json`, valued `JSON.stringify(<import>)`. The loader JSON-parses, so the content is equivalent.
- Update the header comment. `DIRS` and `wrangler.jsonc` are untouched.

Contract dependents in `tools/agent/worker/fs-shim.test.ts`:
1. The "every REAL top-level prompt .md file has a matching FILES entry" leg must restrict `bundledFiles` to keys starting with `${PROMPTS_KEY_PREFIX}/`. Otherwise the new catalog keys break its equality.
2. `aliasedModules` gains `src/agent/selection-guidance.ts`.
3. A new leg: the recursive on-disk set of `src/catalog/**/selection.json` equals the `FILES` keys ending in `/selection.json`, and each value JSON-parses deep-equal to its disk file.

`fs-shim.ts`'s header comment may name the new reader. `src/live-agent/fs-shim-content-drift.test.ts` stays untouched on purpose: its regexes match only `src/agent/prompts/` imports. Worker runtime behavior is not proven on this host. The `FILES`-vs-disk leg and the aliased-module leg are the structural proof.

Rerun the prompt gates listed in architect-L1.md Carry forward.

Depends on: step 1.
### Acceptance criteria
- `node --experimental-strip-types --no-warnings --input-type=module -e "import { readFileSync } from 'node:fs'; const a = await import('@agent-ui/a2ui/agent'); const { loadCatalog } = await import('./packages/agent-ui/a2ui/src/catalog/catalog.ts'); const bad = []; for (const d of ['default', 'a2ui-basic']) { const cat = loadCatalog(JSON.parse(readFileSync('packages/agent-ui/a2ui/src/catalog/' + d + '/catalog.json', 'utf8'))); const lines = a.buildSystemPrompt(cat, []).split('\n'); const g = a.selectionGuidanceFor(cat); for (const id of Object.keys(cat.components)) if (!lines.some((l) => l.startsWith('- ' + id + ' (props: ') && l.endsWith(')' + a.renderSelectionClause(g[id], cat)))) bad.push(d + ':' + id) } console.log(bad.length, bad.slice(0, 5)); process.exit(bad.length === 0 ? 0 : 1)"`
- `python3 -c "import json,subprocess,os; f='packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json'; old=json.loads(subprocess.run(['git','show',os.environ['SDLC_BASE_SHA']+':'+f],capture_output=True,text=True,check=True).stdout); new=json.load(open(f)); moved=sorted(k for k in old if old[k]!=new.get(k)); print(moved); assert set(new)==set(old) and moved==['blueSky','default','defaultExplicit','specific']"`
- `grep -qF "SELECTION_GUIDANCE_CHAR_BUDGET" packages/agent-ui/a2ui/src/live-agent/prompt-drift.test.ts && grep -qF "'selectionGuidanceFor'" packages/agent-ui/a2ui/src/agent/gates.test.ts && npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/prompt-drift.test.ts packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.test.ts packages/agent-ui/a2ui/src/live-agent/system-prompt-grammar.test.ts packages/agent-ui/a2ui/src/live-agent/a2ui-surface-toggle.test.ts packages/agent-ui/a2ui/src/live-agent/genui-surface-prompt.test.ts packages/agent-ui/a2ui/src/catalog/a2ui-basic/index.test.ts packages/agent-ui/a2ui/src/agent/gates.test.ts`
- `grep -qF "src/agent/selection-guidance.ts" packages/agent-ui/a2ui/tools/agent/worker/fs-shim.test.ts && npx vitest run --project tools packages/agent-ui/a2ui/tools/agent/worker/fs-shim.test.ts`
- `python3 -c "import glob; q=chr(39); src=open('packages/agent-ui/a2ui/tools/agent/worker/fs-shim-content.ts').read(); disk=sorted(glob.glob('packages/agent-ui/a2ui/src/catalog/**/selection.json', recursive=True)); miss=[p for p in disk if q+'../../../src/catalog/'+p.split('src/catalog/')[1]+q not in src]; print(len(disk), miss); assert disk and not miss"`
- (guard) `! git grep --untracked -nE "^import .*selection[.]json" -- packages/agent-ui/a2ui/src packages/agent-ui/app/src site`
- (guard) `python3 -c "import subprocess as s,os; b=os.environ['SDLC_BASE_SHA']; g=lambda *a: s.run(['git',*a],capture_output=True,text=True).stdout; x=['--','.',':(exclude).sdlc']; c=lambda t: t.count(chr(8212)); ch=[f for f in g('diff','--name-only',b,*x).split() if os.path.isfile(f)]; new=g('ls-files','--others','--exclude-standard',*x).split(); bad=[f for f in ch if c(open(f).read())>c(g('show',b+':'+f))]+[f for f in new if c(open(f).read())>(1 if f.startswith('.claude/docs/adr/') else 0)]; print(len(ch),len(new),bad); assert not bad"`
- (guard) `test -z "$( { git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc'; git ls-files --others --exclude-standard -- . ':(exclude).sdlc'; } | grep -vE '^packages/agent-ui/a2ui/(src/(agent/(selection-guidance(\.unit\.test)?|gates\.test|system-prompt|index)\.ts|catalog/selection-guidance\.test\.ts|catalog/(default|a2ui-basic|personas/[a-z-]+)/selection\.json|live-agent/prompt-drift\.test\.ts|live-agent/prompt-equivalence\.baseline\.json)|tools/agent/worker/fs-shim(-content|\.test)?\.ts)$' )"`
