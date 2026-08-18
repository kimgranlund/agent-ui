// document-extraction-docx.test.ts — GH #1214, LLD §7: the module's exhaustive jsdom suite. `npm test`
// (jsdom) is THE module gate here — under this repo's vitest/jsdom/Node 24 config, `DecompressionStream`
// is Node's REAL native implementation leaking through the environment merge and `DOMParser` is jsdom's
// real XML parser, both probe-verified executing (not skipped). A pure byte/XML parser has no rendering,
// focus, or layout surface, so re-running the same assertions under Chromium would be redundant proof;
// the ONE thing jsdom genuinely cannot prove — the browser-native `DecompressionStream`/`DOMParser`/attach
// path/entry mint composing on a real engine — is `document-ingest-docx.browser.test.ts`'s (C7) job.

import { describe, it, expect, afterEach } from 'vitest'
import {
  __testResetRegistry,
  extractDocumentText,
  registerDocumentExtractor,
  textExtractor,
} from './document-extraction.ts'
import { docxExtractor, extractDocxText } from './document-extraction-docx.ts'
import { buildDocxZip, buildDocxFile, documentXml } from './docx-test-fixtures.ts'

// The `document-extraction.test.ts` afterEach reset/re-register pattern, extended to re-register BOTH
// extractors in the SAME order production loads them (`document-extraction.ts` registers `textExtractor`
// at its own module load; `document-extraction-docx.ts` imports that module first, then registers
// `docxExtractor` — so `docxExtractor` ends up FIRST in the LIFO registry, exactly as it does here).
afterEach(() => {
  __testResetRegistry()
  registerDocumentExtractor(textExtractor)
  registerDocumentExtractor(docxExtractor)
})

// Capability canary — UNGATED (LLD §7's own loud-fail law): if `DecompressionStream` ever vanishes from
// this repo's vitest/jsdom/Node config, the WHOLE gated suite below would otherwise skip silently instead
// of failing loud. Kept as a plain, always-run assertion outside the `describe.skipIf` block.
it('capability canary: DecompressionStream is defined under this repo\'s own vitest/jsdom/Node config', () => {
  expect(typeof DecompressionStream).toBe('function')
})

