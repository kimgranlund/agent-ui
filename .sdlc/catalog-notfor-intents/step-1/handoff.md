## Task goal
Give every agent-emittable catalog type machine-readable selection guidance (`intents` and `notFor`, with confusable pairs) that the catalog-derived prompt inventory shows to the model and that evals and validators can read, then update every skill, command, agent and doc that describes the catalog, descriptors, or prompt inventory so none goes stale.

## Step 1: Selection-guidance loader, coverage gate, and the five authored sidecars
level: L4
### Do
Build the design in `.sdlc/catalog-notfor-intents/architect-L1.md` (Approach, Interfaces, Carry forward). The decisions below are settled. Do not reopen them.

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
