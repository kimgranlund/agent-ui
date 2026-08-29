// entries.test.ts — the agent-admin DOMAIN-layer entry-list logic gate. `composeSystemPrompt` is already
// covered end-to-end in agent-admin.test.ts; this file adds ALM-C1's `composeLiveSystemPrompt`
// (TKT-0052/ADR-0136 Fork 3): the capability projection's block shape, the enabled/disabled + `toolsEnabled`
// gating, and — the load-bearing property — that with no enabled capabilities the live prompt is
// BYTE-IDENTICAL to today's composed prompt (the live path degrades exactly to the stub's own prompt, never
// a trailing empty header). ADR-0170 adds the catalog kind's whole invariant
// (`readCatalogEntries`/`isRegisteredCatalog`): the Default row guaranteed at READ time (no migration write)
// and EXACTLY ONE row enabled, derived from `A2UI_CATALOG_KEY` alone — never from the stored per-entry flags.
//
// ADR-0164 cl.2 split this file along the generic/domain line: `validateNewEntry`'s own LLD-C7 suite
// (an OPTIONAL explicit `id` on `NewEntryInput`) is CORE — it moved to
// `../entry-list/entry-data.test.ts` alongside the function it gates. No assertion was lost in the split.

import { describe, it, expect } from 'vitest'
import {
  AVAILABILITY_KINDS,
  CAPABILITY_INDEX_TEACHING,
  ENTRY_KINDS,
  INVOCABLE_KINDS,
  MENTIONABLE_KINDS,
  buildCapabilityRows,
  buildEntryRosters,
  composeSystemPrompt,
  composeLiveSystemPrompt,
  hasAvailabilityMode,
  hasDrawerCrud,
  DRAWER_CRUD_KINDS,
  RENAMABLE_KINDS,
  parseCapabilityRowId,
  pickedPatternSource,
  readCatalogEntries,
  resolveTurnReferences,
  isRegisteredCatalog,
  initialEntryValues,
  type LiveCapabilityGroup,
  type ReferenceGroup,
} from './entries.ts'
import { ENTRY_AVAILABILITY, entriesStoreKey, validateNewEntry, type Entry } from '../entry-list/entry-data.ts'
import { A2UI_CATALOG_KEY, A2UI_CATALOG_OPTIONS, DEFAULT_A2UI_CATALOG_ID } from './agent-admin-schema.ts'
import type { AgentTeam } from './agent-team.ts'
import type { TeamMemberSnapshot, TeamPromptContext } from './agent-team-prompt.ts'

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

function group(kind: string, heading: string, entries: Entry[], enabled = true): LiveCapabilityGroup {
  return { kind, heading, entries, enabled }
}

describe('composeLiveSystemPrompt (ALM-C1 / ADR-0136 Fork 3) — the capability projection', () => {
  it('appends one `## heading` block per kind with ≥1 ambient entry, each entry ONE index line, in order', () => {
    const skills = group(ENTRY_KINDS.skill, 'Skills available to you', [
      entry({ id: 'search', label: 'Web search', description: 'Searches the web', content: 'search(q)', order: 0 }),
      entry({ id: 'calc', label: 'Calculator', description: '', content: '', order: 1 }),
    ])
    const out = composeLiveSystemPrompt(SECTIONS, [skills])
    // GH #891/SPEC-R14 — the ambient SHAPE is an INDEX LINE (label + description), never the content. This
    // expectation deliberately REPLACES the pre-#891 `### {label}` + content pin; never restore that one.
    expect(out).toBe(
      '## Foundation\nYou are helpful.\n\n' +
        `${CAPABILITY_INDEX_TEACHING}\n\n` +
        '## Skills available to you\n' +
        '- Web search — Searches the web\n' +
        '- Calculator',
    )
    expect(out, "the entry's own body reaches the model only through an invocation (SPEC-R4)").not.toContain('search(q)')
  })

  it('skips a DISABLED entry, and contributes NO header for a kind whose entries are all disabled', () => {
    const skills = group(ENTRY_KINDS.skill, 'Skills available to you', [
      entry({ id: 'on', label: 'Kept', content: 'kept', order: 0, enabled: true }),
      entry({ id: 'off', label: 'Dropped', content: 'dropped', order: 1, enabled: false }),
    ])
    const emptyKind = group(ENTRY_KINDS.workflow, 'Workflows available to you', [
      entry({ id: 'w', kind: ENTRY_KINDS.workflow, label: 'W', content: 'w', enabled: false }),
    ])
    const out = composeLiveSystemPrompt(SECTIONS, [skills, emptyKind])
    expect(out).toContain('- Kept')
    expect(out).not.toContain('Dropped')
    expect(out).not.toContain('## Workflows available to you')
  })

  it('orders entries by `order` then `id` (the composeSystemPrompt tie-break law)', () => {
    const skills = group(ENTRY_KINDS.skill, 'Skills available to you', [
      entry({ id: 'b', label: 'Second', content: '', order: 5 }),
      entry({ id: 'a', label: 'First', content: '', order: 5 }),
    ])
    const out = composeLiveSystemPrompt(SECTIONS, [skills])
    expect(out.indexOf('- First')).toBeLessThan(out.indexOf('- Second'))
  })

  it("a group's `enabled: false` MASTER switch gates the WHOLE kind out — every kind, not just tools (vision rev.5)", () => {
    const tools = group(ENTRY_KINDS.tool, 'Tools available to you', [
      entry({ id: 'calc', kind: ENTRY_KINDS.tool, label: 'Calculator', content: 'add(a,b)', order: 0 }),
    ])
    expect(composeLiveSystemPrompt(SECTIONS, [{ ...tools, enabled: false }])).not.toContain('## Tools available to you')
    const on = composeLiveSystemPrompt(SECTIONS, [tools])
    expect(on).toContain('## Tools available to you')
    expect(on).toContain('- Calculator')
    // the master wins over per-entry toggles for ANY kind
    const skills = group(ENTRY_KINDS.skill, 'Skills available to you', [
      entry({ id: 's', label: 'S', content: 'x', enabled: true }),
    ], false)
    expect(composeLiveSystemPrompt(SECTIONS, [skills])).not.toContain('## Skills available to you')
  })

  it('EQUIVALENCE PROPERTY: no enabled capabilities ⇒ byte-identical to composeSystemPrompt(sections)', () => {
    const base = composeSystemPrompt(SECTIONS)
    // no groups at all
    expect(composeLiveSystemPrompt(SECTIONS, [])).toBe(base)
    // groups present but every entry disabled / the tool kind gated
    const groups: LiveCapabilityGroup[] = [
      group(ENTRY_KINDS.skill, 'Skills available to you', [entry({ id: 's', label: 'S', content: 'x', enabled: false })]),
      group(ENTRY_KINDS.tool, 'Tools available to you', [entry({ id: 't', kind: ENTRY_KINDS.tool, label: 'T', content: 'x', enabled: true })], false),
    ]
    expect(composeLiveSystemPrompt(SECTIONS, groups)).toBe(base)
  })
})

// ── the AVAILABILITY gate (GH #850 / capability-availability-tagging.spec.md SPEC-R3, surface (a)) ────────
// An enabled but USER-INVOCABLE entry contributes ZERO ambient bytes to the live prompt — the third
// conjunct (`isAmbient`), never a replacement for the master switch or the per-entry `enabled` flag. The
// other three gated surfaces (`integrations` on both arms, the config snapshot's label lists, the Context
// tab's System view) are agent-admin.test.ts's, driven through the real element.

