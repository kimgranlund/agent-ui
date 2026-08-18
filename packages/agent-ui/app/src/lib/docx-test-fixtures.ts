// docx-test-fixtures.ts — GH #1214, LLD §6: a TEST-ONLY generated-fixture builder for
// `document-extraction-docx.test.ts`. Builds REAL minimal docx archives — `[Content_Types].xml`,
// `_rels/.rels`, `word/document.xml` — a valid, Word-openable document, rather than a committed binary
// fixture: (a) fixtures stay reviewable TypeScript, not opaque blobs in git; (b) the DEFLATE fixture
// compresses at build time via native `CompressionStream('deflate-raw')` — a byte-true producer of
// exactly the stream the reader must inflate; (c) malformations are surgical knobs, not hex-edited files;
// (d) a committed Word-produced binary would exercise the local-extra-field divergence only by luck.
//
// Imported ONLY by test files — never by any src barrel (LLD §9's own risk note: if a size/byte gate ever
// counts this file, the fix is exclusion by that gate's own convention, never moving this builder into a
// test file body).
//
// Mirrors `site/lib/zip-writer.ts` field-for-field and its `ByteWriter`/`crc32`/DOS-date helpers (NOT
// imported from it — `app` importing `site` would be an upward import in the package DAG, `zip-writer.ts`'s
// own header comment names the same reasoning) so the two files review as the same format from two
// directions: a real writer and a fixture writer that also plants deliberate malformations.
//
// The `CompressionStream('deflate-raw')` pipe uses a manual single-chunk `ReadableStream` rather than
// `Blob.stream()` — the same LLD §9 fallback `document-extraction-docx.ts` uses for the READ side (jsdom's
// `Blob` carries no `.stream()` here, probe-verified).

const LOCAL_FILE_HEADER_SIG = 0x04034b50
const CENTRAL_DIRECTORY_SIG = 0x02014b50
const END_OF_CENTRAL_DIRECTORY_SIG = 0x06054b50
const VERSION_NEEDED = 20
const STORE_METHOD = 0
const DEFLATE_METHOD = 8

let crcTable: Uint32Array | undefined

/** The standard IEEE 802.3 CRC-32 table (poly 0xEDB88320) — `zip-writer.ts`'s own algorithm, duplicated
 *  here (not imported — see the header banner) so a generated fixture carries a REAL checksum, the way a
 *  genuine producer's archive would. */
function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  crcTable = table
  return table
}

