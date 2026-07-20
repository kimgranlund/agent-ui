// super-shell.ts — UISuperShellElement (M5, GH #83): the shell-archetype family's grammar ceiling —
// the two-level recursive shell of shell-archetypes-m5.spec.md (SPEC-R1), spec-sourced from Kim's
// Figma frames 34-1486 / 34-1506 (GH #44). A BEHAVIOR-ONLY composition (ADR-0151 rule 2 / SPEC-R3):
// it owns geometry, collapse behavior, and slot placement — never data, transport, or navigation.
//
// Grammar (SPEC-R1): `[ header? | side-L? | content | side-R? | footer? ]`, a side = rail + pane
// (mirrored on the right), every slot OPTIONAL — an unfilled slot is ABSENT (no box), so the inner
// canvas-shell level is just another <ui-super-shell> composed into `content` with no rails authored
// (R1b's ring-dropping recursion needs zero extra code). Consumers mark light-DOM children with
// `data-slot="header|global-nav|nav-pane|content|options-pane|global-options|footer"`; unmarked
// children fold into `content` (the mandatory slot — console.warn when absent, the app-shell law).
//
// Collapse (SPEC-R2): per-side toggles, HEADER-HOSTED (R2b — injected as the header row's leading/
// trailing affordances; no header ⇒ no toggles, permanent chrome is authored chrome), PAIRED restore
// (fork F1's default: one toggle drives its side's rail+pane together). State = the reflected
// `collapsed-start`/`collapsed-end` boolean props (R2d — observable + settable, so a consumer can
// persist). Narrow (<40rem container, SPEC-R4/F2): CSS auto-collapses both sides; a toggle-restored
// side overlays the canvas (super-shell.css) rather than squeezing it — and the auto state never
// writes the props, so the consumer's persisted wide-state choice survives (R4's no-clobber law).
//
// Logical direction (LLD-C4, GH #95): every side-facing name here — `data-side`, `collapsed-start/
// end`, `narrow-start/end`, `data-narrow-open` — is LOGICAL, never physical left/right. `#compose()`
// places `global-nav`/`nav-pane` FIRST in DOM order (`data-side="start"`) and `options-pane`/
// `global-options` SECOND (`data-side="end"`); `[data-part='middle']` is a plain row-flex container
// with no `flex-direction` override, so an ambient `dir="rtl"` mirrors DOM-first to the PHYSICAL
// right for free (ordinary CSS bidi — no `:dir()` selector or runtime direction read needed anywhere
// in this file or super-shell.css). "Start"/"end" here always mean "first/second in DOM order,"
// full stop, regardless of which physical side that renders on.
//
// Landmarks (LLD-C1, GH #94): every wrapper part gets a real ARIA `role` at compose time, from a
// slot→role map (header→banner, footer→contentinfo, content→main, the nav slots→navigation, the
// options slots→complementary) mirroring ui-app-shell-region's own map (ADR-0083) for cross-family
// vocabulary consistency — an independent implementation, not shared code (see the SPEC header's
// corrected "follows the pattern of" line). An authored child's `data-landmark="…"` overrides its
// slot's default, the same role-decoupled-from-placement idea ADR-0083 established.
//
// `controls → @agent-ui/components` + siblings only — never router/a2a (layering.test.ts).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '@agent-ui/components'
import '@agent-ui/components/controls/button'
import '@agent-ui/components/controls/icon'

const SLOTS = ['header', 'global-nav', 'nav-pane', 'content', 'options-pane', 'global-options', 'footer'] as const
type SlotName = (typeof SLOTS)[number]

// LLD-C1 (GH #94) — every slot's default ARIA landmark, keyed by slot name. Set as a real `role="…"`
// attribute directly on the plain <div> wrapper part at compose time (these wrappers are NOT custom
// elements — no ElementInternals handle exists on them — so this is the honest mechanism, unlike
// ui-app-shell-region's `internals.role`, which only a host custom element can use).
const SLOT_ROLE: Record<SlotName, string> = {
  header: 'banner',
  footer: 'contentinfo',
  content: 'main',
  'global-nav': 'navigation',
  'nav-pane': 'navigation',
  'global-options': 'complementary',
  'options-pane': 'complementary',
}

