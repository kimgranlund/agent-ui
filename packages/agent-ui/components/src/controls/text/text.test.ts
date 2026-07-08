import { describe, it, expect } from 'vitest'
// Raw-text fs read — same reverse-coupling fs-read pattern the descriptor/
// css probes in this folder use.
import { readFileSync } from 'node:fs'
import { UITextElement } from './text.ts'
declare const process: { cwd(): string }

// ADR-0078 / text.md — UITextElement (Display-class leaf; three orthogonal props — variant/size/as — the
// stamping mechanism; void render (as='none'); self-define). Named probes: text-upgrades ·
// text-props-typed · text-internals-never-set · text-void-render · plus a dedicated stamping-mechanics
// block (#restamp/#heal), which the ADR assigns primarily to the browser suite (real rendering/geometry)
// but is ALSO cheap and valuable to pin at the jsdom/logic level — jsdom fully supports the plain DOM APIs
// (createElement/appendChild/replaceWith/MutationObserver) the mechanism is built from.

// A throwaway subclass re-exposing the protected `internals`, so a probe can prove ElementInternals is
// NEVER touched (the ADR-0025 role/ariaLevel path is deleted outright, ADR-0078 cl.4).
class ProbeText extends UITextElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-text-probe', ProbeText)

/** Wait one microtask tick — long enough for a MutationObserver callback queued earlier to run (FIFO). */
const tick = (): Promise<void> => new Promise((resolve) => queueMicrotask(resolve))

describe('UITextElement — define/upgrade + props (text-upgrades)', () => {
  it('text-upgrades: <ui-text> upgrades to UITextElement; variant/size/as default to body/md/none', () => {
    const el = document.createElement('ui-text') as UITextElement
    document.body.append(el)
    expect(el).toBeInstanceOf(UITextElement)
    expect(el.variant).toBe('body')
    expect(el.size).toBe('md')
    expect(el.as).toBe('none')
    // Defaults are NOT pre-reflected (same as ui-button's variant default) — no repoint block is needed
    // for the base row, and `as='none'` never installs a stamp.
    expect(el.getAttribute('variant')).toBeNull()
    expect(el.getAttribute('size')).toBeNull()
    expect(el.getAttribute('as')).toBeNull()
    el.remove()
  })

  it('text-self-define: registered as ui-text, guarded against double-define', () => {
    expect(customElements.get('ui-text')).toBe(UITextElement)
    expect(() => {
      if (!customElements.get('ui-text')) customElements.define('ui-text', UITextElement)
    }).not.toThrow()
  })
})

describe('UITextElement — props are typed literal unions, not bare strings (text-props-typed)', () => {
  it('variant/size/as reject an out-of-union value at compile time', () => {
    const fn = (): void => {
      const el = new UITextElement()
      el.variant = 'display'
      el.variant = 'lead'
      // @ts-expect-error — 'h1' is not a variant member (that conflation is exactly what ADR-0078 undoes)
      el.variant = 'h1'
      // @ts-expect-error — a bare string is wider than the union
      el.variant = 'x' as string

      el.size = 'sm'
      el.size = 'lg'
      // @ts-expect-error — 'xl' is not a size member
      el.size = 'xl'
      // @ts-expect-error — a bare string is wider than the union
      el.size = 'x' as string

      el.as = 'h4'
      el.as = 'blockquote'
      // @ts-expect-error — 'div' is not a stampable tag
      el.as = 'div'
      // @ts-expect-error — a bare string is wider than the union
      el.as = 'x' as string
    }
    expect(typeof fn).toBe('function') // never invoked; the type errors above are the assertion
  })

  it('a JS-set variant/size/as reflects to its attribute (the CSS [variant][size] hook)', () => {
    const el = new UITextElement()
    document.body.append(el)
    el.variant = 'headline'
    el.size = 'lg'
    el.as = 'h2'
    expect(el.getAttribute('variant')).toBe('headline')
    expect(el.getAttribute('size')).toBe('lg')
    expect(el.getAttribute('as')).toBe('h2')
    el.remove()
  })
})

describe('UITextElement — ElementInternals is NEVER touched (text-internals-never-set, ADR-0078 cl.4)', () => {
  it('role/ariaLevel stay null for every heading `as`, and no host role/aria-* attribute appears', async () => {
    for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'blockquote'] as const) {
      const el = new ProbeText()
      el.as = tag
      document.body.append(el)
      await el.updateComplete
      expect(el.probeInternals.role, `${tag}: internals.role`).toBeNull()
      expect(el.probeInternals.ariaLevel, `${tag}: internals.ariaLevel`).toBeNull()
      expect(el.getAttribute('role'), `${tag}: no host role attr`).toBeNull()
      expect(el.hasAttribute('aria-level'), `${tag}: no host aria-level attr`).toBe(false)
      el.remove()
    }
  })

  it('`variant` alone has zero effect on internals, even at variant=display size=lg', () => {
    const el = new ProbeText()
    el.variant = 'display'
    el.size = 'lg'
    document.body.append(el)
    expect(el.probeInternals.role).toBeNull()
    el.remove()
  })
})

