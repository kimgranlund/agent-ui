import { describe, it, expect, afterEach } from 'vitest'
import {
  DocumentExtractionError,
  __testResetRegistry,
  extractDocumentText,
  registerDocumentExtractor,
  textExtractor,
} from './document-extraction.ts'
import { MAX_DOCUMENT_CHARS, MAX_RAW_FILE_BYTES } from './document-budget.ts'

// Every test that mutates the registry restores the shipped default afterward, so file order never
// leaks a probe extractor into a later test.
afterEach(() => {
  __testResetRegistry()
  registerDocumentExtractor(textExtractor)
})

describe('extractDocumentText — txt/md round trip (R1/R2)', () => {
  it('extracts a .txt file via File.text()', async () => {
    const file = new File(['hello from a plain text file'], 'notes.txt', { type: 'text/plain' })
    const result = await extractDocumentText(file)
    expect(result.text).toBe('hello from a plain text file')
    expect(result.meta).toEqual({
      fileName: 'notes.txt',
      mimeType: 'text/plain',
      extractor: 'txt',
      truncated: false,
      rawBytes: file.size,
      originalChars: 'hello from a plain text file'.length,
    })
  })

  it('extracts a .md file the same way', async () => {
    const file = new File(['# Heading\n\nSome body text.'], 'README.md', { type: 'text/markdown' })
    const result = await extractDocumentText(file)
    expect(result.text).toBe('# Heading\n\nSome body text.')
    expect(result.meta.extractor).toBe('txt')
    expect(result.meta.truncated).toBe(false)
  })

  it('R1: any text/* MIME type round-trips as txt even with an unmapped extension', async () => {
    const file = new File(['a,b,c\n1,2,3'], 'data.csv', { type: 'text/csv' })
    const result = await extractDocumentText(file)
    expect(result.text).toBe('a,b,c\n1,2,3')
    expect(result.meta.extractor).toBe('txt')
  })

  it('claims .txt/.md by extension even with no/blank MIME type (a real drag-drop can omit it)', async () => {
    const file = new File(['content'], 'notes.txt', { type: '' })
    const result = await extractDocumentText(file)
    expect(result.text).toBe('content')
  })
})

describe('extractDocumentText — R6 budgets', () => {
  it('rejects a file over MAX_RAW_FILE_BYTES BEFORE any extractor runs', async () => {
    const oversized = new File([new Uint8Array(MAX_RAW_FILE_BYTES + 1)], 'huge.txt', { type: 'text/plain' })
    await expect(extractDocumentText(oversized)).rejects.toMatchObject({
      reason: 'too-large',
      name: 'DocumentExtractionError',
    })
  })

  it('accepts a file exactly at MAX_RAW_FILE_BYTES (boundary, not off-by-one)', async () => {
    const atLimit = new File([new Uint8Array(MAX_RAW_FILE_BYTES)], 'exact.txt', { type: 'text/plain' })
    const result = await extractDocumentText(atLimit)
    expect(result.meta.rawBytes).toBe(MAX_RAW_FILE_BYTES)
  })

  it('head-truncates extracted text over MAX_DOCUMENT_CHARS with a visible marker, never silently', async () => {
    const longText = 'a'.repeat(MAX_DOCUMENT_CHARS + 500)
    const file = new File([longText], 'long.txt', { type: 'text/plain' })
    const result = await extractDocumentText(file)
    expect(result.text.length).toBeLessThanOrEqual(MAX_DOCUMENT_CHARS)
    expect(result.text).toContain('…[truncated:')
    expect(result.meta.truncated).toBe(true)
    expect(result.meta.originalChars).toBe(MAX_DOCUMENT_CHARS + 500)
  })

  it('does not truncate text exactly at MAX_DOCUMENT_CHARS', async () => {
    const exactText = 'b'.repeat(MAX_DOCUMENT_CHARS)
    const file = new File([exactText], 'exact.txt', { type: 'text/plain' })
    const result = await extractDocumentText(file)
    expect(result.text).toBe(exactText)
    expect(result.meta.truncated).toBe(false)
  })
})

describe('extractDocumentText — unsupported type (R1: visible reason, never a silent drop)', () => {
  it('rejects a file no registered extractor claims', async () => {
    __testResetRegistry() // the docx/pdf extractors don't exist yet this ticket — simulate "nothing claims it"
    const file = new File(['\x89PNG'], 'photo.png', { type: 'image/png' })
    await expect(extractDocumentText(file)).rejects.toMatchObject({
      reason: 'unsupported-type',
      name: 'DocumentExtractionError',
    })
  })

  it('DocumentExtractionError is a real Error subclass carrying a typed reason', async () => {
    __testResetRegistry()
    const file = new File(['x'], 'photo.png', { type: 'image/png' })
    try {
      await extractDocumentText(file)
      expect.unreachable('extractDocumentText should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(DocumentExtractionError)
      expect(err).toBeInstanceOf(Error)
      expect((err as DocumentExtractionError).reason).toBe('unsupported-type')
    }
  })
})

describe('registerDocumentExtractor — the pluggable registry seam docx/pdf will use (#1214/#1215)', () => {
  it('a later-registered extractor takes precedence over an earlier one for files it also claims', async () => {
    const stub = {
      name: 'stub-docx',
      test: (file: File) => file.name.endsWith('.docx'),
      run: async () => 'stub-extracted-text',
    }
    registerDocumentExtractor(stub)
    const file = new File(['irrelevant raw bytes'], 'report.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    const result = await extractDocumentText(file)
    expect(result.text).toBe('stub-extracted-text')
    expect(result.meta.extractor).toBe('stub-docx')
  })

  it('registering a new extractor never disturbs the existing txt/md extractor for its own files', async () => {
    registerDocumentExtractor({ name: 'stub-docx', test: (f) => f.name.endsWith('.docx'), run: async () => 'x' })
    const file = new File(['still plain text'], 'notes.txt', { type: 'text/plain' })
    const result = await extractDocumentText(file)
    expect(result.text).toBe('still plain text')
    expect(result.meta.extractor).toBe('txt')
  })
})
