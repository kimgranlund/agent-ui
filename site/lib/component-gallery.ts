// site/lib/component-gallery.ts — <component-gallery>: the G8 kernel-dogfooding gallery (ADR-0079,
// component-gallery.lld.md). A thin reactive shell over <component-preview mode="component"> — it renders
// nothing per-control itself; every specimen is the SAME live playground component-preview already builds
// (ADR-0077), zero specimen-rendering code duplicated here. Composes:
//   • LLD-C1 galleryMembers() — the derived member list (never hand-listed)
//   • LLD-C2 node()          — the element-hosting directive (the public Directive/directive/NO_COMMIT trio)
//   • LLD-C3 ComponentGallery — the filter/theme/grid reactive loop, riding the public mount/watch/repeat
//     seam end to end (ADR-0023)
//
// Deliberately NOT a ui-* control (ADR-0077 precedent: docs meta-infra carries no descriptor/coverage/budget
// obligation) — but its class extends the PUBLIC UIElement, so the FACE host (connection scope, `this.effect`,
// zero-residue disconnect) is dogfooded too, not just the kernel functions. `html\`\`` is private (ADR-0023):
// this file never imports it — every element here is built with plain `document.createElement`, exactly like
// component-preview.ts.
import './component-preview.ts' // self-defining <component-preview> (side-effect; ADR-0077)
import '@agent-ui/components/controls/theme-provider' // self-defining <ui-theme-provider> (ADR-0117)
import './component-gallery.css'
import { UIElement, computed, mount, repeat, signal, watch, Directive, directive, NO_COMMIT } from '@agent-ui/components'
import type { DirectiveResult, Signal } from '@agent-ui/components'
import type { UISelectElement, UITextFieldElement } from '@agent-ui/components/components'
import { parseDoc } from './frontmatter.ts'

