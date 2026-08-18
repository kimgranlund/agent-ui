// document-extraction-docx.ts — GH #1214: a zero-dep docx extractor registering on the #1210 seam
// (`document-extraction.ts`'s own header comment names exactly this move). A `.docx` is a zip archive;
// this module walks it as one — EOCD → central directory → local header → payload — inflates
// `word/document.xml` via the native `DecompressionStream('deflate-raw')` (STORE passes through
// untouched), and walks the XML with namespace-aware `DOMParser` queries (`w:t` run text concatenated,
// `w:p` → `\n`). Every malformed-input mode surfaces as a `DocumentExtractionError('corrupt-document')`
// — never a hang, never an uncaught throw, never a silent empty string. Full algorithm + byte-offset
// tables: `.claude/docs/lld/docx-extractor.lld.md`.
//
// Constants below mirror `site/lib/zip-writer.ts`'s own names and field-table comment style (that file's
// own banner: this reader is not imported from it — `app` importing `site` would be an upward import in
// the package DAG — it is re-declared here so the two files review as the two halves of one format).
//
// The `Blob.stream()` → `DecompressionStream` pipe named in the LLD's own risk note (§9) does not compose
// under this repo's jsdom (`Blob` here carries no `.stream()` method, probe-verified while building this
// file) — the pre-authorized fallback is used instead: a manual, single-chunk `ReadableStream` feeds both
// `DecompressionStream` here. Still a pure spec API, zero new dependency.

import { DocumentExtractionError, registerDocumentExtractor, type DocumentExtractor } from './document-extraction.ts'

const LOCAL_FILE_HEADER_SIG = 0x04034b50
const CENTRAL_DIRECTORY_SIG = 0x02014b50
const END_OF_CENTRAL_DIRECTORY_SIG = 0x06054b50
const STORE_METHOD = 0
const DEFLATE_METHOD = 8

const EOCD_FIXED_SIZE = 22 // sig(4)+disk(2)+cdStartDisk(2)+entriesThisDisk(2)+totalEntries(2)+cdSize(4)+cdOffset(4)+commentLen(2)
const MAX_EOCD_COMMENT_LEN = 65535 // the comment-length field is a u16 — the EOCD's own spec-true upper bound
const CENTRAL_HEADER_FIXED_SIZE = 46 // up to (not including) the variable name/extra/comment fields
const LOCAL_HEADER_FIXED_SIZE = 30 // up to (not including) the variable name/extra fields
const DOCUMENT_XML_PATH = 'word/document.xml'
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

// The zip64 "look elsewhere" sentinels (§4.2/§4.3): a legitimate docx never needs zip64 — the seam caps
// input at `MAX_RAW_FILE_BYTES` (10 MB) before this module ever runs — so seeing one here is itself proof
// of a hand-crafted or corrupt archive.
const SENTINEL_U16 = 0xffff
const SENTINEL_U32 = 0xffffffff

function corrupt(message: string): DocumentExtractionError {
  return new DocumentExtractionError(message, 'corrupt-document')
}

/**
 * 4.1 — bounded-tail EOCD scan. The record is 22 fixed bytes + a 0-65535 byte comment, so the signature
 * lives somewhere in the last `22 + 65535` bytes — scanning backward from `len - 22` down to that bound
 * costs at most ~64KB of comparisons, never a whole-file scan (no hang on pathological input). A
 * candidate is accepted only if its own comment-length field equals exactly the bytes remaining after the
 * fixed record — this disambiguates a stray signature-shaped byte pattern inside a comment or archive
 * data from the real record.
 */
function findEndOfCentralDirectory(view: DataView, len: number): number {
  const lowest = Math.max(0, len - EOCD_FIXED_SIZE - MAX_EOCD_COMMENT_LEN)
  for (let pos = len - EOCD_FIXED_SIZE; pos >= lowest; pos -= 1) {
    if (view.getUint32(pos, true) !== END_OF_CENTRAL_DIRECTORY_SIG) continue
    const commentLen = view.getUint16(pos + 20, true)
    if (commentLen === len - (pos + EOCD_FIXED_SIZE)) return pos
  }
  throw corrupt('Not a zip archive (no end-of-central-directory record found).')
}

interface DocumentXmlEntry {
  method: number
  compressedSize: number
  localHeaderOffset: number
}

