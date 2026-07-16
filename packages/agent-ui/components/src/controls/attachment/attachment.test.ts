import { describe, it, expect } from 'vitest'
import { UIAttachmentElement } from './attachment.ts'

// attachment.test.ts — LLD-C5 jsdom behaviour probes (props/attributes, DOM shape, glyph derivation,
// name fallback, size-cell presence/absence, the deferred href leg). jsdom is blind to painted geometry
// and computed-style ink (SPEC-N2) — the whole-shape floor, truncation, and forced-colors legs live in
// attachment.browser.test.ts; this file covers everything jsdom CAN see: prop typing, attribute
// coercion, and the DOM structure the render effect builds.

describe('UIAttachmentElement — upgrade + typed props', () => {
  it('defaults: filename="", mimeType="", sizeBytes=null, href=""', () => {
    const el = document.createElement('ui-attachment') as UIAttachmentElement
    expect(el).toBeInstanceOf(UIAttachmentElement)
    expect(el.filename).toBe('')
    expect(el.mimeType).toBe('')
    expect(el.sizeBytes).toBeNull()
    expect(el.href).toBe('')
  })

  it('self-defines as ui-attachment, guarded against double-define', () => {
    expect(customElements.get('ui-attachment')).toBe(UIAttachmentElement)
    expect(() => {
      if (!customElements.get('ui-attachment')) customElements.define('ui-attachment', UIAttachmentElement)
    }).not.toThrow()
  })

  it('a mime-type="application/pdf" attribute (kebab, load-bearing) upgrades the mimeType property', () => {
    const el = document.createElement('ui-attachment') as UIAttachmentElement
    el.setAttribute('mime-type', 'application/pdf')
    document.body.append(el)
    expect(el.mimeType).toBe('application/pdf')
    el.remove()
  })

  it('a size-bytes="48200" attribute (kebab, load-bearing) upgrades to the typed sizeBytes number', () => {
    const el = document.createElement('ui-attachment') as UIAttachmentElement
    el.setAttribute('size-bytes', '48200')
    document.body.append(el)
    expect(el.sizeBytes).toBe(48200)
    el.remove()
  })
})

describe('UIAttachmentElement — DOM shape (SPEC-R8/R9/R10, LLD-C5)', () => {
  it('a fully-populated attachment renders glyph + body[name, meta]', async () => {
    const el = document.createElement('ui-attachment') as UIAttachmentElement
    el.filename = 'report.pdf'
    el.mimeType = 'application/pdf'
    el.sizeBytes = 48200
    document.body.append(el)
    await el.updateComplete

    const parts = [...el.children].map((c) => c.getAttribute('data-part'))
    expect(parts).toEqual(['glyph', 'body'])
    expect(el.querySelector('[data-part="glyph"]')?.tagName.toLowerCase()).toBe('ui-icon')
    expect(el.querySelector('[data-part="glyph"]')?.getAttribute('glyph')).toBe('file-pdf')
    expect(el.querySelector('[data-part="name"]')?.textContent).toBe('report.pdf')
    expect(el.querySelector('[data-part="meta"]')?.textContent).toBe('48.2 KB')
    el.remove()
  })

  it('SPEC-R8 AC2: empty name falls back to the category label — never an empty title', async () => {
    const el = document.createElement('ui-attachment') as UIAttachmentElement
    el.mimeType = 'image/png'
    document.body.append(el)
    await el.updateComplete
    expect(el.querySelector('[data-part="name"]')?.textContent).toBe('Image')
    el.remove()
  })

  it('SPEC-R9 AC2: absent sizeBytes ⇒ no meta cell (absent, not empty)', async () => {
    const el = document.createElement('ui-attachment') as UIAttachmentElement
    el.filename = 'notes.txt'
    el.mimeType = 'text/plain'
    document.body.append(el)
    await el.updateComplete
    expect(el.querySelector('[data-part="meta"]')).toBeNull()
    el.remove()
  })

  it('unknown/empty mimeType degrades to the default glyph + "File" label — never throws', async () => {
    const el = document.createElement('ui-attachment') as UIAttachmentElement
    expect(() => document.body.append(el)).not.toThrow()
    await el.updateComplete
    expect(el.querySelector('[data-part="glyph"]')?.getAttribute('glyph')).toBe('file')
    expect(el.querySelector('[data-part="name"]')?.textContent).toBe('File')
    el.remove()
  })

  it('the glyph carries no `label` — SPEC-R10 relies on ui-icon\'s OWN decorative default (proven in icon.test.ts)', async () => {
    const el = document.createElement('ui-attachment') as UIAttachmentElement
    el.filename = 'a.zip'
    el.mimeType = 'application/zip'
    document.body.append(el)
    await el.updateComplete
    const glyph = el.querySelector('[data-part="glyph"]') as HTMLElement & { label: string }
    expect(glyph.hasAttribute('label')).toBe(false)
    expect(glyph.label).toBe('') // ui-icon's own default → its connected() effect sets internals.ariaHidden='true'
    el.remove()
  })

  it('the host mints NO internals ARIA of its own (SPEC-R10 — real text is the whole accessible datum)', async () => {
    const el = document.createElement('ui-attachment') as UIAttachmentElement
    el.filename = 'a.zip'
    document.body.append(el)
    await el.updateComplete
    expect((el as unknown as { internals: ElementInternals }).internals.role).toBeNull()
    el.remove()
  })

  it('whole-swap rebuild: only glyph+body exist after any prop change (no leftover nodes)', async () => {
    const el = document.createElement('ui-attachment') as UIAttachmentElement
    el.filename = 'a.txt'
    el.mimeType = 'text/plain'
    document.body.append(el)
    await el.updateComplete
    expect(el.childElementCount).toBe(2)

    el.sizeBytes = 100
    await el.updateComplete
    expect(el.childElementCount).toBe(2) // glyph + body — meta lives INSIDE body, not a top-level child
    expect(el.querySelector('[data-part="body"]')?.childElementCount).toBe(2) // name + meta

    el.sizeBytes = null
    await el.updateComplete
    expect(el.querySelector('[data-part="body"]')?.childElementCount).toBe(1) // meta gone, not hidden
    el.remove()
  })
})

describe('UIAttachmentElement — the href prop exists but its rendering leg is DEFERRED (LLD-C6)', () => {
  it('href is a real, typed, settable prop (SPEC-R8\'s fourth wire-mirroring prop)', () => {
    const el = document.createElement('ui-attachment') as UIAttachmentElement
    el.href = 'https://example.com/report.pdf'
    expect(el.href).toBe('https://example.com/report.pdf')
  })

  it('a non-empty href does NOT change the name cell to an anchor in this pass — plain text only', async () => {
    const el = document.createElement('ui-attachment') as UIAttachmentElement
    el.filename = 'report.pdf'
    el.href = 'https://example.com/report.pdf'
    document.body.append(el)
    await el.updateComplete
    const name = el.querySelector('[data-part="name"]')
    expect(name?.tagName.toLowerCase()).toBe('span') // NOT 'a' — the LLD-C6 leg is a later, separate wave
    expect(el.querySelector('a')).toBeNull()
    el.remove()
  })
})
