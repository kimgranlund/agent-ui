// site/pages/toggle-doc.ts — the ui-toggle API doc page (GH #832). DERIVED from `toggle.md`: the API table
// (pressed/disabled/size), the Events table (`toggle`), and the Slots table (icon/label/state-icon) are read
// straight from the canonical parser's parse via `composeDocPage` — the SAME renderer every control's doc
// page shares — so none of them can drift from the descriptor the contract trip-wire (toggle-descriptor.test.ts)
// enforces (ADR-0004, one parser / two consumers). Only the live specimens below are hand-authored: the size/
// state rows iterate the PARSED `size` enum (never a hand-typed sm/md/lg list), and the slot-anatomy row is a
// markup SHAPE (which of the three fixed-role slots are filled), the button-doc.ts Anatomy-section precedent —
// underivable from the attributes table, so it is authored here rather than pretended to come from the parse.
//
// ui-toggle is the fleet's newest primitive: minted by the ADR-0179 GH #686 Amendment (S7-a,
// admin-three-pane-ia.lld.md §16.4) as the "the fleet has no pressed-pill toggle-button primitive" ruling —
// ui-switch is a track-and-thumb FORM control, ui-segmented-control is single-select-by-construction, and
// ui-button carries no pressed state at all (the amendment's own survey). This page also demonstrates the
// cancelable-before-commit "Refused toggle" design (toggle.md's own section) with a real listener, not prose
// alone — the LLD §16.2 min-one invariant a downstream consumer (out of this control's own scope) needs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadToggleDoc } from '../lib/frontmatter.ts'
import { findAttr, heading, renderApiTable, renderEventsTable, renderSlotsTable, renderMarkdownBody } from '../lib/doc-page.ts'
import { exampleSection, captioned } from '../lib/specimens.ts'
import { resolveIcon, type IconName } from '@agent-ui/icons'
import '@agent-ui/icons/phosphor' // registers + activates the Phosphor default pack (ADR-0066) — resolveIcon below
import type { ParsedDescriptor } from '@agent-ui/components/descriptor'
import type { UIToggleElement } from '@agent-ui/components/components'

const { descriptor, body } = loadToggleDoc()

const { content } = mountPage({
  title: 'ui-toggle — API',
  intro:
    'A light-DOM pressed-state pill button — icon + label + an optional orthogonal state icon, toggling an ' +
    'ARIA-pressed boolean. Minted by the ADR-0179 GH #686 Amendment (S7-a) as the fleet’s first ' +
    'toggle-button primitive: not form-associated (unlike ui-switch’s track-and-thumb value), not ' +
    'single-select-by-construction (unlike ui-segmented-control), and — unlike ui-button — it carries a ' +
    'pressed state at all. This page is generated from toggle.md: the API/Events/Slots tables and the size/' +
    'state specimens are derived from the same frontmatter the contract trip-wire validates; the slot-anatomy ' +
    'and Refused-toggle specimens are hand-authored.',
})

content.append(renderApiTable(descriptor.attributes))
content.append(renderSizesAndStates(descriptor))
content.append(renderSpecimens())
const eventsTable = renderEventsTable(descriptor)
if (eventsTable) content.append(eventsTable)
const slotsTable = renderSlotsTable(descriptor)
if (slotsTable) content.append(slotsTable)
content.append(renderMarkdownBody(body))

// ── live specimens (derived from the parsed `size` enum) ─────────────────────────────────────────────────

/** renderSizesAndStates — the Sizes row iterates the PARSED `size` enum (sm/md/lg); the States row stages
 *  unpressed/pressed/disabled off the real boolean attributes — the switch-doc.ts precedent. */
function renderSizesAndStates(d: ParsedDescriptor): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'))

  const size = findAttr(d, 'size')
  if (size?.values) {
    section.append(
      heading(3, 'Sizes'),
      row(size.values.map((s) => toggle({ size: s, pressed: '' }, `size = ${s}`))),
    )
  }

  section.append(
    heading(3, 'States'),
    row([
      toggle({}, 'Unpressed'),
      toggle({ pressed: '' }, 'Pressed'),
      toggle({ disabled: '' }, 'Disabled (unpressed)'),
      toggle({ pressed: '', disabled: '' }, 'Disabled (pressed)'),
    ]),
  )
  return section
}

