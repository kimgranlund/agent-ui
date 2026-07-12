# SPEC — `ui-command-modal`

> Status: proposed · v0.1 · 2026-07-10 · Layer: SPEC (execution contract)
> Refines: TKT-0012 (`../tickets/tkt-0012-ui-command-modal.md`) under the ratified scope + contract directions
> of [ADR-0125](../adr/0125-ui-command-modal-composition-and-catalog-exclusion.md) (proposed; forks F1–F8 as
> recommended).
>
> **No owning PRD — a deliberate, acknowledged deviation from the family-PRD pattern**, the same basis the
> `ui-toolbar`/`ui-theme-provider` SPECs recorded: this is a single scoped control whose problem statement and
> acceptance already live in TKT-0012 (a TICKET, carrying Summary/Acceptance/Links per its own type contract).
> Authoring a PRD here would restate that substrate under different frontmatter — the "restated substrate"
> failure `doc-authoring-standards` names. Known, deliberate gap: the SPEC↔PRD uplink harness check fails on
> this file by construction; recorded as a reviewed deviation, not a silent miss.
> Refined by: [`../lld/command-modal.lld.md`](../lld/command-modal.lld.md). Build plan:
> [`../decompositions/command-modal-ship.decomp.json`](../decompositions/command-modal-ship.decomp.json)
> (coverage-clean `--strict`, plan mode).
> Altitude: owns **what the shipped element does and how it behaves at every boundary** (the prop contract, the
> composition-with-`ui-modal` seam, the active-descendant filter semantics, the selection/close contract, the
> a11y pattern, the hotkey policy, the catalog disposition, the site surfaces). Implementation (CSS mechanics,
> the exact filter/active-descendant code, the nested-modal wiring order, page content) is the LLD's. Requirement
> IDs file-scoped (`SPEC-R1…`).

---

## 1. Purpose

Contract the control ADR-0125 ratifies: `ui-command-modal`, a **Pattern**-class `UIElement` **coordinator** that
**nests a `ui-modal`** for the modal surface and renders, inside it, a filter search field over a grouped,
selectable list built from the consumer's author-declared command items. Typing filters the list; arrow keys
move a highlighted (active-descendant) option while focus **stays in the search field**; choosing a command
emits `select` and closes. It composes the fleet's modal surface + re-derives combo-box's active-descendant
filter — it is **arrangement + filter + selection semantics, not a command bus, not a router, not a store**, and
it is permanently excluded from the A2UI catalog.

## 2. Definitions

- **Command item** — an author-declared light-DOM `[role="option"]` descendant carrying a `value` attribute, in
  DOM order, not `disabled`/`aria-disabled`. Its inner content is author-authored (an optional leading icon
  element, the label text, an optional decorative `[data-role="shortcut"]` display).
- **Item label** — the option's **primary label text**: its text content **excluding** decorative descendants —
  the `[data-role="shortcut"]` display, the `[data-role="icon"]` element, and any `aria-hidden="true"` node.
  This is the string used for the `select` detail's `label` AND as the filter source; an optional `data-keywords`
  string folds extra searchable terms into the filter (only). The raw `textContent` (which includes the shortcut
  glyphs and icon) is NOT the label — a `⌘H` shortcut must neither appear in `select.detail.label` nor be
  matchable by typing `⌘h`.
- **Group** — an author-declared `[role="group"]` wrapping command items, with a `[data-role="group-label"]`
  heading element whose text names the section; the group is `aria-labelledby` that heading. The heading's text
  is the source of the `select` detail's `group` field. Ungrouped items are direct `[role="option"]` children
  (their `group` is `''`).
- **Active option** — the highlighted option (the arrow-key/typeahead target), marked by
  `aria-activedescendant` on the search field + `[data-active]` on the option. **DOM focus never moves to it** —
  focus stays in the search field (the combo-box active-descendant model, NOT roving focus).
