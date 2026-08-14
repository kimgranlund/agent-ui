// zip-writer.test.ts — GH #889: round-trip proof for the hand-rolled STORE-format writer. No zip LIBRARY
// exists anywhere in this repo to parse against (the whole point of hand-rolling), so this file carries its
// own minimal, independent reader — walking the central directory the writer emits, then reading each local
// entry it points at — and asserts the bytes/names/CRCs the writer wrote are exactly what the reader finds.
// A bug that corrupted the writer AND happened to fool a reader built from the same misunderstanding is the
// one class this can't catch; the negative controls below (a byte-flipped CRC, an empty file, a name with a
// nested "directory" segment) probe the fiddly edges most likely to hide such a bug.
import { describe, it, expect } from 'vitest'
import { buildZip, crc32, type ZipEntryInput } from './zip-writer.ts'

interface ParsedEntry {
  path: string
  data: Uint8Array
  crc: number
}

/** A minimal independent zip reader: walks the END-OF-CENTRAL-DIRECTORY record backwards from EOF (fixed
 *  22-byte record, no archive comment in anything this module ever writes), then each central-directory
 *  entry, then the local header + data it points at. Deliberately does not reuse any of zip-writer.ts's own
 *  field-writing helpers, so a shared misunderstanding can't hide as an agreeing pair. */
function readZip(bytes: Uint8Array): ParsedEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocdSig = view.getUint32(bytes.length - 22, true)
  if (eocdSig !== 0x06054b50) throw new Error('no end-of-central-directory record at the expected offset')
  const totalEntries = view.getUint16(bytes.length - 22 + 10, true)
  const centralSize = view.getUint32(bytes.length - 22 + 12, true)
  const centralOffset = view.getUint32(bytes.length - 22 + 16, true)
  expect(centralOffset + centralSize).toBe(bytes.length - 22)

  const decoder = new TextDecoder()
  const out: ParsedEntry[] = []
  let cursor = centralOffset
  for (let i = 0; i < totalEntries; i += 1) {
    expect(view.getUint32(cursor, true)).toBe(0x02014b50)
    const crc = view.getUint32(cursor + 16, true)
    const compressedSize = view.getUint32(cursor + 20, true)
    const uncompressedSize = view.getUint32(cursor + 24, true)
    expect(compressedSize).toBe(uncompressedSize) // STORE — must always agree
    const nameLen = view.getUint16(cursor + 28, true)
    const extraLen = view.getUint16(cursor + 30, true)
    const commentLen = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLen))
    cursor += 46 + nameLen + extraLen + commentLen

    expect(view.getUint32(localOffset, true)).toBe(0x04034b50)
    expect(view.getUint16(localOffset + 8, true)).toBe(0) // compression method === STORE
    const localNameLen = view.getUint16(localOffset + 26, true)
    const localExtraLen = view.getUint16(localOffset + 28, true)
    const dataStart = localOffset + 30 + localNameLen + localExtraLen
    const data = bytes.slice(dataStart, dataStart + uncompressedSize)
    out.push({ path: name, data, crc })
  }
  return out
}

function textEntries(paths_and_texts: ReadonlyArray<readonly [string, string]>): ZipEntryInput[] {
  return paths_and_texts.map(([path, data]) => ({ path, data }))
}

describe('crc32', () => {
  it('matches the well-known "123456789" check value (0xCBF43926, the CRC-32/ISO-HDLC test vector)', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })

  it('differs for a single flipped byte (a real detector, not a constant)', () => {
    const a = crc32(new TextEncoder().encode('agent-settings'))
    const b = crc32(new TextEncoder().encode('agent-Settings'))
    expect(a).not.toBe(b)
  })
})

describe('buildZip', () => {
  it('round-trips one text entry byte-for-byte with a correct CRC', () => {
    const zip = buildZip(textEntries([['manifest.json', '{"a":1}']]))
    const [entry] = readZip(zip)
    expect(entry!.path).toBe('manifest.json')
    expect(new TextDecoder().decode(entry!.data)).toBe('{"a":1}')
    expect(entry!.crc).toBe(crc32(new TextEncoder().encode('{"a":1}')))
  })

  it('round-trips multiple entries under nested "directory" paths, in the order given', () => {
    const zip = buildZip(
      textEntries([
        ['agent-settings/hotel-concierge.json', '{"name":"Hotel Concierge"}'],
        ['test-chat/hotel-concierge.json', '[{"role":"user","content":"hi"}]'],
        ['builder-interview/hotel-concierge.json', '[]'],
        ['manifest.json', '{"exportedAt":"2026-01-01T00:00:00.000Z"}'],
      ]),
    )
    const entries = readZip(zip)
    expect(entries.map((e) => e.path)).toEqual([
      'agent-settings/hotel-concierge.json',
      'test-chat/hotel-concierge.json',
      'builder-interview/hotel-concierge.json',
      'manifest.json',
    ])
    expect(new TextDecoder().decode(entries[1]!.data)).toBe('[{"role":"user","content":"hi"}]')
  })

  it('round-trips an EMPTY file (zero-length data is a real, valid STORE entry)', () => {
    const zip = buildZip(textEntries([['empty.json', '']]))
    const [entry] = readZip(zip)
    expect(entry!.data.length).toBe(0)
    expect(entry!.crc).toBe(crc32(new Uint8Array(0)))
  })

  it('round-trips raw (non-string) bytes unchanged', () => {
    const raw = new Uint8Array([0, 1, 2, 253, 254, 255])
    const zip = buildZip([{ path: 'raw.bin', data: raw }])
    const [entry] = readZip(zip)
    expect([...entry!.data]).toEqual([...raw])
  })

  it('round-trips non-ASCII (UTF-8) content and filenames', () => {
    const zip = buildZip(textEntries([['agent-settings/café-persona.json', '{"label":"café ☕"}']]))
    const [entry] = readZip(zip)
    expect(entry!.path).toBe('agent-settings/café-persona.json')
    expect(new TextDecoder().decode(entry!.data)).toBe('{"label":"café ☕"}')
  })

  it('produces an archive with no entries that still carries a valid end-of-central-directory record', () => {
    const zip = buildZip([])
    expect(readZip(zip)).toEqual([])
  })
})
