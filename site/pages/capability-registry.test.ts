// capability-registry.test.ts: the Capability Registry page really mounts and its picker really works (GH #1807).
// `site/lib/capability-registry.test.ts` holds the page MODEL; this file proves the page module defines and
// wires `ui-select` (a shell import, `_page.ts`, defines the fleet since ADR-0233) and re-renders the table when
// the catalog id changes, so a dead picker cannot hide behind a green model test.
//
// DOM reads happen inside `beforeAll`, never at describe-body top level (the agent-schema.test.ts precedent).
import { describe, it, expect, beforeAll } from 'vitest'

let select: HTMLElement & { value: string }

const rowTypes = (): string[] => [...document.querySelectorAll('#registry-types-table tbody tr')].map((r) => (r as HTMLElement).dataset.type ?? '')

beforeAll(async () => {
  // jsdom lacks the form-association half of ElementInternals; ui-select calls both unconditionally.
  const proto = ElementInternals.prototype as unknown as Record<string, unknown>
  if (typeof proto.setFormValue !== 'function') proto.setFormValue = function (): void {}
  if (typeof proto.setValidity !== 'function') proto.setValidity = function (): void {}
  await import('./capability-registry.ts')
  select = document.querySelector('ui-select.registry-select') as HTMLElement & { value: string }
})

describe('capability-registry page', () => {
  it('mounts a defined ui-select with one option per catalog id, and the default catalog first', () => {
    expect(select).not.toBeNull()
    expect(customElements.get('ui-select'), 'ui-select must be a defined element, not an inert tag').toBeDefined()
    const options = [...select.querySelectorAll('[role=option]')].map((o) => o.getAttribute('value'))
    expect(options[0]).toBe('agent-ui')
    expect(options).toContain('agent-ui--croupier')
  })

  it('renders the default catalog types, none persona-only', () => {
    const types = rowTypes()
    expect(types.length).toBeGreaterThanOrEqual(80)
    expect(types).toContain('Button')
    expect(types).not.toContain('PlayingCard')
    expect(document.querySelectorAll('#registry-types-table tr[data-persona-only]').length).toBe(0)
  })

  it('selecting a derived id re-renders: the croupier view adds PlayingCard, marked persona-only', () => {
    select.value = 'agent-ui--croupier'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    const types = rowTypes()
    expect(types).toContain('PlayingCard')
    const card = document.querySelector('#registry-types-table tr[data-type=PlayingCard]') as HTMLElement
    expect(card.hasAttribute('data-persona-only')).toBe(true)
    expect(card.textContent).toContain('ui-playing-card')
    expect(card.textContent).toContain('playing card')
  })

  it('selecting the base id again drops the persona-only type (no stale rows)', () => {
    select.value = 'agent-ui'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    expect(rowTypes()).not.toContain('PlayingCard')
  })
})
