// genui-corpus.browser.test.ts — LLD-C5 (GH #1584), AC13 (n5a, the real-engine half): the fixture row
// paints a real frame — a real `<iframe data-part="frame">` genuinely lays out inside the mounted
// `ui-sandbox-frame`, only jsdom cannot prove (jsdom never runs real layout). This drives
// `renderCorpus` directly (the exported testable seam, LLD §7) rather than the whole mounted page — the
// SAME "prove the render function, not the module-load side effect" posture `genui-corpus.test.ts`
// already takes; this file adds ONLY the real-engine leg jsdom cannot: genuine paint.
import { describe, it, expect } from 'vitest'
import { renderCorpus } from './genui-corpus.ts'
import type { GenuiCorpusIndex } from '../../packages/agent-ui/a2ui/src/corpus-genui/index-shape.ts'
import type { GenuiCorpusRecord } from '../../packages/agent-ui/a2ui/src/corpus-genui/record.ts'

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

const RECORD: GenuiCorpusRecord = {
  name: 'data-viz-layouts--data-viz-layouts-1--r1',
  promptId: 'data-viz-layouts-1',
  promptText: 'Compare monthly revenue across our four regions, and call out the top performer.',
  packId: 'data-viz-layouts',
  surfaceId: 'q3-revenue',
  html: '<!doctype html><body style="margin:0;padding:1rem;"><p>revenue chart</p></body>',
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
    lint: { byteLength: 60, externalRefs: 0, tokenRefs: 0, scriptBlocks: 0, hasDoctype: true },
    qualityScore: 5,
    passed: true,
    failingDimensions: [],
    verdictDate: '2026-08-22',
  },
}

const INDEX: GenuiCorpusIndex = {
  generatedAt: '2026-08-22T00:00:00.000Z',
  rubricVersion: '1.0',
  promptSetVersion: 1,
  records: [
    {
      name: RECORD.name,
      promptId: RECORD.promptId,
      packId: RECORD.packId,
      model: RECORD.meta.model,
      status: RECORD.meta.status,
      qualityScore: RECORD.meta.qualityScore,
      passed: RECORD.meta.passed,
      htmlHash: RECORD.meta.htmlHash,
      lint: RECORD.meta.lint,
    },
  ],
  m3: null,
}

describe('genui-corpus — the fixture row paints a REAL frame (pixel-truth, real engine only)', () => {
  it('opening the disclosure mounts a ui-sandbox-frame whose internal <iframe> genuinely lays out', async () => {
    expect(customElements.get('ui-sandbox-frame'), 'ui-sandbox-frame must be a defined custom element').toBeDefined()
    expect(customElements.get('ui-disclosure'), 'ui-disclosure must be a defined custom element').toBeDefined()

    const root = document.createElement('div')
    document.body.append(root)
    const shards = { '/records/v1/data-viz-layouts.jsonl': `${JSON.stringify(RECORD)}\n` }
    renderCorpus(INDEX, shards, root)
    await raf()

    // before open: zero real iframes anywhere under the page (the lazy-mount law, real engine too)
    expect(root.querySelector('iframe[data-part="frame"]')).toBeNull()

    const disclosure = root.querySelector('ui-disclosure')!
    disclosure.setAttribute('open', '')
    disclosure.dispatchEvent(new Event('toggle'))
    await raf()

    const frame = root.querySelector('ui-sandbox-frame')!
    expect(frame).not.toBeNull()
    const iframe = frame.querySelector('iframe[data-part="frame"]') as HTMLIFrameElement | null
    expect(iframe, 'the control must have built its real sandboxed iframe').not.toBeNull()
    expect(iframe!.getAttribute('sandbox')).toBe('allow-scripts')
    // Real layout — jsdom never lays anything out; a non-zero box here IS the paint proof.
    const box = iframe!.getBoundingClientRect()
    expect(box.width, 'the iframe must have genuinely painted with a real box').toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)

    root.remove()
  })
})
