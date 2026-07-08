// site/lib/a2a-concepts.ts — the A2A CONCEPTS/DEMOS derivation lib (corpus LLD-C9, SPEC-R15). Sister to
// site/lib/a2ui-gallery.ts: this module holds NO record literals — membership IS the committed shard. One
// card per admitted record, in shard order, so a record added to the shard (via the single-writer import
// tool, `tools/corpus/import-seeds.ts`) appears on the page with ZERO edits here.
//
// Derivation (LLD §6): both shards arrive as Vite `?raw` static imports (the arena page's
// `matches/*.jsonl?raw` precedent — zero network, zero fetch, SPEC-N2), parsed with the package's own
// `parseShard`, filtered with `admittedRecords` — the SAME zero-dep functions the import tool and the
// standing corpus gate use (SPEC-N1, no forked reader).
//
// Card anatomy (LLD §6, "all text read off the record — SPEC-R15's one-home rule mechanically"):
//   head (name + facet badge + a derived artifact-count facet) -> description -> body prose (textContent,
//   never innerHTML) -> citations (hv rows + repo paths, rendered as provenance) -> one entry per wire
//   artifact:
//     - inline (message/task/card/rpc-request/rpc-response) -> a collapsed JSON disclosure PLUS an
//       IN-PAGE verdict: the card runs the REAL `validateA2a` right here (never a precomputed/hardcoded
//       badge — the honest-verdict discipline the arena page already keeps), reflected onto
//       `data-validated`.
//     - transcript -> a link to the arena page (`./a2a-tic-tac-toe.html`) labeled with the fixture name +
//       its declared expectation. The raw match text is NOT re-imported here (that would double-ship the
//       fixture bytes) — the arena page + the standing gate already run those exact checks; this card
//       states that honestly rather than implying an in-page replay it does not perform.
//
// A record or artifact whose in-page verdict fails is shown, not papered over: the card carries
// `data-validated="false"` and an honest defect note (mirrors the gallery's seed-defect posture) — the
// drift gate (a2a-concepts.test.ts) fails independently on the same condition.
import './a2a-concepts.css'
import { codeBlock } from './code-block.ts'
import { admittedRecords, parseShard, validateA2a, PROTOCOL_VERSION } from '@agent-ui/a2a'
import type { A2aCorpusRecord, A2aCitation, A2aWireArtifact, A2aFailure, CorpusFailure } from '@agent-ui/a2a'

// The committed shards (corpus LLD-C6) — zero-network static imports, exactly the arena page's
// `matches/*.jsonl?raw` precedent.
import conceptShardRaw from '../../packages/agent-ui/a2a/corpus/concept/v0_3_0/a2a.jsonl?raw'
import demoShardRaw from '../../packages/agent-ui/a2a/corpus/demo/v0_3_0/a2a.jsonl?raw'

export interface RecordCard {
  readonly record: A2aCorpusRecord
  readonly card: HTMLElement
  /** Per-wire-artifact in-page validation verdicts, in `record.wire` order. Empty per entry = clean; a
   *  transcript reference always yields `[]` (LLD §6 — no in-page replay for transcript references). */
  readonly artifactFailures: A2aFailure[][]
}

// ── citations (the provenance list) ────────────────────────────────────────────────────────────────────
function buildCitation(citation: A2aCitation): HTMLElement {
  const li = document.createElement('li')
  li.className = 'concept-card-citation'
  if (citation.kind === 'hv') {
    li.dataset.citationKind = 'hv'
    li.textContent = `Ledger ${citation.row} (a2a-foundations SPEC §2)`
  } else {
    li.dataset.citationKind = 'repo'
    const code = document.createElement('code')
    code.textContent = citation.path
    li.append(code)
  }
  return li
}

function buildCitationsList(citations: readonly A2aCitation[]): HTMLElement {
  const ul = document.createElement('ul')
  ul.className = 'concept-card-citations'
  for (const citation of citations) ul.append(buildCitation(citation))
  return ul
}

// ── wire artifacts ──────────────────────────────────────────────────────────────────────────────────────

/** Fixture-name-friendly label off a committed match path (`matches/scripted.match.jsonl` -> `scripted`). */
function fixtureLabel(path: string): string {
  const base = path.split('/').pop() ?? path
  return base.replace(/\.match\.jsonl$/, '')
}

function buildTranscriptArtifact(artifact: Extract<A2aWireArtifact, { kind: 'transcript' }>, index: number): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'concept-card-artifact'
  wrap.dataset.artifactIndex = String(index)
  wrap.dataset.artifactKind = 'transcript'
  wrap.dataset.expect = artifact.expect

  const link = document.createElement('a')
  link.className = 'concept-card-transcript-link'
  link.href = './a2a-tic-tac-toe.html'
  const note =
    artifact.expect === 'contaminated'
      ? 'replayable in the arena — a must-fail negative control'
      : 'replayable in the arena — a clean recorded match'
  link.textContent = `${fixtureLabel(artifact.path)} — ${note}`
  wrap.append(link)
  return wrap
}

/** An inline artifact -> a collapsed JSON disclosure + the REAL, in-page `validateA2a` verdict (never
 *  precomputed). `expect` is passed explicitly as the artifact's own declared kind (never `'auto'`), the
 *  same "never re-classify" discipline the corpus's own admission pipeline holds. */
