---
# command-modal.md frontmatter — the attributes-as-API descriptor for ui-command-modal (ADR-0004 / ADR-0125 /
# command-modal.lld.md LLD-C12). The machine-checkable public surface lives HERE (frontmatter); the prose below
# the fence is the /site doc. The `attributes[]` block MUST mirror command-modal.ts `static props` 1:1 — the
# contract↔props trip-wire (command-modal-descriptor.test.ts) and the frontmatter schema both target this fence.
tag: ui-command-modal
tier: pattern            # a composed control with internal parts, no §1 control-height row of its own (the ui-combo-box precedent)
extends: UIElement       # the coordinator base (the ui-theme-provider/ui-form-provider precedent) — paints no surface of its own
# marginal: measured at the integration slice (npm run size, hand-run per ADR-0040 §3) — the family total stays
# gated; note ui-modal (nested) is already in the family total, so this control's own delta is the marginal.
composes: [ui-modal]     # nested for the surface + dismissal (ADR-0017/0019/0020) — a sanctioned sibling-control import

attributes:              # attributes-as-API — mirrors UICommandModalElement.props 1:1
  - name: open
    type: boolean
    default: false
    reflect: true        # reflects + BINDABLE — the single drive signal for the nested ui-modal's own `open`
  - name: label
    type: string
    default: ''
    reflect: false       # a11y hint (search field aria-label, reactive; the dialog's accessible name at connect) — not a styling hook
  - name: placeholder
    type: string
    default: ''
    reflect: false       # the search field placeholder, shown via the [data-empty]::before read-back
  - name: hotkey
    type: string
    default: ''
    reflect: false       # the F2 opt-in convenience; '' = no document listener (ADR-0082 no-global-singletons law)
  - name: filter
    type: enum
    values: [substring, regex]
    default: substring
    reflect: false       # ADR-0127 — a behavior switch, not a styling hook; substring is byte-identical to pre-ADR-0127 behavior

properties:
  - name: open
    description: Whether the palette is shown (boolean). Drives the nested ui-modal's own `open`; synced back to false on a platform dismissal (Escape/backdrop) of that modal. Reflected + bindable two-way (the ui-modal `open` shape, ADR-0019).
  - name: label
    description: The accessible name for BOTH the search field (reactively, via aria-label) and the dialog (forwarded onto the nested ui-modal ONCE, at part-creation time — a live label update after connect only reaffects the search field's name, not the dialog's; see the LLD §3 accessible-name-split note).
  - name: placeholder
    description: The search field's placeholder text.
  - name: hotkey
    description: '' = no document listener at all. A non-empty chord (e.g. "mod+k", mod = ⌘ on macOS / Ctrl elsewhere) binds ONE per-instance document keydown — riding the connection lifetime, re-armed on reconnect — that preventDefaults the chord and toggles THIS instance's `open`. No global singleton/registry; multi-instance collision on the same chord is the author's own concern (ADR-0125 F2).
  - name: filter
    description: The match-test mode (ADR-0127). `'substring'` (default) is the original case-insensitive `hay.includes(q)` test, byte-identical to pre-ADR-0127 behavior. `'regex'` runs a case-insensitive `RegExp` test over the SAME haystack (item label + `data-keywords`); an invalid pattern is caught and that keystroke falls back to the substring test instead — the palette never throws on a bad pattern.

events:                  # all ⊂ the change·input·select·open·close·toggle allowlist (NO `dismiss`)
  - name: select
    detail: '{ value: string, label: string, group: string }'
    description: Fired when a command is chosen (click on an enabled option, or Enter on the active option). `label` is the option's primary label text — its decorative [data-role=shortcut]/[data-role=icon]/aria-hidden descendants are excluded, as is an optional [data-role=description] second line (TKT-0019 — still fully in the accessibility tree, only excluded from this label). `group` is the containing [role=group]'s [data-role=group-label] heading text, or '' when ungrouped. The palette then sets `open=false` (closing the nested modal) — a selection-driven close emits ONLY `select`, never `close`/`toggle`.
  - name: close
    detail: 'null'
    description: Fired when the nested modal is dismissed by the platform (Escape/backdrop) — relayed one level up, the two-way `open` pattern (ADR-0019). NOT fired on a selection-driven close (that emits only `select`).
  - name: toggle
    detail: 'null'
    description: Fired alongside `close` on a platform dismissal — the value:{event:'toggle'} two-way signal a renderer binds to write `open` back into its data model.

slots:
  - name: empty
    optional: true
    description: An author empty-state affordance, shown instead of the default "No results" row when the filter matches nothing. Marked with `slot="empty"` or `data-role="empty"` on a light-DOM child.

