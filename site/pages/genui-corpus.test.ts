// genui-corpus.test.ts — LLD-C5 (GH #1584), AC13 (n5a, jsdom half): with the committed empty index the
// page renders the honest empty state naming `npm run eval:genui-corpus` and NO score cells; with an
// injected fixture index/shard it renders one row per record with the verdict values and mounts a
// ui-sandbox-frame whose `.html` equals the record's html on disclosure open.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { renderCorpus } from './genui-corpus.ts'
import type { GenuiCorpusIndex } from '../../packages/agent-ui/a2ui/src/corpus-genui/index-shape.ts'
import type { GenuiCorpusRecord } from '../../packages/agent-ui/a2ui/src/corpus-genui/record.ts'

// jsdom reality (the agent-admin.test.ts / gen-ui-live.test.ts precedent): jsdom's `ElementInternals`
// carries no real `setFormValue`/`setValidity`, needed once this page composes a real `ui-disclosure`
// FACE control unconditionally per judged row.
let realAttachInternals: typeof HTMLElement.prototype.attachInternals
beforeAll(() => {
  realAttachInternals = HTMLElement.prototype.attachInternals
  HTMLElement.prototype.attachInternals = function (this: HTMLElement): ElementInternals {
    const internals = realAttachInternals.call(this) as unknown as Record<string, unknown>
    if (typeof internals.setFormValue !== 'function') internals.setFormValue = () => {}
    if (typeof internals.setValidity !== 'function') internals.setValidity = () => {}
    return internals as unknown as ElementInternals
  }
})
afterAll(() => {
  HTMLElement.prototype.attachInternals = realAttachInternals
})

const EMPTY_INDEX: GenuiCorpusIndex = {
  generatedAt: '2026-08-22T00:00:00.000Z',
  rubricVersion: '1.0',
  promptSetVersion: 1,
  records: [],
  m3: null,
}

function makeRoot(): HTMLElement {
  const root = document.createElement('div')
  document.body.append(root)
  return root
}

describe('renderCorpus — the honest empty state (the committed index)', () => {
  it('names the runbook invocation, shows 0 records, no score cells', () => {
    const root = makeRoot()
    renderCorpus(EMPTY_INDEX, {}, root)
    expect(root.textContent).toContain('npm run eval:genui-corpus')
    expect(root.textContent).toContain('0 records')
    expect(root.querySelectorAll('tbody tr')).toHaveLength(0)
    // no score cell anywhere — the table body is genuinely empty (headers only)
    expect(root.querySelector('td')).toBeNull()
  })

  it('never renders a placeholder/sample m3 number', () => {
    const root = makeRoot()
    renderCorpus(EMPTY_INDEX, {}, root)
    const panel = root.querySelector('.genui-corpus-m3')!
    expect(panel.querySelector('ul')).toBeNull() // no per-pack rows fabricated
    expect(panel.hasAttribute('data-floor-met')).toBe(false)
  })
})

function fixtureRecord(overrides: Partial<GenuiCorpusRecord> = {}): GenuiCorpusRecord {
  return {
    name: 'data-viz-layouts--data-viz-layouts-1--r1',
    promptId: 'data-viz-layouts-1',
    promptText: 'Compare monthly revenue across our four regions, and call out the top performer.',
    packId: 'data-viz-layouts',
    surfaceId: 'q3-revenue',
    html: '<!doctype html><body><p>revenue chart</p></body>',
    meta: {
      facet: 'eval',
      status: 'judged',
      promptSetVersion: 1,
      packHash: 'abc',
      htmlHash: 'def0123456',
      model: 'claude-sonnet-5',
      dogfood: false,
      generatedAt: '2026-08-22T00:00:00.000Z',
      provenance: { source: 'generated', origin: 'run:test' },
      lint: { byteLength: 40, externalRefs: 0, tokenRefs: 2, scriptBlocks: 0, hasDoctype: true },
      qualityScore: 5,
      passed: true,
      failingDimensions: [],
      verdictDate: '2026-08-22',
    },
    ...overrides,
  }
}