- **Posture** — the palette is a modal dialog: it opens centered in the platform top layer (the nested
  `ui-modal`'s `<dialog>.showModal()`), with a `::backdrop`, focus containment, and platform Escape/backdrop
  dismissal. It is **inherently dismissable** — the `ui-modal` `persistent` axis is NOT surfaced.
- **Ambient axis** — `scale`/`density`, inherited from an ancestor attribute or `ui-theme-provider`, never a
  palette prop.

## 3. Requirements

Normative per RFC 2119; each carries an ID and acceptance criteria.

### 3.1 Component contract

**SPEC-R1 — Base class, tag, tier.** The component MUST be `ui-command-modal`, a class `UICommandModalElement`
extending `UIElement`, self-defining on import (`customElements.define`, idempotent guard), living at
`packages/agent-ui/components/src/controls/command-modal/`. It MUST classify `tier: pattern` (the `ui-combo-box`
precedent — a composed control with internal parts and no §1 control-height row of its own). *(ADR-0125 F1)*
- **AC1** *Given* the module is imported, *then* `customElements.get('ui-command-modal')` resolves to a
  constructor that is a subclass of `UIElement`, and the descriptor resolves `tier: pattern`.
- **AC2** *Given* an instance, *then* it is NOT `instanceof UIFormElement` and carries no `formAssociated`
  behavior (`face.formAssociated: false`) — the palette holds no form value.

**SPEC-R2 — Props schema.** The component MUST declare exactly these attribute-synced props (only `open`
reflected — `label`/`placeholder`/`hotkey`/`filter` are a11y/config/behavior hints, not styling hooks):
`open: boolean(false)` (reflected, bindable two-way — the drive signal for the nested modal); `label: string('')`
(the accessible name for both the search field and the dialog); `placeholder: string('')` (the search field's
placeholder text); `hotkey: string('')` (the F2 opt-in convenience; `''` = no document listener). It MUST NOT
declare a `persistent`, `value`, `recents`, `results`, or `size` prop.
*(ADR-0125 F2/F5/F6/F7)*
- **AC1** *Given* a fresh instance, *then* `open` reads `false`, and `label`/`placeholder`/`hotkey` read `''`.
- **AC2** *Given* `el.open = true`, *then* `el.getAttribute('open') === ''`/reflected, and `setAttribute('open',
  '')` → `el.open === true`; `label`/`placeholder`/`hotkey` round-trip attribute↔property.
- **AC3** *Given* a grep of `static props`, *then* NO `persistent`/`value`/`recents`/`results`/`size` prop exists.

> **REV 2026-07-11 (ADR-0127, ratified):** the component gains a fifth prop, `filter: 'substring'|'regex'`,
> default `'substring'`, NOT reflected (a behavior switch, not a styling hook) — see SPEC-R5's REV for the
> semantics. A fresh instance's `filter` reads `'substring'`; the grep in AC3 is unaffected (`filter` is not in
> that exclusion list). Every existing consumer passes no `filter` attribute and sees zero behavior change
> (blast radius: none on ship, per the ADR).

**SPEC-R3 — Composition with `ui-modal` (the surface).** The component MUST render its surface by **nesting a
`ui-modal`** (a sanctioned sibling-control import, `avatar.ts:25` precedent) — it MUST NOT re-implement a native
`<dialog>`, backdrop, focus-restore, or Escape-dismissal of its own. The palette's `open` prop MUST drive the
nested modal's `open`; a platform dismissal of the modal (Escape/backdrop — the modal emits `close`+`toggle`)
MUST sync the palette's `open` back to `false` and the palette MUST re-emit its own `close`+`toggle` (the
two-way `open` pattern one level up, ADR-0019). The palette MUST forward its `label` onto the nested modal as
the dialog's accessible name. The palette MUST NOT surface the modal's `persistent` axis (it is inherently
dismissable). *(ADR-0125 F1/F5)*
- **AC1** *Given* an instance, *then* a nested `ui-modal` element exists in the palette's light DOM and the
  search+list parts render inside it (inside the modal's `<dialog>` after the modal's child-move); a grep of
  `command-modal.ts` finds NO `document.createElement('dialog')`, no `showModal`, no backdrop-rect handler, no
  `cancel`-event handler of its own — all delegated to `ui-modal`.
- **AC2** *Given* `el.open = true`, *then* the nested modal opens (its `<dialog>` enters the top layer); *given*
  a platform Escape/backdrop dismissal, *then* the palette's `open` becomes `false` and the palette emits
  `close` then `toggle` exactly once.
- **AC3** *Given* `el.label = 'Command palette'`, *then* the nested modal carries that accessible name on its
  dialog part (no `role`/`aria-*` on the palette host itself).