describe('composeLiveSystemPrompt — the availability gate (SPEC-R3 AC1)', () => {
  it("an enabled INVOCABLE entry's label and content appear NOWHERE, while its in-context sibling composes", () => {
    const skills = group(ENTRY_KINDS.skill, 'Skills available to you', [
      entry({ id: 'house-style', label: 'House style', description: 'The voice.', content: 'Be brief.', order: 0 }),
      entry({
        id: 'menu-pdf',
        label: 'Menu PDF',
        description: 'The dinner menu.',
        content: 'Starters: soup, salad.',
        order: 1,
        availability: ENTRY_AVAILABILITY.invocable,
      }),
    ])
    const out = composeLiveSystemPrompt(SECTIONS, [skills])
    // GH #891/SPEC-R14 UPDATES this assertion's ambient SHAPE (the SPEC's own annotation on R3 AC1): the
    // in-context sibling composes as an INDEX LINE — label + description, never its content.
    expect(out).toContain('- House style — The voice.')
    expect(out, 'even an AMBIENT entry keeps its body out of the prompt now').not.toContain('Be brief.')
    // What R3 AC1 asserts, unchanged and still the load-bearing law — an invocable entry contributes ZERO
    // ambient bytes: label, description AND content, all absent.
    expect(out).not.toContain('Menu PDF')
    expect(out).not.toContain('The dinner menu.')
    expect(out).not.toContain('Starters: soup, salad.')
  })

  it('a kind whose only enabled entries are INVOCABLE contributes no header at all (the empty-group law, extended)', () => {
    const tools = group(ENTRY_KINDS.tool, 'Tools available to you', [
      entry({ id: 'calc', kind: ENTRY_KINDS.tool, label: 'Calculator', content: 'add(a,b)', availability: ENTRY_AVAILABILITY.invocable }),
    ])
    expect(composeLiveSystemPrompt(SECTIONS, [tools])).toBe(composeSystemPrompt(SECTIONS))
  })

  it('availability is ORTHOGONAL to the other two gates — neither collapses into the other', () => {
    // in-context but DISABLED ⇒ still out; invocable but master-OFF ⇒ still out; the master switch wins
    // over availability exactly as it wins over `enabled`.
    const disabled = group(ENTRY_KINDS.skill, 'Skills available to you', [
      entry({ id: 's', label: 'S', content: 'x', enabled: false, availability: ENTRY_AVAILABILITY.context }),
    ])
    expect(composeLiveSystemPrompt(SECTIONS, [disabled])).toBe(composeSystemPrompt(SECTIONS))
    const masterOff = group(
      ENTRY_KINDS.skill,
      'Skills available to you',
      [entry({ id: 's', label: 'S', content: 'x', availability: ENTRY_AVAILABILITY.invocable })],
      false,
    )
    expect(composeLiveSystemPrompt(SECTIONS, [masterOff])).toBe(composeSystemPrompt(SECTIONS))
  })

  it('GATED EQUIVALENCE (SPEC-R3 AC3): a FIELD-LESS group composes byte-identically to an all-`context` one', () => {
    // The explicit equivalence assertion the AC asks for, on the projection itself: absent ≡ 'context', in
    // whatever the CURRENT ambient shape is (GH #891/SPEC-R14 moved that shape to the index line and
    // updated this pin with it — R3's own annotation; the two-sided absent-vs-explicit proof is the part
    // that never changes).
    const fieldLess = group(ENTRY_KINDS.skill, 'Skills available to you', [
      entry({ id: 'search', label: 'Web search', description: 'Searches the web', content: 'search(q)', order: 0 }),
      entry({ id: 'calc', label: 'Calculator', description: '', content: '', order: 1 }),
    ])
    const explicitContext = group(
      ENTRY_KINDS.skill,
      'Skills available to you',
      fieldLess.entries.map((e) => ({ ...e, availability: ENTRY_AVAILABILITY.context })),
    )
    const expected =
      '## Foundation\nYou are helpful.\n\n' +
      `${CAPABILITY_INDEX_TEACHING}\n\n` +
      '## Skills available to you\n' +
      '- Web search — Searches the web\n' +
      '- Calculator'
    expect(composeLiveSystemPrompt(SECTIONS, [fieldLess])).toBe(expected)
    expect(composeLiveSystemPrompt(SECTIONS, [explicitContext])).toBe(expected)
  })
})

// ── the INDEX-LINE disclosure + its teaching block (GH #891/SPEC-R14/R15, slice S8; re-taught GH #1030/
// SPEC-R16) ─────────────────────────────────────────────────────────────────────────────────────────────
// The owner's 2026-08-14 ruling (ADR-0190 rev.2): "ever present" has to be cheap, so an ambient capability
// entry contributes label + description and NEVER its content; the full text rides the user's own express
// invocation (SPEC-R4's framing, unchanged) and thereafter replayed history. The model is TOLD the list is
// an index, and (GH #1030's re-teach) that naming an item exactly in the user's own next message loads it
// the same way tagging it does — the model itself still cannot load anything.

describe('composeLiveSystemPrompt — index-line disclosure (SPEC-R14)', () => {
  const SENTINEL = 'SENTINEL-CONTENT-abcdef'
  const bigResource = (): LiveCapabilityGroup =>
    group(ENTRY_KINDS.resource, 'Resources available to you', [
      entry({
        id: 'rules',
        kind: ENTRY_KINDS.resource,
        label: 'Blackjack rules',
        description: 'Deal, actions, settlement.',
        content: `${SENTINEL}\n${'Dealer stands on 17. '.repeat(120)}`, // ≥ 2 KB (AC1's own floor)
      }),
    ])

  it('AC1: a ≥2 KB ambient resource contributes its label + description and NOT one byte of its content', () => {
    const group1 = bigResource()
    expect(group1.entries[0]!.content.length, 'anti-vacuous: the fixture really is ≥ 2 KB').toBeGreaterThan(2048)
    const out = composeLiveSystemPrompt(SECTIONS, [group1])
    expect(out).toContain('## Resources available to you')
    expect(out).toContain('- Blackjack rules — Deal, actions, settlement.')
    expect(out, 'the content sentinel appears nowhere ambiently').not.toContain(SENTINEL)
    expect(out.length, 'the whole prompt weighs less than that one entry did').toBeLessThan(group1.entries[0]!.content.length)
    // …and the FULL content still reaches the model the one way it may: an express invocation (R4's own
    // path, byte-unchanged — asserted here as the other half of the same law).
    const framed = resolveTurnReferences('total it', [{ id: 'rules', label: 'Blackjack rules', kind: ENTRY_KINDS.resource }], [
      refGroup(ENTRY_KINDS.resource, [...group1.entries]),
    ])
    expect(framed.text).toContain(SENTINEL)
  })

  it('AC1: every one of the FOUR capability kinds indexes — including the tool kind, whose wire is unchanged', () => {
    const groups: LiveCapabilityGroup[] = [
      group(ENTRY_KINDS.skill, 'Skills available to you', [entry({ id: 's', label: 'S', description: 'sd', content: 'BODY-SKILL' })]),
      group(ENTRY_KINDS.workflow, 'Workflows available to you', [
        entry({ id: 'w', kind: ENTRY_KINDS.workflow, label: 'W', description: 'wd', content: 'BODY-WORKFLOW' }),
      ]),
      group(ENTRY_KINDS.resource, 'Resources available to you', [
        entry({ id: 'r', kind: ENTRY_KINDS.resource, label: 'R', description: 'rd', content: 'BODY-RESOURCE' }),
      ]),
      group(ENTRY_KINDS.tool, 'Tools available to you', [
        entry({ id: 't', kind: ENTRY_KINDS.tool, label: 'T', description: 'td', content: 'BODY-TOOL' }),
      ]),
    ]
    const out = composeLiveSystemPrompt(SECTIONS, groups)
    expect(out).toContain('- S — sd')
    expect(out).toContain('- W — wd')
    expect(out).toContain('- R — rd')
    expect(out).toContain('- T — td') // a tool's real enablement is the `integrations` wire (R3(b)); its prose indexes like the rest
    for (const content of ['BODY-SKILL', 'BODY-WORKFLOW', 'BODY-RESOURCE', 'BODY-TOOL']) expect(out).not.toContain(content)
  })

  it('the line stays ONE line: a multi-line description collapses, an empty one leaves no dangling dash', () => {
    const skills = group(ENTRY_KINDS.skill, 'Skills available to you', [
      entry({ id: 'a', label: 'Wordy', description: '  First line.\n\nSecond   line.  ', order: 0 }),
      entry({ id: 'b', label: 'Bare', description: '   ', order: 1 }),
    ])
    const lines = composeLiveSystemPrompt(SECTIONS, [skills]).split('\n')
    expect(lines).toContain('- Wordy — First line. Second line.')
    expect(lines).toContain('- Bare')
    expect(lines.filter((l) => l.startsWith('- ')).length, 'exactly one line per ambient entry').toBe(2)
  })

  it('AC3 (gated equivalence): zero ambient capability entries ⇒ byte-identical to composeSystemPrompt, teaching included', () => {
    const base = composeSystemPrompt(SECTIONS)
    expect(composeLiveSystemPrompt(SECTIONS, [])).toBe(base)
    const allInvocable = group(ENTRY_KINDS.skill, 'Skills available to you', [
      entry({ id: 's', label: 'S', description: 'd', content: 'x', availability: ENTRY_AVAILABILITY.invocable }),
    ])
    expect(composeLiveSystemPrompt(SECTIONS, [allInvocable])).toBe(base)
    expect(composeLiveSystemPrompt(SECTIONS, [allInvocable]), 'no index line ⇒ not one teaching byte').not.toContain(
      'The capability lists below are an INDEX',
    )
  })

  it('AC2 (the byte budget, computed both ways): the index is ≤30% of the full-content shape, ≤200 B per entry', () => {
    // A 24-entry corpus in the survey's own proportions (SPEC §12: ~470–504 B skills, ~305–326 B workflows,
    // ~362 B resources, ~218 B tools) — the SHIPPED-pack measurement itself is the site-side test
    // (`site/pages/agent-admin-ambient-budget.test.ts`), which runs the real element over the real packs.
    const make = (kind: string, n: number, contentBytes: number): Entry[] =>
      Array.from({ length: n }, (_, i) =>
        entry({
          id: `${kind}-${i}`,
          kind,
          label: `${kind} number ${i}`,
          description: `What ${kind} ${i} is for, in one line.`,
          content: 'x'.repeat(contentBytes),
          order: i,
        }),
      )
    const groups: LiveCapabilityGroup[] = [
      group(ENTRY_KINDS.skill, 'Skills available to you', make(ENTRY_KINDS.skill, 8, 560)),
      group(ENTRY_KINDS.workflow, 'Workflows available to you', make(ENTRY_KINDS.workflow, 6, 400)),
      group(ENTRY_KINDS.resource, 'Resources available to you', make(ENTRY_KINDS.resource, 7, 470)),
      group(ENTRY_KINDS.tool, 'Tools available to you', make(ENTRY_KINDS.tool, 3, 300)),
    ]
    const entries = groups.flatMap((g) => [...g.entries])
    expect(entries.length, 'the AC asks for ≥ 20 entries').toBeGreaterThanOrEqual(20)
    expect(entries.reduce((n, e) => n + e.content.length, 0), 'and ≥ 10 KB of ambient content').toBeGreaterThan(10_000)

    // Both shapes computed HERE (a budget predicate, never a byte pin): the real projection vs. the
    // pre-#891 full-content grammar, spelled out so the comparison is honest rather than assumed.
    const base = composeSystemPrompt(SECTIONS)
    const indexShape = composeLiveSystemPrompt(SECTIONS, groups)
    const fullShape = `${base}\n\n${groups
      .map(
        (g) =>
          `## ${g.heading}\n${[...g.entries]
            .map((e) => `### ${e.label}\n${e.description.trim()}\n\n${e.content.trim()}`)
            .join('\n\n')}`,
      )
      .join('\n\n')}`
    const ambient = (whole: string): number => whole.length - base.length
    const ratio = ambient(indexShape) / ambient(fullShape)
    expect(ratio, `index ${ambient(indexShape)} B vs full ${ambient(fullShape)} B`).toBeLessThanOrEqual(0.3)

    // …and no single entry's ambient contribution exceeds 200 B (the runaway-description trip-wire, SPEC-N3
    // — a red gate instead of a silent truncation).
    for (const line of indexShape.split('\n').filter((l) => l.startsWith('- '))) {
      expect(line.length + 1, `"${line}" must stay within the per-entry budget`).toBeLessThanOrEqual(200)
    }
  })
})

