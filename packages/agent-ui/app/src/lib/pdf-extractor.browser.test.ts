// pdf-extractor.browser.test.ts — GH #1215/ADR-0202: the REAL round trip (file → extracted text),
// browser-gated (both engines) per the ADR's own testing law — mirroring ADR-0139 cl.5's
// "jsdom is blind to the [dependency] path" shape: pdf.js's default build reaches browser-only globals
// (`DOMMatrix` et al.) at module scope, so unlike the txt/md extractor this genuinely cannot run under
// jsdom (verified: a plain Node/jsdom import of `pdfjs-dist`'s default build throws
// `DOMMatrix is not defined` before any of this module's own code runs) — the plain-module contract
// (registration + type-claim, `pdf-extractor.test.ts`) is the jsdom-testable surface; the real worker
// load + parse is a browser-leg obligation, proven here.
import { describe, it, expect } from 'vitest'
import { extractDocumentText, __testResetRegistry, registerDocumentExtractor, textExtractor } from './document-extraction.ts'
import { pdfExtractor } from './pdf-extractor.ts'
import { buildMinimalPdf, buildNoTextPdf } from './pdf-fixture.ts'

describe('pdf-extractor — the real pdf.js round trip (ADR-0202, browser-gated both engines)', () => {
  it('extracts real text from a hand-built single-page PDF (worker loads same-origin, no CDN)', async () => {
    __testResetRegistry()
    registerDocumentExtractor(textExtractor)
    registerDocumentExtractor(pdfExtractor)

    const bytes = buildMinimalPdf('Hello PDF extraction')
    const file = new File([bytes], 'hello.pdf', { type: 'application/pdf' })
    const result = await extractDocumentText(file)

    expect(result.text).toContain('Hello PDF extraction')
    expect(result.meta.extractor).toBe('pdf')
    expect(result.meta.truncated).toBe(false)
  })

  it('claims a .pdf file with a blank/absent MIME type by extension alone (a real drag-drop can omit it)', async () => {
    __testResetRegistry()
    registerDocumentExtractor(textExtractor)
    registerDocumentExtractor(pdfExtractor)

    const bytes = buildMinimalPdf('extension-only claim')
    const file = new File([bytes], 'report.pdf', { type: '' })
    const result = await extractDocumentText(file)

    expect(result.text).toContain('extension-only claim')
    expect(result.meta.extractor).toBe('pdf')
  })

  it('an image-only PDF (no text-showing operator at all) surfaces the honest no-text-layer reason, never a silent empty result', async () => {
    __testResetRegistry()
    registerDocumentExtractor(textExtractor)
    registerDocumentExtractor(pdfExtractor)

    const bytes = buildNoTextPdf()
    const file = new File([bytes], 'scanned.pdf', { type: 'application/pdf' })
    await expect(extractDocumentText(file)).rejects.toMatchObject({
      name: 'DocumentExtractionError',
      reason: 'no-text-layer',
    })
  })
})
