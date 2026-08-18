// document-ingest.ts — GH #1211's thin adapter over the REAL extraction seam (GH #1210,
// `@agent-ui/app/document-extraction` + `@agent-ui/app/document-budget`, merged 2026-08-18 as PR #1217).
// This module owns nothing #1210 already owns — it re-exports the real seam's entry points as
// `agent-admin.ts`'s ONE import site, plus exactly the two things #1210 deliberately left for this
// ticket: the per-agent AGGREGATE knowledge-budget check (`MAX_AGENT_KNOWLEDGE_CHARS`,
// document-budget.ts's own header comment names this as "#1211 and beyond"'s job — #1210 has no
// "every entry" input to sum over) and a human-readable file-size formatter for the chip's
// `description` line (a UI-layer concern, not extraction).
//
// Superseded by this rebase: the FIRST version of this file (pre-#1210-merge) carried its own
// duplicate MAX_RAW_BYTES/MAX_EXTRACTED_CHARS/truncateToBudget/UnsupportedDocumentError/
// isSupportedDocument — a placeholder for a seam that wasn't merged yet (dispatch-ticket's own
// converge-at-merge instruction). #1210 landed first; this version consumes it instead of
// duplicating it.

// GH #1215/ADR-0202 — side-effect only: importing this registers the pdf extractor onto the #1210
// registry (`registerDocumentExtractor`, LIFO precedence). This module's own graph carries ZERO static
// `pdfjs-dist` imports (confinement.test.ts) — the library arrives only when a `.pdf` file is actually
// attached, via `pdf-extractor.ts`'s own dynamic `import('./pdf-worker.ts')`. `agent-admin.ts` (this
// module's one consumer) already sits behind the ADR-0197 `loadAgentAdmin()` lazy boundary, so this
// eager-but-pdfjs-free registration never reaches the `@agent-ui/app` root barrel either.
import '../../lib/pdf-extractor.ts'

export { extractDocumentText, DocumentExtractionError } from '../../lib/document-extraction.ts'
export type { ExtractedDocument, ExtractedDocumentMeta, DocumentExtractionErrorReason } from '../../lib/document-extraction.ts'
export { MAX_AGENT_KNOWLEDGE_CHARS, MAX_RAW_FILE_BYTES, MAX_DOCUMENT_CHARS, truncateToBudget } from '../../lib/document-budget.ts'
export type { TruncationResult } from '../../lib/document-budget.ts'

import { MAX_AGENT_KNOWLEDGE_CHARS } from '../../lib/document-budget.ts'

/**
 * req-doc-ingestion.md R6's THIRD budget — the aggregate cap over every ENABLED `resource` entry's
 * own extracted text (document-budget.ts's own comment: "summed across every ENABLED resource
 * entry's extracted text... NOT enforced by this module"). A pure predicate: `existingCharsTotal` is
 * the caller's own sum over its CURRENT enabled resource entries (`agent-admin.ts`'s own read, since
 * this module holds no store access), `newChars` is the incoming document's own extracted length.
 * Checked at the MINT point (before a new doc joins the store) — the natural, and only, place this
 * cap can be enforced, since it is defined over the whole roster, not one document.
 */
export function exceedsAgentKnowledgeBudget(existingCharsTotal: number, newChars: number): boolean {
  return existingCharsTotal + newChars > MAX_AGENT_KNOWLEDGE_CHARS
}

/** A human-readable file size for the chip's `description` line (`ContextItem.description`, GH #1211) —
 *  B/KB/MB, one decimal past the first tier, never a fractional byte count. Not `#1210`'s concern
 *  (it never renders a chip) — a UI-layer formatter, kept here beside the ingest handler that uses it. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
