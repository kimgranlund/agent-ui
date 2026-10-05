// pins.ts: the fixture hash pins that keep a generator from editing its own acceptance cases (GH #1810,
// fork 4 option (a), Kim 2026-10-05).
//
// `<dir>/pins.json` maps each protected file to the sha256 of its RAW bytes (never re-serialized JSON, so
// one appended byte changes the hash). Checked files: every regular file directly in `dir` whose name
// does not start with `.` (a macOS `.DS_Store` never reds the gate), except `pins.json` itself. A hash
// mismatch, an unpinned file, or a pin for a missing file each add one problem naming the file.
//
// Generic over any dir holding a `pins.json`; the CLI selftest (in `check:scripts`) verifies the
// agent-eval fixtures. Update a pin by hand (`shasum -a 256 <file>`) in the same change as the edit.

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const PINS_FILE = 'pins.json'

export interface PinCheck {
  readonly ok: boolean
  readonly problems: string[]
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function verifyPins(dir: string): PinCheck {
  let doc: unknown
  try {
    doc = JSON.parse(readFileSync(join(dir, PINS_FILE), 'utf8'))
  } catch (err) {
    return { ok: false, problems: [`${PINS_FILE}: unreadable (${err instanceof Error ? err.message : String(err)})`] }
  }
  if (!isObject(doc) || doc.algorithm !== 'sha256' || !isObject(doc.files)) {
    return { ok: false, problems: [`${PINS_FILE}: must be { "algorithm": "sha256", "files": { <name>: <hex> } }`] }
  }
  const pins = doc.files
  const present = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith('.') && e.name !== PINS_FILE)
    .map((e) => e.name)
    .sort()

  const problems: string[] = []
  for (const name of present) {
    const pinned = pins[name]
    if (pinned === undefined) {
      problems.push(`${name}: unpinned (add its sha256 to ${PINS_FILE})`)
      continue
    }
    const actual = createHash('sha256').update(readFileSync(join(dir, name))).digest('hex')
    if (actual !== pinned) problems.push(`${name}: sha256 ${actual} does not match pin ${String(pinned)}`)
  }
  for (const name of Object.keys(pins).sort()) {
    if (!present.includes(name)) problems.push(`${name}: pinned but missing`)
  }
  return { ok: problems.length === 0, problems }
}