**SPEC-R4 — The search field (active-descendant combobox).** The component MUST render a control-created search
field part with `role="combobox"`, `aria-autocomplete="list"`, `aria-controls`→the list part's id, `aria-expanded`
tracking the open state, and `aria-activedescendant`→the active option's id (removed when none). It MUST be a
`contenteditable="plaintext-only"` element with `autocorrect`/`autocapitalize`/`autocomplete`/`spellcheck` OFF
(the combo-box "two floating dropdowns" fix — never a native `<input>`), and MUST take its accessible name from
`label` (→ `aria-label`, default a sensible "Search commands" when `label` is `''`). On open, focus MUST move to
the search field. *(ADR-0125 F1/F5)*
- **AC1** *Given* the search field, *then* it has `role="combobox"`, `aria-autocomplete="list"`, an
  `aria-controls` pointing at the list id, and is `contenteditable` with the four native-assist attributes off;
  the host carries no `role`/`aria-*`.
- **AC1b** *Given* the control-created list part, *then* it carries `role="listbox"`, its author command items
  carry `role="option"`, and its groups carry `role="group"` labelled by their `[data-role="group-label"]`
  heading — the listbox half of the combobox pattern, on the part (never the host).
- **AC2** *Given* the palette opens, *then* DOM focus lands in the search field (not on the dialog or an option).
- **AC3** *Given* `label="Commands"`, *then* the search field's `aria-label` is `"Commands"`; *given* `label=''`,
  *then* it falls back to the default name (non-empty).

**SPEC-R5 — Filter + active-descendant navigation.** Typing in the search field MUST filter the visible options
to those whose **item label** (§2 — excluding the decorative shortcut/icon) plus any `data-keywords`
case-insensitively includes the query, the proven substring behavior — no fuzzy sophistication. ArrowDown/ArrowUp
MUST move the active option among the **visible, enabled** options (wrapping at the ends), updating
`aria-activedescendant` + `[data-active]` **without moving DOM focus** off the search field; Home/End MAY move to
the first/last. Filtering MUST reset the active option. A group with zero visible options MUST hide its heading.
*(ADR-0125 F1/F3/F7)*
- **AC1** *Given* a query, *then* only options whose item label / `data-keywords` include it (case-insensitive)
  remain visible; a group with no surviving option hides its heading; typing a decorative shortcut glyph (e.g.
  `⌘H`) does NOT match its option (the shortcut is not part of the item label/filter source).
- **AC2** *Given* focus in the search field and ArrowDown, *then* `aria-activedescendant` advances to the next
  visible enabled option, `[data-active]` moves, and `document.activeElement` is STILL the search field (focus
  never leaves the input); ArrowUp reverses; disabled/hidden options are skipped; **ArrowUp from the first
  visible option wraps to the last** (and ArrowDown from the last wraps to the first).
- **AC3** *Given* the query changes, *then* the active option resets (no stale `aria-activedescendant` pointing
  at a now-hidden option).

