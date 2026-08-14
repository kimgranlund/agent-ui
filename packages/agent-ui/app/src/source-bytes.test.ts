import { describe, it, expect } from 'vitest'
// Raw fs read, decoded as latin1 so ONE char === ONE byte (exact byte values, no transcoding) — the same
// reverse-coupling fs-read pattern as layering.test.ts / descriptor/site-coverage.test.ts.
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
declare const process: { cwd(): string }

// Trip-wire (GH #899): no TEXT file under app/src may carry bytes that make a tool classify it as BINARY.
//
// WHY this is a gate and not a style preference: `grep` silently SKIPS a file it judges binary — one
// "Binary file … matches" line at most, and on NO match it says nothing at all. Every grep-based fence over
// this tree therefore has a BLIND SPOT on such a file: the fence still exits 1 (read as "clean") while a
// forbidden token sits in the skipped file. That happened — entries.ts carried a literal NUL byte as its
// dedupe-key separator (a raw byte where the `\x00` escape belonged), so the standing connector-token fence
// over this tree (`grep -ri <token> packages/agent-ui/app/src`, recorded three times: SPEC-R6 AC1 of the
// connector-config spec, ADR-0189's ruled-slice check, and that spec's LLD-C7 arc fence) could not have seen
// a breach in the largest file of the tree. #899 escaped that byte; THIS test keeps the blind spot closed, so
// those fences stay sound in the plain form the docs record them in (no `-a` at every call site — the part no
// doc can enforce anyway).
//
// The fenced token itself is deliberately NOT spelled anywhere in this tree, not even in a comment: writing
// it would red that very fence (measured — the first draft of this header did exactly that). Read the token
// off SPEC-R6; everything here calls it "the connector token".
//
// The predicate is deliberately STRICTER than GNU grep's own heuristic (NUL, or undecodable data): it
// rejects every C0 control byte except the three whitespace ones (TAB/LF/CR), rejects DEL, and requires
// strict UTF-8. Reasons: (a) BSD grep, ripgrep, `git diff`, editors and review UIs each draw the
// binary/text line slightly differently, and a tree that is plain UTF-8 text is unambiguous to ALL of them;
// (b) no source file here needs a bare control byte — an escape sequence gives the identical runtime string
// at zero tooling cost.
//
// SCOPE — app/src, the tree that fence names. A repo-wide byte sweep at fix time (2026-08-14, 2420
// files) found exactly ONE offender: entries.ts, fixed with this test. The only other files carrying
// control bytes were visual-baseline PNGs (`__baselines__/*.png`) — binary by nature, and no fence pretends
// to search them; hence the narrow, explicit extension allowlist below instead of a directory skip.
// Widening this gate to a sibling package's tree later is a one-line SCAN_ROOTS change.
//
// This file is itself inside the scanned tree, so it cannot cheat: a raw control byte in the test that
// polices raw control bytes reds the gate. (Measured, while writing it — an editor wrote the planted NUL
// below as a real byte on the first pass and this suite went red on its own source. Hence
// `String.fromCharCode(0)`, never a literal.)
const ROOT = process.cwd()
const SCAN_ROOTS = [`${ROOT}/packages/agent-ui/app/src`]

/** Extensions whose files are binary BY DESIGN and are never the subject of a text fence. Adding a new
 *  binary asset class to the tree is a deliberate act — it reds this gate until it is named here. */
const BINARY_ASSET_EXTENSIONS: readonly string[] = ['.png']

type Dirent = { name: string; isDirectory(): boolean; isFile(): boolean }

/** Every GIT-TRACKED file under `dir` (absolute paths, ANY extension). The fence's concern is
 *  COMMITTED source — an operator checkout also carries untracked local artifacts (.DS_Store,
 *  a visual run's __screenshots__/*.png) that no fence ever greps and no commit ever ships;
 *  walking the filesystem instead of the git tree reds the gate on exactly that cruft (found
 *  live on the operator checkout the day this gate landed). `git ls-files` is the honest scope. */
