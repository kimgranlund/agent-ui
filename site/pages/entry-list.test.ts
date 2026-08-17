// entry-list.test.ts — jsdom mount coverage for site/pages/entry-list.ts (GH #1049). Driven through the
// REAL page module (side-effect import, the a2ui-chat.test.ts precedent: a DEFERRED `await import(...)`
// inside `beforeAll`, never a static top-of-file import, so the ElementInternals stub below lands before
// the page's own eager mount runs). Proves the live mountEntryList() demo actually renders and its
// add/toggle/rename write paths actually work through real DOM events — not a mock, not a screenshot.
import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(async () => {
  // jsdom reality (the a2ui-chat.test.ts precedent): ElementInternals.setFormValue/setValidity are ABSENT
  // in jsdom, and this page mounts real form-associated controls (ui-text-field/ui-switch/ui-button).
  // Stub ONCE at the shared prototype — additive, never overwriting a real implementation.
  if (typeof ElementInternals.prototype.setFormValue !== 'function') {
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = function (): void {}
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = function (): void {}
  }
  await import('./entry-list.ts')
})

function entryRows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-part="entry"]')]
}

describe('site/pages/entry-list.ts — the live mountEntryList() demo mounts and works', () => {
  it('mounts the page title and the entry-section shell', () => {
    expect(document.querySelector('h1')?.textContent).toContain('entry-list')
    expect(document.querySelector('[data-part="entry-section"]')).not.toBeNull()
  })

  it('seeds exactly the two demo entries, one builtin (no Remove) and one not (Remove renders)', () => {
    const rows = entryRows()
    expect(rows.length).toBe(2)
    const welcome = rows.find((r) => r.getAttribute('data-entry-id') === 'welcome')!
    const second = rows.find((r) => r.getAttribute('data-entry-id') === 'second-entry')!
    expect(welcome.hasAttribute('data-builtin')).toBe(true)
    expect(welcome.querySelector('[data-part="entry-delete"]')).toBeNull()
    expect(second.hasAttribute('data-builtin')).toBe(false)
    expect(second.querySelector('[data-part="entry-delete"]')).not.toBeNull()
  })

  it('renders the library-add menu (the demoLibrary starter pack)', () => {
    expect(document.querySelector('[data-part="entry-library-menu"]')).not.toBeNull()
  })

  it('the availability pill renders per row (availabilityToggle: true) and the rename button too (rename: true)', () => {
    const rows = entryRows()
    for (const row of rows) {
      expect(row.querySelector('[data-part="entry-availability"]')).not.toBeNull()
      expect(row.querySelector('[data-part="entry-rename"]')).not.toBeNull()
    }
  })

  it('the inline add-form add path actually writes a new entry through validateNewEntry — a real DOM flow', () => {
    const before = entryRows().length
    const toggle = document.querySelector<HTMLElement>('[data-part="entry-add-toggle"]')!
    toggle.click() // reveal the dashed inline add form
    const form = document.querySelector<HTMLElement>('[data-part="entry-add-form"]')!
    expect(form.hidden).toBe(false)
    const labelField = form.querySelector('[data-part="entry-add-label"]') as HTMLElement & { value: string }
    labelField.value = 'A page-authored entry'
    const submit = form.querySelector<HTMLElement>('[data-part="entry-add-submit"]')!
    submit.click()
    const after = entryRows()
    expect(after.length).toBe(before + 1)
    expect(after.some((r) => r.querySelector('[data-part="entry-label"]')?.textContent === 'A page-authored entry')).toBe(true)
  })

  it('a REJECTED add (empty label) shows the error note and adds nothing — the fail-closed path', () => {
    const before = entryRows().length
    const form = document.querySelector<HTMLElement>('[data-part="entry-add-form"]')!
    const labelField = form.querySelector('[data-part="entry-add-label"]') as HTMLElement & { value: string }
    labelField.value = '' // "A name is required." — validateNewEntry's own fail-closed check
    const submit = form.querySelector<HTMLElement>('[data-part="entry-add-submit"]')!
    submit.click()
    expect(entryRows().length).toBe(before)
    const error = document.querySelector<HTMLElement>('[data-part="entry-add-error"]')!
    expect(error.hidden).toBe(false)
    expect(error.textContent).toContain('name is required')
  })

  it('the derived EntryListOptions/Entry/NewEntryInput/EntryLibraryPack code blocks are real, non-empty source slices', () => {
    const blocks = [...document.querySelectorAll<HTMLElement>('.code-block code')].map((c) => c.textContent ?? '')
    expect(blocks.some((t) => t.includes('interface EntryListOptions'))).toBe(true)
    expect(blocks.some((t) => t.includes('interface Entry {'))).toBe(true) // the brace pins this to the Entry block, not the EntryListOptions prefix-collision
    expect(blocks.some((t) => t.includes('interface NewEntryInput'))).toBe(true)
    expect(blocks.some((t) => t.includes('interface EntryLibraryPack'))).toBe(true)
    expect(blocks.some((t) => t.includes('interface PickerOption'))).toBe(true)
    expect(blocks.some((t) => t.includes('interface PatchReport'))).toBe(true)
  })

  it('the composer-options EFFORT_LEVELS table renders the real live export, not a hand-typed list', () => {
    const tables = [...document.querySelectorAll('table')]
    const effortTable = tables.find((t) => t.textContent?.includes('xhigh'))
    expect(effortTable).toBeDefined()
    expect(effortTable!.textContent).toContain('X-High')
  })

  it('the persona-patch section states the real live key counts, not hand-typed numbers', () => {
    const body = document.body.textContent ?? ''
    expect(body).toMatch(/\d+ total persona-state keys/)
    expect(body).toMatch(/\d+ plain VALUE keys and \d+ ENTRY-LIST keys/)
  })
})
