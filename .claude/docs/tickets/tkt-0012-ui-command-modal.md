---
doc-type: ticket
id: tkt-0012
status: open
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
