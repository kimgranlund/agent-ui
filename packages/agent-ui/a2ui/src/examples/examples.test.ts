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
import { allSeeds, generativeFormSeed, kpiPanelLifecycleSeed } from './index.ts'
import type { ExampleSeed } from './types.ts'
import { canvasSeeds } from './canvas-button.ts'
import { dynamicListSeeds } from './dynamic-lists.ts'
import { generativeFormSeeds } from './generative-form.ts'
import { patternSeeds } from './patterns.ts'
import { catalogCoverageSeeds } from './catalog-coverage.ts'
import { messageLifecycleSeeds } from './message-lifecycle.ts'
import { corpusGrowthSeeds } from './corpus-growth.ts'
import { catalogFrontierSeeds } from './catalog-frontier.ts'
import { structuredContainerSeeds } from './structured-container.ts'
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
      canvasSeeds.length +
      dynamicListSeeds.length +
      generativeFormSeeds.length +
      patternSeeds.length +
      catalogCoverageSeeds.length +
      messageLifecycleSeeds.length +
      corpusGrowthSeeds.length +
      catalogFrontierSeeds.length +
      structuredContainerSeeds.length
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

// ── the message-lifecycle exemplar — SPEC-R4 fixture-validation (ADR-0126/TKT-0016, LLD-C4) ────────────
//
// Beyond the generic per-seed loop above (which validates the COMPLETE stream + a full render smoke),
// SPEC-R4 AC1 requires every PREFIX of the exemplar's stream to validate 0-errors (the round-trip.test.ts
// method: treating each prefix as the surface's state at that point) and AC2 requires the restructure
// step's resent container to carry its FULL prior prop set, not a diff.

describe('the kpi-panel-lifecycle exemplar — SPEC-R4 fixture validation', () => {
  it('every prefix of the stream validates 0-failure (SPEC-R4 AC1)', () => {
    const messages = kpiPanelLifecycleSeed.messages
    for (let i = 1; i <= messages.length; i++) {
      const prefix = messages.slice(0, i)
      expect(validateA2ui(prefix, defaultCatalog), `prefix of length ${i}`).toEqual({ valid: true, failures: [] })
    }
  })

  it('carries all four message types, in order, addressing the SAME surfaceId (SPEC-R4)', () => {
    const messages = kpiPanelLifecycleSeed.messages
    const kinds = messages.map((m) => Object.keys(m).find((k) => k !== 'version')!)
    expect(kinds).toContain('createSurface')
    expect(kinds).toContain('updateComponents')
    expect(kinds).toContain('updateDataModel')
    expect(kinds).toContain('deleteSurface')
    // Ordering: open before restructure before close; a data-only react sits after the restructure.
    expect(kinds.indexOf('createSurface')).toBeLessThan(kinds.indexOf('updateComponents'))
    expect(kinds.lastIndexOf('updateDataModel')).toBeLessThan(kinds.indexOf('deleteSurface'))
    for (const m of messages) {
      const body = (m as Record<string, { surfaceId?: string }>)[Object.keys(m).find((k) => k !== 'version')!]
      expect(body?.surfaceId, JSON.stringify(m)).toBe(kpiPanelLifecycleSeed.surfaceId)
    }
  })

  it("the restructure step resends \"grid\" WHOLE — its prior min/gap props survive, not just the new child (SPEC-R4 AC2 / SPEC-R2)", () => {
    // The FIRST updateComponents already delivers "grid" too (with children:["revenue"]) — locate the
    // SECOND delivery specifically (the restructure step), not the initial one.
    const gridDeliveries = kpiPanelLifecycleSeed.messages.filter(
      (m): m is Extract<typeof m, { updateComponents: unknown }> =>
        'updateComponents' in m && m.updateComponents.components.some((c) => c.id === 'grid'),
    )
    expect(gridDeliveries).toHaveLength(2)
    const resent = gridDeliveries[1]!.updateComponents.components.find((c) => c.id === 'grid')!
    expect(resent.min).toBe('12rem') // the ORIGINAL prop, carried forward on the resend — not dropped
    expect(resent.gap).toBe('md')
    expect(resent.children).toEqual(['revenue', 'churn']) // the new child, alongside the original
  })

  it('root is delivered exactly once — never resent (runtime SPEC-R3 AC2; the LLD-repair this seed proves)', () => {
    const rootDeliveries = kpiPanelLifecycleSeed.messages.filter(
      (m) => 'updateComponents' in m && m.updateComponents.components.some((c) => c.id === 'root'),
    )
    expect(rootDeliveries).toHaveLength(1)
  })

  it('the final deleteSurface leaves no orphaned references (SPEC-R4 AC1) — a fresh renderer finalizes clean', () => {
    const sent = renderSmoke(kpiPanelLifecycleSeed)
    expect(sent.filter(isError)).toEqual([])
  })

  it('the restructure step actually RENDERS the added "churn" KPI through a REAL createRenderer — not merely validated (TKT-0024 / renderer-structural-resend.spec.md SPEC-R1/R2)', () => {
    // Replay every message up to (but not including) the final `deleteSurface` — the arc's open → restructure
    // → react steps — through a real host + mount, mirroring `renderSmoke` but stopping short of teardown so
    // the restructured DOM is still there to inspect.
    const messages = kpiPanelLifecycleSeed.messages
    const beforeClose = messages.filter((m) => !('deleteSurface' in m))
    expect(beforeClose.length).toBe(messages.length - 1) // exactly the one deleteSurface line excluded

    const sent: A2uiClientMessage[] = []
    const r = createRenderer()
    r.onClientMessage((m) => void sent.push(m))
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    r.mount(mount)
    for (const message of beforeClose) r.ingest(JSON.stringify(message))

    // Both KPI tiles are genuinely in the DOM — "revenue" from the initial build, "churn" from the
    // restructure step that resends "grid" whole with the grown children list (the bug TKT-0024 closes).
    expect(mount.textContent).toContain('Revenue')
    expect(mount.textContent).toContain('Churn')
    expect(sent.filter(isError)).toEqual([])

    r.dispose()
    mount.remove()
  })
})