describe('the index teaching block (SPEC-R15)', () => {
  it('AC1: composed exactly once, before the first capability heading — and absent when nothing indexes', () => {
    const skills = group(ENTRY_KINDS.skill, 'Skills available to you', [entry({ id: 's', label: 'S', description: 'd' })])
    const tools = group(ENTRY_KINDS.tool, 'Tools available to you', [
      entry({ id: 't', kind: ENTRY_KINDS.tool, label: 'T', description: 'd' }),
    ])
    const out = composeLiveSystemPrompt(SECTIONS, [skills, tools])
    expect(out.split(CAPABILITY_INDEX_TEACHING).length - 1, 'exactly once, however many groups compose').toBe(1)
    expect(out.indexOf(CAPABILITY_INDEX_TEACHING)).toBeLessThan(out.indexOf('## Skills available to you'))
    expect(composeLiveSystemPrompt(SECTIONS, [])).not.toContain(CAPABILITY_INDEX_TEACHING)
  })

  it('AC2: it names the index, BOTH trigger characters and the ask-the-user move, within 500 B', () => {
    expect(new TextEncoder().encode(CAPABILITY_INDEX_TEACHING).length).toBeLessThanOrEqual(500)
    expect(CAPABILITY_INDEX_TEACHING).toContain('INDEX')
    expect(CAPABILITY_INDEX_TEACHING, 'the mention trigger, named').toContain('@name')
    expect(CAPABILITY_INDEX_TEACHING, 'the invocation trigger, named').toContain('/name')
    expect(CAPABILITY_INDEX_TEACHING, 'the model still cannot self-load').toMatch(/cannot load an item yourself/i)
    expect(CAPABILITY_INDEX_TEACHING).toMatch(/ask the user/i)
    expect(CAPABILITY_INDEX_TEACHING, 'ONE line — it rides between two blank lines in the prompt').not.toContain('\n')
  })

  // GH #1030/SPEC-R16 — the re-teach: the old "only the user can, by tagging" exclusivity claim is GONE
  // (the client can now auto-attach too), but the model is still never told IT can load anything.
  it('GH #1030: the teaching no longer claims tagging is the ONLY load path, and still never grants the model one', () => {
    expect(CAPABILITY_INDEX_TEACHING, 'the old tag-only exclusivity claim is retired').not.toMatch(/only the user can/i)
    expect(CAPABILITY_INDEX_TEACHING, 'naming it exactly is now taught as a load path').toMatch(/names? it exactly|auto-attach/i)
  })

  it('it lands after the GH #525 bankroll teaching and before the groups (one ordering, both blocks)', () => {
    const skills = group(ENTRY_KINDS.skill, 'Skills available to you', [entry({ id: 's', label: 'S', description: 'd' })])
    const out = composeLiveSystemPrompt(SECTIONS, [skills], { stored: 40 })
    expect(out.indexOf('/bankroll')).toBeLessThan(out.indexOf(CAPABILITY_INDEX_TEACHING))
    expect(out.indexOf(CAPABILITY_INDEX_TEACHING)).toBeLessThan(out.indexOf('## Skills available to you'))
  })
})

describe('DRAWER_CRUD_KINDS — the six kinds whose per-entry CRUD is drawered (GH #917/GH #949)', () => {
  it('skill/workflow/resource/tool/prompt-section/pattern-source — only catalog keeps its inline rows', () => {
    expect([...DRAWER_CRUD_KINDS].sort()).toEqual(['pattern-source', 'prompt-section', 'resource', 'skill', 'tool', 'workflow'])
    for (const kind of [
      ENTRY_KINDS.skill,
      ENTRY_KINDS.workflow,
      ENTRY_KINDS.resource,
      ENTRY_KINDS.tool,
      ENTRY_KINDS.promptSection,
      ENTRY_KINDS.patternSource,
    ]) {
      expect(hasDrawerCrud(kind), `${kind} is drawered`).toBe(true)
    }
    for (const kind of [ENTRY_KINDS.catalog, 'some-future-kind']) {
      expect(hasDrawerCrud(kind), `${kind} is not`).toBe(false)
    }
  })

  it('is its OWN list — a future kind opting into one rule inherits neither of the others', () => {
    // The three lists coincide TODAY and each exists for a different reason (what may be reached ambiently ·
    // what may be renamed · whose CRUD is drawered). This is the fence that makes a future divergence a
    // deliberate edit here rather than a silent inheritance: they are separate arrays, not one filter.
    expect(DRAWER_CRUD_KINDS).not.toBe(AVAILABILITY_KINDS)
    expect(DRAWER_CRUD_KINDS).not.toBe(RENAMABLE_KINDS)
  })
})

