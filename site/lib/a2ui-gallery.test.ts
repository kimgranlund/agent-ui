import { describe, it, expect } from 'vitest'
import { buildSeedGallery, buildSeedCard } from './a2ui-gallery.ts'
import { allSeeds } from '@agent-ui/a2ui/examples'
import type { ExampleSeed } from '@agent-ui/a2ui/examples'

// a2ui-gallery.test.ts — the DERIVATION + drift gate for the A2UI composition gallery (site/lib/
// a2ui-gallery.ts). Sister to gallery.test.ts (the ui-* control gallery's derivation gate). The page's
// members are DERIVED from the example-seed shelf (`allSeeds`, ADR-0055), NEVER hand-listed — a new seed
// appears with ZERO page edits. Two legs, and it's worth being honest about what each buys:
//   (a) the derived card set ≡ the shelf, in shelf order. This equality is TAUTOLOGICAL against the current
//       `buildSeedGallery` (which is `allSeeds.map(...)` — both sides read the same shelf), so it cannot
//       catch a shelf edit today. Its real job is a TRIPWIRE: if a future refactor ever replaces the
//       `allSeeds.map` derivation with a hand-listed builder, THIS is the leg that would then bite (the
//       phantom-seed negative control confirms the equality is wired, not that today's derivation could
//       drift). The load-bearing coverage lives in (b).
//   (b) every card's live surface actually rendered — non-empty AND no renderer rejection. This is the leg
//       that fails if a seed or the renderer regresses (+ two negative controls that bite it: a
//       deliberately-broken seed [the examples.test.ts fixture] for the rejection arm, and an
//       empty-surface fixture for the childElementCount arm).
//
// jsdom reality (the examples.test.ts / gallery.test.ts precedent): `ElementInternals.setFormValue`/
// `setValidity` are ABSENT in jsdom, and this gate mounts REAL default-catalog form controls through the
// REAL renderer (which builds each via `document.createElement(tag)` with no per-instance hook). So the
// stub is applied ONCE at the shared prototype (additive — a no-op if a future jsdom ships the real
// method), exactly as the seed shelf's own gate does.
if (typeof ElementInternals.prototype.setFormValue !== 'function') {
  ;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = function (): void {}
  ;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = function (): void {}
}

describe('the A2UI gallery — members DERIVED from the seed shelf, never hand-listed', () => {
  it('found real seeds on the shelf (anti-vacuous — a broken/empty shelf import cannot pass silently)', () => {
    expect(allSeeds.length).toBeGreaterThanOrEqual(10)
  })

  it('renders exactly one card per shelf seed — card count ≡ allSeeds.length (derived, not a literal)', () => {
    const { cards } = buildSeedGallery()
    expect(cards).toHaveLength(allSeeds.length)
  })

  it('the card set ≡ the shelf, in shelf order (1:1 derivation, not a coincidental count)', () => {
    const { root, cards } = buildSeedGallery()
    const expected = allSeeds.map((s) => s.name)
    expect(cards.map((c) => c.seed.name)).toEqual(expected)
    // the rendered DOM carries the same derived set on its stable per-seed selector
    expect([...root.querySelectorAll('.seed-card')].map((c) => (c as HTMLElement).dataset.seed)).toEqual(expected)
  })

  it('the derivation check BITES: a planted phantom seed name fails the equality (negative control)', () => {
    const { cards } = buildSeedGallery()
    const withPhantom = [...allSeeds.map((s) => s.name), 'zz-fake-seed']
    expect(cards.map((c) => c.seed.name)).not.toEqual(withPhantom)
  })
})

describe('the A2UI gallery — every card renders a live, non-empty surface with no renderer rejection', () => {
  const { cards } = buildSeedGallery()
  for (const { seed, surface, errors, card } of cards) {
    it(`seed "${seed.name}": surface rendered non-empty and clean`, () => {
      expect(errors, `seed "${seed.name}" was rejected by the renderer: ${JSON.stringify(errors)}`).toEqual([])
      expect(surface.childElementCount, `seed "${seed.name}" rendered an empty surface`).toBeGreaterThan(0)
      expect(card.dataset.rendered, `seed "${seed.name}" card flagged as not rendered`).toBe('true')
      expect(card.querySelector('.seed-card-defect'), `seed "${seed.name}" carries a defect note`).toBeNull()
    })
  }
})

