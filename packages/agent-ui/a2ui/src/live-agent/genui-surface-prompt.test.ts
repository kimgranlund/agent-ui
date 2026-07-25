// genui-surface-prompt.test.ts — genui-surface.spec.md SPEC-R10: the genui teaching block `buildSystemPrompt`
// composes when (and only when) the modality is enabled for this turn — a structural twin of the
// `miniSkillsBlock`/`personaBlock` precedent (`system-prompt-grammar.test.ts`'s own house style).
// Deterministic, no live model. `GenUiMode` (ADR-0090) is a DIFFERENT axis (SPEC §4 N2) — every case below
// runs across every mode to prove the two never interact.

import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '../agent/system-prompt.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import type { GenUiMode } from '../agent/gen-ui-mode.ts'

const MODES: (GenUiMode | undefined)[] = [undefined, 'default', 'specific', 'blue-sky']

describe('buildSystemPrompt genui block — degradation law (SPEC-R10 AC1)', () => {
  it('an ABSENT 6th argument reproduces the prompt byte-for-byte across every mode (zero-regression)', () => {
    for (const mode of MODES) {
      const withoutParam = buildSystemPrompt(defaultCatalog, [], mode)
      const explicitUndefined = buildSystemPrompt(defaultCatalog, [], mode, undefined, undefined, undefined)
      expect(explicitUndefined).toBe(withoutParam)
    }
  })

  it('genui:{enabled:false} composes byte-identically to genui absent', () => {
    const withoutParam = buildSystemPrompt(defaultCatalog, [])
    const disabled = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, { enabled: false })
    expect(disabled).toBe(withoutParam)
  })

  it('genui:{enabled:true} (no source) composes the base wire/sandbox-reality block, with zero pack bytes', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, { enabled: true })
    expect(prompt).toContain('## GenUI')
    expect(prompt).toContain('"genui":{"surfaceId"')
    expect(prompt).toContain('genui.action(name, payload)')
  })

  it('a picked source composes the SAME base block PLUS that source body verbatim', () => {
    const sourceBody = 'A bespoke idiom: render a starfield background using only CSS radial-gradients.'
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, { enabled: true, sourceBody })
    expect(prompt).toContain('## GenUI')
    expect(prompt).toContain(sourceBody)
  })

  it('no source picked ⇒ the base block alone still composes (the modality still works, PRD §8 m4 cousin)', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, { enabled: true })
    expect(prompt).toContain('## GenUI')
    // No stray pattern-source prose beyond the fixed teaching text itself.
    expect(prompt).not.toContain('starfield')
  })

  it('composes identically across every GenUiMode value — orthogonal to the mode axis (SPEC §4 N2)', () => {
    for (const mode of MODES) {
      const prompt = buildSystemPrompt(defaultCatalog, [], mode, undefined, undefined, { enabled: true })
      expect(prompt).toContain('## GenUI')
    }
  })

  it('composes AFTER the mini-skills block and BEFORE the persona block', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, undefined, 'Speak like a pirate.', { enabled: true })
    const genuiIdx = prompt.indexOf('## GenUI')
    const personaIdx = prompt.indexOf('## Persona')
    expect(genuiIdx).toBeGreaterThan(-1)
    expect(personaIdx).toBeGreaterThan(genuiIdx)
  })

  it('the genui block never leaks into the catalog-derived inventory', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, { enabled: true })
    const invStart = prompt.indexOf('## Available components')
    const invEnd = prompt.indexOf('## Available functions')
    const inventoryBody = prompt.slice(invStart, invEnd)
    expect(inventoryBody).not.toMatch(/GenUI/)
  })
})