describe('UITextElement — zero residue across connect/disconnect (C10)', () => {
  it('text-effects-residue: the restamp effect + heal observer die on disconnect; reconnect re-installs exactly once', async () => {
    const el = new UITextElement()
    el.as = 'h1'
    el.textContent = 'Heading'
    document.body.append(el) // connect → connected() installs the restamp effect + observer; as=h1 → stamps
    await el.updateComplete
    expect(el.querySelector('h1')?.textContent).toBe('Heading') // stamp installed while connected

    el.remove() // disconnect → scope disposed (effect dies) + observer explicitly disconnected
    // Mutate host children directly WHILE disconnected — a live observer would heal this; a dead one won't.
    el.appendChild(document.createTextNode('stray'))
    await tick()
    await tick()
    // The stray text landed loose, NOT adopted into the (now-detached, dead) stamp — proof nothing leaked.
    expect(Array.from(el.childNodes).some((n) => n.textContent === 'stray' && n.parentNode === el)).toBe(true)

    document.body.append(el) // reconnect → connected() re-runs → exactly ONE fresh effect + observer install
    await el.updateComplete
    // The fresh effect re-installs exactly one stamp + observer; the same-tag (h1) #restamp is a no-op, so the
    // loose 'stray' node stays a host sibling until the NEXT mutation heals it — the single h1 proves a fresh
    // install (not a stacked leak from the old instance), not that the stray was already re-adopted.
    expect(el.querySelectorAll('h1').length).toBe(1)
    el.remove()
  })
})

describe('UITextElement — void render + slotted textContent, as="none" (text-void-render)', () => {
  it("text-void-render: render() is void — the user's light-DOM children are NOT clobbered", () => {
    const el = new UITextElement()
    el.textContent = 'Hello world'
    document.body.append(el) // connect → render effect runs render() → void → no commit; as='none' → no stamp
    expect(el.textContent).toBe('Hello world')
    expect(el.childElementCount).toBe(0) // no stamp element inserted
    el.remove()
  })

  it('slotted child nodes survive connect + disconnect cycle (host-as-content, ADR-0006)', () => {
    const el = new UITextElement()
    el.innerHTML = '<span>Display text</span>'
    document.body.append(el)
    expect(el.querySelector('span')?.textContent).toBe('Display text')
    expect(el.childElementCount).toBe(1) // untouched
    el.remove()
  })
})

// ── Stamping mechanics (#restamp / #heal) — jsdom-level logic pins (ADR-0078 cl.4 / B3) ──────────────
// The real-rendering/geometry proofs (computed font-size, zero geometry delta, forced-colors) live in
// text.browser.test.ts per the ADR; these probes pin the DOM-manipulation LOGIC (node identity, the
// create/replace/unwrap branches, and the two heal paths), which jsdom's plain DOM APIs prove just as well
// — and far faster to iterate on than the cross-engine browser suite.
describe('UITextElement — stamping create/replace/unwrap (node identity preserved)', () => {
  it('as="h4" wraps existing children in a real <h4>, moving the SAME node (not a clone)', async () => {
    const el = new UITextElement()
    el.textContent = 'Section'
    document.body.append(el)
    const textNode = el.firstChild
    el.as = 'h4'
    await el.updateComplete
    const h4 = el.querySelector('h4')
    expect(h4).not.toBeNull()
    expect(h4?.firstChild).toBe(textNode) // the exact same Text node, moved — never cloned
    expect(el.childElementCount).toBe(1)
    el.remove()
  })

  it('as change h4→p re-stamps into a different real element, same content node', async () => {
    const el = new UITextElement()
    el.as = 'h4'
    el.textContent = 'Section'
    document.body.append(el)
    await el.updateComplete
    const textNode = el.querySelector('h4')?.firstChild
    el.as = 'p'
    await el.updateComplete
    expect(el.querySelector('h4')).toBeNull()
    const p = el.querySelector('p')
    expect(p).not.toBeNull()
    expect(p?.firstChild).toBe(textNode) // content survives the swap by reference
    el.remove()
  })

  it('as change h4→h4 (same tag) is a no-op — the stamp element instance is NOT replaced', async () => {
    const el = new UITextElement()
    el.as = 'h4'
    el.textContent = 'Section'
    document.body.append(el)
    await el.updateComplete
    const h4 = el.querySelector('h4')
    el.as = 'h4' // re-set to the same value
    await el.updateComplete
    expect(el.querySelector('h4')).toBe(h4) // same element instance — untouched
  })

  it('as change h4→none unwraps: content returns to being direct host children', async () => {
    const el = new UITextElement()
    el.as = 'h4'
    el.textContent = 'Section'
    document.body.append(el)
    await el.updateComplete
    el.as = 'none'
    await el.updateComplete
    expect(el.querySelector('h4')).toBeNull()
    expect(el.childElementCount).toBe(0) // no stamp element left behind
    expect(el.textContent).toBe('Section') // content preserved
    el.remove()
  })
})

