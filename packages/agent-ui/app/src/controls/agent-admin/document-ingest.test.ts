import { describe, it, expect } from 'vitest'
import {
  isSupportedDocument,
  extractDocumentText,
  truncateToBudget,
  truncationMarker,
  formatFileSize,
  UnsupportedDocumentError,
  MAX_RAW_BYTES,
  MAX_EXTRACTED_CHARS,
} from './document-ingest.ts'

// document-ingest.ts — GH #1211's minimal consuming interface over the extraction seam #1210 is building
// in parallel (req-doc-ingestion.md R1/R2/R6). These tests cover the SHAPE this ticket owns: the
// supported-type gate, the inline txt/md extractor, and the budget/truncation module — the docx/pdf
// extractors #1210/R3 land behind this same interface are out of scope here.

function textFile(name: string, content: string, type = 'text/plain'): File {
  return new File([content], name, { type })
}

describe('isSupportedDocument — req-doc-ingestion.md R1', () => {
  it('accepts any text/* MIME regardless of extension', () => {
    expect(isSupportedDocument(textFile('notes.log', 'hi', 'text/plain'))).toBe(true)
    expect(isSupportedDocument(textFile('readme', 'hi', 'text/markdown'))).toBe(true)
  })

  it('accepts the named extensions even with a generic/absent MIME', () => {
    expect(isSupportedDocument(textFile('a.md', 'hi', ''))).toBe(true)
    expect(isSupportedDocument(textFile('a.txt', 'hi', ''))).toBe(true)
    expect(isSupportedDocument(textFile('a.json', 'hi', ''))).toBe(true)
    expect(isSupportedDocument(textFile('a.csv', 'hi', ''))).toBe(true)
    expect(isSupportedDocument(textFile('A.MD', 'hi', ''))).toBe(true) // case-insensitive
  })

  it('rejects an unrecognized type — docx/pdf/images stay unsupported until their own extractors land', () => {
    expect(isSupportedDocument(textFile('report.docx', 'x', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).toBe(
      false,
    )
    expect(isSupportedDocument(textFile('scan.pdf', 'x', 'application/pdf'))).toBe(false)
    expect(isSupportedDocument(textFile('photo.png', 'x', 'image/png'))).toBe(false)
  })
})

describe('extractDocumentText — R2 inline txt/md branch', () => {
  it('round-trips a small file to its full text, untruncated', async () => {
    const file = textFile('notes.md', '# Hello\n\nSome notes.')
    const result = await extractDocumentText(file)
    expect(result.text).toBe('# Hello\n\nSome notes.')
    expect(result.meta).toEqual({ name: 'notes.md', size: file.size, truncated: false })
  })

  it('R6 — rejects a file over MAX_RAW_BYTES before ever reading it', async () => {
    const oversized = new File([new Uint8Array(MAX_RAW_BYTES + 1)], 'huge.txt', { type: 'text/plain' })
    await expect(extractDocumentText(oversized)).rejects.toThrow(UnsupportedDocumentError)
  })

  it('R6 — a file at exactly MAX_RAW_BYTES is accepted (the cap is inclusive), not rejected', async () => {
    const atCap = new File([new Uint8Array(MAX_RAW_BYTES)], 'atcap.txt', { type: 'text/plain' })
    await expect(extractDocumentText(atCap)).resolves.toMatchObject({ meta: { name: 'atcap.txt', size: MAX_RAW_BYTES } })
  })

  it('R6 — extracted text past MAX_EXTRACTED_CHARS is head-truncated with the visible marker', async () => {
    const long = 'x'.repeat(MAX_EXTRACTED_CHARS + 500)
    const file = textFile('long.txt', long)
    const result = await extractDocumentText(file)
    expect(result.meta.truncated).toBe(true)
    expect(result.text.startsWith('x'.repeat(MAX_EXTRACTED_CHARS))).toBe(true)
    expect(result.text).toContain(`truncated: ${MAX_EXTRACTED_CHARS} of ${long.length} chars`)
  })
})

describe('truncateToBudget / truncationMarker', () => {
  it('returns the text byte-identically when at or under the budget (no marker appended)', () => {
    const short = 'hello'
    expect(truncateToBudget(short)).toEqual({ text: short, truncated: false })
  })

  it('the marker names both the cap and the original total', () => {
    expect(truncationMarker(12_345)).toBe(`…[truncated: ${MAX_EXTRACTED_CHARS} of 12345 chars]`)
  })
})

describe('formatFileSize', () => {
  it('renders bytes, KB, and MB tiers', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(2048)).toBe('2.0 KB')
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