// ── the negative control (ADR-0055 clause 4 — "a deliberately-broken local fixture... fails it") ──────
//
// A corrupted VARIANT of a real seed (the canvas-button shape, its Button's `component` swapped for an
// unknown type) — deliberately NOT exported from `./index.ts`/`allSeeds`. Chosen so BOTH gate legs catch
// it: an unknown component type is a `CATALOG` failure in the shared validator AND a live `CATALOG`
// client-message from the real host's widget resolution (the placeholder path, SPEC-R9 AC2) — proving
// the gate bites on both checks, not just one.
// ── the document-row-toolbar seed's former Icon pin (2026-07-07 gallery visual audit) ────────────────────
//
// RETIRED (feed-family.lld.md LLD-C15, M2, SPEC-R22): the seed's hand-composed Row[Icon,Text] file card —
// the thing this regression pin protected — upgraded to a real `Attachment`, whose glyph derives from
// `mimeType` via `fileCategory`, a total function that always resolves a real glyph (feed-family.spec.md
// SPEC-R9). `icon_doc` no longer exists on this seed, so the missing-glyph failure mode this pin caught is
// now structurally unreachable here, not merely re-proven; the pin retires with the code it protected.

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

// ── ADR-0163 cl.9 coverage fixture — the widened Table + standalone Pagination shape ──────────────────
//
// Deliberately NOT exported from `./index.ts`/`allSeeds` (the `broken-fixture` precedent above, same
// file, same reasoning): `ops-report`/`rental-filter-panel` are ALREADY-ADMITTED corpus records
// (`corpus/exemplar/v1_0/agent-ui.jsonl`, `meta.canonicalHash` pinned). Editing either's payload in
// place — the natural first instinct for "extend the existing Table example" — changes its canonical
// hash, which `tools/corpus/import-seeds.ts` (ADR-0165) treats as a genuinely NEW, unjudged candidate
// under an old name: the sanctioned path for that is a DELIBERATE `--replace <name>` re-admission
// carrying a REAL judged verdict (`import-seeds.test.ts`'s own header: "an improved seed is near-
// identical to its predecessor BY CONSTRUCTION" — the `--replace` re-admission, not a silent in-place
// edit). A builder seat closing a rubric gap has no standing to author that verdict — that is the
// a2ui-reviewer's call, exercised through the real corpus-growth workflow, not a side effect of a test-
// coverage patch. So this fixture proves the SAME two things `broken-fixture` proves for its own shape
// (0-failure conformance + a clean real-host render) for the widened `Table` props (`selectable`,
// `selected`, a `sortable` column, `pageSize`/`page`) and the standalone `Pagination` row (bound `page`,
// static `pages`/`label`) WITHOUT touching corpus-admitted content or `allSeeds`. A real corpus-teaching
// exemplar for this shape is a follow-up corpus-growth wave, run through the real judged pipeline.
describe('ADR-0163 cl.9 coverage fixture — widened Table (selectable/selected/sort/page) + standalone Pagination (not exported, not corpus-admitted)', () => {
  const interactiveTableFixture: ExampleSeed = {
    name: 'interactive-table-pagination-fixture',
    description: 'Coverage-only fixture (not a corpus seed): a selectable+sortable+paginated Table alongside a standalone Pagination bound to a list.',
    promptText: 'n/a — coverage fixture only',
    surfaceId: 'itp',
    protocolVersion: 'v1.0',
    catalogId: 'agent-ui',
    messages: [
      { version: 'v1.0', createSurface: { surfaceId: 'itp', catalogId: 'agent-ui' } },
      {
        version: 'v1.0',
        updateDataModel: {
          surfaceId: 'itp',
          value: {
            checks: [
              { name: 'api-gateway', env: 'prod', latency: 812 },
              { name: 'auth-service', env: 'prod', latency: 640 },
              { name: 'billing-worker', env: 'prod', latency: 205 },
            ],
            selectedChecks: [],
            checksPage: 1,
            results: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
            resultsPage: 1,
          },
        },
      },
      {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'itp',
          components: [
            { id: 'root', component: 'Column', gap: 'md', children: ['table', 'list', 'pagination'] },
            // The widened Table (ADR-0163 cl.9): `selectable="multi"` + `selected` bound (the richest of
            // Table's three commit slots), a `sortable` column, and `pageSize`/`page` windowing — the
            // table stamps its OWN internal `ui-pagination` footer for this shape (cl.6).
            {
              id: 'table', component: 'Table', label: 'Failing checks',
              selectable: 'multi', rowKey: 'name', selected: { path: '/selectedChecks' },
              pageSize: 2, page: { path: '/checksPage' },
              columns: [
                { key: 'name', label: 'Check', type: 'string' },
                { key: 'env', label: 'Environment', type: 'string' },
                { key: 'latency', label: 'Latency (ms)', type: 'number', sortable: true },
              ],
              rows: { path: '/checks' },
            },
            { id: 'list', component: 'List', gap: 'sm', children: { path: '/results', componentId: 'result_text' } },
            { id: 'result_text', component: 'Text', text: '${label}' },
            // The standalone-over-a-list shape (ADR-0163 cl.6 — Pagination "reusable beyond tables"): a
            // page navigator over `/results`, two-way bound on `page` only (`pages`/`label` stay static,
            // `factories.ts`'s `paginationFactory` doc comment explains why).
            { id: 'pagination', component: 'Pagination', label: 'Results pages', page: { path: '/resultsPage' }, pages: 2 },
          ],
        },
      },
    ],
  }

  it('validates 0-failure via validateA2ui (SPEC-N3/N6 parity, the standing shelf gate\'s own leg a)', () => {
    expect(validateA2ui(interactiveTableFixture.messages, defaultCatalog)).toEqual({ valid: true, failures: [] })
  })

  it('renders through the real host with an empty error channel (leg b) — a real ui-table selection checkbox and a real ui-pagination both mount', () => {
    const sent = renderSmoke(interactiveTableFixture)
    expect(sent.filter(isError)).toEqual([])
  })

  it('is NOT exported from the shelf — allSeeds carries no seed named "interactive-table-pagination-fixture" (never becomes a corpus candidate by accident)', () => {
    expect(allSeeds.some((s) => s.name === 'interactive-table-pagination-fixture')).toBe(false)
  })
})

