// document-ingest-no-egress.test.ts — req-doc-ingestion.md R7's own acceptance line: "a test asserts no
// network request carries file bytes." Extraction (`extractDocumentText`, GH #1210) and the IndexedDB
// routing this ticket adds (`resource-idb-store.ts`, GH #1212) are both, by design, 100% client-side —
// the extracted text leaves the browser ONLY as part of the composed system prompt on the EXISTING
// dev-proxy request body (ADR-0073's trust boundary, untouched here). This suite proves that boundary
// mechanically: a `fetch` spy over the WHOLE ingest → route → mint pipeline records zero calls, for both
// a small (inline) and a large (IndexedDB-routed) document.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { StorageAdapter } from '@agent-ui/shared'
import { extractDocumentText } from '../../lib/document-extraction.ts'
import { exceedsAgentKnowledgeBudget } from './document-ingest.ts'
import { routeResourceContent, entryTextLength, RESOURCE_IDB_TEXT_THRESHOLD_CHARS, __testSetAdapter } from './resource-idb-store.ts'
import { validateNewEntry } from '../entry-list/entry-data.ts'

function fakeAdapter(): StorageAdapter {
  const values = new Map<string, unknown>()
  return {
    async get(key) {
      return values.get(key)
    },
    async set(key, value) {
      values.set(key, value)
    },
    async delete(key) {
      values.delete(key)
    },
    async keys() {
      return [...values.keys()]
    },
  }
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  __testSetAdapter(fakeAdapter())
  // Spy on whatever `fetch` this environment already provides (or install a stub if it provides none) —
  // either way, the assertion is the same: it must never be CALLED by this pipeline.
  fetchSpy = vi.fn(async () => {
    throw new Error('document-ingest-no-egress: fetch must never be called by the ingest/storage pipeline')
  })
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  __testSetAdapter(undefined)
  vi.unstubAllGlobals()
})

/** A real `File`, extracted the same way the composer's own attach path hands one to
 *  `extractDocumentText` — text/plain, so the built-in txt extractor claims it (document-extraction.ts). */
function textFile(name: string, contents: string): File {
  return new File([contents], name, { type: 'text/plain' })
}

describe('req-doc-ingestion R7 — no bytes-egress proof', () => {
  it('a SMALL document: extract → budget-check → mint (inline content) makes zero fetch calls', async () => {
    const file = textFile('notes.txt', 'a short note about the project')
    const extracted = await extractDocumentText(file)
    expect(exceedsAgentKnowledgeBudget(0, extracted.text.length)).toBe(false)

    const routed = await routeResourceContent(extracted.text)
    expect(routed.idbRef).toBeUndefined() // small — never routed, so no IndexedDB touch either

    const result = validateNewEntry([], 'resource', { label: file.name, description: '', content: routed.content })
    expect(result.ok).toBe(true)

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('a LARGE document: extract → budget-check → route to IndexedDB → mint makes zero fetch calls', async () => {
    const bigText = 'ingested-document-line\n'.repeat(1000) // well over RESOURCE_IDB_TEXT_THRESHOLD_CHARS
    expect(bigText.length).toBeGreaterThan(RESOURCE_IDB_TEXT_THRESHOLD_CHARS)
    const file = textFile('big-report.txt', bigText)
    const extracted = await extractDocumentText(file)

    const existingCharsTotal = 0
    expect(exceedsAgentKnowledgeBudget(existingCharsTotal, extracted.text.length)).toBe(false)

    const routed = await routeResourceContent(extracted.text)
    expect(routed.idbRef).toBeDefined() // large — routed to the (fake) IndexedDB tier

    const result = validateNewEntry([], 'resource', { label: file.name, description: '', content: routed.content })
    expect(result.ok).toBe(true)
    const entry = result.ok ? { ...result.entry, idbRef: routed.idbRef, contentLength: routed.contentLength } : undefined
    expect(entry && entryTextLength(entry)).toBe(bigText.length)

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('an over-budget attach (rejected before minting) also makes zero fetch calls', async () => {
    const file = textFile('huge.txt', 'x'.repeat(1000))
    const extracted = await extractDocumentText(file)
    // Simulate an agent whose existing resources already sit at the aggregate cap.
    const atCapAlready = 200_000
    expect(exceedsAgentKnowledgeBudget(atCapAlready, extracted.text.length)).toBe(true)
    // Rejected here — the real `#handleAttach` never calls `routeResourceContent` past this point.
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