parts:
  - name: search
    role: combobox
    description: The control-created `contenteditable="plaintext-only"` search field — role=combobox, aria-autocomplete=list, aria-controls→the list part's id, aria-expanded tracking `open`, aria-activedescendant→the active option (removed at none). Takes its accessible name from `label` (falling back to "Search commands"). Focus lands here on open and never leaves it.
  - name: list
    role: listbox
    description: The control-created `role=listbox` results list. The consumer's author-declared [role=option]/[role=group] children are child-moved into it at connect (ADR-0017). A bounded scroll viewport (max-block-size, scroll-fade wired).
  - name: status
    description: The control-created visually-hidden `aria-live="polite"` region, updated on every filter to announce the visible result count ("12 results" / "No results").
  - name: empty
    role: presentation
    description: The control-created default "No results" row shown when the filter matches nothing and no author `[slot=empty]`/`[data-role=empty]` child is present. `role=presentation` — never reachable by Arrow/Enter/click.

customStates: []         # none — the palette uses no :state() custom states of its own (the nested modal owns its own surface state)

face:
  formAssociated: false  # the palette holds no form value — navigation/invocation is entirely the consumer's `select` handler

aria:
  role: none              # the palette HOST carries no role/aria-* attribute — roles ride the PARTS (search=combobox, list=listbox), never the host; the dialog's own ARIA is the nested ui-modal's
  roleSource: search + list parts
  labelSource: the `label` prop — reactively → the search field's aria-label; forwarded once, at connect, onto the nested ui-modal's dialog

