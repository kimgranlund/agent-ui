# LLD — GenUI B3: the judged pack-idiom eval (GH #1584)

> Status: proposed · v0.1 · 2026-08-22 · Layer: LLD (implementation plan)
> Implements: [`../prd/genui-surface.prd.md`](../prd/genui-surface.prd.md) **PRD-G6** (a judged GenUI
> corpus shard + a docs page, matching the A2UI corpus discipline — facets · admission · pins) and
> PRD §8 **m3** ("uses the source: judge-scored ≥ 4/5 against the corpus rubric for demonstrable use
> of the picked pack's idioms"); realizes [`../spec/genui-surface.spec.md`](../spec/genui-surface.spec.md)
> **SPEC-N3**'s named home for m3 ("a judged corpus-rubric eval in the B3 wave (PRD-G6), a NAMED MANUAL
> run — never `npm test`/`test:browser`") and its §6 cut ("B3 (out of this SPEC's contract)"). The SPEC
> owns no B3 requirement IDs by its own choice; this LLD therefore carries its acceptance inline
> (§8) rather than citing SPEC-R IDs that do not exist — no SPEC is authored for B3 (the ask is
> unambiguous: PRD-G6 + m3 + SPEC-N3 already say what; `doc-writing-rules`' "SPEC only when
> genuinely ambiguous" rule).
> Scope: feature · Audience: builder, reviewer.
> Mirrors (by pattern, never by copy): the A2UI corpus discipline — record/admission/pins
> ([`a2ui-corpus-store.lld.md`](a2ui-corpus-store.lld.md) §2/§3/§6), the critic-authored verdict
> adapter ([ADR-0068](../adr/0068-corpus-quality-judge-verdict-adapter.md) cl.1–2), the verbatim
> verdict archive ([ADR-0165](../adr/0165-verdict-archive-durable-admission-disposition.md) cl.1–3/7/8), the pure-core /
> Node-shell split ([ADR-0062](../adr/0062-corpus-packaging-pure-core-subpath-data-home.md)), and the
> exit-coded manual-runner precedent (`scripts/eval-a2ui-catalog.mjs` + `npm run eval:catalog`;
> the live-key CLI precedent `packages/agent-ui/a2a/tools/arena/run-flagship.ts`).
> Decompose: [`../decompositions/genui-b3-judged-eval.decomp.json`](../decompositions/genui-b3-judged-eval.decomp.json)
> (`coverage_check.py --strict` clean, plan mode; nodes n1–n7 = LLD-C1–C7 below; every leaf carries
> the accept predicate the build's tests must satisfy).
> Altitude: owns HOW. It does not change the GenUI mechanism (B0–B2: `ui-sandbox-frame`, `produce()`'s
> genui peel, the packs, the prompt block — all untouched, GH #1584 "Out of scope").

---

## 0. The key boundary — read this before anything else

PRD §8 m3 is a **live-model judgment**. Tonight's build pass has no API key and no operator awake.
The design therefore splits along ONE hard line, and every component below states which side it is on:

| Side | What | Runs in this build pass? |
|---|---|---|
| **KEYLESS** | The pure core (record + verdict + lint models), the data dir with its prompt matrix + calibration fixtures, the rubric document + its calibration record, the `collect` / `apply` / `report` legs of the runner, the standing deterministic gate, the docs page (honest empty state + fixture-driven rendering), the npm script + vitest wiring, the runbook | **YES — built, gate-green, committed** |
| **NEEDS KEY** | The `generate` leg (fresh pack-conditioned GenUI turns through the real producer) and the `judge` leg (scoring pending records against the rubric) — their **code** ships tonight, stub-tested through the same injected `AgentProvider` seam every live-agent test already uses; their **execution** is the named manual run | **CODE yes · EXECUTION no** — Kim runs `npm run eval:genui-corpus -- generate` then `-- judge` then `-- apply` then `-- report` when a key is at hand (§7 runbook) |

**The no-fabrication law.** `corpus-genui/records/` and `corpus-genui/verdicts/` start EMPTY (ADR-0165
cl.8's posture: the artifact the design requires merely stops being discarded — it is never invented).
No stubbed, sample, or illustrative score ever enters a record, a verdict file, `index.json`, or the docs
page. The standing gate (LLD-C6) reds any record carrying a `qualityScore` that has no byte-identical
archived verdict behind it. The two committed fixtures (LLD-C2) are calibration material for the rubric,
live under `fixtures/`, and are grep-asserted to be absent from the shard and every verdict file.

## 1. Component map (traceability)

| ID | Component | Side | Files (under `packages/agent-ui/a2ui/` unless rooted) | Decomp |
|---|---|---|---|---|
| **LLD-C1** | Pure core: record model + validator · verdicts model + archive merge · HTML lint (evidence floor) | keyless | `src/corpus-genui/{record,verdicts,lint}.ts` + co-located `*.test.ts` | n1a–c |
| **LLD-C2** | The data dir: prompt matrix · calibration fixtures · (empty) records + verdicts · derived `index.json` · README | keyless | `corpus-genui/{prompts.json, fixtures/, records/v1/, verdicts/, index.json, README.md}` | n2a–c |
| **LLD-C3** | The rubric `genui-pack-idiom.md` v1.0 + its calibration record | keyless | `/.claude/docs/rubrics/genui-pack-idiom.md` | n3a–b |
| **LLD-C4** | The Node shell: ONE CLI, five legs (`collect` · `generate` · `judge` · `apply` · `report`), the only writer of `corpus-genui/` | mixed — per leg (§4) | `tools/corpus-genui/{eval-genui-corpus.ts, fs.ts, legs/*.ts}` + `*.test.ts` | n4a–f |
| **LLD-C5** | The docs page | keyless | `/site/genui-corpus.html` · `/site/pages/genui-corpus.ts` (+ `.css`, `.test.ts`, `.browser.test.ts`) · `/site/lib/site-manifest.json` · `/site/sitemap.json` (regenerated) | n5a–b |
| **LLD-C6** | The standing deterministic gate | keyless | `src/corpus-genui/corpus-genui-data.test.ts` | n6a |
| **LLD-C7** | Wiring + records: `package.json` script · `vitest.config.ts` tools include · README · roadmap reconciliation (done in this plan pass) | keyless | `/package.json` · `/vitest.config.ts` · `corpus-genui/README.md` · `/.claude/docs/roadmap.md` | n7a–c |

**Runtime vs tooling split (ADR-0062, applied).** `src/corpus-genui/*` is pure and platform-neutral —
no `node:*`, hashing via `globalThis.crypto.subtle` (the `canonical.ts` precedent). It is **off every
barrel and every package subpath** — like `verdict-archive.ts`/`disposition-allowlist.ts`, this is eval
bookkeeping no renderer consumer wants; `package.json` `exports` gains nothing. `tools/corpus-genui/*`
is the Node shell (fs, env, the CLI), type-checked by `check:tools` (`tsconfig.tools.json` already
includes `packages/agent-ui/*/tools`) and run via Node type-stripping exactly as `tools/corpus/rescore.ts`
documents. Imports stay inside the `a2ui` package (`src/agent/genui-line.ts`, `src/agent/produce.ts`,
`src/agent/providers/anthropic.ts`, `src/agent/prompts/genui-packs.ts`, `src/corpus/retrieve.ts`,
`src/catalog/default`) plus `tools/agent/providers-config.ts` — the DAG gains no edge
(`layering.test.ts` stands).

## 2. Why a SIBLING data dir, not `corpus/` — LLD-C2's home (the one real fork, ruled here)

Verified against the tree (2026-08-22):

- `tools/corpus/fs-store.ts` `loadStore()` **walks the whole `corpus/` tree** and parses every `.jsonl`
  as an A2UI `CorpusRecord` → `createStore` → `validateRecord`/tier-1 against the A2UI catalog.
- `src/corpus/admission-coverage.test.ts` walks `corpus/**/*.jsonl` for admitted names AND
  `corpus/verdicts/*.json`, failing on any file `parseVerdictsFile` rejects — which rejects any
  `rubric ≠ 'a2ui-corpus'`.
- `src/corpus/corpus-data.test.ts` re-validates the exemplar shard's `a2uiOutput` + canonical hash.

A GenUI record has no `a2uiOutput`, no canonical form, no catalog; its verdict cites a different rubric.
Co-locating under `corpus/` would red three A2UI gates or require widening them — B1/B2-era gate code
edited for an eval-only slice. **Ruling: `packages/agent-ui/a2ui/corpus-genui/` — a sibling data dir
with its own pure core and shell, mirroring the A2UI corpus's discipline by pattern.** The alternative
(a `kind:'genui'` discriminator inside `CorpusRecord` + facet-aware gates) was weighed and rejected:
it drags opaque HTML into a schema whose every invariant (single-surface, pointer resolution, θ_dup
near-dup) is meaningless for it. No ADR: the fork changes no ratified decision's substance — ADR-0062's
pure/shell split and ADR-0068/0165's verdict pattern are *applied*, not altered — so the choice is
recorded here (§9 Risks carries the consolidation trigger).

## 3. LLD-C1 — the pure core

### 3.1 `record.ts` — `GenuiCorpusRecord` + `validateGenuiRecord`

```ts
import { GENUI_MAX_HTML_BYTES, utf8ByteLength } from '../agent/genui-line.ts'   // the wire's OWN gate — never a copy

export type GenuiFacet = 'eval'                       // v1: eval only (§3.4); 'exemplar' reserved, not a member
export type GenuiStatus = 'pending' | 'judged'       // no quarantine: an eval record below bar IS the measurement
export type GenuiProvenanceSource = 'generated' | 'captured'

export interface GenuiCorpusRecord {
  name: string            // `<packId|control>--<promptId>--<runId>` — unique across the dir (join key, the A2UI `name` law)
  promptId: string        // ∈ prompts.json
  promptText: string      // verbatim copy of the prompt that produced `html` (pinned — prompts.json may evolve)
  packId: string | null   // null = the pack-less control arm (§4.3); else ∈ GENUI_PACKS ids
  surfaceId: string       // from the genui envelope
  html: string            // the envelope's html VERBATIM (the judge and the docs page need the artifact itself)
  meta: {
    facet: GenuiFacet
    status: GenuiStatus
    promptSetVersion: number                    // prompts.json's version at generation time
    packHash: string | null                     // sha-256 of the pack body that conditioned the turn (null for control)
    htmlHash: string                            // sha-256 of `html` — identity + exact-dedup key + what a verdict binds to
    model: string | null                        // the allowlisted model id (generate) · null for captured
    dogfood: boolean                            // the GenuiSurfaceConfig.dogfood pin (v1 default false)
    generatedAt: string                         // ISO-8601
    provenance: { source: GenuiProvenanceSource; origin: string }   // origin: CLI run id · capture path — resolvable
    lint: GenuiHtmlLint                         // §3.3 — deterministic D4 evidence, filled at write time
    qualityScore?: number                       // present ⇔ status==='judged'; copied from the archived verdict
    passed?: boolean
    failingDimensions?: string[]
    verdictDate?: string                        // the archived VerdictsFile's own `date` — the traceability pointer
  }
}

export type GenuiAdmitCode = 'E_SCHEMA' | 'E_WIRE' | 'E_HASH' | 'E_SCORE_ORPHAN' | 'E_DUP' | 'E_NO_GENUI' | 'E_JUDGE_PARSE'

export function validateGenuiRecord(r: unknown): { code: GenuiAdmitCode; path: string }[]   // pure, total, batched
export async function genuiRecordHashes(html: string, packBody: string | null): Promise<{ htmlHash: string; packHash: string | null }>
```

Tier-1 for GenUI **is the wire's own structural gate**: the record must round-trip through
`formatGenuiLine(surfaceId, html)` → `readGenuiLine()` (non-empty `surfaceId`, `html` a string,
`utf8ByteLength(html) ≤ GENUI_MAX_HTML_BYTES`) — `E_WIRE` otherwise. There is deliberately **no
canonicalizer, no near-dup index, no healer**: the artifact is opaque HTML; `E_DUP` is exact `htmlHash`
equality only (two runs producing byte-identical HTML is a real, reportable event, not noise). The
validator is sync except the hash recompute, which the shell and the gate call separately
(`E_HASH` when stored ≠ fresh). `E_SCORE_ORPHAN` = a score-bearing field on a non-`judged` record
(the gate's no-fabrication leg adds the archive cross-check on top, §6).

### 3.2 `verdicts.ts` — `GenuiVerdictsFile` + parse + archive merge

```ts
export interface GenuiDimensionScores { D1: number; D2: number; D3: number; D4: number }   // 1..5 each
export interface GenuiJudgeVerdict {
  qualityScore: number               // MIN over D1..D4 (the rubric's aggregation — the parser RE-CHECKS it when `dimensions` is present)
  passed: boolean                    // must equal qualityScore >= 4 (parser-checked)
  failingDimensions?: string[]       // every dimension < 4, by id
  dimensions?: GenuiDimensionScores  // the model-judge always fills it; a critic seat may omit
  rationale?: string                 // ≤ 2 000 chars; evidence the page shows
}
export interface GenuiVerdictsFile {
  rubric: 'genui-pack-idiom'
  rubricVersion: string              // must equal the rubric doc's `version:` marker (caller-supplied, ADR-0068 cl.1)
  judgedBy: string                   // a model id (`judge` leg) or a critic-seat name — never empty
  date: string                       // ISO-8601; full timestamp when two files land the same day (ADR-0165's same-date rule)
  model?: string                     // present when judgedBy is a model
  verdicts: Record<string, GenuiJudgeVerdict>   // keyed by record `name`
}
export function parseGenuiVerdictsFile(text: string, expectedRubricVersion: string): ParseResult   // batched issues, never throws
export function mergeGenuiVerdictArchive(sources: readonly { sourceFile: string; file: GenuiVerdictsFile }[]): MergeResult
```

Same idiom as `src/corpus/judge.ts` + `verdict-archive.ts` (unknown keys rejected, rubric name pinned,
latest `date` wins, same-date disagreement is a conflict, identical is idempotent). It is a **new module,
not a parametrization of `judge.ts`** — editing the A2UI adapter for an eval-only slice would widen a
shipped `"./corpus"` barrel export; the drift pair is named in §9 with its consolidation trigger.

### 3.3 `lint.ts` — the deterministic evidence floor for rubric D4

```ts
export interface GenuiHtmlLint {
  byteLength: number
  externalRefs: number     // src=/href= on script/link/img/iframe/video/audio/source resolving to an http(s):// origin
  tokenRefs: number        // occurrences of `var(--md-sys-` (the PRD-G5 token bridge in use)
  scriptBlocks: number     // inline <script> count
  hasDoctype: boolean
}
export function lintGenuiHtml(html: string): GenuiHtmlLint   // pure string scanning — no DOM, no parser dependency
```

A count, never a verdict: the rubric's D4 anchors cite these numbers as the 1↔3 floor (`process.md`
rule 1 — true/false facts are code; judgment sits above them).

### 3.4 Facets · admission · pins — how PRD-G6's "A2UI discipline" maps onto opaque HTML

| A2UI discipline | GenUI realization | Why it differs |
|---|---|---|
| Facets `exemplar`/`eval` + contamination split | `facet:'eval'` only in v1 | GenUI records are never retrieval conditioning — the **packs** condition the prompt, not records. A judged ≥4 record promoted INTO a pack as an exemplar is a later, separate decision (§9). No contamination machinery is needed when nothing trains on the shard. |
| Admission: heal → schema → pin → tier-1 → pointer → dedup → tier-2 → write | schema → wire gate → hash pins → exact-dup → write as `pending`; tier-2 is the `judge`+`apply` pair, outside the write path | No structure to heal/canonicalize; tier-2 still never executes inside the write path (ADR-0068 cl.2's generator/critic separation, kept). |
| Pins `protocolVersion`/`catalogId`/`catalogVersion` | `packId`+`packHash` · `promptSetVersion` · `model` · `dogfood` · `rubricVersion` (on the verdict) | A GenUI turn is conditioned by a pack body and a prompt; both are hashed/versioned so a verdict is reproducible against exactly what was judged. |
| Quarantine on below-bar | none — `status:'judged'`, `passed:false` stays in the shard | An eval corpus measures; hiding a failing record would falsify m3. |
| Verdict archive verbatim, never overwritten, never expiring | identical (ADR-0165 cl.1/2/7) | — |

## 4. LLD-C4 — the Node shell: one CLI, five legs

`npm run eval:genui-corpus -- <leg> [flags]` → `node --experimental-strip-types
packages/agent-ui/a2ui/tools/corpus-genui/eval-genui-corpus.ts <leg> …` (the `rescore.ts` run path; the
repo's Node 24 strips types natively, the flag is kept for the documented invocation's portability).
**Not** a root `scripts/*.mjs`: a typed tool under `tools/` rides `check:tools` and imports the `.ts`
pure core directly — the `.mjs` runners (`eval-a2ui-catalog.mjs`) exist because they drive Playwright
against a page, which this tool never does. Exit codes follow that runner's contract: **0** every leg
green · **1** any red, each listed · **2** setup failure (no key on a key leg, unknown model, unreadable
rubric/data dir). `--dry-run` on every leg computes and prints, writes nothing. `--help` lists the legs
with their side.

| Leg | Side | Reads | Writes | Red (exit 1) when |
|---|---|---|---|---|
| `collect --from <dir\|file>` | KEYLESS | lines/files holding `{genui:{surfaceId,html}}` envelopes (raw proxy transcripts, `DevtoolsEvent`/`recordTurn` captures — anything `readGenuiLine` accepts) + `--pack <id>`/`--prompt <id>` to pin provenance (or `--unpinned` → `packId:null`, `promptId:'captured'`) | pending records, `provenance.source:'captured'`, `origin` = the capture path | an input line fails the wire gate (`E_WIRE`, listed) — exact dups are *reported* `E_DUP` and skipped, not red |
| `generate [--model] [--only-pack] [--only-prompt] [--control] [--dogfood] [--runs N]` | **NEEDS KEY** | `prompts.json` × `GENUI_PACKS`; the key from `process.env.ANTHROPIC_API_KEY` or repo-root `.env` (the `run-flagship.ts` reader, gitignored); `--model` validated by `resolvePair(providers.json)` (default = `defaultModel`) | pending records, `source:'generated'`, `origin` = `run:<ISO>-<shortid>`; a per-run report JSON under `corpus-genui/runs/` (gitignored) | any (prompt,pack) turn yields no genui line (`E_NO_GENUI`) or halts (`ProduceHalt`); the miss is **recorded in the run report, never as a record** |
| `judge [--judge-model] [--only] [--calibrate] [--out]` | **NEEDS KEY** | every `pending` record; the rubric doc VERBATIM (+ its `version:` marker); the pack body by `packId`; `meta.lint` | ONE `GenuiVerdictsFile` at `--out` (default `corpus-genui/verdicts/<date>--<slug>.json`; a differing-bytes target halts before any write, both hashes named — ADR-0165 cl.2) | a reply fails strict JSON parse / dimension range / aggregation check (`E_JUDGE_PARSE`) — that name is OMITTED from the file, listed, exit 1; `--calibrate` scores each record twice and reports per-dimension Δ (red when any Δ > 1 — the rubric's own tolerance) |
| `apply --verdicts <path>` | KEYLESS | the verdicts file + the marker + the records | the named records flip to `judged` with the verdict's values + `verdictDate`; the file is archived VERBATIM under `verdicts/` in the same all-or-nothing step | unknown name · a DIFFERENT verdict for an already-judged name (identical = idempotent no-op) · marker mismatch — nothing written |
| `report [--require-m3]` | KEYLESS | records + archive | `corpus-genui/index.json` (stable-sorted, byte-identical across runs) + a markdown summary to stdout | `--require-m3` and the floor is unmet (§5's m3 reading); otherwise a missed floor is a *result*, exit 0 |

### 4.1 `generate` — the exact producer path, not a shortcut

```ts
const deps: ProduceDeps = {
  provider: injected ?? anthropicProvider({ apiKey, endpoint: pair.entry.endpoint }),   // the dev-proxy construction
  retrieve: (q) => retrieve(a2uiShard, q),                                             // the SAME A2UI retrieval the proxy runs — byte-identical prompt composition
  catalog: defaultCatalog,
}
const genuiSurface: GenuiSurfaceConfig = { enabled: true, sourceBody: pack.body, exclusive: true, dogfood }
for await (const line of produce({ kind:'intent', text: prompt.promptText, session:{ turns:[] } }, deps, { maxRounds: 3, model, genuiSurface })) {
  const env = readGenuiLine(line); if (env) captured.push(env)       // at-most-one law (SPEC-R2): a second genui line is E_WIRE-listed
}
```

`exclusive:true` is the honest consumer fact (this tool renders no A2UI) — the same flag
`gen-ui-live`/`genui-exclusive.test.ts` establish; it removes the "A2UI stays your default" framing that
would otherwise depress pack-idiom use for reasons unrelated to the pack. `dogfood` defaults **false**
(m3 measures pack idioms, not fleet-component reach; the flag is pinned on the record so a later
dogfood-on run is distinguishable). The provider is an **injection point** (`{ provider?: AgentProvider }`
on the leg's options) so the tools test drives the whole leg through a stub — the real adapter is
constructed only by the CLI's key-bearing arm.

### 4.2 `judge` — the rubric IS the judge prompt

`system` = a fixed wrapper constant (role, the JSON reply schema below, "score only what the rubric
says; cite the lint numbers; never invent evidence") + the rubric document **verbatim** (read from
`.claude/docs/rubrics/genui-pack-idiom.md` at run time — one source, no drift pair between the standard
and the prompt; `readRubricVersion()` is the `rescore.ts` marker reader, reused by name). `user` = the
pack body (or "CONTROL — no pack" for `packId:null`), the `promptText`, the `lint` block, the `html`.
One `provider.stream()` call per record (default `--judge-model` = `providers.json` `defaultModel`;
validated by `resolvePair`), text accumulated, then parsed strictly:

```json
{ "dimensions": { "D1": 5, "D2": 4, "D3": 4, "D4": 5 }, "failingDimensions": [], "rationale": "…" }
```

The tool computes `qualityScore = MIN(dimensions)` and `passed` itself (never trusts the model's
arithmetic), and `parseGenuiVerdictsFile` re-checks both on read. The control arm is judged under the
same rubric with D2 read as "idiom use relative to the pack the prompt was *paired* with" — the wrapper
states this — so the report's control delta is like-for-like.

### 4.3 The control arm (why m3 needs it)

"Demonstrable use of the picked pack's idioms" is only demonstrable against a baseline: the same prompt
with `sourceBody` absent. `generate --control` produces one pack-less record per prompt
(`packId:null`, `name:'control--<promptId>--<runId>'`); `report` shows per-pack D2 mean vs control D2
mean. The m3 **floor** reads over pack-conditioned records only (§5); the control delta is the
explanatory figure beside it. Optional per run, recommended for the first judged run.

## 5. LLD-C2 — the data dir

```
packages/agent-ui/a2ui/corpus-genui/
  README.md                 # the operator runbook (§7) — the ONLY non-data file at the root
  prompts.json              # { promptSetVersion: 1, prompts: [{ id, packId, promptText }] } — 4 per pack × 3 packs = 12
  fixtures/
    anatomy-data-viz.genui.json      # a pack's own anatomy snippet wrapped as a full document: the POSITIVE calibration fixture
    off-idiom-cdn.genui.json         # hand-written counter-fixture: generic markup + a CDN <script src>: the NEGATIVE one
  records/v1/<packId>.jsonl          # one GenuiCorpusRecord per line; `control.jsonl` for the control arm — EMPTY at ship
  verdicts/<date>--<slug>.json       # archived GenuiVerdictsFile, verbatim — EMPTY at ship
  index.json                # DERIVED by `report`; committed; the docs page's input; byte-identity gated
  runs/                     # gitignored — per-run reports (misses, timings, raw replies for E_JUDGE_PARSE post-mortems)
```

**`prompts.json` authoring rule (the build seat writes the content; this LLD fixes the law):** each
prompt is a realistic user ask whose *natural* answer uses ≥ 2 of its paired pack's named anatomy idioms
(the `Anatomy —` sections of the pack `.md`), and **never names the pack, its label, or an idiom by
name** — the conditioning must come from the pack body, or m3 measures prompt leakage. The gate
grep-asserts the id/label absence. `promptSetVersion` bumps on any text change; records pin the version
they were generated under.

**`index.json` (derived, the page's contract):**

```ts
interface GenuiCorpusIndex {
  generatedAt: string; rubricVersion: string; promptSetVersion: number
  records: { name; promptId; packId; model; status; qualityScore?; passed?; failingDimensions?; dimensions?; htmlHash; verdictDate?; lint }[]   // stable-sorted by name
  m3: null | {                                                // null until ≥1 judged pack-conditioned record exists
    judged: number; passed: number; passRate: number; minScore: number; meanScore: number
    floorMet: boolean                                         // every judged pack-conditioned record has qualityScore ≥ 4
    perPack: Record<string, { judged; passed; meanD2; minScore }>
    control?: { judged: number; meanD2: number }             // present when the control arm was judged
  }
}
```

**The m3 reading, fixed here:** PRD §8 says "judge-scored ≥ 4/5" of the turn; the rubric's MIN
aggregation makes `passed` per record; the floor is **every** judged pack-conditioned record `passed`
(a single sub-4 record fails it — the A2UI rubric's "one weak dimension sinks the record" posture lifted
to the run). `passRate`/`meanScore` are reported beside it so a near-miss is legible, never a substitute.

## 6. LLD-C3 — the rubric `.claude/docs/rubrics/genui-pack-idiom.md` (v1.0)

Modeled on `a2ui-corpus.md`'s shape byte-for-byte where the shape is load-bearing: the `version:` marker
line (read by `readRubricVersion()`; every `GenuiVerdictsFile` cites it), the "Runtime role — why the shape
is fixed" preamble (aggregation = MIN over `[gate]` dims; `passed = qualityScore ≥ 4`; tag semantics;
cite-never-re-judge a script), a dimension table with type · evidence · 1/3/5 anchors, the gate-to-promote
+ top-failure block, and a **calibration record**. Four dimensions, all `[gate]`:

| # | Dimension | Deterministic floor (cited, not recomputed) | What judgment adds |
|---|---|---|---|
| D1 | Envelope + document validity | `validateGenuiRecord` = [] (wire gate, hash pins) — a tier-1 reject never reaches the judge; `lint.hasDoctype` | the document is coherent (one root, no truncated/unbalanced markup, no leftover prompt prose) |
| D2 | **Pack-idiom use — the m3 dimension** | none mechanical (this is the judgment the eval exists for); evidence = the pack body's named anatomy sections vs the html | 1: no named idiom present / a generic component unrelated to the pack · 3: one idiom, partially followed · 5: the pack's anatomy followed with ≥ 2 idioms and the pack's stated constraints (e.g. CSS-driven shapes, no library) honored |
| D3 | Prompt fit | `promptText` non-empty (`E_SCHEMA` floor) | the html answers *this* ask (its data, its labels, its affordances), not a demo of the pack |
| D4 | Sandbox-reality conformance | `lint.externalRefs` (= 0 is the 3-floor; > 0 caps at 2), `lint.tokenRefs` (≥ 1 is the 3-floor) | themed via the bridge tokens, self-contained, degrades when a bridge message never arrives |

**Calibration (the rubric's own ±1 law, kept):** two independent fresh-context reads of BOTH committed
fixtures (§5) — the anatomy fixture must land `passed:true`, the off-idiom fixture `passed:false` with
D2 ≤ 2 and D4 ≤ 2; every per-dimension Δ ≤ 1, else repair the anchor, never widen the tolerance. Authored
keyless by the build seat and labeled as *fixture calibration*; the first real judged run's
`--calibrate` Δ report is appended to the rubric as a dated second record when Kim runs it.
Gate: `harness_checks.py rubric` (docs plugin `make-rubric/scripts/`) exits 0 — verified available and
green on `a2ui-corpus.md` in this pass. `harness_wiring_check.py`'s orphan-rubric rule (c) matches
`a2ui-*.md` only; this rubric's consumer is the `judge` leg + LLD-C6, named in the rubric's preamble.

## 7. LLD-C5 — the docs page `site/genui-corpus.html`

No A2UI corpus results page exists today (`site/` has no reader of `corpus/`; the A2UI corpus is
presented only through the catalog/patterns pages and the ADR index) — so this is a **minimal new
page, said so plainly**, following the ungrouped site-level posture of `data-doc.ts` (`mountPage` from
`_page.ts` first; `el`/`exampleSection` from `lib/specimens.ts`) and the `?raw` import precedent
(`a2a-artifact-feed.ts` imports a `.jsonl?raw`).

- **Inputs:** `import index from '../../packages/agent-ui/a2ui/corpus-genui/index.json'` (the summary)
  + `import.meta.glob('../../packages/agent-ui/a2ui/corpus-genui/records/v1/*.jsonl', { query: '?raw', import: 'default', eager: true })`
  (the html, parsed in-page by `name`). The page never computes a score — it presents `index.json`.
- **Layout:** (1) an intro naming m3, the rubric version, and the named manual run; (2) the **m3 panel** —
  `floorMet` verdict, judged/passed/passRate/min/mean, a per-pack row, the control delta when present; (3)
  a **record table** — one row per record: name · pack · prompt · model · status · score · failing dims ·
  verdict date · `htmlHash` (short); (4) per **judged** row a `ui-disclosure` whose open mounts a real
  `ui-sandbox-frame` (`surfaceId`, `html` from the shard — the `sandbox-frame-demo.ts` idiom; lazy so an
  unopened page mounts zero iframes) and shows the verdict rationale beneath it.
- **Empty state (what ships tonight):** `m3 === null` → the panel says "No judged run yet — run
  `npm run eval:genui-corpus -- generate` / `judge` / `apply` / `report` (needs `ANTHROPIC_API_KEY`)" and
  the table says "0 records". No placeholder numbers, no sample rows.
- **Discovery:** a `site/lib/site-manifest.json` L2 row (`section: "GenUI"`, beside "GenUI Chat Demo") +
  `node scripts/generate-sitemap.mjs` (the `sitemap.test.ts` G1/G2 gate).
- **Tests:** `genui-corpus.test.ts` (jsdom: the empty state with the committed index; a fixture index +
  fixture shard injected through the page's exported `renderCorpus(index, shards, root)` renders rows and
  mounts a frame with `.html === record.html` on disclosure open) · `genui-corpus.browser.test.ts` (the
  fixture row paints a frame — pixel-truth for Phase 4).

## 8. Acceptance (inline — the SPEC owns no B3 IDs by its own §6 cut)

Every predicate is keyless unless marked; each maps to a decomp leaf's `accept`.

| # | Predicate | Instrument |
|---|---|---|
| AC1 | `validateGenuiRecord` returns `[]` on a well-formed record and the listed `E_*` on each defect; `src/corpus-genui/` has no `node:` import (self-grep) | `npm test corpus-genui` (n1a) |
| AC2 | `parseGenuiVerdictsFile` batches issues; rejects `rubric ≠ 'genui-pack-idiom'`, marker mismatch, unknown keys, out-of-range dims, `passed ≠ (score ≥ 4)`; merge = latest date wins / same-date conflict / identical idempotent | `npm test corpus-genui` (n1b) |
| AC3 | `lintGenuiHtml` returns the exact counts over the two fixtures | `npm test corpus-genui` (n1c) |
| AC4 | `prompts.json`: version 1, 12 prompts, pack ids ∈ `GENUI_PACKS`, no prompt contains its pack's id/label | `npm test corpus-genui` (n2a) |
| AC5 | fixtures validate as envelopes and appear in no shard/verdict; `records/` and `verdicts/` ship EMPTY; `index.json` == `report`'s regeneration (`m3:null`) | `npm test corpus-genui` (n2b/n2c) |
| AC6 | the rubric passes `harness_checks.py rubric` (exit 0) and carries `version: 1.0`; its calibration record has Δ ≤ 1 everywhere with opposite outcomes on the two fixtures | the checker + doc-checker review (n3a/n3b) |
| AC7 | `--help` lists five legs with sides; `generate`/`judge` with no key exit 2 writing nothing; unknown `--model` exits 2 | tools test via child process (n4a) |
| AC8 | `collect` writes pending records from a capture fixture, reports `E_DUP`, is a byte-identical no-op on re-run, exits 0 with nothing to collect | `npm test corpus-genui-tools` (n4b) |
| AC9 | `generate` with a stub provider writes the expected record per (prompt,pack); a no-genui stub yields `E_NO_GENUI` + no record + exit 1; the real adapter is reached only via the CLI key arm | `npm test corpus-genui-tools` (n4c) |
| AC10 | `judge` with a stub provider writes a parseable verdicts file citing the live marker; a prose reply → `E_JUDGE_PARSE`, name omitted, exit 1; `--calibrate` reports Δ; differing-bytes target halts | `npm test corpus-genui-tools` (n4d) |
| AC11 | `apply` rewrites exactly the named records + archives verbatim, all-or-nothing; unknown name / conflicting re-verdict halt; identical re-apply is a no-op | `npm test corpus-genui-tools` (n4e) |
| AC12 | `report` over empty → `m3:null`; over a judged fixture set → the exact aggregate; stable bytes; `--require-m3` follows the floor | `npm test corpus-genui-tools` (n4f) |
| AC13 | the page renders the honest empty state from the committed index; a fixture index renders rows + mounts a frame with the record's html on open; the browser shard paints it | `npm test genui-corpus` · `npm run test:browser:site` (n5a) |
| AC14 | manifest row + regenerated sitemap pass G1/G2 | `npm test sitemap` (n5b) |
| AC15 | the standing gate is green on the committed dir and RED on a planted score with no archived verdict (negative control over a temp copy) | `npm test corpus-genui` (n6a) |
| AC16 | `eval:genui-corpus` exists in `package.json` and is referenced by none of `check`/`test`/`test:browser` or their sub-scripts; `vitest.config.ts` carries the explicit `tools/corpus-genui/*.test.ts` include | `npm test corpus-genui` (n7a/n7b) |
| AC16b | the README names every leg + its KEYLESS/NEEDS-KEY tag + the no-fabrication rule, and is the sole non-data file at the corpus-genui root | `npm test corpus-genui` (n7c) |
| AC17 | `npm run check` and `npm test` green by exit code with **no** `ANTHROPIC_API_KEY` in the environment (SPEC-N3 / live-agent SPEC-R3 AC2) | the standing gates |
| **AC18 (NEEDS KEY — the manual run, out of tonight's scope)** | `generate` → `judge` → `apply` → `report` complete on Kim's machine; `index.json` shows `m3 ≠ null`; the docs page renders real verdicts + frames; the `--calibrate` Δ report is appended to the rubric | Kim, later; recorded as a dated Findings entry on GH #1584 |

**Repair note (AC18 landed, 2026-08-23 — the literal-empty half of AC5/AC17 is retired).** AC5's "`records/` and
`verdicts/` ship EMPTY" clause and `corpus-genui-data.test.ts`'s two matching assertions ("the committed
index.json shows the honest empty state at ship", "zero \*.jsonl files under records/, zero \*.json files
under verdicts/") described the pre-AC18 ship state ONLY — they were never meant to hold once Kim's named
manual run actually landed real records, since AC18 itself names `index.json` showing `m3 ≠ null` as this
design's own intended outcome. GH #1584's AC18 run landed on 2026-08-23 (PR #1603); both assertions were
replaced in the same PR with the invariant they were always standing in for — the no-fabrication law
(every `judged` record's `qualityScore`/`passed` pair is internally consistent and never present on a
non-`judged` record; `m3` is null iff zero judged pack-conditioned records exist) plus a duplicate-archive
guard (no two `verdicts/*.json` files are byte-identical). AC17's "green by exit code" clause is otherwise
unaffected — `npm run check`/`npm test` still gate with no key in the environment, now against a populated
corpus instead of an empty one.

## 9. Risks (ranked)

1. **The m3 floor may simply not be met on the first real run** (a pack idiom the model ignores, or a
   prompt that leaks). *Detection:* `report` shows `floorMet:false` with per-pack D2 means and the control
   delta. *Fallback:* that is the measurement PRD §8 asked for — repair the **pack** or the **prompt set**
   (bump `promptSetVersion`), re-run; never loosen the rubric to pass. A rubric anchor repair is allowed
   only off a `--calibrate` Δ > 1 finding (the a2ui-corpus law), with a version bump.
2. **Judge reply parse failures** (`E_JUDGE_PARSE`) waste key spend. *Detection:* the run report under
   `runs/` keeps the raw reply. *Fallback:* the wrapper constant is the only prompt surface to tune; the
   record stays `pending` and is re-judged with `--only <name>` — no partial verdict is ever written.
3. **Two verdict-adapter modules (`src/corpus/judge.ts` vs `src/corpus-genui/verdicts.ts`)** are a drift
   pair in idiom, not in data. *Detection:* both carry the same batched-issue shape; a reviewer reads
   them side by side. *Trigger to consolidate:* a THIRD rubric-backed verdict file type (e.g. a2a) —
   then generalize `parseVerdictsFile` over a rubric-name parameter in its own slice; not before.
4. **`index.json` drift** (a hand edit, or a `report` not re-run after `apply`). *Detection:* LLD-C6's
   byte-identity leg (the `sitemap.test.ts` G1 pattern). *Fallback:* `npm run eval:genui-corpus -- report`.
5. **Site bundle growth** from `?raw` shards once real records exist (≤ 512 KiB each by the wire law;
   12–24 records realistic ~10–40 KiB each). *Detection:* `npm run size` is package-scoped and unaffected;
   the site build output size is eyeballed at the first real run. *Fallback:* switch the page to a
   `fetch()` of the shard at runtime (a one-function change behind `renderCorpus`).
6. **Exact-dup across runs** (`E_DUP`) hides a real signal if skipped silently. *Mitigation:* the run
   report lists every dup with both names; the second occurrence is **not** written (one artifact, one
   record) — a deliberate choice recorded here, revisit if dup rate is itself a metric someone wants.
7. **Non-decision, recorded:** no ADR is minted. The sibling-dir fork (§2) applies ADR-0062/0068/0165 by
   pattern without altering them; the eval-only facet and the no-quarantine posture are this LLD's
   scoping, reversible by a later LLD rev. A reviewer who disagrees should raise it on GH #1584 before
   build, not after.

## 10. Build sequence (slices = decomp nodes; gates named per slice; FOREGROUND, exit codes only)

| Slice | Nodes | Gate | Notes |
|---|---|---|---|
| s1 | n1a, n1b, n1c | `npm test corpus-genui` | pure core first; fixtures from s2 may be inlined as strings here |
| s2 | n2a, n2b, n2c (data) + n3a, n3b (rubric) | `harness_checks.py rubric` · `npm test corpus-genui` | the rubric and the fixtures are co-designed (calibration needs both) |
| s3 | n4a, n4b, n4e, n4f | `npm run check` · `npm test corpus-genui-tools` (after n7b) | the keyless legs + CLI skeleton |
| s4 | n4c, n4d | `npm test corpus-genui-tools` (stub provider) | the key legs' CODE; `--dry-run` proven; no live call in any test |
| s5 | n6a, n7a, n7b, n7c | `npm run check && npm test` | the standing gate + wiring — `vitest.config.ts` is the one serial shared edit |
| s6 | n5a, n5b | `npm test genui-corpus sitemap` · `npm run test:browser:site` | the page last (it reads s3's `index.json` shape) |
| **manual** | AC18 | Kim's named run | out of tonight's scope; a dated Findings entry on GH #1584 closes the loop |

Slices s1–s2 and s3–s4 are file-disjoint and may run in parallel; s5 integrates; s6 follows s3.

## 11. Doc-repair list (stale-context law)

- `roadmap.md` §3 Milestone 1 — "No GitHub issue exists yet for B3" → GH #1584 minted + this LLD
  (**done in this plan pass**). §4's duplicate deferred B3 entry → one-line pointer to §3 (**done**).
  §2's "B3 … (§4)" pointer → §3 (**done**).
- `corpus-genui/README.md` — the runbook (LLD-C7, build).
- `a2ui-corpus-store.lld.md` — no edit: the A2UI corpus is untouched; a one-line "sibling eval corpus"
  cross-reference is owed only if a reader is observed looking for GenUI records there (§9 r3's trigger).
- GH #1584 — Phase 2 exit: link this LLD; Phase 3: one dated Findings entry per slice; Phase 4: checker
  verdict + the docs page's rendered empty state/fixture frame as the pixel leg; AC18 stays an open
  Findings item until Kim's run lands.

## Components

See §1 (the component map LLD-C1–C7) and §3–§7 (one section per component). Substrate referenced,
never restated: the genui wire (`genui-line.ts`), the producer seam (`produce.ts`/`AgentProvider`),
the packs registry (`genui-packs.ts`), the A2UI corpus patterns (`a2ui-corpus-store.lld.md`,
ADR-0062/0068/0165), the site page idiom (`_page.ts`, `specimens.ts`).

## Interfaces

§3.1 `GenuiCorpusRecord` · `validateGenuiRecord` · `genuiRecordHashes` — §3.2 `GenuiVerdictsFile` ·
`parseGenuiVerdictsFile` · `mergeGenuiVerdictArchive` — §3.3 `lintGenuiHtml` — §4 the CLI legs, flags,
exit codes, and the `{ provider?: AgentProvider }` injection point — §5 `GenuiCorpusIndex` (the page's
read contract) — §7 `renderCorpus(index, shards, root)` (the page's testable seam).

## Data

§5 — the `corpus-genui/` tree, what is committed (prompts, fixtures, README, the derived `index.json`),
what is derived (`index.json`), what starts empty and is written only by LLD-C4 (`records/`, `verdicts/`),
what is gitignored (`runs/`, `.env`). Migration: none — a new dir; the A2UI corpus is byte-untouched.
Versioning: `promptSetVersion` (data), `rubricVersion` (standard), `packHash` (conditioning), `htmlHash`
(artifact) — a verdict is reproducible against all four.

## Risks

§9.

## Agent verification

The SPEC carries no `## Agent verification` section at all, for any wave (not a B3-only gap); §8 is this design's own. **New
instruments this build creates:** `src/corpus-genui/*.test.ts` (LLD-C1), `tools/corpus-genui/*.test.ts`
driving every leg through a stub `AgentProvider` (the `produce-loop.test.ts` precedent — AC7–AC12), the
standing data gate `corpus-genui-data.test.ts` with its planted-score negative control (AC15), and the
page tests (AC13). **Existing instruments reused:** `harness_checks.py rubric` (AC6), `sitemap.test.ts`
(AC14), `check:tools` (typing the shell), `layering.test.ts` (no new DAG edge), and the standing
`check`/`test`/`test:browser` run with no key (AC17). **The one criterion no agent can verify tonight is
AC18** — named as the manual run, not left silent.
