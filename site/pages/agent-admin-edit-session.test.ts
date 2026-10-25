// agent-admin-edit-session.test.ts: T-0447's edit-session craft section. It ships seeded OFF, so the
// generate interview composes exactly as it did before the section existed (the inertness pin below,
// captured from this same expression at base 17215d8c6); only `builderStore(model, 'edit')` turns it on.
import { describe, it, expect } from 'vitest'
import { composeSystemPrompt, ENTRY_KINDS } from '@agent-ui/app/agent-admin-entries'
import { entriesStoreKey, readEntries } from '@agent-ui/app/entry-data'
import type { Entry } from '@agent-ui/app/entry-data'
import { builderPersona, builderStore, editSessionSection } from './agent-admin-presets.ts'
import { sha256 } from '../agent-content/digest.ts'

const GENERATE_PROMPT_DIGEST = 'sha256:e71f75151ba88c2a7934ec376975c607b2dd9768f934e6db9e77a01d2006a1f6'

const compose = (mode?: 'generate' | 'edit'): string =>
  composeSystemPrompt(readEntries(builderStore(undefined, mode), ENTRY_KINDS.promptSection))

describe('the Builder edit-session section (T-0447)', () => {
  it('leaves the generate prompt byte-identical to base', () => {
    const prompt = composeSystemPrompt(readEntries(builderStore(), ENTRY_KINDS.promptSection))
    expect(prompt.length).toBe(6127)
    expect(sha256(prompt)).toBe(GENERATE_PROMPT_DIGEST)
  })

  it('composes into the edit prompt and never into the generate one', () => {
    const { content } = editSessionSection()
    expect(compose('edit')).toContain(content)
    expect(compose('generate')).not.toContain(content)
    expect(compose()).not.toContain(content)
  })

  it('keeps the model pick in edit mode', () => {
    expect(builderStore('x', 'edit').get('model')).toBe('x')
  })

  it('is seeded disabled on the Builder persona', () => {
    const sections = builderPersona().seed[entriesStoreKey(ENTRY_KINDS.promptSection)] as Entry[]
    expect(sections.find((s) => s.id === 'edit-session')).toMatchObject({ id: 'edit-session', enabled: false })
  })
})
