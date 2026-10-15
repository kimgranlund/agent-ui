<!-- role=planner level=L3 model=opus effort=xhigh -->
## Goal
Ship one `selection.json` sidecar per catalog and persona fragment, giving every agent-emittable type `intents` and `notFor`. A Node-only `./agent` loader reads the sidecars and renders them as a clause on each catalog-derived inventory line. The guidance is gated for coverage and bytes, the Worker serves it, and it is recorded in a proposed ADR-0232 with every dependent doc, skill and agent updated.
guard timeout: 180

## Step 1: Selection-guidance loader, coverage gate, and the five authored sidecars
level: L4
### Do
Build the design in `.sdlc/work/catalog-notfor-intents/architect-L1.md` (Approach, Interfaces, Carry forward). The decisions below are settled. Do not reopen them.

**Loader.** NEW `packages/agent-ui/a2ui/src/agent/selection-guidance.ts`, Node-only.
- Imports: only `readFileSync` from `node:fs`, plus `import type { Catalog } from '../catalog/catalog.ts'`. No value import from `catalog/`. Evidence: `personas/*/manifest.ts` import `catalog.json` without an import attribute, so plain Node throws `ERR_IMPORT_ATTRIBUTE_MISSING`. Today, `node --experimental-strip-types` import of `@agent-ui/a2ui/agent` resolves, and it must keep resolving. Step 2 criterion 1 guards this.
- Paths resolve from `process.cwd()` via `declare const process: { cwd(): string }`. That is the TKT-0044 rule; see the carry-forward in architect-L1.md.
- Exports:
  - `interface SelectionEdge { readonly type: string; readonly why: string }`
  - `interface SelectionEntry { readonly intents: readonly string[]; readonly notFor: readonly SelectionEdge[] }`
  - `type SelectionGuidance = Readonly<Record<string, SelectionEntry>>`
  - `SelectionGuidanceErrorCode`, an `as const` object `{ MALFORMED: 'SELECTION_GUIDANCE_MALFORMED', CAP: 'SELECTION_GUIDANCE_CAP', UNRESOLVED: 'SELECTION_GUIDANCE_UNRESOLVED' }` plus its literal-union type. No `enum` (erasableSyntaxOnly).
  - `class SelectionGuidanceError extends Error`, with `name = 'SelectionGuidanceError'` and `readonly code`. This is the `CatalogComposeError` shape in `catalog/compose.ts`.
- `loadSelectionGuidance(doc: unknown): SelectionGuidance` validates the document and returns its `types` map:
  - The root is an object with exactly one pin key, `catalogId` or `personaId`, a non-empty string, plus a `types` object.
  - Each entry has exactly the keys `intents` and `notFor`. A shape defect throws `MALFORMED`.
  - `intents` holds 1 to 3 strings of 1 to 60 chars. `notFor` holds 0 to 4 `{ type, why }` edges, each `why` 1 to 90 chars. Count and length breaches throw `CAP`.
  - These throw `MALFORMED`: a duplicate target; a self edge; an intent equal to the type name, or a `why` equal to its target name, after lowercasing and stripping non-alphanumerics (anti-restatement); a `·` anywhere; a `;` in an intent; `(` or `)` in a `why` (separator safety, so the rendered clause stays unambiguous); any U+2014 em dash.
- At module load, read these five files and check each pin:
  - `catalog/default/selection.json` (catalogId `agent-ui`)
  - `catalog/a2ui-basic/selection.json` (catalogId `a2ui-basic`)
  - `catalog/personas/{concierge,croupier,fixture-demo}/selection.json` (personaId = the directory name)
  - A pin mismatch throws `MALFORMED`. The persona list is hard-coded for the plain-Node reason above. The vitest gate enforces it against `SHIPPED_PERSONA_CATALOG_MANIFESTS`.
