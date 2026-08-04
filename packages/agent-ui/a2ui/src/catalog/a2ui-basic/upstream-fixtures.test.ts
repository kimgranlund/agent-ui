// upstream-fixtures.test.ts — ADR-0169 cl.1/cl.14: the three pinned upstream A2UI v0.9.1 example
// payloads (`fixtures/`, copied verbatim from the fetched upstream job dir — 2026-08-04) VALIDATE and
// RENDER against `a2uiBasicCatalog`. This is the highest-value test in the whole build: it makes
// "interop-anchored" a CHECKED FACT, not an assertion.
//
// The fixture harness translates each message's `version: "v0.9"` envelope field to our pinned `v1.0`
// (a FRAMING-only translation — `SUPPORTED_VERSIONS` (protocol.ts) has no `v0.9` member at all, only
// `v1.0`/`v0.9.1`; every component-tree byte stays verbatim, untouched). `createSurface.catalogId` is
// exercised in BOTH forms (cl.13): the pinned canonical URI verbatim, and the local short id
// `a2ui-basic` — both resolve on the SAME renderer (both registered, cl.2).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { validateA2ui } from '../../renderer/validate.ts'
import { createRenderer } from '../../renderer/renderer.ts'
import { a2uiBasicCatalog, A2UI_BASIC_CANONICAL_URI } from './index.ts'
import type { A2uiServerMessage } from '../../protocol.ts'
import type { A2uiClientMessage } from '../../renderer/renderer.ts'
import interactiveButtonRaw from './fixtures/upstream-example-00_interactive-button.json'
import loginFormRaw from './fixtures/upstream-example-00_simple-login-form.json'
import productCardRaw from './fixtures/upstream-example-05_product-card.json'

interface UpstreamFixture {
  name: string
  messages: A2uiServerMessage[]
}

/** ADR-0169 cl.1 — the framing-only `v0.9` → `v1.0` envelope translation. Every OTHER byte (the
 *  component tree, the wire prop values) is untouched — only the top-level `version` field changes. */
function toV1(messages: readonly A2uiServerMessage[]): A2uiServerMessage[] {
  return messages.map((m) => ({ ...m, version: 'v1.0' }) as A2uiServerMessage)
}

/** Rewrite every `createSurface.catalogId` in `messages` to `catalogId` (cl.13's two-form exercise). */
function withCatalogId(messages: readonly A2uiServerMessage[], catalogId: string): A2uiServerMessage[] {
  return messages.map((m) => ('createSurface' in m ? { ...m, createSurface: { ...m.createSurface, catalogId } } : m))
}

// jsdom reality (the default/index.test.ts precedent, ADR-0055 clause 4): `ElementInternals.
// setFormValue`/`setValidity` are ABSENT in jsdom — every form-associated control (ui-text-field
// included) calls both unconditionally in its own `connectedCallback`, which throws. The login-form
// fixture mounts real `ui-text-field` elements, so the SAME shared-prototype stub applies here.
let savedSetFormValue: unknown
let savedSetValidity: unknown
beforeAll(() => {
  savedSetFormValue = ElementInternals.prototype.setFormValue
  savedSetValidity = ElementInternals.prototype.setValidity
  if (typeof ElementInternals.prototype.setFormValue !== 'function') {
    ElementInternals.prototype.setFormValue = function (): void {}
  }
  if (typeof ElementInternals.prototype.setValidity !== 'function') {
    ElementInternals.prototype.setValidity = function (): void {}
  }
})
afterAll(() => {
  ElementInternals.prototype.setFormValue = savedSetFormValue as typeof ElementInternals.prototype.setFormValue
  ElementInternals.prototype.setValidity = savedSetValidity as typeof ElementInternals.prototype.setValidity
})

const interactiveButton = interactiveButtonRaw as unknown as UpstreamFixture
const loginForm = loginFormRaw as unknown as UpstreamFixture
const productCard = productCardRaw as unknown as UpstreamFixture

describe('upstream fixtures — pinned `createSurface.catalogId` is the canonical URI, verbatim', () => {
  it.each([interactiveButton, loginForm, productCard])('$name', (fixture) => {
    const create = fixture.messages.find((m) => 'createSurface' in m) as { createSurface: { catalogId: string } }
    expect(create.createSurface.catalogId).toBe(A2UI_BASIC_CANONICAL_URI)
  })
})

describe('upstream fixtures — validate 0 failures against a2uiBasicCatalog (the framing-translated payload)', () => {
  it.each([interactiveButton, loginForm, productCard])('$name', (fixture) => {
    const v1 = toV1(fixture.messages)
    expect(validateA2ui(v1, a2uiBasicCatalog)).toEqual({ valid: true, failures: [] })
  })
})