// ── self-deleting seeds (TKT-0016) — a seed whose OWN arc ends in `deleteSurface` correctly renders an
// EMPTY surface on a full ingest (the delete really did tear it down); the gallery card DISPLAYS the arc's
// fullest state instead (every message except that final deleteSurface) with an honest badge, while a
// SEPARATE probe proves the full stream (close included) still tears down cleanly. Detected structurally
// (the seed's last message is a deleteSurface targeting the seed's OWN surfaceId) — never by seed name, so
// the next seed of this shape rides free with zero test edits. This turns the collision the gallery drift
// gate first caught (`kpi-panel-lifecycle` rendering empty) into a STRONGER assertion, not an exclusion:
// every seed above (including this one) still proves "non-empty, clean, no defect" via the loop above; this
// block additionally proves the badge is honest and the full close is genuinely leak-free.
describe('the A2UI gallery — self-deleting seeds display their fullest state + prove a clean full close', () => {
  const { cards } = buildSeedGallery()
  const selfDeleting = cards.filter((c) => c.closesWithDeleteSurface)

  it('at least one shelf seed closes its own surface (anti-vacuous — TKT-0016 kpi-panel-lifecycle)', () => {
    expect(selfDeleting.length).toBeGreaterThanOrEqual(1)
  })

  for (const { seed, card, deletesCleanly } of selfDeleting) {
    it(`seed "${seed.name}": carries the honest "closes with deleteSurface" badge`, () => {
      const badge = card.querySelector('.seed-card-badge')
      expect(badge, `seed "${seed.name}" should carry the self-deleting badge`).not.toBeNull()
      expect(badge?.textContent).toBe('closes with deleteSurface')
    })

    it(`seed "${seed.name}": the FULL stream (its own closing deleteSurface included) tears down cleanly`, () => {
      expect(deletesCleanly, `seed "${seed.name}"'s full close left an error or an orphaned DOM node`).toBe(true)
    })
  }
})

// ── the detection negative control — a trailing deleteSurface that does NOT target the seed's OWN
// surfaceId must NOT be treated as a self-close (never by name — structural: "last message is deleteSurface
// AND targets seed.surfaceId"). Proves the generic detection actually discriminates, not merely "any
// trailing deleteSurface". ──────────────────────────────────────────────────────────────────────────────
describe('the self-close detection BITES only on the seed\'s OWN surfaceId (negative control)', () => {
  const trailingDeleteOfOtherSurfaceSeed: ExampleSeed = {
    name: 'trailing-delete-of-other-fixture',
    description: 'A seed whose trailing deleteSurface targets a DIFFERENT surfaceId — not a self-close. Never on the shelf.',
    promptText: 'n/a — negative control only',
    surfaceId: 'mine',
    protocolVersion: 'v1.0',
    catalogId: 'agent-ui',
    messages: [
      { version: 'v1.0', createSurface: { surfaceId: 'mine', catalogId: 'agent-ui' } },
      { version: 'v1.0', updateComponents: { surfaceId: 'mine', components: [{ id: 'root', component: 'Text', text: 'hi' }] } },
      { version: 'v1.0', deleteSurface: { surfaceId: 'someone-else' } }, // targets a DIFFERENT surface
    ],
  }

  it('is NOT flagged as self-deleting, renders the FULL stream (including the stray trailing delete), and stays non-empty/clean', () => {
    const card = buildSeedCard(trailingDeleteOfOtherSurfaceSeed)
    expect(card.closesWithDeleteSurface).toBe(false)
    expect(card.deletesCleanly).toBe(true) // vacuously true — nothing to prove for a non-self-closing seed
    expect(card.card.querySelector('.seed-card-badge')).toBeNull()
    expect(card.errors).toEqual([])
    expect(card.surface.childElementCount).toBeGreaterThan(0) // "mine"'s own root survives the OTHER surface's delete
  })

  it('the fixture is NOT on the shelf', () => {
    expect(allSeeds.some((s) => s.name === 'trailing-delete-of-other-fixture')).toBe(false)
  })
})

