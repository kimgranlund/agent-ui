// zip-writer.ts — GH #889: a hand-rolled, STORE-format (uncompressed) ZIP writer. Written here rather than
// pulled from npm because the library's zero-dependency rule (one ruled CodeMirror exception, ADR-0139)
// binds the PACKAGES; this is a SITE lib backing one dev-debug page feature, and the format itself is
// small enough to hand-roll faithfully: local file headers + a central directory + one end-of-central-
// directory record, CRC-32 over each entry's raw bytes, no DEFLATE. Every mainstream unzip tool (the
// Finder, Explorer, `unzip`, browser-side zip readers) reads STORE entries — the method bit is part of the
// spec's own contract, not a shortcut consumers must special-case.
//
// Pure + dependency-free: no DOM, no Blob — callers wrap the returned `Uint8Array` in whatever the browser
// needs (a `Blob` for a download anchor). Deterministically testable without a browser (zip-writer.test.ts
// round-trips through `DecompressionStream`-free manual parsing of the bytes this module itself produced).

/** One file to place in the archive. `data` is UTF-8 text or raw bytes; `path` is the in-archive name,
 *  forward-slash separated (e.g. `"agent-settings/hotel-concierge.json"`) — this module never creates a
 *  literal directory entry, matching every zip reader's own "the path implies the folder" convention. */
export interface ZipEntryInput {
  path: string
  data: string | Uint8Array
}

const LOCAL_FILE_HEADER_SIG = 0x04034b50
const CENTRAL_DIRECTORY_SIG = 0x02014b50
const END_OF_CENTRAL_DIRECTORY_SIG = 0x06054b50
const VERSION_NEEDED = 20 // 2.0 — the floor that supports plain STORE entries
const STORE_METHOD = 0

let crcTable: Uint32Array | undefined

/** The standard IEEE 802.3 CRC-32 table (poly 0xEDB88320), built once and cached. */
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

/** CRC-32 over raw bytes, the exact checksum every zip reader validates each entry against. */
export function crc32(bytes: Uint8Array): number {
  const table = getCrcTable()
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) {
    crc = table[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** Encode a JS `Date` as the DOS date/time pair every zip header field carries — 2-second resolution,
 *  years floored at 1980 (the format's own epoch; nothing in this feature ever predates it). */
function dosDateTime(date: Date): { time: number; dateVal: number } {
  const year = Math.max(1980, date.getFullYear())
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)
  const dateVal = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { time, dateVal }
}

/** Append little-endian bytes into a growable byte buffer. Kept as a tiny helper rather than reaching for
 *  `DataView` per field — every write here is fixed-width and the call sites read like the spec's own
 *  field table. */
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

/** Build a STORE-format zip archive from `entries`, returned as raw bytes ready for a `Blob`. Entries are
 *  written in the order given, and the central directory mirrors that order — the only thing a caller must
 *  guarantee is that `path` is unique per entry (this module does not dedupe; a colliding path produces a
 *  zip with two entries of the same name, which unzip tools already handle by convention — last one wins on
 *  extract — but callers should not rely on that). */
export function buildZip(entries: readonly ZipEntryInput[], now: Date = new Date()): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder()
  const { time, dateVal } = dosDateTime(now)
  const local = new ByteWriter()
  const central = new ByteWriter()
  const offsets: number[] = []
  const nameBytesList: Uint8Array[] = []
  const crcs: number[] = []
  const sizes: number[] = []

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path)
    const dataBytes = typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data
    const crc = crc32(dataBytes)
    offsets.push(local.length)
    nameBytesList.push(nameBytes)
    crcs.push(crc)
    sizes.push(dataBytes.length)

    local
      .u32(LOCAL_FILE_HEADER_SIG)
      .u16(VERSION_NEEDED)
      .u16(0) // general purpose bit flag
      .u16(STORE_METHOD)
      .u16(time)
      .u16(dateVal)
      .u32(crc)
      .u32(dataBytes.length) // compressed size === uncompressed size (STORE)
      .u32(dataBytes.length)
      .u16(nameBytes.length)
      .u16(0) // extra field length
      .bytes(nameBytes)
      .bytes(dataBytes)
  }

  for (let i = 0; i < entries.length; i += 1) {
    const nameBytes = nameBytesList[i]!
    central
      .u32(CENTRAL_DIRECTORY_SIG)
      .u16(VERSION_NEEDED) // version made by
      .u16(VERSION_NEEDED) // version needed to extract
      .u16(0) // general purpose bit flag
      .u16(STORE_METHOD)
      .u16(time)
      .u16(dateVal)
      .u32(crcs[i]!)
      .u32(sizes[i]!)
      .u32(sizes[i]!)
      .u16(nameBytes.length)
      .u16(0) // extra field length
      .u16(0) // file comment length
      .u16(0) // disk number start
      .u16(0) // internal file attributes
      .u32(0) // external file attributes
      .u32(offsets[i]!)
      .bytes(nameBytes)
  }

  const localBytes = local.build()
  const centralBytes = central.build()
  const end = new ByteWriter()
  end
    .u32(END_OF_CENTRAL_DIRECTORY_SIG)
    .u16(0) // number of this disk
    .u16(0) // disk where central directory starts
    .u16(entries.length) // entries on this disk
    .u16(entries.length) // total entries
    .u32(centralBytes.length)
    .u32(localBytes.length) // offset of start of central directory
    .u16(0) // comment length

  const out = new Uint8Array(localBytes.length + centralBytes.length + end.length)
  out.set(localBytes, 0)
  out.set(centralBytes, localBytes.length)
  out.set(end.build(), localBytes.length + centralBytes.length)
  return out
}
