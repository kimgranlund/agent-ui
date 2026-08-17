// flow-chrome.test.ts — ADR-0198 cl.3/cl.4/cl.5 (GH #1101): the shared end-of-flow chrome module.
// jsdom (ui-button is a custom element here — clicks are plain DOM events; the row's buttons are page
// chrome, so no ui-* event channel is asserted — the ADR-0153 vocabulary stays closed).
import { describe, it, expect, vi } from 'vitest'
import { readMetaLine } from './agent-runtime.ts'
import { createFlowChrome, isFlowEnd } from './flow-chrome.ts'

const flowEndEnvelope = readMetaLine('{"a2uiMeta":{"note":"All set!","flowEnd":true}}')
const plainEnvelope = readMetaLine('{"a2uiMeta":{"note":"which size?"}}')

describe('isFlowEnd — explicit-field detection only (ADR-0198)', () => {
  it('true for a peeled envelope carrying flowEnd: true', () => {
    expect(isFlowEnd(flowEndEnvelope)).toBe(true)
  })

  it('false for a note-only envelope — the safe-degrade law (negative control)', () => {
    expect(isFlowEnd(plainEnvelope)).toBe(false)
  })

  it('false for no envelope at all (a turn with no meta-line)', () => {
    expect(isFlowEnd(undefined)).toBe(false)
  })

  it('false for a malformed flowEnd the parser already dropped', () => {
    expect(isFlowEnd(readMetaLine('{"a2uiMeta":{"note":"hi","flowEnd":"true"}}'))).toBe(false)
  })
})

describe('createFlowChrome — the done/start-over row (ADR-0198 cl.3/cl.4)', () => {
  it('maybePresent appends the row on flowEnd: Done (solid) + Start over (ghost), a labeled group', () => {
    const mount = document.createElement('div')
    const chrome = createFlowChrome({ onStartOver: () => {} })
    expect(chrome.maybePresent(flowEndEnvelope, mount)).toBe(true)
    const row = mount.querySelector('.flow-chrome')!
    expect(row).not.toBeNull()
    expect(row.getAttribute('role')).toBe('group')
    expect(row.getAttribute('aria-label')).toBe('Flow complete')
    const done = row.querySelector('ui-button.flow-chrome-done')!
    const startOver = row.querySelector('ui-button.flow-chrome-start-over')!
    expect(done.textContent).toBe('Done')
    expect(done.hasAttribute('variant')).toBe(false) // solid — the default action
    expect(startOver.textContent).toBe('Start over')
    expect(startOver.getAttribute('variant')).toBe('ghost')
    expect(chrome.active).toBe(true)
  })

  it('does NOT present without flowEnd — never a heuristic (the negative control)', () => {
    const mount = document.createElement('div')
    const chrome = createFlowChrome({ onStartOver: () => {} })
    expect(chrome.maybePresent(plainEnvelope, mount)).toBe(false)
    expect(chrome.maybePresent(undefined, mount)).toBe(false)
    expect(mount.querySelector('.flow-chrome')).toBeNull()
    expect(chrome.active).toBe(false)
  })

  it('one completion, one row — a second maybePresent while a row is up is a no-op', () => {
    const mount = document.createElement('div')
    const chrome = createFlowChrome({ onStartOver: () => {} })
    expect(chrome.maybePresent(flowEndEnvelope, mount)).toBe(true)
    expect(chrome.maybePresent(flowEndEnvelope, mount)).toBe(false)
    expect(mount.querySelectorAll('.flow-chrome').length).toBe(1)
  })

  it('Done dismisses the row, fires onDone, and NEVER fires onStartOver (nothing destroyed)', () => {
    const mount = document.createElement('div')
    const onDone = vi.fn()
    const onStartOver = vi.fn()
    const chrome = createFlowChrome({ onStartOver, onDone })
    chrome.maybePresent(flowEndEnvelope, mount)
    mount.querySelector<HTMLElement>('.flow-chrome-done')!.click()
    expect(mount.querySelector('.flow-chrome')).toBeNull()
    expect(chrome.active).toBe(false)
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onStartOver).not.toHaveBeenCalled()
  })

  it('Start over dismisses the row and routes to the injected page reset path', () => {
    const mount = document.createElement('div')
    const onStartOver = vi.fn()
    const chrome = createFlowChrome({ onStartOver })
    chrome.maybePresent(flowEndEnvelope, mount)
    mount.querySelector<HTMLElement>('.flow-chrome-start-over')!.click()
    expect(mount.querySelector('.flow-chrome')).toBeNull()
    expect(onStartOver).toHaveBeenCalledTimes(1)
  })

  it('dismiss() clears a mounted row without firing any callback (the page-reset hook), and is safe when no row is up', () => {
    const mount = document.createElement('div')
    const onDone = vi.fn()
    const onStartOver = vi.fn()
    const chrome = createFlowChrome({ onStartOver, onDone })
    chrome.dismiss() // no row yet — safe
    chrome.maybePresent(flowEndEnvelope, mount)
    chrome.dismiss()
    expect(mount.querySelector('.flow-chrome')).toBeNull()
    expect(onDone).not.toHaveBeenCalled()
    expect(onStartOver).not.toHaveBeenCalled()
  })

  it('a NEW completion after dismissal presents again (per-flow, not once-per-page)', () => {
    const mount = document.createElement('div')
    const chrome = createFlowChrome({ onStartOver: () => {} })
    chrome.maybePresent(flowEndEnvelope, mount)
    chrome.dismiss()
    expect(chrome.maybePresent(flowEndEnvelope, mount)).toBe(true)
  })
})