// ── LLD-C1 — the derived member list ───────────────────────────────────────────────────────────────────────
// The SAME build-time descriptor glob frontmatter.ts's (private) ALL_DESCRIPTORS reads — Vite's
// `import.meta.glob` resolves statically PER CALL SITE, so this reaches the identical file set without a
// second export off frontmatter.ts's private glob; `parseDoc` (already exported) stays the ONE canonical
// parser — never a forked reader.
const DESCRIPTOR_SOURCES = import.meta.glob(
  '../../packages/agent-ui/components/src/controls/*/*.md',
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

// The overlay controller's own surface PART names (modal: dialog; popover/tooltip/menu: panel; select/
// combo-box: listbox) — the structural discriminator between a true overlay-class `open` control (which
// paints a `<dialog>`/`[popover]` surface) and a plain open-having control with no such surface (ui-
// disclosure's native `<details>` fold ALSO declares an `open` attribute, but its parts are
// details/summary/chevron/summary-text/body — none of these — so it is correctly excluded, Wave M1 ADR-0113).
const OVERLAY_PART_NAMES = new Set(['dialog', 'panel', 'listbox'])

export interface GalleryMember {
  readonly tag: string // 'ui-button'
  readonly tier: string // descriptor `tier` scalar ('' when absent) — the group chip
  readonly hasOpen: boolean // descriptor declares an `open` attribute AND an overlay-class surface part (dialog/panel/listbox) — the overlay-class marker (§6 E3)
}

/**
 * Every shipped ui-* control, DERIVED from the descriptor glob — never hand-listed — sorted by tag (FIXED
 * alphabetical order; §6 E1: `ChildPart.moveBefore` does not relocate a nested directive's owned content, so
 * a sort knob is out of contract — filtering stays an order-preserving subsequence). Throws on a duplicate
 * tag (§6 E6 — loud, matching the ADR-0077 "silently-empty is a defect" stance).
 */
export function galleryMembers(): readonly GalleryMember[] {
  const members: GalleryMember[] = []
  const seen = new Set<string>()
  for (const raw of Object.values(DESCRIPTOR_SOURCES)) {
    const { descriptor } = parseDoc(raw)
    const tag = descriptor.scalars.get('tag')
    if (typeof tag !== 'string' || !tag.startsWith('ui-')) continue
    if (seen.has(tag)) throw new Error(`galleryMembers: duplicate tag "${tag}" across descriptors`)
    seen.add(tag)
    const hasOverlayPart = (descriptor.sequences.get('parts') ?? []).some((p) => {
      const name = p.get('name')
      return typeof name === 'string' && OVERLAY_PART_NAMES.has(name)
    })
    members.push({
      tag,
      tier: descriptor.scalars.get('tier') ?? '',
      hasOpen: descriptor.attributes.some((a) => a.name === 'open') && hasOverlayPart,
    })
  }
  return members.sort((a, b) => a.tag.localeCompare(b.tag))
}

// ── LLD-C2 — the node() element directive ──────────────────────────────────────────────────────────────────
// A child hole commits text/TemplateResult/array/directive only — a raw Element stringifies via
// #commitChild → #commitText (template.ts:457). node() hosts ONE real element in a hole via the public
// directive-authoring trio: insert before the hole's end anchor on first commit, swap when the element
// identity changes (a same-ctor re-commit reuses this instance), remove on dispose. NOTE (§6 E1): the
// element lives in THIS directive's own untracked content — a `repeat` reorder moves the hole's anchor, not
// the element inside it — so member order must stay fixed (never sorted) for content to track correctly.
class NodeDirective extends Directive {
  #el: HTMLElement | undefined

  update(args: readonly unknown[]): unknown {
    const el = args[0] as HTMLElement
    if (el !== this.#el) {
      this.#el?.remove()
      this.endNode.before(el)
      this.#el = el
    }
    return NO_COMMIT
  }

  dispose(): void {
    this.#el?.remove()
    this.#el = undefined
  }
}

const nodeDirective = directive(NodeDirective)

/** node(el) — commit a real Element into a child hole (the seam a raw Element cannot use directly). */
export function node(el: HTMLElement): DirectiveResult {
  return nodeDirective(el)
}

// ── LLD-C3 — the gallery element ───────────────────────────────────────────────────────────────────────────
const MEMBERS = galleryMembers()

const normalize = (s: string): string => s.trim().toLowerCase()

// Vocabularies from the token system (never invented here) — ADR-0032 scale tiers, the density set, and the
// reserved theme-package seam (one member, 'default', in G8; ADR-0079 cl.3).
type Scale = 'ui-sm' | 'ui-md' | 'ui-lg' | 'content-sm' | 'content-md' | 'content-lg'
type Density = 'compact' | 'comfortable' | 'spacious'
type Scheme = 'light' | 'dark'

const SCHEMES: readonly Scheme[] = ['light', 'dark']
const SCALES: readonly Scale[] = ['ui-sm', 'ui-md', 'ui-lg', 'content-sm', 'content-md', 'content-lg']
const DENSITIES: readonly Density[] = ['compact', 'comfortable', 'spacious']
const THEMES = ['default'] as const // the reserved seam — exactly one package ships in G8

/**
 * One labelled `ui-select` bound to a signal — the toolbar's theme-axis knobs (scheme/scale/density/theme).
 * Dogfoods the fleet's OWN select control in the gallery's own chrome (Kim's directive: no native `<select>`
 * where a ui-* control exists) rather than a native `<select>`. Options are appended as `[role=option]`
 * light-DOM children BEFORE the element connects — ui-select's own contract (select.md's `slots` clause) —
 * the SAME ordering discipline component-preview.ts's sample children use for tooltip/menu/popover.
 *
 * The formerly-inert `aria-label` stopgap is GONE: `ui-select` now carries a real `label` prop (ADR-0085,
 * the text-field `label` precedent) that names the trigger properly via `aria-labelledby` — a visually-
 * hidden `[data-part=aria-label]` span (holding this text) concatenated with the live value span, so the
 * accessible name recomputes on every selection change (e.g. "Scheme light" → "Scheme dark"). The visible
 * `<label>` wrapper text still serves sighted users; the two mechanisms now agree.
 */
function themeSelect<T extends string>(label: string, values: readonly T[], target: Signal<T>): HTMLElement {
  const wrap = document.createElement('label')
  wrap.className = 'gallery-select'
  const text = document.createElement('span')
  text.textContent = label
  const select = document.createElement('ui-select') as UISelectElement
  select.setAttribute('label', label) // ADR-0085 — the trigger's real accessible-name seam
  for (const v of values) {
    const option = document.createElement('div')
    option.setAttribute('role', 'option')
    option.setAttribute('value', v)
    option.textContent = v
    select.append(option)
  }
  select.value = target.value
  select.addEventListener('select', () => {
    target.value = select.value as T
  })
  wrap.append(text, select)
  return wrap
}

export class ComponentGallery extends UIElement {
  readonly #filter = signal('')
  readonly #scheme = signal<Scheme>('light')
  readonly #scale = signal<Scale>('ui-md')
  readonly #density = signal<Density>('comfortable')
  readonly #theme = signal<string>('default')
  readonly #visible = computed<readonly GalleryMember[]>(() => {
    const q = normalize(this.#filter.value)
    return q === '' ? MEMBERS : MEMBERS.filter((m) => normalize(m.tag).includes(q))
  })

  #cards = new Map<string, HTMLElement>()
  #emptyRow: HTMLElement | undefined
  #disposers: Array<() => void> = []

  // The DOM skeleton (toolbar/provider/grid/readout hole) is built ONCE (component-preview.ts's own
  // reconnect-safety precedent — `this.append` is additive, so a re-run would duplicate it); the REACTIVE
  // wiring below is (re-)installed on every connect, since it is scope-owned and dies with the scope on
  // disconnect (§6 E8) — a reconnect gets fresh effects. Each hole is cleared before re-mounting so a
  // reconnect's fresh `mount()` never doubles up on a stale anchor from the previous connection.
  #provider: HTMLElement | undefined
  #grid: HTMLElement | undefined
  #readoutHole: HTMLElement | undefined

  protected connected(): void {
    if (!this.#provider) {
      const provider = document.createElement('ui-theme-provider')
      const grid = document.createElement('div')
      grid.className = 'gallery-grid'
      provider.append(grid)
      this.#provider = provider
      this.#grid = grid
      this.append(this.#buildToolbar(), provider)
    }
    const provider = this.#provider!
    const grid = this.#grid!
    const readoutHole = this.#readoutHole!

    // The ONE theme subtree (LLD §4): every axis lands on the single <ui-theme-provider>, nothing per-card.
    this.effect(() => {
      provider.setAttribute('scheme', this.#scheme.value)
      provider.setAttribute('scale', this.#scale.value)
      provider.setAttribute('density', this.#density.value)
      provider.setAttribute('theme', this.#theme.value)
    })

    readoutHole.replaceChildren()
    this.#disposers.push(
      mount(
        watch(() => `${this.#visible.value.length} of ${MEMBERS.length}`),
        readoutHole,
        this,
      ),
    )

    // The reactive grid loop, riding the public seam end to end: a filter change re-runs ONLY this watch's
    // scope-owned effect (never a host render effect — this element has none). Empty results (§6 E4) commit
    // a styled status row through the SAME node() seam rather than an empty repeat.
    grid.replaceChildren()
    this.#disposers.push(
      mount(
        watch(
          () => this.#visible.value,
          (ms) => (ms.length === 0 ? node(this.#buildEmptyRow()) : repeat(ms, (m) => m.tag, (m) => node(this.#card(m)))),
        ),
        grid,
        this,
      ),
    )
  }

  protected disconnected(): void {
    for (const dispose of this.#disposers.splice(0)) dispose()
  }

  #buildToolbar(): HTMLElement {
    const toolbar = document.createElement('div')
    toolbar.className = 'gallery-toolbar'

    // Dogfoods ui-text-field (type=search) in place of a native `<input>` (Kim's directive). `label` is the
    // documented bare-usage naming seam (text-field.md labelSource) — it becomes the editor's aria-label
    // without needing a wrapping <ui-field>, matching the native input's old `aria-label` call exactly.
    const filterInput = document.createElement('ui-text-field') as UITextFieldElement
    filterInput.setAttribute('type', 'search')
    filterInput.className = 'gallery-filter'
    filterInput.setAttribute('placeholder', 'Filter components…')
    filterInput.setAttribute('label', 'Filter components')
    filterInput.addEventListener('input', () => {
      this.#filter.value = filterInput.value
    })

    const readoutHole = document.createElement('span')
    readoutHole.className = 'gallery-readout'
    this.#readoutHole = readoutHole

    toolbar.append(
      filterInput,
      themeSelect('Scheme', SCHEMES, this.#scheme),
      themeSelect('Scale', SCALES, this.#scale),
      themeSelect('Density', DENSITIES, this.#density),
      themeSelect('Theme', THEMES, this.#theme),
      readoutHole,
    )
    return toolbar
  }

  /** One card per tag, CREATED ONCE and cached (§4/§6 E1): a filter-out-then-back-in returns the SAME element
   *  object, so a specimen's live knob/interaction state survives filtering. */
  #card(member: GalleryMember): HTMLElement {
    const cached = this.#cards.get(member.tag)
    if (cached) return cached

    const head = document.createElement('div')
    head.className = 'gallery-card-head'
    const heading = document.createElement('h2')
    heading.className = 'gallery-card-heading'
    heading.textContent = member.tag
    head.append(heading)
    if (member.tier !== '') {
      const chip = document.createElement('span')
      chip.className = 'gallery-card-tier'
      chip.textContent = member.tier
      head.append(chip)
    }

    const preview = document.createElement('component-preview')
    preview.setAttribute('mode', 'component')
    preview.setAttribute('target', member.tag)

    const card = document.createElement('div')
    card.className = 'gallery-card'
    card.dataset.tag = member.tag // a stable per-member selector (identity probes, the browser smoke)
    card.append(head, preview)
    this.#cards.set(member.tag, card)
    return card
  }

  /** The empty-filter-result row (§6 E4) — created once, a `role="status"` styled row (the adr-index precedent). */
  #buildEmptyRow(): HTMLElement {
    if (!this.#emptyRow) {
      const row = document.createElement('div')
      row.className = 'gallery-empty'
      row.setAttribute('role', 'status')
      row.textContent = 'No components match this filter.'
      this.#emptyRow = row
    }
    return this.#emptyRow
  }
}

if (!customElements.get('component-gallery')) customElements.define('component-gallery', ComponentGallery)
