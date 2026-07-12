---
doc-type: ticket
id: tkt-0012
status: done
date: 2026-07-10
owner:
kind: feature
size: big
---
# TKT-0012 — `ui-command-modal`: the CMD-K command palette

## Summary
Kim's ask (2026-07-10): the classic "CMD-K" modal search/action menu as `ui-command-modal` —
learn from `https://ui-kit.exe.xyz/site/components/command` and
`/Users/kimba/Projects/adia/gen-ui-kit/packages/web-components/components/command/` (exists,
verified — full component incl. `command.test.js` and a `USAGE.md`). Dedup: **greenfield** —
no command-palette/cmd-k anything in the fleet, tickets, PRDs, or ADR log. The fleet already
owns most of the machinery this composes: `ui-modal` (the surface + dismissal), `combo-box`
(typeahead filter + listbox + the ADR-0017 option-child-move pattern), `ui-menu`/the listbox
base, and the `roving-focus` trait — the intake's center of gravity is COMPOSITION (which
mechanisms are reused vs what is genuinely new), not invention.

## Research inputs (for the design intake, recorded verbatim)
- The exe.xyz command docs page (fetch at intake).
- The adia command component: `command.class.js` (filter/action model), `USAGE.md` (the
  intended consumer contract), `.test.js` (proven behaviors); promote to this fleet's laws.

