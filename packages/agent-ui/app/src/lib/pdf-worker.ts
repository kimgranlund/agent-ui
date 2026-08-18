// pdf-worker.ts — ADR-0202's ONE designated lazy-load module: the sole place in the repo permitted a
// static `pdfjs-dist` import (confinement.test.ts; the ADR-0139 cl.8b shape, one module for one dep).
// Reached ONLY via `pdf-extractor.ts`'s dynamic `import('./pdf-worker.ts')` on the first `.pdf` attach —
// this module is never statically imported by anything (mirroring `cm-editor.ts`'s own reachability
// law). The worker asset rides Vite's `?url` asset-URL handling (`vite/client`'s own `declare module
// '*?url'`, already in this repo's `types` array) — same-origin, no CDN, works identically in `vite
// build` and the dev/test server (ADR-0202 cl.3).
//
// Text-only extraction (ADR-0202 cl.5): `page.getTextContent()` per page, joined; no canvas render, no
// OCR. An image-only PDF (empty text on every page) is reported via `NO_TEXT` — the caller (
// `pdf-extractor.ts`) turns that into the honest `DocumentExtractionError('no-text-layer')` state,
// never a silent empty string.

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
// eslint-disable-next-line import/no-unresolved -- Vite's `?url` asset-URL convention (vite/client.d.ts)
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

/** A discriminated result — `pdf-extractor.ts` turns `{ noText: true }` into the honest
 *  `DocumentExtractionError('no-text-layer')` state (ADR-0202 cl.5 / req-doc-ingestion.md Non-goals)
 *  rather than minting an empty resource entry. A plain tagged object (not a sentinel symbol) so the
 *  discriminant survives a value crossing the dynamic-`import()` module boundary with no narrowing
 *  surprises. */
export type PdfTextResult = { noText: true } | { noText: false; text: string }

/** Extract every page's text content and join it page-by-page (blank line between pages). Returns
 *  `{ noText: true }` when every page yielded no text at all (an image-only / scanned PDF) — the
 *  extraction ITSELF succeeded, there is simply no text layer to recover (never an error in that case). */
export async function extractPdfText(file: File): Promise<PdfTextResult> {
  const data = await file.arrayBuffer()
  const loadingTask = getDocument({ data })
  try {
    const doc = await loadingTask.promise
    const pageTexts: string[] = []
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum)
      try {
        const content = await page.getTextContent()
        const pageText = content.items.map((item) => ('str' in item ? item.str : '')).join('')
        pageTexts.push(pageText)
      } finally {
        page.cleanup()
      }
    }
    await doc.cleanup()
    const joined = pageTexts.join('\n\n').trim()
    return joined === '' ? { noText: true } : { noText: false, text: joined }
  } finally {
    await loadingTask.destroy()
  }
}
