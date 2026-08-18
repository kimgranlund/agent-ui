// pdf-extractor.test.ts — GH #1215/ADR-0202's jsdom-testable surface: registration onto the #1210 seam
// and the `test()` type-claim predicate. jsdom is deliberately BLIND to the real pdf.js path here, the
// same shape ADR-0139 cl.5 ruled for CodeMirror ("jsdom is blind to the CM path... browser-leg
// obligations") — pdf.js's default build reaches browser-only globals (`DOMMatrix` et al.) the moment
// its module graph evaluates, so this file never calls `run()`; the real round trip is
// `pdf-extractor.browser.test.ts` (both engines).
import { describe, it, expect, afterEach } from 'vitest'
import { __testResetRegistry, extractDocumentText, registerDocumentExtractor, textExtractor } from './document-extraction.ts'
import { pdfExtractor } from './pdf-extractor.ts'

afterEach(() => {
  __testResetRegistry()
  registerDocumentExtractor(textExtractor)
})

describe('pdfExtractor — registration + type-claim (the jsdom-safe surface, ADR-0202)', () => {
  it('registers itself onto the shared #1210 registry merely by being imported', async () => {
    __testResetRegistry()
    // Nothing registered pdf back yet in this reset registry — re-register exactly what the module's own
    // side effect already did at first import (imports are cached; the side effect ran once, at module
    // load, before this test file's own top-level pdfExtractor import even executed this test body).
    registerDocumentExtractor(pdfExtractor)
    const file = new File(['%PDF-1.4 stub bytes, never parsed by this test'], 'x.pdf', { type: 'application/pdf' })
    // No registered extractor throws 'unsupported-type' for a .pdf file — proves pdf IS claimed, without
    // ever invoking pdf.js's own `run()` (that would need the real browser leg).
    await expect(extractDocumentText(file)).rejects.not.toMatchObject({ reason: 'unsupported-type' })
  })

  it('test(file) claims by .pdf extension even with a blank/absent MIME type', () => {
    expect(pdfExtractor.test(new File(['x'], 'report.pdf', { type: '' }))).toBe(true)
    expect(pdfExtractor.test(new File(['x'], 'REPORT.PDF', { type: '' }))).toBe(true) // case-insensitive extension
  })

  it('test(file) claims by application/pdf MIME type even with an unmapped extension', () => {
    expect(pdfExtractor.test(new File(['x'], 'weird-name', { type: 'application/pdf' }))).toBe(true)
  })

  it('test(file) does NOT claim an unrelated type', () => {
    expect(pdfExtractor.test(new File(['x'], 'notes.txt', { type: 'text/plain' }))).toBe(false)
    expect(pdfExtractor.test(new File(['x'], 'photo.png', { type: 'image/png' }))).toBe(false)
  })

  it('carries the stable diagnostic name "pdf" (ExtractedDocumentMeta.extractor)', () => {
    expect(pdfExtractor.name).toBe('pdf')
  })
})