/** Mount a fresh renderer, ingest `messages` in order, and return it + the mount root. */
function mountFixture(messages: readonly A2uiServerMessage[]): { root: HTMLElement; clientMessages: A2uiClientMessage[]; dispose: () => void } {
  const r = createRenderer({ newId: () => 'act-1', now: () => '2026-08-04T00:00:00.000Z' })
  const root = document.createElement('div')
  document.body.appendChild(root)
  r.mount(root)
  const clientMessages: A2uiClientMessage[] = []
  r.onClientMessage((m) => clientMessages.push(m))
  for (const m of messages) r.ingestMessage(m)
  return {
    root,
    clientMessages,
    dispose: () => {
      r.dispose()
      root.remove()
    },
  }
}

describe('upstream fixture — 00_interactive-button', () => {
  it.each([
    ['canonical URI (pinned, verbatim)', A2UI_BASIC_CANONICAL_URI],
    ['local short id (a2ui-basic)', 'a2ui-basic'],
  ])('renders + a real click on the Button emits {action:"button_clicked", context:{}} via the readActionSpec cl.10 arm — %s', (_label, catalogId) => {
    const messages = withCatalogId(toV1(interactiveButton.messages), catalogId)
    const { root, clientMessages, dispose } = mountFixture(messages)

    const button = root.querySelector('ui-button')
    expect(button).toBeTruthy() // Button → ui-button, mounted for real
    expect((button as unknown as { variant?: unknown }).variant).toBe('solid') // upstream 'primary' → fleet 'solid'
    expect(button!.textContent).toContain('Click Me') // the child Text node's content

    button!.dispatchEvent(new Event('click', { bubbles: true }))

    const action = clientMessages.find((m) => 'action' in m) as { action: { name: string; context?: unknown } } | undefined
    expect(action, 'a real click emitted an action').toBeTruthy()
    // The upstream {event:{name,context}} Action shape normalizes to the canonical {action,context} wire
    // shape (ADR-0169 cl.10) — the third readActionSpec tolerance arm, exercised end-to-end.
    expect(action!.action.name).toBe('button_clicked')
    expect(action!.action.context).toEqual({})

    dispose()
  })
})

describe('upstream fixture — 00_simple-login-form', () => {
  it('renders — TextField.variant maps to the fleet type enum, the button carries the translated action', () => {
    const messages = toV1(loginForm.messages)
    const { root, dispose } = mountFixture(messages)

    const fields = [...root.querySelectorAll('ui-text-field')] as (HTMLElement & { type?: unknown; label?: unknown })[]
    expect(fields.length).toBe(2)
    const username = fields.find((f) => f.label === 'Username')
    const password = fields.find((f) => f.label === 'Password')
    expect(username?.type).toBe('text') // upstream 'shortText' → fleet 'text'
    expect(password?.type).toBe('password') // upstream 'obscured' → fleet 'password'

    const button = root.querySelector('ui-button')
    expect(button!.textContent).toContain('Sign In')

    dispose()
  })
})

describe('upstream fixture — 05_product-card', () => {
  it('renders — Image.url→src/fit→objectFit, and the formatCurrency/formatString+formatNumber+pluralize function chain composes real text (ADR-0027/0028 interpolation, riding the a2ui-basic boolean-dialect function table, cl.8/cl.11)', async () => {
    const messages = toV1(productCard.messages)
    const { root, dispose } = mountFixture(messages)
    await whenFlushed()

    const img = root.querySelector('img') as HTMLImageElement | null
    expect(img).toBeTruthy() // Image → <img>, the sanctioned primitive
    expect(img!.src).toBe('https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=200&fit=crop')
    expect(img!.style.objectFit).toBe('cover')

    const texts = [...root.querySelectorAll('ui-text')]
    const byText = (needle: string): Element | undefined => texts.find((t) => t.textContent?.includes(needle))

    expect(byText('Wireless Headphones Pro'), 'the {path}-bound name').toBeTruthy()
    // formatCurrency('en-US', USD) — real Intl.NumberFormat output, not a stub.
    expect(byText('$199.99'), 'formatCurrency(price)').toBeTruthy()
    expect(byText('$249.99'), 'formatCurrency(originalPrice)').toBeTruthy()
    // formatString(value: "(${formatNumber(...)} ${pluralize(...)})") — the nested fn-expression grammar
    // (ADR-0027/0028), riding the a2ui-basic per-catalog function table (cl.8) end-to-end.
    expect(byText('(2,847 reviews)'), 'formatString + formatNumber + pluralize composed').toBeTruthy()

    const addToCart = root.querySelector('ui-button')
    expect(addToCart!.textContent).toContain('Add to Cart')

    dispose()
  })
})