> **REV 2026-07-11 (ADR-0127, ratified):** the match test is now mode-dependent over the SAME haystack (item
> label + `data-keywords`, unchanged). `filter='substring'` (default) is the AC1 test above, byte-identical.
> `filter='regex'` runs a case-insensitive `RegExp` test instead; a `SyntaxError` from an invalid pattern is
> caught and that keystroke falls back to the substring test, never throwing (TKT-0018's own acceptance line).
> Group-hide, active-reset (AC2/AC3), the status live region (SPEC-R7), and the empty-state (SPEC-R8) are all
> mode-independent and unchanged. The docs site's own search palette
> ([`site-command-search.spec.md`](site-command-search.spec.md) SPEC-R7) is the first consumer of this mode.
> - **AC4** *Given* `filter="regex"` and a valid pattern, *then* only options whose haystack matches the regex
>   (case-insensitive) remain visible.
> - **AC5** *Given* `filter="regex"` and an invalid pattern (e.g. an unbalanced `(`), *then* the palette does not
>   throw and falls back to matching that literal string as a substring for that keystroke.

**SPEC-R6 — Selection = `select` + close (no command bus, no router).** Clicking an enabled option, or pressing
Enter with an active option, MUST emit a `select` event (⊂ the `change·input·select·open·close·toggle`
allowlist) whose detail is `{ value, label, group }` (`value` = the option's `value`; `label` = its **item
label** per §2, the shortcut/icon excluded; `group` = the containing group's `[data-role="group-label"]` heading
text or `''`), then set `open=false` (closing the nested modal). A selection-driven close MUST emit **only**
`select` — NOT `close`/`toggle` (those fire on a *platform* dismissal, SPEC-R3); the palette MUST NOT double-emit
on the close it drove itself. The component MUST NOT import `@agent-ui/router` and MUST hold no command/action
registry — navigation and invocation are the consumer's `select` handler. *(ADR-0125 F4)*
- **AC1** *Given* an active option and Enter (or a click on an enabled option), *then* exactly one `select`
  event fires with `{value,label,group}` matching the option (`label` excludes the shortcut glyph), `open`
  becomes `false` (the modal closes), and NO `close`/`toggle` fires from that selection-driven close; a click on
  a disabled/`aria-disabled` option emits nothing.
- **AC2** *Given* a grep/negative-control over the built module, *then* there is NO import of `@agent-ui/router`
  and no event outside the allowlist is ever dispatched from the host.

**SPEC-R7 — Result-count live region.** The component MUST render a visually-hidden `[data-part="status"]`
region with `aria-live="polite"` and update it on every filter change to announce the visible result count
("12 results" / "No results"). *(ADR-0125 F5)*
- **AC1** *Given* a filter that leaves N visible options, *then* the status region's text announces N results
  (and "No results" at zero); the region is visually hidden but present in the accessibility tree.

**SPEC-R8 — Empty state.** When the filter leaves zero visible options, the component MUST show an empty-state
affordance: an author-provided `[slot="empty"]` (or `[data-role="empty"]`) child if present, else a default
"No results" row. The default row MUST be `role="presentation"` (never navigable/commit-able). *(ADR-0125 F3)*
- **AC1** *Given* a query matching nothing and no author empty slot, *then* a default "No results" row shows and
  is not reachable by Arrow/Enter/click; *given* an author `[slot="empty"]`, *then* it shows instead.

**SPEC-R9 — Escape is the modal's single path.** The component MUST NOT bind its own Escape handler and MUST NOT
implement a two-stage "clear filter then close". Escape is owned by the nested `ui-modal` (ADR-0045
platform-owned): one Escape → the modal's `cancel`→`close` → the palette syncs `open=false` (SPEC-R3 AC2). A
grep of `command-modal.ts` MUST find no `key === 'Escape'` branch. *(ADR-0125 F5)*
- **AC1** *Given* the palette open and Escape, *then* it closes via the modal's single path (one `close`
  emission), regardless of whether a filter is active (no clear-first stage); `command-modal.ts` has no Escape
  branch.