- `selectionGuidanceFor(catalog)` keys on `catalog.catalogId` only:
  - `agent-ui` returns the default guidance and `a2ui-basic` returns the basic guidance.
  - An id containing `--` splits on the first `--` (`compose.ts` `derivedCatalogId` naming). It returns base plus persona entries. If the persona half is unknown it returns base only; if the base half is unknown it returns `{}`.
  - Any other id returns `{}`, including the inbound-only `A2UI_BASIC_CANONICAL_URI` alias.
- `renderSelectionClause(entry, catalog)` returns ` · use: ` plus the intents joined with `; `. When `notFor` is non-empty it appends ` · not for: ` plus `Type (why)` items joined with `, `. It throws `UNRESOLVED` when a target is not a key of `catalog.components`. It never throws for a missing entry: coverage belongs to the gate, not the renderer.
- `SELECTION_GUIDANCE_CHAR_BUDGET`:
  - measured = the sum of `renderSelectionClause` lengths over the default catalog's types.
  - ceiling = the `## Available components` section length of `baseline.default` at `$SDLC_BASE_SHA` (9 570 chars at 38ed6721).
  - value = min(ceiling, measured rounded up to the next 100, plus 300).
  - The doc comment records measured, ceiling and date in the `DOGFOOD_INVENTORY_CHAR_BUDGET` comment style (`dogfood-inventory.ts`), with no em dash.

**Sidecars.** NEW five files: `{ "catalogId" | "personaId": ..., "types": { ... } }`, 2-space indent, trailing newline, keys in `catalog.json` order.

Authoring law (architect-L1.md Approach):
- Intents name the job in the user's words. A `why` names the discriminating axis (count, persistence, data shape, interaction), never a recipe.
- Never copy a sentence from `src/agent/prompts/mini-skills/*.md` (the ADR-0091 §4 double-injection lesson).
- Take the confusable pairs from `.claude/docs/spec/a2ui-catalog.spec.md` §5.2 and `site/pages/choosing.ts` `GROUPS`.
- Edges inside default and inside a2ui-basic are reciprocal, each direction with its own `why`. Incoming edges therefore also stay at 4 or fewer.
- A persona edge targets either a type in the same fragment, reciprocally, or a type present in both bases (Text, Image, Icon, Row, Column, List, Card, Button, TextField, Slider). Reason: every shipped manifest has `targetCatalogs` `['agent-ui', 'a2ui-basic']`, so the edge must resolve in both derived catalogs.