function walk(dir: string): string[] {
  let listing: string
  try {
    listing = execSync(`git ls-files -z -- ${JSON.stringify(dir)}`, { encoding: 'latin1' })
  } catch {
    return []
  }
  return listing.split('\0').filter(Boolean).map((f) => `${process.cwd()}/${f}`)
}

const isBinaryAsset = (path: string): boolean => BINARY_ASSET_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext))

/** Byte values a text source may not carry: every C0 control except TAB/LF/CR, plus DEL. */
const isForbiddenByte = (code: number): boolean => (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0x7f

/**
 * The whole predicate, over a file's EXACT bytes (a latin1 string: one char === one byte). One
 * human-readable reason per distinct problem; empty means "plain UTF-8 text, visible to every fence".
 */
function binaryReasons(bytes: string): string[] {
  const reasons: string[] = []
  const seen = new Set<number>()
  for (let i = 0; i < bytes.length; i++) {
    const code = bytes.charCodeAt(i)
    if (isForbiddenByte(code) && !seen.has(code)) {
      seen.add(code)
      reasons.push(`raw control byte 0x${code.toString(16).padStart(2, '0')} at offset ${i}`)
    }
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes, (ch) => ch.charCodeAt(0)))
  } catch {
    reasons.push('not decodable as UTF-8')
  }
  return reasons
}

describe('source bytes — no text file under app/src is binary to grep (GH #899)', () => {
  const all = SCAN_ROOTS.flatMap((root) => walk(root))
  const textFiles = all.filter((p) => !isBinaryAsset(p))
  const assets = all.filter(isBinaryAsset)
  const rel = (p: string): string => p.slice(ROOT.length + 1)

  it('anti-vacuous: the walk really finds the tree, entries.ts (the GH #899 file) among it', () => {
    expect(textFiles.length).toBeGreaterThan(100)
    expect(textFiles.map(rel)).toContain('packages/agent-ui/app/src/controls/agent-admin/entries.ts')
    expect(textFiles.map(rel)).toContain('packages/agent-ui/app/src/source-bytes.test.ts') // it polices itself
  })

  it('the binary-asset allowlist stays narrow: every skipped file is a visual baseline PNG', () => {
    // Not decoration — it proves the allowlist can't be what makes the gate below pass, and that no
    // ordinary source extension has quietly been let through it.
    expect(assets.length).toBeGreaterThan(0)
    expect(assets.filter((p) => !p.includes('/__baselines__/')).map(rel)).toEqual([])
  })

  it('no text file under app/src carries a raw control byte or undecodable data', () => {
    const violations: string[] = []
    for (const path of textFiles) {
      const bytes = readFileSync(path, 'latin1') as string
      for (const reason of binaryReasons(bytes)) violations.push(`${rel(path)}: ${reason}`)
    }
    expect(violations).toEqual([])
  })

  it('synthetic-violation: the predicate flags the exact GH #899 shape (a NUL inside a template literal)', () => {
    // The pre-fix entries.ts line, byte for byte. The NUL is BUILT, never typed: a literal one here would
    // trip the gate above (see this file's header) — the same trap that produced #899 in the first place.
    const planted = 'const key = `${reference.kind}' + String.fromCharCode(0) + '${reference.id}`\n'
    expect(binaryReasons(planted)).toEqual(['raw control byte 0x00 at offset 30'])
    // …and the shipped form — the four-character escape — is clean: identical runtime string, visible file.
    expect(binaryReasons('const key = `${reference.kind}\\x00${reference.id}`\n')).toEqual([])
  })

  it('synthetic-violation: the predicate flags undecodable bytes, and passes TAB/LF/CR + multi-byte UTF-8', () => {
    expect(binaryReasons('\xe2\x80')).toEqual(['not decodable as UTF-8']) // a truncated em-dash sequence
    expect(binaryReasons('a\tb\r\nc \xe2\x80\x94 d\n')).toEqual([]) // the same em dash, whole
  })
})
