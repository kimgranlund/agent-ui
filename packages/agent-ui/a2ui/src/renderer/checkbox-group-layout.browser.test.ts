// checkbox-group-layout.browser.test.ts — GH #1125 real-engine geometry half. jsdom computes no
// layout (`checkbox-group-layout.test.ts` owns the DOM-shape half); the REAL bug — checkboxes
// inline-wrapping into "row soup" with the commit Button folded into the same row — is a real-layout
// fact, not a tree-shape one, so it needs a real Chromium/WebKit read. Mirrors
// `radio-group.browser.test.ts`'s ADR-0103 "child sits below, not beside" technique, run through the
// actual A2UI renderer (not hand-built DOM) so the proof is the SAME code path a live producer's
// payload drives.
//
// Root cause: `ui-checkbox`'s host is `display: inline-flex` (checkbox.css) — correct for a lone
// standalone checkbox, but with no analogous group container the way `ui-radio-group` (a REAL
// block-level, `display:flex; flex-direction:column` container, radio-group.css / ADR-0103) wraps
// `ui-radio` children. Several bare `Checkbox` siblings (plus a trailing Button, also inline-level)
// therefore sit on ONE inline formatting context and wrap like words in a paragraph. The fix is the
// producer-prompt recipe (`grammar.md`/`ask-archetypes-*.md`, GH #1125): wrap the group in a Column —
// an EXISTING, already block-level catalog container — and place the commit Button as a sibling
// AFTER it. This file proves that recipe, once followed, actually stacks in a real engine.

import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'
import { createRenderer } from './renderer.ts'
import type { RendererHost } from './renderer.ts'

const mounts: HTMLElement[] = []
afterEach(() => {
  while (mounts.length) mounts.pop()?.remove()
})

function harness(): { r: RendererHost; mount: HTMLElement } {
  const r = createRenderer()
  const mount = document.createElement('div')
  document.body.append(mount)
  mounts.push(mount)
  r.mount(mount)
  r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } })
  return { r, mount }
}

describe('checkbox multi-select ask card — real-engine geometry (GH #1125)', () => {
  it('the corrected recipe (Checkboxes wrapped in a Column, commit Button a sibling after it) stacks: N distinct rows, the Button below the last', () => {
    const { r, mount } = harness()
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: ['group', 'btn_continue'] },
          { id: 'group', component: 'Column', gap: 'sm', children: ['cb_a', 'cb_b', 'cb_c', 'cb_d', 'cb_e'] },
          { id: 'cb_a', component: 'Checkbox', name: 'onset', label: 'Sudden onset' },
          { id: 'cb_b', component: 'Checkbox', name: 'vision', label: 'Vision changes' },
          { id: 'cb_c', component: 'Checkbox', name: 'fever', label: 'Fever' },
          { id: 'cb_d', component: 'Checkbox', name: 'confusion', label: 'Confusion or trouble speaking' },
          { id: 'cb_e', component: 'Checkbox', name: 'pain', label: 'Chest pain' },
          { id: 'btn_continue', component: 'Button', variant: 'solid', label: 'Continue', action: { action: 'submit_symptoms' } },
        ],
      },
    })

    const group = mount.querySelector('ui-column ui-column') as HTMLElement
    const options = [...group.children] as HTMLElement[]
    expect(options).toHaveLength(5)

    // N distinct rows: each option's top strictly below the previous option's top (anti-vacuous —
    // the pre-fix "row soup" shape would leave every option's top on the SAME line).
    for (let i = 1; i < options.length; i++) {
      expect(options[i]!.getBoundingClientRect().top, `option ${i} did not stack below option ${i - 1}`).toBeGreaterThan(
        options[i - 1]!.getBoundingClientRect().top,
      )
    }

    const button = mount.querySelector('ui-button') as HTMLElement
    const lastOption = options[options.length - 1]!
    expect(button.getBoundingClientRect().top, 'the commit Button did not sit below the last option').toBeGreaterThan(
      lastOption.getBoundingClientRect().bottom - 1,
    )
    // and it never shares a row with any option (the exact reported symptom — the Button "joining" the wrap).
    for (const opt of options) {
      expect(Math.abs(button.getBoundingClientRect().top - opt.getBoundingClientRect().top)).toBeGreaterThan(1)
    }
  })

  it('NEGATIVE control: bare Checkbox siblings with NO Column wrapper (the pre-fix shape) really DO share one row — proves the positive legs measure something real', () => {
    const { mount } = harness()
    // Deliberately the OLD, under-specified shape: no grouping container at all, Checkboxes and the
    // Button as flat siblings — exactly what an ungoverned "Checkboxes ... plus a commit Button"
    // recipe could produce.
    const parent = document.createElement('div')
    parent.style.maxWidth = '480px' // a realistic feed-card width — real inline wrap needs finite width
    mount.append(parent)
    for (const label of ['Sudden onset', 'Vision changes', 'Fever']) {
      const cb = document.createElement('ui-checkbox')
      cb.textContent = label
      parent.append(cb)
    }
    const btn = document.createElement('ui-button')
    btn.textContent = 'Continue'
    parent.append(btn)

    const children = [...parent.children] as HTMLElement[]
    const tops = children.map((c) => c.getBoundingClientRect().top)
    // every unwrapped inline-flex sibling sits on the SAME line as the first — the exact bug shape.
    for (const top of tops) expect(Math.abs(top - tops[0]!)).toBeLessThan(2)
  })

  it('parity: the RadioGroup card built the identical Column({group,button-after}) shape stacks the SAME way (unchanged by this fix)', () => {
    const { r, mount } = harness()
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: ['radios', 'btn_continue'] },
          { id: 'radios', component: 'RadioGroup', name: 'severity', children: ['r_mild', 'r_moderate', 'r_severe'] },
          { id: 'r_mild', component: 'Radio', value: 'mild', label: 'Mild' },
          { id: 'r_moderate', component: 'Radio', value: 'moderate', label: 'Moderate' },
          { id: 'r_severe', component: 'Radio', value: 'severe', label: 'Severe' },
          { id: 'btn_continue', component: 'Button', variant: 'solid', label: 'Continue', action: { action: 'submit_severity' } },
        ],
      },
    })

    const radioGroup = mount.querySelector('ui-radio-group') as HTMLElement
    const options = [...radioGroup.children] as HTMLElement[]
    expect(options).toHaveLength(3)
    for (let i = 1; i < options.length; i++) {
      expect(options[i]!.getBoundingClientRect().top).toBeGreaterThan(options[i - 1]!.getBoundingClientRect().top)
    }
    const button = mount.querySelector('ui-button') as HTMLElement
    const lastOption = options[options.length - 1]!
    expect(button.getBoundingClientRect().top).toBeGreaterThan(lastOption.getBoundingClientRect().bottom - 1)
  })
})
