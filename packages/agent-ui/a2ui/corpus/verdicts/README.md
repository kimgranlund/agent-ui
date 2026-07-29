# `corpus/verdicts/` — the archived admission-disposition record (ADR-0165)

Every judged import run (`import-seeds --verdicts <path>`) that reaches the store write copies its own
`VerdictsFile` **verbatim** into this directory as `<date>--<slug>.json` — `<date>` from the file's own
`date` field (never the wall clock), `<slug>` from the `--verdicts` basename. Nothing here is authored by
hand: the artifact ADR-0068 clause 1 already requires to exist at run time merely stops being discarded.

A `passed:false` entry **is** the durable `E_QUALITY` record — the admission outcome `admit()` writes
nowhere (corpus LLD §6's asymmetry, deliberately left intact by ADR-0165 clause 9: the record lives
*next to* the store, not in it). Two readers consume it over one shared pure merge
(`src/corpus/verdict-archive.ts`):

- `tools/corpus/import-seeds.ts` — an unjudged run HALTS on a name carrying an archived refusal.
- `src/corpus/admission-coverage.test.ts` — the standing gate reds on an admitted seed that was never
  judged, so a refusal cannot be silently reversed.

**A write never overwrites.** A run whose target path already exists with different bytes halts, naming
both hashes; pass a distinct `--verdicts` filename. **An archived refusal does not expire** — a rubric
bump does not invalidate it; clearing one means a fresh judged run, whose newer `date` takes precedence.

The archive starts EMPTY, deliberately (ADR-0165 clause 8): the waves that predate it never committed
their verdicts files, and fabricating one would be the manufactured judgment ADR-0068 bans. This file is
the directory's only non-archive content; every reader filters to `.json`.
