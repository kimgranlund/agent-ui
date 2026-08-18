// pdf-extractor.ts — GH #1215, ADR-0202: the pdf `DocumentExtractor` registered onto the #1210 seam
// (`document-extraction.ts`'s `registerDocumentExtractor`). This module's own top-level graph carries
// ZERO static `pdfjs-dist` imports (confinement.test.ts) — mirroring `@agent-ui/code/editor`'s
// `editor.ts` (ADR-0139 cl.5/cl.8b): the library (and its worker) arrive via a dynamic
// `import('./pdf-worker.ts')` fired only on the first `.pdf` file this extractor's own `run()` is asked
// to handle, never merely on module load/registration. A 10s load-timeout ceiling (the same ADR-0139
// cl.5 gen-ui-kit-proven ceiling `ui-code-editor` uses for its own lazy CM import) guards against a
// stalled chunk load; failure surfaces as an ordinary thrown error, which `extractDocumentText`'s own
// caller (`agent-admin.ts`'s `#handleAttach`) already turns into a visible toast (never a silent drop).

import { registerDocumentExtractor, DocumentExtractionError } from './document-extraction.ts'
import type { DocumentExtractor } from './document-extraction.ts'

const PDF_LOAD_TIMEOUT_MS = 10_000 // ADR-0139 cl.5's ceiling, reused verbatim for this ADR-0202 exception

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase()
}

/** Race a loader against a timeout — byte-for-byte the same shape as `ui-code-editor`'s own
 *  `importWithTimeout` (ADR-0139 cl.5), duplicated rather than cross-imported: `@agent-ui/code` sits
 *  beside `@agent-ui/app` on the DAG (neither imports the other), and this is a five-line pure utility,
 *  not a shared contract worth a new cross-package edge over. */
function importWithTimeout<T>(loader: () => Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('pdf-extractor: pdf.js load timed out')), ms)
  })
  return Promise.race([loader().finally(() => clearTimeout(timer)), timeout])
}

export const pdfExtractor: DocumentExtractor = {
  name: 'pdf',
  test(file) {
    return extensionOf(file.name) === 'pdf' || file.type === 'application/pdf'
  },
  async run(file) {
    const { extractPdfText } = await importWithTimeout(() => import('./pdf-worker.ts'), PDF_LOAD_TIMEOUT_MS)
    const result = await extractPdfText(file)
    if (result.noText) {
      throw new DocumentExtractionError(
        `"${file.name}" has no extractable text (an image-only/scanned PDF) — no OCR is performed.`,
        'no-text-layer',
      )
    }
    return result.text
  },
}

registerDocumentExtractor(pdfExtractor)
