// site/lib/a2ui-gallery.ts — the A2UI COMPOSITION GALLERY's derivation logic. Sister to
// component-gallery.ts (the ui-* control gallery): where that derives its members 1:1 from the descriptor
// `tag:` scalars, this derives its members 1:1 from the EXAMPLE-SEED SHELF (`allSeeds`, ADR-0055) — one
// card per seed, NEVER hand-listed. A future seed added to the shelf appears here with ZERO page edits.
// This module holds no seed literals: it IS the second consumer of the seed shelf, the examples gate
// (`examples.test.ts`) being the first.
//
// What the drift gate (a2ui-gallery.test.ts) actually buys: the count/name-equality legs are TAUTOLOGICAL
// against the current `allSeeds.map` below (both the assertion and the builder read the same shelf), so
// they cannot catch a shelf edit today — their job is a TRIPWIRE against a FUTURE refactor that replaces
// `allSeeds.map` with a hand-listed builder (at which point the equality would bite). The REAL coverage is
// the per-seed render legs: every seed's payload is driven through the real renderer and asserted to
// produce a non-empty, rejection-free surface — that is what fails if a seed or the renderer regresses.
//
// Each card renders a LIVE mini-surface by driving the seed's `messages` through the REAL @agent-ui/a2ui
// renderer (`createRenderer`) — the exact path the server transport and the a2ui-patterns page take, no
// screenshots/mockups. All displayed card text (name · description · promptText · message count · the JSON
// payload disclosure) is read straight off the seed, so a card cannot drift from the payload it renders.
//
// Kept as a `lib/` module (not the page module) for the same reason component-gallery.ts is: the page
// module runs `mountPage` on import (it stamps the app shell into #app), so a test importing it would
// mount the whole page. This module has no such side effect beyond its own CSS import, so the drift gate
// imports THIS and asserts the derived cards directly.
import './a2ui-gallery.css'
import { codeBlock } from './code-block.ts'
import { createRenderer } from '@agent-ui/a2ui'
import type { A2uiErrorMessage } from '@agent-ui/a2ui'
import { allSeeds } from '@agent-ui/a2ui/examples'
import type { ExampleSeed } from '@agent-ui/a2ui/examples'

/** One derived gallery card: the seed, its built card element, its live surface, and any renderer error
 *  the host emitted while rendering it (empty ⇒ the surface rendered clean; non-empty ⇒ a SEED DEFECT the
 *  drift gate fails on — a rejection is surfaced honestly, never papered over in the page). */
export interface SeedCard {
  readonly seed: ExampleSeed
  readonly card: HTMLElement
  readonly surface: HTMLElement
  readonly errors: readonly A2uiErrorMessage[]
}

/**
 * buildSeedCard — one card for one seed: a head (name + derived message-count facet), the seed's
 * description + the prompt an agent would have received, a collapsed disclosure of the exact JSON payload
 * (derived from `seed.messages`), then a LIVE surface produced by feeding those messages through a fresh
 * real renderer. The host is left live (not disposed) so the surface stays
 * interactive, exactly like the a2ui-patterns demos. Errors emitted on the client channel (a validator
 * rejection or a widget-resolution failure) are collected and reflected onto `data-rendered` so a defect is
 * visible on the page AND assertable by the gate.
 */
export function buildSeedCard(seed: ExampleSeed): SeedCard {
  const card = document.createElement('div')
  card.className = 'seed-card'
  card.dataset.seed = seed.name // a stable per-seed selector (the gate + any browser probe)

  const head = document.createElement('div')
  head.className = 'seed-card-head'
  const heading = document.createElement('h2')
  heading.className = 'seed-card-heading'
  heading.textContent = seed.name
  const count = document.createElement('span')
  count.className = 'seed-card-count'
  // A DERIVED facet — the ExampleSeed shape carries no tags, so the only honest facet is the payload's own
  // message count (read off the seed, never invented). Pluralized off the real length.
  count.textContent = `${seed.messages.length} ${seed.messages.length === 1 ? 'message' : 'messages'}`
  head.append(heading, count)

  const desc = document.createElement('p')
  desc.className = 'seed-card-desc'
  desc.textContent = seed.description

  const prompt = document.createElement('p')
  prompt.className = 'seed-card-prompt'
  prompt.textContent = seed.promptText

  // The collapsed payload disclosure — the exact JSON the agent sends, DERIVED from `seed.messages` (never
  // hand-transcribed), so the card literally shows "the payload the agent sends" beside the surface it
  // produces. Rendered through the shared `codeBlock` helper (textContent, never innerHTML) and height-
  // capped in CSS. This is the payload half of the page's promise; the live surface below is the produced half.
  const payload = document.createElement('details')
  payload.className = 'seed-card-payload'
  const payloadSummary = document.createElement('summary')
  payloadSummary.textContent = 'Agent payload (JSON)'
  payload.append(payloadSummary, codeBlock(JSON.stringify(seed.messages, null, 2), 'json'))

  const surface = document.createElement('div')
  surface.className = 'seed-surface'

  // Drive the payload through a fresh renderer via its PUBLIC surface — exactly as the transport would.
  const errors: A2uiErrorMessage[] = []
  const host = createRenderer()
  host.onClientMessage((m) => {
    if ('error' in m) errors.push(m)
  })
  host.mount(surface)
  for (const message of seed.messages) host.ingestMessage(message)
  host.finalize(seed.surfaceId)

  card.dataset.rendered = errors.length === 0 && surface.childElementCount > 0 ? 'true' : 'false'
  card.append(head, desc, prompt, payload, surface)

  // A SEED DEFECT is shown, not hidden: if the surface failed to render, an honest note names it on the
  // card (the drift gate fails independently on the same `errors`/empty-surface condition).
  if (card.dataset.rendered === 'false') {
    const defect = document.createElement('p')
    defect.className = 'seed-card-defect'
    defect.setAttribute('role', 'status')
    defect.textContent =
      errors.length > 0
        ? `This seed did not render — the renderer rejected its payload (${errors[0]!.error.code}).`
        : 'This seed rendered an empty surface.'
    card.append(defect)
  }

  return { seed, card, surface, errors }
}

/**
 * buildSeedGallery — the whole gallery, DERIVED from `allSeeds`: one card per seed in shelf order, wrapped
 * in a responsive grid. Returns the grid root (for the page) plus the per-card results (for the drift
 * gate). No seed is named here — the member list is the shelf, so a new seed appears with zero edits.
 */
export function buildSeedGallery(): { root: HTMLElement; cards: SeedCard[] } {
  const root = document.createElement('div')
  root.className = 'seed-gallery'
  const cards = allSeeds.map(buildSeedCard)
  for (const { card } of cards) root.append(card)
  return { root, cards }
}
