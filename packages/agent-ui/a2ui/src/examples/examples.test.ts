// examples.test.ts — the standing validity gate for the example seed shelf (ADR-0055 clause 4).
//
// Inside the vitest include by construction (`packages/agent-ui/*/src/**/*.test.ts`) — no config change
// closes the flagged gap: every demo payload is now proven valid AND renderable at CHECK time, not only
// when a human loads the page. Two legs per seed: (a) the shared validator (`validateA2ui`, renderer
// LLD-C11 — the SAME code path corpus admission will use, SPEC-N3/N6 parity) verdicts 0-failure; (b) a
// real-host jsdom smoke — `createRenderer` → `mount` → `ingest` each message as a JSONL line (dogfooding
// the transport's line path, not `ingestMessage`) → `finalize(surfaceId)` — emits an empty error channel.
//
// jsdom reality (the checkbox.test.ts/form-provider.test.ts precedent): `ElementInternals.setFormValue`/
// `setValidity` are ABSENT in jsdom — every form-associated control (TextField/Checkbox/Switch/Select)
// calls both unconditionally in its own `connectedCallback`, which throws (an UNCAUGHT exception inside
// a reactive effect, verified: it fails the vitest run even though the calling test "passes"). Every
// OTHER jsdom probe in this package stubs the surface per-instance on a hand-built throwaway leaf
// (`new MemberEl()`, stub `internals`, THEN connect); that seam doesn't exist here — this gate mounts
// REAL default-catalog controls through the REAL renderer, which builds each one via
// `document.createElement(tag)` with no per-instance hook. So the stub is applied ONCE at the shared
// `ElementInternals.prototype`, scoped to this file's `beforeAll`/`afterAll` (saved + restored) rather
// than per-instance — every real form control connects safely for the duration of this suite only.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { allSeeds, generativeFormSeed } from './index.ts'
import type { ExampleSeed } from './types.ts'
import { canvasSeeds } from './canvas-button.ts'
import { dynamicListSeeds } from './dynamic-lists.ts'
import { generativeFormSeeds } from './generative-form.ts'
import { patternSeeds } from './patterns.ts'
import { catalogCoverageSeeds, documentRowToolbarSeed } from './catalog-coverage.ts'
import { ICON_NAMES } from '@agent-ui/icons'
import { validateA2ui } from '../renderer/validate.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { createRenderer } from '../renderer/renderer.ts'
import type { A2uiClientMessage } from '../renderer/renderer.ts'

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

const isError = (m: A2uiClientMessage): m is Extract<A2uiClientMessage, { error: unknown }> => 'error' in m

/** The jsdom real-host smoke (ADR-0055 clause 4b): a fresh renderer, mount, ingest every message as a
 *  JSONL line, finalize the COMPLETE set (ADR-0002), then dispose — returns every client-message the
 *  host emitted so the caller can assert the error channel is empty. */
function renderSmoke(seed: Pick<ExampleSeed, 'surfaceId' | 'messages'>): A2uiClientMessage[] {
  const sent: A2uiClientMessage[] = []
  const r = createRenderer()
  r.onClientMessage((m) => void sent.push(m))
  const mount = document.createElement('div')
  document.body.appendChild(mount)
  r.mount(mount)
  for (const message of seed.messages) r.ingest(JSON.stringify(message))
  r.finalize(seed.surfaceId)
  r.dispose()
  mount.remove()
  return sent
}

