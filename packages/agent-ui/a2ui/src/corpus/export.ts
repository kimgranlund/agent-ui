// export.ts — the corpus exporters (corpus LLD-C10, SPEC-R10/R12).
//
// `exportCatalogExamples`'s artifact shape was escalated (repo-absence ≠ spec-absence — no upstream
// example-file shape was recorded anywhere in this repo) and host-fetched verbatim from
// google/A2UI@main 2026-07-03:
//   • `schema/manager.py:195-236` (`generate_system_prompt`) — `include_examples=True` calls
//     `load_examples(catalog)` and appends the returned STRING as `"### Examples:\n{examples_str}"`.
//   • `schema/catalog.py:352-391` (`load_examples`) — examples are a DIRECTORY of `*.json` files, ONE
//     example per file; `matched_files.sort()` ("sort for determinism"); each file is wrapped as
//     `"---BEGIN {basename}---\n{content}\n---END {basename}---"` at LOAD time — the file itself holds
//     none of that; `basename = splitext(basename(full_path))[0]` (the round-trip this module's `name`
//     must survive); on `validate=True`, `json.loads(content)` then `validator.validate(json_data)`.
//   • a real upstream fixture, `agent_sdks/conformance/test_data/load_examples/basic/example1.json`,
//     entire content verbatim: `[{"beginRendering": {"surfaceId": "id"}}]` — a BARE JSON array of
//     message objects, no name/prompt wrapper (the name lives in the filename, not the content).
// So the artifact is a SET OF FILES-TO-BE (name → content), not one JSON document; the Node shell (a
// later slice) writes `<name>.json`. `content` is the record's `a2uiOutput` verbatim (same
// non-canonicalized reasoning as `exportFineTune`, below) — no `---BEGIN/---END` markers, no
// `### Examples:` heading (the loader adds those, the file never carries them).
//
// Both exporters share one hard internal invariant, mirroring `retrieve.ts`'s precedent: only
// `facet:"exemplar"`, non-`"quarantined"` records are ever eligible, regardless of what the caller
// passes in — an eval-facet or quarantined record can never leak into an export artifact (SPEC-R3/R13).
//
// Zero-dep, platform-neutral (SPEC-N5/ADR-0062): no imports beyond `record.ts` and `protocol.ts` types.

import type { CorpusRecord } from './record.ts'
import type { A2uiOutput } from '../protocol.ts'

// Shared by both exporters: a record without `a2uiOutput` is structurally unusable for either artifact
// (an admitted exemplar always has one, SPEC-R2 AC1) — defensively skipped, never thrown.
const hasOutput = (r: CorpusRecord): r is CorpusRecord & { a2uiOutput: A2uiOutput } => r.a2uiOutput !== undefined

export interface CatalogExamplesScope {
  catalogId: string
  protocolVersion: string
}

/**
 * One example destined to become `<name>.json` under the catalog's examples directory that upstream's
 * `load_examples()` glob-loads (`schema/catalog.py:352-391`). `content` is the JSON serialization of
 * the record's `a2uiOutput` message array, VERBATIM — bare, unwrapped (verified against a real upstream
 * fixture: `agent_sdks/conformance/test_data/load_examples/basic/example1.json`).
 */
export interface CatalogExampleFile {
  name: string
  content: string
}

// Upstream round-trips `name` through `splitext(basename(full_path))[0]` to recover it from the written
// `<name>.json` file — a name containing `/`, a leading `.`, or nothing at all does not survive that
// round-trip cleanly. Record names are already slug-like (LLD §2's join-key convention); this is a
// defensive floor, not a new naming scheme: alphanumeric, `_`/`-` in the interior only.
const BASENAME_SAFE = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/