// The override vocabulary — reused verbatim from ui-app-shell-region's own LANDMARK_VALUES (ADR-0083)
// for cross-family consistency, minus its own '' empty-string sentinel (here, ABSENCE of the
// data-landmark attribute is the sentinel, so '' never needs to be a legal member).
const LANDMARK_VALUES = new Set(['banner', 'navigation', 'main', 'complementary', 'contentinfo', 'region', 'form', 'search'])

/** The role a slot's wrapper part gets: the FIRST authored child's `data-landmark` override (ADR-0083's
 *  role-decoupled-from-placement precedent, data-attribute-driven since super-shell's placement is
 *  itself data-attribute-driven) if present and a real landmark value, else the slot's own default. */
function roleFor(slot: SlotName, children: readonly Element[]): string {
  const override = children[0]?.getAttribute('data-landmark')
  return override !== null && override !== undefined && LANDMARK_VALUES.has(override) ? override : SLOT_ROLE[slot]
}

const props = {
  // SPEC-R2d — the two side states, reflected so CSS keys off the host and a consumer can persist.
  // LOGICAL (LLD-C4): "start"/"end" always mean DOM-first/DOM-second, never a physical side.
  collapsedStart: { ...prop.boolean(false), reflect: true, attribute: 'collapsed-start' },
  collapsedEnd: { ...prop.boolean(false), reflect: true, attribute: 'collapsed-end' },
  // SPEC-R4 / fork F2, widened with ADR-0084's own region vocabulary: what a side does at narrow —
  // `collapse` (default: hide, overlay on toggle-restore — the frames' all-collapsed story) or
  // `stack` (stay in flow, full-width above/below the canvas — the docs site's shipped nav UX,
  // where the ui-nav-rail's OWN collapse="menu" dropdown takes over). Pure-CSS arms.
  narrowStart: { ...prop.enum(['collapse', 'stack'] as const, 'collapse'), reflect: true, attribute: 'narrow-start' },
  narrowEnd: { ...prop.enum(['collapse', 'stack'] as const, 'collapse'), reflect: true, attribute: 'narrow-end' },
} satisfies PropsSchema

export interface UISuperShellElement extends ReactiveProps<typeof props> {}
export class UISuperShellElement extends UIElement {
  static props = props

  #frame: HTMLElement | null = null

  protected connected(): void {
    this.#compose()
    this.effect(() => {
      // Reflect the side states onto the toggles' accessible pressed state (the buttons exist only
      // when a header was authored).
      const start = this.querySelector('[data-part="side-toggle"][data-side="start"]')
      const end = this.querySelector('[data-part="side-toggle"][data-side="end"]')
      start?.setAttribute('aria-expanded', String(!this.collapsedStart))
      end?.setAttribute('aria-expanded', String(!this.collapsedEnd))
    })
  }

