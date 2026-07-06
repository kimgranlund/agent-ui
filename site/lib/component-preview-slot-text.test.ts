import { describe, it, expect } from 'vitest'
import { NO_SLOT_TEXT, SLOT_TEXT_OK, STRUCTURAL } from './component-preview.ts'
import { parseDoc } from './frontmatter.ts'
// node:fs is untyped here (no @types/node devDep) — the same reverse-coupling fs-read pattern the site drift
// gates use (descriptor/site-coverage.test.ts, gallery.test.ts).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

// component-preview-slot-text.test.ts — the fleet-wide PARTITION gate for component-preview.ts's SLOT_TEXT
// knob (the ADR-0077-surface hardening; see component-preview.ts's own "SLOT_TEXT gating" section for the
// mechanism rationale). `componentKnobs()` grows a SLOT_TEXT knob ONLY for a SLOT_TEXT_OK target; applying it
// (`el.textContent =`) is safe for a genuine text/label slot (SLOT_TEXT_OK) but DESTROYS a control's own
// structural children (NO_SLOT_TEXT) or a STRUCTURAL container's real sample content (batch B — its default
// slot IS the content model, children rather than a string). All three sets are hand-maintained (an explicit
// per-tag partition, mirroring COMPONENT_SAMPLE_CHILDREN / a2ui-mode's A2UI_INITIAL — Kim's ruling: NOT a
// runtime children-count heuristic, which ui-text's self-healing stamp/observer falsifies). This gate is the
// PIN: it asserts the THREE sets PARTITION the live fleet exactly, so a new control landing in NONE of them
// (the silent-drift failure mode a runtime check can't catch either) fails the build loud, rather than quietly
// inheriting SLOT_TEXT_OK by default and shipping a specimen that clobbers its own structure — the exact defect
// this file closes.

const ROOT = process.cwd()
const CONTROLS_DIR = `${ROOT}/packages/agent-ui/components/src/controls`
const read = (p: string): string => readFileSync(p, 'utf8') as string

type Dirent = { name: string; isDirectory(): boolean; isFile(): boolean }

/** Recursively list every file under `dir` (absolute paths); a missing dir yields []. */
function walk(dir: string): string[] {
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true }) as Dirent[]
  } catch {
    return []
  }
  const files: string[] = []
  for (const e of entries) {
    const full = `${dir}/${e.name}`
    if (e.isDirectory()) files.push(...walk(full))
    else if (e.isFile()) files.push(full)
  }
  return files
}

/** The `ui-*` tags among the shipped `{name}.md` descriptors — an INDEPENDENT fs walk (not the gallery's own
 *  import.meta.glob, not component-preview.ts's sets), so this is a real third source, not a tautology. */
function fleetTags(): Set<string> {
  const tags = new Set<string>()
  for (const file of walk(CONTROLS_DIR)) {
    if (!file.endsWith('.md')) continue
    let doc
    try {
      doc = parseDoc(read(file))
    } catch {
      continue // a .md with no frontmatter fence is not a descriptor
    }
    const tag = doc.descriptor.scalars.get('tag')
    if (typeof tag === 'string' && tag.startsWith('ui-')) tags.add(tag)
  }
  return tags
}

/** Three-way partition diff (batch B): `missing` (a fleet tag in NONE of the three sets) + `overlap` (a tag in
 *  TWO OR MORE sets — an ambiguous, contradictory classification). */
function partitionDiff(
  fleet: ReadonlySet<string>,
  a: ReadonlySet<string>,
  b: ReadonlySet<string>,
  c: ReadonlySet<string>,
): { missing: string[]; overlap: string[] } {
  const memberships = (t: string): number => Number(a.has(t)) + Number(b.has(t)) + Number(c.has(t))
  return {
    missing: [...fleet].filter((t) => memberships(t) === 0).sort(),
    overlap: [...fleet].filter((t) => memberships(t) >= 2).sort(),
  }
}