/**
 * 4.2 — walk the central directory from `cdOffset` looking for `word/document.xml`, bounds-checking every
 * step (an entry running past `cdOffset + cdSize` is corrupt, same as the directory itself running past
 * the EOCD record). Stops at the first exact match — a docx never nests the path under another name.
 */
function findDocumentXmlEntry(bytes: Uint8Array, view: DataView, eocdPos: number): DocumentXmlEntry {
  const entryCount = view.getUint16(eocdPos + 8, true)
  const cdSize = view.getUint32(eocdPos + 12, true)
  const cdOffset = view.getUint32(eocdPos + 16, true)
  if (entryCount === SENTINEL_U16 || cdSize === SENTINEL_U32 || cdOffset === SENTINEL_U32) {
    throw corrupt('zip64 archives are not supported.')
  }
  if (cdOffset + cdSize > eocdPos) throw corrupt('Central directory bounds overrun the archive.')

  const decoder = new TextDecoder('utf-8')
  const cdEnd = cdOffset + cdSize
  let pos = cdOffset
  for (let i = 0; i < entryCount; i += 1) {
    if (pos + CENTRAL_HEADER_FIXED_SIZE > cdEnd) throw corrupt('A central directory entry runs past its own bounds.')
    if (view.getUint32(pos, true) !== CENTRAL_DIRECTORY_SIG) throw corrupt('Invalid central directory entry signature.')
    const gpFlags = view.getUint16(pos + 8, true)
    const method = view.getUint16(pos + 10, true)
    const compressedSize = view.getUint32(pos + 20, true)
    const uncompressedSize = view.getUint32(pos + 24, true)
    const nameLen = view.getUint16(pos + 28, true)
    const extraLen = view.getUint16(pos + 30, true)
    const commentLen = view.getUint16(pos + 32, true)
    const localHeaderOffset = view.getUint32(pos + 42, true)
    const entryEnd = pos + CENTRAL_HEADER_FIXED_SIZE + nameLen + extraLen + commentLen
    if (entryEnd > cdEnd) throw corrupt('A central directory entry runs past its own bounds.')

    const name = decoder.decode(bytes.subarray(pos + CENTRAL_HEADER_FIXED_SIZE, pos + CENTRAL_HEADER_FIXED_SIZE + nameLen))
    if (name === DOCUMENT_XML_PATH) {
      // "Reject up front" (§4.3): both checks below run before this module ever touches the local header.
      if ((gpFlags & 0x1) !== 0) throw corrupt('The document.xml entry is encrypted.')
      if (compressedSize === SENTINEL_U32 || uncompressedSize === SENTINEL_U32 || localHeaderOffset === SENTINEL_U32) {
        throw corrupt('zip64 archives are not supported.')
      }
      return { method, compressedSize, localHeaderOffset }
    }
    pos = entryEnd
  }
  throw corrupt('No word/document.xml entry found — not a docx.')
}

/**
 * 4.3 — local header → payload. Sizes come ONLY from the central directory (already captured); the
 * payload OFFSET, conversely, must come from the LOCAL header's own name/extra-field lengths — real
 * producers (Word) put extra fields here that the central directory does not mirror, so a CD-derived
 * offset would be wrong. This also makes GP bit 3 (data-descriptor entries) work with no special
 * handling: this module never reads the local header's own (possibly zeroed) size fields.
 */
function readPayloadSlice(bytes: Uint8Array, view: DataView, entry: DocumentXmlEntry): Uint8Array {
  const { localHeaderOffset, compressedSize } = entry
  if (localHeaderOffset + LOCAL_HEADER_FIXED_SIZE > bytes.length) throw corrupt('Local file header runs past the archive.')
  if (view.getUint32(localHeaderOffset, true) !== LOCAL_FILE_HEADER_SIG) throw corrupt('Invalid local file header signature.')
  const localNameLen = view.getUint16(localHeaderOffset + 26, true)
  const localExtraLen = view.getUint16(localHeaderOffset + 28, true)
  const payloadStart = localHeaderOffset + LOCAL_HEADER_FIXED_SIZE + localNameLen + localExtraLen
  if (payloadStart + compressedSize > bytes.length) throw corrupt('The document.xml entry payload runs past the archive.')
  return bytes.subarray(payloadStart, payloadStart + compressedSize)
}

