import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'
import type { UICodeEditorElement } from './editor.ts'
// The fleet's own link-opening policy constants (code-review finding 2 — cm-richtext.ts now calls
// `window.open(allowed, LINK_TARGET, LINK_REL)` instead of the old hardcoded `'_blank'`/`'noopener'`
// strings). Imported here so the test asserts against the SAME constants the fix imports, not a
// coincidentally-matching literal.
import { LINK_TARGET, LINK_REL } from '@agent-ui/components/controls/text'

/** Minimal CDP surface (the button-states.browser.test.ts precedent) — `cdp()`'s public type is empty; the
 *  playwright provider gives `.send` at runtime. Chromium-only (WebKit exposes no CDP forced-colors emulation). */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

// The cross-engine browser smoke for ui-code-editor (ADR-0139 cl.5). jsdom is BLIND to the CodeMirror path
// (codeMirrorCanMount() is false there, editor.test.ts covers the plain-surface + FACE contract) — so THIS
// leg, in a REAL engine (both Chromium and WebKit), is the only place the CM lazy-load, the markdown
// highlighting, and the progressive-enhancement HANDOFF are proven. Under proof:
//   [1] language="markdown" lazily loads + mounts CodeMirror ([data-part="cm"] + a live .cm-editor appears).
//   [2] the markdown pack highlights ('## Heading' yields a .tok-heading span — lang-markdown + HighlightStyle).
//   [3] the handoff preserves the in-progress value AND keeps focus (no lost input, no dropped focus).
//   [4] editing THROUGH CodeMirror drives value (surface→model) + the blur-with-change commit timing.
//   [5] a non-markdown language never mounts CM — the plain editable surface stays (editable-first).
//
// Side-effect imports — the load-bearing CSS order (ADR-0003): foundation roles + dimensional ramp FIRST,
// then the component sheet. Then `@agent-ui/code/editor` self-defines ui-code-editor; its own sheet colours
// the highlight tokens. The browser config resolves via real package `exports` (no aliasing).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/code/editor.css'
import '@agent-ui/code/editor'

const SIZED = 'style="inline-size: 320px; display:block"'

const mounted: HTMLElement[] = []
const mount = (markup: string): { wrap: HTMLElement; field: UICodeEditorElement } => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const field = wrap.querySelector('ui-code-editor') as UICodeEditorElement
  return { wrap, field }
}
afterEach(async () => {
  await userEvent.unhover(document.body)
  while (mounted.length) mounted.pop()?.remove()
})

const cmOf = (field: Element): HTMLElement | null => field.querySelector('[data-part="cm"]')
const cmContentOf = (field: Element): HTMLElement | null => field.querySelector('.cm-content')

