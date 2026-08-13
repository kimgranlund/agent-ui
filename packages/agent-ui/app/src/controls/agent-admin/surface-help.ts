// surface-help.ts — GH #844: the Surface tab's question-mark help affordance.
//
// One factory, one shape. `buildSurfaceHelp(key)` returns a `<ui-tooltip>` carrying a focusable
// question-mark icon (the tooltip's ANCHOR — its first element child, per tooltip.md) plus the help CARD
// the tooltip moves into its own top-layer panel at connect. `agent-admin.ts` appends the returned node
// to a row (after its label) or, marked `slot="summary"`, to a fold — `ui-disclosure` adopts it onto the
// heading row itself (ADR-0158). Nothing else about those rows changes.
//
// WHY the primitive, not a bespoke panel: `ui-tooltip` already owns everything the a11y floor needs —
// `role="tooltip"` on the panel, `aria-describedby` from the anchor to it, focusin showing IMMEDIATELY
// (no delay — keyboard users cannot hover), and focusout/Escape dismissing. GH #844's acceptance names
// exactly that contract and rules out bypassing it, so this file wires it and adds nothing of its own.
//
// WHY a native `<button>` as the anchor: it is the fleet's own documented tooltip anchor (tooltip.md's
// slots block) and the app's own precedent for a bare, unlabeled affordance (`nav-rail.ts`'s trigger,
// `master-detail.ts`'s back control). It is focusable by construction — which is the whole point: the
// icon is hidden at REST but revealed by row hover AND by its own focus (agent-admin.css), so the
// keyboard path is never a second-class copy of the pointer path.
//
// COPY lives in `agent-admin-schema.ts`'s `SURFACE_HELP` — the one source, shared with the rows' own
// native `title` hints. This file authors NO prose; it only projects that record into DOM.

import '@agent-ui/components/controls/tooltip'
import '@agent-ui/components/controls/icon'
import { SURFACE_HELP, type SurfaceHelpKey } from './agent-admin-schema.ts'

/** The hover show-delay for a help icon, in ms. Shorter than `ui-tooltip`'s own 600 ms default: reaching
 *  this icon already costs a deliberate act (hover the row, then travel to the icon it revealed), so the
 *  default's accidental-hover protection has nothing left to protect against. Keyboard focus is
 *  unaffected either way — `ui-tooltip` shows immediately on focusin regardless of this value. */
const HELP_SHOW_DELAY_MS = 200

/**
 * Build one help affordance for `key` — the `<ui-tooltip>` host, its question-mark anchor, and the
 * rich-text card the tooltip will move into its panel.
 *
 * Fully populated BEFORE it is returned, deliberately: `ui-tooltip` claims its first element child as the
 * anchor and relocates the rest into the panel at connect time, so a caller that appended children after
 * connection would strand them outside the panel. Every call site here builds detached and attaches once.
 */
export function buildSurfaceHelp(key: SurfaceHelpKey): HTMLElement {
  const entry = SURFACE_HELP[key]

  const tip = document.createElement('ui-tooltip')
  tip.setAttribute('data-part', 'surface-help')
  tip.setAttribute('data-help', key)
  // The icon sits at a row's inline start (right after the label), so a card that grows to the inline END
  // stays inside the settings column instead of overhanging it. The overlay controller flips/shifts at the
  // viewport edge anyway — this is the PREFERRED side, not a guarantee.
  tip.setAttribute('placement', 'bottom-start')
  tip.setAttribute('delay', String(HELP_SHOW_DELAY_MS))

  const icon = document.createElement('button')
  icon.type = 'button'
  // NO bespoke `data-part` on this button — `ui-tooltip`'s own `#ensureParts` stamps its first element
  // child `data-part="anchor"` unconditionally at connect (tooltip.ts), so any value set here is clobbered
  // the moment it lands in the document. This is the SAME platform fact `entry-list.ts` already documents
  // for `ui-menu`'s trigger, and the same answer: address it scoped through the HOST's own marker —
  // `[data-part='surface-help'] > [data-part='anchor']` — never a second, losing attribute name. (Measured,
  // not assumed: an earlier revision of this file did set one, and every query for it returned null.)
  // The card IS the description (`ui-tooltip` wires `aria-describedby` to it), so the NAME stays short and
  // says only which thing is being explained — never a second copy of the prose.
  icon.setAttribute('aria-label', `About ${entry.title}`)
  const glyph = document.createElement('ui-icon')
  glyph.setAttribute('data-role', 'icon')
  glyph.setAttribute('glyph', 'question')
  icon.append(glyph)
  // A click on this icon must never ACTIVATE what the icon rides. On a fold's heading row the icon is a
  // `<summary>` descendant, and a native button there is exactly the case `ui-disclosure`'s summary-slot
  // guard stands down for (ADR-0158 cl.3 — an activatable owns the click), which would leave the fold
  // free to toggle. Cancelling the event here removes that: the help icon explains, it never folds.
  // (Not a tap-to-open affordance — GH #844 rules touch out of scope; this only refuses a side effect.)
  icon.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
  })

  const card = document.createElement('div')
  card.setAttribute('data-part', 'surface-help-card')

  const title = document.createElement('strong')
  title.setAttribute('data-part', 'surface-help-title')
  title.textContent = entry.title

  const summary = document.createElement('p')
  summary.setAttribute('data-part', 'surface-help-summary')
  summary.textContent = entry.summary

  card.append(title, summary)

  for (const paragraph of entry.body) {
    const p = document.createElement('p')
    p.setAttribute('data-part', 'surface-help-body')
    p.textContent = paragraph
    card.append(p)
  }

  if (entry.facts !== undefined && entry.facts.length > 0) {
    const facts = document.createElement('ul')
    facts.setAttribute('data-part', 'surface-help-facts')
    for (const fact of entry.facts) {
      const row = document.createElement('li')
      const term = document.createElement('strong')
      term.textContent = `${fact.term}: `
      // textContent, never innerHTML — the copy is authored data, and this whole card is plain structured
      // markup by ruling (GH #844: `ui-markdown` only if the copy genuinely needs it; it does not).
      row.append(term, document.createTextNode(fact.detail))
      facts.append(row)
    }
    card.append(facts)
  }

  tip.append(icon, card)
  return tip
}

/** The SAME affordance, marked for a `ui-disclosure` heading row (`slot="summary"`, ADR-0158): the fold
 *  adopts it into its summary part at connect, after the label. A separate entry point rather than an
 *  options bag so the two placements read differently at the call site — a group header and an element
 *  row are different things. */
export function buildSurfaceHelpForSummary(key: SurfaceHelpKey): HTMLElement {
  const tip = buildSurfaceHelp(key)
  tip.setAttribute('slot', 'summary')
  return tip
}