/**
 * Export exemplar records as catalog-example files (SPEC-R10) for `scope.catalogId` +
 * `scope.protocolVersion`. Eligibility mirrors `exportFineTune`'s hard invariant: `facet:"exemplar"`,
 * non-`"quarantined"`, scope-pinned (both `catalogId` AND `protocolVersion` — SPEC-R10's own filter
 * axes), `a2uiOutput` present. A record whose `name` is not `BASENAME_SAFE` is defensively skipped
 * (never thrown) — the same "skip a structurally-unusable input" stance as a missing `a2uiOutput`.
 *
 * Deterministic order: ascending `name` — matches upstream's own `matched_files.sort()` (`schema/
 * catalog.py`), so the produced set already sorts the way the real loader iterates.
 * Never throws; an empty or empty-after-scoping input yields `[]`.
 */
export function exportCatalogExamples(records: readonly CorpusRecord[], scope: CatalogExamplesScope): CatalogExampleFile[] {
  const eligible = records
    .filter(
      (r) =>
        r.meta.facet === 'exemplar' &&
        r.meta.status !== 'quarantined' &&
        r.meta.catalogId === scope.catalogId &&
        r.meta.protocolVersion === scope.protocolVersion,
    )
    .filter(hasOutput)
    .filter((r) => BASENAME_SAFE.test(r.name))
    .slice()
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

  return eligible.map((r) => ({ name: r.name, content: JSON.stringify(r.a2uiOutput) }))
}

export interface FineTuneScope {
  protocolVersion: string
}

/** One `{prompt, context, output}` fine-tune pair (SPEC-R12). `context` bundles the record's own
 * `generate_system_prompt()`-conditioning fields (`catalog`/`role_description`/`workflow_description`,
 * SPEC §5.1) — present ones only, `undefined` fields omitted rather than carried as explicit nulls.
 * `output` is the record's ground-truth `a2uiOutput`, UNMODIFIED: canonicalization (LLD-C3) exists for
 * dedup equality, not to reshape the training signal — an author's own IDs are what a model should see. */
export interface FineTuneRecord {
  prompt: string
  context: Partial<Pick<CorpusRecord, 'catalog' | 'role_description' | 'workflow_description'>>
  output: A2uiOutput
}

/**
 * Export exemplar `{prompt, context, output}` pairs as JSONL lines (SPEC-R12, one JSON object per
 * returned string). Eligibility is a HARD invariant, not a caller-controlled filter: `facet:"exemplar"`,
 * `status !== "quarantined"`, pinned to `scope.protocolVersion`, and carrying an `a2uiOutput` (an
 * admitted exemplar always does, SPEC-R2 AC1 — a record missing one is defensively skipped rather than
 * emitting a malformed pair, never thrown). Because eval-facet records are excluded by construction,
 * SPEC-R3's leak gate holds vacuously over this output — the planted-eval negative control (export.test.ts)
 * proves the exclusion mechanically, it does not merely assert the invariant's intent.
 *
 * Deterministic order: ascending `name` (unique per record, LLD §2) — the same tie-break `retrieve.ts`
 * uses. Never throws; an empty or empty-after-scoping input yields `[]` (SPEC-R11 AC2's sibling case).
 */
export function exportFineTune(records: readonly CorpusRecord[], scope: FineTuneScope): string[] {
  const eligible = records
    .filter(
      (r) =>
        r.meta.facet === 'exemplar' && r.meta.status !== 'quarantined' && r.meta.protocolVersion === scope.protocolVersion,
    )
    .filter(hasOutput)
    .slice()
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

  return eligible.map((r) => JSON.stringify(buildFineTuneRecord(r)))
}

function buildFineTuneRecord(r: CorpusRecord & { a2uiOutput: A2uiOutput }): FineTuneRecord {
  const context: FineTuneRecord['context'] = {}
  if (r.catalog !== undefined) context.catalog = r.catalog
  if (r.role_description !== undefined) context.role_description = r.role_description
  if (r.workflow_description !== undefined) context.workflow_description = r.workflow_description
  return { prompt: r.promptText, context, output: r.a2uiOutput }
}