## Acceptance
- A design intake via `agent-ui-component-design` resolves the forks before any build:
  - **Composition vs bespoke** — the filter+listbox mechanics: reuse combo-box's machinery /
    the `_base` listbox element / the menu overlay vs a bespoke panel inside `ui-modal`;
    argue each reuse row explicitly (the patterns map is the sweep).
  - **The global hotkey** — who owns CMD-K: the component binding a document-level listener
    (an app-chrome concern — the ADR-0082 no-global-singletons law bites: multiple palettes,
    multiple shells?) vs consumer-wired open (the palette exposes `open`, the app binds the
    key, possibly via an opt-in `hotkey` attribute). The fleet lean is consumer-wired with
    an opt-in convenience — argue it.
  - **The item/action model** — items as authored children (groups/sections, icons,
    shortcuts-display, empty state, recents slot?); selection = `select` event + close (the
    allowlist holds); the palette is arrangement + filter + selection semantics, NOT a
    command bus (the TKT-0009 toolbar non-goal, same law). Navigation actions are the
    CONSUMER's handlers — the palette never imports `@agent-ui/router` (catalog-invisible +
    DAG law, ADR-0115).
  - **Naming/family** — `ui-command-modal` per the ask; the intake argues item/group
    sub-tags vs role-attributed children (combo-box's option precedent).
  - **A11y** — the combobox/listbox ARIA pattern inside a dialog: filter input labelling,
    active-option management, announcement of result counts; keyboard map (arrows/enter/
    escape layering with the modal's own Escape — ADR-0045's platform-owned dismissal).
  - **Catalog posture** — lean EXCLUSION_ALLOWLIST (app-owner chrome, the toast/
    theme-provider class per ADR-0112 cl.6 / ADR-0087): an agent emitting an app's command
    palette is the wrong trust shape; argue it, don't default it.
  - Async/provider-fed results and match highlighting: fence v1 with triggers unless the
    prior art proves them cheap.
- The shipped component meets the full per-control bar (descriptor, jsdom + cross-engine
  browser probes incl. real typeahead-filter + keyboard-flow proofs, independent review,
  barrels/exports/size, doc + demo pages).

## Links
- The two research inputs above.
- `controls/combo-box/` (filter + listbox + child-move) · `controls/modal/` (surface +
  persistent/dismissal semantics, ADR-0020) · `traits/roving-focus.ts` · ADR-0043/0045
  (overlay/dismissal) · ADR-0082 (no global singletons) · ADR-0087/0112 cl.6 (catalog
  posture) · ADR-0115 (router stays out).
- `.claude/skills/agent-ui-component-design/` — the intake procedure.

## Scope / Open
- **Open:** the hotkey fork above (the one most likely to want Kim's taste); grouped
  results' heading semantics; recents/frequency (state the palette would have to own —
  lean non-goal, consumer-fed); match highlighting (needs safe text decoration inside
  option labels).
- **Non-goal:** a command/action registry or bus; routing integration; porting either
  prior art's full API; fuzzy-match ALGORITHM sophistication beyond the prior art's (v1
  ships the proven substring/prefix behavior; smarter matching fences with a trigger).
- **Sequencing:** design intake first; no build from this ticket directly. Queue: fifth —
  tkt-0008 swiper · 0009 toolbar · 0010 timeline · 0011 color-picker · 0012 this.

## Findings

**2026-07-10 — design intake COMPLETE (docs-only; no code, no commits).** Ran `agent-ui-component-design`. The
palette is resolved as **composition, not invention**: no new base class, trait, event, or geometry row.

**Artifacts (all NEW):**
- [ADR-0125](../adr/0125-ui-command-modal-composition-and-catalog-exclusion.md) (`proposed`; README row added;
  `adr.test.ts` house-style gate green, 33/33) — 8 forks, each recommended, none self-ratified.
- [SPEC](../spec/command-modal.spec.md) (SPEC-R1…R14) · [LLD](../lld/command-modal.lld.md) (LLD-C1…C18, frozen
  §3 interface) · [decomp](../decompositions/command-modal-ship.decomp.json) (`coverage_check.py --strict`:
  27 nodes · 24 actions · 40 edges · **clean**).

**Classification:** `ui-command-modal` · `UICommandModalElement` · **base `UIElement`** (coordinator — the
theme/form-provider precedent; not form-associated, paints no surface) · **tier `pattern`** (the combo-box
precedent) · **catalog: permanently EXCLUDED** (`CommandModal` `EXCLUSION_ALLOWLIST`).

**Fork resolutions (the ticket's open questions):**
- **Composition vs bespoke (F1):** NEST the shipped `ui-modal` for the whole surface+dismissal contract
  (ADR-0017/0019/0020; the `avatar→icon` sibling-import precedent); RE-DERIVE (not extract, not nest) combo-box's
  active-descendant filter (its methods are private + its shape diverges — form-associated/anchored/free-text).
  REJECTED: bespoke `<dialog>`, nesting combo-box, extracting a trait now, `roving-focus`/`UIListboxElement`
  (both move real focus + listbox is form-associated), the `overlay` trait (no anchored popover — the list is
  the dialog body).
- **Global hotkey (F2, the taste fork — Kim's ruling wanted):** consumer-wired `open` is the FLOOR; an opt-in
  per-instance `hotkey` attribute is the convenience (NO unconditional document listener — ADR-0082;
  multi-instance collision is the author's concern). Lean: include `hotkey` opt-in. Left `proposed`.
- **Item/action model (F3):** role-attributed `[role=option]`/`[role=group]` children with rich inner content
  (icon + label + decorative `[data-role=shortcut]`). REJECTED native `<option>` (text-only) and bespoke
  sub-tags (commands are stateless).
- **Selection (F4):** `select {value,label,group}` + close; NEVER a command bus; NEVER imports `@agent-ui/router`.
- **A11y (F5):** combobox/listbox inside a dialog + a NEW `aria-live` result-count region; Escape is the modal's
  single path (ADR-0045).
- **Catalog (F8):** permanent exclusion, argued (app-owner launcher chrome) — not defaulted.
- **Fenced v1 non-goals:** recents (F6, consumer-fed), async/provider results + match highlighting (F7),
  drill-down sub-palettes, fuzzy matching, a `ui-command-group` sub-tag, a non-dismissable `persistent` palette.

**Independent doc review:** three fresh-context `doc-reviewer` seats (ADR / SPEC / LLD), pre-armed on the
blockquote house style. All THREE returned **FIX-THEN-SHIP, zero blockers**. The LLD **frozen-interface check
PASSED** — every named fleet API (`emit`/`listen`/`effect`-teardown/`prop.*`/`UIModalElement`+child-move/
`scrollFade`/combo-box active-descendant methods/`avatar.ts:25`) verified EXACT against shipped source; no
invented API, no value-vs-accessor mismatch. **Findings applied:** ADR (F8 citation re-homed to ADR-0125 with
cl.6 as class analogy · "third→fourth" member count · dangling `persistent` cross-ref · drill-down non-goal);
SPEC (M1 label/filter excludes the decorative shortcut · M2 "reflected" scoped to `open` only · M3
`[data-role=group-label]` made normative · M4 list `role=listbox` made normative + AC · M5 select-close emits
only `select` · N1 wrap-boundary AC · N2 R10 contingency-on-F2 note · R12 `open`-event erratum removed); LLD
(MAJOR author empty-slot visibility gap fixed in `#filter` + `[data-role=empty]` detector · `#labelText` helper
added for M1 · `#setActive` lazy-id guard · teardown note re-homed to the reactive kernel).

**Ready to build on ADR-0125 ratification.** Build seat = `component-builder` (LLD-C1…C15/C17/C18) + an
`a2ui-builder` slice for LLD-C16 (the `EXCLUSION_ALLOWLIST` entry) after the descriptor ships. Constraints held:
no tokens.css / no `site/lib/__fixtures__/` touched; ROLE-level colors only; docs-only, no code, no commits.

### 2026-07-11 — ticket closed (status housekeeping)
ui-command-modal SHIPPED 2026-07-11 — `3a3458f` (ADR-0125 accepted; TKT-0017's fixed frame folded in pre-ship); later gained filter='regex' (ADR-0127, `4ee53ee`) and the TKT-0019 two-line option display (`ce92d56`). This entry repairs the ticket's stale `open` status found at the post-goal sweep — the build Findings above predate the ship commits.
