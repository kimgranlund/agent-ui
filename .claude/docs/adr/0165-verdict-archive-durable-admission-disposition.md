# ADR-0165 — a judged import run ARCHIVES its verdicts file into the corpus data dir, and the admission-coverage gate reads judged-ness (not just admitted-ness) off the shard: an `E_QUALITY` rejection becomes durable and machine-readable with no human transcription step, and a re-admission can no longer turn the gate green

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-28
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-28 |
> | **Proposed by** | design intake (GH [#340](https://github.com/kimgranlund/agent-ui/issues/340) — the follow-up class review of [#339](https://github.com/kimgranlund/agent-ui/pull/339) left open; every mechanical claim below re-verified against shipped source at `f199b67` + the unmerged `fix-335-seed-readmission` at `7b91862`, cited file:line) |
> | **Ratified by** | *(awaiting Kim)* |
> | **Repairs** | none owed backward — an intake ADR closing a defect class, not repairing a false claim. **On ratification+build**: NEW `packages/agent-ui/a2ui/src/corpus/verdict-archive.ts` (+ co-located test — pure merge/precedence over `parseVerdictsFile` output, joins the `"./corpus"` barrel) · NEW data dir `packages/agent-ui/a2ui/corpus/verdicts/` · `packages/agent-ui/a2ui/tools/corpus/fs-store.ts` (+`loadVerdictArchive`/`archiveVerdicts` — the Node-shell reader+writer, ADR-0062) · `packages/agent-ui/a2ui/tools/corpus/import-seeds.ts` (archive-on-judged-run; `dispositionGuard` gains the archive as a third input; the paste-ready snippet demoted to the allowlist-only path) + `import-seeds.test.ts` · `packages/agent-ui/a2ui/src/corpus/admission-coverage.test.ts` (`admittedNames()` → `admittedRecords()`; the new `unjudgedAdmissions` leg) · `packages/agent-ui/a2ui/src/corpus/disposition-allowlist.ts` (header rewritten — demoted to the curated-prose layer) · `packages/agent-ui/a2ui/src/corpus/index.ts` (barrel) · [`../lld/a2ui-corpus-store.lld.md`](../lld/a2ui-corpus-store.lld.md) §6 (the tier-2 stage note gains the archive side-effect) + §12 (file plan) · [`../spec/a2ui-expert-harness.spec.md`](../spec/a2ui-expert-harness.spec.md) §5.3 (the verdicts contract: the file is a COMMITTED artifact, not an ephemeral input) |
> | **Supersedes / Superseded by** | **Extends [ADR-0068](./0068-corpus-quality-judge-verdict-adapter.md)** cl.1/cl.3 — the `VerdictsFile` goes from an ephemeral `--verdicts <path>` input to a committed artifact, and its Consequences claim that all three admission outcomes "are queryable" becomes TRUE for the admission-reject arm for the first time. ADR-0068's store asymmetry is deliberately left INTACT (cl.8 below). Relates [ADR-0060](./0060-corpus-store-phase1-admission-seams.md) (the injected judge seam), [ADR-0062](./0062-corpus-packaging-pure-core-subpath-data-home.md) (only `tools/corpus/` writes the data dir — the clause that decides the writer), [ADR-0055](./0055-a2ui-example-seeds-package-home.md) (the seed shelf the import script maps), corpus SPEC-R8/R13 (the bar + quarantine semantics, both unchanged). Resolves GH #340; closes the class GH #335/#339 narrowed |

## Context

An admission-time `E_QUALITY` rejection is written **nowhere**. `admit()` returns the rejection at
stage 10 (`src/corpus/admit.ts:181-182`) — before `store.put()` and before the dedup index registers
anything (`:187-190`, whose own comment says so: "a candidate that fails a LATER stage (the judge)
never pollutes the dedup index with a record never admitted", `:166-167`). Corpus LLD §6's pipeline
sketch (`a2ui-corpus-store.lld.md:215-216`) shows the same shape. So the shard, `index.json`, and the
dedup index each carry zero trace of a refusal. Verified, not assumed.

Before PR #339 the ONLY durable trace of a real refusal was a hand-transcribed `Map` entry inside a
test file. #339 extracted that map to `src/corpus/disposition-allowlist.ts` so
`tools/corpus/import-seeds.ts` could consult it (`dispositionGuard`, `import-seeds.ts:307-316` at
`7b91862`) and made the quality-rejected lane print a paste-ready entry
(`dispositionAllowlistSnippet`, `:340-347`). #339's own header comment is honest that this is
narrowing, not closing (`:53-64`): it removes the transcription **step**, never the transcription
**requirement**. A seed rejected tomorrow is recorded nowhere until a human hand-edits a module.

Two facts make that structural rather than merely untidy.

**One — the safety net is defeated by the very event it should catch.** `seedsMissingAdmission`
(`admission-coverage.test.ts:96-98` at `7b91862`; the predicate at `:75`) reports a seed only while it
is **both** un-admitted **and** un-allowlisted. `allowlistResidue` (`:100-102`; predicate at `:81`)
fires only for names already IN the allowlist. So the moment an unjudged run admits the rejected seed,
`seedsMissingAdmission` drops it and `allowlistResidue` never sees it: the gate goes **green**. It is
not late to the miss — it is disarmed by it. #340's claim is exact, and the line cites are exact.

**Two — the artifact that carries the fact is thrown away every run.** ADR-0068 cl.1 makes the
critic-authored `VerdictsFile` "an auditable artifact naming its rubric version and judge". It carries
precisely the facts a durable record needs: name, `passed`, `qualityScore`, `failingDimensions`,
`rubricVersion`, `judgedBy`, `date`. It **must already exist on disk** for a judged run to happen at
all — `--verdicts <path>` reads it (`import-seeds.ts:412`). And no verdicts file has ever entered the
tree: `git log --all --diff-filter=A -- '*verdict*'` returns only ADR-0068 itself and two unrelated
2026-07-12 repo-alignment reports. `import-seeds` reads it, uses it, and drops it.

The live cost is already on the ledger. The M-B growth wave (PR #337, 2026-07-28) judged four seeds
and refused two. `stats-grid-dashboard` survives as an allowlist entry only because a human wrote one.
`retreat-reschedule` — rejected `qualityScore 2`, failing D1/D5 — survives **only as a source comment**
(`src/examples/corpus-growth.ts:1-10`, `:231-233`); it is absent from `allSeeds` (25 seeds, verified by
executing the barrel), absent from the allowlist, and therefore absent from every gate. Its verdict is
gone. That is the class, with a name and a date.

The decomposition of "a durable record of an admission-time quality rejection" — producing event ·
artifact · writer · reader · gate · contract, crossed against what each must support — cleared coverage
only after the gate plane forced a part the structural plane had missed: the gate needs a **third**
input beyond admitted/allowlisted, namely *was this record judged*. That fact turns out to already be
durable in the shard. ADR-0068 cl.3 writes `meta.qualityScore` on every judged admission, and all 24
committed records carry one (4 or 5 — enumerated from
`corpus/exemplar/v1_0/agent-ui.jsonl`); the ADR-0060 phase-1 absent-marker debt cleared exactly as
ADR-0068's Consequences predicted. `admittedNames()` (`admission-coverage.test.ts:48-60`) simply throws
that field away.

## Decision

A quality rejection **does** produce a durable machine-readable record. It lives in the corpus data
dir as the archived verdicts file, it is written by the judged run itself, and the standing gate stops
being defeasible:

1. **A judged run archives its own verdicts file.** After `parseVerdictsFile` validates it and in the
   same all-or-nothing step as `saveStore`, `import-seeds --verdicts <path>` copies the file **verbatim**
   to `packages/agent-ui/a2ui/corpus/verdicts/<date>--<slug>.json` via a new `archiveVerdicts()` in
   `tools/corpus/fs-store.ts` — the Node shell is the only sanctioned writer of the data dir (ADR-0062).
   `--dry-run` writes nothing here either. **Nothing new is authored**: the artifact ADR-0068 cl.1
   already requires to exist at run time merely stops being discarded, so the marginal human effort is
   zero. A run that writes no store writes no archive.
2. **The archive is the machine-readable disposition record.** A new pure `src/corpus/verdict-archive.ts`
   (joins the `"./corpus"` barrel; zero `node:*`, SPEC-N5/ADR-0062) merges parsed files into
   `Map<name, ArchivedVerdict>` where `ArchivedVerdict = { passed, qualityScore, failingDimensions?,
   rubricVersion, judgedBy, date, sourceFile }`. **Precedence: latest `date` wins.** Two files of the
   SAME date carrying different verdicts for one name → a structured error, halt (mirroring ADR-0068
   cl.4's rescore conflict rule; a re-judge is deliberate, never a drive-by). A `passed:false` entry
   **is** the durable `E_QUALITY` record.
3. **`dispositionGuard` gains the archive as a third input.** An unjudged run whose candidate carries an
   archived `passed:false` verdict and was never admitted HALTS with nothing written — the identical
   posture #339 gave allowlisted names (`import-seeds.ts:307-316`). Guard inputs are now, in order:
   archived verdict → `DISPOSITION_ALLOWLIST` → proceed. A `--verdicts` run still needs no guard:
   `createVerdictJudge` already fails closed on every not-yet-admitted candidate absent from the file
   (ADR-0068 cl.2).
4. **The coverage gate reads judged-ness off the shard — this is the clause that closes the hole.**
   `admittedNames()` becomes `admittedRecords(): Map<string, {status, qualityScore?}>`, and a new leg
   `unjudgedAdmissions(seedNames, admitted, allowlist, archive)` reports any seed that IS admitted but
   whose record carries **no `meta.qualityScore`** and no archived `passed:true` verdict. Combined with
   the two existing legs, a refused seed is RED on **both** branches of its future: it stays out
   (`seedsMissingAdmission`) or it is silently re-admitted (`unjudgedAdmissions`). The gate can no
   longer be greened by the event it exists to catch. Its negative controls extend to the new predicate.
5. **`DISPOSITION_ALLOWLIST` is demoted, never retired.** It keeps exactly the cases a machine cannot
   state: a deliberately-minimal smoke seed that teaches the corpus nothing, and a refusal whose
   verdicts file predates this archive (today: `stats-grid-dashboard`). Its module header says so. It is
   the second guard input and the second gate input, not the primary record.
6. **An archived refusal does not expire.** A `passed:false` entry scored against an older
   `rubricVersion` still blocks and still reds — a recorded refusal is not invalidated by the rubric
   moving. Clearing it means a fresh judged run, which archives a newer-dated verdict that takes
   precedence by cl.2. No auto-expiry, no re-scoring at read time, no version-window heuristic.
7. **No retro-migration, stated rather than papered over.** The archive starts EMPTY. The M-B wave's
   verdicts files were never committed, so neither `stats-grid-dashboard` nor `retreat-reschedule` is
   retro-archivable from a real verdict; fabricating one would be exactly the manufactured judgment
   ADR-0068's Alternatives already ban. They stay as they are — allowlist entry and source comment
   respectively. The **shard needs no migration**: all 24 records already carry `qualityScore`, so cl.4's
   new leg is green on real, unmodified data at ratification.
8. **ADR-0068's store asymmetry is left INTACT — deliberately, and this is the load-bearing
   non-change.** `admit()` still writes nothing on `E_QUALITY`; the shard still holds only admitted
   records; `Status` gains no fourth member; `store.all()`, `retrieve`, `export`, and the leak gate are
   untouched. The record moves NEXT TO the store, not INTO it.

## Consequences

- **The transcription requirement is removed, not relocated.** #339 removed the typing; this removes the
  obligation. The judged run that makes the decision is the same actor that records it, in the same
  transaction that writes the store.
- **ADR-0068's "all three outcomes are queryable" becomes true.** It was written as a Consequence and
  never wired for the admission-reject arm — #339's own module header says as much
  (`disposition-allowlist.ts:11-14`). This is that wiring. The verdicts file's promotion from ephemeral
  input to committed artifact is an EXTENSION of cl.1/cl.3, not a contradiction of anything ratified.
- **Cost: a new committed data class.** `corpus/verdicts/` grows one file per judged wave, forever.
  Bounded by wave count (three waves to date), reviewable in diffs, and readable by exactly two callers.
  Reader hygiene is already satisfied by construction: `loadStore` filters to `.jsonl`/`.jsonl.enc`
  (`fs-store.ts:52`) and `corpus-data.test.ts` pins a fixed `SHARD_PATH` (`:29`), so `verdicts/*.json`
  is invisible to both without either changing. `admission-coverage.test.ts`'s own walker filters
  `.jsonl` too (`:51`).
- **The gate gets strictly stronger and stays honest.** Every current assertion survives; one leg is
  added; the negative controls grow with it. It reds today only if someone admits a record unjudged —
  which is the whole point.
- **Named weak spot: `qualityScore`-presence is a PROXY for judged-ness**, not a direct assertion of it.
  It is sound today (24/24 carry one; ADR-0060's phase-1 debt is cleared) and any regression trips cl.4
  immediately. It would become unsound if a future wave reintroduced legitimately-unjudged admissions —
  at which point that wave owes an explicit marker, not a weakened gate.
- **Named residual: a REJECTED-AND-DROPPED seed still has no gate.** `retreat-reschedule` is absent from
  `allSeeds`, so no coverage leg can see it. This is correct rather than a gap — a seed that does not
  exist cannot be re-admitted, so there is nothing to guard; only the knowledge is at stake, and cl.1
  captures it from the next such wave onward.
- **No interaction with GH #342 or #346.** Both were read, not assumed. Both live in the GenUI dogfood
  inventory (`src/agent/dogfood-inventory.ts`, `genui-surface.spec.md` SPEC-R13(b), ADR-0004 descriptors,
  ADR-0162) and turn on what "descriptor-derived" must mean; neither touches `src/corpus/`, ADR-0068, the
  verdicts contract, or any file in this ADR's Repairs row. `genui-surface.spec.md` mentions the corpus
  only to exclude it ("genui kind never enters `heal`/`validateA2ui`, the corpus, or the `allLines`
  path", `:163`). The resemblance is shape-only — both are "a format lacks a machine-readable field" —
  and shape is not coupling. These three can be ruled on in any order.
- **Stale → re-verify on the build gate:** corpus LLD §6's tier-2 stage line + §12's file plan ·
  `a2ui-expert-harness.spec.md` §5.3's verdicts contract · `disposition-allowlist.ts`'s module header
  (its "the durable home" framing becomes false the moment cl.1 lands) · `import-seeds.ts`'s GH #335
  "STILL OPEN" header block (`:49-64` at `7b91862` — this ADR is what closes it) · `import-seeds` usage
  text · the `a2ui-corpus-curate` skill's wave procedure (it must stop treating the verdicts file as
  scratch).

## Acceptance

- `mergeVerdictArchive([])` yields an empty map; a single file round-trips every field; two files naming
  one record resolve to the later `date`; two SAME-date files disagreeing on one record produce a
  structured error naming the record and both source files, and the caller halts with nothing written.
- `import-seeds --verdicts <path>` on a run that admits at least one record leaves
  `corpus/verdicts/<date>--<slug>.json` **byte-identical** to the input file; a second identical run is a
  byte-level no-op (idempotence, ADR-0068 cl.4's standard); `--dry-run --verdicts <path>` writes neither
  store nor archive; a run that halts before `saveStore` writes no archive.
- With a `passed:false` archived verdict for name X and X absent from the store: a plain unjudged
  `import-seeds` exits non-zero, prints the halt naming X's `qualityScore`/`failingDimensions`/
  `rubricVersion`/`judgedBy`, and writes nothing (`git status --porcelain` clean). The same run with
  `--verdicts` supplying a fresh passing verdict for X admits it and archives the newer file.
- The strengthened gate, driven by synthetic inputs (the existing negative-control idiom): a seed
  admitted WITHOUT `qualityScore` and not allowlisted is reported by `unjudgedAdmissions`; the same seed
  with an archived `passed:true` verdict is not; the same seed allowlisted is not. Both existing legs
  (`seedsMissingAdmission`, `allowlistResidue`) keep their current assertions and their current negative
  controls verbatim.
- **The #340 scenario, end to end, as one regression:** judge rejects seed Y `E_QUALITY` → a plain
  unjudged run HALTS on Y (cl.3) → force-admit Y through the seam without a judge → `npm test` is
  **RED** on `unjudgedAdmissions` (cl.4). Both halves asserted; the second is the one that did not exist
  before.
- On the real tree at ratification: `npm run check` and `npm test` exit 0 with the new leg live and the
  archive empty — i.e. all 24 shipped records satisfy cl.4 without a single shard edit.
- The purity greps stay green: zero `node:*`/third-party imports under `src/corpus/`, `verdict-archive.ts`
  included; `fs-store.ts` remains the only module touching the data dir.

## Alternatives considered

- **A store-side disposition entry — write the rejected record with a fourth `Status` member
  (`rejected`)** — rejected. It flips ADR-0068's ratified asymmetry ("a candidate can be refused entry"
  leaving no trace) and the blast radius is real: `Status` union → `validateRecord` →
  `corpus-data.test.ts`'s tier-1/hash legs → `store.all()`'s filter → every consumption caller
  (`retrieve`, `export`, the leak gate) → the shard schema. Worse, it re-creates the self-collision
  ADR-0068 cl.5c had to invent `--replace` for: an improved resubmission would `E_DUP` against its own
  rejected predecessor's signature. It would also park content the corpus judged NOT worth teaching
  inside the file loaded for few-shot conditioning, one filter bug away from being taught. The record
  belongs next to the store, not in it.
- **A verdicts-file-derived record where the human commits the file by hand** — rejected as the design's
  primary mechanism, and absorbed as cl.1's automated form. Hand-committing is a transcription
  requirement wearing a different hat: it is remembered exactly as reliably as pasting an allowlist entry
  was, which is the failure #340 is about. The tool already holds the validated bytes; it should write them.
- **Strengthening the coverage gate ONLY (#340's second candidate fix)** — rejected as a complete answer,
  adopted as cl.4. It makes the miss undeniable but produces no record: the gate goes red and a human
  still has to write something to clear it. It answers "can this be silently reversed" (no) but not "does
  a rejection have a durable home" (still no). Necessary, not sufficient — which is precisely why it is a
  clause here rather than an inline test fix.
- **Doing nothing beyond #339's mitigation** — rejected. It leaves a decision made today reversible
  tomorrow by a routine command, and leaves the standing gate disarmable by the very re-admission it
  exists to catch. #339's own header already books this as ADR territory rather than solving it inline.
- **`import-seeds` codegens the entry into `disposition-allowlist.ts`** — rejected. A tool writing into
  `src/` breaks ADR-0062's line (the Node shell writes the DATA DIR, nothing else), and it would replace
  curated citations — the shipped `stats-grid-dashboard` entry carries a coverage argument and a repair
  path — with mechanical stubs. The generated-and-committed precedent (ADR-0162) covers generated
  ASSETS, not hand-curated source modules.
- **A derived dispositions table inside `corpus/index.json`** — rejected: `index.json` is derived, never
  source of truth (corpus LLD §2 invariant iii; `fs-store.ts:37-38` refuses to even hand it to
  `createStore`). A durable record cannot live in a regenerable file.
- **Hard-fail the whole run on any `E_QUALITY`** — rejected. A below-bar candidate is an anticipated
  NORMAL admission outcome with its own reporting lane (TKT-0022 cl.1, `import-report.ts`); aborting the
  batch would punish the three good seeds for the fourth and push curators toward unjudged runs — the
  exact behaviour this ADR is trying to make impossible.