// CodeMirror's default/history keymaps bind "Mod-*" — Cmd on Mac, Ctrl elsewhere (resolved off the REAL host
// platform Playwright reports, not the engine). Undo/select-all below must send the modifier CM itself expects.
const MOD = /mac/i.test(navigator.platform) ? 'Meta' : 'Control'
const modKey = (key: string): string => `{${MOD}>}${key}{/${MOD}}`

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] CodeMirror lazily loads + mounts for language="markdown" (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-code-editor — CodeMirror lazily mounts for language="markdown" (both engines)', () => {
  it('a plain editor renders IMMEDIATELY, then CodeMirror enhances it (the [data-part="cm"] + .cm-editor appear)', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" ${SIZED}></ui-code-editor>`)
    // editable-first: the plain surface is present synchronously, with zero CM loaded yet.
    expect(field.querySelector('[data-part="editor"]'), 'the plain editable surface must render immediately').not.toBeNull()

    await expect.poll(() => cmOf(field) !== null, { timeout: 5000 }).toBe(true)
    expect(field.querySelector('.cm-editor'), 'CodeMirror did not mount a live view').not.toBeNull()
    expect(cmContentOf(field), 'the CodeMirror content surface is absent').not.toBeNull()

    // Regression (duplicate-text bug): `editor.hidden = true` must actually collapse the plain fallback's
    // computed style, not just flip the DOM property/attribute — an author `display` declaration with no
    // `:not([hidden])` guard silently outranks the UA `[hidden] { display: none }` rule by cascade ORIGIN
    // alone, leaving the plain surface visibly stacked underneath the live CM view (both showing the same
    // document at once).
    const plain = field.querySelector('[data-part="editor"]') as HTMLElement
    expect(plain.hidden, 'the plain fallback must be marked hidden once CM takes over').toBe(true)
    expect(getComputedStyle(plain).display, 'the plain fallback is marked hidden but still renders — duplicate text').toBe('none')
  })

  it('a non-markdown language NEVER mounts CodeMirror — the plain editable surface stays (editable-first)', async () => {
    const { field } = mount(`<ui-code-editor language="plain" value="x" ${SIZED}></ui-code-editor>`)
    await new Promise((r) => setTimeout(r, 800)) // give any (absent) enhancement a real window to (not) happen
    expect(cmOf(field)).toBeNull()
    expect(field.querySelector('[data-part="editor"]')).not.toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  source mode reads as CODE (monospace) regardless of the host page's ambient font; richtext mode reads
//  as PROSE (the fleet sans) — both engines, both the plain fallback AND the CM-mounted surface
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-code-editor — source mode is monospace, richtext mode is the fleet sans (both surfaces, both engines)', () => {
  it('the plain fallback (pre-CM) renders source mode in monospace', () => {
    const { field } = mount(`<ui-code-editor language="markdown" value="# x" ${SIZED}></ui-code-editor>`)
    expect(getComputedStyle(field).fontFamily.toLowerCase()).toContain('monospace')
  })

  it('the CodeMirror-mounted surface stays monospace in source mode (CM inherits — not its own default)', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" value="# x" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    expect(getComputedStyle(cmContentOf(field)!).fontFamily.toLowerCase()).toContain('monospace')
  })

  it('richtext mode repoints the base surface to the fleet sans, not monospace', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" mode="richtext" value="# x" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    const family = getComputedStyle(cmContentOf(field)!).fontFamily.toLowerCase()
    expect(family).not.toContain('monospace')
    expect(family).toContain('sans-serif')
  })

  it('an inline code span inside richtext STAYS monospace (.rt-code) even though the surrounding prose is sans', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" mode="richtext" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    // the caret must park AWAY from the code span's line — a revealed construct renders raw with no
    // styling class under the GH #165 either/or, so a single-line fixture would never decorate at all.
    field.value = 'text `code` more\n\npark here'
    await expect.poll(() => cmContentOf(field)?.textContent?.includes('park'), { timeout: 2000 }).toBe(true)
    field.selectToEnd()
    await expect.poll(() => field.querySelector('.rt-code') !== null, { timeout: 5000 }).toBe(true)
    expect(getComputedStyle(field.querySelector('.rt-code')!).fontFamily.toLowerCase()).toContain('monospace')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] the markdown pack highlights (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-code-editor — markdown syntax highlighting renders (both engines)', () => {
  it('a "## Heading" line produces a .tok-heading span once CodeMirror + lang-markdown are live', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    field.value = '## Heading\n\nbody text' // real newlines via JS (an HTML attribute can't carry them)
    // the value flowed into the CM document (model→surface), and lang-markdown → HighlightStyle decorated the heading
    await expect.poll(() => cmContentOf(field)?.textContent?.includes('Heading'), { timeout: 2000 }).toBe(true)
    await expect.poll(() => field.querySelector('.tok-heading') !== null, { timeout: 2000 }).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] the enhancement handoff preserves value + focus (no lost input, no dropped focus)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-code-editor — the enhancement handoff preserves value + focus (both engines)', () => {
  it('a seeded value is intact in CodeMirror after the handoff (no content loss)', async () => {
    const seed = 'in-progress markdown **draft**'
    const { field } = mount(`<ui-code-editor language="markdown" value="${seed}" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmOf(field) !== null, { timeout: 5000 }).toBe(true)
    expect(field.value, 'the value changed across the handoff').toBe(seed)
    await expect.poll(() => cmContentOf(field)?.textContent?.includes('draft'), { timeout: 2000 }).toBe(true)
  })

  it('focus held on the plain editor is preserved onto CodeMirror across the handoff (no visible focus drop)', async () => {
    // NOTE (known test-authoring challenge, ADR-0139 report): the load-then-enhance handoff is async, so this
    // asserts the LOAD-BEARING property — focus is not permanently lost — via a poll for :focus-within staying
    // true once CM is live, rather than trying to catch the exact millisecond of the surface swap.
    const { field } = mount(`<ui-code-editor language="markdown" value="seed" ${SIZED}></ui-code-editor>`)
    const plain = field.querySelector('[data-part="editor"]') as HTMLElement
    plain.focus()
    expect(field.matches(':focus-within')).toBe(true)

    await expect.poll(() => cmOf(field) !== null, { timeout: 5000 }).toBe(true)
    // after the handoff the control still owns focus — it moved plain→CM, it did not drop to <body>.
    await expect.poll(() => field.matches(':focus-within'), { timeout: 2000 }).toBe(true)
  })

  it('host.focus() after the handoff forwards to the CodeMirror surface', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" value="x" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmOf(field) !== null, { timeout: 5000 }).toBe(true)
    field.focus()
    await expect.poll(() => field.matches(':focus-within'), { timeout: 2000 }).toBe(true)
    const content = cmContentOf(field) as HTMLElement
    expect(content.contains(document.activeElement) || document.activeElement === content).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [4] editing THROUGH CodeMirror drives value + the blur-with-change commit timing (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-code-editor — editing through CodeMirror (surface→model + commit timing, both engines)', () => {
  it('typing into the CodeMirror surface updates this.value (surface→model) and emits input', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    let inputs = 0
    field.addEventListener('input', () => inputs++)

    await userEvent.click(cmContentOf(field) as HTMLElement)
    await userEvent.keyboard('# Title')
    await expect.poll(() => field.value.includes('# Title'), { timeout: 2000 }).toBe(true)
    expect(inputs, 'input did not fire on CodeMirror edits').toBeGreaterThan(0)
  })

  it('change fires on blur-with-change only (never on each keystroke) — ui-textarea timing parity', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    let changes = 0
    field.addEventListener('change', () => changes++)

    await userEvent.click(cmContentOf(field) as HTMLElement)
    await userEvent.keyboard('typed while focused')
    expect(changes, 'change must NOT fire on keystrokes — commit is blur-with-change only').toBe(0)

    await userEvent.click(document.body) // real blur — NOW it commits
    await expect.poll(() => changes, { timeout: 2000 }).toBe(1)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [5] the reviewer's M1/M2/M3 contract fixes (both engines) — the exact regressions the fix pass closed
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-code-editor — M1/M2/M3 handoff + event-contract fixes (both engines)', () => {
  it('M1: characters typed into the plain surface DURING the CM load survive the handoff and commit on blur', async () => {
    // The exact failure mode the original tests missed (they seeded value via attribute BEFORE mount): type
    // into the plain editable surface WHILE CodeMirror is still lazy-loading, then let the handoff complete.
    const { field } = mount(`<ui-code-editor language="markdown" ${SIZED}></ui-code-editor>`)
    let changes = 0
    let changeValue: string | null = null
    field.addEventListener('change', () => { changes++; changeValue = field.value })

    field.focus() // forwards to the plain editor (CM not mounted yet)
    await userEvent.keyboard('typed during load') // some/all of this lands on the plain surface pre-handoff

    // value intact regardless of exactly when CM took over…
    await expect.poll(() => field.value, { timeout: 3000 }).toBe('typed during load')
    // …and STILL intact after CM has definitively mounted (M1a: no stale-doc clobber of pre-handoff keystrokes)
    await expect.poll(() => cmOf(field) !== null, { timeout: 5000 }).toBe(true)
    expect(field.value, 'the handoff dropped characters typed during load (M1a)').toBe('typed during load')
    await expect.poll(() => cmContentOf(field)?.textContent?.includes('typed during load'), { timeout: 2000 }).toBe(true)

    // blur commits the pre-handoff edit exactly once (M1b: the commit baseline survived the handoff's own focus)
    await userEvent.click(document.body)
    await expect.poll(() => changes, { timeout: 2000 }).toBe(1)
    expect(changeValue, 'the pre-handoff edit was silently never committed (M1b)').toBe('typed during load')
  })

  it('M2: a programmatic value set fires NO input once CodeMirror is mounted (matches the plain path + ui-textarea)', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" value="seed" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmOf(field) !== null, { timeout: 5000 }).toBe(true)
    let inputs = 0
    field.addEventListener('input', () => inputs++)

    field.value = 'set programmatically' // model→surface: drives CM via an annotated (programmatic) transaction
    await expect.poll(() => cmContentOf(field)?.textContent?.includes('programmatically'), { timeout: 2000 }).toBe(true)
    expect(inputs, 'a programmatic value set must not fire input (M2)').toBe(0)
  })

  it('M3: one keystroke in CodeMirror produces exactly one HOST-targeted input (no raw contentDOM input leaks)', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    let hostInputs = 0
    let leaked = 0
    field.addEventListener('input', (e) => { hostInputs++; if (e.target !== field) leaked++ })

    await userEvent.click(cmContentOf(field) as HTMLElement)
    await userEvent.keyboard('x')
    await expect.poll(() => hostInputs, { timeout: 2000 }).toBe(1)
    expect(leaked, 'a raw CodeMirror contentDOM input leaked through the host — two events per keystroke (M3)').toBe(0)
  })

  it('M4: `disabled` set DURING the async CM load window still lands — CM mounts NOT editable (code-review finding 4)', async () => {
    // The exact regression shape M1 already proved for `value`: mount, then mutate a prop BEFORE CM has
    // finished its lazy load/mount, so the disabled effect's `this.#cm?.setEditable(...)` call is a no-op
    // (optional chaining, `#cm` still null) — and nothing re-fires it later since `disabled` doesn't
    // necessarily change again. The post-mount re-sync (editor.ts, "mirroring the value-side m7/M1a
    // re-sync") must push the CURRENT state in once the handoff completes.
    const { field } = mount(`<ui-code-editor language="markdown" ${SIZED}></ui-code-editor>`)
    field.disabled = true // toggled BEFORE CM mounts — must never be lost
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    expect(cmContentOf(field)?.getAttribute('contenteditable'), 'a disabled-during-load editor must mount NOT editable (M4a)').toBe('false')
  })

  it('M4: `readonly` set DURING the async CM load window still lands — CM mounts NOT editable (code-review finding 4)', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" ${SIZED}></ui-code-editor>`)
    field.readonly = true // toggled BEFORE CM mounts — must never be lost
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    expect(cmContentOf(field)?.getAttribute('contenteditable'), 'a readonly-during-load editor must mount NOT editable (M4b)').toBe('false')
  })

  it('M4: negative control — an editor left alone during load mounts fully editable (the fix does not over-apply)', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    expect(cmContentOf(field)?.getAttribute('contenteditable')).toBe('true')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  ADR-0147 — the richtext live-preview mode (decomposition leaves n3/n5/n6/n7/n8/n9/n12, both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

// A fixture exercising every v1 construct: ATX heading, strong, emphasis, inline code, a bullet list, a
// blockquote, a link, an ORDERED list (component-review MAJOR-1 — Lezer's ListItem/ListMark are shared by
// bullet AND ordered lists; a numbered list must stay VERBATIM SOURCE, never bulleted), and a fenced code
// block (which must stay VERBATIM) — plus a trailing plain paragraph to park the cursor away from every
// construct (ADR-0147 cl.3's reveal-near-cursor, cl.4's construct set).
const RICHTEXT_SEED = [
  '## Title',
  '',
  '**bold** _em_ `code`',
  '',
  '- item one',
  '- item two',
  '',
  '1. first',
  '2. second',
  '',
  '> quote line',
  '',
  '[go](https://example.com/test) tail',
  '',
  '```js',
  'const x = 1',
  '```',
  '',
  'plain paragraph for the cursor to park on',
].join('\n')

describe('ui-code-editor — richtext mode mounts + reconfigures the LIVE view (ADR-0147 n3, both engines)', () => {
  it('setting mode="richtext" AFTER mount reconfigures the SAME view — no document/selection loss, undo still reaches pre-toggle edits', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)

    // Two lines, caret ending on the SECOND — the heading must be UNREVEALED for its decoration to exist
    // at all under the GH #165 either/or (a revealed construct now renders raw source with NO rt-* class).
    await userEvent.click(cmContentOf(field) as HTMLElement)
    await userEvent.keyboard('## Heading{Enter}tail')
    await expect.poll(() => field.value, { timeout: 2000 }).toBe('## Heading\ntail')

    field.mode = 'richtext'
    await expect.poll(() => field.querySelector('.rt-h2') !== null, { timeout: 2000 }).toBe(true)
    expect(field.value, 'the document must not change across a mode reconfigure').toBe('## Heading\ntail')

    field.mode = 'source'
    await expect.poll(() => field.querySelector('.rt-h2'), { timeout: 2000 }).toBeNull()
    expect(field.value).toBe('## Heading\ntail')

    // undo still reaches the pre-toggle edits — the Compartment reconfigure never resets history (ADR-0147
    // cl.2). The typed burst may split into several undo groups (the Enter breaks adjacency), so undo
    // repeatedly — REACHING '' at all is the proof; a reset history would stay stuck at the post-toggle text.
    await userEvent.click(cmContentOf(field) as HTMLElement)
    for (let i = 0; i < 8 && field.value !== ''; i++) {
      await userEvent.keyboard(modKey('z'))
      await new Promise((r) => setTimeout(r, 50))
    }
    await expect.poll(() => field.value, { timeout: 2000 }).toBe('')
  })

  it('richtextAvailable is false for a non-markdown language — mode="richtext" never decorates, the toggle never renders', async () => {
    const { field } = mount(`<ui-code-editor language="plain" mode="richtext" value="## not markdown" ${SIZED}></ui-code-editor>`)
    await new Promise((r) => setTimeout(r, 800)) // give any (absent) enhancement a real window to (not) happen
    expect(cmOf(field)).toBeNull() // language="plain" never mounts CM at all (editable-first, ADR-0139 cl.5)
    expect(field.querySelector('[data-part="mode-toggle"]')).toBeNull()
  })
})

describe('ui-code-editor — richtext construct decorations (ADR-0147 n5, both engines)', () => {
  it('styles the v1 constructs and hides their markup once the cursor is parked away from them', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" mode="richtext" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    field.value = RICHTEXT_SEED
    await expect.poll(() => cmContentOf(field)?.textContent?.includes('paragraph'), { timeout: 2000 }).toBe(true)
    field.selectToEnd() // parks the caret on the trailing plain paragraph — every construct above un-reveals
    await expect.poll(() => field.querySelector('.rt-h2') !== null, { timeout: 2000 }).toBe(true)

    const content = cmContentOf(field) as HTMLElement
    const text = (): string => content.textContent ?? ''

    // headings: styled, marker hidden
    expect(text()).not.toContain('##')
    const baseSize = parseFloat(getComputedStyle(content).fontSize)
    const headingSize = parseFloat(getComputedStyle(field.querySelector('.rt-h2') as Element).fontSize)
    expect(headingSize, 'the heading must render LARGER than the base font').toBeGreaterThan(baseSize)

    // strong/emphasis/inline-code: styled, marks hidden
    expect(field.querySelector('.rt-strong')).not.toBeNull()
    expect(field.querySelector('.rt-emphasis')).not.toBeNull()
    expect(field.querySelector('.rt-code')).not.toBeNull()
    expect(text()).not.toContain('**')

    // bullets: both list markers replaced by the widget
    expect(field.querySelectorAll('.rt-bullet')).toHaveLength(2)

    // ordered list: NEVER bulleted (MAJOR-1 regression) — the numbers stay verbatim source
    expect(text()).toContain('1. first')
    expect(text()).toContain('2. second')

    // blockquote: marker hidden, the quote-line class present
    expect(field.querySelector('.rt-quote-line')).not.toBeNull()
    expect(text()).not.toContain('>')

    // link: marks hidden, text styled, URL never shown
    expect(field.querySelector('.rt-link')).not.toBeNull()
    expect(text()).not.toContain('[')
    expect(text()).not.toContain('https://example.com/test')
    expect(text()).toContain('go')

    // fenced code stays VERBATIM — fences + contents render as source (no rt-* decoration inside)
    expect(text()).toContain('```js')
    expect(text()).toContain('const x = 1')
  })

  it('MAJOR-1 regression: an ordered list is NEVER destroyed by the bullet decoration — numbering stays intact', async () => {
    // Lezer's markdown grammar shares ListItem/ListMark between bullet AND ordered lists; ADR-0147 cl.4
    // names UNORDERED-list bullets only — an ordered marker ("1.", "2.", …) must render as source (the
    // ADR's own "everything unnamed renders as source" rule), never replaced by the bullet widget.
    const { field } = mount(`<ui-code-editor language="markdown" mode="richtext" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    field.value = '1. first\n2. second\n3. third\n\nplain paragraph for the cursor to park on'
    await expect.poll(() => cmContentOf(field)?.textContent?.includes('paragraph'), { timeout: 2000 }).toBe(true)
    field.selectToEnd() // parks the caret away from every list line

    await new Promise((r) => setTimeout(r, 100)) // let the decoration rebuild settle
    const content = cmContentOf(field) as HTMLElement
    expect(content.textContent, 'ordered markers must stay verbatim — never replaced by a bullet glyph').toContain('1. first')
    expect(content.textContent).toContain('2. second')
    expect(content.textContent).toContain('3. third')
    expect(content.textContent, 'no bullet glyph must appear for an ordered list').not.toContain('•')
    expect(field.querySelectorAll('.rt-bullet'), 'an ordered list must produce ZERO bullet widgets').toHaveLength(0)
  })
})

describe('ui-code-editor — reveal-near-cursor (ADR-0147 n6, as amended 2026-07-20 for GH #165, both engines)', () => {
  it('the cursor on the heading line reveals its raw ## with NO styling (the either/or); moving away restores styling and hides the marker', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" mode="richtext" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    field.value = RICHTEXT_SEED
    await expect.poll(() => cmContentOf(field)?.textContent?.includes('Title'), { timeout: 2000 }).toBe(true)

    // CM's default initial selection sits at document position 0 — ON the heading's own line. The
    // decoration pass has observably run once an UNREVEALED construct (the bold two lines down) decorates.
    await expect.poll(() => field.querySelector('.rt-strong') !== null, { timeout: 2000 }).toBe(true)
    expect(cmContentOf(field)?.textContent, 'the cursor sits on the heading line — its marker must reveal').toContain('##')
    expect(field.querySelector('.rt-h2'), 'a revealed line renders RAW SOURCE ONLY — no styling class (GH #165)').toBeNull()

    // move the caret to the trailing paragraph — a DIFFERENT line — the marker hides again AND styling returns.
    field.selectToEnd()
    await expect.poll(() => !cmContentOf(field)?.textContent?.includes('##'), { timeout: 2000 }).toBe(true)
    expect(field.querySelector('.rt-h2'), 'an unrevealed line has styling and NO visible marks').not.toBeNull()
  })

  it('a multi-line selection reveals every intersected line — marks visible, styling suppressed (GH #165)', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" mode="richtext" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    field.value = '> line one\n> line two\n\nplain tail'
    await expect.poll(() => cmContentOf(field)?.textContent?.includes('tail'), { timeout: 2000 }).toBe(true)
    field.selectToEnd()
    await expect.poll(() => !cmContentOf(field)?.textContent?.includes('>'), { timeout: 2000 }).toBe(true)
    expect(field.querySelectorAll('.rt-quote-line'), 'unrevealed quote lines carry the styling class').toHaveLength(2)

    // select the WHOLE document (both quote lines) — both QuoteMarks must reveal AND both quote-line
    // styling classes must drop (marks visible ⇒ no styling, never both at once).
    await userEvent.keyboard(modKey('a'))
    await expect.poll(() => (cmContentOf(field)?.textContent?.match(/>/g) ?? []).length, { timeout: 2000 }).toBe(2)
    expect(field.querySelectorAll('.rt-quote-line'), 'a revealed quote line must lose its styling class').toHaveLength(0)
  })

  it('the either/or invariant holds for every inline construct: a revealed line = marks visible + NO styling; an unrevealed line = styling + NO visible marks (GH #165)', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" mode="richtext" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    // the inline-construct line is LAST so selectToEnd() parks the caret ON it (revealing it) while the
    // heading above stays unrevealed — both directions of the invariant proven in one document.
    field.value = '## Title\n\n**bold** _em_ `code` [go](https://example.com/test)'
    await expect.poll(() => cmContentOf(field)?.textContent?.includes('bold'), { timeout: 2000 }).toBe(true)
    field.selectToEnd()

    // the unrevealed heading keeps the richtext presentation: styled, no marks.
    await expect.poll(() => field.querySelector('.rt-h2') !== null, { timeout: 2000 }).toBe(true)
    const text = (): string => cmContentOf(field)?.textContent ?? ''
    expect(text(), 'the unrevealed heading hides its marker').not.toContain('##')

    // the revealed line is raw source ONLY: every mark visible, every styling class absent.
    expect(text()).toContain('**bold**')
    expect(text()).toContain('_em_')
    expect(text()).toContain('`code`')
    expect(text(), 'a revealed link shows its full raw form, URL included').toContain('[go](https://example.com/test)')
    expect(field.querySelector('.rt-strong'), 'revealed strong must carry NO styling class').toBeNull()
    expect(field.querySelector('.rt-emphasis'), 'revealed emphasis must carry NO styling class').toBeNull()
    expect(field.querySelector('.rt-code'), 'revealed inline code must carry NO styling class').toBeNull()
    expect(field.querySelector('.rt-link'), 'revealed link must carry NO styling class').toBeNull()
  })
})

describe('ui-code-editor — link activation (ADR-0147 n7, both engines)', () => {
  it('Cmd/Ctrl+click on a decorated link opens via safeHref, with LINK_TARGET/LINK_REL exactly (code-review finding 2); a plain click does NOT open', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" mode="richtext" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    // the caret parks on the trailing line — a revealed link renders raw with no .rt-link (GH #165).
    field.value = '[go](https://example.com/test) tail\n\npark here'
    await expect.poll(() => cmContentOf(field)?.textContent?.includes('park'), { timeout: 2000 }).toBe(true)
    field.selectToEnd()
    await expect.poll(() => field.querySelector('.rt-link') !== null, { timeout: 2000 }).toBe(true)

    const opened: string[][] = []
    const original = window.open
    window.open = ((url?: string | URL, target?: string, features?: string) => {
      opened.push([String(url), target ?? '', features ?? ''])
      return null
    }) as typeof window.open

    try {
      const link = field.querySelector('.rt-link') as HTMLElement
      const rect = link.getBoundingClientRect()
      link.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: rect.x + 2, clientY: rect.y + 2, metaKey: true, ctrlKey: true }),
      )
      expect(opened, 'the modifier-click must open the URL').toHaveLength(1)
      expect(opened[0][0]).toBe('https://example.com/test')
      // The fleet's shared constants (@agent-ui/components/controls/text) — NOT the old hardcoded
      // '_blank'/'noopener' literals cm-richtext.ts used before the safeHref migration.
      expect(opened[0][1], 'window.open must be called with the shared LINK_TARGET constant').toBe(LINK_TARGET)
      expect(opened[0][2], 'window.open must be called with the shared LINK_REL constant (noopener noreferrer)').toBe(LINK_REL)

      // a plain click does NOT open the URL — CM's own mousedown handling may still preventDefault (its normal
      // click-to-place-caret bookkeeping, unrelated to our link handler, which itself returns false/no-op for
      // a non-modifier click) — only the open-count is this handler's own contract.
      const plain = new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: rect.x + 2, clientY: rect.y + 2 })
      link.dispatchEvent(plain)
      expect(opened, 'a plain click must NOT open the URL').toHaveLength(1)
    } finally {
      window.open = original
    }
  })

  // Old behavior baseline (pre-migration `isSafeUrl`): only http(s)/mailto/relative opened, everything else
  // was refused. safeHref (ADR-0114) must refuse the SAME dangerous schemes — this is the parity proof for
  // code-review finding 2's safeHref migration, not just a fresh assertion of the new code's own claims.
  it.each([
    ['javascript:alert(1)', 'javascript:'],
    ['data:text/html,<script>alert(1)</script>', 'data:'],
  ])('refuses a %s scheme link — parity with the old isSafeUrl refusal behavior (R2)', async (url) => {
    const { field } = mount(`<ui-code-editor language="markdown" mode="richtext" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    // the caret parks on the trailing line — a revealed link renders raw with no .rt-link (GH #165).
    field.value = `[bad](${url}) tail\n\npark here`
    await expect.poll(() => cmContentOf(field)?.textContent?.includes('park'), { timeout: 2000 }).toBe(true)
    field.selectToEnd()
    await expect.poll(() => field.querySelector('.rt-link') !== null, { timeout: 2000 }).toBe(true)

    let opened = 0
    const original = window.open
    window.open = (() => {
      opened++
      return null
    }) as typeof window.open
    try {
      const link = field.querySelector('.rt-link') as HTMLElement
      const rect = link.getBoundingClientRect()
      link.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: rect.x + 2, clientY: rect.y + 2, metaKey: true, ctrlKey: true }),
      )
      expect(opened, `a ${url} URL must never open`).toBe(0)
    } finally {
      window.open = original
    }
  })
})

