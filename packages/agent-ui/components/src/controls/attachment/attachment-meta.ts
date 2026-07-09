// attachment-meta.ts — the pure, DOM-free math for `ui-attachment` (LLD-C4, feed-family.lld.md §4;
// SPEC-R8/R9; ADR-0112 cl.4). Plain functions over strings/numbers — no DOM, no signals, unit-testable
// without a browser (the stat-model.ts / sparkline-math.ts pure-core precedent).
//
// `fileCategory` (SPEC-R9 AC1): case-insensitive, `;`-parameter-stripped mimeType → one of eight
// categories. Exact/substring matches (`application/pdf`; the data-shaped types — json/xml/csv/
// spreadsheet) are checked BEFORE the broad `image/`·`audio/`·`video/`·`text/` prefixes, because
// `text/csv` is a data type, not a text type — an ordering the prefix pass alone cannot express. The
// archive set follows, then `default` — a TOTAL function, never throws, unknown/empty mime included.
//
// `categoryGlyph`/`categoryLabel` (LLD-C4): the fixed per-category icon-name and name-fallback maps.
//
// `formatBytes` (SPEC-R9 AC2): `size` (bytes) → a decimal (1000-based) B/KB/MB/GB/TB string via the
// module-memoized default-locale `Intl.NumberFormat` (≤ 1 fraction digit); `null`/non-finite/negative →
// `null` (the size cell is absent, never a fabricated "0 B" or "NaN B").

import type { IconName } from '@agent-ui/icons'

export type FileCategory = 'image' | 'audio' | 'video' | 'pdf' | 'text' | 'archive' | 'data' | 'default'

/** Data-shaped mimeTypes that are NOT read as their broad prefix (SPEC-R9 AC1: `text/csv` → data, not text). */
const DATA_EXACT = new Set(['application/json', 'application/xml', 'text/xml'])
/** A mimeType containing either substring is data-shaped (spreadsheet formats, any `csv` variant). */
const DATA_SUBSTRING = /spreadsheet|csv/
/** Archive/compression formats (LLD-C4: zip|tar|gzip|x-7z|rar). */
const ARCHIVE_MATCH = /zip|tar|gzip|x-7z|rar/

/** SPEC-R9 AC1 — case-insensitive, `;`-parameter-stripped, TOTAL (unknown/empty → 'default'). */
export function fileCategory(mimeType: string): FileCategory {
  const mime = mimeType.trim().split(';', 1)[0]!.trim().toLowerCase()
  if (mime === '') return 'default'
  if (mime === 'application/pdf') return 'pdf'
  if (DATA_EXACT.has(mime) || DATA_SUBSTRING.test(mime)) return 'data'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('text/')) return 'text'
  if (ARCHIVE_MATCH.test(mime)) return 'archive'
  return 'default'
}

/** The glyph name per category (all vendored, SPEC-N5 — LLD-C9's icons PREP slice). */
const CATEGORY_GLYPH: Record<FileCategory, IconName> = {
  image: 'file-image',
  audio: 'file-audio',
  video: 'file-video',
  pdf: 'file-pdf',
  text: 'file-text',
  archive: 'file-zip',
  data: 'file-code',
  default: 'file',
}
export function categoryGlyph(c: FileCategory): IconName {
  return CATEGORY_GLYPH[c]
}

/** The SPEC-R8 name fallback (never an empty title). */
const CATEGORY_LABEL: Record<FileCategory, string> = {
  image: 'Image',
  audio: 'Audio',
  video: 'Video',
  pdf: 'PDF document',
  text: 'Text document',
  archive: 'Archive',
  data: 'Data file',
  default: 'File',
}
export function categoryLabel(c: FileCategory): string {
  return CATEGORY_LABEL[c]
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const
const byteFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }) // module-memoized

/** SPEC-R9 AC2 — null/non-finite/negative → null (cell absent). Decimal (1000-based) B/KB/MB/GB/TB steps. */
export function formatBytes(size: number | null): string | null {
  if (size === null || !Number.isFinite(size) || size < 0) return null
  let value = size
  let unit = 0
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000
    unit++
  }
  return `${byteFormat.format(value)} ${UNITS[unit]}`
}