describe.skipIf(typeof DecompressionStream !== 'function')(
  // Portability only — this repo's own config always defines it (the canary above proves that loudly);
  // this guard exists for a future engine/config that genuinely lacks it.
  'extractDocxText / docxExtractor (GH #1214)',
  () => {
    describe('positive — zip/inflate/XML round trips', () => {
      it('STORE round-trip: extracts text through the FULL seam, tagged with meta.extractor === "docx"', async () => {
        const file = await buildDocxFile('report.docx', { documentXml: documentXml([['Hello world']]) })
        const result = await extractDocumentText(file)
        expect(result.text).toBe('Hello world')
        expect(result.meta.extractor).toBe('docx')
      })

      it('DEFLATE round-trip: inflates the compressed word/document.xml entry correctly', async () => {
        const file = await buildDocxFile('report.docx', {
          documentXml: documentXml([['Hello deflate world']]),
          documentEntry: { compress: 'deflate' },
        })
        const result = await extractDocumentText(file)
        expect(result.text).toBe('Hello deflate world')
      })

      it('a local-header extra field absent from the central directory entry does not shift the payload (§4.3)', async () => {
        const bytes = await buildDocxZip({
          documentXml: documentXml([['Extra field survives']]),
          documentEntry: { localOnlyExtra: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) },
        })
        const text = await extractDocxText(bytes)
        expect(text).toBe('Extra field survives')
      })

      it('a trailing EOCD comment does not break the bounded backward scan (§4.1)', async () => {
        const bytes = await buildDocxZip({
          documentXml: documentXml([['Comment tail']]),
          eocdComment: new TextEncoder().encode('a real archiver could append a comment here'),
        })
        const text = await extractDocxText(bytes)
        expect(text).toBe('Comment tail')
      })

      it('word/document.xml need not be the first entry in the archive', async () => {
        const bytes = await buildDocxZip({
          leadingEntries: [{ path: 'docProps/core.xml', data: '<coreProperties/>' }],
          documentXml: documentXml([['Not first']]),
        })
        const text = await extractDocxText(bytes)
        expect(text).toBe('Not first')
      })

      it('maps w:p to newline-joined paragraphs and concatenates multiple w:t runs per paragraph (incl. xml:space="preserve")', async () => {
        const bytes = await buildDocxZip({
          documentXml: documentXml([
            ['Hello', ' ', 'world'],
            ['Second paragraph'],
          ]),
        })
        const text = await extractDocxText(bytes)
        expect(text).toBe('Hello world\nSecond paragraph')
      })
    })

    describe('negative — every malformed-input mode surfaces as corrupt-document, never a hang or silent empty string', () => {
      it('non-zip bytes reject ("not a zip archive")', async () => {
        const bytes = new TextEncoder().encode('this is not a zip archive at all, just plain text')
        await expect(extractDocxText(bytes)).rejects.toMatchObject({
          name: 'DocumentExtractionError',
          reason: 'corrupt-document',
        })
      })

      it('a PNG magic header rejects', async () => {
        const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        await expect(extractDocxText(bytes)).rejects.toMatchObject({
          name: 'DocumentExtractionError',
          reason: 'corrupt-document',
        })
      })

      it('a truncated central directory rejects (bounds overrun, §4.2 — not a re-hit of "no EOCD found")', async () => {
        const bytes = await buildDocxZip({ truncateCentralDirectoryBytes: 40 })
        await expect(extractDocxText(bytes)).rejects.toMatchObject({
          name: 'DocumentExtractionError',
          reason: 'corrupt-document',
        })
      })

      it('a valid archive missing word/document.xml rejects', async () => {
        const bytes = await buildDocxZip({ omitDocumentXml: true })
        await expect(extractDocxText(bytes)).rejects.toMatchObject({
          name: 'DocumentExtractionError',
          reason: 'corrupt-document',
        })
      })

      it('a DEFLATE-labeled entry over garbage (never-actually-deflated) bytes rejects', async () => {
        const bytes = await buildDocxZip({
          documentXml: 'not actually deflated bytes, just plain ascii text',
          documentEntry: { methodOverride: 8 }, // labeled DEFLATE; `compress` defaults to 'store' — raw bytes
        })
        await expect(extractDocxText(bytes)).rejects.toMatchObject({
          name: 'DocumentExtractionError',
          reason: 'corrupt-document',
        })
      })

      it('an unsupported compression method rejects, naming the method number in the message', async () => {
        const bytes = await buildDocxZip({ documentEntry: { methodOverride: 99 } })
        await expect(extractDocxText(bytes)).rejects.toMatchObject({
          name: 'DocumentExtractionError',
          reason: 'corrupt-document',
          message: expect.stringContaining('99'),
        })
      })

      it('malformed XML in word/document.xml rejects (DOMParser parsererror)', async () => {
        const bytes = await buildDocxZip({ documentXml: '<w:document><w:body><w:p></w:document>' })
        await expect(extractDocxText(bytes)).rejects.toMatchObject({
          name: 'DocumentExtractionError',
          reason: 'corrupt-document',
        })
      })

      it('valid XML with the wrong root element/namespace rejects', async () => {
        const bytes = await buildDocxZip({ documentXml: '<?xml version="1.0"?><root>not wordprocessingml</root>' })
        await expect(extractDocxText(bytes)).rejects.toMatchObject({
          name: 'DocumentExtractionError',
          reason: 'corrupt-document',
        })
      })
    })

    describe('registry — LIFO precedence over the txt fallback (§3, §7)', () => {
      it('.docx routes to docx ahead of the txt fallback', async () => {
        const file = await buildDocxFile('report.docx', { documentXml: documentXml([['registry test']]) })
        const result = await extractDocumentText(file)
        expect(result.meta.extractor).toBe('docx')
      })

      it('a text/plain file still routes to txt even with both extractors registered', async () => {
        const file = new File(['plain text content'], 'notes.txt', { type: 'text/plain' })
        const result = await extractDocumentText(file)
        expect(result.meta.extractor).toBe('txt')
      })
    })
  },
)