// ── the render-leg negative control (the examples.test.ts broken fixture — NOT on the shelf) ────────────
// A corrupted seed whose Button's `component` is an unknown catalog type. buildSeedCard must DETECT the
// rejection (a VALIDATION_FAILED client-error from the real host's placeholder path, SPEC-R9 AC2), mark
// the card as not-rendered, and surface the defect note — proving the clean-render leg above is not vacuous.
describe('the render check BITES — a deliberately-broken seed is caught, not papered over (negative control)', () => {
  const brokenSeed: ExampleSeed = {
    name: 'broken-fixture',
    description: 'A deliberately-invalid seed — proves the gallery gate rejects a bad payload. Never on the shelf.',
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

  it('the broken seed is caught: errors emitted, card flagged not-rendered, defect note shown', () => {
    const { errors, card } = buildSeedCard(brokenSeed)
    expect(errors.length, 'the broken seed should have emitted a renderer error').toBeGreaterThan(0)
    expect(card.dataset.rendered).toBe('false')
    expect(card.querySelector('.seed-card-defect')).not.toBeNull()
  })

  it('the broken fixture is NOT on the shelf — allSeeds carries no seed named "broken-fixture"', () => {
    expect(allSeeds.some((s) => s.name === 'broken-fixture')).toBe(false)
  })
})

// ── the abandoned-surface negative control (both arms of the `data-rendered` predicate) ─────────────────
// `data-rendered` is `errors.length === 0 && surface.childElementCount > 0`. The broken-seed control above
// bites the `errors.length === 0` arm via a CATALOG rejection; this fixture is a `createSurface` with no
// `updateComponents` — nothing is ever mounted.
//
// ADR-0187 / GH #829 REPAIR. This fixture used to bite the `childElementCount > 0` arm in ISOLATION,
// because a bare `createSurface` validated CLEAN: that was the defect (GH #802's silent blank card). The
// renderer's `finalize()` now judges at finalize granularity, so this payload emits
// `VALIDATION_FAILED` (`empty:root-missing`) and the fixture bites BOTH arms. The isolation is gone
// because the STATE it isolated is gone — "accepted clean yet renders nothing" is precisely the class
// ADR-0187 eliminates, so no fixture can reconstruct it. `a2ui-gallery.ts`'s
// "This seed rendered an empty surface." branch is therefore now a DEFENSIVE fallback rather than a
// reachable one, and the card shows the rejection note instead. Kept as-is (total, harmless); flagged on
// GH #829 rather than pruned, since removing it is a site-owned judgment, not this fix's.
describe('the render check BITES on an abandoned surface — created-but-never-filled is caught (negative control)', () => {
  const emptySeed: ExampleSeed = {
    name: 'empty-fixture',
    description: 'An abandoned seed — createSurface with no updateComponents. Never on the shelf.',
    promptText: 'n/a — negative control only',
    surfaceId: 'empty',
    protocolVersion: 'v1.0',
    catalogId: 'agent-ui',
    // createSurface only — no components are ever mounted, so the surface renders EMPTY.
    messages: [{ version: 'v1.0', createSurface: { surfaceId: 'empty', catalogId: 'agent-ui' } }],
  }

  it('the abandoned seed is caught: IDGRAPH-rejected at finalize, empty surface, card flagged not-rendered', () => {
    const { errors, surface, card } = buildSeedCard(emptySeed)
    // ADR-0187: the finalize judgment fires — the EXISTING IDGRAPH class mapped by the renderer LLD §9
    // table to `VALIDATION_FAILED` + surfaceId (no new code, no wire widening).
    expect(errors, 'a bare createSurface must now emit the finalize IDGRAPH error (ADR-0187)').toHaveLength(1)
    expect(errors[0]!.error).toMatchObject({ code: 'VALIDATION_FAILED', surfaceId: 'empty' })
    expect(errors[0]!.error.message).toContain('empty:root-missing')
    expect(surface.childElementCount, 'a bare createSurface should mount NO components').toBe(0)
    expect(card.dataset.rendered).toBe('false')
    const defect = card.querySelector('.seed-card-defect')
    expect(defect, 'the defect note should be shown').not.toBeNull()
    expect(defect?.textContent).toContain('VALIDATION_FAILED')
  })

  it('the empty fixture is NOT on the shelf — allSeeds carries no seed named "empty-fixture"', () => {
    expect(allSeeds.some((s) => s.name === 'empty-fixture')).toBe(false)
  })
})