describe('ui-code-editor — the built-in mode toggle (ADR-0147 n8, both engines)', () => {
  it('renders once richtext is available; click/Enter/Space each flip mode + emit ONE toggle; a programmatic set is silent', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmOf(field) !== null, { timeout: 5000 }).toBe(true)
    await expect.poll(() => field.querySelector('[data-part="mode-toggle"]') !== null, { timeout: 2000 }).toBe(true)
    const toggle = field.querySelector('[data-part="mode-toggle"]') as HTMLElement

    expect(toggle.getAttribute('role')).toBe('button')
    expect(toggle.getAttribute('tabindex')).toBe('0')
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    // The dynamic, state-aware aria-label (code-review finding 5 — supersedes the old static "Rendered
    // markdown view"): state-aware IMMEDIATELY on creation, not just after a later sync.
    expect(toggle.getAttribute('aria-label'), 'the toggle must announce what activating it will DO, from creation').toBe('Show rendered markdown')

    let toggles = 0
    field.addEventListener('toggle', () => toggles++)

    await userEvent.click(toggle)
    expect(field.mode).toBe('richtext')
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(toggle.getAttribute('aria-label'), 'the label flips once richtext is active').toBe('Show markdown source')
    expect(toggles).toBe(1)

    toggle.focus()
    await userEvent.keyboard('{Enter}')
    expect(field.mode).toBe('source')
    expect(toggle.getAttribute('aria-label')).toBe('Show rendered markdown')
    expect(toggles).toBe(2)

    toggle.focus()
    await userEvent.keyboard(' ')
    expect(field.mode).toBe('richtext')
    expect(toggles).toBe(3)

    // a PROGRAMMATIC mode set is silent — but aria-pressed still syncs (the value/input symmetry, F4)
    field.mode = 'source'
    await expect.poll(() => toggle.getAttribute('aria-pressed'), { timeout: 1000 }).toBe('false')
    expect(toggles, 'a programmatic mode set must never emit toggle').toBe(3)
  })

  it('disabled hosts render the toggle non-operable; readonly hosts keep it fully operable (F5)', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmOf(field) !== null, { timeout: 5000 }).toBe(true)
    await expect.poll(() => field.querySelector('[data-part="mode-toggle"]') !== null, { timeout: 2000 }).toBe(true)
    const toggle = (): HTMLElement => field.querySelector('[data-part="mode-toggle"]') as HTMLElement

    field.readonly = true
    await expect.poll(() => toggle().getAttribute('tabindex'), { timeout: 1000 }).toBe('0')
    expect(toggle().hasAttribute('aria-disabled')).toBe(false)

    field.disabled = true
    await expect.poll(() => toggle().hasAttribute('tabindex'), { timeout: 1000 }).toBe(false)
    expect(toggle().getAttribute('aria-disabled')).toBe('true')
  })

  it('a key-repeat (OS auto-repeat) keydown does NOT flip mode or emit toggle; a real non-repeat keydown still does (code-review finding 3)', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmOf(field) !== null, { timeout: 5000 }).toBe(true)
    await expect.poll(() => field.querySelector('[data-part="mode-toggle"]') !== null, { timeout: 2000 }).toBe(true)
    const toggle = field.querySelector('[data-part="mode-toggle"]') as HTMLElement

    let toggles = 0
    field.addEventListener('toggle', () => toggles++)

    // Holding Enter fires many keydowns with `repeat: true` per physical press — none of them may toggle.
    toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, repeat: true }))
    toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, repeat: true }))
    toggle.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true, repeat: true }))
    await expect.poll(() => field.mode, { timeout: 1000 }).toBe('source')
    expect(toggles, 'key-repeat keydowns must never flip mode or emit toggle').toBe(0)

    // Negative control: a genuine (non-repeat) keydown still toggles — the guard targets ONLY the
    // auto-repeat flag, it does not silently break the real Enter/Space activation path.
    toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, repeat: false }))
    await expect.poll(() => field.mode, { timeout: 1000 }).toBe('richtext')
    await expect.poll(() => toggles, { timeout: 1000 }).toBe(1)

    toggle.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true, repeat: false }))
    await expect.poll(() => field.mode, { timeout: 1000 }).toBe('source')
    await expect.poll(() => toggles, { timeout: 1000 }).toBe(2)
  })
})