/**
 * 4.4 — inflate (STORE passes the slice through untouched; DEFLATE goes through the native
 * `DecompressionStream`). A single-chunk `ReadableStream` feeds it — the LLD §9 fallback, needed because
 * jsdom's `Blob` carries no `.stream()` here. Any rejection (garbage bytes, a truncated stream) surfaces
 * as `'corrupt-document'`, never an uncaught rejection. Real docx producers emit only methods 0 and 8
 * (F2's grounding) — anything else names the method number in the message.
 */
async function inflate(entry: DocumentXmlEntry, slice: Uint8Array): Promise<Uint8Array> {
  if (entry.method === STORE_METHOD) return slice
  if (entry.method !== DEFLATE_METHOD) throw corrupt(`Unsupported compression method (${entry.method}).`)
  try {
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(slice)
        controller.close()
      },
    })
    // The DOM lib's `DecompressionStream.writable` is typed `WritableStream<BufferSource>` — structurally
    // wider than the `WritableStream<Uint8Array>` `pipeThrough` wants, so TS rejects the otherwise-valid
    // pairing. Cast through `ReadableWritablePair` (a real spec type, not `any`) rather than widen anything
    // load-bearing.
    const decompressed = source.pipeThrough(new DecompressionStream('deflate-raw') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>)
    return new Uint8Array(await new Response(decompressed).arrayBuffer())
  } catch {
    throw corrupt('Failed to inflate the document.xml entry (corrupt DEFLATE stream).')
  }
}

/**
 * 4.5 — decode UTF-8, parse with `DOMParser`, and detect failure the WHATWG-specced way: a `parsererror`
 * element IN the returned document, never a throw (`getElementsByTagName` matches the prefix-less
 * qualified name regardless of which namespace an engine puts it in). Guard the root next — this is what
 * makes "valid XML that isn't WordprocessingML" a VISIBLE failure instead of a silent empty string. Walk
 * paragraphs in document order via `getElementsByTagNameNS` (CSS selectors are OUT for namespaced XML —
 * `querySelectorAll('w\\:t')` returns zero hits under jsdom, probe-verified) — per paragraph, concatenate
 * `w:t` run text (this natively honors `xml:space="preserve"`), then join paragraphs with `\n`. A validly
 * parsed, root-verified document with zero paragraphs returns `''` honestly (empty, not corrupt).
 */
function walkDocumentXml(bytes: Uint8Array): string {
  const xml = new TextDecoder('utf-8').decode(bytes)
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) throw corrupt('word/document.xml is not well-formed XML.')

  const root = doc.documentElement
  if (root === null || root.localName !== 'document' || root.namespaceURI !== W_NS) {
    throw corrupt("word/document.xml is not a WordprocessingML document (wrong root element or namespace).")
  }

  const lines: string[] = []
  for (const paragraph of doc.getElementsByTagNameNS(W_NS, 'p')) {
    let text = ''
    for (const run of paragraph.getElementsByTagNameNS(W_NS, 't')) text += run.textContent ?? ''
    lines.push(text)
  }
  return lines.join('\n')
}

/**
 * The pure byte-level core (LLD C1): read `bytes` as a zip archive, inflate `word/document.xml`, and walk
 * it into plain text. Every malformed-input mode rejects with a `DocumentExtractionError` whose `reason`
 * is `'corrupt-document'` — never a hang, never an uncaught throw, never a silent empty string. Tests hit
 * this directly with malformed byte fixtures; `docxExtractor.run` is the thin `File` wrapper around it.
 */
export async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocdPos = findEndOfCentralDirectory(view, bytes.length)
  const entry = findDocumentXmlEntry(bytes, view, eocdPos)
  const slice = readPayloadSlice(bytes, view, entry)
  const xmlBytes = await inflate(entry, slice)
  return walkDocumentXml(xmlBytes)
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase()
}

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/**
 * The docx extractor (LLD §3) — self-registers on import (the `textExtractor` precedent). Claims `.docx`
 * by extension or the OOXML MIME type; LIFO registration means it out-precedes the txt fallback
 * automatically, and a `text/*` file still routes to txt (both directions asserted in C6).
 */
export const docxExtractor: DocumentExtractor = {
  name: 'docx',
  test(file) {
    return extensionOf(file.name) === 'docx' || file.type === DOCX_MIME_TYPE
  },
  async run(file) {
    return extractDocxText(new Uint8Array(await file.arrayBuffer()))
  },
}

registerDocumentExtractor(docxExtractor)