**SPEC-R10 — The opt-in `hotkey` (no global singleton).** When `hotkey` is `''` (the default), the component
MUST bind NO document-level listener. When `hotkey` is a non-empty chord (e.g. `"mod+k"`, `mod` = ⌘ on
macOS / Ctrl elsewhere), the component MUST bind exactly one document `keydown` — riding the connection
`AbortSignal` (auto-removed on disconnect, re-armed on reconnect) — that `preventDefault`s the chord and toggles
**this instance's** `open`. It MUST NOT register any global singleton/registry and MUST NOT arbitrate between
multiple instances sharing a chord. *(ADR-0125 F2 — the taste fork; Kim's ruling wanted)*
> **Contingent on F2.** This requirement encodes ADR-0125 F2, the fork flagged for Kim's ruling. R10 stands as
> written only if F2 is ratified as recommended (opt-in `hotkey`); if Kim rules `open`-only, R10 collapses to
> "no document listener at all" and `hotkey` is dropped from SPEC-R2 — a scoped edit, not a silent contradiction.
- **AC1** *Given* `hotkey=''`, *then* no document keydown listener is installed (a spy on `document.addEventListener`
  sees none for this instance).
- **AC2** *Given* `hotkey="mod+k"` and a ⌘/Ctrl+K keydown on `document`, *then* the default is prevented and the
  palette's `open` toggles; *given* the element disconnects, *then* the listener is removed (no residue).

### 3.2 Geometry, tokens, descriptor

**SPEC-R11 — Pattern-class geometry + token surface + forced-colors.** The component MUST NOT own a control-height
`size` prop. Its geometry MUST compose: the search field borrows the entry-control height register; the list is a
bounded scroll viewport (a `max-block-size` with `overflow-y: auto`, `scroll-fade` wired — the combo-box/modal
precedent); item/group/active-highlight spacing rides the `--ui-space` ladder ambiently under `[scale]`/`[density]`.
The component MUST ship a single fleet-scoped stylesheet declaring its `--ui-command-modal-*` roles and carrying a
`@media (forced-colors: active)` block keeping the active-option highlight and boundaries legible (the combo-box
`[data-active]` precedent). *(ADR-0125 F1; `geometry.md` Pattern class; family-coherence)*
- **AC1** *Given* `geometry.sizeClass`, *then* it is `pattern`; the descriptor declares no `size` attribute.
- **AC2** *Given* `family-coherence.test.ts`, *then* the `--ui-command-modal-*` chain is present in the single
  `command-modal.css`, and a forced-colors block is present.
- **AC3** *Given* a populated palette in a browser, *then* the list scrolls within its `max-block-size` and the
  active-option highlight is a background treatment paired with the `aria-activedescendant`/`[data-active]`
  non-color signifier (no color-only intent).

**SPEC-R12 — Descriptor + trip-wire.** The descriptor (`command-modal.md`) MUST declare `tag: ui-command-modal`,
`tier: pattern`, `extends: UIElement`, `geometry.sizeClass: pattern`, `face.formAssociated: false`, an
`attributes[]` fence mirroring `static props` 1:1 (`open`/`label`/`placeholder`/`hotkey`/`filter` — REV
2026-07-11, ADR-0127), the `events` it emits
(`select`, `close`, `toggle` — all ⊂ allowlist; it does NOT emit an `open` event — `open` is a prop, driven not
announced), the `parts` it creates (search, list, status, the nested modal), the author content model
(`[role=option]`/`[role=group]` children; the `empty` slot), the ARIA
pattern (combobox-in-dialog; role via internals/parts, never a host attribute), and the `keyboard` map. The
descriptor↔props trip-wire MUST pass with zero drift. *(ADR-0125)*
- **AC1** *Given* the descriptor↔props trip-wire test, *then* it passes; `compareDescriptorToSource` finds no
  undocumented styled part/role/custom-state.
- **AC2** *Given* the descriptor `events`, *then* every entry is within the allowlist and matches what the source
  emits (no `dismiss`).

### 3.3 Catalog disposition

**SPEC-R13 — Permanent catalog exclusion.** `CommandModal` (the descriptor-derived PascalCase type) MUST be a
**permanent `EXCLUSION_ALLOWLIST` entry** (in `a2ui/src/catalog/default/index.test.ts`), NOT a catalog row — it
is app-owner launcher chrome (the ADR-0112 cl.6 Toast/ThemeProvider class), never agent-emittable. *(ADR-0125
F8; ADR-0087 gate)* **This is an a2ui-package edit (`a2ui-builder` seat); the SPEC fixes the disposition, the
LLD carries it as a build deliverable.**
- **AC1** *Given* `command-modal.md` ships, *then* `CommandModal` enters `FLEET_TYPES` (ADR-0087) and the catalog
  coverage gate stays green because `CommandModal` is in `EXCLUSION_ALLOWLIST` (with the ADR-0112 cl.6 reason),
  and the residue-guard confirms `CommandModal` is absent from every catalog/factory key.

### 3.4 Site surfaces

**SPEC-R14 — Required site pages + representative specimen.** The `tier: pattern` classification REQUIRES a
`{doc, demo}` page pair under `site-coverage.test.ts` (the `ui-combo-box`/`ui-tabs` parity set).
`command-modal-doc.ts` MUST be the descriptor-derived API page; `command-modal-demo.ts` MUST show the palette
opened over a realistic app backdrop with grouped commands (icons + shortcut displays), the empty state, and a
keyboard-flow callout (type-to-filter, arrow to move the highlight, Enter to select+close, Escape to dismiss). A
representative `<component-gallery>`/preview specimen MUST show the palette's real job (a populated, grouped
command list — not a one-child stub). *(ADR-0125; the whole-shape + representative-specimen laws)*
- **AC1** *Given* `site-coverage.test.ts`, *then* the required-page-set check for `ui-command-modal` passes.
- **AC2** *Given* the demo page, *then* it renders an opened palette with at least two groups and multiple real
  command items, and the empty-state affordance.

