// document-extraction.ts — the extractDocumentText(file) seam (req-doc-ingestion R2, GH #1210): ONE pure,
// async entry point over a pluggable per-TYPE extractor REGISTRY. #1210 shipped the txt/md extractor;
// docx (GH #1214) and pdf (GH #1215, ADR-gated) register their own extractors from their own modules by
// calling `registerDocumentExtractor` — the registry itself needed no change for either to land, only a
// widened `DocumentExtractionErrorReason` union each contributed its own member to, which is the whole
// point of the seam being a registry rather than a hardcoded switch.

import { MAX_DOCUMENT_CHARS, MAX_RAW_FILE_BYTES, truncateToBudget } from './document-budget.ts'

export interface ExtractedDocumentMeta {
  fileName: string
  mimeType: string
  /** The registered extractor's own name (e.g. `'txt'`) — diagnostics only; a caller never branches on
   *  it (R2's layering law: callers see text + meta, not extractor identity). */
  extractor: string
  /** `true` iff `text` was head-truncated to fit `MAX_DOCUMENT_CHARS` (the visible marker is already
   *  appended to `text` itself — this flag is for a caller that wants to render a truncated-state
   *  affordance without re-parsing the marker string). */
  truncated: boolean
  /** The raw file size in bytes, before extraction. */
  rawBytes: number
  /** The extracted text's length BEFORE truncation (chars). */
  originalChars: number
}

export interface ExtractedDocument {
  /** The extracted (and possibly budget-truncated) text — always `<= MAX_DOCUMENT_CHARS` in length. */
  text: string
  meta: ExtractedDocumentMeta
}

/** `'too-large'` — `file.size` exceeded `MAX_RAW_FILE_BYTES`, checked before any extractor runs.
 *  `'unsupported-type'` — no registered extractor claimed the file. `'no-text-layer'` — an extractor DID
 *  claim and successfully parse the file, but recovered no text at all (GH #1215/ADR-0202 cl.5's own
 *  case: an image-only PDF with no embedded text layer) — extraction succeeded, there is simply nothing
 *  to mint. `'corrupt-document'` — an extractor DID claim the file but its bytes don't deliver (GH #1214:
 *  malformed zip/XML, encrypted, unsupported compression method, etc — format-generic on purpose so a
 *  further extractor reuses it instead of minting a further member). All four fail VISIBLY (R1: "an
 *  unsupported type is rejected at the chip with a visible reason, never a silent drop") — a caller
 *  branches on `reason`, never re-parses `message`. */
export type DocumentExtractionErrorReason = 'too-large' | 'unsupported-type' | 'no-text-layer' | 'corrupt-document'

export class DocumentExtractionError extends Error {
  readonly reason: DocumentExtractionErrorReason
  constructor(message: string, reason: DocumentExtractionErrorReason) {
    super(message)
    this.name = 'DocumentExtractionError'
    this.reason = reason
  }
}

/**
 * One registered extractor: `test` claims a `File` (by extension and/or MIME type); `run` does the
 * actual extraction, returning the RAW (pre-budget) text. Precedence is registration order — see
 * `registerDocumentExtractor`.
 */
export interface DocumentExtractor {
  /** A short, stable name surfaced in `ExtractedDocumentMeta.extractor` (diagnostics only). */
  name: string
  test(file: File): boolean
  run(file: File): Promise<string>
}

const registry: DocumentExtractor[] = []

/**
 * Register `extractor`, taking precedence over every extractor already registered — the most recently
 * registered `test` is tried FIRST (LIFO). This lets a later, more specific extractor (docx/pdf,
 * #1214/#1215) simply register itself after import without needing to know about — or reorder — the
 * txt/md fallback that ships in this ticket; the broader fallback never has to be the last word by
 * accident.
 */
export function registerDocumentExtractor(extractor: DocumentExtractor): void {
  registry.unshift(extractor)
}

/** Test-only: clears every registered extractor (including the built-in txt/md one) so a test can probe
 *  the "no extractor claims this file" branch deterministically, then re-register afterward. Exported
 *  under a `__test` prefix so it reads as exactly what it is — never a production entry point. */
export function __testResetRegistry(): void {
  registry.length = 0
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase()
}

/** The txt/md extractor (R2): native `File.text()` — zero dependency, no manual chunking (the browser
 *  already reads it off the main thread). Claims `.txt`/`.md` by extension, plus any `text/*` MIME type
 *  (R1: "any `text/*` treated as txt") so a browser-supplied `.csv`/`.json`/etc. still round-trips
 *  instead of falling through to "unsupported". */
export const textExtractor: DocumentExtractor = {
  name: 'txt',
  test(file) {
    const ext = extensionOf(file.name)
    return ext === 'txt' || ext === 'md' || file.type.startsWith('text/')
  },
  async run(file) {
    return file.text()
  },
}

registerDocumentExtractor(textExtractor)

/**
 * Extract `file`'s text, budget-checked at both ends (R6): the RAW-size cap runs BEFORE any extractor is
 * invoked (`DocumentExtractionError('too-large')`), and the EXTRACTED text is head-truncated to
 * `MAX_DOCUMENT_CHARS` with a visible marker (never silent) after extraction succeeds. No registered
 * extractor claims the file → `DocumentExtractionError('unsupported-type')` — the txt/md extractor ships
 * on this seam directly; docx (#1214) and pdf (#1215) register their own extractors from their own
 * modules, and this function needed no change for either.
 */
export async function extractDocumentText(file: File): Promise<ExtractedDocument> {
  if (file.size > MAX_RAW_FILE_BYTES) {
    throw new DocumentExtractionError(
      `"${file.name}" is ${file.size} bytes, over the ${MAX_RAW_FILE_BYTES}-byte per-file limit.`,
      'too-large',
    )
  }
  const extractor = registry.find((candidate) => candidate.test(file))
  if (extractor === undefined) {
    throw new DocumentExtractionError(
      `"${file.name}" (${file.type || 'unknown type'}) has no registered extractor.`,
      'unsupported-type',
    )
  }
  const raw = await extractor.run(file)
  const { text, truncated, originalChars } = truncateToBudget(raw, MAX_DOCUMENT_CHARS)
  return {
    text,
    meta: {
      fileName: file.name,
      mimeType: file.type,
      extractor: extractor.name,
      truncated,
      rawBytes: file.size,
      originalChars,
    },
  }
}
