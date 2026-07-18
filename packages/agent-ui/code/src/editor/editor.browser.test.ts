import { describe, it, expect, afterEach } from 'vitest'
import { userEvent } from 'vitest/browser'
import type { UICodeEditorElement } from './editor.ts'

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
})