describe('the example seed shelf (ADR-0055) — shape', () => {
  it('composes allSeeds from exactly the family arrays each module exports (derived count — never a hand-counted literal)', () => {
    const expectedTotal =
      canvasSeeds.length + dynamicListSeeds.length + generativeFormSeeds.length + patternSeeds.length + catalogCoverageSeeds.length
    expect(allSeeds).toHaveLength(expectedTotal)
  })

  it('every seed name is unique (the future CorpusRecord.name)', () => {
    const names = allSeeds.map((s) => s.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('every seed pins protocolVersion v1.0 and catalogId agent-ui', () => {
    for (const seed of allSeeds) {
      expect(seed.protocolVersion, seed.name).toBe('v1.0')
      expect(seed.catalogId, seed.name).toBe('agent-ui')
    }
  })
})

describe('the example seed shelf (ADR-0055) — standing validity gate', () => {
  for (const seed of allSeeds) {
    describe(`seed: ${seed.name}`, () => {
      it('validates 0-failure via the shared validator (SPEC-N3/N6 parity)', () => {
        expect(validateA2ui(seed.messages, defaultCatalog)).toEqual({ valid: true, failures: [] })
      })

      it('renders through the real host with an empty error channel', () => {
        const sent = renderSmoke(seed)
        expect(sent.filter(isError)).toEqual([])
      })
    })
  }
})

// ── the generative-form seed's shape pins (stream-page seat escalation) ────────────────────────────────
//
// The a2ui-stream page's Demo 1 narration asserts, in prose, that this seed's root "arrives early" and
// the surface "paints early" — a claim about the SHAPE of the re-sliced stream (ADR-0055 clause 5), not
// its validity. Neither leg above pins that shape: a future re-slice could move the root to the LAST
// line and still validate 0-failure + render with an empty error channel, silently making the page's
// narration false. These two assertions are the load-bearing guard for that narration.
describe('the generative-form seed — shape pins (protects the a2ui-stream Demo 1 narration)', () => {
  it('first-paint pin: fed line-by-line, the surface renders its first element after line 2 of 9', () => {
    // The stream-page seat measured this in-order feed at first-paint = 2/9 and the root-LAST permutation
    // (a separate page demo, not this seed) at 9/9 — both finalize clean; it watched the inverted
    // assertion below fail ("expected 9 to be 2") before landing the correct one, proving this bites.
    const r = createRenderer()
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    r.mount(mount)

    let firstPaintLine: number | null = null
    generativeFormSeed.messages.forEach((message, i) => {
      r.ingest(JSON.stringify(message))
      if (firstPaintLine === null && mount.childElementCount > 0) firstPaintLine = i + 1 // 1-based line number
    })

    expect(firstPaintLine).toBe(2)
    expect(generativeFormSeed.messages).toHaveLength(9) // the "line 2 of 9" the narration names

    r.dispose()
    mount.remove()
  })

  it('root-position pin: the root component definition arrives within the first 2 lines', () => {
    const firstTwo = generativeFormSeed.messages.slice(0, 2)
    const hasRoot = firstTwo.some(
      (m) => 'updateComponents' in m && m.updateComponents.components.some((c) => c.id === 'root'),
    )
    expect(hasRoot).toBe(true)
  })
})

// ── the negative control (ADR-0055 clause 4 — "a deliberately-broken local fixture... fails it") ──────
//
// A corrupted VARIANT of a real seed (the canvas-button shape, its Button's `component` swapped for an
// unknown type) — deliberately NOT exported from `./index.ts`/`allSeeds`. Chosen so BOTH gate legs catch
// it: an unknown component type is a `CATALOG` failure in the shared validator AND a live `CATALOG`
// client-message from the real host's widget resolution (the placeholder path, SPEC-R9 AC2) — proving
// the gate bites on both checks, not just one.
// ── the document-row-toolbar seed's Icon pin (2026-07-07 gallery visual audit) ──────────────────────────
//
// Neither standing gate leg above catches an Icon `name` that resolves against NO pack member: the
// validator's `Icon.name` PropDef is an open `string` (ADR-0065/0066 — `ui-icon`'s deliberate swappable-
// pack surface, components/src/controls/icon/icon.ts:16-18), and an unresolved name degrades to a
// non-throwing EMPTY `<svg data-icon-missing="…">` (icons/src/resolve.ts) rather than a client error — so
// `renderSmoke`'s empty-error-channel assertion stays green while the glyph silently renders nothing (a
// no active pack is even registered in THIS jsdom process — pack registration is an explicit side-effect
// import, `@agent-ui/icons/phosphor`, done by the site shell, not by this package — so a DOM-level
// render-smoke check can't tell "unregistered name" apart from "no pack loaded here" anyway). A live
// Playwright audit of /a2ui-gallery.html (where the site shell HAS registered the default Phosphor pack)
// caught exactly this: the seed's original `name: 'file-text'` is not a member of the vendored default
// pack (`ICON_NAMES`, icons/src/types.ts — 11 UI-chrome names, no document/file glyph), so the document
// row's icon painted blank. Pinned as a direct DATA check against the canonical vocabulary — the
// dependency-free, environment-independent form of the same assertion.
describe('the document-row-toolbar seed — Icon pin (visual-audit regression)', () => {
  it('icon_doc.name is a member of the vendored default pack (ICON_NAMES)', () => {
    const iconComponent = documentRowToolbarSeed.messages
      .flatMap((m) => ('updateComponents' in m ? m.updateComponents.components : []))
      .find((c) => c.id === 'icon_doc')
    expect(iconComponent).toBeDefined()
    expect(ICON_NAMES).toContain((iconComponent as { name?: unknown }).name)
  })
})

describe('the gate bites — a deliberately-broken fixture (negative control, NOT exported)', () => {
  const brokenSeed: ExampleSeed = {
    name: 'broken-fixture',
    description: 'A deliberately-invalid fixture — proves the gate rejects a bad payload. Never exported.',
    promptText: 'n/a — negative control only',
    surfaceId: 'broken',
    protocolVersion: 'v1.0',
    catalogId: 'agent-ui',
    messages: [
      { version: 'v1.0', createSurface: { surfaceId: 'broken', catalogId: 'agent-ui' } },
      {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'broken',
          // 'Doohickey' names no default-catalog component — the planted defect.
          components: [{ id: 'root', component: 'Doohickey', label: 'nope' }],
        },
      },
    ],
  }

  it('FAILS validateA2ui with CATALOG on the unknown component type', () => {
    const v = validateA2ui(brokenSeed.messages, defaultCatalog)
    expect(v.valid).toBe(false)
    expect(v.failures).toContainEqual({ code: 'CATALOG', path: 'root' })
  })

  it('FAILS the real-host smoke too — the placeholder path emits a CATALOG error on the client channel', () => {
    const sent = renderSmoke(brokenSeed)
    const errors = sent.filter(isError)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]!.error.code).toBe('VALIDATION_FAILED') // ADR-0031: CATALOG (internal) → VALIDATION_FAILED (wire)
  })

  it('is NOT exported from the shelf — allSeeds carries no seed named "broken-fixture"', () => {
    expect(allSeeds.some((s) => s.name === 'broken-fixture')).toBe(false)
  })
})