describe('renderCorpus — a fixture index/shard renders one row per record with the verdict values', () => {
  it('renders the record row with score/status/pack/prompt/hash', () => {
    const record = fixtureRecord()
    const index: GenuiCorpusIndex = {
      generatedAt: '2026-08-22T00:00:00.000Z',
      rubricVersion: '1.0',
      promptSetVersion: 1,
      records: [
        {
          name: record.name,
          promptId: record.promptId,
          packId: record.packId,
          model: record.meta.model,
          status: record.meta.status,
          qualityScore: record.meta.qualityScore,
          passed: record.meta.passed,
          failingDimensions: record.meta.failingDimensions,
          verdictDate: record.meta.verdictDate,
          htmlHash: record.meta.htmlHash,
          lint: record.meta.lint,
          rationale: 'follows the bar-comparison anatomy, tokens read with fallback',
        },
      ],
      m3: {
        judged: 1,
        passed: 1,
        passRate: 1,
        minScore: 5,
        meanScore: 5,
        floorMet: true,
        perPack: { 'data-viz-layouts': { judged: 1, passed: 1, meanD2: 5, minScore: 5 } },
      },
    }
    const shards = { '/records/v1/data-viz-layouts.jsonl': `${JSON.stringify(record)}\n` }
    const root = makeRoot()
    renderCorpus(index, shards, root)

    expect(root.textContent).toContain('1 record')
    const row = root.querySelector<HTMLTableRowElement>('tbody tr')!
    expect(row).not.toBeNull()
    expect(row.dataset.recordName).toBe(record.name)
    expect(row.textContent).toContain('data-viz-layouts')
    expect(row.textContent).toContain('5') // the score
    expect(row.textContent).toContain('judged')

    const panel = root.querySelector('.genui-corpus-m3')!
    expect(panel.getAttribute('data-floor-met')).toBe('true')
    expect(panel.textContent).toContain('floorMet: true')
  })

  it('mounts a REAL ui-sandbox-frame whose .html equals the record\'s html on disclosure open (lazy — zero frames before open)', () => {
    const record = fixtureRecord()
    const index: GenuiCorpusIndex = {
      generatedAt: '2026-08-22T00:00:00.000Z',
      rubricVersion: '1.0',
      promptSetVersion: 1,
      records: [
        {
          name: record.name,
          promptId: record.promptId,
          packId: record.packId,
          model: record.meta.model,
          status: record.meta.status,
          qualityScore: record.meta.qualityScore,
          passed: record.meta.passed,
          htmlHash: record.meta.htmlHash,
          lint: record.meta.lint,
        },
      ],
      m3: null,
    }
    const shards = { '/records/v1/data-viz-layouts.jsonl': `${JSON.stringify(record)}\n` }
    const root = makeRoot()
    renderCorpus(index, shards, root)

    // before open: zero ui-sandbox-frame elements anywhere (lazy mount)
    expect(root.querySelector('ui-sandbox-frame')).toBeNull()

    const disclosure = root.querySelector('ui-disclosure')!
    expect(disclosure).not.toBeNull()
    disclosure.setAttribute('open', '')
    disclosure.dispatchEvent(new Event('toggle'))

    const frame = root.querySelector('ui-sandbox-frame') as HTMLElement & { html: string; surfaceId: string }
    expect(frame).not.toBeNull()
    expect(frame.html).toBe(record.html)
    expect(frame.surfaceId).toBe(record.surfaceId)

    // re-toggling (close then re-open) never mounts a SECOND frame
    disclosure.removeAttribute('open')
    disclosure.dispatchEvent(new Event('toggle'))
    disclosure.setAttribute('open', '')
    disclosure.dispatchEvent(new Event('toggle'))
    expect(root.querySelectorAll('ui-sandbox-frame')).toHaveLength(1)
  })
})
