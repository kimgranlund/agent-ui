<!-- role=planner level=L3 model=opus effort=xhigh -->
## Goal
Pin each agent preset (plus the preset-less `fixture-demo` fragment) to its `seedVersion` and to canonical sha256 digests of its seed, catalog fragment and `selection.json`, all in one site-side agent manifest per preset. A drift gate and an armed writer under `site/lib/agent-manifest/` hold those pins. The decision is recorded as a proposed ADR, with its record repairs. Build only after the no-barrels wave (GH #1814) merges.

## Step 1: Agent manifests, drift gate and armed digest writer
level: L3
### Do
Depends on: GH #1814 (the no-barrels wave) merged to main; no earlier step. Before any edit, confirm that `ls .claude/docs/adr/0233-*.md` succeeds and that `packages/agent-ui/components/src/controls/index.ts` is absent. These are the outcomes of no-barrels steps 1 and 8 (`.sdlc/no-barrels/planner-L3-4.md`). If either check fails, stop with Status blocked: "GH #1814 not merged" (handoff Rulings, Kim 2026-10-05).

Design source: `.sdlc/persona-manifest/architect-L1.md` (Approach, Interfaces, Carry forward), with one rename settled here. The architect's "persona manifest" becomes an **agent manifest**. Reason: `.claude/docs/references/agent-model.md:110-112` (Kim, 2026-08-29) rules "persona" out as a type name or a doc noun, and there is one manifest per agent preset. The a2ui fragment vocabulary (`personaId`, `catalog/personas/`, `PersonaCatalogManifest`) keeps its names. So: dir `site/lib/agent-manifest/`, type `AgentManifest`, env flag `AGENT_MANIFEST_WRITE`.

1. New `site/lib/agent-manifest/agent-manifest.ts`:
   - `interface AgentManifest { id: string; preset: string | null; seedVersion: number | null; seedDigest: string | null; fragment: { personaId: string; types: string[]; targetCatalogs: string[]; digest: string } | null; selection: { digest: string } | null; noFragment?: { why: string }; noPreset?: { why: string } }`.
   - `type DriftLeg`: a string-literal union of the twelve leg codes below. Also export `const DRIFT_LEGS` listing them.
   - `canonicalJson(value: unknown): string`:
     - Recursive. Object keys are sorted by the default `Array.prototype.sort`. Arrays keep their order. Keys whose value is `undefined` are dropped. Output is `JSON.stringify` with no spacing.
     - Implement it as `JSON.stringify` of a recursively key-sorted copy, never by building the string by hand. That keeps the module and criterion 4 on the engine's own key ordering.
     - Criterion 4 re-derives this form independently, so this form is the contract.
   - `canonicalDigest(value)`: `'sha256:'` plus the hex `createHash('sha256')` of `canonicalJson(value)` as UTF-8.
   - `interface DriftInput { manifests: { file: string; manifest: unknown }[]; presets: { id: string; seedVersion: number; localPatterns?: string; seed: unknown }[]; folders: { id: string; catalog: unknown; selection: unknown }[]; shippedPackageIds: string[]; shippedManifests: { personaId: string; targetCatalogs: string[] }[] }`. It holds plain JSON data only.
   - `readTreeInput(): DriftInput`:
     - Manifests: every `*.manifest.json` in `site/lib/agent-manifest/`; `file` is the basename.
     - Presets: `AGENT_PRESETS` from `site/pages/agent-admin-presets.ts`, mapped to `{ id, seedVersion: p.seedVersion ?? 1, localPatterns, seed: personaFromPreset(p) }`. This effective version is the one `presetStore` compares (`agent-admin-presets.ts:794-796`).
     - Folders: each dir under `packages/agent-ui/a2ui/src/catalog/personas/` that holds a `catalog.json`, with its parsed `catalog.json` and `selection.json` (null when absent).
     - `shippedPackageIds` comes from `SHIPPED_PERSONA_CATALOGS` and `shippedManifests` from `SHIPPED_PERSONA_CATALOG_MANIFESTS`. Import both from `@agent-ui/a2ui`: the root re-exports them at `packages/agent-ui/a2ui/src/catalog/index.ts:40,45`, `packages/agent-ui/app/src/controls/agent-admin/agent-admin-local-patterns.test.ts:13` imports the same way, and the no-barrels plan retires only the components barrels.
     - Paths resolve from `process.cwd()` (precedent `site/lib/adr.test.ts:20-23`). JSON is read with `readFileSync` and `JSON.parse`, never imported.
   - `driftFindings(input: DriftInput): { leg: DriftLeg; id: string; detail: string }[]`, a pure function. The legs:
     - `schema`: each manifest has exactly the interface keys with the right types, every digest matches `^sha256:[0-9a-f]{64}$`, and `file` is `id` plus `.manifest.json`.
     - `declaration`: `preset`, `seedVersion` and `seedDigest` are all null or all set, and `noPreset.why` is a non-empty string exactly when `preset` is null. `fragment` and `selection` are both null or both set, and `noFragment.why` is non-empty exactly when `fragment` is null.
     - `bijection`: the `AGENT_PRESETS` ids equal the `preset` values of the manifests that have one, each exactly once.
     - `identity`:
       - A preset-backed manifest has `preset` equal to `id`.
       - A manifest with a fragment has `fragment.personaId` equal to `id`, a folder of that name, a `selection.json` whose `personaId` equals it, and a `shippedManifests` entry for it.
       - A preset whose manifest has a fragment has `localPatterns` equal to `fragment.personaId`.
       - A preset that borrows another agent's fragment is out of scope here; that would be its own ADR-0172 intake.
     - `unknown-local-patterns`: a preset's `localPatterns` names no folder, or names one while its manifest has `fragment: null`. Today such a typo silently reads as "none" (`agent-admin-presets.ts:96-101`).
     - `seed-version`: the manifest `seedVersion` equals the preset's effective version.
     - `seed-digest`, `fragment-digest`, `selection-digest`: `canonicalDigest` of the seed, of the parsed `catalog.json` and of the parsed `selection.json`.
     - `fragment-types`: `fragment.types` equals `Object.keys(catalog.components)` sorted ascending.
     - `target-catalogs`: `fragment.targetCatalogs` equals the matching `shippedManifests` entry's `targetCatalogs`, in the same order.
     - `list-coherence`: `shippedPackageIds`, the `shippedManifests` ids, the folder ids and the manifests' `fragment.personaId` values form one set.
   - `refreshManifest(manifest: AgentManifest, input: DriftInput): AgentManifest` recomputes `seedDigest`, `fragment.types`, `fragment.targetCatalogs`, `fragment.digest` and `selection.digest`. It never changes `id`, `preset`, `seedVersion`, `noFragment` or `noPreset`, and never changes whether `fragment` or `selection` is null (architect-L1.md Approach).
   - `formatManifest(m)` emits the keys in interface order as `JSON.stringify(m, null, 2)` plus a trailing newline.
   - Node built-ins under `site/` follow the repo precedent: a `// @ts-expect-error` line above each `node:*` import, plus a local `declare const process` (`site/lib/build-css.ts:9-16`; `site/tsconfig.json` carries no node types). A missing or unused expect-error reds `check:site`.
2. Fifteen new `site/lib/agent-manifest/<id>.manifest.json` files: the 14 `AGENT_PRESETS` ids listed in architect-L1.md Carry forward, plus `fixture-demo`.
   - `croupier` and `concierge` carry a fragment and a selection. They are the only presets with `localPatterns` (`agent-admin-presets.ts:148,272`).
   - The other twelve presets carry `fragment: null`, `selection: null` and a `noFragment.why`. Each why names the default-catalog types the preset's idioms use and cites the promotion rule in ADR-0172 Decision §1.
   - This answers GH #1812's question about Quant, Curator, Stylist, Maitre d' and Travel Agent: no fragment in this change. architect-L1.md Approach verified that every idiom type they use is already in `default/catalog.json`.
   - `fixture-demo` carries `preset: null`, `seedVersion: null`, `seedDigest: null`, its fragment and selection, and a `noPreset.why` that cites persona-catalog-composition SPEC-N6 (mechanism only).
   - Hand-write `id`, `preset`, `seedVersion` and the whys. Fill the digests and derived facts with the armed writer.
   - If `AGENT_PRESETS` has gained a preset by build time, add its manifest the same way.
3. New `site/lib/agent-manifest/agent-manifest.test.ts`, the gate. It runs in the `site` vitest project, so `npm test` runs it (`vitest.config.ts:43`). Tests, by exact name:
   - `the real tree has no drift`: `driftFindings(readTreeInput())` equals `[]`.
   - `bites: <leg>`, one per leg code: clone the real input with `JSON.parse(JSON.stringify(...))`, plant one defect for that leg, and assert a finding with that `leg`.
   - `canonicalDigest ignores key order` and `canonicalDigest changes when a value changes`.
   - `the seed digest is deterministic`: two `personaFromPreset` calls per preset give equal digests.
   - `refreshManifest keeps identity, seedVersion and why`: give it a manifest with stale digests and a planted wrong `seedVersion` and why. It must come back with fresh digests, and with the planted `seedVersion` and why unchanged.
4. New `site/lib/agent-manifest/agent-manifest.write.test.ts`, the armed writer, shaped like `packages/agent-ui/a2ui/src/live-agent/recapture-baseline.test.ts:17-29`.
   - Use `it.skipIf(!armed)`, where `armed` is true only when `process.env['AGENT_MANIFEST_WRITE']` is `'1'`.
   - An armed run writes `formatManifest(refreshManifest(...))` to every existing manifest file, always, even when the bytes are unchanged. It never creates a manifest.
   - The file header gives the invocation `AGENT_MANIFEST_WRITE=1 npx vitest run --project site site/lib/agent-manifest/agent-manifest.write.test.ts` and the rule: run it after a deliberate seed, fragment or sidecar change. A `seedVersion` bump stays a human edit to the manifest, because the bump drops users' persisted stores (`agent-admin-presets.ts:794-796`).
5. `site/pages/agent-admin-presets.ts`, comments only:
   - The `seedVersion` doc comment (`:92-95`) names its pin in `site/lib/agent-manifest/`.
   - The `localPatterns` doc comment (`:96-101`) drops "Not validated against `SHIPPED_PERSONA_CATALOGS` here" and names `site/lib/agent-manifest/agent-manifest.test.ts` as the gate that now validates it.
   - No code line changes. New text carries no em dash, and the file's em-dash count must not grow over base. Lines `:96` and `:99` already hold some, so a rewrite may keep or drop them.

Focused checks: the criteria below, plus `npm run check:site`. The typecheck guard itself sits on step 2 (rule 14). Criterion 6 rewrites the manifests when their digests are stale; that is its purpose.

Contract dependents:
- This step reads `AGENT_PRESETS`, `personaFromPreset`, `SHIPPED_PERSONA_CATALOGS` and `SHIPPED_PERSONA_CATALOG_MANIFESTS`, and changes none of them.
- `site/pages/agent-admin-presets.test.ts` imports the file whose comments change, so it is a guard below.
- Left untouched on purpose (architect-L1.md Interfaces): `PersonaCatalogManifest` in `catalog/compose.ts`, each `personas/<id>/manifest.ts`, `PERSONA_IDS` in `agent/selection-guidance.ts`, and `tools/agent/worker/fs-shim-content.ts`.
### Acceptance criteria
- `npx vitest run --project site site/lib/agent-manifest/agent-manifest.test.ts`
- `test -d site/lib/agent-manifest && ! grep -rq $'\xe2\x80\x94' site/lib/agent-manifest/ && for leg in schema declaration bijection identity unknown-local-patterns seed-version seed-digest fragment-digest selection-digest fragment-types target-catalogs list-coherence; do grep -qF "bites: $leg" site/lib/agent-manifest/agent-manifest.test.ts || exit 1; grep -qF "'$leg'" site/lib/agent-manifest/agent-manifest.ts || exit 1; done && for t in 'the real tree has no drift' 'canonicalDigest ignores key order' 'canonicalDigest changes when a value changes' 'the seed digest is deterministic' 'refreshManifest keeps identity, seedVersion and why'; do grep -qF "$t" site/lib/agent-manifest/agent-manifest.test.ts || exit 1; done`
- `node -e "const fs=require('fs'); const frag=['croupier','concierge','fixture-demo']; const ids=['croupier','quant','concierge','restaurant','travel','curator','stylist','quizmaster','mentalist','negotiator','lexicographer','admiral','alchemist','dungeon-master','fixture-demo']; const why=(o)=>typeof o?.why==='string'&&o.why.trim()!==''; for (const id of ids) { const m=JSON.parse(fs.readFileSync('site/lib/agent-manifest/'+id+'.manifest.json','utf8')); const hasF=frag.includes(id); if (m.id!==id||m.preset!==(id==='fixture-demo'?null:id)) process.exit(1); if ((m.fragment!==null)!==hasF||(m.selection!==null)!==hasF) process.exit(1); if (!hasF&&!why(m.noFragment)) process.exit(1); if (m.preset===null&&!why(m.noPreset)) process.exit(1); if (hasF&&m.fragment.personaId!==id) process.exit(1); }"`
- `node -e "const fs=require('fs'),c=require('crypto'); const s=(v)=>Array.isArray(v)?v.map(s):(v!==null&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map((k)=>[k,s(v[k])])):v); const d=(v)=>'sha256:'+c.createHash('sha256').update(JSON.stringify(s(v)),'utf8').digest('hex'); const P='packages/agent-ui/a2ui/src/catalog/personas/'; for (const id of ['croupier','concierge','fixture-demo']) { const m=JSON.parse(fs.readFileSync('site/lib/agent-manifest/'+id+'.manifest.json','utf8')); const cat=JSON.parse(fs.readFileSync(P+id+'/catalog.json','utf8')); const sel=JSON.parse(fs.readFileSync(P+id+'/selection.json','utf8')); if (m.fragment.digest!==d(cat)||m.selection.digest!==d(sel)) process.exit(1); if (JSON.stringify(m.fragment.types)!==JSON.stringify(Object.keys(cat.components).sort())) process.exit(1); }"`
- `s=$(mktemp) && h=$(cat site/lib/agent-manifest/*.manifest.json | shasum) && npx vitest run --project site site/lib/agent-manifest/agent-manifest.write.test.ts && test "$h" = "$(cat site/lib/agent-manifest/*.manifest.json | shasum)" && test -z "$(find site/lib/agent-manifest -name '*.manifest.json' -newer "$s")"`
- `grep -qF AGENT_MANIFEST_WRITE site/lib/agent-manifest/agent-manifest.write.test.ts && grep -qF refreshManifest site/lib/agent-manifest/agent-manifest.write.test.ts && s=$(mktemp) && h=$(cat site/lib/agent-manifest/*.manifest.json | shasum) && AGENT_MANIFEST_WRITE=1 npx vitest run --project site site/lib/agent-manifest/agent-manifest.write.test.ts && test "$h" = "$(cat site/lib/agent-manifest/*.manifest.json | shasum)" && test -n "$(find site/lib/agent-manifest -name croupier.manifest.json -newer "$s")"`
- `for f in 'seedVersion?: number' 'localPatterns?: string'; do awk -v f="$f" 'index($0,"/**"){b=""} {b=b $0 "\n"} index($0,f)==3{printf "%s",b; exit}' site/pages/agent-admin-presets.ts | grep -qF 'site/lib/agent-manifest/' || exit 1; done && ! grep -qF 'Not validated against' site/pages/agent-admin-presets.ts`
- (guard) `git diff -U0 "$SDLC_BASE_SHA" -- site/pages/agent-admin-presets.ts | grep -E '^[+-]' | grep -vE '^(\+\+\+|---) ' | grep -vE '^[+-][[:space:]]*(/\*\*|\*|//)' | { ! grep -q .; } && test "$(grep -o $'\xe2\x80\x94' site/pages/agent-admin-presets.ts | wc -l)" -le "$(git show "$SDLC_BASE_SHA:site/pages/agent-admin-presets.ts" | grep -o $'\xe2\x80\x94' | wc -l)"`
- (guard) `npx vitest run --project site site/pages/agent-admin-presets.test.ts`
- (guard) `{ git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc'; git ls-files --others --exclude-standard -- . ':(exclude).sdlc'; } | grep -vxE 'site/lib/agent-manifest/[a-z0-9.-]+\.(json|ts)|site/pages/agent-admin-presets\.ts' | { ! grep -q .; }`

## Step 2: Proposed ADR, SPEC-R7, record repairs, gates green
level: L3
guard timeout: 300
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Depends on: step 1, because every record cites its paths and the doc gates resolve them. The two L3 steps stay separate because merging them would pass the 12-criterion cap (10 plus 11). This is the final gates step.

- ADR header. New file `.claude/docs/adr/<NNNN>-agent-manifest-drift-gate.md`:
  - NNNN is the highest number on disk plus one, taken at build time (0233 belongs to #1814).
  - Copy the `0000-template.md` header.
  - Status `proposed`; it is never ratified here. Date is the build date.
  - Proposed by: the sdlc-lite run `persona-manifest` (GH #1812, epic GH #1817); digest pins ruled by Kim on 2026-10-05 per the run handoff. Ratified by: left for Kim.
  - The H1 keeps the single U+2014 separator that `site/lib/adr.ts:33` parses. No other em dash anywhere in the file.
  - Relationship row: amends ADR-0172 cl.1 (a fragment folder gains a site-side pin) and ADR-0232 cl.4 (a fragment sidecar edit also moves an agent manifest digest). The accepted ADR bodies stay untouched, following the ADR-0232 "Amends ADR-0071" precedent.
  - Repairs row: SPEC-R7, `packages/agent-ui/a2ui/AGENTS.md`, rubric `a2ui-catalog` D7, `agent-model.md` §3 and §A, the three skills below, and step 1's code paths.
- ADR body:
  - Context: the issue's Croupier drift is a missing pin, not a present mismatch (architect-L1.md Constraints, from `git log`). GH #1812 says "per-persona manifest"; it is named agent manifest here per `agent-model.md` §3.
  - Decision clause 1: the home `site/lib/agent-manifest/` and the `AgentManifest` schema.
  - Decision clause 2: the pins are the effective `seedVersion` plus canonical sha256 digests of the seed, the fragment and the sidecar. Digests, not version-only (Kim, 2026-10-05).
  - Decision clause 3: the twelve gate legs, run by `npm test`.
  - Decision clause 4: the armed writer and its exact invocation, `AGENT_MANIFEST_WRITE=1 npx vitest run --project site site/lib/agent-manifest/agent-manifest.write.test.ts`. It rewrites digests and derived facts only; a `seedVersion` bump stays a human decision.
  - Decision clause 5: no new fragment for the twelve fragmentless presets, under ADR-0172 Decision §1. Each is recorded in its `noFragment.why`; any later candidate is its own intake.
  - Decision clause 6: `fixture-demo` is declared through `noPreset.why`.
  - Rejected alternatives and Consequences come from architect-L1.md (Rejected alternatives, Risks). Include the library-pack coupling: one text edit in `site/pages/agent-admin-libraries.ts` moves several seed digests at once.
  - Cite `site/lib/agent-manifest/agent-manifest.test.ts`.
- SPEC: in `.claude/docs/spec/persona-catalog-composition.spec.md`:
  - Add `**SPEC-R7: ...**` after SPEC-R6, marked as realizing the proposed ADR.
  - Write its ACs in the SPEC's own when/then style: an unacknowledged fragment or sidecar edit reds the gate; a `localPatterns` that names no shipped fragment reds; the four id lists agree; the writer touches digests and derived facts only.
  - Bump the header version one minor step from whatever it is at build time (#1814 step 5 also edits this SPEC), set the date, and add a dated note to the header blockquote that names SPEC-R7.
  - Keep the status keyword, which docs-grammar S2 reads. Existing headings use an em dash; the new heading uses a colon.
- `packages/agent-ui/a2ui/AGENTS.md`, `## Catalogs`, one new bullet. It says:
  - Each fragment folder under `src/catalog/personas/` is pinned by its agent manifest in `site/lib/agent-manifest/` (ADR-NNNN, proposed).
  - An edit to a fragment's `catalog.json` or `selection.json` reds `site/lib/agent-manifest/agent-manifest.test.ts` until the writer runs from the repo root (`AGENT_MANIFEST_WRITE=1 npx vitest run --project site site/lib/agent-manifest/agent-manifest.write.test.ts`).
  - A new fragment folder needs a hand-written manifest first.
- `.claude/docs/rubrics/a2ui-catalog.md`: add one sentence to the D7 row naming `site/lib/agent-manifest/` as the pin that a fragment sidecar edit also moves. Bump the header version with a dated note saying D7 now names the agent-manifest pin and no dimension or anchor moved (the v0.2 precedent, `:3-4`).
- `.claude/docs/references/agent-model.md`:
  - Add a §3 Glossary entry `**agent manifest**`: the file in `site/lib/agent-manifest/`, what it pins, its gate and its writer. It tells the agent manifest apart from the fragment manifest `PersonaCatalogManifest` (`catalog/personas/<id>/manifest.ts`, the Node-safe `personaId`/`fragment`/`targetCatalogs` triple, GH #516).
  - Add a §A row: `AgentManifest`, `site/lib/agent-manifest/agent-manifest.ts`, ADR-NNNN.
- Skills the new gate makes stale:
  - `.claude/skills/a2ui-catalog-rendering-review/references/catalog-pipeline.md`: a §2 gate-table row (a change to a fragment's `catalog.json` or `selection.json`, or to a preset seed, reds `site/lib/agent-manifest/agent-manifest.test.ts`), and a §3 regeneration-table row with the `AGENT_MANIFEST_WRITE=1` invocation.
  - `.claude/skills/a2ui-multi-catalog/SKILL.md` pattern 5: a new fragment also gets an agent manifest in `site/lib/agent-manifest/`.
  - `.claude/skills/a2ui-prompt-authoring/SKILL.md` sidecar bullet (`:54-60`): a fragment sidecar edit also runs the `AGENT_MANIFEST_WRITE=1` writer.
- Run `node scripts/generate-sitemap.mjs`. It rewrites `site/public/adr-index.json`, `site/public/sitemap.json`, `site/sitemap.json` and `site/public/changelog-index.json` (`scripts/generate-sitemap.mjs:340-350`; `.claude/docs/process.md` 2026-08-30 carve-out).
- New text in every edited record carries no em dash, and no tracked file's em-dash count may grow over base. The rubric header (`:3-4`) and the multi-catalog pattern 5 line already hold some, so editing those lines is fine.
- If a main sync moved a preset, fragment or sidecar after step 1, `agent-manifest.test.ts` reds. The fix is the armed writer, plus a hand edit of the manifest `seedVersion` when the preset bumped it.
- Run every gate below and fix any red that step 1 introduced; the most likely one is a `check:site` type error in `agent-manifest.ts`. A gate already red at the build-start base comes back as Status `inherited red`.
- `doc_lint.py` is not a gate here. It lives only in the disabled nonoun-plugins docs plugin and reports ADRs as not functional documents (`.sdlc/no-barrels/planner-L3-4.md` step 1).
- Contract dependents of the edited records:
  - The `site` project guard runs `site/lib/adr.test.ts` (every real ADR parses; the Status cell is one canonical keyword), `site/lib/sitemap.test.ts` (G1 index freshness) and `site/lib/docs-grammar.test.ts` (S2 status keyword, S3 relative links, S9 skill-table paths).
  - The `npm run check` guard runs `scripts/adr_ratify_test.py`, `claude_wiring_check.py` and `harness_wiring_check.py --rubric-modes`.
### Acceptance criteria
- `n=$(ls .claude/docs/adr | grep -cE '^[0-9]{4}-agent-manifest-drift-gate\.md$') && test "$n" -eq 1 && f=$(ls .claude/docs/adr/[0-9][0-9][0-9][0-9]-agent-manifest-drift-gate.md) && grep -qE '^> \| \*\*Status\*\* \| proposed \|$' "$f" && ! tail -n +2 "$f" | grep -q $'\xe2\x80\x94' && grep -qF 'site/lib/agent-manifest/agent-manifest.test.ts' "$f" && grep -qF 'AGENT_MANIFEST_WRITE=1' "$f" && grep -qF 'ADR-0172' "$f" && grep -qF 'ADR-0232' "$f"`
- `f=$(ls .claude/docs/adr | grep -E '^[0-9]{4}-agent-manifest-drift-gate\.md$') && n=${f%%-*} && test -n "$n" && grep -qF "\"name\": \"ADR-$n\"" site/public/adr-index.json`
- `s=.claude/docs/spec/persona-catalog-composition.spec.md && grep -qF '**SPEC-R7' "$s" && grep -qF 'site/lib/agent-manifest/' "$s" && sed -n '1,/^## /p' "$s" | grep '^>' | grep -qF 'SPEC-R7'`
- `grep -qF 'site/lib/agent-manifest/' packages/agent-ui/a2ui/AGENTS.md && grep -qF 'AGENT_MANIFEST_WRITE=1' packages/agent-ui/a2ui/AGENTS.md`
- `r=.claude/docs/rubrics/a2ui-catalog.md && grep -E '^\| D7 \|' "$r" | grep -qF 'site/lib/agent-manifest/' && sed -n '1,/^## /p' "$r" | grep '^>' | grep -qF 'agent-manifest'`
- `a=.claude/docs/references/agent-model.md && g=$(sed -n '/^## 3 · Glossary/,/^## 4 /p' "$a") && printf '%s\n' "$g" | grep -qF '**agent manifest**' && printf '%s\n' "$g" | grep -qF 'PersonaCatalogManifest' && printf '%s\n' "$g" | grep -qF 'site/lib/agent-manifest/' && sed -n '/^## A · Type/,$p' "$a" | grep -qF 'site/lib/agent-manifest/agent-manifest.ts'`
- `p=.claude/skills/a2ui-catalog-rendering-review/references/catalog-pipeline.md && grep -qF 'site/lib/agent-manifest/agent-manifest.test.ts' "$p" && grep -qF 'AGENT_MANIFEST_WRITE=1' "$p" && grep -qF 'site/lib/agent-manifest/' .claude/skills/a2ui-multi-catalog/SKILL.md && grep -qF 'AGENT_MANIFEST_WRITE=1' .claude/skills/a2ui-prompt-authoring/SKILL.md`
- (guard) `for f in .claude/docs/spec/persona-catalog-composition.spec.md packages/agent-ui/a2ui/AGENTS.md .claude/docs/rubrics/a2ui-catalog.md .claude/docs/references/agent-model.md .claude/skills/a2ui-catalog-rendering-review/references/catalog-pipeline.md .claude/skills/a2ui-multi-catalog/SKILL.md .claude/skills/a2ui-prompt-authoring/SKILL.md site/pages/agent-admin-presets.ts; do test "$(grep -o $'\xe2\x80\x94' "$f" | wc -l)" -le "$(git show "$SDLC_BASE_SHA:$f" | grep -o $'\xe2\x80\x94' | wc -l)" || exit 1; done`
- (guard) `npm run check`
- (guard) `npx vitest run --project site`
- (guard) `{ git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc'; git ls-files --others --exclude-standard -- . ':(exclude).sdlc'; } | grep -vxE 'site/lib/agent-manifest/[a-z0-9.-]+\.(json|ts)|site/pages/agent-admin-presets\.ts|\.claude/docs/adr/[0-9]{4}-agent-manifest-drift-gate\.md|\.claude/docs/spec/persona-catalog-composition\.spec\.md|\.claude/docs/rubrics/a2ui-catalog\.md|\.claude/docs/references/agent-model\.md|packages/agent-ui/a2ui/AGENTS\.md|\.claude/skills/(a2ui-catalog-rendering-review/references/catalog-pipeline|a2ui-multi-catalog/SKILL|a2ui-prompt-authoring/SKILL)\.md|site/public/(adr-index|sitemap|changelog-index)\.json|site/sitemap\.json' | { ! grep -q .; }`

## Assumptions
- The build must wait for GH #1814: verified that `gh issue view 1814` reports OPEN on 2026-10-05 and that `packages/agent-ui/components/src/controls/index.ts` exists at HEAD `f348f2bb`. Step 1's Do turns this into a blocking precondition.
- "Agent manifest", not "persona manifest": verified by `.claude/docs/references/agent-model.md:110-112` (Kim, 2026-08-29: "persona" is never a type name or a doc noun). The site `Persona` alias at `:164-165,210` is documented there as a legacy subset. The a2ui `personaId`/`catalog/personas/` vocabulary predates the ruling and stays.
- The effective `seedVersion` is `preset.seedVersion ?? 1`: verified at `site/pages/agent-admin-presets.ts:794-796`.
- Only `croupier` and `concierge` carry `localPatterns`: verified by `grep -n localPatterns site/pages/agent-admin-presets.ts` (`:148`, `:272`).
- The 14 roster ids, and the `builder` preset kept separate, come from `.sdlc/persona-manifest/architect-L1.md` Carry forward and from `grep -n "^    id: '"`. Roster ids sit at `:142-627`; `patchable-keys` (`:984`) and `builder` (`:1017`) sit outside `AGENT_PRESETS`.
- Three fragment folders exist, each with a `catalog.json` and a `selection.json`: verified with `node -e` over the JSON files and `grep TargetCatalogs` over each `manifest.ts`. Component keys are `PlayingCard` (croupier), `BookingForm` and `BookingConfirmation` (concierge), and `FixtureBanner` (fixture-demo). All three have `targetCatalogs` `['agent-ui', 'a2ui-basic']`.
- `site/` imports node built-ins behind `// @ts-expect-error` plus `declare const process`: verified at `site/lib/build-css.ts:9-16` and `site/lib/adr.test.ts:17-20`. `site/tsconfig.json` extends the root `types: ["vite/client"]`.
- The gate needs no new command: verified that the `site` project in `vitest.config.ts` includes `site/**/*.test.ts`. `npx vitest run --project site` ran 73 files green in 20 s, and `npm run check` exited 0 in 30 s, hence `guard timeout: 300`.
- An unarmed writer run exits 0: verified with the precedent `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/recapture-baseline.test.ts`, which reports 1 skipped and exits 0.
- Criterion 4's independent digest works on real data: verified under node v24.9.0; it hashes the three real `catalog.json` files and prints the sorted type lists.
- Every new-behavior criterion is red now, and for the right reason. Run under `bash` from the repo root with `SDLC_BASE_SHA=HEAD`:
  - Step 1 criteria 1 and 5: "No test files found" (exit 1).
  - Step 1 criteria 2 and 6: missing dir or file (exit 1 and 2).
  - Step 1 criteria 3 and 4: ENOENT on `croupier.manifest.json`.
  - Step 1 criterion 7: the comment blocks lack the path and `Not validated against` is still present (exit 1).
  - Step 2 criteria 1 to 7: exit 1 (no ADR file, no SPEC-R7, no pointers).
- Every guard is green now and can go red:
  - The presets test passes its 15 tests.
  - The comment-only filter, both em-dash count forms and both scope lists exit 0 now. Each exits 1 on a fixture: a `+  seedVersion?: string` line; a string with one more U+2014 than its base; `site/pages/agent-admin.ts` and `.claude/docs/adr/0172-...md` piped through the lists.
  - `npm run check` going red on a type error is observed in the Assumptions of `.sdlc/no-barrels/planner-L3-4.md`.
- `@agent-ui/a2ui` keeps both persona lists at its root after #1814: verified at `catalog/index.ts:40,45` today. The Goal of `.sdlc/no-barrels/planner-L3-4.md` retires only the components barrels; its step 5 adds `PersonaCatalogPackage.controls` and changes no ids.
- The GH #1812 fragment question is settled by existing law, not left open: ADR-0172 Decision §1 promotes a type only for an idiom that prose cannot validate, and architect-L1.md checked that every idiom type is already in `default/catalog.json`. The ADR records this as proposed, for Kim.
- The next ADR number is decided at build time: verified that 0232 is the highest file on disk; 0233 is claimed by #1814.
- `doc_lint.py` is not a gate: verified it exists only in the nonoun-plugins docs plugin cache, which #1791 disabled, and the no-barrels plan records that it reports ADRs as not functional.

## Risks
- The rename departs from the architect's and the issue's wording. If Kim prefers "persona manifest", reverting is mechanical (dir, type, env flag, criteria strings), but it would come back as a plan-review finding before any build.
- Another wave 4 lane (#1807, #1808, #1811) may mint the same ADR number. Renumber at merge.
- Once this merges, any later edit to a preset, a library pack text (`site/pages/agent-admin-libraries.ts`), a fragment or a sidecar reds the gate until the writer runs. Lanes that land after this one (T-0004, T-0007, and T-0008 if late) must run it. The ADR, `a2ui/AGENTS.md` and the three skills say so.
- If `AGENT_PRESETS` gains or renames a preset before the build, step 1 criterion 3 still checks only the 15 named ids. The gate's `bijection` leg covers the rest, but a rename would need the criterion's id list swapped.
- If #1814 makes the `@agent-ui/a2ui` root import heavier or DOM-dependent under jsdom, `readTreeInput` may need a narrower import. Criterion 1 would catch it.
- If `personaFromPreset` gains a nondeterministic field, the gate would flap. The determinism test is the tripwire.
- Step 1 criterion 6 relies on `find -newer` seeing the writer's mtimes as newer than a `mktemp` stamp. APFS has sub-second mtimes; a filesystem with 1-second mtimes could false-fail.
- T-0005, T-0007, T-0003 and #1814 edit the SPEC, rubric, `a2ui/AGENTS.md` and glossary first. The criteria use membership greps, but text placement may need a rebase.
