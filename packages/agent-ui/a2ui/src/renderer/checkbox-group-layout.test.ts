// checkbox-group-layout.test.ts — GH #1125: a multi-select CHECKBOX group used to render as
// inline-wrapped "row soup" (each `ui-checkbox` is `display: inline-flex`, correct for a lone
// standalone checkbox but with no analogous grouping container the way `RadioGroup` is one for
// `Radio`) — the commit Button, an ordinary sibling in the same flow, joined the very same wrapped
// row. Root cause + fix are the PRODUCER-side archetype recipe (`agent/prompts/grammar.md` +
// `ask-archetypes-{specific,blue-sky}.md`, proven by `system-prompt-grammar.test.ts`'s GH #1125 case):
// wrap the Checkboxes in a Column (a real, existing, block-level catalog container — never a new
// component) and place the commit Button as a sibling AFTER that Column, never inside it.
//
// This file is the RENDERER-side half of that proof: given a payload built to the corrected recipe,
// the emitted DOM tree actually has the shape the recipe promises — each option its own child under a
// block-level `ui-column`, and the action Button a SIBLING after the group, never folded into its
// flow. `checkbox-group-layout.browser.test.ts` is the real-engine geometry half (mirrors
// `radio-group.browser.test.ts`'s ADR-0103 "child sits below, not beside" proof). The RadioGroup card
// built the SAME way is asserted byte-for-byte parallel, proving the fix touches nothing on that path
// (radio behaviour stays exactly as it already was).

import { describe, it, expect, beforeAll } from 'vitest'
import { createRenderer } from './renderer.ts'
import type { RendererHost } from './renderer.ts'

// jsdom lacks ElementInternals.setFormValue/setValidity entirely — the SAME sanctioned stub
// `renderer.test.ts` carries for its own real, connected form-associated controls (`ui-radio` here).
beforeAll(() => {
  const proto = ElementInternals.prototype as unknown as Record<string, unknown>
  if (typeof proto['setFormValue'] !== 'function') {
    proto['setFormValue'] = function (): void {}
    proto['setValidity'] = function (): void {}
  }
})

function harness(): { r: RendererHost; mount: HTMLElement; cleanup: () => void } {
  const r = createRenderer()
  const mount = document.createElement('div')
  document.body.append(mount)
  r.mount(mount)
  r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } })
  return { r, mount, cleanup: () => { r.dispose(); mount.remove() } }
}

describe('checkbox multi-select ask card — Column-wrapped group + sibling-after Button (GH #1125)', () => {
  it('N Checkboxes land as N direct children of ONE block-level ui-column, the Button as its sibling AFTER it', () => {
    const { r, mount, cleanup } = harness()
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: ['group', 'btn_continue'] },
          { id: 'group', component: 'Column', gap: 'sm', children: ['cb_a', 'cb_b', 'cb_c'] },
          { id: 'cb_a', component: 'Checkbox', name: 'onset', label: 'Sudden onset' },
          { id: 'cb_b', component: 'Checkbox', name: 'vision', label: 'Vision changes' },
          { id: 'cb_c', component: 'Checkbox', name: 'fever', label: 'Fever' },
          { id: 'btn_continue', component: 'Button', variant: 'solid', label: 'Continue', action: { action: 'submit_symptoms' } },
        ],
      },
    })

    const root = mount.querySelector('ui-column') as HTMLElement
    expect(root, 'the root Column did not mint a ui-column').not.toBeNull()

    // exactly two direct children of the root Column: the group container, then the Button — never
    // a flattened three-checkboxes-plus-button run.
    const rootChildren = [...root.children]
    expect(rootChildren).toHaveLength(2)
    expect(rootChildren[0]!.tagName.toLowerCase()).toBe('ui-column') // the group
    expect(rootChildren[1]!.tagName.toLowerCase()).toBe('ui-button') // the commit action, its OWN sibling

    // the group is a SEPARATE ui-column instance (not the root one) holding the three checkboxes as
    // its OWN direct children — never siblings of the Button inside one shared flow container.
    const group = rootChildren[0] as HTMLElement
    expect(group).not.toBe(root)
    const groupChildren = [...group.children]
    expect(groupChildren).toHaveLength(3)
    for (const child of groupChildren) expect(child.tagName.toLowerCase()).toBe('ui-checkbox')

    // negative control: the Button is NOT reachable as a child of the group (would silently readmit
    // the "joined the same wrapped row" bug if a future edit re-nested it).
    expect(group.querySelector('ui-button')).toBeNull()

    cleanup()
  })

  it('the RadioGroup card built the identical Column({group,button-after}) shape stays unchanged (parity, GH #1125 must not regress radio)', () => {
    const { r, mount, cleanup } = harness()
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

    const root = mount.querySelector('ui-column') as HTMLElement
    const rootChildren = [...root.children]
    expect(rootChildren).toHaveLength(2)
    expect(rootChildren[0]!.tagName.toLowerCase()).toBe('ui-radio-group')
    expect(rootChildren[1]!.tagName.toLowerCase()).toBe('ui-button')

    const group = rootChildren[0] as HTMLElement
    const groupChildren = [...group.children]
    expect(groupChildren).toHaveLength(3)
    for (const child of groupChildren) expect(child.tagName.toLowerCase()).toBe('ui-radio')
    expect(group.querySelector('ui-button')).toBeNull()

    cleanup()
  })
})