describe('AVAILABILITY_KINDS — the four kinds the mode is defined for (SPEC-R1)', () => {
  it('exactly skill/workflow/resource/tool — prompt-section, pattern-source and catalog are OUT (SPEC-N1)', () => {
    expect([...AVAILABILITY_KINDS].sort()).toEqual(['resource', 'skill', 'tool', 'workflow'])
    for (const kind of [ENTRY_KINDS.skill, ENTRY_KINDS.workflow, ENTRY_KINDS.resource, ENTRY_KINDS.tool]) {
      expect(hasAvailabilityMode(kind), `${kind} carries the mode`).toBe(true)
    }
    for (const kind of [ENTRY_KINDS.promptSection, ENTRY_KINDS.patternSource, ENTRY_KINDS.catalog, 'some-future-kind']) {
      expect(hasAvailabilityMode(kind), `${kind} does not`).toBe(false)
    }
  })

  it("the field is INERT on a kind outside the set — `pickedPatternSource` never branches on it", () => {
    // A pattern-source entry marked invocable (only reachable by a hand-edited file) is still picked: no
    // code outside the four kinds may read the mode, so the D3 single-pick is untouched by this slice.
    const picked = pickedPatternSource([
      entry({ id: 'p', kind: ENTRY_KINDS.patternSource, label: 'P', availability: ENTRY_AVAILABILITY.invocable }),
    ])
    expect(picked?.id).toBe('p')
  })
})

// GH #525 bootstrap fix (2026-08-07 live-proof finding): a real croupier session played two settled
// rounds and the store's bankroll key stayed undefined the whole time — the OLD contract (a bare
// `number | undefined`) only ever taught `/bankroll` once a value was ALREADY stored, a deadlock (no
// stored value ⇒ no path teaching ⇒ the model keeps its habitual key ⇒ nothing to mirror ⇒ never a
// stored value). `bankroll` is now `LiveBankrollState | undefined`: presence of the OBJECT (not its
// `.stored` field) is what gates the path teaching — a capable, A2UI-on persona ALWAYS gets it.
describe('composeLiveSystemPrompt — the GH #525 bankroll line (bootstrap fix, 2026-08-07)', () => {
  it('omitted bankroll (not capable, or A2UI off) ⇒ byte-identical to the pre-#525 two-argument call (GATED EQUIVALENCE)', () => {
    const skills = group(ENTRY_KINDS.skill, 'Skills available to you', [entry({ id: 's', label: 'S', content: 'x' })])
    expect(composeLiveSystemPrompt(SECTIONS, [skills])).toBe(composeLiveSystemPrompt(SECTIONS, [skills], undefined))
  })

  it('capable + NOTHING stored yet ⇒ the path-teaching line composes, with NO resume-figure sentence (the bootstrap arm itself)', () => {
    const out = composeLiveSystemPrompt(SECTIONS, [], {})
    expect(out).toBe(
      '## Foundation\nYou are helpful.\n\n' +
        "Keep your game's running chip count at the data-model path /bankroll — that exact key, never chips/stack/score; every settlement writes the new figure there.",
    )
    expect(out).not.toContain('Your current bankroll is')
  })

  it('capable + a stored figure ⇒ the SAME path-teaching line, plus a resume-figure sentence naming the exact stored value', () => {
    const out = composeLiveSystemPrompt(SECTIONS, [], { stored: 340 })
    expect(out).toBe(
      '## Foundation\nYou are helpful.\n\n' +
        "Keep your game's running chip count at the data-model path /bankroll — that exact key, never chips/stack/score; every settlement writes the new figure there. " +
        'Your current bankroll is 340 — resume from it, never a fresh stake.',
    )
  })

  it('the bankroll block lands BEFORE the capability groups (stored and unstored alike)', () => {
    const skills = group(ENTRY_KINDS.skill, 'Skills available to you', [entry({ id: 's', label: 'S', content: 'x' })])
    for (const bankroll of [{}, { stored: 50 }]) {
      const out = composeLiveSystemPrompt(SECTIONS, [skills], bankroll)
      const pathIndex = out.indexOf('/bankroll')
      const skillsIndex = out.indexOf('## Skills available to you')
      expect(pathIndex).toBeGreaterThan(-1)
      expect(skillsIndex).toBeGreaterThan(pathIndex)
    }
  })

  it('a stored zero still composes the resume sentence (0 is a valid, sanitized figure, not "absent")', () => {
    expect(composeLiveSystemPrompt(SECTIONS, [], { stored: 0 })).toContain('Your current bankroll is 0 — resume from it')
  })
})

describe('pickedPatternSource — the D3 single-pick projection (genui-surface SPEC-R11)', () => {
  it('seeds an empty pattern-source list (initialEntryValues)', () => {
    expect(initialEntryValues()[entriesStoreKey(ENTRY_KINDS.patternSource)]).toEqual([])
  })

  it('undefined when no entry is enabled', () => {
    const entries = [entry({ id: 'a', kind: ENTRY_KINDS.patternSource, label: 'A', enabled: false })]
    expect(pickedPatternSource(entries)).toBeUndefined()
  })

  it('undefined over an empty list', () => {
    expect(pickedPatternSource([])).toBeUndefined()
  })

  it('the single enabled entry when exactly one is enabled', () => {
    const entries = [
      entry({ id: 'a', kind: ENTRY_KINDS.patternSource, label: 'A', enabled: false }),
      entry({ id: 'b', kind: ENTRY_KINDS.patternSource, label: 'B', content: 'b-body', enabled: true, order: 1 }),
    ]
    expect(pickedPatternSource(entries)?.id).toBe('b')
    expect(pickedPatternSource(entries)?.content).toBe('b-body')
  })

  it('D3 — source-level pick: with MULTIPLE enabled, the FIRST by order wins (never an error)', () => {
    const entries = [
      entry({ id: 'later', kind: ENTRY_KINDS.patternSource, label: 'Later', enabled: true, order: 2 }),
      entry({ id: 'earlier', kind: ENTRY_KINDS.patternSource, label: 'Earlier', enabled: true, order: 0 }),
    ]
    expect(pickedPatternSource(entries)?.id).toBe('earlier')
  })

  it('ties broken by id (the composeSystemPrompt sort law)', () => {
    const entries = [
      entry({ id: 'zeta', kind: ENTRY_KINDS.patternSource, label: 'Zeta', enabled: true, order: 0 }),
      entry({ id: 'alpha', kind: ENTRY_KINDS.patternSource, label: 'Alpha', enabled: true, order: 0 }),
    ]
    expect(pickedPatternSource(entries)?.id).toBe('alpha')
  })
})

// ── ADR-0170 cl.2/cl.4 — readCatalogEntries, the catalog roster projection ─────────────────────────────
// The kind's whole invariant lives in this ONE pure function: the Default row is guaranteed at read time
// (never a migration write) and EXACTLY ONE row derives to enabled — from `A2UI_CATALOG_KEY` alone, never
// from the stored per-entry flags. Every "the section can't lie about what the runner threads" claim in
// the ADR reduces to the legs below.