keyboard:
  - keys: <printable>
    action: Filters the list (case-insensitive substring/keyword match by default, or regex when `filter="regex"` — ADR-0127, falling back to substring on an invalid pattern — over the option's primary label + an optional data-keywords string; a decorative [data-role=shortcut] display and an optional [data-role=description] second line are excluded from the match — a consumer folds description text into data-keywords instead if it should stay filterable); resets the active option.
  - keys: ArrowDown
    action: Moves the active option (aria-activedescendant + [data-active]) to the next visible, enabled option, wrapping. Focus STAYS in the search field.
  - keys: ArrowUp
    action: Moves the active option to the previous visible, enabled option, wrapping. Focus stays in the search field.
  - keys: Home
    action: Active → the first visible, enabled option.
  - keys: End
    action: Active → the last visible, enabled option.
  - keys: Enter
    action: Emits `select` for the active option, then closes (the nested modal's `open` goes false).
  - keys: Escape
    action: DISMISSES — owned entirely by the nested ui-modal (ADR-0045 single close path); the palette binds no Escape handler of its own.

geometry:
  sizeClass: pattern       # no §1 control-height row of its own — the search field borrows the entry-control register
  searchBlockSize: var(--ui-command-modal-search-block-size)   # = var(--ui-height-md), the entry-control register
  listMaxBlock: var(--ui-command-modal-list-max-block)         # bounded scroll viewport (50vh, scroll-fade wired)
  itemGap: var(--ui-command-modal-item-gap)                    # off the --ui-space ladder — ambient under [scale]/[density]

forcedColors: A `@media (forced-colors: active)` block keeps the search field frame and the active-option highlight legible as system colours (Field/FieldText, Highlight/HighlightText) — the aria-activedescendant + [data-active] pairing is the non-color signifier, so no color-only intent exists (the combo-box [data-active] precedent). The nested modal's own forced-colors block covers the dialog surface/backdrop.

catalog: excluded          # PERMANENT EXCLUSION_ALLOWLIST entry (ADR-0125 F8 / ADR-0112 cl.6 exclusion class) — app-owner launcher chrome, never agent-emittable
contentModel: '[role=option][value] children (an optional leading icon element + label text + an optional decorative [data-role=shortcut] display + an optional [data-role=description] second-line display, muted + single-line-clamped, excluded from labelText/select.label but NOT aria-hidden + an optional data-keywords string), optionally grouped under [role=group][aria-labelledby] with a [data-role=group-label] heading; an optional [slot=empty] override'
---

# ui-command-modal

`ui-command-modal` is a **Pattern-class** `UIElement` **coordinator** — the classic CMD-K command palette. It
**nests a `ui-modal`** for the entire modal surface + dismissal contract (top-layer stacking, a `::backdrop`,
focus containment, Escape/backdrop dismissal — ADR-0017/0019/0020), and inside that modal renders a
control-created `role="combobox"` search field over a control-created `role="listbox"` results list built from
the consumer's author-declared `[role="option"]`/`[role="group"]` children. It re-derives `ui-combo-box`'s
active-descendant filter pattern (ADR-0085) — typing filters the list; Arrow keys move a highlighted option
**without moving DOM focus** off the search field. Choosing a command emits `select` and closes.

```html
<ui-command-modal label="Command palette" placeholder="Type a command…">
  <div role="group" aria-labelledby="cmd-nav">
    <div id="cmd-nav" data-role="group-label">Navigation</div>
    <div role="option" value="home"><ui-icon name="house" data-role="icon"></ui-icon>Go Home<span data-role="shortcut" aria-hidden="true">⌘H</span></div>
    <div role="option" value="settings"><ui-icon name="gear" data-role="icon"></ui-icon>Settings<span data-role="shortcut" aria-hidden="true">⌘,</span></div>
  </div>
  <div role="option" value="logout" data-keywords="sign out exit">Log out</div>
  <div slot="empty">No commands match — try a different search.</div>
</ui-command-modal>

<script type="module">
  const palette = document.querySelector('ui-command-modal')
  window.addEventListener('keydown', (e) => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); palette.open = true }
  })
  palette.addEventListener('select', (e) => {
    const { value, group } = e.detail
    if (group === 'Navigation') router.navigate(value)
    else runCommand(value)
  })
</script>
```

## Composition — not invention

The palette is **arrangement + filter + selection semantics**, never a command bus, a router, or a store
(ADR-0125). It composes three mechanisms the fleet already ships:

- **The surface = a nested `ui-modal`.** `connected()` creates a `<ui-modal>`, moves the search/list/status
  parts inside it, then appends the modal to the host — so when `ui-modal` connects it relocates the whole
  subtree into its own `<dialog>` together. The palette's `open` drives the modal's `open`; a platform
  dismissal (Escape/backdrop) syncs the palette's `open` back to `false` and re-emits `close`+`toggle` one
  level up. The palette owns **no** dialog/backdrop/Escape machinery of its own.
- **The filter = the combo-box active-descendant pattern, re-derived.** The search field is a control-created
  `contenteditable="plaintext-only"` `role="combobox"` (the "two floating dropdowns" fix — `autocorrect`/
  `autocapitalize`/`autocomplete`/`spellcheck` all off). Typing hides non-matching options; Arrow keys move
  `aria-activedescendant` + `[data-active]` **without moving DOM focus**.
- **The item model = author-declared children (ADR-0017 child-move).** Commands are stateless, declarative
  `[role="option"][value]` entries — rich inner content is author-authored (an optional leading icon, the
  label text, an optional decorative `[data-role="shortcut"]` display, an optional `[data-role="description"]`
  second line). `disabled`/`aria-disabled` opts an option out of navigation and commit. Grouping is a
  `[role="group"]` wrapper with a `[data-role="group-label"]` heading; the heading text becomes the `select`
  detail's `group` field.

## The two-line option shape (TKT-0019)

An option renders as **two lines**: line 1 is the existing title-row content (an optional leading icon, the
label text, an optional trailing `[data-role="shortcut"]`) — unchanged. Line 2 is an optional
`[data-role="description"]` — smaller, muted type, clamped to one line with an ellipsis; it never wraps and
never grows the option beyond two lines. The description is excluded from `#labelText` exactly like the
shortcut (so `select` detail.label and the filter's item-label text stay the title), but — unlike the
shortcut, which also carries `aria-hidden="true"` — the description carries **no** `aria-hidden`: it is a
real, visible second line and stays fully in the accessibility tree. It is not part of the filter haystack
either; a consumer who wants the description text searchable folds it into `data-keywords` instead (the
control's own filter already reads item-label + data-keywords).

## Selection — never a command bus

Choosing an option (click on an enabled option, or Enter on the active one) emits `select` with
`{ value, label, group }`, then sets `open=false`. Navigation/invocation is entirely the consumer's `select`
handler — the palette imports no `@agent-ui/router` and holds no command/action registry.

## The filter mode (ADR-0127)

`filter` defaults to `'substring'` — the original, byte-identical case-insensitive `includes` test over the
item label + `data-keywords`. Setting `filter="regex"` runs a case-insensitive `RegExp` test over the same
haystack instead; an invalid pattern (e.g. an unbalanced `(`) is caught and that keystroke falls back to the
substring test — the palette never throws and never blanks the list on a bad pattern.

## The result-count live region

A visually-hidden `[data-part="status"]` `aria-live="polite"` region announces the visible result count on
every filter change ("12 results" / "No results") — the one net-new a11y behavior over the combo-box precedent.

## Escape is the modal's, single path

The palette binds **no** Escape handler and implements **no** two-stage "clear filter then close" — Escape is
owned entirely by the nested `ui-modal` (ADR-0045, platform-owned, single close path).

## The opt-in `hotkey`

`open` alone is a complete palette — the consumer wires their own keymap (`window.addEventListener('keydown',
…)`). The `hotkey` attribute is a convenience: set to a chord (`hotkey="mod+k"`) and the palette binds **one**
per-instance document `keydown` that toggles its own `open` — never a global singleton (ADR-0082); two palettes
sharing a hotkey both toggle themselves, which is the documented, accepted sharp edge, not something the palette
arbitrates.

## Catalog disposition

`ui-command-modal` is **permanently excluded** from the A2UI generative-UI catalog (`CommandModal` in the
`EXCLUSION_ALLOWLIST`, ADR-0125 F8) — it is app-owner launcher chrome wired to arbitrary consumer actions, the
same trust class as `Toast`/`ThemeProvider` (ADR-0112 cl.6), never agent-emittable.

## The fixed frame (TKT-0017)

The palette holds a FIXED frame (the CMD-K convention): `--ui-command-modal-inline-size`
(default `min(92vw, 36rem)`) and `--ui-command-modal-block-anchor` (default `15svh`) pin the nested
modal's width and top anchor, so the search field never moves as filtering changes the result count —
only the list below grows/shrinks downward within its cap (the VS Code palette convention).
Browser-asserted both engines: the search rect is identical across a filter that empties the list.