Vocabulary law: sidecar text lands inside `## Available components`. `live-agent/system-prompt-grammar.test.ts` leak legs forbid the following in that section, case-insensitive: underdetermined, approximation, catalog wall, backable, scene transitions, settle update, draft/*, dialed down/up, top-down, bottom-up, reconcile, calibration examples, blue-sky mode, specific mode, composition idioms, feed-embedded ask, feed-ask, sendDataModel, plan declarations, synthesis turns, deleteSurface, updateDataModel alone, FRESH surfaceId, replaces its entire record, delivered only once per surface, greet-1, greet card, target declarations, personaPatch.

Byte envelope: write tersely, about 100 chars of rendered clause per type on average (80 types stay under the ceiling). Caps stay as designed. If the default total cannot fit the ceiling without cutting caps, stop with Status blocked `plan defect: ceiling exceeded (measured N > ceiling C), section-render fallback needed`. The section render (architect-L1.md Rejected alternatives) changes the render contract every later criterion checks. Author type by type against the gate.

**Tests.**
- NEW `src/agent/selection-guidance.unit.test.ts`, using inline fixtures:
  - every rejection rule throws `SelectionGuidanceError` with the right code
  - derived union, unknown id returns `{}`, unknown persona returns base only
  - the exact clause shape, a bare clause when `notFor` is empty, and `UNRESOLVED` on a ghost target
- NEW `src/catalog/selection-guidance.test.ts`, the coverage gate:
  - Bijection of guidance keys with `defaultCatalog` and `a2uiBasicCatalog` components.
  - For every `m` in `SHIPPED_PERSONA_CATALOG_MANIFESTS` and every base in `m.targetCatalogs`: `selectionGuidanceFor(composeCatalog(base, m.fragment, m.personaId))` has an entry for every key of `m.fragment.components`, and every entry's clause renders without throwing.
  - Every edge renders on default and a2ui-basic, and reciprocity holds inside default, a2ui-basic and each fragment.
  - Orphan check: every `selection.json` on disk under `src/catalog/` is default, a2ui-basic or `personas/<id>` for a shipped manifest id.
  - Negative controls, named exactly `NEGATIVE CONTROL: missing entry`, `NEGATIVE CONTROL: extra entry`, `NEGATIVE CONTROL: self edge`, `NEGATIVE CONTROL: one-way edge` and `NEGATIVE CONTROL: restating intent`. Each plants its defect into a copy and asserts the same predicate the real-tree leg uses fails. Test files are exempt from the composition-containment leg (architect-L1.md Constraints).
- No em dash in any new file.

**Contract dependent.** `src/agent/gates.test.ts` `NODE_ALLOWED` gains `'src/agent/selection-guidance.ts'`, and its comment counts it as the fifth Node-only call site.

Not in this step: `system-prompt.ts`, `agent/index.ts`, `fs-shim`. Nothing Worker-reachable imports the loader yet (`tools/agent/worker/index.ts` imports `produce.ts`, never `agent/index.ts`).

Depends on: none.
### Acceptance criteria
- `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog/selection-guidance.test.ts packages/agent-ui/a2ui/src/agent/selection-guidance.unit.test.ts`
- `for k in "missing entry" "extra entry" "self edge" "one-way edge" "restating intent"; do grep -qF "NEGATIVE CONTROL: $k" packages/agent-ui/a2ui/src/catalog/selection-guidance.test.ts || exit 1; done`
- `python3 -c "import json; B='packages/agent-ui/a2ui/src/catalog/'; L=lambda p: json.load(open(B+p)); C=[('default','catalogId','agent-ui'),('a2ui-basic','catalogId','a2ui-basic')]+[('personas/'+p,'personaId',p) for p in ('concierge','croupier','fixture-demo')]; bad=[d for d,k,i in C if set(L(d+'/selection.json')['types'])!=set(L(d+'/catalog.json')['components']) or L(d+'/selection.json').get(k)!=i]; print(bad); assert not bad"`
- `python3 -c "import json,re; B='packages/agent-ui/a2ui/src/catalog/'; P=[B+'default/selection.json',B+'a2ui-basic/selection.json']+[B+'personas/'+p+'/selection.json' for p in ('concierge','croupier','fixture-demo')]; n=lambda s: re.sub(r'[^a-z0-9]','',s.lower()); T=[(t,v) for p in P for t,v in json.load(open(p))['types'].items()]; ok=lambda t,v: sorted(v)==['intents','notFor'] and 1<=len(v['intents'])<=3 and all(0<len(i)<=60 and n(i)!=n(t) and ';' not in i and chr(183) not in i for i in v['intents']) and len(v['notFor'])<=4 and len({x['type'] for x in v['notFor']})==len(v['notFor']) and all(x['type']!=t and 0<len(x['why'])<=90 and n(x['why'])!=n(x['type']) and not set(x['why'])&set('()'+chr(183)) for x in v['notFor']); bad=[t for t,v in T if not ok(t,v)]+[p for p in P if chr(8212) in open(p).read()]; print(len(T),bad[:5]); assert T and not bad"`
- `python3 -c "import json; B='packages/agent-ui/a2ui/src/catalog/'; L=lambda p: json.load(open(B+p)); S={d: L(d+'/selection.json')['types'] for d in ('default','a2ui-basic')}; P={p: L('personas/'+p+'/selection.json')['types'] for p in ('concierge','croupier','fixture-demo')}; D=set(L('default/catalog.json')['components'])&set(L('a2ui-basic/catalog.json')['components']); has=lambda s,a,b: b in s and a in {y['type'] for y in s[b]['notFor']}; bad=[(a,x['type']) for s in S.values() for a,v in s.items() for x in v['notFor'] if not has(s,a,x['type'])]+[(a,x['type']) for s in P.values() for a,v in s.items() for x in v['notFor'] if not (x['type'] in D or has(s,a,x['type']))]; n=sum(len(v['notFor']) for s in S.values() for v in s.values()); print(n, bad[:5]); assert n and not bad"`
- `python3 -c "import re; B='packages/agent-ui/a2ui/src/catalog/'; P=['default','a2ui-basic','personas/concierge','personas/croupier','personas/fixture-demo']; F=re.compile(r'underdetermined|approximation|catalog wall|backable|scene transitions|settle update|draft/|dialed (down|up)|top-down|bottom-up|reconcile|calibration examples|blue-sky mode|specific mode|composition idioms|feed-embedded ask|feed-ask|senddatamodel|plan declarations|synthesis turns|deletesurface|updatedatamodel alone|fresh surfaceid|replaces its entire record|delivered only once per surface|greet-1|greet card|target declarations|personapatch', re.I); hits=[(p,m.group(0)) for p in P for m in F.finditer(open(B+p+'/selection.json').read())]; print(hits[:5]); assert not hits"`
- `node --experimental-strip-types --no-warnings --input-type=module -e "import { readFileSync } from 'node:fs'; import { execFileSync } from 'node:child_process'; const g = await import('./packages/agent-ui/a2ui/src/agent/selection-guidance.ts'); const { loadCatalog } = await import('./packages/agent-ui/a2ui/src/catalog/catalog.ts'); const cat = loadCatalog(JSON.parse(readFileSync('packages/agent-ui/a2ui/src/catalog/default/catalog.json', 'utf8'))); const sg = g.selectionGuidanceFor(cat); const used = Object.keys(cat.components).reduce((n, id) => n + g.renderSelectionClause(sg[id], cat).length, 0); const base = JSON.parse(execFileSync('git', ['show', process.env.SDLC_BASE_SHA + ':packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json'], { encoding: 'utf8' })).default; const ceiling = base.indexOf('## Available functions') - base.indexOf('## Available components'); const budget = g.SELECTION_GUIDANCE_CHAR_BUDGET; console.log({ used, budget, ceiling }); process.exit(used > 0 && used <= budget && budget <= ceiling ? 0 : 1)"`
- `node --experimental-strip-types --no-warnings --input-type=module -e "const g = await import('./packages/agent-ui/a2ui/src/agent/selection-guidance.ts'); const cat = (catalogId) => ({ catalogId, protocolVersion: 'v1.0', components: {}, functions: {} }); let code = ''; try { g.loadSelectionGuidance({ catalogId: 'x', types: { A: { intents: [], notFor: [] } } }) } catch (e) { code = e.name + ':' + e.code } const d = g.selectionGuidanceFor(cat('agent-ui--croupier')); const r = { code, derived: 'PlayingCard' in d && 'Badge' in d, unknown: Object.keys(g.selectionGuidanceFor(cat('nope'))).length }; console.log(r); process.exit(r.code === 'SelectionGuidanceError:SELECTION_GUIDANCE_CAP' && r.derived && r.unknown === 0 ? 0 : 1)"`
- `node --experimental-strip-types --no-warnings --input-type=module -e "const g = await import('./packages/agent-ui/a2ui/src/agent/selection-guidance.ts'); const cat = { catalogId: 'agent-ui', protocolVersion: 'v1.0', components: { Text: { properties: {} } }, functions: {} }; const full = g.renderSelectionClause({ intents: ['a', 'b'], notFor: [{ type: 'Text', why: 'w' }] }, cat); const bare = g.renderSelectionClause({ intents: ['a'], notFor: [] }, cat); let code = ''; try { g.renderSelectionClause({ intents: ['a'], notFor: [{ type: 'Ghost', why: 'w' }] }, cat) } catch (e) { code = e.code } console.log(JSON.stringify({ full, bare, code })); process.exit(full === ' \u00b7 use: a; b \u00b7 not for: Text (w)' && bare === ' \u00b7 use: a' && code === 'SELECTION_GUIDANCE_UNRESOLVED' ? 0 : 1)"`
- `grep -qF "'src/agent/selection-guidance.ts'" packages/agent-ui/a2ui/src/agent/gates.test.ts && npx vitest run --project packages packages/agent-ui/a2ui/src/agent/gates.test.ts`
- (guard) `python3 -c "import subprocess as s,os; b=os.environ['SDLC_BASE_SHA']; g=lambda *a: s.run(['git',*a],capture_output=True,text=True).stdout; x=['--','.',':(exclude).sdlc']; c=lambda t: t.count(chr(8212)); ch=[f for f in g('diff','--name-only',b,*x).split() if os.path.isfile(f)]; new=g('ls-files','--others','--exclude-standard',*x).split(); bad=[f for f in ch if c(open(f).read())>c(g('show',b+':'+f))]+[f for f in new if c(open(f).read())>(1 if f.startswith('.claude/docs/adr/') else 0)]; print(len(ch),len(new),bad); assert not bad"`
- (guard) `test -z "$( { git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc'; git ls-files --others --exclude-standard -- . ':(exclude).sdlc'; } | grep -vE '^packages/agent-ui/a2ui/src/(agent/selection-guidance(\.unit\.test)?\.ts|agent/gates\.test\.ts|catalog/selection-guidance\.test\.ts|catalog/(default|a2ui-basic|personas/[a-z-]+)/selection\.json)$' )"`

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

## Step 3: ADR-0232, contract docs, skills, agents, and gates green
level: L3
### Do
**ADR.** NEW `.claude/docs/adr/0232-catalog-selection-guidance-sidecar.md`, from `0000-template.md`. The number is free: no file, branch, worktree or log entry claims it.
- H1: `# ADR-0232 <em dash> <title>`. That em dash is mandatory because `ADR_H1_RE` in `scripts/generate-sitemap.mjs` and `site/lib/adr.ts` throws without it. It is the only em dash in the file.
- Status: bare `proposed`. Ratified by: pending Kim's ratification, never self-ratified.
- Proposed by: the sdlc-lite run `catalog-notfor-intents`, GH #1796, design ratified for build by Kim 2026-10-05 per the handoff.
- Repairs: SPEC-R6 (`a2ui-live-agent.spec.md`), LLD-C4, `a2ui-catalog.spec.md` §5.2 intro, rubric `a2ui-catalog.md` D7, and the code files.
- Supersedes cell:
  - Amends ADR-0071. Do not edit ADR-0071's body: accepted ADRs are append-only per `doc-standards` `references/status-dialects.md` §2.
  - Extends ADR-0087 (include-or-recorded coverage).
  - Relates ADR-0097 (`feed-catalog.ts` policy beside the agent), ADR-0135 (Node-only prompt assets and fs-shim), ADR-0169 and ADR-0172 (per-catalog and derived catalogs), ADR-0173 (descriptor untouched), ADR-0091 §4 and ADR-0197 cl.5 (app marginal budget, zero headroom).
- Context: the maison comparison, and zero hits for `notFor`/`intents` in the repo.
- Decision:
  - the sidecar schema and caps
  - the loader API
  - the clause format
  - the coverage law (bijection, reciprocity, the persona edge rule)
  - the budget, with the measured number and ceiling taken from the `SELECTION_GUIDANCE_CHAR_BUDGET` doc comment
  - the token cost, as len(recaptured `default`) minus len(base `default`) chars, with its percentage of the base default prompt
- Consequences: the four-key recapture; the Worker registration; the dogfood inventory carries no guidance; in-page tooling cannot read the sidecar; reciprocity may force weak reverse `why`s, which D7 rejects.
- Alternatives considered: copy the list from architect-L1.md Rejected alternatives. The descriptor home must carry both reasons: no descriptor exists for a2ui-basic or persona types, and ADR-0173 cl.5 keeps catalog content hand-curated.
- Then run `node scripts/generate-sitemap.mjs` (the ADR-title carve-out, `.claude/docs/process.md` §1).

**SPEC and LLD.**
- `.claude/docs/spec/a2ui-live-agent.spec.md`: version v0.17 to v0.18, with a dated changelog line in the header's own pattern. SPEC-R6 gains a paragraph and a new AC7: for a catalog with a sidecar, each inventory line carries its clause after `(props: ...)`; a catalog with no sidecar composes the pre-ADR-0232 line; the default delta is at most `SELECTION_GUIDANCE_CHAR_BUDGET`. AC1 to AC6 exist today.
- `.claude/docs/lld/a2ui-live-agent.lld.md`: the LLD-C4 row gains one sentence naming `selection-guidance.ts` and the clause. The header line gains an "ADR-0232 (proposed) folded <date>" note. The module tree entry gains a `selection-guidance.ts` line.

**Rubric.** `.claude/docs/rubrics/a2ui-catalog.md`:
- Header v0.2 to v0.3 with a dated note. The row's artifact list gains the `selection.json` entry.
- A new row `| D7 | Selection guidance | [review] | ...`, written without em dashes, with these anchors:
  - 1: a type without an entry, so `catalog/selection-guidance.test.ts` is red; or an intent restating the type; or a `why` copying a mini-skill sentence.
  - 3: the gate is green, intents name the job in user words, and each `why` names the discriminating axis.
  - 5: as 3, and every edge is a real confusable pair from spec §5.2 or `choosing.ts`, with no filler reverse `why`.
- Gate to promote: the [review] list becomes (D4, D5, D6, D7), and "all six dimensions" becomes seven.
- Replace every `D1–D6` (en dash) with `D1–D7` in this file, in `.claude/skills/a2ui-review-standards/SKILL.md` and in `.claude/docs/spec/a2ui-expert-harness.spec.md`. These three are the only a2ui-catalog references (git grep).

**Skills.** Edit body text, not frontmatter descriptions. Cite symbols and clause ids, never `file.ts:NNN` line anchors (`claude_wiring_check.py` advisory). Each file must mention `selection.json`:
- `component-catalog`: the machine source for by-job routing among emittable types, via `selectionGuidanceFor` on `@agent-ui/a2ui/agent`.
- `a2ui-payload-authoring`: pick a type by its `use:` intents and honor `not for:`; add a checklist item.
- `a2ui-prompt-authoring`: the sidecars are byte-pinned surface (edit means recapture). Register each in `fs-shim-content.ts` `FILES`, gated by `fs-shim.test.ts`.
- `a2ui-multi-catalog`: per-catalog and persona sidecars, the derived union, the persona edge rule.
- `a2ui-build`: canonical sources gain the loader and the gate.
- `a2ui-catalog-rendering-review/references/catalog-pipeline.md`: Layer 1 says a row lands with its entry; the Gate matrix gains a row "type in catalog.json with no selection.json entry, or vice versa", pointing to `catalog/selection-guidance.test.ts`.
- `component-design`: under Catalog posture, an emittable row lands with its selection entry.

**Agents.** `.claude/agents/a2ui-build-agent.md`: a catalog row includes its `selection.json` entry. `.claude/agents/a2ui-payload-authoring-agent.md`: type choice reads the inventory clause sourced from `selection.json`.

**Human twins.** `site/pages/choosing.ts` header comment, the `a2ui-catalog.spec.md` §5.2 intro (bump v0.3 to v0.4 with the date), and the `.claude/docs/references/agent-model.md` §3 Glossary entry "selection guidance". Each cites `selection.json` as the Node-only machine twin.

**Checked and unchanged, with reasons from architect-L1.md Interfaces:** `CLAUDE.md`/`AGENTS.md`, `doc-standards`, `component-packaging`, `component-standards` descriptor-generation, the ADR-0173 body, `a2ui-catalog.spec.md` §5.1, `.claude/commands` (absent), and `.claude/ops` (removed in PR #1792).

**Rules for this step.**
- No new em dash in any edited line. The guard counts them per file.
- `doc_lint.py` reports "not a functional document" with exit 0 for every target doc, so it is no gate here.
- No issue comments, push or PR.

**Gates.** Run every gate below and fix any red that steps 1 and 2 introduced. A fix that needs a file outside the scope guard is Status blocked for a scope decision. `npm run size` is already red at base (app marginal 106 987 > 106 559 B gz) and is not a criterion.

Depends on: step 2.
### Acceptance criteria
- `f=.claude/docs/adr/0232-catalog-selection-guidance-sidecar.md; grep -qE '^# ADR-0232 ' "$f" && grep -qxF '> | **Status** | proposed |' "$f" && for k in selection.json SELECTION_GUIDANCE_CHAR_BUDGET ADR-0071 ADR-0097 ADR-0169 ADR-0173 a2ui-basic; do grep -qF "$k" "$f" || exit 1; done`
- `grep -qF '"name": "ADR-0232"' site/public/adr-index.json && npx vitest run --project site site/lib/sitemap.test.ts site/lib/adr.test.ts`
- `for f in .claude/docs/spec/a2ui-live-agent.spec.md .claude/docs/lld/a2ui-live-agent.lld.md .claude/docs/spec/a2ui-catalog.spec.md .claude/docs/references/agent-model.md site/pages/choosing.ts; do grep -qF selection.json "$f" || exit 1; done`
- `grep -qE '^\| D7 \| Selection guidance \| \[review\] \|' .claude/docs/rubrics/a2ui-catalog.md && for f in .claude/docs/rubrics/a2ui-catalog.md .claude/skills/a2ui-review-standards/SKILL.md .claude/docs/spec/a2ui-expert-harness.spec.md; do grep -qF 'D1–D7' "$f" || exit 1; ! grep -qF 'D1–D6' "$f" || exit 1; done`
- `for f in .claude/skills/component-catalog/SKILL.md .claude/skills/a2ui-payload-authoring/SKILL.md .claude/skills/a2ui-prompt-authoring/SKILL.md .claude/skills/a2ui-multi-catalog/SKILL.md .claude/skills/a2ui-build/SKILL.md .claude/skills/a2ui-catalog-rendering-review/references/catalog-pipeline.md .claude/skills/component-design/SKILL.md .claude/agents/a2ui-build-agent.md .claude/agents/a2ui-payload-authoring-agent.md; do grep -qF selection.json "$f" || exit 1; done`
- (guard) `npm run check`
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui`
- (guard) `npx vitest run --project tools`
- (guard) `python3 -c "import subprocess as s,os; b=os.environ['SDLC_BASE_SHA']; g=lambda *a: s.run(['git',*a],capture_output=True,text=True).stdout; x=['--','.',':(exclude).sdlc']; c=lambda t: t.count(chr(8212)); ch=[f for f in g('diff','--name-only',b,*x).split() if os.path.isfile(f)]; new=g('ls-files','--others','--exclude-standard',*x).split(); bad=[f for f in ch if c(open(f).read())>c(g('show',b+':'+f))]+[f for f in new if c(open(f).read())>(1 if f.startswith('.claude/docs/adr/') else 0)]; print(len(ch),len(new),bad); assert not bad"`
- (guard) `test -z "$( { git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc'; git ls-files --others --exclude-standard -- . ':(exclude).sdlc'; } | grep -vE '^(packages/agent-ui/a2ui/(src/(agent/(selection-guidance(\.unit\.test)?|gates\.test|system-prompt|index)\.ts|catalog/selection-guidance\.test\.ts|catalog/(default|a2ui-basic|personas/[a-z-]+)/selection\.json|live-agent/prompt-drift\.test\.ts|live-agent/prompt-equivalence\.baseline\.json)|tools/agent/worker/fs-shim(-content|\.test)?\.ts)|\.claude/docs/adr/0232-catalog-selection-guidance-sidecar\.md|site/(public/)?(adr-index|sitemap)\.json|site/pages/choosing\.ts|\.claude/docs/(spec/(a2ui-live-agent|a2ui-catalog|a2ui-expert-harness)\.spec|lld/a2ui-live-agent\.lld|references/agent-model|rubrics/a2ui-catalog)\.md|\.claude/skills/(component-catalog|a2ui-payload-authoring|a2ui-prompt-authoring|a2ui-multi-catalog|a2ui-build|a2ui-catalog-rendering-review|component-design|a2ui-review-standards)/(SKILL|references/[a-z0-9-]+)\.md|\.claude/agents/a2ui-(build|payload-authoring)-agent\.md)$' )"`

## Assumptions
- Builders never commit, so `$SDLC_BASE_SHA` stays the pre-change HEAD across all three steps. Every scope guard is cumulative for that reason. Verified by the run.sh rules in the planner brief.
- The default catalog has 80 types, a2ui-basic has 14, and the persona fragments have 4: concierge BookingForm and BookingConfirmation, croupier PlayingCard, fixture-demo FixtureBanner. Verified by reading each `catalog.json` with python.
- Every shipped persona manifest targets `['agent-ui', 'a2ui-basic']`, and the two bases share exactly 10 types. Verified by reading `personas/*/manifest.ts` and by the set intersection printed by the persona-edge probe.
- Plain-Node import of `@agent-ui/a2ui/agent` resolves today, while importing `personas/manifests.ts` throws `ERR_IMPORT_ATTRIBUTE_MISSING`. Verified by `node --experimental-strip-types` probes run at plan time.
- The base ceiling is 9 570 chars of a 33 750-char default prompt. Verified by slicing `prompt-equivalence.baseline.json` at HEAD.
- Only `prompt-equivalence.baseline.json` pins the composed inventory bytes. Verified by `git grep -ln "Available components (catalog"` and `git grep -ln "Badge (props:"`.
- `fs-shim.test.ts`'s top-level-prompt leg breaks on any non-prompt `FILES` key. Verified by reading its `bundledFiles` filter, which excludes only `/mini-skills/` and `/genui-packs/`.
- The Worker reaches `system-prompt.ts` through `produce.ts`, never through `agent/index.ts`. Verified at `tools/agent/worker/index.ts` imports.
- ADR-0232 is unclaimed. Verified by `ls .claude/docs/adr`, `git log --all -- '.claude/docs/adr/0232*'` (empty) and `git worktree list` (one worktree).
- `npm run size` is red at base, with app marginal 106 987 B gz over the 106 559 B gz budget. Verified by running it at plan time (exit 1). The zero-bundle claim is proven structurally instead, by the untracked-aware import guard plus the scope guard.
- `doc_lint.py` cannot go red on these docs. Verified: it printed "not a functional document" with exit 0 on all six target docs.
- Gate timings at HEAD: `npm run check` 28 s, the a2ui package tests 10 s, the tools project 6 s, the site ADR and sitemap tests 1 s. All exited 0, measured at plan time.
- The due-process phase exit artifacts on GH #1796 belong to the conductor, not to a step, because the handoff forbids issue comments. Source: the handoff's Constraints and Architecture sections.
- Amending the accepted SPEC a2ui-live-agent under a proposed ADR is allowed because the user ratified the design for build on 2026-10-05. Source: the handoff's Architecture section. The ADR's own status stays proposed.

## Risks
- The authored default clauses may exceed the 9 570-char ceiling at the stated caps. Step 1 then blocks with a `plan defect:`, and a replan switches to the section-render fallback the handoff names, rather than cutting caps.
- Reciprocity with at most 4 edges per entry, in and out, may force weak reverse `why`s or drop real pairs. The gates cannot judge quality, so D7 review must.
- The vocabulary-law regex in step 1 copies the current leak legs of `system-prompt-grammar.test.ts`. A leg added on main later is caught only by step 2's run of that file.
- Worker runtime serving of the sidecars is proven only structurally (the FILES-vs-disk and aliased-module legs). No wrangler build or Worker run happens on this host.
- Gate fixes in step 3 that touch a file outside the cumulative scope regex need a conductor scope decision.