/** toggle — a live specimen: a real <ui-toggle> with the given attributes set; the label is the default
 *  (label) slot text — the accessible name. */
function toggle(attrs: Record<string, string>, label: string): HTMLElement {
  const el = document.createElement('ui-toggle')
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value)
  el.append(document.createTextNode(label))
  return el
}

function row(children: readonly Node[]): HTMLElement {
  const div = document.createElement('div')
  div.style.cssText = 'display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; margin:0.5rem 0 1.5rem;'
  div.append(...children)
  return div
}

// ── hand-authored specimens (markup SHAPES underivable from the attribute parse) ───────────────────────────

/** renderSpecimens — the three-slot anatomy (icon/label/state-icon, each a FIXED role — toggle.md's Slots
 *  section) plus the cancelable "Refused toggle" design (toggle.md's own section), demonstrated with a real
 *  listener rather than prose alone. */
function renderSpecimens(): HTMLElement {
  const anatomy = document.createElement('div')
  anatomy.style.cssText = 'display:flex; gap:1.25rem; align-items:flex-start; flex-wrap:wrap;'
  anatomy.append(
    captioned('[ label ]', anatomyToggle()),
    captioned('[ icon | label ]', anatomyToggle({ icon: 'chats-circle' })),
    captioned('[ label | state-icon ]', anatomyToggle({ stateIcon: 'eye' })),
    captioned('[ icon | label | state-icon ]', anatomyToggle({ icon: 'gear-six', stateIcon: 'eye', pressed: true })),
  )

  return exampleSectionWith(
    exampleSection('Anatomy — the three fixed-role slots', anatomy),
    renderRefusedToggle(),
  )
}

function exampleSectionWith(...sections: HTMLElement[]): HTMLElement {
  const wrap = document.createElement('div')
  wrap.append(...sections)
  return wrap
}

function anatomyToggle(opts: { icon?: IconName; stateIcon?: IconName; pressed?: boolean } = {}): HTMLElement {
  const el = document.createElement('ui-toggle')
  if (opts.pressed) el.setAttribute('pressed', '')
  if (opts.icon) {
    const icon = resolveIcon(opts.icon)
    icon.setAttribute('slot', 'icon')
    el.append(icon)
  }
  el.append(document.createTextNode('Settings'))
  if (opts.stateIcon) {
    const icon = resolveIcon(opts.stateIcon)
    icon.setAttribute('slot', 'state-icon')
    el.append(icon)
  }
  return el
}

/** renderRefusedToggle — a real, working demonstration of toggle.md's cancelable-before-commit design: a
 *  `toggle` listener refuses the LAST press once every co-pilot in the row would end up off (the LLD §16.2
 *  min-one invariant, owned entirely by this page — never by the control, which knows nothing about the
 *  policy). Clicking the last remaining pressed pill is a true no-op: no flip, no flicker. */
function renderRefusedToggle(): HTMLElement {
  const section = document.createElement('section')
  section.append(
    heading(2, 'Refused toggle — cancelable before commit'),
    para(
      '`toggle` fires BEFORE `pressed` commits (toggle.md’s own design) — a listener calling ' +
        '`event.preventDefault()` refuses the press outright, a true no-op with zero paint to revert. Below, a ' +
        'consumer-owned "at least one must stay on" rule refuses turning off the LAST pressed pill in the row ' +
        '— try switching all three off:',
    ),
  )

  const pills = ['Chat', 'Docs', 'Voice'].map((label) => {
    const el = document.createElement('ui-toggle')
    el.setAttribute('pressed', '')
    el.append(document.createTextNode(label))
    return el
  })

  const wrap = document.createElement('div')
  wrap.style.cssText = 'display:flex; gap:0.75rem; align-items:center;'
  wrap.append(...pills)

  for (const el of pills) {
    el.addEventListener('toggle', (e) => {
      const toggling = e.currentTarget as UIToggleElement
      const stillPressedAfter = pills.filter((p) => p !== toggling && (p as UIToggleElement).pressed).length
      // Refuse only the LAST on->off flip (a currently-pressed pill with no other pressed sibling).
      if (toggling.pressed && stillPressedAfter === 0) e.preventDefault()
    })
  }

  section.append(wrap)
  return section
}

function para(text: string): HTMLElement {
  const p = document.createElement('p')
  p.textContent = text
  return p
}