describe('readCatalogEntries — the roster projection (ADR-0170 cl.2/cl.4)', () => {
  const SECOND = A2UI_CATALOG_OPTIONS.find((o) => o.id !== DEFAULT_A2UI_CATALOG_ID)!

  /** A minimal read-only store stand-in — the `{get}` shape `readEntries` itself takes. */
  function storeOf(values: Record<string, unknown>): { get(key: string): unknown } {
    return { get: (key) => values[key] }
  }

  function catalogEntry(over: Partial<Entry> & Pick<Entry, 'id'>): Entry {
    return entry({ kind: ENTRY_KINDS.catalog, ...over })
  }

  it('an EMPTY store still yields the Default row — builtin, first, enabled (the fresh-store leg)', () => {
    const rows = readCatalogEntries(undefined)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).toBe(DEFAULT_A2UI_CATALOG_ID)
    expect(rows[0]!.builtin, 'toggleable, never deletable — ADR-0132 Fork 4').toBe(true)
    expect(rows[0]!.enabled, 'sanitizeCatalog fail-closes an unset key to the default id').toBe(true)
    expect(rows[0]!.label, 'the label is READ from the registry, never hardcoded').toBe(
      A2UI_CATALOG_OPTIONS.find((o) => o.id === DEFAULT_A2UI_CATALOG_ID)!.label,
    )
  })

  it('the ensure is READ-time only: nothing is written back to the store', () => {
    const writes: string[] = []
    const store = { get: (): unknown => undefined, set: (key: string): void => void writes.push(key) }
    readCatalogEntries(store)
    expect(writes, 'a pure projection — no migration write, ever').toEqual([])
  })

  it('a roster that ALREADY carries the default id keeps its own stored row (no duplicate, no re-mint)', () => {
    const stored = catalogEntry({ id: DEFAULT_A2UI_CATALOG_ID, label: 'Renamed by the admin', order: 0, builtin: false })
    const rows = readCatalogEntries(storeOf({ [entriesStoreKey(ENTRY_KINDS.catalog)]: [stored] }))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.label).toBe('Renamed by the admin')
    expect(rows[0]!.builtin, "the stored row's own flags survive — only `enabled` is overridden").toBe(false)
  })

  it('the Default row sorts FIRST against rows minted by validateNewEntry (order 0, 1, …)', () => {
    const added = validateNewEntry([], ENTRY_KINDS.catalog, { id: SECOND.id, label: SECOND.label, description: '', content: '' })
    expect(added.ok).toBe(true)
    if (!added.ok) return
    const rows = readCatalogEntries(storeOf({ [entriesStoreKey(ENTRY_KINDS.catalog)]: [added.entry] }))
    const sorted = [...rows].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    expect(sorted.map((r) => r.id)).toEqual([DEFAULT_A2UI_CATALOG_ID, SECOND.id])
  })

  it('EXACTLY ONE enabled: the persisted key alone decides, and FOREIGN stored flags are ignored wholesale', () => {
    // Every stored flag is deliberately wrong: the default says enabled:false, the second says true.
    const rows = readCatalogEntries(
      storeOf({
        [entriesStoreKey(ENTRY_KINDS.catalog)]: [
          catalogEntry({ id: DEFAULT_A2UI_CATALOG_ID, order: 0, enabled: false }),
          catalogEntry({ id: SECOND.id, order: 1, enabled: true }),
        ],
        [A2UI_CATALOG_KEY]: DEFAULT_A2UI_CATALOG_ID,
      }),
    )
    expect(rows.filter((r) => r.enabled).map((r) => r.id)).toEqual([DEFAULT_A2UI_CATALOG_ID])
  })

  it('the selection follows the KEY: pointing it at the second catalog moves the one ON switch', () => {
    const rows = readCatalogEntries(
      storeOf({
        [entriesStoreKey(ENTRY_KINDS.catalog)]: [catalogEntry({ id: SECOND.id, order: 0 })],
        [A2UI_CATALOG_KEY]: SECOND.id,
      }),
    )
    expect(rows.filter((r) => r.enabled).map((r) => r.id)).toEqual([SECOND.id])
  })

  it('a STALE/unknown stored key derives to the Default row (the fail-closed read, surfaced in the UI)', () => {
    for (const bogus of ['a-catalog-that-was-removed', 42, null, { id: 'agent-ui' }]) {
      const rows = readCatalogEntries(
        storeOf({
          [entriesStoreKey(ENTRY_KINDS.catalog)]: [catalogEntry({ id: SECOND.id, order: 0 })],
          [A2UI_CATALOG_KEY]: bogus,
        }),
      )
      expect(rows.filter((r) => r.enabled).map((r) => r.id), `stored key ${JSON.stringify(bogus)}`).toEqual([DEFAULT_A2UI_CATALOG_ID])
    }
  })

  it('an UNREGISTERED row (a dedup-suffixed duplicate) can never derive to ON — exactly one is still enabled', () => {
    const rows = readCatalogEntries(
      storeOf({
        [entriesStoreKey(ENTRY_KINDS.catalog)]: [
          catalogEntry({ id: `${SECOND.id}-2`, order: 0, enabled: true }),
          catalogEntry({ id: SECOND.id, order: 1 }),
        ],
        [A2UI_CATALOG_KEY]: SECOND.id,
      }),
    )
    expect(rows.filter((r) => r.enabled).map((r) => r.id)).toEqual([SECOND.id])
  })

  it('a corrupt/foreign roster value degrades to the Default row alone (readEntries own defensive law)', () => {
    for (const junk of ['not-an-array', 7, { entries: [] }]) {
      const rows = readCatalogEntries(storeOf({ [entriesStoreKey(ENTRY_KINDS.catalog)]: junk }))
      expect(rows.map((r) => r.id)).toEqual([DEFAULT_A2UI_CATALOG_ID])
    }
  })

  it('seeds an empty catalog roster (initialEntryValues) — the Default row is a projection, never a seed', () => {
    expect(initialEntryValues()[entriesStoreKey(ENTRY_KINDS.catalog)]).toEqual([])
  })
})

describe('isRegisteredCatalog — the ONE membership expression (ADR-0170 cl.3)', () => {
  it('true for every registered id, false for anything else', () => {
    for (const option of A2UI_CATALOG_OPTIONS) expect(isRegisteredCatalog(option.id)).toBe(true)
    expect(isRegisteredCatalog(`${DEFAULT_A2UI_CATALOG_ID}-2`), 'a dedup-suffixed duplicate is NOT registered').toBe(false)
    expect(isRegisteredCatalog('')).toBe(false)
    expect(isRegisteredCatalog('https://a2ui.org/catalogs/basic'), 'the canonical URI alias is never a picker id (ADR-0169 cl.13)').toBe(false)
  })
})

// ── GH #849 / capability-availability-tagging.spec.md SPEC-R8 + SPEC-R4 — the reach path, as pure units ──
// The two halves of slice S3's domain layer: what the composer's `@`/`/` menus may offer (the roster
// projection) and what a committed reference turns into at send (framing + the tool wire). Both take the
// SAME `ReferenceGroup[]` the element builds from a fresh store read, so every case below is exactly the
// state `agent-admin.ts` would hand them. The composed-element half (props reaching the real composer,
// both live arms, history) is agent-admin.test.ts's.

function refGroup(kind: string, entries: Entry[], enabled = true): ReferenceGroup {
  return { kind, entries, enabled }
}

