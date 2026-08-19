import { describe, it, expect, afterEach } from 'vitest'
import { UISourceListElement } from './source-list.ts'
import { cleanSources, sourcesProp } from './source-list-model.ts'
import { whenFlushed } from '../../reactive/index.ts'

// source-list.test.ts — jsdom behaviour probes for the source-attribution aggregate leaf (ADR-0214,
// GH #1394). jsdom is blind to painted geometry and computed-style ink — the list rhythm lives in
// source-list.browser.test.ts; this file covers everything jsdom CAN see: the drop-malformed-entries
// cleaner (model), the codec, the per-entry safeHref gate (the two tracker-named component tests), and
// the DOM structure the render effect builds.

const mounted: HTMLElement[] = []
const mount = (): UISourceListElement => {
  const el = document.createElement('ui-source-list') as UISourceListElement
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

describe('cleanSources — the drop-malformed-entries cleaner, by construction (ADR-0214 cl.2, GH #1394)', () => {
  it('a non-array input yields []', () => {
    for (const input of [null, undefined, 'x', 42, true, {}]) expect(cleanSources(input)).toEqual([])
  })

  it('a well-formed entry survives verbatim', () => {
    expect(
      cleanSources([{ href: 'https://example.com/a', title: 'A', snippet: 'a snippet' }, { href: 'https://example.com/b', title: 'B' }]),
    ).toEqual([
      { href: 'https://example.com/a', title: 'A', snippet: 'a snippet' },
      { href: 'https://example.com/b', title: 'B' },
    ])
  })

  it('DROPS every entry with no real title — never coerces, never renders a titleless entry', () => {
    const rows = cleanSources([
      { href: 'https://example.com', title: undefined }, // title absent
      { href: 'https://example.com', title: null },
      { href: 'https://example.com', title: '' }, // empty string
      { href: 'https://example.com', title: '   ' }, // whitespace-only
      { href: 'https://example.com' }, // title missing entirely
      { href: 'https://example.com', title: 42 }, // non-string title
      'not an object',
      null,
      42,
      ['href', 'title'],
      { href: 'https://example.com', title: 'Kept' },
    ])
    expect(rows).toEqual([{ href: 'https://example.com', title: 'Kept' }])
  })

  it('a malformed/absent href does NOT drop the entry — it degrades to "" (the safeHref gate denies it later, ADR-0214 cl.2)', () => {
    expect(cleanSources([{ title: 'No href field' }])).toEqual([{ href: '', title: 'No href field' }])
    expect(cleanSources([{ href: 42, title: 'Numeric href' }])).toEqual([{ href: '', title: 'Numeric href' }])
    expect(cleanSources([{ href: null, title: 'Null href' }])).toEqual([{ href: '', title: 'Null href' }])
  })

  it('a non-string/whitespace-only snippet drops the FIELD, never the entry', () => {
    expect(cleanSources([{ href: 'https://example.com', title: 'T', snippet: 42 }])).toEqual([{ href: 'https://example.com', title: 'T' }])
    expect(cleanSources([{ href: 'https://example.com', title: 'T', snippet: '   ' }])).toEqual([{ href: 'https://example.com', title: 'T' }])
    expect(cleanSources([{ href: 'https://example.com', title: 'T', snippet: null }])).toEqual([{ href: 'https://example.com', title: 'T' }])
  })

  it('preserves order; duplicate titles both survive (no key identity imposed — index markers are POSITION, never authored)', () => {
    expect(cleanSources([{ href: '', title: 'Same' }, { href: '', title: 'Same' }])).toEqual([
      { href: '', title: 'Same' },
      { href: '', title: 'Same' },
    ])
  })
})

describe('sourcesProp — the safe JSON codec (the descriptionRowsProp/tableRowsProp shape)', () => {
  it('from(null) → [] (attribute absent/removed), never null', () => {
    expect(sourcesProp.type.from(null)).toEqual([])
  })

  it('malformed attribute JSON falls back to [] — no throw reaches attributeChangedCallback', () => {
    expect(sourcesProp.type.from('{not json')).toEqual([])
  })

  it('well-formed JSON is HARDENED on the way in (the property never carries an un-hardened array)', () => {
    expect(sourcesProp.type.from('[{"href":"https://x","title":""},{"href":"https://y","title":"kept"}]')).toEqual([
      { href: 'https://y', title: 'kept' },
    ])
  })

  it('to() round-trips as JSON text', () => {
    expect(sourcesProp.type.to([{ href: 'https://x', title: 'A' }])).toBe('[{"href":"https://x","title":"A"}]')
  })
})

describe('UISourceListElement — upgrade + typed props', () => {
  it('defaults: sources=[]; renders nothing', () => {
    const el = mount()
    expect(el).toBeInstanceOf(UISourceListElement)
    expect(el.sources).toEqual([])
    expect(el.querySelector('[data-part="row"]')).toBeNull()
  })

  it('self-defines as ui-source-list, guarded against double-define', () => {
    expect(customElements.get('ui-source-list')).toBe(UISourceListElement)
    expect(() => {
      if (!customElements.get('ui-source-list')) customElements.define('ui-source-list', UISourceListElement)
    }).not.toThrow()
  })

  it('mints host role="list" via ElementInternals, never a host role attribute (ADR-0214 Context fact 4)', () => {
    const el = mount()
    expect(el.hasAttribute('role')).toBe(false) // internals-role never reflects to a host attribute
  })
})

describe('UISourceListElement — the DOM the render effect builds (ADR-0214 cl.3 anatomy floor)', () => {
  it('one row per surviving entry: div[data-part=row][role=listitem] › index, title, DOM order index → title', async () => {
    const el = mount()
    el.sources = [
      { href: 'https://example.com/a', title: 'Source A' },
      { href: 'https://example.com/b', title: 'Source B' },
    ]
    await whenFlushed()
    const rows = [...el.querySelectorAll('[data-part="row"]')] as HTMLElement[]
    expect(rows.length).toBe(2)
    for (const row of rows) expect(row.getAttribute('role')).toBe('listitem')
    const firstParts = [...rows[0]!.children].map((c) => c.getAttribute('data-part'))
    expect(firstParts).toEqual(['index', 'title']) // no snippet ⇒ two parts only, reading order index → title
    expect(rows[0]!.querySelector('[data-part="index"]')?.textContent).toBe('1')
    expect(rows[1]!.querySelector('[data-part="index"]')?.textContent).toBe('2')
  })

  it('index markers are the array POSITION (1-based) — never a producer-authored field', async () => {
    const el = mount()
    el.sources = [{ href: '', title: 'X' }, { href: '', title: 'Y' }, { href: '', title: 'Z' }]
    await whenFlushed()
    const indexes = [...el.querySelectorAll('[data-part="index"]')].map((n) => n.textContent)
    expect(indexes).toEqual(['1', '2', '3'])
  })

  it('an optional snippet renders as its own part, absent when the entry has none', async () => {
    const el = mount()
    el.sources = [{ href: '', title: 'With snippet', snippet: 'supporting text' }, { href: '', title: 'Without' }]
    await whenFlushed()
    const rows = [...el.querySelectorAll('[data-part="row"]')] as HTMLElement[]
    expect(rows[0]!.querySelector('[data-part="snippet"]')?.textContent).toBe('supporting text')
    expect(rows[1]!.querySelector('[data-part="snippet"]')).toBeNull()
  })

  it('a sources swap re-renders whole (whole-swap semantics); clearing renders nothing', async () => {
    const el = mount()
    el.sources = [{ href: '', title: 'A' }]
    await whenFlushed()
    expect(el.querySelectorAll('[data-part="row"]').length).toBe(1)
    el.sources = [{ href: '', title: 'B' }, { href: '', title: 'C' }]
    await whenFlushed()
    expect([...el.querySelectorAll('[data-part="title"]')].map((n) => n.textContent)).toEqual(['B', 'C'])
    el.sources = []
    await whenFlushed()
    expect(el.querySelector('[data-part="row"]')).toBeNull()
  })

  it('titles render as TEXT, never markup (textContent assignment — no injection surface)', async () => {
    const el = mount()
    el.sources = [{ href: '', title: '<img src=x onerror=alert(1)>' }]
    await whenFlushed()
    expect(el.querySelector('img')).toBeNull()
    expect(el.querySelector('[data-part="title"]')?.textContent).toBe('<img src=x onerror=alert(1)>')
  })
})

describe('UISourceListElement — the per-entry safeHref gate (ADR-0214 cl.2/cl.3; ADR-0114 verbatim, GH #1394)', () => {
  it('an ALLOWED href renders a real gated <a> — byte-identical href + the fixed rel/target policy', async () => {
    const el = mount()
    el.sources = [{ href: 'https://example.com/report', title: 'Q3 Report' }]
    await whenFlushed()
    const title = el.querySelector('[data-part="title"]') as HTMLAnchorElement
    expect(title.tagName).toBe('A')
    expect(title.getAttribute('href')).toBe('https://example.com/report') // byte-identical — the gate never rewrites
    expect(title.getAttribute('rel')).toBe('noopener noreferrer')
    expect(title.getAttribute('target')).toBe('_blank')
    expect(title.textContent).toBe('Q3 Report')
  })

  it('a mailto: href is also ALLOWED (the fleet scheme allowlist)', async () => {
    const el = mount()
    el.sources = [{ href: 'mailto:cite@example.com', title: 'Contact' }]
    await whenFlushed()
    const title = el.querySelector('[data-part="title"]') as HTMLElement
    expect(title.tagName).toBe('A')
    expect(title.getAttribute('href')).toBe('mailto:cite@example.com')
  })

  it('a DENIED scheme (javascript:) STRIPS the link — the entry still renders as text, never an announced-broken anchor', async () => {
    const el = mount()
    el.sources = [{ href: 'javascript:alert(1)', title: 'An untrusted source' }]
    await whenFlushed()
    const title = el.querySelector('[data-part="title"]') as HTMLElement
    expect(title.tagName).toBe('SPAN') // no <a> at all — never an <a> with no href
    expect(title.hasAttribute('href')).toBe(false)
    expect(title.hasAttribute('rel')).toBe(false)
    expect(title.hasAttribute('target')).toBe(false)
    expect(title.textContent).toBe('An untrusted source') // attribution survives
    expect(el.querySelectorAll('[data-part="row"]').length).toBe(1) // the entry itself is NOT dropped
  })

  it('every other denied scheme (data:/file:/blob:/a bare custom scheme) also degrades to plain text', async () => {
    const el = mount()
    el.sources = [
      { href: 'data:text/html,<script>1</script>', title: 'data' },
      { href: 'file:///etc/passwd', title: 'file' },
      { href: 'blob:https://example.com/xyz', title: 'blob' },
      { href: 'custom-scheme://x', title: 'custom' },
    ]
    await whenFlushed()
    const titles = [...el.querySelectorAll('[data-part="title"]')]
    expect(titles.every((t) => t.tagName === 'SPAN')).toBe(true)
    expect(titles.map((t) => t.textContent)).toEqual(['data', 'file', 'blob', 'custom'])
  })

  it('an empty/absent href DENIES (the no-destination self-link trap, ADR-0114) — degrades to plain text', async () => {
    const el = mount()
    el.sources = [{ href: '', title: 'No destination' }]
    await whenFlushed()
    const title = el.querySelector('[data-part="title"]') as HTMLElement
    expect(title.tagName).toBe('SPAN')
    expect(title.hasAttribute('href')).toBe(false)
  })

  it('a mixed list gates EACH entry independently — one denied entry never affects its siblings', async () => {
    const el = mount()
    el.sources = [
      { href: 'https://example.com/allowed', title: 'Allowed' },
      { href: 'javascript:evil()', title: 'Denied' },
      { href: 'https://example.com/allowed-2', title: 'Allowed 2' },
    ]
    await whenFlushed()
    const titles = [...el.querySelectorAll('[data-part="title"]')] as HTMLElement[]
    expect(titles[0]!.tagName).toBe('A')
    expect(titles[1]!.tagName).toBe('SPAN')
    expect(titles[2]!.tagName).toBe('A')
  })
})