// ── GH #729 — the standing catalog-coverage gate (the 2026-08-12 example sweep's durable fix) ──────────
// The sweep found 13 of the catalog's 59 components appearing in NO example anywhere (this shelf ∪ the
// committed exemplar shard) — the catalog had outgrown its examples, and nothing reddened. This gate makes
// example-coverage a standing invariant: a future catalog row with no example fails HERE, naming itself,
// instead of silently shipping example-less onto the gallery/patterns/docs pages that derive from the shelf.
describe('GH #729 — every catalog component appears in at least one example (shelf ∪ committed corpus shard)', () => {
  it('no component of the default catalog is example-less', async () => {
    const { readFileSync } = await import('node:fs')
    const used = new Set<string>()
    const collect = (messages: readonly unknown[]): void => {
      for (const m of messages) {
        const uc = (m as { updateComponents?: { components?: { component?: string }[] } }).updateComponents
        for (const c of uc?.components ?? []) if (c.component !== undefined) used.add(c.component)
      }
    }
    for (const seed of allSeeds) collect(seed.messages)
    // the committed exemplar shard — read the same way corpus-data.test.ts reads it (node:fs, never ?raw)
    const here = (import.meta as { dirname?: string }).dirname ?? '.'
    const shard = readFileSync(`${here}/../../corpus/exemplar/v1_0/agent-ui.jsonl`, 'utf8') as string
    for (const line of shard.split('\n').filter((l: string) => l.trim().length > 0)) {
      collect((JSON.parse(line) as { a2uiOutput?: unknown[] }).a2uiOutput ?? [])
    }
    const uncovered = Object.keys(defaultCatalog.components).filter((c) => !used.has(c))
    expect(uncovered, `catalog component(s) with NO example anywhere — add a seed: ${uncovered.join(', ')}`).toEqual([])
  })
})
