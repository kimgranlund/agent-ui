// site/lib/a2ui-type-description.test.ts: the A2UI Catalog page's type description (T-0432). Each case reads its
// expected text from the source of truth itself (the descriptor or the selection projection), never a copy.
import { describe, it, expect } from 'vitest'
import { defaultCatalog, defaultFactories } from '@agent-ui/a2ui'
import { selectionProjectionFor } from '@agent-ui/a2ui/registry'
import { loadDescriptorByTag } from './frontmatter.ts'
import { typeDescription } from './a2ui-type-description.ts'
import { CATALOG_OPTIONS, typesFor } from './a2ui-catalog-selector.ts'

const descriptorText = (type: string): string =>
  String(loadDescriptorByTag(defaultFactories[type]!.tag)?.descriptor.scalars.get('description') ?? '').trim()

describe('typeDescription', () => {
  it('an agent-ui control type with a descriptor description reads it', () => {
    expect(descriptorText('Attachment').length, 'anti-vacuous: ui-attachment carries a description').toBeGreaterThan(0)
    expect(typeDescription('agent-ui', 'Attachment')).toBe(descriptorText('Attachment'))
  })

  it('every descriptor-backed agent-ui type reads its own descriptor description, never the intents fallback (T-0433)', () => {
    // T-0433 gave every descriptor a description (descriptor-description.test.ts), so no descriptor-backed card falls
    // back to selection intents; Button was the T-0432 fallback anchor. A sub-part type with no descriptor of its own
    // (Tab, CardHeader, an Option row) keeps reading its intents.
    const backed = Object.keys(defaultCatalog.components).filter((type) => loadDescriptorByTag(defaultFactories[type]!.tag) !== undefined)
    expect(backed.length, 'anti-vacuous: most default types are descriptor-backed').toBeGreaterThanOrEqual(70)
    const fallback = backed.filter((type) => descriptorText(type) === '' || typeDescription('agent-ui', type) !== descriptorText(type))
    expect(fallback).toEqual([])
    expect(typeDescription('agent-ui', 'Button')).not.toContain(selectionProjectionFor('agent-ui').Button!.intents[0])
  })

  it('a base other than agent-ui and a persona type read the intents, never an agent-ui descriptor', () => {
    expect(typeDescription('a2ui-basic', 'Button')!.toLowerCase()).toContain(selectionProjectionFor('a2ui-basic').Button!.intents[0])
    expect(typeDescription('agent-ui--quizmaster', 'QuestionCard')!.toLowerCase()).toContain(
      selectionProjectionFor('agent-ui--quizmaster').QuestionCard!.intents[0],
    )
  })

  it('every default catalog type and every type of every other option has a description', () => {
    const missing: string[] = []
    for (const type of Object.keys(defaultCatalog.components)) if (!typeDescription('agent-ui', type)) missing.push(`agent-ui:${type}`)
    for (const id of CATALOG_OPTIONS.filter((option) => option !== 'agent-ui')) {
      for (const type of typesFor(id)) if (!typeDescription(id, type)) missing.push(`${id}:${type}`)
    }
    expect(missing).toEqual([])
  })
})