describe('component-preview SLOT_TEXT partition — anti-vacuous', () => {
  it('found real fleet tags, and all three hand-maintained sets are non-empty', () => {
    expect(fleetTags().size).toBeGreaterThanOrEqual(20)
    expect(NO_SLOT_TEXT.size).toBeGreaterThan(0)
    expect(STRUCTURAL.size).toBeGreaterThan(0)
    expect(SLOT_TEXT_OK.size).toBeGreaterThan(0)
  })
})

describe('component-preview SLOT_TEXT partition — NO_SLOT_TEXT + STRUCTURAL + SLOT_TEXT_OK cover the fleet exactly, no overlap', () => {
  const FLEET = fleetTags()

  it('every NO_SLOT_TEXT / STRUCTURAL / SLOT_TEXT_OK entry is a REAL shipped tag (no stale name)', () => {
    const staleNoSlot = [...NO_SLOT_TEXT].filter((t) => !FLEET.has(t)).sort()
    const staleStructural = [...STRUCTURAL].filter((t) => !FLEET.has(t)).sort()
    const staleOk = [...SLOT_TEXT_OK].filter((t) => !FLEET.has(t)).sort()
    expect(staleNoSlot).toEqual([])
    expect(staleStructural).toEqual([])
    expect(staleOk).toEqual([])
  })

  it('every fleet tag is classified into EXACTLY ONE of NO_SLOT_TEXT / STRUCTURAL / SLOT_TEXT_OK', () => {
    expect(partitionDiff(FLEET, NO_SLOT_TEXT, STRUCTURAL, SLOT_TEXT_OK)).toEqual({ missing: [], overlap: [] })
  })

  it('the 3 sample-needing anchors (tooltip/menu/popover) are classified NO_SLOT_TEXT too (both concerns apply)', () => {
    for (const tag of ['ui-tooltip', 'ui-menu', 'ui-popover']) expect(NO_SLOT_TEXT.has(tag)).toBe(true)
  })

  it('ui-slider is classified NO_SLOT_TEXT (batch C — no text slot at all, not a structural-children concern)', () => {
    expect(NO_SLOT_TEXT.has('ui-slider')).toBe(true)
  })

  it('the STRUCTURAL containers (batch B) are classified there, not SLOT_TEXT_OK', () => {
    for (const tag of ['ui-card', 'ui-column', 'ui-form-provider', 'ui-grid', 'ui-list', 'ui-radio-group', 'ui-row']) {
      expect(STRUCTURAL.has(tag), `${tag} should be STRUCTURAL`).toBe(true)
      expect(SLOT_TEXT_OK.has(tag), `${tag} should not also be SLOT_TEXT_OK`).toBe(false)
    }
  })
})

describe('component-preview SLOT_TEXT partition — the gate BITES (synthetic negative controls)', () => {
  it('flags a fleet tag classified in NONE of the three sets (the silent-drift failure mode this gate closes)', () => {
    const fleet = new Set(['ui-a', 'ui-b', 'ui-c', 'ui-zzfake'])
    const a = new Set(['ui-a'])
    const b = new Set(['ui-b'])
    const c = new Set(['ui-c'])
    expect(partitionDiff(fleet, a, b, c)).toEqual({ missing: ['ui-zzfake'], overlap: [] })
  })

  it('flags a tag classified in TWO of the three sets (an ambiguous, contradictory classification)', () => {
    const fleet = new Set(['ui-a', 'ui-b'])
    const a = new Set(['ui-a', 'ui-b'])
    const b = new Set(['ui-b'])
    const c = new Set<string>()
    expect(partitionDiff(fleet, a, b, c)).toEqual({ missing: [], overlap: ['ui-b'] })
  })

  it('a clean, exact three-way partition reports empty both ways', () => {
    const fleet = new Set(['ui-a', 'ui-b', 'ui-c'])
    expect(partitionDiff(fleet, new Set(['ui-a']), new Set(['ui-b']), new Set(['ui-c']))).toEqual({
      missing: [],
      overlap: [],
    })
  })
})
