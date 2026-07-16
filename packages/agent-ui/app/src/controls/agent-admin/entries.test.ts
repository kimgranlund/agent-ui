// entries.test.ts — the pure entry-list logic gate. `composeSystemPrompt` is already covered end-to-end
// in agent-admin.test.ts; this file adds ALM-C1's `composeLiveSystemPrompt` (TKT-0052/ADR-0136 Fork 3):
// the capability projection's block shape, the enabled/disabled + `toolsEnabled` gating, and — the
// load-bearing property — that with no enabled capabilities the live prompt is BYTE-IDENTICAL to today's
// composed prompt (the live path degrades exactly to the stub's own prompt, never a trailing empty header).

import { describe, it, expect } from 'vitest'
import {
  ENTRY_KINDS,
  composeSystemPrompt,
  composeLiveSystemPrompt,
  type Entry,
  type LiveCapabilityGroup,
} from './entries.ts'

function entry(over: Partial<Entry> & Pick<Entry, 'id'>): Entry {
  return {
    kind: ENTRY_KINDS.skill,
    label: over.id,
    description: '',
    content: '',
    order: 0,
    enabled: true,
    builtin: false,
    ...over,
  }
}

const SECTIONS: Entry[] = [
  entry({ id: 'foundation', kind: ENTRY_KINDS.promptSection, label: 'Foundation', content: 'You are helpful.', order: 0 }),
]

function group(kind: string, heading: string, entries: Entry[]): LiveCapabilityGroup {
  return { kind, heading, entries }
}

describe('composeLiveSystemPrompt (ALM-C1 / ADR-0136 Fork 3) — the capability projection', () => {
  it('appends one `## heading` block per kind with ≥1 enabled entry, each entry `### label` + description + content, in order', () => {
    const skills = group(ENTRY_KINDS.skill, 'Skills available to you', [
      entry({ id: 'search', label: 'Web search', description: 'Searches the web', content: 'search(q)', order: 0 }),
      entry({ id: 'calc', label: 'Calculator', description: '', content: '', order: 1 }),
    ])
    const out = composeLiveSystemPrompt(SECTIONS, [skills], false)
    expect(out).toBe(
      '## Foundation\nYou are helpful.\n\n' +
        '## Skills available to you\n' +
        '### Web search\nSearches the web\n\nsearch(q)\n\n' +
        '### Calculator',
    )
  })

  it('skips a DISABLED entry, and contributes NO header for a kind whose entries are all disabled', () => {
    const skills = group(ENTRY_KINDS.skill, 'Skills available to you', [
      entry({ id: 'on', label: 'Kept', content: 'kept', order: 0, enabled: true }),
      entry({ id: 'off', label: 'Dropped', content: 'dropped', order: 1, enabled: false }),
    ])
    const emptyKind = group(ENTRY_KINDS.workflow, 'Workflows available to you', [
      entry({ id: 'w', kind: ENTRY_KINDS.workflow, label: 'W', content: 'w', enabled: false }),
    ])
    const out = composeLiveSystemPrompt(SECTIONS, [skills, emptyKind], false)
    expect(out).toContain('### Kept')
    expect(out).not.toContain('Dropped')
    expect(out).not.toContain('## Workflows available to you')
  })

  it('orders entries by `order` then `id` (the composeSystemPrompt tie-break law)', () => {
    const skills = group(ENTRY_KINDS.skill, 'Skills available to you', [
      entry({ id: 'b', label: 'Second', content: '', order: 5 }),
      entry({ id: 'a', label: 'First', content: '', order: 5 }),
    ])
    const out = composeLiveSystemPrompt(SECTIONS, [skills], false)
    expect(out.indexOf('### First')).toBeLessThan(out.indexOf('### Second'))
  })

  it('toolsEnabled === false gates the WHOLE tool kind out; true lets it project (the master switch wins)', () => {
    const tools = group(ENTRY_KINDS.tool, 'Tools available to you', [
      entry({ id: 'calc', kind: ENTRY_KINDS.tool, label: 'Calculator', content: 'add(a,b)', order: 0 }),
    ])
    expect(composeLiveSystemPrompt(SECTIONS, [tools], false)).not.toContain('## Tools available to you')
    const on = composeLiveSystemPrompt(SECTIONS, [tools], true)
    expect(on).toContain('## Tools available to you')
    expect(on).toContain('### Calculator')
  })

  it('EQUIVALENCE PROPERTY: no enabled capabilities ⇒ byte-identical to composeSystemPrompt(sections)', () => {
    const base = composeSystemPrompt(SECTIONS)
    // no groups at all
    expect(composeLiveSystemPrompt(SECTIONS, [], false)).toBe(base)
    // groups present but every entry disabled / the tool kind gated
    const groups: LiveCapabilityGroup[] = [
      group(ENTRY_KINDS.skill, 'Skills available to you', [entry({ id: 's', label: 'S', content: 'x', enabled: false })]),
      group(ENTRY_KINDS.tool, 'Tools available to you', [entry({ id: 't', kind: ENTRY_KINDS.tool, label: 'T', content: 'x', enabled: true })]),
    ]
    expect(composeLiveSystemPrompt(SECTIONS, groups, false)).toBe(base)
  })
})
