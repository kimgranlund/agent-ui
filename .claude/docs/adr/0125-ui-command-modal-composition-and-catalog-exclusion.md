# ADR-0125 — `ui-command-modal`: the CMD-K palette as composition (nested `ui-modal` + the combo-box active-descendant pattern), permanently catalog-excluded

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-10
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-10 |
> | **Proposed by** | design intake (TKT-0012, Kim's ask 2026-07-10: *"the classic CMD-K modal search/action menu as `ui-command-modal` — learn from the exe.xyz command docs + the adia `command` component"*). The fleet has **no** command-palette/cmd-k anything — a dedup grep of `controls/`, the tickets, the specs, and the ADR log is clean. The machinery it needs already ships: `ui-modal` (surface + dismissal), `ui-combo-box` (typeahead filter + active-descendant listbox), the `scroll-fade` trait, the ADR-0017 child-move. |
> | **Ratified by** | — (proposed; forks F1–F8 as recommended, none self-ratified — only Kim flips a status. **F2, the global hotkey, is flagged as the taste fork most wanting Kim's ruling.**) |
> | **Repairs** | NEW [`../spec/command-modal.spec.md`](../spec/command-modal.spec.md) · NEW [`../lld/command-modal.lld.md`](../lld/command-modal.lld.md) · NEW [`../decompositions/command-modal-ship.decomp.json`](../decompositions/command-modal-ship.decomp.json) (coverage-clean `--strict`, plan mode, exit 0). On ratification+build: NEW `packages/agent-ui/components/src/controls/command-modal/*` · `packages/agent-ui/a2ui/src/catalog/default/index.test.ts` `EXCLUSION_ALLOWLIST` (+`CommandModal`, permanent — F8) · NEW `site/pages/command-modal-{doc,demo}.ts` · a `<component-gallery>` specimen · the `controls/index.ts` barrel + `package.json` subpath |
> | **Supersedes / Superseded by** | relates ADR-0017 (the child-move pattern + the native-`<dialog>` modal this nests) · relates ADR-0019/0020 (the two-way `open` + `persistent`/dismissal contract this delegates to `ui-modal`) · relates ADR-0043/0045 (the overlay/dismissal law — Escape is platform-owned by the nested modal, single close path) · relates ADR-0085 (the combo-box active-descendant editor + labelling seam this re-derives) · relates ADR-0082 (the no-global-singletons law F2 answers) · relates ADR-0115 (the router-DAG law F4 honours — the palette never imports `@agent-ui/router`) · relates ADR-0087 / ADR-0112 cl.6 (the catalog-or-allowlist gate F8 answers, the Toast/ThemeProvider exclusion class) · relates the `avatar → icon` sanctioned sibling-control import precedent (`avatar.ts:25`) F1 reuses |

## Context

`ui-command-modal` is a **greenfield** control — no palette primitive exists in `@agent-ui/components`. Two
prior arts were studied (per TKT-0012) and **promoted to this fleet's laws, never ported**:

- **The published `ui-kit.exe.xyz/site/components/command` docs page** — fetched once at intake; it returned
  only a client-side "Loading changelog…" SPA shell with zero component content (the fourth intake in a row to
  hit this — swiper, toolbar, timeline, color-picker all saw the same empty shell). Per the
  repo-absence-vs-spec-absence rule, this ADR draws **nothing** from that source and fills no gap from memory.
- **The adia `gen-ui-kit` `command` family** (`/Users/kimba/Projects/adia/gen-ui-kit/packages/web-components/
  components/command/`, read in full — `command.class.js`, `USAGE.md`, `command.test.js`). A single-tag
  `<command-ui extends UIElement>`: native `<option>`/`<optgroup>` children with `data-icon`/`data-shortcut`/
  `data-keywords`, a substring filter (`label`/`value`/`keywords`, case-insensitive `includes`), active-item
  navigation via `data-active` + arrow keys, a built-in MRU **recents** section (last N selected), a
  `slot=empty`/`slot=footer` pair, and a `select` (`{value,label,category}`) + `dismiss` (Escape) event pair.
  Its hotkey is **purely consumer-wired** (`USAGE.md`: `window.addEventListener('keydown', …)` flips `open`).
  It is a capable, shadow-DOM-free design — but its `role`/`aria-*` on the host, its native-`<option>` content
  model, its owned recents state, and its `dismiss` event name are all fleet-law questions this ADR resolves
  rather than copies.

**The intake's center of gravity is composition, not invention** (TKT-0012). Every mechanism a palette needs
already has a fleet owner; the eight forks below decide *which* machinery is lifted, *how*, and where the new
element sits in the trust boundary. **No novelty leg is taken** — `geometry.md` already classifies a composed
control with internal parts as **Pattern** (the `ui-combo-box` precedent, `tier: pattern`); the geometry is a
lookup, not an invention, and no new event, geometry row, base class, or trait is minted.

### The reuse ledger (the precedent sweep, argued per row)

| Mechanism | Owner | Disposition | Why |
|---|---|---|---|
| Modal surface — top-layer, `::backdrop`, focus containment, Escape→`cancel`→`close`, focus restore, `persistent` dismissal, two-way `open` | `ui-modal` (ADR-0017/0019/0020) | **REUSE by nesting** (F1) | A command palette *is* a modal dialog; `ui-modal` already ships and cross-engine-tests the whole surface+dismissal contract. Nesting a sibling control is sanctioned (`avatar.ts:25` imports `../icon/icon.ts`). |
| Active-descendant filter+list — `hidden`-based filter, `aria-activedescendant` move, `[data-active]` highlight, role=combobox editor over a role=listbox, ADR-0017 child-move of `[role=option]` children | `ui-combo-box` (ADR-0085) | **REUSE as a PATTERN** (re-implemented) (F1) | The pattern is exactly right (focus stays in the input; arrows move a highlight, not real focus). But it lives as **private methods** on `combo-box.ts`, not an extractable trait, and combo-box's shape diverges (form-associated, anchored popover, free-text). Re-deriving ~60 lines is cleaner than a premature trait extraction or an unsound element-nesting. |
| Bounded scroll viewport with edge fade | `scroll-fade` trait | **REUSE** | The results list is a bounded scroll region; `ui-modal` and `ui-combo-box` both wire `scrollFade` over their viewport already. |
| `[role=option]`/`[role=group]` author children moved into a rendered container | ADR-0017 child-move | **REUSE** | The item model (F3) is author-declared option children lifted into the list part — the combo-box/select precedent verbatim. |
| Roving focus (real DOM focus moves to the option) | `roving-focus` trait / `listbox-element` base | **REJECT** (F1) | A palette's focus **stays in the search field** while arrows move the highlight — that is active-descendant, not roving. `roving-focus` moves real focus off the input (wrong); `UIListboxElement` is also form-associated (a value-bearing control — wrong, the palette holds no form value). TKT-0012 named both as candidates; this is their resolution. |
| Anchored floating panel + light-dismiss | `overlay` trait (ADR-0043/0045) | **REJECT** (F1) | The results list is the **dialog body** (always visible while the palette is open), not a floating anchored popover. The nested modal's native `<dialog>` top-layer handles all layering; there is no anchor to position and no second dismiss surface. |
| Selection-commit state | `selection-commit` trait | **REJECT** (F4) | The palette commits nothing to a form; selection = emit `select` + close, a trivial bespoke path. `selection-commit` manages form-selection *state* the palette does not hold. |

## Decision

Ship **`ui-command-modal`** — a **`UIElement`-based, Pattern-class** coordinator in `controls/`: it **nests a
`ui-modal`** for the entire surface+dismissal contract, and inside that modal renders a control-created search
field (role=combobox) over a control-created results list (role=listbox) built from the author's `[role=option]`
/`[role=group]` children, re-deriving `ui-combo-box`'s active-descendant filter. Choosing a command emits
`select` and closes. **The palette is arrangement + filter + selection semantics — not a command bus, not a
router, not a store.** It is permanently excluded from the A2UI catalog.

### F1 — the composition strategy: **nest `ui-modal`; re-derive the combo-box active-descendant filter; base `UIElement`**

Decomposed to primitives, a command palette is exactly three things the fleet already owns: **a modal surface**
(`ui-modal`), **an active-descendant filtered listbox** (`ui-combo-box`'s private pattern), and **an item model**
(ADR-0017 child-move). The recommendation composes the first, re-derives the second, reuses the third.

- **The surface = a nested `ui-modal`.** The palette's `connected()` creates a `<ui-modal>` element, puts the
  search+list parts inside it, and appends it to the host; `ui-modal` moves that content into its own native
  `<dialog>` and delivers top-layer stacking, a `::backdrop`, focus containment, focus restore, Escape→`cancel`
  →`close`, and the two-way `open` — **all already cross-engine tested (ADR-0017/0019/0020)**. The palette
  binds its own `open` prop to the nested modal's `open`, and listens for the modal's `close`/`toggle` to sync
  its state back on a platform dismiss (the modal's own two-way pattern, one level up). Sibling-control nesting
  is sanctioned fleet-wide (`avatar.ts:25`). **Rejected: a bespoke native `<dialog>` inside the palette** — it
  would re-implement ADR-0017's dismissal, backdrop-rect, and focus-restore machinery that `ui-modal` already
  ships and tests; the fleet does not duplicate a shipped, tested surface.
- **The filter = the combo-box active-descendant pattern, re-implemented (not imported, not nested).** The
  search field is a control-created `contenteditable` `[data-part=search]` with `role="combobox"` (the
  `combo-box.ts` editor verbatim — `plaintext-only`, `autocorrect/autocapitalize/autocomplete/spellcheck`
  OFF, the "two floating dropdowns" fix combo-box documents), `aria-autocomplete="list"`, `aria-controls`→the
  list, `aria-expanded` tracking the open state, and `aria-activedescendant`→the active option. Filtering hides
  non-matching options (`opt.hidden = …includes(q)`), and Arrow keys move `aria-activedescendant` + `[data-active]`
  **without moving DOM focus** (`combo-box.ts` `#filterOptions`/`#moveActive`/`#setActive`, re-derived). **Rejected:
  nesting `ui-combo-box`** — it is form-associated (contributes a form value), anchored-popover (its listbox is a
  `popover=auto` panel bottom-anchored to the editor, not a dialog body), and free-text-capable; a palette needs
  none of that and would fight all three. **Rejected: extracting a shared `active-descendant-filter` trait now** —
  it has exactly one-and-a-bit consumers (combo-box's copy diverges in the anchored-popover/commit path); a
  premature extraction that must serve both shapes is more coupling than value. Re-derive the ~60 lines; revisit
  extraction if a third consumer appears (the roving-focus extraction precedent — it was pulled out of `ui-tabs`
  only once a second host wanted it).
- **Base `UIElement`.** The palette is a **coordinator**, not a surface (the nested `ui-modal` paints the
  surface) and not a form control (it emits+closes, holds no value/validity). `ui-theme-provider` and
  `ui-form-provider` are the precedents: `UIElement` coordinators that own `static props` + effects and paint
  nothing. **Not `UIFormElement`** (no form value), **not `UIContainerElement`** (the nested modal is the
  container), **not `UIListboxElement`** (form-associated + roving).

### F2 — the global hotkey: **consumer-wired `open` is the floor; an opt-in `hotkey` attribute is the convenience — NO unconditional document listener** *(the taste fork — Kim's ruling wanted)*

The question TKT-0012 flags as most wanting Kim's taste: who owns CMD-K? The ADR-0082 no-global-singletons law
bites hard — a component that binds a document-level `keydown` in every instance means two palettes, or a
palette plus a shell, silently fight over the same chord.

**Recommendation (firm, not self-ratified):**
- **The floor is consumer-wired.** `open` is a reflected, bindable prop (the `ui-modal` shape). The consumer
  binds the key and flips `open` — exactly adia's `USAGE.md` pattern, and the honest default: the app owns its
  own keymap, and the palette imposes no global listener by construction. This alone ships a complete palette.
- **The convenience is an opt-in `hotkey` attribute**, default `''` (no listener). When set to a chord string
  (e.g. `hotkey="mod+k"`, `mod` = ⌘ on macOS / Ctrl elsewhere), the palette binds **one** document `keydown`
  **only while `hotkey` is non-empty**, which `preventDefault`s the chord and toggles **this instance's** `open`.
  The listener rides the connection `AbortSignal` (auto-removed on disconnect, re-armed on reconnect) — no
  global singleton, no registry. **Multi-instance collision is explicitly the author's concern**: two palettes
  with the same `hotkey` both toggle themselves; the palette does not arbitrate a winner (arbitrating *is* the
  singleton ADR-0082 forbids). This is documented as a sharp edge, not engineered around.

The lean is **include `hotkey` opt-in** — it is a handful of lines, and the "CMD-K" identity of the control
essentially implies the affordance; withholding it pushes every consumer to re-write the same five lines. But
this is precisely the fork where a firm recommendation is offered and the marker is kept `proposed` for Kim:
the alternative (ship *only* `open`, no `hotkey`, keep the surface minimal) is entirely defensible and is the
one-line change if Kim prefers it.

### F3 — the item/action model: **author-declared `[role=option]` / `[role=group]` children (the combo-box precedent) — NOT native `<option>`, NOT bespoke sub-tags**

Commands are **stateless declarative entries** (adia's own `USAGE.md` makes this argument: unlike tree/menu
items with rich open/selected/expanded state, a command is a one-shot entry). The item model is therefore
author-declared light-DOM children carrying `role="option"` with a `value` attribute, optionally grouped under a
`role="group"` element with a heading, moved into the list part at connect (ADR-0017 child-move). An option's
rich inner content is author-authored: a leading icon element, the label text, and an optional decorative
`[data-role=shortcut]` display span (`aria-hidden` — the shortcut is a visual hint; the real keybind is the
consumer's, never wired by the palette). `disabled`/`aria-disabled` opts an option out of navigation + commit
(the combo-box `#getVisibleOptions` rule).

- **Rejected: native `<option>`/`<optgroup>` + `data-*`** (adia's model). A native `<option>` renders **text
  only** — it cannot hold a child icon element, a styled shortcut chip, or the match-highlight spans F7 fences.
  adia is forced into `data-icon`/`data-shortcut` string attributes *because* it chose `<option>`; the fleet's
  `[role=option]` children (which DO hold rich content) remove that constraint. It also violates the fleet's
  "no native form elements" posture the way combo-box already resolved (contenteditable + role, not `<input>`/
  `<option>`).
- **Rejected: bespoke `ui-command-item` / `ui-command-group` sub-tags.** Commands carry no per-item state
  machine (open/selected/expanded) to justify new fleet elements — the ADR-0121 toolbar reasoning (F2 there)
  applies: the fleet's item-model dialect is role-attributed children, and a sub-tag whose only job is one ARIA
  role is a **fenced, additive v2** at most, not a v1 cost. Keeps the fleet + catalog surface lean.

**Recommendation: role-attributed children** — `[role=option][value]` with rich inner content, grouped under
`[role=group]` with an `aria-labelledby` heading. An author-provided `[slot=empty]` overrides the default "No
results" row (the combo-box `#emptyRow` + adia `slot=empty` precedents merged).

### F4 — selection semantics: **`select` (allowlist) with `{value,label,group}`, then close — never a command bus, never a router import**

Choosing an option (click on an enabled option, or Enter on the active one) emits a **`select`** event
(⊂ the `change·input·select·open·close·toggle` allowlist) whose detail is `{ value, label, group }` (`group` =
the containing `[role=group]`'s heading, or `''`), then sets `open=false` — which closes the nested modal (the
common CMD-K single-action flow; TKT-0012's "select + close"). Navigation, invocation, routing: **all the
consumer's `select` handler**. The palette **never imports `@agent-ui/router`** (the ADR-0115 catalog-invisible
DAG law — a grep of the built module is the negative control) and holds no command/action registry (the
TKT-0009 toolbar non-goal, same law: the palette arranges + filters + selects, it does not dispatch).

- **Rejected: adia's non-auto-close** (its palette stays open, consumer decides). TKT-0012 specifies select+close;
  auto-close matches the CMD-K mental model. A multi-action consumer can re-open on their own `select` handler.
- **Rejected: a `dismiss` event** (adia's Escape event name). `dismiss` is off-allowlist; Escape is platform-owned
  by the nested modal, which already emits `close`/`toggle` on dismissal (F5).

### F5 — a11y: **the combobox/listbox pattern inside a dialog; a result-count live region; Escape is the modal's, single path**

- **Search field**: `role="combobox"`, `aria-expanded` (true while the palette is open — the list is shown),
  `aria-controls`→the list id, `aria-activedescendant`→the active option id (removed at none), `aria-autocomplete
  ="list"`. Its accessible name comes from the `label` prop (→ `aria-label` on the search field; the combo-box
  ADR-0085 editor precedent — a searchbox has a distinct value so `aria-label` does not erase it), defaulting to
  a sensible "Search commands".
- **List**: `role="listbox"`; groups are `role="group"` with `aria-labelledby`→a heading element; options are
  `role="option"` + `aria-disabled`, the active one marked by `aria-activedescendant` + `[data-active]` (DOM
  focus never leaves the search field).
- **Result-count announcement** (TKT-0012): a visually-hidden `[data-part=status]` `aria-live="polite"` region
  updated on every filter — "12 results" / "No results". This is a **small, genuine addition over combo-box**
  (which announces no count); it is the one net-new a11y behavior, and it is announcement-only (no new event, no
  new geometry).
- **The dialog** gets its accessible name from the `label` prop, forwarded onto the nested `<ui-modal>` (whose
  `aria-label`→dialog-part forwarding, ADR-0017 cl.5, then does the rest).
- **Escape is the nested modal's**, exclusively (ADR-0045 platform-owned): the palette binds **no** Escape
  handler and implements **no** two-stage "clear filter, then close" — that would fight the modal's platform
  dismissal, the exact cross-engine bug the combo-box Escape smoke caught (`combo-box.ts:232` documents it). One
  Escape → one `cancel`→`close` on the modal → the palette syncs `open=false` and re-emits its own `close`+`toggle`.
  The palette does **not** expose the modal's `persistent` axis — a non-dismissable command palette is a
  contradiction (see *Alternatives considered*).

### F6 — recents / frequency: **NON-GOAL for v1 — consumer-fed**

adia ships a built-in MRU recents section (the palette remembers the last N selected `value`s and shows them
when the filter is empty). That is **owned selection-history state** — precisely what "arrangement + filter +
selection, not a store" excludes. **Recommendation: v1 non-goal.** A consumer who wants recents authors a
"Recent" `[role=group]` (or swaps children reactively) — the palette renders it like any other group. Owning MRU
state is a fenced, additive future trigger (it would need a `recents`/`max-recents` contract and persistence
semantics the palette deliberately does not hold in v1).

### F7 — async/provider results + match highlighting: **NON-GOAL for v1 — the prior art does not prove them cheap**

adia's item set is synchronous author children (or a synchronous `setItems`); it proves **nothing** about
provider-fed async results, and its match display is plain (no highlighting). **Recommendation: fence both.**
v1 items are author-declared (the consumer may swap the children/`setItems` reactively off their own signal —
their data, their job); a `results`/async-provider seam and in-label **match highlighting** (which needs safe
text-decoration inside option labels — a real XSS/normalization surface) are named, additive v2 triggers. v1's
filter is the proven substring behavior (case-insensitive `includes` over the option's text + an optional
`data-keywords`), no fuzzy sophistication beyond the prior art (TKT-0012 non-goal).

### F8 — catalog posture: **permanently EXCLUDED (`EXCLUSION_ALLOWLIST` `CommandModal`)**

Against the ADR-0087 catalog-or-allowlist gate and its ADR-0112 cl.6 exclusion test — *"is this page/app-owner
chrome an agent must never emit?"* — a command palette is **app-owner launcher chrome**. It is the application's
own command surface, wired to arbitrary consumer actions via its `select` handler; an agent emitting a palette
inside a composed surface would be minting a launcher for actions it does not own — the wrong trust shape,
structurally the same **exclusion class** as `Toast`/`ToastRegion` (ADR-0112 cl.6) and `ThemeProvider` (ADR-0117):
app-owner/ambient chrome, never agent-emittable — each homed to its own authorizing decision, not to cl.6's
Toast-specific literal reasons.
The moment `command-modal.md` ships, ADR-0087's fleet-derived gate admits `CommandModal` into `FLEET_TYPES` and
demands a catalog row *or* an allowlist entry — silence is not an option.

**Recommendation: a PERMANENT `EXCLUSION_ALLOWLIST` entry** `'CommandModal'`. Its home authority is **this ADR
(ADR-0125 F8)** — the exclusion *reason* is app-owner launcher chrome wired to arbitrary consumer actions, which
is NOT one of ADR-0112 cl.6's three Toast-specific literal reasons (self-expiring message vs. history-must-not-
lie · payload↔DOM traceability · a forbidden *overlay* type); ADR-0112 cl.6 is named only as the exclusion-*class*
analogy, exactly the shape the `ThemeProvider` allowlist entry uses (it homes to ADR-0117 and names cl.6 as the
applied class). The allowlist entry therefore reads `'CommandModal' → "ADR-0125 F8 — app-owner launcher chrome,
never agent-emittable (the ADR-0112 cl.6 exclusion class)"`. The residue-guard (`index.test.ts`) already asserts
every allowlist entry is genuinely absent from the catalog, so this stays honest by construction. **This is
argued, not defaulted** (TKT-0012): the alternative — a `CommandModal` catalog row — is rejected on the trust
merits above, not merely deferred.

## Consequences

- The fleet gains its **first command palette** — and its **first control to nest another shipped control as a
  whole element** (`ui-modal`), proving the `avatar → icon` sibling-import precedent scales to a stateful,
  two-way-bound child. A small hardening: the nested-modal `open` sync is the two-way `open` pattern one level
  up (the palette relays the modal's `close`/`toggle`).
- **Active-descendant filtering is re-derived, not extracted.** The combo-box pattern proves reusable a second
  time; if a third consumer appears, *that* is when an `active-descendant-filter` trait earns extraction (the
  roving-focus precedent — extracted only on its second host).
- **Escape stays a single path** — the nested modal owns dismissal (ADR-0045); the palette adds no competing
  Escape handler and no two-stage clear-then-close, avoiding the exact cross-engine race combo-box documents.
- **The result-count live region is the one net-new a11y behavior** — announcement-only, no new event or
  geometry.
- `EXCLUSION_ALLOWLIST` gains a **fourth permanent member** (`CommandModal`, alongside `Toast`/`ToastRegion` and
  `ThemeProvider`) — the residue-guard keeps it honest without discipline.
- **Cost accepted:** one control folder + two site pages (`command-modal-{doc,demo}.ts`) + a gallery specimen +
  the standing `tier: pattern` site obligation (the `ui-combo-box`/`ui-tabs` parity set). The demo shows the
  palette opened over a realistic app backdrop with grouped commands, the empty state, and the keyboard flow.
- **Fenced, additive futures** (no v1 contract change to add later): recents (F6), async/provider results +
  match highlighting (F7), a `ui-command-group` sub-tag (F3), fuzzy matching (TKT-0012 non-goal), and
  **nested/drill-down sub-palettes** (a command that opens a second page of commands — a common CMD-K shape).
  v1 fences drill-down: a consumer composes it by swapping the palette's children on their `select` handler
  (their state, their job); an owned multi-page navigation model is additive later, not a v1 store.

## Acceptance

The SPEC's requirements hold end to end: `npm run check`(+site) and `npm test` green including
`family-coherence.test.ts` and the new `command-modal` suite; the descriptor↔props trip-wire green; the a2ui
`EXCLUSION_ALLOWLIST` residue-guard green with `CommandModal` permanently seeded and never catalogued; the
combobox/listbox a11y pattern proven **cross-engine** (Chromium + WebKit) with a real typeahead-filter +
keyboard-flow leg (type filters the list, ArrowDown/Up move `aria-activedescendant` with focus STAYING in the
search field, Enter emits `select` + closes, Escape closes via the modal's single path, the result-count live
region updates); the **whole-shape** proof (the palette opens as a real centered dialog with a populated,
grouped, scrollable list — not a collapsed panel); a negative-control leg proving **no** `@agent-ui/router`
import and **no** event outside the allowlist; `site-coverage.test.ts` green for the new `{doc,demo}` pair;
`npm run size` measured and, if material, pinned; independent `component-reviewer` GO before the build commits.

## Alternatives considered

- **A bespoke native `<dialog>` inside the palette** — rejected (F1): re-implements ADR-0017's tested dismissal/
  backdrop/focus-restore machinery; nest the shipped, tested `ui-modal` instead.
- **Nesting `ui-combo-box` for the filter** — rejected (F1): form-associated + anchored-popover + free-text; a
  palette needs a dialog-body list, no form value, and no free text. Lift its active-descendant *pattern*, not
  the element.
- **Extracting a shared `active-descendant-filter` trait now** — rejected (F1): one-and-a-bit divergent consumers;
  premature. Re-derive; extract on a third consumer (the roving-focus precedent).
- **`roving-focus` / `UIListboxElement`** — rejected (F1): both move real DOM focus off the search field and
  `UIListboxElement` is form-associated; a palette keeps focus in the input (active-descendant) and holds no
  form value.
- **An unconditional document `keydown` for CMD-K** — rejected (F2): the ADR-0082 no-global-singletons law;
  multiple palettes/shells would fight the chord. Consumer-wired `open` floor + opt-in per-instance `hotkey`.
- **Native `<option>`/`<optgroup>` + `data-*` (adia's model)** — rejected (F3): `<option>` holds text only —
  no icon element, styled shortcut, or match-highlight spans; the fleet's `[role=option]` children hold rich
  content.
- **Bespoke `ui-command-item`/`ui-command-group` sub-tags** — rejected (F3): commands are stateless; a role-only
  sub-tag is a fenced additive v2 at most (the toolbar F2 precedent).
- **A `dismiss` event + auto-close-off** — rejected (F4/F5): `dismiss` is off-allowlist; Escape is the modal's
  `close`; TKT-0012 specifies select+close.
- **Built-in MRU recents** — rejected (F6): owned selection-history state, against "not a store"; consumer-fed
  via an authored "Recent" group.
- **Async/provider results + in-label match highlighting in v1** — rejected (F7): the prior art proves neither
  cheap; highlighting is a text-decoration safety surface; both are fenced additive v2 triggers.
- **A `CommandModal` catalog row (agent-emittable)** — rejected (F8): app-owner launcher chrome wired to
  arbitrary consumer actions — the ADR-0112 cl.6 Toast/ThemeProvider trust class; permanent exclusion.
- **Exposing `persistent` (a non-dismissable palette)** — rejected (F5): a command palette that cannot be
  dismissed is a contradiction; the palette is inherently dismissable and does not surface the modal's
  `persistent` axis.