describe('buildEntryRosters (GH #849/SPEC-R8) — the menu roster projection', () => {
  const groups = (): ReferenceGroup[] => [
    refGroup(ENTRY_KINDS.resource, [
      entry({
        id: 'menu',
        kind: ENTRY_KINDS.resource,
        label: 'Menu PDF',
        description: 'Tonight’s menu',
        availability: ENTRY_AVAILABILITY.invocable,
        order: 0,
      }),
      entry({ id: 'brand', kind: ENTRY_KINDS.resource, label: 'Brand guide', order: 1 }),
      entry({ id: 'old', kind: ENTRY_KINDS.resource, label: 'Retired', enabled: false, order: 2 }),
    ]),
    refGroup(ENTRY_KINDS.skill, [entry({ id: 'style', kind: ENTRY_KINDS.skill, label: 'House style', order: 0 })]),
    refGroup(ENTRY_KINDS.workflow, [
      entry({ id: 'review', kind: ENTRY_KINDS.workflow, label: 'Review flow', availability: ENTRY_AVAILABILITY.invocable, order: 0 }),
    ]),
    refGroup(ENTRY_KINDS.tool, [entry({ id: 'weather', kind: ENTRY_KINDS.tool, label: 'Weather', order: 0 })], false),
  ]

  it('AC1: exactly the ENABLED entries of master-on mapped kinds — BOTH availability modes, nothing else', () => {
    const { mentionables, invocables } = buildEntryRosters(groups())
    // `@` = Resources: both modes present, the disabled row absent.
    expect(mentionables.map((o) => o.id)).toEqual(['menu', 'brand'])
    // GH #891/SPEC-R9 — the projection now also carries this kind's own GLYPH (`icon`), the domain mapping
    // the composer deliberately does not own.
    expect(mentionables[0]).toEqual({
      id: 'menu',
      label: 'Menu PDF',
      kind: ENTRY_KINDS.resource,
      description: 'Tonight’s menu',
      icon: 'file-text',
    })
    expect(mentionables[1], 'an empty description is omitted, never sent as an empty second line').toEqual({
      id: 'brand',
      label: 'Brand guide',
      kind: ENTRY_KINDS.resource,
      icon: 'file-text',
    })
    // `/` = Skills + Workflows + Tools, in that kind order; the master-OFF tool kind is absent wholesale.
    expect(invocables.map((o) => o.id)).toEqual(['style', 'review'])
    expect(invocables.map((o) => o.kind)).toEqual([ENTRY_KINDS.skill, ENTRY_KINDS.workflow])
  })

  it('AC1 (the other side): an entry of an UNMAPPED kind never reaches either roster', () => {
    const rosters = buildEntryRosters([
      refGroup(ENTRY_KINDS.promptSection, [entry({ id: 'foundation', kind: ENTRY_KINDS.promptSection, label: 'Foundation' })]),
      refGroup(ENTRY_KINDS.patternSource, [entry({ id: 'pack', kind: ENTRY_KINDS.patternSource, label: 'Pack' })]),
      refGroup(ENTRY_KINDS.catalog, [entry({ id: 'agent-ui', kind: ENTRY_KINDS.catalog, label: 'Default' })]),
    ])
    expect(rosters).toEqual({ mentionables: [], invocables: [] })
  })

  it('AC2: a relabeled entry carries the NEW label on the next build, with the SAME id', () => {
    const before = buildEntryRosters(groups()).mentionables[0]!
    const renamed = groups().map((g) =>
      g.kind === ENTRY_KINDS.resource
        ? refGroup(
            g.kind,
            g.entries.map((e) => (e.id === 'menu' ? { ...e, label: 'Dinner menu' } : e)),
          )
        : g,
    )
    const after = buildEntryRosters(renamed).mentionables[0]!
    expect(before.label).toBe('Menu PDF')
    expect(after.label, 'display truth is read fresh per build — a rename needs no further wiring').toBe('Dinner menu')
    expect(after.id, 'the reference key never moves (GH #402)').toBe(before.id)
  })

  it('sorts each kind by `order`, ties by `id` — the composeSystemPrompt sort law', () => {
    const { invocables } = buildEntryRosters([
      refGroup(ENTRY_KINDS.skill, [
        entry({ id: 'c', kind: ENTRY_KINDS.skill, label: 'C', order: 1 }),
        entry({ id: 'a', kind: ENTRY_KINDS.skill, label: 'A', order: 0 }),
        entry({ id: 'b', kind: ENTRY_KINDS.skill, label: 'B', order: 0 }),
      ]),
    ])
    expect(invocables.map((o) => o.id)).toEqual(['a', 'b', 'c'])
  })

  it('GH #891/SPEC-R9: every capability kind projects its OWN glyph — and only mapped kinds get one', () => {
    const rosters = buildEntryRosters([
      refGroup(ENTRY_KINDS.resource, [entry({ id: 'r', kind: ENTRY_KINDS.resource, label: 'R' })]),
      refGroup(ENTRY_KINDS.skill, [entry({ id: 's', kind: ENTRY_KINDS.skill, label: 'S' })]),
      refGroup(ENTRY_KINDS.workflow, [entry({ id: 'w', kind: ENTRY_KINDS.workflow, label: 'W' })]),
      refGroup(ENTRY_KINDS.tool, [entry({ id: 't', kind: ENTRY_KINDS.tool, label: 'T' })]),
    ])
    expect(rosters.mentionables.map((o) => [o.kind, o.icon])).toEqual([[ENTRY_KINDS.resource, 'file-text']])
    expect(rosters.invocables.map((o) => [o.kind, o.icon])).toEqual([
      [ENTRY_KINDS.skill, 'star'],
      [ENTRY_KINDS.workflow, 'share-network'],
      [ENTRY_KINDS.tool, 'gear'],
    ])
    // That every one of these names really EXISTS in the curated pack is proven where it can be proven for
    // real — `conversation-composer.browser.test.ts` renders a chip with one and asserts a resolved <svg>
    // (an unregistered name renders `data-icon-missing`, resolve.ts). Re-listing `ICON_NAMES` here would
    // both copy an enumerable set (the GH #754 drift class) and open an app→icons edge the DAG doesn't grant.
    // The four glyphs are DISTINCT (one kind, one mark) and none collides with the composer's own picker
    // triggers (`sparkle`/`brain`, GH #868) — a chip repeating a picker's glyph would read as that picker.
    const glyphs = [...rosters.mentionables, ...rosters.invocables].map((o) => o.icon)
    expect(new Set(glyphs).size).toBe(4)
    expect(glyphs).not.toContain('sparkle')
    expect(glyphs).not.toContain('brain')
  })

  it('the two trigger rosters map disjoint kinds, and their union is the four availability kinds', () => {
    expect(MENTIONABLE_KINDS.filter((k) => INVOCABLE_KINDS.includes(k))).toEqual([])
    expect([...MENTIONABLE_KINDS, ...INVOCABLE_KINDS].every((k) => AVAILABILITY_KINDS.includes(k))).toBe(true)
    expect(AVAILABILITY_KINDS.every((k) => [...MENTIONABLE_KINDS, ...INVOCABLE_KINDS].includes(k))).toBe(true)
  })
})

// ── the capabilities MENU projection (GH #891/SPEC-R13, ADR-0190 rev.2 — slice S7) ───────────────────────
// The GLOBAL switch's row set: the same `ReferenceGroup` input as the rosters above, a deliberately
// DIFFERENT filter — both enabled states listed (the whole point of a global off-switch), the master switch
// still winning. The store WRITE a flip performs is agent-admin.test.ts's, through the real element.

describe('buildCapabilityRows (GH #891/SPEC-R13) — the capabilities-menu projection', () => {
  const groups = (): ReferenceGroup[] => [
    refGroup(ENTRY_KINDS.skill, [
      entry({ id: 'style', kind: ENTRY_KINDS.skill, label: 'House style', description: 'The voice.', order: 0 }),
      entry({ id: 'retired', kind: ENTRY_KINDS.skill, label: 'Retired', enabled: false, order: 1 }),
    ]),
    refGroup(ENTRY_KINDS.workflow, [
      entry({ id: 'review', kind: ENTRY_KINDS.workflow, label: 'Review flow', availability: ENTRY_AVAILABILITY.invocable, order: 0 }),
    ]),
    refGroup(ENTRY_KINDS.resource, [entry({ id: 'menu', kind: ENTRY_KINDS.resource, label: 'Menu PDF', order: 0 })]),
    refGroup(ENTRY_KINDS.tool, [entry({ id: 'weather', kind: ENTRY_KINDS.tool, label: 'Weather', order: 0 })], false),
  ]

  it('lists BOTH enabled states and BOTH availability modes — `included` mirrors the persisted `enabled`', () => {
    const rows = buildCapabilityRows(groups())
    // The disabled skill is PRESENT (unlike in the `@`/`/` rosters): a global off-switch that hid what it
    // switched off could never be flipped back on. The master-OFF tool kind is absent wholesale.
    expect(rows.map((r) => r.id)).toEqual(['skill:style', 'skill:retired', 'workflow:review', 'resource:menu'])
    expect(rows.map((r) => r.included)).toEqual([true, false, true, true])
    // The row's full shape: the reference projection's own label/kind/description/glyph, plus `included`.
    expect(rows[0]).toEqual({
      id: 'skill:style',
      label: 'House style',
      kind: ENTRY_KINDS.skill,
      description: 'The voice.',
      icon: 'star',
      included: true,
    })
    expect(rows[1], 'an empty description is omitted here too, never an empty second line').toEqual({
      id: 'skill:retired',
      label: 'Retired',
      kind: ENTRY_KINDS.skill,
      icon: 'star',
      included: false,
    })
    // An enabled INVOCABLE entry reads `included: true` — the switch is the `enabled` axis, and availability
    // is untouched by it (SPEC-R1's orthogonality; the tier is taught by the row's own kind/mode, not by
    // pretending an invocable entry is off).
    expect(rows.find((r) => r.id === 'workflow:review')?.included).toBe(true)
  })

  it('the master switch still wins, and a kind outside the four contributes nothing', () => {
    expect(buildCapabilityRows(groups()).some((r) => r.kind === ENTRY_KINDS.tool), 'master-off ⇒ absent').toBe(false)
    expect(buildCapabilityRows([refGroup(ENTRY_KINDS.tool, [entry({ id: 'weather', kind: ENTRY_KINDS.tool, label: 'Weather' })])])).toEqual([
      { id: 'tool:weather', label: 'Weather', kind: ENTRY_KINDS.tool, icon: 'gear', included: true },
    ])
    expect(
      buildCapabilityRows([
        refGroup(ENTRY_KINDS.promptSection, [entry({ id: 'foundation', kind: ENTRY_KINDS.promptSection, label: 'Foundation' })]),
        refGroup(ENTRY_KINDS.patternSource, [entry({ id: 'pack', kind: ENTRY_KINDS.patternSource, label: 'Pack' })]),
        refGroup(ENTRY_KINDS.catalog, [entry({ id: 'agent-ui', kind: ENTRY_KINDS.catalog, label: 'Default' })]),
      ]),
      'availability semantics are defined for four kinds only (SPEC-R1)',
    ).toEqual([])
  })

  it('sorts each kind by `order`, ties by `id` — the composeSystemPrompt sort law, disabled rows included', () => {
    const rows = buildCapabilityRows([
      refGroup(ENTRY_KINDS.skill, [
        entry({ id: 'c', kind: ENTRY_KINDS.skill, label: 'C', order: 1 }),
        entry({ id: 'a', kind: ENTRY_KINDS.skill, label: 'A', order: 0, enabled: false }),
        entry({ id: 'b', kind: ENTRY_KINDS.skill, label: 'B', order: 0 }),
      ]),
    ])
    expect(rows.map((r) => r.id)).toEqual(['skill:a', 'skill:b', 'skill:c'])
  })

  it('the row id is the {kind}:{id} PAIR, and it round-trips — including an id that itself carries colons', () => {
    // `onCapabilityToggle` echoes the row id ALONE, and an entry id is unique only WITHIN its kind: two
    // entries of different kinds may both be `notes` (an id is `slugify(label)`), so the pair is the key.
    const collision = buildCapabilityRows([
      refGroup(ENTRY_KINDS.skill, [entry({ id: 'notes', kind: ENTRY_KINDS.skill, label: 'Notes' })]),
      refGroup(ENTRY_KINDS.resource, [entry({ id: 'notes', kind: ENTRY_KINDS.resource, label: 'Notes' })]),
    ])
    expect(collision.map((r) => r.id), 'same entry id, two kinds, two distinct rows').toEqual(['skill:notes', 'resource:notes'])
    for (const row of collision) expect(parseCapabilityRowId(row.id)).toEqual({ kind: row.kind, id: 'notes' })

    // A namespaced service ref (ADR-0185) is an entry id carrying its OWN colons — the parse splits on the
    // FIRST one only, so it survives verbatim.
    const namespaced = buildCapabilityRows([
      refGroup(ENTRY_KINDS.tool, [entry({ id: 'svc:calc:*', kind: ENTRY_KINDS.tool, label: 'Calculator' })]),
    ])
    expect(namespaced[0]!.id).toBe('tool:svc:calc:*')
    expect(parseCapabilityRowId(namespaced[0]!.id)).toEqual({ kind: ENTRY_KINDS.tool, id: 'svc:calc:*' })
  })

  it('parseCapabilityRowId is FAIL-CLOSED — nothing this projection could not have minted parses', () => {
    for (const bad of ['', 'skill', ':style', 'skill:', 'prompt-section:foundation', 'nonsense:x']) {
      expect(parseCapabilityRowId(bad), `${bad} must not parse`).toBeUndefined()
    }
    expect(parseCapabilityRowId('resource:menu')).toEqual({ kind: ENTRY_KINDS.resource, id: 'menu' })
  })
})

