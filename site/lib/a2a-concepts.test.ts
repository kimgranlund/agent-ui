import { describe, it, expect } from 'vitest'
import { buildConceptsSections, buildCardsFrom, buildRecordCard } from './a2a-concepts.ts'
import { admittedRecords } from '@agent-ui/a2a'
import type { A2aCorpusRecord } from '@agent-ui/a2a'

// a2a-concepts.test.ts — LLD-C11 (SPEC-R15 AC1) the drift gate for the A2A concepts/demos derivation lib.
// Sister to a2ui-gallery.test.ts. Honest about what each leg buys (the gallery's own honesty note,
// restated): the set-equality legs (card count/names ≡ the admitted shard set) are TAUTOLOGICAL against
// the current `buildCardsFrom(admittedRecords(...))` derivation — both sides read the same shard — so they
// are a TRIPWIRE against a future hand-listed refactor, not proof against a shard edit today. The REAL
// coverage: (a) parseShard over the committed raw yields zero failures; (b) every inline-artifact card
// asserts `data-validated === 'true'` (a record or validator regression fails here); (c) sampled card text
// === the record's own fields (anti-hand-duplication); (d) every transcript artifact renders the arena
// href; (e) negative controls through the parameterized seam (buildCardsFrom / buildRecordCard) prove a
// quarantined record is excluded and a broken inline artifact is caught.

const { concepts, demos, parseFailures } = buildConceptsSections()
const allCards = [...concepts, ...demos]

describe('a2a-concepts — the committed shards parse clean (no line-level failure)', () => {
  it('parseShard over both committed shards yields zero failures', () => {
    expect(parseFailures).toEqual([])
  })
})

describe('a2a-concepts — anti-vacuous: real admitted records were found', () => {
  it('at least 6 concept cards and 1 demo card rendered (the PRD-G3 floor)', () => {
    expect(concepts.length).toBeGreaterThanOrEqual(6)
    expect(demos.length).toBeGreaterThanOrEqual(1)
  })
})

describe('a2a-concepts — every card carries a clean in-page verdict (the corpus is committed-valid content)', () => {
  for (const { record, card } of allCards) {
    it(`record "${record.name}": data-validated === 'true'`, () => {
      expect(card.dataset.validated, `record "${record.name}" failed its in-page validateA2a verdict`).toBe('true')
      expect(card.querySelector('.concept-card-defect'), `record "${record.name}" carries a defect note`).toBeNull()
    })
  }
})

describe('a2a-concepts — sampled card text is read straight off the record (anti-hand-duplication)', () => {
  it('the "message-parts" card renders the record\'s own name/description/facet', () => {
    const found = allCards.find((c) => c.record.name === 'message-parts')
    expect(found).toBeDefined()
    const { record, card } = found!
    expect(card.dataset.facet).toBe(record.meta.facet)
    expect(card.querySelector('.concept-card-heading')?.textContent).toBe(record.name)
    expect(card.querySelector('.concept-card-desc')?.textContent).toBe(record.description)
    expect(card.querySelector('.concept-card-count')?.textContent).toBe(`${record.wire.length} artifacts`)
  })

  it('citation rows read off the record\'s own citations (hv row / repo path, never hand-transcribed)', () => {
    const found = allCards.find((c) => c.record.name === 'message-parts')!
    const rows = [...found.card.querySelectorAll('.concept-card-citation')]
    expect(rows).toHaveLength(found.record.citations.length)
    for (const [i, citation] of found.record.citations.entries()) {
      if (citation.kind === 'hv') expect(rows[i]!.textContent).toContain(citation.row)
      else expect(rows[i]!.textContent).toContain(citation.path)
    }
  })
})

describe('a2a-concepts — every transcript wire artifact renders the arena link', () => {
  const withTranscripts = allCards.filter((c) => c.record.wire.some((w) => w.kind === 'transcript'))
  it('found at least one record carrying a transcript reference (anti-vacuous)', () => {
    expect(withTranscripts.length).toBeGreaterThan(0)
  })
  for (const { record, card } of withTranscripts) {
    it(`record "${record.name}": every transcript artifact links to ./a2a-tic-tac-toe.html`, () => {
      const links = [...card.querySelectorAll<HTMLAnchorElement>('.concept-card-transcript-link')]
      const transcriptCount = record.wire.filter((w) => w.kind === 'transcript').length
      expect(links).toHaveLength(transcriptCount)
      for (const link of links) expect(link.getAttribute('href')).toBe('./a2a-tic-tac-toe.html')
    })
  }
})

// Review-hardened: the old phantom leg only proved JS array inequality (appending an element always
// breaks toEqual) — vacuous as a derivation probe. This one drives the REAL derivation function on a
// doctored membership and asserts the rendered card set reflects the delta: the derivation genuinely
// maps membership → cards 1:1, so an added record appears and the count follows the input.
describe('a2a-concepts — the derivation BITES: buildCardsFrom reflects a doctored membership (negative control)', () => {
  it('a record added to the membership yields exactly one more rendered card, carrying its name', () => {
    const base = concepts.map((c) => c.record)
    const planted: A2aCorpusRecord = { ...base[0]!, name: 'zz-planted-derivation-probe' }
    const cards = buildCardsFrom(admittedRecords([...base, planted]))
    expect(cards).toHaveLength(concepts.length + 1)
    expect(cards.some((c) => c.record.name === 'zz-planted-derivation-probe')).toBe(true)
  })
})

// ── negative control 1: a quarantined record is EXCLUDED (through the parameterized seam) ────────────────
describe('a2a-concepts — quarantine BITES: a quarantined record never reaches buildCardsFrom (negative control)', () => {
  const baseRecord: A2aCorpusRecord = concepts[0]!.record
  const quarantined: A2aCorpusRecord = {
    ...baseRecord,
    name: 'zz-quarantined-fixture',
    meta: { ...baseRecord.meta, status: 'quarantined' },
  }

  it('admittedRecords excludes the quarantined record; buildCardsFrom never renders it', () => {
    const doctored = [...concepts.map((c) => c.record), quarantined]
    const cards = buildCardsFrom(admittedRecords(doctored))
    expect(cards.some((c) => c.record.name === 'zz-quarantined-fixture')).toBe(false)
    expect(cards).toHaveLength(concepts.length)
  })
})

// ── negative control 2: a broken inline artifact is caught, not papered over ───────────────────────────────
describe('a2a-concepts — the in-page verdict BITES on a broken inline artifact (negative control)', () => {
  const baseRecord: A2aCorpusRecord = concepts[0]!.record
  const broken: A2aCorpusRecord = {
    ...baseRecord,
    name: 'zz-broken-artifact-fixture',
    wire: [{ kind: 'message', artifact: { kind: 'message' /* missing role/parts/messageId — invalid */ } }],
  }

  it('buildRecordCard flags the broken record: data-validated="false" + a defect note naming the artifact', () => {
    const { card, artifactFailures } = buildRecordCard(broken)
    expect(artifactFailures[0]!.length).toBeGreaterThan(0)
    expect(card.dataset.validated).toBe('false')
    const defect = card.querySelector('.concept-card-defect')
    expect(defect).not.toBeNull()
    expect(defect?.textContent).toContain('message@wire[0]')
  })

  it('the broken fixture is NOT on either committed shard', () => {
    expect(allCards.some((c) => c.record.name === 'zz-broken-artifact-fixture')).toBe(false)
  })
})