function buildInlineArtifact(
  artifact: Exclude<A2aWireArtifact, { kind: 'transcript' }>,
  index: number,
): { element: HTMLElement; failures: A2aFailure[] } {
  const failures = validateA2a(artifact.artifact, { protocolVersion: PROTOCOL_VERSION, expect: artifact.kind })

  const wrap = document.createElement('div')
  wrap.className = 'concept-card-artifact'
  wrap.dataset.artifactIndex = String(index)
  wrap.dataset.artifactKind = artifact.kind
  wrap.dataset.validated = failures.length === 0 ? 'true' : 'false'

  const details = document.createElement('details')
  details.className = 'concept-card-artifact-json'
  const summary = document.createElement('summary')
  summary.textContent = `${artifact.kind} (JSON)`
  details.append(summary, codeBlock(JSON.stringify(artifact.artifact, null, 2), 'json'))
  wrap.append(details)

  return { element: wrap, failures }
}

function buildWireArtifact(artifact: A2aWireArtifact, index: number): { element: HTMLElement; failures: A2aFailure[] } {
  if (artifact.kind === 'transcript') return { element: buildTranscriptArtifact(artifact, index), failures: [] }
  return buildInlineArtifact(artifact, index)
}

// ── the card ────────────────────────────────────────────────────────────────────────────────────────────

/** buildRecordCard — one card for one admitted record, ALL text read off the record (SPEC-R15's one-home
 *  rule mechanically: nothing here is hand-transcribed). Parameterized on `record` (not on the shard) so
 *  the drift gate's negative controls (LLD §6/§9) can drive it directly with a synthetic malformed record.
 */
export function buildRecordCard(record: A2aCorpusRecord): RecordCard {
  const card = document.createElement('div')
  card.className = 'concept-card'
  card.dataset.record = record.name
  card.dataset.facet = record.meta.facet

  const head = document.createElement('div')
  head.className = 'concept-card-head'
  const heading = document.createElement('h2')
  heading.className = 'concept-card-heading'
  heading.textContent = record.name
  const facetBadge = document.createElement('span')
  facetBadge.className = 'concept-card-facet'
  facetBadge.textContent = record.meta.facet
  const artifactCount = document.createElement('span')
  artifactCount.className = 'concept-card-count'
  artifactCount.textContent = `${record.wire.length} artifact${record.wire.length === 1 ? '' : 's'}`
  head.append(heading, facetBadge, artifactCount)

  const desc = document.createElement('p')
  desc.className = 'concept-card-desc'
  desc.textContent = record.description

  // The teaching body prose (SPEC-R15's ONE home for concept prose) — textContent, never innerHTML.
  // Rendered as paragraph(s): today's seeds are single-paragraph, but a `\n\n`-separated body (should one
  // ever be authored) renders as more than one <p>, never one giant unbroken block.
  const body = document.createElement('div')
  body.className = 'concept-card-body'
  const paragraphs = record.body.split('\n\n').filter((p) => p.trim() !== '')
  for (const para of paragraphs.length > 0 ? paragraphs : [record.body]) {
    const p = document.createElement('p')
    p.textContent = para
    body.append(p)
  }

  const citationsList = buildCitationsList(record.citations)

  const wireSection = document.createElement('div')
  wireSection.className = 'concept-card-wire'
  const artifactFailures: A2aFailure[][] = []
  record.wire.forEach((artifact, i) => {
    const { element, failures } = buildWireArtifact(artifact, i)
    artifactFailures.push(failures)
    wireSection.append(element)
  })

  const allClean = artifactFailures.every((f) => f.length === 0)
  card.dataset.validated = allClean ? 'true' : 'false'

  card.append(head, desc, body, citationsList, wireSection)

  // A defect is shown, not hidden (the gallery's seed-defect posture): the drift gate fails independently
  // on the same `artifactFailures` condition.
  if (!allClean) {
    const defect = document.createElement('p')
    defect.className = 'concept-card-defect'
    defect.setAttribute('role', 'status')
    const failingKinds = record.wire
      .map((w, i) => ({ w, i }))
      .filter(({ i }) => artifactFailures[i]!.length > 0)
      .map(({ w, i }) => `${w.kind}@wire[${i}]`)
    defect.textContent = `This record's in-page verification found a problem — ${failingKinds.join(', ')} failed validateA2a.`
    card.append(defect)
  }

  return { record, card, artifactFailures }
}

/** buildCardsFrom — one card per record, IN GIVEN ORDER (never sorted/hand-listed). The parameterized seam
 *  the drift gate's negative controls drive directly (LLD §9). */
export function buildCardsFrom(records: readonly A2aCorpusRecord[]): RecordCard[] {
  return records.map(buildRecordCard)
}

export interface ConceptsSections {
  readonly concepts: RecordCard[]
  readonly demos: RecordCard[]
  readonly parseFailures: CorpusFailure[]
}

/** buildConceptsSections — the whole page's content, DERIVED from the committed shards. No record is named
 *  here: the member list is the shard, so a record added via the import tool appears with zero edits. */
export function buildConceptsSections(): ConceptsSections {
  const conceptParsed = parseShard(conceptShardRaw)
  const demoParsed = parseShard(demoShardRaw)
  return {
    concepts: buildCardsFrom(admittedRecords(conceptParsed.records)),
    demos: buildCardsFrom(admittedRecords(demoParsed.records)),
    parseFailures: [...conceptParsed.failures, ...demoParsed.failures],
  }
}
