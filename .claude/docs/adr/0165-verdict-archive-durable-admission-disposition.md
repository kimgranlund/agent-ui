# ADR-0165 — a judged import run ARCHIVES its verdicts file into the corpus data dir, and the admission-coverage gate reads judged-ness (not just admitted-ness) off the shard: an `E_QUALITY` rejection becomes durable and machine-readable with no human transcription step, and a re-admission can no longer turn the gate green

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-07-28
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-28 |
> | **Proposed by** | design intake (GH [#340](https://github.com/kimgranlund/agent-ui/issues/340) — the follow-up class review of [#339](https://github.com/kimgranlund/agent-ui/pull/339) left open; every mechanical claim below re-verified against shipped source at `f199b67` + the unmerged `fix-335-seed-readmission` at `7b91862`, cited file:line) |
> | **Ratified by** | kimgranlund (repo owner), 2026-07-28, via the [`ratify ADR-0165` utterance](https://github.com/kimgranlund/agent-ui/issues/340#issuecomment-5107585798) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | **ONE pointer owed backward.** ADR-0068's Consequences bullet — "*Asymmetry: admission rejects (`E_QUALITY`), back-scoring quarantines, replacement re-admits* … *All three outcomes are queryable*" — is verified FALSE today for the admission-reject arm (Context, below), and nothing in the tree books that. On ratification it takes a **dated REV forward pointer** to this ADR: the ADR-0156 clause-5 precedent (commit `f0debd6`, logged as "the overdue post-ratification pointer repair"), which is the named append-only exception — a REV-annotated mechanical pointer repair, never an edit to the accepted Decision's substance (doc-standards §2). **Build presupposes PR [#339](https://github.com/kimgranlund/agent-ui/pull/339) merging**: `disposition-allowlist.ts` does not exist on `main`, so cl.4's second guard input and cl.6 have no substrate without it. If #339 is closed unmerged, those two clauses fall away and the archive becomes the SOLE guard input — cl.1/cl.2/cl.3/cl.5 and every acceptance criterion below are unaffected. **On ratification+build**: NEW `packages/agent-ui/a2ui/src/corpus/verdict-archive.ts` (+ co-located test — pure merge/precedence over `parseVerdictsFile` output; deliberately OFF the `"./corpus"` barrel, matching its `disposition-allowlist.ts` sibling, cl.3) · NEW data dir `packages/agent-ui/a2ui/corpus/verdicts/` · `packages/agent-ui/a2ui/tools/corpus/fs-store.ts` (+`loadVerdictArchive`/`archiveVerdicts` — the Node-shell reader+writer, ADR-0062) · `packages/agent-ui/a2ui/tools/corpus/import-seeds.ts` (archive-on-judged-run; `dispositionGuard` gains the archive as a third input; the paste-ready snippet demoted to the allowlist-only path) + `import-seeds.test.ts` · `packages/agent-ui/a2ui/src/corpus/admission-coverage.test.ts` (`admittedNames()` → `admittedRecords()`; the new `unjudgedAdmissions` leg; its own walk extended to `corpus/verdicts/`) · `packages/agent-ui/a2ui/src/corpus/disposition-allowlist.ts` (header rewritten — demoted to the curated-prose layer) · [`../lld/a2ui-corpus-store.lld.md`](../lld/a2ui-corpus-store.lld.md) **v0.5 → v0.6** — §6 (the tier-2 stage note gains the archive side-effect) + §12 (file plan) · [`../spec/a2ui-expert-harness.spec.md`](../spec/a2ui-expert-harness.spec.md) **v0.2 → v0.3** — §5.3 "The judge/verdicts contract" (the file is a COMMITTED artifact, not an ephemeral input — a contract-level change, hence the bump) |
> | **Supersedes / Superseded by** | **Extends [ADR-0068](./0068-corpus-quality-judge-verdict-adapter.md)** cl.1/cl.3 — the `VerdictsFile` goes from an ephemeral `--verdicts <path>` input to a committed artifact, and its Consequences claim that all three admission outcomes "are queryable" becomes TRUE for the admission-reject arm for the first time. ADR-0068's store asymmetry is deliberately left INTACT (cl.9 below). Relates [ADR-0060](./0060-corpus-store-phase1-admission-seams.md) (the injected judge seam), [ADR-0062](./0062-corpus-packaging-pure-core-subpath-data-home.md) (only `tools/corpus/` writes the data dir — the clause that decides the writer), [ADR-0055](./0055-a2ui-example-seeds-package-home.md) (the seed shelf the import script maps), corpus SPEC-R8/R13 (the bar + quarantine semantics, both unchanged). Resolves GH #340; closes the class GH #335/#339 narrowed |

## Context

An admission-time `E_QUALITY` rejection is written **nowhere**. `admit()` returns the rejection at
stage 10 (`src/corpus/admit.ts:181-182`) — before `store.put()` and before the dedup index registers
anything (`:187-190`, whose own comment says so: "a candidate that fails a LATER stage (the judge)
never pollutes the dedup index with a record never admitted", `:166-167`). Corpus LLD §6's pipeline
sketch (`a2ui-corpus-store.lld.md:215-216`) shows the same shape. So the shard, `index.json`, and the
dedup index each carry zero trace of a refusal. Verified, not assumed.

Before PR #339 the ONLY durable trace of a real refusal was a hand-transcribed `Map` entry inside a
test file. #339 extracted that map to `src/corpus/disposition-allowlist.ts` so
`tools/corpus/import-seeds.ts` could consult it (`dispositionGuard`) and made the quality-rejected
lane print a paste-ready entry (`dispositionAllowlistSnippet`). #339's own `STILL OPEN` header block
is honest that this is narrowing, not closing: it removes the transcription **step**, never the
transcription **requirement**. A seed rejected tomorrow is recorded nowhere until a human hand-edits
a module.

*(Cites into #339 are by SYMBOL, not line: that branch is unmerged, so every line number in it shifts
on merge — the one cite class this ADR must not rot. At `7b91862` today they read `dispositionGuard`
`import-seeds.ts:309`, `dispositionAllowlistSnippet` `:349`, the `STILL OPEN` block `:51-61`. Cites
into `main` — `admit.ts`, `fs-store.ts`, `import-report.ts`, the shard — keep line numbers, since
#339 does not touch those files.)*

Two facts make that structural rather than merely untidy.

**One — the safety net is defeated by the very event it should catch.** `seedsMissingAdmission`
(`admission-coverage.test.ts`) reports a seed only while it
is **both** un-admitted **and** un-allowlisted. `allowlistResidue`
fires only for names already IN the allowlist. So the moment an unjudged run admits the rejected seed,
`seedsMissingAdmission` drops it and `allowlistResidue` never sees it: the gate goes **green**. It is
not late to the miss — it is disarmed by it. #340's claim is exact, and the line cites are exact.

**Two — the artifact that carries the fact is thrown away every run.** ADR-0068 cl.1 makes the
critic-authored `VerdictsFile` "an auditable artifact naming its rubric version and judge". It carries
precisely the facts a durable record needs: name, `passed`, `qualityScore`, `failingDimensions`,
`rubricVersion`, `judgedBy`, `date`. It **must already exist on disk** for a judged run to happen at
all — `--verdicts <path>` is `readFileSync`'d in `main()`. And no verdicts file has ever entered the
tree: `git log --all --diff-filter=A -- '*verdict*'` returns only ADR-0068 itself and two unrelated
2026-07-12 repo-alignment reports. `import-seeds` reads it, uses it, and drops it.

The live cost is already on the ledger. The M-B growth wave (PR #337, 2026-07-28) judged four seeds
and refused two. `stats-grid-dashboard` survives as an allowlist entry only because a human wrote one.
`retreat-reschedule` — rejected `qualityScore 2`, failing D1/D5 — survives **only as prose in three
source comments** (`src/examples/corpus-growth.ts:1-10` and `:231-233`, plus a third at
`src/examples/index.ts:17-18`); it is absent from `allSeeds` (25 seeds, verified by executing the
barrel), absent from the allowlist, and therefore absent from every gate. Three comments and no
machine-readable byte anywhere: its verdict is gone. That is the class, with a name and a date.

The decomposition of "a durable record of an admission-time quality rejection" — producing event ·
artifact · writer · reader · gate · contract, crossed against what each must support — cleared coverage
only after the gate plane forced a part the structural plane had missed: the gate needs a **third**
input beyond admitted/allowlisted, namely *was this record judged*. That fact turns out to already be
durable in the shard. ADR-0068 cl.3 writes `meta.qualityScore` on every judged admission, and all 24
committed records carry one (4 or 5 — enumerated from
`corpus/exemplar/v1_0/agent-ui.jsonl`); the ADR-0060 phase-1 absent-marker debt cleared exactly as
ADR-0068's Consequences predicted. `admittedNames()` (`admission-coverage.test.ts`) simply throws
that field away — it parses each shard line into a full `CorpusRecord` and keeps only `rec.name`.

## Decision

A quality rejection **does** produce a durable machine-readable record. It lives in the corpus data
dir as the archived verdicts file, it is written by the judged run itself, and the standing gate stops
being defeasible:

1. **A judged run archives its own verdicts file.** After `parseVerdictsFile` validates it and in the
   same all-or-nothing step as `saveStore`, `import-seeds --verdicts <path>` copies the file **verbatim**
   into `packages/agent-ui/a2ui/corpus/verdicts/` via a new `archiveVerdicts()` in
   `tools/corpus/fs-store.ts` — the Node shell is the only sanctioned writer of the data dir (ADR-0062).
   `--dry-run` writes nothing here either. **Nothing new is authored**: the artifact ADR-0068 cl.1
   already requires to exist at run time merely stops being discarded, so the marginal human effort is
   zero.
   **The trigger is reaching `saveStore`, NOT admitting anything.** A run that reaches `saveStore`
   archives; a run that aborts before it (`shouldAbort` — `hardErrors` non-empty, `import-report.ts:48-49`)
   archives nothing, matching the store's own all-or-nothing posture. This distinction is load-bearing
   in exactly one direction: `shouldAbort` is `hardErrors`-ONLY, so a judged wave in which **every**
   candidate is rejected `E_QUALITY` still reaches `saveStore` — and that is the single
   highest-value archive in the whole design. **Zero admissions is not zero record.**
2. **The archived filename comes from the operator's own file, and a write never overwrites.** The
   path is `corpus/verdicts/<date>--<slug>.json`, where `<date>` is the **`VerdictsFile`'s own `date`
   field** (the record's fact, ADR-0068 cl.1 — never the wall clock, so re-running an old file is
   stable) and `<slug>` is the **basename of the `--verdicts <path>` argument**, sans `.json`,
   slugified. The operator already named that file deliberately; reusing their name makes two distinct
   waves on one date collide only if the operator gave both the same name, and makes re-running the
   SAME file resolve to the same path (which is what keeps the idempotence criterion honest).
   **Write-time rule:** if the target path already exists, `archiveVerdicts()` compares bytes —
   identical → no-op; **different → HALT before `saveStore`, naming the path and both contents' hashes,
   nothing written.** It never overwrites. This is deliberately a *write*-time guard and not a
   restatement of cl.3's read-time conflict rule: an overwrite destroys one of the two records, so
   there would never be two files left for a read-time check to find the conflict in — silent loss of
   exactly the durable record this ADR exists to create. The halt message names the fix (pass a
   distinct `--verdicts` filename).
3. **The archive is the machine-readable disposition record — one pure merge, two readers.** A new pure
   `src/corpus/verdict-archive.ts` (zero `node:*`, SPEC-N5/ADR-0062) merges parsed files into
   `Map<name, ArchivedVerdict>` where `ArchivedVerdict = { passed, qualityScore, failingDimensions?,
   rubricVersion, judgedBy, date, sourceFile }`. **Precedence: latest `date` wins.** Two files of the
   SAME date carrying different verdicts for one name → a structured error, halt (mirroring ADR-0068
   cl.4's rescore conflict rule; a re-judge is deliberate, never a drive-by). A `passed:false` entry
   **is** the durable `E_QUALITY` record.
   It stays **OFF** the `"./corpus"` barrel, matching its `disposition-allowlist.ts` sibling's
   deliberate choice verbatim: both are import/coverage-tooling bookkeeping, not a corpus API surface a
   renderer consumer would ever want in its bundle. (`judge.ts` IS on the barrel and one could argue
   this is the same tier — but the merge has exactly two callers, both in this repo, and neither is a
   consumer. Minting a public surface nobody asked for is the more expensive error, and the sibling
   already ruled this fork.)
   **Each of the two readers keeps its OWN existing fs discipline**, over the one shared pure merge:
   `tools/corpus/import-seeds.ts` reads via a new `loadVerdictArchive()` in `fs-store.ts` (the Node
   shell, ADR-0062); `admission-coverage.test.ts` extends its **own** `walk()`/`readFileSync` — the
   test-only `node:fs` route it already documents and uses for shards, on the `corpus-data.test.ts`
   precedent — rather than importing the tool shell. That keeps the standing "a src test never depends
   on tool-shell code" line the file's own header draws.
4. **`dispositionGuard` gains the archive as a third input.** An unjudged run whose candidate carries an
   archived `passed:false` verdict and was never admitted HALTS with nothing written — the identical
   posture #339 gave allowlisted names. Guard inputs are now, in order:
   archived verdict → `DISPOSITION_ALLOWLIST` → proceed. A `--verdicts` run still needs no guard:
   `createVerdictJudge` already fails closed on every not-yet-admitted candidate absent from the file
   (ADR-0068 cl.2).
5. **The coverage gate reads judged-ness off the shard — this is the clause that closes the hole.**
   `admittedNames()` becomes `admittedRecords(): Map<string, {status, qualityScore?}>`, and a new leg
   `unjudgedAdmissions(seedNames, admitted, allowlist, archive)` reports any seed that IS admitted but
   whose record carries **no `meta.qualityScore`** and no archived `passed:true` verdict. Combined with
   the two existing legs, a refused seed is RED on **both** branches of its future: it stays out
   (`seedsMissingAdmission`) or it is silently re-admitted (`unjudgedAdmissions`). The gate can no
   longer be greened by the event it exists to catch. Its negative controls extend to the new predicate.
   **Scope note, so no fourth behaviour gets invented:** an archived `passed:false` for a name that IS
   already admitted (a later wave scoring a stored record below bar) is **not this ADR's business** —
   that is ADR-0068 cl.4's rescore/quarantine path, reached by `tools/corpus/rescore.ts`, and it is
   correct that neither cl.4's guard (scoped to never-admitted) nor cl.5's leg (satisfied by the
   record's own `qualityScore`) fires on it. This ADR governs the ADMISSION-time reject only.
6. **`DISPOSITION_ALLOWLIST` is demoted, never retired.** It keeps exactly the cases a machine cannot
   state: a deliberately-minimal smoke seed that teaches the corpus nothing, and a refusal whose
   verdicts file predates this archive (today: `stats-grid-dashboard`). Its module header says so. It is
   the second guard input and the second gate input, not the primary record.
7. **An archived refusal does not expire.** A `passed:false` entry scored against an older
   `rubricVersion` still blocks and still reds — a recorded refusal is not invalidated by the rubric
   moving. Clearing it means a fresh judged run, which archives a newer-dated verdict that takes
   precedence by cl.3. No auto-expiry, no re-scoring at read time, no version-window heuristic.
8. **No retro-migration, stated rather than papered over.** The archive starts EMPTY. The M-B wave's
   verdicts files were never committed, so neither `stats-grid-dashboard` nor `retreat-reschedule` is
   retro-archivable from a real verdict; fabricating one would be exactly the manufactured judgment
   ADR-0068's Alternatives already ban. They stay as they are — allowlist entry and source comments
   respectively. The **shard needs no migration**: all 24 records already carry `qualityScore`, so cl.5's
   new leg is green on real, unmodified data at ratification.
9. **ADR-0068's store asymmetry is left INTACT — deliberately, and this is the load-bearing
   non-change.** `admit()` still writes nothing on `E_QUALITY`; the shard still holds only admitted
   records; `Status` gains no fourth member; `store.all()`, `retrieve`, `export`, and the leak gate are
   untouched. The record moves NEXT TO the store, not INTO it.

## Consequences

- **The transcription requirement is removed, not relocated.** #339 removed the typing; this removes the
  obligation. The judged run that makes the decision is the same actor that records it, in the same
  transaction that writes the store.
- **ADR-0068's "all three outcomes are queryable" becomes true.** It was written as a Consequence and
  never wired for the admission-reject arm — #339's own module header says as much
  (`disposition-allowlist.ts`). This is that wiring, and it is why the Repairs cell books a dated REV
  forward pointer onto ADR-0068 rather than claiming nothing is owed backward: a ratified doc currently
  asserts something the tree does not do, and the repo's own precedent (ADR-0156 cl.5, commit
  `f0debd6`) is that the pointer lands at ratification, not "eventually". The verdicts file's promotion
  from ephemeral input to committed artifact is an EXTENSION of ADR-0068 cl.1/cl.3, not a contradiction
  of anything ratified.
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
  It is sound today (24/24 carry one; ADR-0060's phase-1 debt is cleared) and any regression trips cl.5
  immediately. **The invariant that makes the proxy load-bearing rather than lucky:** `admit.ts:188` is
  the ONLY path that mints a record into the store — the sole non-test `store.put()` besides
  `rescore.ts:143`, which by ADR-0068 cl.4 only UPDATES names already present (a verdict naming a record
  not in the store halts) and so can never introduce an unjudged name. So every name in the shard
  arrived through stage 10, where `qualityScore` is written iff a judge was wired. The proxy would
  become unsound only if a future wave reintroduced legitimately-unjudged admissions — at which point
  that wave owes an explicit marker, not a weakened gate.
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
- **Stale → re-verify on the build gate:** **ADR-0068's Consequences bullet** (the "all three outcomes
  are queryable" claim — the REV forward pointer the Repairs cell books; it is the one item on this list
  that lands at RATIFICATION rather than at build) · corpus LLD §6's tier-2 stage line + §12's file plan
  (→ v0.6) · `a2ui-expert-harness.spec.md` §5.3's verdicts contract (→ v0.3) ·
  `disposition-allowlist.ts`'s module header (its "the durable home" framing becomes false the moment
  cl.1 lands) · `import-seeds.ts`'s GH #335 `STILL OPEN` header block (`:51-61` at `7b91862` — this ADR
  is what closes it; the block must be deleted, not amended) · `import-seeds` usage text (`--verdicts`
  now has a write side-effect) · the three `retreat-reschedule` source comments, which become the only
  remaining un-archived refusal in the tree · the `a2ui-corpus-curate` skill's wave procedure (it must
  stop treating the verdicts file as scratch).

## Acceptance

- `mergeVerdictArchive([])` yields an empty map; a single file round-trips every field; two files naming
  one record resolve to the later `date`; two SAME-date files disagreeing on one record produce a
  structured error naming the record and both source files, and the caller halts with nothing written.
- `import-seeds --verdicts <path>` on a run that reaches `saveStore` leaves
  `corpus/verdicts/<date>--<slug>.json` **byte-identical** to the input file, with `<date>` taken from
  the file's own `date` field and `<slug>` from the `--verdicts` basename; a second identical run is a
  byte-level no-op (idempotence, ADR-0068 cl.4's standard); `--dry-run --verdicts <path>` writes neither
  store nor archive; a run that aborts on `hardErrors` before `saveStore` writes no archive.
- **The all-rejected wave archives.** A judged run in which EVERY candidate is rejected `E_QUALITY` —
  zero admissions, `shouldAbort` false because `hardErrors` is empty — still reaches `saveStore` and
  still writes the archive, and the archived file contains every one of those `passed:false` verdicts.
  **Zero admissions is not zero record**; this is the highest-value archive in the design and the one an
  implementer is most likely to skip.
- **A write never overwrites.** With `corpus/verdicts/2026-07-28--wave-b.json` already present: a run
  whose target path resolves identically and whose bytes are IDENTICAL is a no-op (exit 0, `git status
  --porcelain` clean); a run whose bytes DIFFER exits non-zero naming the path and both contents'
  hashes, writes neither archive nor store, and leaves the existing archived file byte-unchanged. A
  planted mid-run archive collision proves the store is not written either (the cl.1 all-or-nothing
  posture, ADR-0068 cl.4's standard).
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
  unjudged run HALTS on Y (cl.4) → force-admit Y through the seam without a judge → `npm test` is
  **RED** on `unjudgedAdmissions` (cl.5). Both halves asserted; the second is the one that did not exist
  before.
- On the real tree at ratification: `npm run check` and `npm test` exit 0 with the new leg live and the
  archive empty — i.e. all 24 shipped records satisfy cl.5 without a single shard edit.
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
  adopted as cl.5. It makes the miss undeniable but produces no record: the gate goes red and a human
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

## Amendment — REV 2026-07-30: a refused seed is DROPPED from the shelf — that, not a demoted allowlist, is why no transcription is owed (GH #361)

> Append-only; this rules the contradiction [GH #361](https://github.com/kimgranlund/agent-ui/issues/361)
> found between §Decision clause 6 and the §Acceptance row, and **supersedes ONE §Consequences sentence** —
> "*The transcription requirement is removed, not relocated.*" — which is true, but not for the reason a
> reader of it would infer. The Status and `Ratified by` cells are untouched; the Decision, Acceptance, and
> Consequences bodies stand unedited above. **No code changes are owed: the shipped build was already
> correct**, and this REV is what makes that legible. Kim's 2026-07-30 ruling, reading (b).

**The contradiction, named on both sides.** §Decision clause 6 demotes `DISPOSITION_ALLOWLIST` to "*exactly
the cases a machine cannot state: a deliberately-minimal smoke seed that teaches the corpus nothing, and a
refusal whose verdicts file predates this archive*" — from which a reader concludes that a refusal recorded
AFTER the archive exists owes no entry. But the §Acceptance row requires "*Both existing legs
(`seedsMissingAdmission`, `allowlistResidue`) keep their current assertions and their current negative
controls verbatim*", and `seedsMissingAdmission` takes no archive parameter — it is
`seedNames.filter((n) => !admitted.has(n) && !allowlist.has(n))` (`admission-coverage.test.ts`). So a seed
refused today, archived, and *still on `allSeeds`* is un-admitted and un-allowlisted → reported → RED, and
the only thing that greens it is a hand-written allowlist entry. Verified by direct evaluation during
[#360](https://github.com/kimgranlund/agent-ui/pull/360)'s independent review, which declined to pick a side
and escalated — the right call, since the code is faithful under either reading. Nothing here was a safety
hole: the gate reds loudly, which is the safe direction.

**Ruled (b): a refused seed leaves the shelf.** The expected disposition of an admission-time `E_QUALITY`
refusal is that the seed is **DROPPED from `src/examples/` entirely** — its module, its `index.ts` export and
family array, and its `SEEDS_BY_MODULE` registration all go — leaving the archived `passed:false` verdict
(cl.1) as the record. No `DISPOSITION_ALLOWLIST` entry is owed, **and the reason matters**: not because the
gate stopped requiring an entry for a candidate, but because a dropped seed is *no longer a candidate* —
`seedsMissingAdmission` iterates `allSeeds` and can never see a name that is not in it. Reading (a) — giving
`seedsMissingAdmission` the archive as a third input and relaxing the Acceptance row's "verbatim" — is
**declined**.

**The precedent is already in this record.** The M-B wave (PR #337) refused `retreat-reschedule`
`qualityScore 2`, failing D1/D5, and dropped it: `corpus-growth.ts`'s own family array says "*was authored
and REJECTED by the judge … and dropped entirely — never re-added here*". §Consequences' "Named residual"
bullet recorded that state and already called it "*correct rather than a gap — a seed that does not exist
cannot be re-admitted, so there is nothing to guard*". What was missing was the general statement: dropping
is the EXPECTED disposition of every refusal, not one wave's ad-hoc choice. **And clause 4 is what makes (b)
safe**: `dispositionGuard` reads the archive for any candidate on a plain unjudged run, so the moment a
dropped seed is ever re-added it becomes a candidate again and its archived `passed:false` HALTS the run with
nothing written. The archive does not guard a dropped seed — it *re-arms* the guard if the seed comes back.

**The implementation was already correct — read this before touching a leg.** Under (b) the two existing
coverage legs need no change, `seedsMissingAdmission` correctly takes no archive parameter, and every
§Acceptance criterion stands as written and as built. A reader must not conclude the #360 build deviated: it
followed Acceptance, which was the more specific instruction, and Acceptance was right.

**The false prose, corrected.** Three artifacts promised the transcription requirement was *removed*, which
reads as "the gate stopped needing an entry" — the inference (b) does not license. Two are repaired in the
same change as this REV: `src/corpus/disposition-allowlist.ts`'s header ("*A NEW refusal from here on needs
no entry at all*") and `tools/corpus/import-seeds.test.ts`'s assertion message ("*the transcription
REQUIREMENT is gone*"). Both now say the true thing — a refusal needs no entry **because the seed leaves the
shelf**, and a refusal *kept* on the shelf still owes one. The third is the §Consequences sentence above,
which is ratified body text and therefore **not edited**; this REV supersedes it and is the reading to
apply. The `a2ui-corpus-curate` skill's step 7 and validation loop are corrected against this ruling in the
same change (GH #363 items 1–2).
