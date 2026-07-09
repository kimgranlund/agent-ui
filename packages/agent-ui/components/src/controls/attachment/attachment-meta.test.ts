import { describe, it, expect } from 'vitest'
import { categoryGlyph, categoryLabel, fileCategory, formatBytes } from './attachment-meta.ts'
import type { FileCategory } from './attachment-meta.ts'

// attachment-meta.test.ts — LLD-C4 DOM-free unit probes (SPEC-R9 AC1/AC2): fileCategory, categoryGlyph,
// categoryLabel, formatBytes. Table-driven over the mime/byte space (the chart/stat-family fuzz
// discipline) — every case documented, none may throw.

describe('fileCategory (SPEC-R9 AC1)', () => {
  const rows: [string, FileCategory][] = [
    ['image/png', 'image'],
    ['image/jpeg', 'image'],
    ['audio/mpeg', 'audio'],
    ['video/mp4', 'video'],
    ['application/pdf', 'pdf'],
    ['text/plain', 'text'],
    ['text/markdown', 'text'],
    ['text/csv', 'data'], // the exception: a data type, not a text type
    ['application/json', 'data'],
    ['application/xml', 'data'],
    ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'data'], // "spreadsheet" substring
    ['application/zip', 'archive'],
    ['application/x-tar', 'archive'],
    ['application/gzip', 'archive'],
    ['application/x-7z-compressed', 'archive'],
    ['application/vnd.rar', 'archive'],
    ['application/octet-stream', 'default'],
    ['', 'default'],
    ['   ', 'default'],
    ['IMAGE/PNG; charset=x', 'image'], // case-insensitive + parameters stripped
  ]
  for (const [mime, expected] of rows) {
    it(`"${mime}" → ${expected}`, () => {
      expect(fileCategory(mime)).toBe(expected)
    })
  }

  it('never throws over a fuzz of degenerate inputs', () => {
    for (const v of ['', ' ', ';', 'a/b;c;d', 'no-slash', ';;;;']) {
      expect(() => fileCategory(v)).not.toThrow()
    }
  })
})

describe('categoryGlyph (LLD-C4) — every category maps to a vendored file glyph', () => {
  const rows: [FileCategory, string][] = [
    ['image', 'file-image'],
    ['audio', 'file-audio'],
    ['video', 'file-video'],
    ['pdf', 'file-pdf'],
    ['text', 'file-text'],
    ['archive', 'file-zip'],
    ['data', 'file-code'],
    ['default', 'file'],
  ]
  for (const [cat, glyph] of rows) {
    it(`${cat} → ${glyph}`, () => expect(categoryGlyph(cat)).toBe(glyph))
  }
})

describe('categoryLabel (SPEC-R8 — the name fallback, never an empty title)', () => {
  const rows: [FileCategory, string][] = [
    ['image', 'Image'],
    ['audio', 'Audio'],
    ['video', 'Video'],
    ['pdf', 'PDF document'],
    ['text', 'Text document'],
    ['archive', 'Archive'],
    ['data', 'Data file'],
    ['default', 'File'],
  ]
  for (const [cat, label] of rows) {
    it(`${cat} → "${label}"`, () => expect(categoryLabel(cat)).toBe(label))
  }
})

describe('formatBytes (SPEC-R9 AC2)', () => {
  it('the pinned byte rows', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(999)).toBe('999 B')
    expect(formatBytes(48200)).toBe('48.2 KB')
    expect(formatBytes(5_300_000)).toBe('5.3 MB')
  })

  it('null/non-finite/negative ⇒ null (the cell is absent, never a fabricated string)', () => {
    expect(formatBytes(null)).toBeNull()
    expect(formatBytes(Number.NaN)).toBeNull()
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBeNull()
    expect(formatBytes(-1)).toBeNull()
  })

  it('the TB cap formats the tail — never a 6th unit beyond TB', () => {
    expect(formatBytes(5_300_000_000_000_000)).toBe('5,300 TB')
  })

  it('never throws over a fuzz of degenerate inputs', () => {
    for (const v of [null, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, -0.5, 0]) {
      expect(() => formatBytes(v)).not.toThrow()
    }
  })
})