// ── ADR-0106 — `truncate` + the unconditional `title` mirror (CSS-only, Kim's ratification ruling) ──────
describe('UITextElement — truncate prop (ADR-0106)', () => {
  it('defaults to false, not pre-reflected; a JS-set value reflects to [truncate]', () => {
    const el = new UITextElement()
    document.body.append(el)
    expect(el.truncate).toBe(false)
    expect(el.getAttribute('truncate')).toBeNull()
    el.truncate = true
    expect(el.getAttribute('truncate')).toBe('')
    el.remove()
  })

  it('rejects a non-boolean at compile time (typed prop, not a bare value)', () => {
    const fn = (): void => {
      const el = new UITextElement()
      el.truncate = true
      el.truncate = false
      // @ts-expect-error — truncate is boolean, not a string
      el.truncate = 'x'
    }
    expect(typeof fn).toBe('function') // never invoked; the type errors above are the assertion
  })
})

describe('UITextElement — the grep-able ResizeObserver absence (ADR-0106 Acceptance leg)', () => {
  it('text.ts never references ResizeObserver — the CSS-only ruling, mechanically enforced', () => {
    const source = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/text/text.ts`, 'utf8') as string
    expect(source).not.toMatch(/ResizeObserver/)
  })
})

// ── ADR-0109 — `emphasis`: schema-only, the fifth orthogonal axis (weight INTENT, CSS-only) ────────────
describe('UITextElement — emphasis prop (ADR-0109)', () => {
  it('defaults to false, not pre-reflected; a JS-set value reflects to [emphasis]', () => {
    const el = new UITextElement()
    document.body.append(el)
    expect(el.emphasis).toBe(false)
    expect(el.getAttribute('emphasis')).toBeNull()
    el.emphasis = true
    expect(el.getAttribute('emphasis')).toBe('')
    el.remove()
  })

  it('rejects a non-boolean at compile time (typed prop, not a bare value)', () => {
    const fn = (): void => {
      const el = new UITextElement()
      el.emphasis = true
      el.emphasis = false
      // @ts-expect-error — emphasis is boolean, not a string
      el.emphasis = 'x'
    }
    expect(typeof fn).toBe('function') // never invoked; the type errors above are the assertion
  })

  it('un-reflects [emphasis] when set back to false', () => {
    const el = new UITextElement()
    document.body.append(el)
    el.emphasis = true
    expect(el.getAttribute('emphasis')).toBe('')
    el.emphasis = false
    expect(el.getAttribute('emphasis')).toBeNull()
    el.remove()
  })
})

describe('UITextElement — emphasis is schema-only, zero new runtime machinery (ADR-0109 Acceptance leg)', () => {
  it('text.ts installs no new effect/observer for emphasis — the SAME two effects + one observer as before', () => {
    const source = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/text/text.ts`, 'utf8') as string
    // Exactly two `this.effect(` installs (the restamp effect + the title-mirror effect) — emphasis adds none.
    expect((source.match(/this\.effect\(/g) ?? []).length).toBe(2)
    // Exactly one MutationObserver installation (the existing heal/title-sync observer) — emphasis adds none.
    expect((source.match(/new MutationObserver/g) ?? []).length).toBe(1)
    // `emphasis` never appears inside connected()'s body — it is a schema entry only, wired to nothing.
    const connectedBody = source.slice(source.indexOf('protected connected()'), source.indexOf('protected disconnected()'))
    expect(connectedBody).not.toMatch(/emphasis/)
  })
})

