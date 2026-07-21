// workspace-shell.test.ts — jsdom probes for ui-workspace-shell (LLD-C5, GH #97). jsdom cannot resolve real
// container-query/flex layout — the geometry/collapse/landmark behavior this element composes is already
// proven by super-shell.test.ts / super-shell.browser.test.ts; this file proves ONLY what's genuinely new
// here: the connect-time relocation into a real inner `ui-super-shell`, the `narrow-start="collapse"` +
// `collapse-band="compact"` default (ADR-0155 F3),
// idempotent composition across a reconnect (the master-detail.ts precedent), and the descriptor's
// structural + contract↔props + contract↔source trip-wires (ADR-0004).
import { describe, it, expect, afterEach } from 'vitest'
import { UIWorkspaceShellElement } from './workspace-shell.ts'
import '../super-shell/super-shell.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
} from '@agent-ui/components/descriptor'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

const mounted: Element[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

function mount(children: Partial<Record<string, string>>): UIWorkspaceShellElement {
  const el = document.createElement('ui-workspace-shell') as UIWorkspaceShellElement
  for (const [slot, text] of Object.entries(children)) {
    const child = document.createElement('div')
    child.setAttribute('data-slot', slot)
    child.textContent = text ?? slot
    el.append(child)
  }
  document.body.append(el)
  mounted.push(el)
  return el
}

describe('ui-workspace-shell — composition (LLD-C5, GH #97)', () => {
  it('relocates authored children into ONE inner ui-super-shell', () => {
    const el = mount({ header: 'H', 'global-nav': 'GN', 'nav-pane': 'NP', content: 'C' })
    expect(el.children).toHaveLength(1)
    const shell = el.querySelector('ui-super-shell')
    expect(shell).not.toBeNull()
    expect(shell?.querySelector('[data-part="canvas"]')?.textContent).toBe('C')
  })

  it('the full outer grammar (incl. the SPEC-R5 section-nav/options-section slots) composes through unchanged', () => {
    const el = mount({
      header: 'H', 'global-nav': 'GN', 'nav-pane': 'NP', 'section-nav': 'SN',
      content: 'C', 'options-section': 'OS', 'options-pane': 'OP', 'global-options': 'GO', footer: 'F',
    })
    const middle = el.querySelector('[data-part="middle"]') as HTMLElement
    const order = [...middle.children].filter((c) => c.getAttribute('data-part') !== 'scrim').map((c) => c.getAttribute('data-slot-name'))
    expect(order).toEqual(['global-nav', 'nav-pane', 'section-nav', 'content', 'options-section', 'options-pane', 'global-options'])
  })

  it('sets the workspace default narrow-start="collapse" + collapse-band="compact" on the inner shell (ADR-0155 F3)', () => {
    const el = mount({ content: 'C' })
    const shell = el.querySelector('ui-super-shell')
    expect(shell?.getAttribute('narrow-start')).toBe('collapse')
    expect(shell?.getAttribute('collapse-band')).toBe('compact')
  })

  it('composition is idempotent — a second connect (no new children) never double-composes', () => {
    const el = mount({ content: 'C' })
    el.remove()
    document.body.append(el) // reconnect, no DOM change of its own
    expect(el.children).toHaveLength(1)
    expect(el.querySelectorAll('ui-super-shell')).toHaveLength(1)
  })
})

// ── descriptor — ADR-0004 (structural + contract↔props + contract↔source) ────────────────────────────────

const DIR = `${process.cwd()}/packages/agent-ui/app/src/controls/workspace-shell`
const workspaceShellTs = readFileSync(`${DIR}/workspace-shell.ts`, 'utf8') as string
const workspaceShellCss = readFileSync(`${DIR}/workspace-shell.css`, 'utf8') as string

describe('workspace-shell.md descriptor (ui-workspace-shell)', () => {
  const md = readFileSync(`${DIR}/workspace-shell.md`, 'utf8') as string
  const { fence, body } = splitFrontmatter(md)
  const parsed = parseDescriptor(fence)

  it('has a leading frontmatter fence and a /site prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-workspace-shell')
  })

  it('carries the ADR-0004 descriptor field set and is schema-valid', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
    expect(/^tag:\s*ui-workspace-shell\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('attributes[] is empty and agrees with the live (empty) static props — no API surface of its own', () => {
    expect(parsed.attributes).toEqual([])
    expect(compareDescriptorToProps(parsed.attributes, UIWorkspaceShellElement.props)).toEqual([])
  })

  it('customStates/slots agree with the source (no undeclared CSS-styled slot, no unused state)', () => {
    expect(compareDescriptorToSource(parsed, { ts: workspaceShellTs, css: workspaceShellCss })).toEqual([])
  })
})
