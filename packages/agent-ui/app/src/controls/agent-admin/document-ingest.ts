// document-ingest.ts — GH #1211's minimal consuming interface over the extraction seam GH #1210
// (`extractDocumentText`, req-doc-ingestion.md R2/R6) is building in parallel. #1210 was not yet merged
// when this ticket needed it (dispatch-ticket's own converge-at-merge instruction), so this module
// defines the SHAPE this ticket's composer→entry path consumes — `ExtractedDocument`/
// `ExtractDocumentText` — and wires the ONE extractor #1210's own R2 rules zero-dep anyway: `File.text()`
// for `.md`/`.txt` (+ any `text/*` MIME, R1's "plus any text/* treated as txt" clause). Docx/pdf stay
// UNSUPPORTED here (`isSupportedDocument` rejects them) — #1210 (docx) and the still-to-be-ADR'd pdf.js
// exception (R3) land their own extractors behind this SAME interface; nothing downstream of it
// (`agent-admin.ts`'s ingest handler) needs to change shape when they do. Converges with #1210 at merge:
// whichever PR merges second re-points this module's txt/md branch (or is superseded by it wholesale) —
// the shape (`ExtractDocumentText`, the budget constants, `isSupportedDocument`) is the real contract.
//
// Pure data/logic only, zero DOM beyond the `File`/`Blob` platform API — no store, no `Entry`, no kind
// semantics (the SAME layering law `entries.ts` states for itself): this module answers "what text is in
// this file", never "what agent-knowledge object should this become" — `agent-admin.ts` owns that step.

/** req-doc-ingestion.md R1 — the MIME types and extensions this build's inline (txt/md) branch accepts.
 *  Any `text/*` MIME is treated as text (R1's "plus any text/*" clause) whether or not its extension is
 *  also listed, so a server/OS that mislabels a `.log` as `text/plain` still round-trips. */
const SUPPORTED_MIME_TYPES = new Set(['text/plain', 'text/markdown', 'text/csv', 'application/json'])
const SUPPORTED_EXTENSIONS = ['.md', '.txt', '.json', '.csv']

/** `true` iff this build knows how to extract `file` — the fail-closed gate `agent-admin.ts`'s ingest
 *  handler checks BEFORE calling `extractDocumentText` at all, so an unsupported type (a `.docx` before
 *  #1210 lands, a `.pdf` before R3's ADR ratifies, an image, anything else) is rejected with a visible
 *  reason instead of a silent drop or a thrown extraction error (req-doc-ingestion.md R1 AC). */
export function isSupportedDocument(file: File): boolean {
  if (file.type.startsWith('text/')) return true
  if (SUPPORTED_MIME_TYPES.has(file.type)) return true
  const name = file.name.toLowerCase()
  return SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext))
}

/** req-doc-ingestion.md R6 — the hard caps, one module, both named after the requirement's own figures.
 *  `MAX_RAW_BYTES` gates the round-trip before any extraction work runs; `MAX_EXTRACTED_CHARS` gates the
 *  RESULT (a small file can still explode into more text than this after decoding, in principle — the
 *  cap is on the text a resource entry actually carries, not the source file). */
export const MAX_RAW_BYTES = 10 * 1024 * 1024 // 10MB per file
export const MAX_EXTRACTED_CHARS = 50_000 // ~12k tokens per doc

/** R6's honest-degradation marker — appended verbatim when a text is head-truncated, so the truncation is
 *  visible wherever the text lands (the resource entry's own content, and therefore the composed prompt
 *  too) rather than silently cut. */
export function truncationMarker(totalChars: number): string {
  return `…[truncated: ${MAX_EXTRACTED_CHARS} of ${totalChars} chars]`
}

/** Head-truncate `text` to `MAX_EXTRACTED_CHARS`, appending `truncationMarker` when it actually cut
 *  anything. A `text` at or under the budget is returned byte-identically (no marker, no copy beyond the
 *  one this function's caller already made). */
export function truncateToBudget(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_EXTRACTED_CHARS) return { text, truncated: false }
  return { text: text.slice(0, MAX_EXTRACTED_CHARS) + truncationMarker(text.length), truncated: true }
}

/** One extracted document — the shape `agent-admin.ts`'s ingest handler consumes, whichever extractor
 *  produced it (this module's inline txt/md branch today; #1210's docx reader, a future pdf.js extractor,
 *  behind the SAME interface tomorrow). */
export interface ExtractedDocument {
  text: string
  meta: {
    name: string
    /** The ORIGINAL file's byte size (for the chip's "size" display) — never the extracted text's own
     *  length, which `text.length` already gives a caller directly. */
    size: number
    truncated: boolean
  }
}

/** The extractor function shape every per-type implementation realizes (req-doc-ingestion.md R2) —
 *  `agent-admin.ts` calls this ONE signature regardless of which branch actually ran. */
export type ExtractDocumentText = (file: File) => Promise<ExtractedDocument>

/** Thrown when `file` fails a hard precondition (over the raw-byte cap, or a type `isSupportedDocument`
 *  did not clear) — `agent-admin.ts` catches this to drive the rejection toast, never a generic error. */
export class UnsupportedDocumentError extends Error {}

/**
 * req-doc-ingestion.md R2 — the inline txt/md extractor: `File.text()`, zero dep, then R6's budget cap.
 * Callers MUST check `isSupportedDocument(file)` first (this function does not re-check the type — the
 * caller already branched on it to reach here, and re-checking would just be a second copy of the same
 * rule to keep in sync).
 *
 * AC: a file at or under `MAX_RAW_BYTES` round-trips to its full text (truncated only past
 * `MAX_EXTRACTED_CHARS`, R6's marker appended visibly); a file over `MAX_RAW_BYTES` rejects before
 * `File.text()` ever runs, so a huge file is never even read into memory.
 */
export async function extractDocumentText(file: File): Promise<ExtractedDocument> {
  if (file.size > MAX_RAW_BYTES) {
    throw new UnsupportedDocumentError(`"${file.name}" is too large to attach (over ${Math.round(MAX_RAW_BYTES / (1024 * 1024))}MB).`)
  }
  const raw = await file.text()
  const { text, truncated } = truncateToBudget(raw)
  return { text, meta: { name: file.name, size: file.size, truncated } }
}

/** A human-readable file size for the chip's `description` line (`ContextItem.description`, GH #1211) —
 *  B/KB/MB, one decimal past the first tier, never a fractional byte count. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
