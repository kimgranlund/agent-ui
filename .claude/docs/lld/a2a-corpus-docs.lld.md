# LLD — A2A Concepts/Demos Corpus + Docs-Site Section (B4 + B5)

> Status: accepted · v0.1 · 2026-07-08 · Layer: LLD (implementation plan)
> Implements: [`../spec/a2a-foundations.spec.md`](../spec/a2a-foundations.spec.md) **SPEC-R14, SPEC-R15** (+ consumes SPEC-R2 pin · SPEC-R6 shared validator · the tic-tac-toe LLD's transcript/isolation surfaces (its LLD-C3/C4, realizing SPEC-R10/R12) · SPEC-N1/N2/N3 — referenced, not re-derived). PRD trace via the SPEC: PRD-G3 (corpus), PRD-G4 (docs section).
> Altitude: adds the **how** for the corpus + the corpus-derived site section only. Derived from the coverage-clean decomposition ([`../decompositions/a2a-corpus-docs.decomp.json`](../decompositions/a2a-corpus-docs.decomp.json) — strict + plan mode, exit 0, 2026-07-08).
> **One LLD, two waves (a scoping ruling, recorded here):** B4 (corpus) and B5 (site section) share this document because SPEC-R15 is a pure consumer of SPEC-R14's admitted shard — the record shape, the consumption surface, and the page card co-evolve, and splitting them would put that seam at a document boundary each doc would then restate (one fact, one home). The waves stay sequenced: **B5's slices do not dispatch until the B4 gate (§9) is green.** The PRD §7 downstream-documents sketch ("a corpus-store LLD, a site-section LLD") is repaired to this single doc in the same change.
> Mirror ruling (PRD-D5, ratified direction): this subsystem **mirrors the a2ui corpus discipline** (`packages/agent-ui/a2ui/src/corpus/` — total schema validator · single-writer admission · byte-stable JSONL · standing data gate) **with an A2A-native record type**; it shares no code with the a2ui store and deliberately omits organs the a2ui corpus needed for mined model output (§8.4 names each omission + its reinstatement trigger).

---

## 1. Component map (traceability)

| ID | Component | Implements | File (under `packages/agent-ui/a2a/` unless noted) | Scope |
|---|---|---|---|---|
| **LLD-C1** | Record model + schema validator | SPEC-R14 | `src/corpus/record.ts` | runtime (zero-dep) |
| **LLD-C2** | Shard store (parse · canonical serialize · paths · admitted filter) | SPEC-R14 | `src/corpus/shard.ts` | runtime (zero-dep) |
| **LLD-C3** | Admission pipeline (injected deps) | SPEC-R14 | `src/corpus/admit.ts` | runtime (zero-dep) |
| **LLD-C4** | Seed record set — 11 concepts + 2 demos, typed TS | SPEC-R14 (content: PRD-G3) | `tools/corpus/seeds.ts` | dev (Node graph) |
| **LLD-C5** | Import tool — the single writer | SPEC-R14 | `tools/corpus/import-seeds.ts` | dev (Node) |
| **LLD-C6** | Committed shards | SPEC-R14 | `corpus/concept/v0_3_0/a2a.jsonl` + `corpus/demo/v0_3_0/a2a.jsonl` | committed data |
| **LLD-C7** | Standing corpus-data gate | SPEC-R14 AC1 | `src/corpus/corpus-data.test.ts` | test (Node fs, test-only) |
| **LLD-C8** | Barrel: corpus consumption surface | SPEC-R14, N1 | `src/index.ts` (one serial edit) | runtime (zero-dep) |
| **LLD-C9** | Site derivation lib | SPEC-R15 | `site/lib/a2a-concepts.ts` + `.css` | site |
| **LLD-C10** | Concepts page shell | SPEC-R15, N2 | `site/a2a-concepts.html` + `site/pages/a2a-concepts.{ts,css}` | site |
| **LLD-C11** | Drift gate + browser smoke | SPEC-R15 AC1 | `site/lib/a2a-concepts.test.ts` + `site/pages/a2a-concepts.browser.test.ts` | test (site project) |
| **LLD-C12** | Nav/TOC + landing integration | SPEC-R15 (PRD-G4 nav wiring) | `site/pages/_page.ts` + `site/main.ts` | site (shared files — one serial slice) |

**Split rule (SPEC-N1/N2, the a2ui/a2a posture repeated):** `src/corpus/*` is pure + zero-dep — no `fs`, no Node builtins — so the browser page consumes the SAME record validator and shard parser the admission tool and the standing gate use (SPEC-N4's no-forks stance applied to the corpus). Everything that touches the filesystem lives in `tools/corpus/` or inside test files (the `corpus-data.test.ts` fs use is test-only, the a2ui precedent).

## 2. The record model (LLD-C1 — A2A-native, mirrored discipline)

```ts
// src/corpus/record.ts (zero-dep; imports only ../protocol/* types)
export type A2aFacet = 'concept' | 'demo'
export type A2aRecordStatus = 'valid' | 'quarantined'
export type A2aProvenanceSource = 'authored' | 'distilled' | 'mined'

/** Grounding citation — the record's tie to verified truth (SPEC-R14's grounding arm; PRD-G6 discipline).
 *  'hv' rows are the SPEC §2 host-verification ledger (the verbatim-quote substrate); 'repo' paths point
 *  at committed artifacts (an ADR, a module, a fixture). Resolution is checked, not trusted (§3/§4). */
export type A2aCitation =
  | { kind: 'hv'; row: string }          // 'HV-1'…'HV-12' — must exist RESOLVED in the SPEC §2 ledger
  | { kind: 'repo'; path: string }       // repo-relative; must exist on disk

/** One wire artifact. Inline kinds are exactly the shared validator's own artifact vocabulary
 *  (`A2aArtifactKind`, validate.ts — SPEC-R6 judges message · task · card · rpc-request · rpc-response);
 *  'transcript' references a committed match fixture BY PATH (never inlined — one fact, one home: the
 *  fixture stays owned by the arena's LLD-C9) and declares the isolation verdict it expects. */
export type A2aWireArtifact =
  | { kind: 'message' | 'task' | 'card' | 'rpc-request' | 'rpc-response'; artifact: unknown }
  | { kind: 'transcript'; path: string; expect: 'clean' | 'contaminated' }

export interface A2aCorpusRecord {
  name: string                            // unique join key across BOTH shards (the a2ui invariant i)
  description: string                     // one-line summary (the page card's subtitle)
  body: string                            // the teaching prose — the ONE home for concept prose (SPEC-R15)
  citations: A2aCitation[]                // ≥ 1 — a record with no resolvable grounding is not "documented"
  wire: A2aWireArtifact[]                 // ≥ 1 (SPEC-R14 "one or more wire artifacts")
  meta: {
    facet: A2aFacet
    protocolVersion: string               // must equal the family pin (PROTOCOL_VERSION = '0.3.0', types.ts)
    provenance: { source: A2aProvenanceSource; origin: string }  // origin non-empty
    status: A2aRecordStatus
  }
}

export type CorpusAdmitCode = 'E_SCHEMA' | 'E_PIN' | 'E_CITE' | 'E_REPLAY'
export interface CorpusFailure { code: CorpusAdmitCode; path: string; detail: string }

/** Total + batch (the validateRecord/validateA2a posture — never throws, reports every failure). */
export function validateCorpusRecord(r: unknown, opts: { protocolVersion: string }): CorpusFailure[]
```

**Code ownership (one concern, one code — mirrors a2ui's `record.ts` split):** `validateCorpusRecord` owns three of the four codes: **E_SCHEMA** (container shape — closed key sets on the record and `meta`, vocab checks on `facet`/`status`/`provenance.source`, well-formed `wire[]` discriminators incl. the `expect` vocab, non-empty `provenance.origin`), **E_PIN** (`meta.protocolVersion` non-empty AND `=== opts.protocolVersion` — presence deliberately reported as E_PIN, not E_SCHEMA, the a2ui `checkPins` precedent), and the shape/emptiness arm of **E_CITE** (`citations` a non-empty array of well-formed entries — anything wrong with grounding carries E_CITE, so a firing fixture per code stays clean). Citation **resolution** and all of **E_REPLAY** need I/O or the shared validator and belong to admission (§3). No healer normalizes input first: candidates are typed, authored TS — a malformed record is rejected, never repaired (§8.4).

## 3. Admission (LLD-C3 — the pipeline; injected deps keep the core pure)

```ts
// src/corpus/admit.ts
export interface AdmitDeps {
  protocolVersion: string                                  // the import tool passes PROTOCOL_VERSION
  resolveCitation(c: A2aCitation): boolean                 // tool wires: hv → SPEC §2 ledger read; repo → existsSync
  loadTranscript(path: string): string | undefined         // tool wires: readFileSync; undefined = unreadable
}
export type AdmitResult =
  | { admitted: true; record: A2aCorpusRecord }
  | { admitted: false; failures: CorpusFailure[] }
export function admitRecord(candidate: unknown, deps: AdmitDeps): AdmitResult
```

Stage order (each independently testable; batch within a stage, short-circuit between stages — the a2ui `admit.ts` shape):

1. **Schema + pin + citation shape** — `validateCorpusRecord(candidate, deps)` (E_SCHEMA · E_PIN · E_CITE).
2. **Citation resolution** (skipped for `status:'quarantined'` — §4 quarantine semantics) — every citation must resolve via `deps.resolveCitation`; a dangling HV row or missing repo path is **E_CITE** at `citations[i]`.
3. **Replay** (skipped for `status:'quarantined'`) — per `wire[i]`:
   - *Inline artifact* → `validateA2ui`-posture reuse of the **shared validator**: `validateA2a(artifact, { protocolVersion, expect: kind })` must return `[]` (SPEC-N4 — admission never forks the validator; `expect` is passed explicitly, never `'auto'`, so a mislabeled artifact fails rather than being re-classified). Any failure ⇒ **E_REPLAY** at `wire[i]`, `detail` carrying the underlying `code@path` list.
   - *Transcript reference* → `deps.loadTranscript(path)`; unreadable ⇒ E_REPLAY. Then compose the arena's own surfaces (reuse, no forks): `parseTranscriptLines` + `validateTranscript` must pass (this re-checks the header pin — SPEC-R2), then `checkIsolation` and **match the declared expectation**: `expect:'clean'` ⇒ `[]`; `expect:'contaminated'` ⇒ non-empty. A mismatch **in either direction** is E_REPLAY — a contaminated control that starts passing the gate is a *stale negative control*, exactly as much a defect as a clean match that starts failing.

Admission never mutates `status` (no healer exists to compute `repaired`; records are authored `valid`, and quarantining is a curator edit to `seeds.ts` re-imported through LLD-C5). The pipeline is a pure function of `(candidate, deps)`; tests drive stages 2–3 with fake deps.

## 4. Storage + the standing gate (LLD-C2/C6/C7)

**Layout (mirrors the a2ui `corpus/{facet}/{pinDir}/…` arithmetic; no catalogId axis exists here):**

```
packages/agent-ui/a2a/corpus/concept/v0_3_0/a2a.jsonl    ← facet:'concept' only
packages/agent-ui/a2a/corpus/demo/v0_3_0/a2a.jsonl       ← facet:'demo' only
```

`shard.ts` (pure): `shardPath(facet, protocolVersion)` (pin dir = the file-safe spelling, `'0.3.0'` → `'v0_3_0'`) · `parseShard(text)` — total, returns `{ records, failures }` with line-indexed failure paths · `serializeRecord(rec)` — **recursively key-sorted** `JSON.stringify` (the canonical line form) · `serializeShard(records)` — one line per record **in given order** + trailing newline (line order = seed authoring order, which is the page's teaching order; determinism comes from `seeds.ts` being code, not from sorting) · `admittedRecords(records)` — the consumption filter, excludes `status:'quarantined'` (the a2ui `all()` posture).

**Byte-stability without a hash:** the a2ui store carries `canonicalHash` because dedup needs it; this corpus has no dedup (§8.4), so byte-stability is enforced *directly*: **the committed line IS its canonical form** — the standing gate asserts `serializeRecord(JSON.parse(line)) === line` for every line. Stronger than a stored hash (nothing stale to trust) and one fewer field to maintain.

**Quarantine semantics (mirrors a2ui ADR-0068 clause 6):** `status:'quarantined'` lines are LEGAL in a shard — schema/pin/citation-shape and canonical-form legs run for EVERY line; citation-resolution and replay legs run for **non-quarantined lines only** (a quarantined record may legitimately no longer replay — that is what quarantine records). Consumption (`admittedRecords`, hence the page) excludes them.

**The standing gate** (`corpus-data.test.ts` — test-only `node:fs`; the shard-reading legs follow the
a2ui `corpus-data.test.ts` precedent, while the HV-ledger leg is GENUINELY NOVEL — a2ui's gate reads
committed data shards, never a design-doc `.md`; review sanctioned the coupling WITH HARDENING: one
exported ledger-path constant, e.g. `tools/corpus/ledger-path.ts`, imported by BOTH the import tool and
this gate so a SPEC move is a one-line greppable fix, and the leg's failure message must NAME the
dependency — "HV-ledger resolution requires <path> — did the SPEC move/rename?" — never a bare ENOENT)
re-validates the committed shards on every `npm test`:

1. both shards exist and are non-empty; **concept count ≥ 6 and demo count ≥ 1** — the PRD-G3 target floor as an executable predicate, so shrinking the corpus below target is a red gate, not a silent regression;
2. `name` unique across BOTH shards (invariant i); facet-per-shard (invariant ii);
3. every line: `validateCorpusRecord` returns `[]` against `PROTOCOL_VERSION`, and the canonical-line identity holds;
4. non-quarantined lines: every citation resolves — `hv` rows by reading `.claude/docs/spec/a2a-foundations.spec.md` and asserting the row exists in the §2 ledger table **with a resolution marker** (`CONFIRMED`/`CORRECTED` in its resolution cell); `repo` paths by `existsSync` (§8.2 names this doc-coupling risk);
5. non-quarantined lines: the full §3 replay arm — inline artifacts through the real `validateA2a`; transcript references re-read from `matches/` through `validateTranscript` + `checkIsolation` with expectation matching. **This is where "the corpus's negative controls still bite" is standing** — the isolation-gate concept record (§5) carries both contaminated fixtures as `expect:'contaminated'`, so this gate re-proves, on every test run, that the arena's must-fail fixtures still fail;
6. red-control legs: in-test doctored line strings (a stale re-keyed line · a dangling HV cite · a dangling repo path · a flipped transcript expectation) assert each leg above FIRES — the gate is proven to bite in the same file that runs it (constraint C5's determinism-over-judgment, the arena's negative-control doctrine applied to the gate itself).

**Write path (LLD-C5, the single writer):** `import-seeds.ts` (Node) wires real deps (`resolveCitation` = SPEC-file read + `existsSync`; `loadTranscript` = `readFileSync`), runs `admitRecord` over every seed, and is **all-or-nothing**: any failure prints every `CorpusFailure` and exits non-zero writing NOTHING; success serializes both shards and writes them. Re-running on unchanged seeds is byte-idempotent (accept predicate). Only this tool writes `corpus/` — the a2ui invariant iv.

## 5. The seed set (LLD-C4 — the session's validated knowledge, enumerated)

15 concept + 2 demo records; every artifact below already exists committed and gate-green (protocol fixtures under `src/protocol/fixtures/`, matches under `matches/`), so admission replay is checking real, validated content — nothing is authored speculatively. Wire artifacts are inlined as **typed literals** in `seeds.ts` (typed against `../src/protocol/types.ts`/`../src/rpc/frame.ts`, so `npm run check` would catch type-level drift were `tools/` in its `include` scope — it is not, a pre-existing repo-wide condition this wave inherits rather than introduces, §8.6; the replay arm catches validator-level drift regardless, via the standing gate). Body prose is authored at build time to teach exactly the cited facts — the citations column is the record's normative source, per PRD-G6. Rows #14–17 are four coordinator-ruled additions admitted into this same B4 wave (the review's headroom list), authored to the identical standard as #1–13.

| # | `name` | Facet | Teaches (body scope) | Citations | Wire artifacts |
|---|---|---|---|---|---|
| 1 | `message-parts` | concept | `Message` shape, `kind` discriminators, TextPart/DataPart/FilePart, FileWithBytes/FileWithUri mutual exclusion | HV-4, HV-11 | inline `message` ×3 (text · data · file-uri forms) |
| 2 | `task-lifecycle` | concept | the 9-state set, 4 sealed terminals, and the 35/46 transition **family policy** (upstream defines states + terminals, NOT the full matrix — the policy is ours, `task-state.ts` is its owning record) | HV-5 · repo `…/src/protocol/task-state.ts` | inline `task` ×2 (completed · input-required) |
| 3 | `error-mapping` | concept | the 3-tier outbound mapping: parse→`-32700`, malformed envelope→`-32600`, schema-shaped→`-32602`; the seven A2A codes `-32001…-32007` | HV-9 · repo `…/src/rpc/errors.ts` | inline `rpc-response` (task-not-found error envelope) |
| 4 | `method-split` | concept | known-but-unsupported (`-32004`) vs unknown (`-32601`) — the two-method-table honesty rule | HV-3, HV-9 · repo `…/src/rpc/frame.ts` | inline `rpc-request` (message/send) |
| 5 | `byte-fidelity-codec` | concept | decode composes the shared validator (a judging decode, never a blind parse); encode-canonical fixtures make `encode(decode(raw)) === raw` | HV-4 · repo `…/src/protocol/codec.ts` | inline `message` (round-trip example) |
| 6 | `agent-card-discovery` | concept | card required fields; `protocolVersion` (the pin) vs `version` (the agent's own) are two fields, never conflated; the `/.well-known/agent-card.json` path | HV-7 | inline `card` (the referee card) |
| 7 | `version-pin` | concept | why `0.3.0` knowingly one major behind v1.0.1: PascalCase method renames + error-set restructuring bought churn, not capability; the 1.x migration is a named future fork | HV-1, HV-3, HV-9 | inline `card` (carrying the pin field) |
| 8 | `loopback-channel-close` | concept | the `A2aChannel` contract; `close()` drain-and-end semantics (send-after-close rejects loudly; buffered receives drain in order, then `done`) | repo `…/src/channel/loopback.ts` · repo `.claude/docs/spec/a2a-foundations.spec.md` (§6, the SPEC-owned ruling) | inline `message` (an in-order sequence member) |
| 9 | `referee-star-topology` | concept | referee-mediated star (PRD-D4): the board as the only shared truth, the closed `BoardMessage` shape, `lastOpponentMove` as the game-theoretic minimum | repo `.claude/docs/lld/a2a-tic-tac-toe.lld.md` · repo `…/src/arena/referee.ts` | inline `message` (a BoardMessage riding a data part) |
| 10 | `isolation-gate` | concept | the four checks (canary · wire-origin · closed-schema · provenance), the two leak classes, and why negative controls make the gate proven rather than asserted | repo `…/src/arena/isolation.ts` · repo `.claude/docs/lld/a2a-tic-tac-toe.lld.md` | `transcript` ×2: `matches/contaminated-control.match.jsonl` + `matches/contaminated-provider-control.match.jsonl`, both **`expect:'contaminated'`** |
| 11 | `recorded-default-posture` | concept | recorded-default demos: static build ships a replayable fixture (zero network/keys); live runs are dev-only behind a server-side-key proxy | repo `site/pages/a2a-tic-tac-toe.ts` · repo `…/tools/arena/dev-proxy-plugin.ts` | `transcript`: `matches/scripted.match.jsonl`, `expect:'clean'` |
| 12 | `demo-flagship-match` | demo | the real recorded Sonnet-vs-Haiku match: what a full A2A exchange looks like end to end, isolation-gate-green | repo `matches/flagship.match.jsonl` · repo `.claude/docs/lld/a2a-tic-tac-toe.lld.md` | `transcript`: `matches/flagship.match.jsonl`, `expect:'clean'` |
| 13 | `demo-scripted-backbone` | demo | the deterministic CI backbone: byte-stable scripted match, the offline replay every gate runs on | repo `matches/scripted.match.jsonl` | `transcript`: `matches/scripted.match.jsonl`, `expect:'clean'` |
| 14 | `context-id-semantics` | concept | `contextId`: the optional, server-generated id that groups related tasks/messages into one conversation; reused for per-seat separation on the wire | HV-10 | inline `message` (carrying `contextId`) |
| 15 | `transport-invariance` | concept | one `A2aChannel` contract, two implementations (loopback · dev/server HTTP); the SAME message sequence over either MUST decode identical and in order | repo `…/src/channel/transport-invariance.test.ts` · repo `…/src/channel/loopback.ts` | inline `message` (a sequence member) |
| 16 | `turn-taking-policy` | concept | turn alternation; an illegal/malformed move gets structured feedback (the input-required arm) with a bounded retry (default 2); exhausting the bound forfeits; a per-move timeout counts as malformed | repo `…/src/arena/referee.ts` · repo `…/src/arena/referee.test.ts` | inline `message` (a BoardMessage carrying an ILLEGAL `feedback`) |
| 17 | `canary-mechanism` | concept | the per-seat canary: deterministic FNV-1a derivation (never crypto-random, for byte-stable scripted reruns), the fail-safe collision guard, and why bleed-detection ≠ adversarial-evasion-resistance (cross-refs #10) | repo `…/tools/arena/canary.ts` · repo `…/src/arena/isolation.ts` | inline `message` (a `data` part) |

(`…/` = `packages/agent-ui/a2a/`. Repo-path citations resolve via `existsSync`; HV citations against the SPEC §2 ledger. 15 concept + 2 demo ≥ the PRD-G3 floor of 6 + 1, with headroom — the floor stays 6/1, unchanged; the seed count simply exceeds it further per the coordinator's B4 headroom ruling.)

## 6. The site section (LLD-C9…C12 — the seed-shelf → gallery derivation, corpus edition)

**Lib/page split (the `a2ui-gallery.ts` precedent verbatim):** `site/lib/a2a-concepts.ts` holds the derivation; the page module (`site/pages/a2a-concepts.ts`) mounts the shell and appends the lib's output, so the drift gate imports the LIB without mounting the page.

```ts
// site/lib/a2a-concepts.ts — no record literals live here: membership IS the shard
import conceptShardRaw from '../../packages/agent-ui/a2a/corpus/concept/v0_3_0/a2a.jsonl?raw'
import demoShardRaw from '../../packages/agent-ui/a2a/corpus/demo/v0_3_0/a2a.jsonl?raw'
import { admittedRecords, parseShard, validateA2a, PROTOCOL_VERSION } from '@agent-ui/a2a'

export interface RecordCard { record: A2aCorpusRecord; card: HTMLElement; artifactFailures: A2aFailure[][] }
export function buildRecordCard(record: A2aCorpusRecord): RecordCard   // parameterized — the gate's seam
export function buildCardsFrom(records: A2aCorpusRecord[]): RecordCard[]
export function buildConceptsSections(): { concepts: RecordCard[]; demos: RecordCard[]; parseFailures: CorpusFailure[] }
```

- **Derivation:** both shards arrive as Vite `?raw` static imports (the arena page's `matches/*.jsonl?raw` precedent — zero network, zero fetch, SPEC-N2), parsed with the package's own `parseShard`, filtered with `admittedRecords`. One card per record, **shard order** (= the §4 teaching order). A record added to the shard appears with zero page edits.
- **Card anatomy (all text read off the record — SPEC-R15's one-home rule mechanically):** head = `name` + facet badge + a derived artifact-count facet; `description`; `body` rendered as paragraphs via `textContent` (never innerHTML); the citations list (`hv` → "Ledger HV-n (a2a-foundations SPEC §2)", `repo` → the path in `<code>`); then per wire artifact:
  - *inline* → a collapsed `<details>` disclosure with the exact JSON (the shared `codeBlock` helper) AND an **in-page verdict**: the card runs the real `validateA2a(artifact, { protocolVersion: PROTOCOL_VERSION, expect: kind })` and reflects the result onto `data-validated` — computed, never hardcoded (the SPEC-R13 in-page-verdict discipline carried to R15). A failure renders an honest defect note on the card, mirroring the gallery's seed-defect posture.
  - *transcript* → a **link to `./a2a-tic-tac-toe.html`** labeled with the fixture name + its declared expectation ("replayable in the arena — a must-fail negative control" for `expect:'contaminated'`). The page does NOT re-run transcript validation in-page: the raw match text isn't imported here (it would double-ship the fixture bytes), and the arena page + the standing gate already run those exact checks — stated honestly on the card, not implied.
- **Drift gate (`a2a-concepts.test.ts`, site vitest project) — what it actually buys (the gallery's honesty note, restated):** the set-equality legs (card names/count/facet split ≡ admitted shard set) are tautological against the current `buildCardsFrom(admittedRecords(…))` and exist as a TRIPWIRE against a future hand-listed refactor. The REAL coverage: (a) `parseShard` over the committed raw yields zero failures; (b) every inline-artifact card asserts `data-validated === 'true'` — a record or validator regression fails here; (c) sampled card text `===` the record's own fields (the anti-hand-duplication tripwire); (d) every transcript artifact renders the arena href; (e) **negative controls through the parameterized seam**: `buildCardsFrom` over a doctored list proves a quarantined record is EXCLUDED, and `buildRecordCard` over a record with a broken inline artifact proves `data-validated === 'false'` + the defect note — both legs shown to bite (SPEC-R15 AC1's "fails naming the delta").
- **Browser smoke (`a2a-concepts.browser.test.ts`):** the page mounts, ≥ 13 cards render, all committed cards flag `data-validated='true'`, and the nav carries the section link.
- **Nav/landing (LLD-C12, serial — shared files):** `_page.ts`'s A2A cluster becomes a two-link ungrouped group (`A2A Tic-Tac-Toe Arena` · `A2A Concepts & Demos`); `main.ts` gains the matching landing card. The html shell itself needs no config edit (the vite glob auto-discovers `site/*.html`).

## 7. Error & edge handling (enumerated per case)

| Case | Stage | Handling |
|---|---|---|
| Candidate not an object / unknown key / bad vocab | LLD-C1 | E_SCHEMA at the offending path; batch, never throws (totality safety net mirrors `validateRecord`) |
| `citations` missing, empty, or malformed entry | LLD-C1 | E_CITE at `citations`/`citations[i]` — the grounding arm owns its own code |
| Pin missing or ≠ `PROTOCOL_VERSION` | LLD-C1 | E_PIN at `meta.protocolVersion` (presence deliberately E_PIN, not E_SCHEMA — a2ui precedent) |
| HV citation names a row absent from the SPEC §2 ledger (or an unresolved one) | LLD-C3/C7 | E_CITE at `citations[i]`; the standing gate re-checks committed lines on every test run |
| Repo-path citation dangling | LLD-C3/C7 | E_CITE at `citations[i]` (`existsSync` via deps in admission; direct in the gate) |
| Inline artifact fails the shared validator | LLD-C3/C7 | E_REPLAY at `wire[i]`, detail = underlying `code@path` list; `expect` passed explicitly so a mislabeled artifact fails rather than re-classifying via `'auto'` |
| Transcript reference unreadable | LLD-C3 | E_REPLAY at `wire[i]` (`loadTranscript` returned undefined) — never a throw |
| `expect:'clean'` fixture fails isolation | LLD-C3/C7 | E_REPLAY — the demo's claim is false |
| `expect:'contaminated'` fixture PASSES isolation | LLD-C3/C7 | E_REPLAY — a **stale negative control**, caught symmetrically (the expectation matches in both directions) |
| Quarantined line in a shard | LLD-C2/C7 | LEGAL: schema/pin/cite-shape + canonical-form legs still run; resolution/replay skipped; excluded from `admittedRecords` (ADR-0068 clause 6 mirrored) |
| Hand-edited / stale committed line | LLD-C7 | the canonical-line identity leg (`serializeRecord(JSON.parse(line)) === line`) fails loudly |
| Duplicate `name` across shards | LLD-C7 | uniqueness leg fails (join-key invariant) |
| Corpus shrinks below the PRD-G3 floor | LLD-C7 | the ≥6/≥1 count leg fails — target regression is a red gate |
| Seed admission failure at import | LLD-C5 | print every failure, exit non-zero, write NOTHING (all-or-nothing; no partial shard is ever committed) |
| Shard file missing/empty at test time | LLD-C7 | gate fails loudly (non-empty leg) — never silently green on absent data |
| Shard parse failure in the page | LLD-C9/C10 | `parseFailures` surfaces to an error panel ("concepts unavailable"), never a broken render (the arena page's `Match unavailable` posture); the drift gate independently asserts zero parse failures |
| Artifact invalid at page runtime | LLD-C9 | honest defect note + `data-validated='false'` — shown, not hidden; the gate fails on committed content |
| SPEC file moved (ledger unreadable) | LLD-C7 | the citation leg fails loudly naming the path — stale doc-coupling surfaces as a red gate, not silent staleness (§8.2) |

## 8. Integration, layering & deliberate omissions

1. **Site → package data import.** The shard `?raw` static imports from `site/lib/` into `packages/agent-ui/a2a/corpus/` follow the arena page's committed-fixture precedent exactly (`matches/*.jsonl?raw`); code imports go through the `@agent-ui/a2a` barrel only (LLD-C8) — never deep `src/` paths.
2. **The standing gate reads the SPEC file.** `corpus-data.test.ts` resolves `hv` citations by reading `.claude/docs/spec/a2a-foundations.spec.md` at test time. This is a **named doc-coupling**: the alternative — duplicating the ledger row list into code — is exactly the one-fact-two-homes drift this corpus exists to prevent. If the SPEC moves, the gate fails loudly naming the path (an honest, cheap repair). Flagged for review as the one unusual dependency direction (test → design doc).
3. **Barrel discipline.** `src/index.ts` gains the corpus surface (`record.ts` types/validator + `shard.ts` parse/serialize/filter — NOT `admit.ts`, which only tools and tests call) in ONE serial slice (the barrel's own "S8-owned single writer" comment governs); the existing consumer-surface grep keeps proving `tools/` unreachable (SPEC-N1).
4. **Deliberately absent a2ui organs (mirror the discipline, not the machinery — PRD-D5), each with its reinstatement trigger:** **heal** (records are typed, authored TS, not raw model output; trigger: a `mined`/`distilled` inflow pipeline) · **dedup/MinHash** (name uniqueness suffices at ~13 authored records; same trigger) · **tier-2 judge/qualityScore** (no rubric-scored admission need yet; trigger: corpus quality scoring becomes a requirement) · **canonicalHash** (no dedup ⇒ no hash; byte-stability is enforced directly by the canonical-line identity leg, §4) · **`repaired` status** (no healer ⇒ nothing can be repaired). Adding any of these later is additive to `meta`/the pipeline, not a schema break.
5. **SPEC repair shipped with this LLD (same change, flagged for doc-review):** SPEC-R14's wire-artifact enumeration is widened to the SPEC-R6 validator's own artifact vocabulary + the expectation-carrying transcript reference, and the grounding arm (E_CITE) joins the admission code list — the seed set (tasks, rpc envelopes, must-fail transcript refs) is not expressible under the old parenthetical. The SPEC stays the owner of the behavior; this LLD only implements it.
6. **Discovered-reality repair (B4 build, this LLD only):** §5's "`npm run check` catches type-level drift" claim over-promised — the root `tsconfig.json`'s `include` is `packages/agent-ui/*/src` only; `tools/` (where `seeds.ts`/`import-seeds.ts`/`ledger-path.ts` live) is OUT of `npm run check`'s scope, exactly as it already is for the a2ui corpus's own `tools/corpus/*` (a pre-existing, repo-wide condition this wave inherits, not introduces — confirmed empirically: `tsc` reports zero diagnostics for either package's `tools/` tree today). `seeds.ts` was independently verified to type-check cleanly against the strict repo compiler options via an ad hoc scoped `tsc` run (not a standing gate); the STANDING, always-on drift check for the seed literals is the replay arm inside `admit.ts`/`corpus-data.test.ts` (validator-level, not type-level). No SPEC/behavior change follows from this — a documentation correction only.

## 9. Build sequence (dependency-ordered; each slice verifiable; B5 gated on B4)

**Wave B4 (corpus):**
1. **S1 — LLD-C1 record model** (parallel-safe with S2). *(checkpoint: `record.test.ts` — totality over malformed inputs, exact code+path fixtures per E_SCHEMA/E_PIN/E_CITE)*
2. **S2 — LLD-C2 shard store** (parallel-safe with S1). *(checkpoint: `shard.test.ts` — canonical serialize two-run identity, total parse, quarantine exclusion)*
3. **S3 — LLD-C3 admission** (after S1+S2). *(checkpoint: `admit.test.ts` — the admission matrix: a firing fixture AND a passing sibling per code in {E_SCHEMA, E_PIN, E_CITE, E_REPLAY}, incl. both expectation-mismatch directions — SPEC-R14 AC1 leg 1)*
4. **S4 — LLD-C4 seeds + LLD-C5 import tool → LLD-C6 shards committed.** *(checkpoint: tool exits 0 all-or-nothing; both shards written 11 + 2; second run byte-idempotent; `npm run check` types the seed literals)*
5. **S5 — LLD-C7 standing gate + LLD-C8 barrel (serial integration slice — the barrel's single writer).** *(checkpoint: gate green over the committed shards incl. the red-control legs; consumer-surface grep still clean — **the B4 gate**: `npm run check && npm test` green — SPEC-R14 AC1)*

**Wave B5 (site — dispatches only on a green B4 gate):**
6. **S6 — LLD-C9 derivation lib.** *(checkpoint: `buildConceptsSections()` yields 11 + 2 cards in shard order; lib importable without mounting the page)*
7. **S7 — LLD-C10 page shell.** *(checkpoint: dev render; `vite build` emits the page; `dist/` grep clean of key/proxy names and of any corpus fetch — SPEC-N2)*
8. **S8 — LLD-C11 drift gate + browser smoke** (parallel-safe with S9 — disjoint files). *(checkpoint: all §6 legs green; negative-control legs bite — SPEC-R15 AC1)*
9. **S9 — LLD-C12 nav/TOC + landing (serial — shared `_page.ts`/`main.ts`).** *(checkpoint: nav cluster carries both A2A links; landing card present; full `npm run check && npm test` green incl. browser legs — the B5 gate)*

**Discovered-reality rule:** if implementation shows a SPEC-R14/R15 behavior is wrong (e.g. the citation arm proves untenable as an admission stage), repair `a2a-foundations.spec.md` first and re-derive this file — never patch the corpus around a stale SPEC.