  /** Idempotent (the fleet's #compose law): sort the authored children into the frame ONCE. */
  #compose(): void {
    if (this.#frame) return
    const authored = new Map<SlotName, Element[]>()
    for (const slot of SLOTS) authored.set(slot, [])
    for (const child of [...this.children]) {
      const name = child.getAttribute('data-slot')
      const slot: SlotName = SLOTS.includes(name as SlotName) ? (name as SlotName) : 'content'
      authored.get(slot)!.push(child)
    }
    if (authored.get('content')!.length === 0) console.warn('ui-super-shell: no content slot authored — the one mandatory slot (SPEC-R1)')

    const frame = document.createElement('div')
    frame.setAttribute('data-part', 'frame')

    // header row — hosts the side toggles (SPEC-R2b) around the authored header content. The content
    // is wrapped in its own `bar-content` box (flex:1 1 auto, super-shell.css) so it fills the space
    // between the two toggles by construction — a consumer's header content (e.g. the docs site's own
    // `.app-context-header`) needs no bespoke CSS of its own to stretch edge-to-edge (component-reviewer
    // finding: an un-wrapped `flex:0 0 auto` header child shrink-wraps to its own content width in
    // `[data-part='bar']`'s row-flex layout, leaving the rest of the bar visibly empty).
    const headerChildren = authored.get('header')!
    if (headerChildren.length > 0) {
      const header = document.createElement('div')
      header.setAttribute('data-part', 'bar')
      header.setAttribute('data-bar', 'header')
      header.setAttribute('role', roleFor('header', headerChildren)) // LLD-C1
      const barContent = document.createElement('div')
      barContent.setAttribute('data-part', 'bar-content')
      barContent.append(...headerChildren)
      header.append(this.#makeToggle('start'), barContent, this.#makeToggle('end'))
      frame.append(header)
    }

    // middle row — [ rail | pane | content | pane | rail ], absent slots contribute nothing (R1).
    const middle = document.createElement('div')
    middle.setAttribute('data-part', 'middle')
    const place = (slot: SlotName, part: string, side?: 'start' | 'end'): void => {
      const children = authored.get(slot)!
      if (children.length === 0) return
      const box = document.createElement('div')
      box.setAttribute('data-part', part)
      box.setAttribute('data-slot-name', slot)
      box.setAttribute('role', roleFor(slot, children)) // LLD-C1
      if (side) box.setAttribute('data-side', side)
      box.append(...children)
      middle.append(box)
    }
    place('global-nav', 'rail', 'start')
    place('nav-pane', 'pane', 'start')
    place('content', 'canvas')
    place('options-pane', 'pane', 'end')
    place('global-options', 'rail', 'end')
    frame.append(middle)

    // Footer has no toggles (SPEC-R2c: header/footer are permanent chrome) — but its content gets the
    // SAME bar-content flex:1 wrapper, so a footer authored the same way as a header behaves identically.
    const footerChildren = authored.get('footer')!
    if (footerChildren.length > 0) {
      const footer = document.createElement('div')
      footer.setAttribute('data-part', 'bar')
      footer.setAttribute('data-bar', 'footer')
      footer.setAttribute('role', roleFor('footer', footerChildren)) // LLD-C1
      const barContent = document.createElement('div')
      barContent.setAttribute('data-part', 'bar-content')
      barContent.append(...footerChildren)
      footer.append(barContent)
      frame.append(footer)
    }

    this.append(frame)
    this.#frame = frame
  }

  /** One header-hosted side toggle (SPEC-R2b) — flips its side's reflected state; paired restore
   *  (F1: the rail+pane pair rides ONE state, realized in CSS off the host attribute). `side` is
   *  LOGICAL (LLD-C4): no physical left/right anywhere in this method — DOM order + the browser's
   *  own bidi reversal place the button and its rail/pane on the correct physical side under RTL. */
  #makeToggle(side: 'start' | 'end'): HTMLElement {
    const button = document.createElement('ui-button')
    button.setAttribute('variant', 'ghost')
    button.setAttribute('icon-only', '') // button.md's icon-only-button idiom (the toast.ts close-button
    // precedent) — WITHOUT this the button reserves a dead 1fr label track and renders non-square/
    // near-invisible against the bar (the regression a real browser screenshot caught, GH #90).
    button.setAttribute('data-part', 'side-toggle')
    button.setAttribute('data-side', side)
    button.setAttribute('aria-label', side === 'start' ? 'Toggle start panes' : 'Toggle end panes')
    const icon = document.createElement('ui-icon')
    icon.setAttribute('slot', 'leading') // the icon-only anatomy's ONE adornment cell (button.md)
    icon.setAttribute('data-role', 'icon')
    icon.setAttribute('glyph', 'list')
    button.append(icon)
    button.addEventListener('click', () => {
      // SPEC-R4 — at narrow, the toggle drives the one-at-a-time OVERLAY state instead of the
      // persisted side props (the no-clobber law: a narrow visit never rewrites the wide choice).
      if (this.getBoundingClientRect().width < 640 && this.getBoundingClientRect().width > 0) {
        const open = this.getAttribute('data-narrow-open') === side ? null : side
        if (open) this.setAttribute('data-narrow-open', open)
        else this.removeAttribute('data-narrow-open')
        return
      }
      if (side === 'start') this.collapsedStart = !this.collapsedStart
      else this.collapsedEnd = !this.collapsedEnd
    })
    return button
  }
}

if (!customElements.get('ui-super-shell')) customElements.define('ui-super-shell', UISuperShellElement)