function crc32(bytes: Uint8Array): number {
  const table = getCrcTable()
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) {
    crc = table[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** Append little-endian bytes into a growable byte buffer — `zip-writer.ts`'s own `ByteWriter`,
 *  duplicated (not imported — see the header banner). */
class ByteWriter {
  #chunks: Uint8Array[] = []
  #length = 0

  get length(): number {
    return this.#length
  }

  bytes(value: Uint8Array): this {
    this.#chunks.push(value)
    this.#length += value.length
    return this
  }

  u16(value: number): this {
    const b = new Uint8Array(2)
    new DataView(b.buffer).setUint16(0, value, true)
    return this.bytes(b)
  }

  u32(value: number): this {
    const b = new Uint8Array(4)
    new DataView(b.buffer).setUint32(0, value, true)
    return this.bytes(b)
  }

  build(): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(this.#length)
    let offset = 0
    for (const chunk of this.#chunks) {
      out.set(chunk, offset)
      offset += chunk.length
    }
    return out
  }
}

/** A single-chunk `ReadableStream` feeding a `CompressionStream`/`DecompressionStream` — the LLD §9
 *  fallback, needed because jsdom's `Blob` carries no `.stream()` here. */
function singleChunkStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

async function deflateRawCompress(bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  // The DOM lib's `CompressionStream.writable` is typed `WritableStream<BufferSource>` — structurally
  // wider than the `WritableStream<Uint8Array>` `pipeThrough` wants, so TS rejects the otherwise-valid
  // pairing (the same cast `document-extraction-docx.ts` uses on the READ side).
  const compressed = singleChunkStream(bytes).pipeThrough(new CompressionStream('deflate-raw') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>)
  return new Uint8Array(await new Response(compressed).arrayBuffer())
}

/** One entry to place in a built archive. */
export interface FixtureEntry {
  /** The in-archive path, e.g. `'word/document.xml'`. */
  path: string
  /** UTF-8 text or raw bytes — the entry's UNCOMPRESSED content. */
  data: string | Uint8Array
  /** `'store'` (default) writes `data` unchanged; `'deflate'` compresses it via
   *  `CompressionStream('deflate-raw')` before writing — a byte-true producer of the exact stream the
   *  reader must inflate. */
  compress?: 'store' | 'deflate'
  /** Malformation knob — write THIS method number into both header fields instead of the one `compress`
   *  implies. Combined with `compress: 'store'` (data left uncompressed) this builds both the
   *  "unsupported method" fixture (an arbitrary method number over ordinary bytes) and the "garbage
   *  DEFLATE payload" fixture (method 8 over bytes that were never actually deflated). */
  methodOverride?: number
  /** Malformation knob — extra field bytes written ONLY into this entry's LOCAL header, never mirrored
   *  into the central directory entry (whose own extra-field length stays 0). Exercises the §4.3
   *  local-extra-field divergence: real producers (Word) do this routinely, and the reader must derive
   *  the payload offset from the LOCAL header's own extra-field length, never the central directory's. */
  localOnlyExtra?: Uint8Array
}

export interface BuildZipOptions {
  /** Malformation knob — bytes appended after the EOCD's own fixed 22 bytes, with the EOCD's own
   *  comment-length field set to match (so the record still validates the way a real archive's trailing
   *  comment does). */
  eocdComment?: Uint8Array
  /** Malformation knob (LLD's "truncate-at-byte-N") — physically emit only the first
   *  `centralDirectoryBytes.length - truncateCentralDirectoryBytes` bytes of the built central directory,
   *  while the EOCD's own `cdSize` field still names the FULL, pre-cut byte count — simulating an
   *  interrupted write. This is what exercises the §4.2 `cdOffset + cdSize <= eocdPos` bounds check
   *  specifically, as opposed to no EOCD being found at all (a different failure mode, already covered by
   *  plain non-zip bytes). */
  truncateCentralDirectoryBytes?: number
}

/** Build a zip archive from `entries`, mirroring `site/lib/zip-writer.ts`'s STORE writer field-for-field
 *  plus the malformation knobs above. Always returns bytes, even when a knob makes them malformed on
 *  purpose. */
export async function buildZip(entries: readonly FixtureEntry[], options: BuildZipOptions = {}): Promise<Uint8Array<ArrayBuffer>> {
  const encoder = new TextEncoder()
  const now = new Date()
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
  const dateVal = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()

  const local = new ByteWriter()
  const central = new ByteWriter()
  const offsets: number[] = []
  const nameBytesList: Uint8Array[] = []
  const methods: number[] = []
  const crcs: number[] = []
  const compressedSizes: number[] = []
  const uncompressedSizes: number[] = []

  for (const entry of entries) {
    const raw = typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data
    const encoded = entry.compress === 'deflate' ? await deflateRawCompress(raw) : raw
    const method = entry.methodOverride ?? (entry.compress === 'deflate' ? DEFLATE_METHOD : STORE_METHOD)
    const nameBytes = encoder.encode(entry.path)
    const extraBytes = entry.localOnlyExtra ?? new Uint8Array(0)
    const crc = crc32(raw)

    offsets.push(local.length)
    nameBytesList.push(nameBytes)
    methods.push(method)
    crcs.push(crc)
    compressedSizes.push(encoded.length)
    uncompressedSizes.push(raw.length)

    local
      .u32(LOCAL_FILE_HEADER_SIG)
      .u16(VERSION_NEEDED)
      .u16(0) // general purpose bit flag
      .u16(method)
      .u16(time)
      .u16(dateVal)
      .u32(crc)
      .u32(encoded.length)
      .u32(raw.length)
      .u16(nameBytes.length)
      .u16(extraBytes.length) // LOCAL header's own extra-field length — may diverge from the CD's (below)
      .bytes(nameBytes)
      .bytes(extraBytes)
      .bytes(encoded)
  }

  for (let i = 0; i < entries.length; i += 1) {
    const nameBytes = nameBytesList[i]!
    central
      .u32(CENTRAL_DIRECTORY_SIG)
      .u16(VERSION_NEEDED) // version made by
      .u16(VERSION_NEEDED) // version needed to extract
      .u16(0) // general purpose bit flag
      .u16(methods[i]!)
      .u16(time)
      .u16(dateVal)
      .u32(crcs[i]!)
      .u32(compressedSizes[i]!)
      .u32(uncompressedSizes[i]!)
      .u16(nameBytes.length)
      .u16(0) // extra field length — ALWAYS 0 here, even when the local header above carries one
      .u16(0) // file comment length
      .u16(0) // disk number start
      .u16(0) // internal file attributes
      .u32(0) // external file attributes
      .u32(offsets[i]!)
      .bytes(nameBytes)
  }

  const localBytes = local.build()
  const centralBytes = central.build()
  const emittedCentralBytes =
    options.truncateCentralDirectoryBytes === undefined
      ? centralBytes
      : centralBytes.slice(0, Math.max(0, centralBytes.length - options.truncateCentralDirectoryBytes))
  const comment = options.eocdComment ?? new Uint8Array(0)

  const end = new ByteWriter()
  end
    .u32(END_OF_CENTRAL_DIRECTORY_SIG)
    .u16(0) // number of this disk
    .u16(0) // disk where central directory starts
    .u16(entries.length) // entries on this disk
    .u16(entries.length) // total entries
    .u32(centralBytes.length) // the FULL size — deliberately stale vs. what's emitted when truncated
    .u32(localBytes.length) // offset of start of central directory
    .u16(comment.length)
    .bytes(comment)

  const endBytes = end.build()
  const out = new Uint8Array(localBytes.length + emittedCentralBytes.length + endBytes.length)
  out.set(localBytes, 0)
  out.set(emittedCentralBytes, localBytes.length)
  out.set(endBytes, localBytes.length + emittedCentralBytes.length)
  return out
}

const CONTENT_TYPES_PATH = '[Content_Types].xml'
const RELS_PATH = '_rels/.rels'
const DOCUMENT_XML_PATH = 'word/document.xml'
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

export const MINIMAL_CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Override PartName="/word/document.xml" ' +
  'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '</Types>'

export const MINIMAL_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" ' +
  'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" ' +
  'Target="word/document.xml"/>' +
  '</Relationships>'

function escapeXmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Build a `word/document.xml` payload: `paragraphs` is one array of run texts per paragraph — the exact
 *  `w:p`/`w:t`/`w:r` shape the reader's §4.5 walk expects (each run wrapped `xml:space="preserve"` so a
 *  leading/trailing space in a run round-trips, the paragraph/run mapping test's own point). */
export function documentXml(paragraphs: readonly (readonly string[])[]): string {
  const body = paragraphs
    .map((runs) => {
      const runsXml = runs.map((text) => `<w:r><w:t xml:space="preserve">${escapeXmlText(text)}</w:t></w:r>`).join('')
      return `<w:p>${runsXml}</w:p>`
    })
    .join('')
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:document xmlns:w="${W_NS}"><w:body>${body}</w:body></w:document>`
  )
}

export interface BuildDocxOptions extends BuildZipOptions {
  /** Overrides the default single-paragraph `documentXml([['Hello world']])` body. */
  documentXml?: string
  /** Per-entry overrides for the `word/document.xml` entry specifically (`compress`, `methodOverride`,
   *  `localOnlyExtra`) — the knobs that only make sense targeted at the ONE entry the reader looks for. */
  documentEntry?: Pick<FixtureEntry, 'compress' | 'methodOverride' | 'localOnlyExtra'>
  /** Entries placed BEFORE `[Content_Types].xml`/`_rels/.rels`/`word/document.xml` — lets a test build a
   *  multi-entry archive where `word/document.xml` (already third by default) sits even later. */
  leadingEntries?: readonly FixtureEntry[]
  /** Omit the `word/document.xml` entry entirely — the "valid archive missing word/document.xml" fixture. */
  omitDocumentXml?: boolean
}

/** Build a REAL minimal docx archive (LLD §6): `[Content_Types].xml`, `_rels/.rels`, `word/document.xml` —
 *  a valid, Word-openable document by default, with every malformation knob threaded through. */
export async function buildDocxZip(options: BuildDocxOptions = {}): Promise<Uint8Array<ArrayBuffer>> {
  const entries: FixtureEntry[] = [...(options.leadingEntries ?? [])]
  entries.push({ path: CONTENT_TYPES_PATH, data: MINIMAL_CONTENT_TYPES_XML })
  entries.push({ path: RELS_PATH, data: MINIMAL_RELS_XML })
  if (!options.omitDocumentXml) {
    entries.push({
      path: DOCUMENT_XML_PATH,
      data: options.documentXml ?? documentXml([['Hello world']]),
      ...options.documentEntry,
    })
  }
  return buildZip(entries, { eocdComment: options.eocdComment, truncateCentralDirectoryBytes: options.truncateCentralDirectoryBytes })
}

/** `buildDocxZip`, wrapped as a `File` with the OOXML MIME type — what `docxExtractor.test`/`run` (and the
 *  real attach path, C7) actually receive. */
export async function buildDocxFile(name = 'fixture.docx', options: BuildDocxOptions = {}): Promise<File> {
  const bytes = await buildDocxZip(options)
  return new File([bytes], name, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}