## 4. Non-goals (explicit fences)

- **Recents / frequency memory** — the palette owns no selection-history state (against "not a store"); a
  consumer authors a "Recent" group or swaps children reactively. A fenced, additive v2 trigger. *(ADR-0125 F6)*
- **Async/provider-fed results + in-label match highlighting** — v1 items are author-declared; a `results`/async
  seam and safe in-label highlighting are fenced, additive v2 triggers. *(ADR-0125 F7)*
- **Fuzzy-match sophistication** — v1 ships the prior art's proven substring/keyword behavior only. *(TKT-0012)*
- **A `ui-command-group` sub-tag** — v1 groups with `[role="group"]` children; a role-only sub-tag is a fenced
  additive v2. *(ADR-0125 F3)*
- **A command/action registry or bus, routing integration** — the palette emits `select`; the consumer's handler
  invokes/navigates; the palette never imports `@agent-ui/router`. *(ADR-0125 F4)*
- **A non-dismissable palette (`persistent`)** — a command palette that cannot be dismissed is a contradiction;
  the modal's `persistent` axis is not surfaced. *(ADR-0125 F5)*
- **An unconditional global CMD-K listener** — the ADR-0082 no-global-singletons law; `open` is the floor,
  `hotkey` is per-instance opt-in. *(ADR-0125 F2)*

## 5. Examples

Illustrative specimens (normative for shape, not exhaustive) — the end-state a consumer should reproduce.

**Author-declared, grouped command items; consumer-wired open.**

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
  // F2 floor: the consumer owns the keymap.
  window.addEventListener('keydown', (e) => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); palette.open = true }
  })
  palette.addEventListener('select', (e) => {
    const { value, group } = e.detail          // { value, label, group } — the palette closed itself
    if (group === 'Navigation') router.navigate(value)
    else runCommand(value)
  })
</script>
<!-- host: NO role/aria-* attribute. The nested ui-modal owns the dialog surface + Escape/backdrop dismissal.
     Typing filters the list; ArrowDown/Up move aria-activedescendant with focus STAYING in the search field;
     Enter emits `select` + closes; the aria-live region announces the result count. -->
```

**The F2 opt-in `hotkey` convenience** — the palette binds one per-instance document listener while `hotkey` is set.

```html
<!-- equivalent to the consumer-wired keydown above, without the boilerplate; multi-instance collision is the
     author's concern (each instance with a hotkey toggles itself) -->
<ui-command-modal label="Command palette" hotkey="mod+k"></ui-command-modal>
```

## 6. Trace

| Requirement | ADR-0125 fork | Decomp node(s) |
|---|---|---|
| SPEC-R1 | F1 | n3 |
| SPEC-R2 | F2/F5/F6/F7 | n5, n6, n7, n8 |
| SPEC-R3 | F1/F5 | n9 |
| SPEC-R4 | F1/F5 | n10 |
| SPEC-R5 | F1/F3/F7 | n11, n12 |
| SPEC-R6 | F4 | n13, n18 |
| SPEC-R7 | F5 | n15 |
| SPEC-R8 | F3 | n16 |
| SPEC-R9 | F5 | n14 |
| SPEC-R10 | F2 | n17 |
| SPEC-R11 | F1 | n19 |
| SPEC-R12 | — | n20, n21 |
| SPEC-R13 | F8 | n22 |
| SPEC-R14 | — | n26 |

> **SPEC-R15 (added 2026-07-11, TKT-0017 — Kim's pre-ship QA, review-driven):** the palette renders a
> FIXED frame — a set inline-size and a viewport-top anchor (~15svh); the search field's box is
> IDENTICAL across result-count changes (AC: browser-asserted rects before/after a filter that empties
> the list, both engines); only the list region absorbs elasticity, growing downward within its cap.
> The mechanism is ui-modal's new public frame dials (its own tokens, defaults identity — a bare modal
> is unchanged, browser-asserted).