describe('ui-code-editor — richtext CSS + a11y (ADR-0147 n9, both engines)', () => {
  it('every new [data-part] display rule carries the :not([hidden]) guard — the mode-toggle part vanishes when hidden', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmOf(field) !== null, { timeout: 5000 }).toBe(true)
    await expect.poll(() => field.querySelector('[data-part="mode-toggle"]') !== null, { timeout: 2000 }).toBe(true)
    const toggle = field.querySelector('[data-part="mode-toggle"]') as HTMLElement
    expect(getComputedStyle(toggle).display).not.toBe('none')
    toggle.hidden = true
    expect(getComputedStyle(toggle).display, 'an author display rule without :not([hidden]) would defeat `hidden`').toBe('none')
    toggle.hidden = false
  })

  it('the mode switch SNAPS — no transition on the toggle', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmOf(field) !== null, { timeout: 5000 }).toBe(true)
    await expect.poll(() => field.querySelector('[data-part="mode-toggle"]') !== null, { timeout: 2000 }).toBe(true)
    const toggle = field.querySelector('[data-part="mode-toggle"]') as HTMLElement
    expect(getComputedStyle(toggle).transitionDuration).toMatch(/^0s(,\s*0s)*$/)
  })

  it('forced-colors keeps every rt-* construct + the toggle legible — Chromium emulates (CDP); WebKit asserts the baseline', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" mode="richtext" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    field.value = '## Title\n\nplain paragraph for the cursor to park on'
    await expect.poll(() => cmContentOf(field)?.textContent?.includes('paragraph'), { timeout: 2000 }).toBe(true)
    field.selectToEnd() // park the caret away first — a revealed heading now renders raw with NO styling (GH #165)
    await expect.poll(() => field.querySelector('.rt-h2') !== null, { timeout: 2000 }).toBe(true)
    await expect.poll(() => !cmContentOf(field)?.textContent?.includes('##'), { timeout: 2000 }).toBe(true)

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP / forced-colors emulation (the documented split) — assert we are genuinely NOT
      // in forced-colors (so the Chromium proof below is not silently faked) and stop.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)
      const heading = field.querySelector('.rt-h2') as HTMLElement
      expect(getComputedStyle(heading).color, 'a heading must never go invisible under forced-colors').not.toBe('rgba(0, 0, 0, 0)')
      expect(getComputedStyle(heading).fontWeight, 'weight must survive forced-colors (SPEC-C5 — no info rides hue alone)').not.toBe('400')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

describe('ui-code-editor — cross-mode identity + a long-document sanity probe (ADR-0147 n12, both engines)', () => {
  it('.value is byte-identical across repeated mode flips and typing-in-richtext; blur-with-change timing is unchanged', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    let changes = 0
    field.addEventListener('change', () => changes++)

    field.mode = 'richtext'
    await expect.poll(() => field.querySelector('[data-part="mode-toggle"]') !== null, { timeout: 2000 }).toBe(true)
    await userEvent.click(cmContentOf(field) as HTMLElement)
    await userEvent.keyboard('## typed in richtext')
    await expect.poll(() => field.value, { timeout: 2000 }).toBe('## typed in richtext')
    expect(changes, 'change must not fire on keystrokes in richtext either').toBe(0)

    field.mode = 'source'
    field.mode = 'richtext'
    field.mode = 'source'
    expect(field.value, 'repeated mode flips must never mutate the document').toBe('## typed in richtext')

    await userEvent.click(document.body) // real blur — commits exactly once, same timing as source mode
    await expect.poll(() => changes, { timeout: 2000 }).toBe(1)
  })

  it('a long document (500+ lines) stays responsive under richtext — typing latency is observably sane', async () => {
    const lines: string[] = []
    for (let i = 0; i < 520; i++) lines.push(i % 10 === 0 ? `## Section ${i}` : `plain line ${i} with **bold** text`)
    const { field } = mount(`<ui-code-editor language="markdown" mode="richtext" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    field.value = lines.join('\n')
    // the FIRST page renders synchronously (CM virtualizes — only the visible viewport is in the DOM); a far
    // line only appears once scrolled into view, which selectToEnd() below causes.
    await expect.poll(() => cmContentOf(field)?.textContent?.includes('Section 0'), { timeout: 5000 }).toBe(true)
    expect(field.value.split('\n')).toHaveLength(520)

    field.selectToEnd() // scrolls the caret (document end) into view — only the near-end lines, not line 510
    await expect.poll(() => cmContentOf(field)?.textContent?.includes('line 519'), { timeout: 5000 }).toBe(true)
    await expect.poll(() => field.querySelectorAll('.rt-strong').length > 0, { timeout: 2000 }).toBe(true)

    // type one character at the (visible) document end — must land promptly (viewport-bounded decoration
    // rebuilds, ADR-0147's Consequences bullet: the per-keystroke cost stays O(visible), not O(document)).
    await userEvent.click(cmContentOf(field) as HTMLElement)
    const before = Date.now()
    await userEvent.keyboard('Z')
    await expect.poll(() => field.value.includes('Z'), { timeout: 1500 }).toBe(true)
    expect(Date.now() - before, 'typing a single character took implausibly long — a full-document walk, not a viewport-bounded one').toBeLessThan(1500)
  })
})
// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  markdown FORMATTING commands (Kim's ask, 2026-07-19) — mode-INDEPENDENT: every command is a text edit
//  over the same document richtext mode merely decorates, so these are tested once, in default (source)
//  mode, rather than duplicated per mode — richtext's OWN decoration-renders-what-these-commands-write is
//  already covered by the ADR-0147 describe blocks above.
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-code-editor — bold/italic/inline-code toggle-wrap (both engines)', () => {
  it('Mod-b wraps a selection in ** and toggles it back off on a second press', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" value="hello world" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    await userEvent.click(cmContentOf(field) as HTMLElement)
    await userEvent.keyboard(modKey('a')) // select all — "hello world"
    await userEvent.keyboard(modKey('b'))
    await expect.poll(() => field.value, { timeout: 2000 }).toBe('**hello world**')
    await userEvent.keyboard(modKey('a'))
    await userEvent.keyboard(modKey('b'))
    await expect.poll(() => field.value, { timeout: 2000 }).toBe('hello world')
  })

  it('Mod-i wraps a selection in a single *; Mod-e wraps it in a single backtick', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" value="word" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    await userEvent.click(cmContentOf(field) as HTMLElement)
    await userEvent.keyboard(modKey('a'))
    await userEvent.keyboard(modKey('i'))
    await expect.poll(() => field.value, { timeout: 2000 }).toBe('*word*')
    await userEvent.keyboard(modKey('a'))
    await userEvent.keyboard(modKey('i')) // toggle italic back off
    await expect.poll(() => field.value, { timeout: 2000 }).toBe('word')
    await userEvent.keyboard(modKey('a'))
    await userEvent.keyboard(modKey('e'))
    await expect.poll(() => field.value, { timeout: 2000 }).toBe('`word`')
  })

  it('an empty selection (bare cursor) inserts an empty pair with the caret parked between', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" value="" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    await userEvent.click(cmContentOf(field) as HTMLElement)
    await userEvent.keyboard(modKey('b'))
    await expect.poll(() => field.value, { timeout: 2000 }).toBe('****')
    await userEvent.keyboard('mid') // types where the caret was parked, between the two ** pairs
    await expect.poll(() => field.value, { timeout: 2000 }).toBe('**mid**')
  })
})

describe('ui-code-editor — heading level toggle (both engines)', () => {
  it('Mod-Alt-1 sets an H1; a second press on the same line toggles it back to plain text', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" value="Title" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    await userEvent.click(cmContentOf(field) as HTMLElement)
    await userEvent.keyboard(`{${MOD}>}{Alt>}1{/Alt}{/${MOD}}`)
    await expect.poll(() => field.value, { timeout: 2000 }).toBe('# Title')
    await userEvent.keyboard(`{${MOD}>}{Alt>}1{/Alt}{/${MOD}}`)
    await expect.poll(() => field.value, { timeout: 2000 }).toBe('Title')
  })

  it('setting H3 on a line already at H1 REPLACES the marker, never doubles it', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" value="# Title" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    await userEvent.click(cmContentOf(field) as HTMLElement)
    await userEvent.keyboard(`{${MOD}>}{Alt>}3{/Alt}{/${MOD}}`)
    await expect.poll(() => field.value, { timeout: 2000 }).toBe('### Title')
  })
})

describe('ui-code-editor — bullet/numbered list toggle (both engines)', () => {
  it('Mod-Shift-8 bullet-lists every line the selection touches; a second press toggles back off', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" value="" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    field.value = 'one\ntwo\nthree'
    await userEvent.click(cmContentOf(field) as HTMLElement)
    await userEvent.keyboard(modKey('a'))
    await userEvent.keyboard(`{${MOD}>}{Shift>}8{/Shift}{/${MOD}}`)
    await expect.poll(() => field.value, { timeout: 2000 }).toBe('- one\n- two\n- three')
    await userEvent.keyboard(modKey('a'))
    await userEvent.keyboard(`{${MOD}>}{Shift>}8{/Shift}{/${MOD}}`)
    await expect.poll(() => field.value, { timeout: 2000 }).toBe('one\ntwo\nthree')
  })

  it('Mod-Shift-7 numbers every line the selection touches sequentially, replacing a bullet if present', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" value="" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    field.value = '- one\n- two'
    await userEvent.click(cmContentOf(field) as HTMLElement)
    await userEvent.keyboard(modKey('a'))
    await userEvent.keyboard(`{${MOD}>}{Shift>}7{/Shift}{/${MOD}}`)
    await expect.poll(() => field.value, { timeout: 2000 }).toBe('1. one\n2. two')
  })
})

describe('ui-code-editor — paste-to-link (both engines)', () => {
  /** Dispatches a real ClipboardEvent with controlled data directly on the CM content node — proves the
   *  `domEventHandlers({ paste })` code path itself, without depending on a real OS clipboard round-trip
   *  (whose permission model differs across engines under automation). */
  const pasteText = (target: HTMLElement, text: string): void => {
    const dt = new DataTransfer()
    dt.setData('text/plain', text)
    target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }

  it('pasting a bare URL over a selected word wraps it into a markdown link', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" value="see documentation here" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    await userEvent.click(cmContentOf(field) as HTMLElement)
    await userEvent.keyboard(modKey('a')) // select the whole (single-word-for-simplicity) content
    pasteText(cmContentOf(field) as HTMLElement, 'https://example.com/docs')
    await expect.poll(() => field.value, { timeout: 2000 }).toBe('[see documentation here](https://example.com/docs)')
  })

  it('an unsafe scheme (javascript:) is REJECTED — falls through to a normal paste, never becomes a link', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" value="word" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    await userEvent.click(cmContentOf(field) as HTMLElement)
    await userEvent.keyboard(modKey('a'))
    pasteText(cmContentOf(field) as HTMLElement, 'javascript:alert(1)')
    // preventDefault() is never called for a denied scheme, so the browser's own default paste applies —
    // assert only the negative (never becomes a link); the exact resulting text is the engine's own
    // default-paste behavior, not this handler's concern.
    await new Promise((r) => setTimeout(r, 300))
    expect(field.value, 'an unsafe scheme must never be accepted as a link destination').not.toContain('](javascript:')
  })

  it('pasting over an EMPTY selection (bare cursor) does nothing special — falls through to a normal paste', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" value="" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    await userEvent.click(cmContentOf(field) as HTMLElement)
    pasteText(cmContentOf(field) as HTMLElement, 'https://example.com')
    await expect.poll(() => field.value, { timeout: 2000 }).toBe('https://example.com') // pasted verbatim, no [](...) wrap
  })

  it('a literal ] in the selected text is escaped so it can never prematurely close the link span', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" value="a [note] here" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    await userEvent.click(cmContentOf(field) as HTMLElement)
    await userEvent.keyboard(modKey('a'))
    pasteText(cmContentOf(field) as HTMLElement, 'https://example.com')
    await expect.poll(() => field.value, { timeout: 2000 }).toBe('[a \\[note\\] here](https://example.com)')
  })

  it('a trailing backslash in the selected text is escaped FIRST, so the link span still closes correctly', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    field.value = 'oops\\' // one real backslash — set via JS property (an HTML attribute can't carry it cleanly)
    await userEvent.click(cmContentOf(field) as HTMLElement)
    await userEvent.keyboard(modKey('a'))
    pasteText(cmContentOf(field) as HTMLElement, 'https://example.com')
    // escaping `\` -> `\\` FIRST, then `]` -> `\]`, must NOT let the pre-existing backslash "consume" the
    // bracket escape into a single `\]` (an escaped literal `]`, never closing the link span) — a real bug
    // caught in review.
    await expect.poll(() => field.value, { timeout: 2000 }).toBe('[oops\\\\](https://example.com)')
  })

  it('plain prose (not a URL) pasted over a selection is REJECTED — falls through to a normal paste, never becomes a link', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" value="word" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    await userEvent.click(cmContentOf(field) as HTMLElement)
    await userEvent.keyboard(modKey('a'))
    // "hello world" is NOT an absolute URL — a relative-URL resolution bug once made ANY pasted text
    // resolve against document.baseURI and hijack a normal paste (caught in review); this proves it stays fixed.
    pasteText(cmContentOf(field) as HTMLElement, 'hello world')
    await new Promise((r) => setTimeout(r, 300))
    expect(field.value, 'plain prose must never be accepted as a link destination').not.toContain('](')
  })

  it("an absolute URL whose path legally contains ( ) is percent-encoded in the destination slot — never splits into two links", async () => {
    const { field } = mount(`<ui-code-editor language="markdown" value="click here" ${SIZED}></ui-code-editor>`)
    await expect.poll(() => cmContentOf(field) !== null, { timeout: 5000 }).toBe(true)
    await userEvent.click(cmContentOf(field) as HTMLElement)
    await userEvent.keyboard(modKey('a'))
    // the crafted destination-injection shape a prior review flagged: unescaped, this would close the
    // link's `(...)` early and open a second, attacker-chosen link.
    pasteText(cmContentOf(field) as HTMLElement, 'https://example.com/)[evil](javascript:alert(1))')
    await expect
      .poll(() => field.value, { timeout: 2000 })
      .toBe('[click here](https://example.com/%29[evil]%28javascript:alert%281%29%29)')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  GH #164 — the mode-toggle is a zero-footprint STICKY OVERLAY on the top inline-end corner, not a
//  float. Measured ground truth (both engines, 2026-07-20): `float: inline-end` + `position: sticky`
//  DO coexist (H1 false — dropping sticky changed nothing), but CodeMirror's `.cm-editor` is a flex
//  container and `.cm-scroller` an `overflow: auto` box — independent formatting-context roots a float
//  can never intrude into (H2 true) — so the float could never make text wrap around the toggle; it
//  instead narrowed the ENTIRE `.cm-editor` column by the toggle's width for the full document height
//  (273px vs the mount's 297px at a 320px host). Wrap-around is structurally unachievable while CM owns
//  the text layout; the shipped contract is the corner overlay the float (+ sticky) always intended.
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-code-editor — the mode-toggle is a zero-footprint corner overlay (GH #164, both engines)', () => {
  it('overlays the top inline-end corner reserving NO column and NO row, hit-testable above the CM surface', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" ${SIZED}></ui-code-editor>`)
    field.value = Array.from({ length: 12 }, (_, i) => `line ${i} with prose that runs fairly wide`).join('\n')
    await expect.poll(() => field.querySelector('[data-part="mode-toggle"]') !== null, { timeout: 5000 }).toBe(true)
    await expect.poll(() => field.querySelector('.cm-line') !== null, { timeout: 5000 }).toBe(true)
    const toggle = field.querySelector('[data-part="mode-toggle"]') as HTMLElement
    const cm = cmOf(field) as HTMLElement
    const cmEditor = field.querySelector('.cm-editor') as HTMLElement

    // the float is GONE (it never delivered wrap-around — see the banner above); sticky is the contract.
    expect(getComputedStyle(toggle).float, 'float is dead here — it can never wrap CM-owned text').toBe('none')
    expect(getComputedStyle(toggle).position).toBe('sticky')

    const t = toggle.getBoundingClientRect()
    const c = cm.getBoundingClientRect()
    const e = cmEditor.getBoundingClientRect()
    const host = field.getBoundingClientRect()
    const cs = getComputedStyle(field)

    // pinned to the top inline-end corner of the host's content box (LTR: the right padding edge)…
    const contentRight = host.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight)
    expect(Math.abs(t.right - contentRight), 'the toggle must hug the inline-end edge').toBeLessThan(2)
    // …reserving NO row: the CM mount starts at the same block-start, not below the toggle.
    expect(Math.abs(t.top - c.top), 'the toggle must not push the editor content down').toBeLessThan(2)
    // …and NO column: the .cm-editor spans its mount's FULL inline size. The old float narrowed the whole
    // .cm-editor beside it for the entire document height (measured 273 vs 297 at a 320px host) — the exact
    // pre-fix defect this leg is the negative control for.
    expect(e.width, 'the editor column must reclaim the full mount width — no dead toggle gutter').toBeGreaterThan(c.width - 2)

    // the overlay paints + hit-tests ABOVE the CM surface (z-index: 1 over .cm-scroller's z-index: 0 —
    // the scroller is a LATER positioned sibling subtree in tree order, so without the z-index it would
    // paint over the toggle now that they genuinely overlap).
    const hit = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2)
    expect(hit, 'the toggle must stay clickable above the CM surface').toBe(toggle)
  })

  it('stays stuck to the scrollport top while the host scrolls (the sticky leg of the contract)', async () => {
    const { field } = mount(`<ui-code-editor language="markdown" style="inline-size: 320px; block-size: 160px; display: block"></ui-code-editor>`)
    field.value = Array.from({ length: 40 }, (_, i) => `scroll line ${i}`).join('\n')
    await expect.poll(() => field.querySelector('[data-part="mode-toggle"]') !== null, { timeout: 5000 }).toBe(true)
    await expect.poll(() => field.querySelector('.cm-line') !== null, { timeout: 5000 }).toBe(true)
    const toggle = field.querySelector('[data-part="mode-toggle"]') as HTMLElement

    field.scrollTop = 100
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    expect(field.scrollTop, 'the host itself is the scroller — it must actually have scrolled').toBeGreaterThan(50)
    const t = toggle.getBoundingClientRect()
    const host = field.getBoundingClientRect()
    // stuck at the scrollport's block-start (inset-block-start: 0 — at/inside the border edge), NOT
    // scrolled away with the content (100px up would put it far above the host's top edge).
    expect(t.top - host.top).toBeGreaterThanOrEqual(0)
    expect(t.top - host.top, 'the toggle must stick to the scrollport top, not ride the content away').toBeLessThan(10)
  })
})
