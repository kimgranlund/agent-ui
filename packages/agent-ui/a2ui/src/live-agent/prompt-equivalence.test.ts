// prompt-equivalence.test.ts — ADR-0135 cl.15 (the equivalence gate). Piece C moved the hand-authored
// GRAMMAR half, the six mode-scaled consts, `NEGOTIATE_BLUE_SKY`'s static prose, and the six-entry
// mini-skill registry out of TypeScript source into `tools/agent/prompts/*.md`, loaded via `readFileSync`
// at module load. This gate asserts that move was byte-neutral: the default/absent-mode composed prompt
// (GRAMMAR's byte-identity guarantee, ADR-0090 §1) AND every loaded `MINI_SKILLS` body are byte-identical
// to the PRE-REFACTOR source.
//
// `prompt-equivalence.baseline.json` is the golden reference — captured from the original inline-literal
// `system-prompt.ts`/`mini-skills.ts` BEFORE any Piece-C edit (a real baseline, not a self-referential
// snapshot). It is frozen: regenerate it ONLY when a prompt's TEXT is deliberately changed (edit the
// `.md`, then re-capture), never to make a red gate pass. `prompt-drift.test.ts` stays the orthogonal
// catalog-inventory gate; this file is the prose-content gate.
//
// genui-surface.spec.md SPEC-R9 — the `genuiPacks` field extends this SAME baseline/gate to
// `GENUI_PACKS` (`prompts/genui-packs.ts`): each pack body is byte-pinned exactly like a mini-skill body.
// Regenerate on a deliberate pack edit: read the fresh `GENUI_PACKS` (id/label/description/body) and
// overwrite the `genuiPacks` array in the committed baseline JSON — never hand-edit it to chase green.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { buildSystemPrompt } from '../agent/system-prompt.ts'
import { MINI_SKILLS } from '../agent/mini-skills.ts'
import { GENUI_PACKS } from '../agent/prompts/genui-packs.ts'
import { defaultCatalog } from '../catalog/default/index.ts'

interface Baseline {
  default: string
  defaultExplicit: string
  specific: string
  blueSky: string
  miniSkills: { id: string; triggers: string; body: string }[]
  // genui-surface.spec.md SPEC-R9 — the SAME byte-pinned equivalence discipline applied to the GenUI
  // pattern-source pack registry (edit a pack .md ⇒ re-capture this baseline, the ADR-0135 pattern).
  genuiPacks: { id: string; label: string; description: string; body: string }[]
  // genui-surface.spec.md SPEC-R13(a) — the dogfood segment's hand-authored teaching half, byte-pinned
  // the SAME way (edit `prompts/genui-dogfood-teaching.md` ⇒ re-capture this baseline). The derived
  // fleet inventory (SPEC-R13(b)) is the OPPOSITE discipline — NEVER captured here; see
  // `prompt-drift.test.ts`'s inventory leg.
  genuiDogfoodTeaching: string
}

const here = (import.meta as { dirname?: string }).dirname ?? dirname(fileURLToPath(import.meta.url))
const baseline = JSON.parse(readFileSync(`${here}/prompt-equivalence.baseline.json`, 'utf8')) as Baseline

describe('ADR-0135 cl.15 — the file-loaded prompt is byte-identical to the pre-refactor source', () => {
  it('the default/absent-mode composed prompt is byte-identical (GRAMMAR byte-identity, ADR-0090 §1)', () => {
    expect(buildSystemPrompt(defaultCatalog, [])).toBe(baseline.default)
    expect(buildSystemPrompt(defaultCatalog, [], 'default')).toBe(baseline.defaultExplicit)
  })

  it('the specific + blue-sky composed prompts are byte-identical (mode-scaled consts + dynamic tail)', () => {
    expect(buildSystemPrompt(defaultCatalog, [], 'specific')).toBe(baseline.specific)
    expect(buildSystemPrompt(defaultCatalog, [], 'blue-sky')).toBe(baseline.blueSky)
  })

  it('every loaded MINI_SKILLS entry (id/triggers/body) is byte-identical to the pre-refactor registry', () => {
    const byId = new Map(MINI_SKILLS.map((m) => [m.id, m]))
    expect(MINI_SKILLS.length).toBe(baseline.miniSkills.length)
    for (const base of baseline.miniSkills) {
      const got = byId.get(base.id)
      expect(got, `missing loaded mini-skill: ${base.id}`).toBeDefined()
      expect(got!.triggers, `${base.id} triggers drift`).toBe(base.triggers)
      expect(got!.body, `${base.id} body drift`).toBe(base.body)
    }
  })

  // genui-surface.spec.md SPEC-R9 — "each pack body is byte-pinned by an equivalence gate (edit ⇒
  // re-capture, the ADR-0135 verification shape)": the SAME discipline `MINI_SKILLS` already holds above,
  // applied to `GENUI_PACKS`. A future pack edit must deliberately re-capture this baseline (the python/
  // node one-liner this file's OWN header names) rather than silently drift.
  it('every loaded GENUI_PACKS entry (id/label/description/body) is byte-identical to the captured baseline', () => {
    const byId = new Map(GENUI_PACKS.map((p) => [p.id, p]))
    expect(GENUI_PACKS.length).toBe(baseline.genuiPacks.length)
    for (const base of baseline.genuiPacks) {
      const got = byId.get(base.id)
      expect(got, `missing loaded genui pack: ${base.id}`).toBeDefined()
      expect(got!.label, `${base.id} label drift`).toBe(base.label)
      expect(got!.description, `${base.id} description drift`).toBe(base.description)
      expect(got!.body, `${base.id} body drift`).toBe(base.body)
    }
  })

  // genui-surface.spec.md SPEC-R13(a) AC1 — the SAME byte-pinned equivalence discipline applied to the
  // dogfood segment's hand-authored teaching half. Loaded independently of `system-prompt.ts` (which
  // does not export the loaded constant) — a straight file read, the same source `loadPrompt` reads.
  it('the loaded genui-dogfood-teaching.md is byte-identical to the captured baseline', () => {
    const teaching = readFileSync(`${here}/../agent/prompts/genui-dogfood-teaching.md`, 'utf8').trim()
    expect(teaching).toBe(baseline.genuiDogfoodTeaching)
  })
})