describe('resolveTurnReferences (GH #849/SPEC-R4) — send-time resolution', () => {
  const groups = (): ReferenceGroup[] => [
    refGroup(ENTRY_KINDS.resource, [
      entry({
        id: 'menu',
        kind: ENTRY_KINDS.resource,
        label: 'Menu PDF',
        description: 'Tonight’s menu',
        content: 'Starters\n- soup 6',
        availability: ENTRY_AVAILABILITY.invocable,
      }),
    ]),
    refGroup(ENTRY_KINDS.skill, [entry({ id: 'style', kind: ENTRY_KINDS.skill, label: 'House style', content: 'Be terse.' })]),
    refGroup(ENTRY_KINDS.tool, [
      entry({ id: 'weather', kind: ENTRY_KINDS.tool, label: 'Weather' }),
      // ADR-0185 — an entry id may BE a namespaced service ref. Nothing in this path parses an id, so a
      // namespaced shape rides through verbatim exactly as a plain registry id does.
      entry({ id: 'svc:calc:*', kind: ENTRY_KINDS.tool, label: 'Calculator', availability: ENTRY_AVAILABILITY.invocable }),
    ]),
  ]
  const ref = (kind: string, id: string, label = id): { kind: string; id: string; label: string } => ({ kind, id, label })

  it('AC1: a mentioned resource frames as a labeled block AHEAD of the typed text, content verbatim', () => {
    const out = resolveTurnReferences('Total the dinner order', [ref(ENTRY_KINDS.resource, 'menu', 'Menu PDF')], groups())
    expect(out.text).toBe(
      '## Referenced for this message\n' +
        '### Menu PDF (resource)\n' +
        'Tonight’s menu\n' +
        '\n' +
        'Starters\n- soup 6\n' +
        '\n' +
        'Total the dinner order',
    )
    expect(out.toolIds, 'a prose kind never touches the wire').toEqual([])
  })

  it('frames MULTIPLE prose references under one header, in reference order, typed text last', () => {
    const out = resolveTurnReferences('go', [ref(ENTRY_KINDS.skill, 'style'), ref(ENTRY_KINDS.resource, 'menu')], groups())
    expect(out.text.indexOf('### House style (skill)')).toBeLessThan(out.text.indexOf('### Menu PDF (resource)'))
    expect(out.text.split('\n\n').pop()).toBe('go')
    expect([...out.text.matchAll(/## Referenced for this message/g)], 'one header, however many blocks').toHaveLength(1)
  })

  it('AC2 (unit half): an invoked TOOL rides `toolIds` — never the text — and duplicates resolve once', () => {
    const out = resolveTurnReferences('add these', [ref(ENTRY_KINDS.tool, 'svc:calc:*'), ref(ENTRY_KINDS.tool, 'svc:calc:*')], groups())
    expect(out.toolIds).toEqual(['svc:calc:*'])
    expect(out.text, 'no prose reference ⇒ the typed text is untouched, byte for byte').toBe('add these')
  })

  // GH #899 — the dedupe key's SEPARATOR, previously unpinned by any test. `entries.ts` joins `kind` and
  // `id` with a NUL; #899 rewrote that NUL from a raw byte (which made grep read the whole file as binary
  // and skip it) into the `\x00` escape, and this test is what makes "behaviour-identical" mechanical
  // rather than asserted: both fields are FREE-FORM strings — an id may carry `:` (`svc:calc:*`, ADR-0185)
  // or a space — so the joiner must be a character NEITHER can contain. The first pair below collides
  // under `''` or `':'`, the second under `' '`; all four resolve only while the joiner stays unforgeable.
  // A duplicate PROPER (same kind AND id) rides along, so the test can't pass by dedupe being broken.
  it('GH #899: the dedupe key separator is unforgeable — near-miss kind/id pairs stay distinct, a true duplicate still folds', () => {
    const forgeable: ReferenceGroup[] = [
      refGroup('resource', [
        entry({ id: 'a:b', kind: ENTRY_KINDS.resource, label: 'PAIR-1A' }),
        entry({ id: 'x y', kind: ENTRY_KINDS.resource, label: 'PAIR-2A' }),
      ]),
      refGroup('resource:a', [entry({ id: 'b', kind: ENTRY_KINDS.resource, label: 'PAIR-1B' })]),
      refGroup('resource x', [entry({ id: 'y', kind: ENTRY_KINDS.resource, label: 'PAIR-2B' })]),
    ]
    const out = resolveTurnReferences(
      'go',
      [
        ref('resource', 'a:b'), // ┐ one concatenation under a '' or ':' joiner: "resourcea:b" / "resource:a:b"
        ref('resource:a', 'b'), // ┘
        ref('resource', 'x y'), // ┐ one concatenation under a ' ' joiner: "resource x y"
        ref('resource x', 'y'), // ┘
        ref('resource', 'a:b'), // a duplicate PROPER — folds into the first
      ],
      forgeable,
    )
    for (const label of ['PAIR-1A', 'PAIR-1B', 'PAIR-2A', 'PAIR-2B']) expect(out.text).toContain(`### ${label} (resource)`)
    expect([...out.text.matchAll(/^### /gm)], 'four distinct references, one folded duplicate').toHaveLength(4)
  })

  it('AC3 (fail-closed): a deleted id, a disabled entry and a master-OFF kind each contribute nothing — the rest survive', () => {
    const state: ReferenceGroup[] = [
      refGroup(ENTRY_KINDS.resource, [entry({ id: 'menu', kind: ENTRY_KINDS.resource, label: 'Menu PDF', content: 'stays' })]),
      refGroup(ENTRY_KINDS.skill, [entry({ id: 'style', kind: ENTRY_KINDS.skill, label: 'House style', content: 'dropped', enabled: false })]),
      refGroup(ENTRY_KINDS.tool, [entry({ id: 'weather', kind: ENTRY_KINDS.tool, label: 'Weather' })], false),
    ]
    const out = resolveTurnReferences(
      'ping',
      [
        ref(ENTRY_KINDS.resource, 'gone'), // deleted between menu and send
        ref(ENTRY_KINDS.skill, 'style'), // disabled since
        ref(ENTRY_KINDS.tool, 'weather'), // its kind's master switch went off
        ref(ENTRY_KINDS.resource, 'menu'), // still good — the turn keeps it
      ],
      state,
    )
    expect(out.toolIds).toEqual([])
    expect(out.text).toContain('### Menu PDF (resource)')
    expect(out.text).toContain('stays')
    expect(out.text).not.toContain('gone')
    expect(out.text).not.toContain('dropped')
    expect(out.text, 'the turn still sends, with the remaining resolution intact').toContain('ping')
  })

  it('every reference dropping leaves the typed text byte-identical (fail-closed is never a mangled turn)', () => {
    const out = resolveTurnReferences('ping', [ref(ENTRY_KINDS.resource, 'gone')], groups())
    expect(out).toEqual({ text: 'ping', toolIds: [] })
  })

  it('zero references (absent OR empty) is the identity — the pre-S3 turn, byte for byte', () => {
    expect(resolveTurnReferences('ping', undefined, groups())).toEqual({ text: 'ping', toolIds: [] })
    expect(resolveTurnReferences('ping', [], groups())).toEqual({ text: 'ping', toolIds: [] })
  })

  it('an entry with neither description nor content frames as its label block alone', () => {
    const out = resolveTurnReferences('hi', [ref(ENTRY_KINDS.resource, 'bare')], [
      refGroup(ENTRY_KINDS.resource, [entry({ id: 'bare', kind: ENTRY_KINDS.resource, label: 'Bare' })]),
    ])
    expect(out.text).toBe('## Referenced for this message\n### Bare (resource)\n\nhi')
  })

  it('a reference of an UNMAPPED kind contributes nothing (no group, nothing to resolve against)', () => {
    const out = resolveTurnReferences('hi', [ref(ENTRY_KINDS.promptSection, 'foundation')], groups())
    expect(out).toEqual({ text: 'hi', toolIds: [] })
  })
})

// ── the ADR-0203 cl.2 team-section wiring gate (GH #1194) ────────────────────────────────────────────────
// `composeTeamPromptSection`'s OWN pure-function contract (the pinned-team byte-stable snapshot, the
// member-missing degrade) is agent-team-prompt.test.ts's; this block owns only the `composeSystemPrompt`
// PIPELINE property — the optional second argument, and its ONE gate (`isTeamGm`).

describe('composeSystemPrompt — the ADR-0203 cl.2 team-section wiring gate', () => {
  const TEAM: AgentTeam = {
    id: 'support-team',
    label: 'Support Team',
    gmAgentId: 'gm-agent',
    members: [
      { agentId: 'billing-agent', role: 'Billing specialist', routingDescription: 'Route billing questions here.' },
    ],
  }
  const SNAPSHOTS: TeamMemberSnapshot[] = [{ agentId: 'billing-agent', name: 'Billie' }]
  const context = (activeAgentId: string): TeamPromptContext => ({ team: TEAM, activeAgentId, memberSnapshots: SNAPSHOTS })

  it('NO-TEAM: omitting the second argument entirely is byte-identical to pre-#1194 composeSystemPrompt(sections)', () => {
    expect(composeSystemPrompt(SECTIONS)).toBe('## Foundation\nYou are helpful.')
  })

  it('a team context whose active agent is NOT the GM composes byte-identically to the no-team case', () => {
    const base = composeSystemPrompt(SECTIONS)
    expect(composeSystemPrompt(SECTIONS, context('billing-agent'))).toBe(base)
    expect(composeSystemPrompt(SECTIONS, context('some-unrelated-agent'))).toBe(base)
  })

  it('a team context whose active agent IS the GM appends the team section after the base prompt', () => {
    const out = composeSystemPrompt(SECTIONS, context('gm-agent'))
    expect(out).toBe(
      '## Foundation\nYou are helpful.\n\n' +
        '## Your team\n' +
        "You lead the team below. When a request matches a teammate's routing rule, you may say you are consulting " +
        'them, but nothing here dispatches automatically — continue the conversation yourself, drawing on their role ' +
        'and routing rule as guidance for what to say and when.\n\n' +
        '- **Billie** (Billing specialist): Route billing questions here.',
    )
  })

  it('a GM whose team has zero members composes byte-identically to the no-team case (empty section joins nothing)', () => {
    const emptyTeam: AgentTeam = { id: 'empty-team', label: 'Empty Team', gmAgentId: 'gm-agent', members: [] }
    const base = composeSystemPrompt(SECTIONS)
    expect(composeSystemPrompt(SECTIONS, { team: emptyTeam, activeAgentId: 'gm-agent', memberSnapshots: [] })).toBe(base)
  })
})

// GH #1197 (ADR-0203 cl.2, the honest minimal wiring `#1194` deliberately deferred) — this is the ACTUAL
// live-turn compose path (`agent-admin.ts`'s `#personaSystemFor`/live-arm call sites both run
// `composeLiveSystemPrompt`, never `composeSystemPrompt` directly), so the team section reaching THIS
// function's output — not only the pure unit above — is the real proof the GM's system prompt carries it.
describe('composeLiveSystemPrompt — the ADR-0203 cl.2 team-section wiring, one layer further out (GH #1197)', () => {
  const TEAM: AgentTeam = {
    id: 'support-team',
    label: 'Support Team',
    gmAgentId: 'gm-agent',
    members: [
      { agentId: 'billing-agent', role: 'Billing specialist', routingDescription: 'Route billing questions here.' },
      { agentId: 'research-agent', role: 'Researcher', routingDescription: 'Use for open questions needing lookup.' },
    ],
  }
  const SNAPSHOTS: TeamMemberSnapshot[] = [
    { agentId: 'billing-agent', name: 'Billie' },
    { agentId: 'research-agent', name: 'Ryo' },
  ]
  const context = (activeAgentId: string): TeamPromptContext => ({ team: TEAM, activeAgentId, memberSnapshots: SNAPSHOTS })

  it('omitting the fourth argument entirely is byte-identical to pre-#1197 composeLiveSystemPrompt', () => {
    expect(composeLiveSystemPrompt(SECTIONS, [])).toBe(composeSystemPrompt(SECTIONS))
  })

  it('GM active: the composed LIVE prompt carries the roster section — name, role, and routing rule for every member', () => {
    const out = composeLiveSystemPrompt(SECTIONS, [], undefined, context('gm-agent'))
    expect(out).toContain('## Your team')
    expect(out).toContain('- **Billie** (Billing specialist): Route billing questions here.')
    expect(out).toContain('- **Ryo** (Researcher): Use for open questions needing lookup.')
  })

  it('a non-GM active agent composes byte-identically to the no-team case — the gate is isTeamGm, not team membership', () => {
    const base = composeLiveSystemPrompt(SECTIONS, [])
    expect(composeLiveSystemPrompt(SECTIONS, [], undefined, context('billing-agent'))).toBe(base)
    expect(composeLiveSystemPrompt(SECTIONS, [], undefined, context('some-unrelated-agent'))).toBe(base)
  })

  it('rides ALONGSIDE the bankroll line and the capability index — every optional arg composes together', () => {
    const skills = group(ENTRY_KINDS.skill, 'Skills available to you', [entry({ id: 'search', label: 'Web search', content: 'search(q)', order: 0 })])
    const out = composeLiveSystemPrompt(SECTIONS, [skills], { stored: 500 }, context('gm-agent'))
    expect(out).toContain('Your current bankroll is 500')
    expect(out).toContain('## Your team')
    expect(out).toContain('## Skills available to you')
    // The team section is the LAST block appended (composeSystemPrompt runs before composeLiveSystemPrompt's
    // own bankroll/capability appends) — order is base → team (inside composeSystemPrompt) → bankroll →
    // capability index, so team text lands ahead of the bankroll line in the final string.
    expect(out.indexOf('## Your team')).toBeLessThan(out.indexOf('Your current bankroll'))
  })
})