describe('UITextElement — the unconditional `title` mirror (ADR-0106 cl.3)', () => {
  it('mints title = trimmed textContent as soon as truncate is set', async () => {
    const el = new UITextElement()
    el.textContent = '  Padded title text  '
    document.body.append(el)
    await el.updateComplete
    expect(el.hasAttribute('title')).toBe(false) // truncate off by default — no mirror yet

    el.truncate = true
    await el.updateComplete
    expect(el.getAttribute('title')).toBe('Padded title text') // trimmed
    el.remove()
  })

  it('removes the mirrored title when truncate unsets', async () => {
    const el = new UITextElement()
    el.textContent = 'Section title'
    el.truncate = true
    document.body.append(el)
    await el.updateComplete
    expect(el.getAttribute('title')).toBe('Section title')

    el.truncate = false
    await el.updateComplete
    expect(el.hasAttribute('title')).toBe(false)
    el.remove()
  })

  it('refreshes the mirrored title on content change (the existing render/childList path)', async () => {
    const el = new UITextElement()
    el.textContent = 'Original title'
    el.truncate = true
    document.body.append(el)
    await el.updateComplete
    expect(el.getAttribute('title')).toBe('Original title')

    el.textContent = 'Updated title' // the A2UI bound-text path — a childList mutation on the host
    await tick()
    await tick()
    expect(el.getAttribute('title')).toBe('Updated title')
    el.remove()
  })

  it('never overwrites an author-set title — presence-checked before the mirror ever writes', async () => {
    const el = new UITextElement()
    el.textContent = 'Section title'
    el.setAttribute('title', 'A curated tooltip') // author-owned, set BEFORE truncate
    document.body.append(el)
    await el.updateComplete
    el.truncate = true
    await el.updateComplete
    expect(el.getAttribute('title')).toBe('A curated tooltip') // untouched

    // Not owned by the mirror ⇒ unsetting truncate must NOT remove the author's title either.
    el.truncate = false
    await el.updateComplete
    expect(el.getAttribute('title')).toBe('A curated tooltip')
    el.remove()
  })

  it('an author title set AFTER the mirror minted one is never clobbered — ownership is by VALUE (review-hardened)', async () => {
    const el = new UITextElement()
    el.textContent = 'Quarterly report'
    document.body.append(el)
    await el.updateComplete
    el.truncate = true
    await el.updateComplete
    expect(el.getAttribute('title')).toBe('Quarterly report') // mirror-minted

    el.setAttribute('title', 'The author takes over') // author write AFTER the mint
    el.textContent = 'Quarterly report (renamed)' // a content change fires the next sync
    await el.updateComplete
    await new Promise((r) => setTimeout(r, 0)) // let the childList observer flush
    expect(el.getAttribute('title')).toBe('The author takes over') // NOT clobbered

    // And the mirror must not remove the author's title on truncate-unset either.
    el.truncate = false
    await el.updateComplete
    expect(el.getAttribute('title')).toBe('The author takes over')
    el.remove()
  })

  it('the mirror still mints title on a stamped element (as ≠ none) — textContent aggregates through the stamp', async () => {
    const el = new UITextElement()
    el.as = 'h4'
    el.textContent = 'Heading text'
    el.truncate = true
    document.body.append(el)
    await el.updateComplete
    expect(el.querySelector('h4')?.textContent).toBe('Heading text')
    expect(el.getAttribute('title')).toBe('Heading text') // title lives on the HOST, not the stamp
    el.remove()
  })
})

describe('UITextElement — self-heal (#heal, ADR-0078 cl.4)', () => {
  it('parser-streamed adoption: a text node appended directly to the host is adopted into the stamp', async () => {
    const el = new UITextElement()
    el.as = 'h4'
    document.body.append(el) // connects with NO children yet — the parser-streamed case
    await el.updateComplete
    expect(el.querySelector('h4')).not.toBeNull() // an empty stamp already exists

    el.appendChild(document.createTextNode('Streamed in later')) // lands on the HOST, not the stamp
    await tick()
    await tick()
    expect(el.querySelector('h4')?.textContent).toBe('Streamed in later') // healed — adopted into the stamp
    expect(el.childElementCount).toBe(1) // still exactly one direct child (the stamp)
    el.remove()
  })

  it('textContent clobber: a raw host.textContent write destroys the stamp; heal re-stamps fresh', async () => {
    const el = new UITextElement()
    el.as = 'h4'
    el.textContent = 'Original'
    document.body.append(el)
    await el.updateComplete
    const originalStamp = el.querySelector('h4')
    expect(originalStamp).not.toBeNull()

    el.textContent = 'Bound text' // the A2UI bound-text path — replaces ALL children, stamp included
    await tick()
    await tick()
    const healedStamp = el.querySelector('h4')
    expect(healedStamp).not.toBeNull()
    expect(healedStamp).not.toBe(originalStamp) // a FRESH stamp — the stale one is never reused
    expect(healedStamp?.textContent).toBe('Bound text')
    expect(el.childElementCount).toBe(1)
    el.remove()
  })
})
