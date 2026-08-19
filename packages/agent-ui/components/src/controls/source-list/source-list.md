---
# source-list.md frontmatter — the GENERATION SOURCE for ui-source-list's `static props` block (ADR-0173;
# ADR-0214, GH #1394 — the CONTROL-MINT half of ADR-0214's booked repairs; the catalog row/spec delta/corpus
# seed are a LATER lane). The machine-checkable public surface lives HERE (frontmatter); the prose below the
# fence is the /site doc. `source-list.props.gen.ts` is GENERATED from `attributes[]` below (`node
# scripts/generate-props.mjs source-list`); source-list.ts imports it — never hand-edit the generated file.
# `sources` is an ADR-0173 OF1 `codec:` reference — source-list is a bespoke-codec control (source-list-model.ts's
# `cleanSources`-backed PropConfig), the `descriptionRowsProp`/`tableRowsProp` shape reused verbatim. The
# fleet drift gate (descriptor/props-gen-driftwire.test.ts) keeps the descriptor and the generated file
# byte-identical.
tag: ui-source-list
description: Source attribution as one aggregate leaf — a numbered list of {href, title, snippet?} sources, index markers assigned by array position, each entry's href gated by the fleet's safe-href scheme allowlist.
tier: display          # geometry size-class (Display band — NO control frame/height/[size]/[scale]; the ui-description-list/ui-stat posture, ADR-0214 Decision cl.2 "Display-only leaf: no value mark, no action, no children")
extends: UIElement     # a non-interactive, non-form-associated display LEAF (no events, no keyboard contract of its own — the ONE exception is the platform-native link behaviour an allowed per-entry href stamps, ADR-0114 verbatim)
# marginal: measured at the ADR-0214 build wave (`npm run size`) — one render effect + one hardened JSON
# codec + the shared `../text/href.ts` scheme gate (already-paid fleet cost, no new bytes) — within the
# per-control ≤ ~2 kB tier budget (plan §10).

attributes:            # attributes-as-API — the GENERATION SOURCE for source-list.ts's `static props` (ADR-0173)
  - name: sources
    type: json          # {href:string, title:string, snippet?:string}[], JSON-string attribute form (ADR-0214 cl.2)
    default: ''         # the LIVE default is `[]` — `String([])===''` is the bijection form (the table.md/description-list.md rows precedent)
    reflect: false       # NOT reflected — a JSON-string attribute round-trips through the codec, not setAttribute
    codec: { import: './source-list-model.ts', name: 'sourcesProp' }  # ADR-0173 OF1 — the ADR-0214 cl.2 safe codec (from(null)=[], malformed JSON also falls back to [], never throws); cleanSources drops any entry without a real title BY CONSTRUCTION — the drop-malformed-entries cleaner (GH #1394). A malformed/absent href degrades to '' (the safeHref gate's own denial) rather than dropping the entry: cl.2's degrade renders the title as plain text, attribution kept, link stripped.
    description: The source entries — index markers are the array POSITION (1-based), never producer-authored, so marker↔row drift is unrepresentable by construction (ADR-0214 Context fact 1).

properties: []         # no manual accessors beyond the one typed prop

events: []             # display-only — emits nothing (no events; the platform-native link click on an allowed href is not a component event)

slots: []              # no light-DOM content model — every child is control-built (createElement + replaceChildren), never author-slotted (the ui-description-list/ui-stat shape)

parts:                  # data-part nodes the render effect builds (selected by source-list.css)
  - name: row
    description: One `<div data-part="row" role="listitem">` per SURVIVING entry — the positional index marker, the gated title, and an optional snippet, in that DOM order (ADR-0214 cl.3's anatomy floor).
  - name: index
    description: The `<span data-part="index">` — the positional marker (1-based array index, never a producer-authored field), so "[2]" always means the second surviving source.
  - name: title
    description: The entry's title — a real `<a data-part="title" href rel target>` when the entry's href crosses the `safeHref` scheme gate (`../text/href.ts`, ADR-0114 verbatim), or a plain `<span data-part="title">` when the href is denied/empty (ADR-0214 cl.2's degrade — attribution survives, the link does not, never an announced-broken anchor).
  - name: snippet
    description: The optional `<span data-part="snippet">` — muted supporting text, present only when the entry's `snippet` field is a non-empty string.

customStates: []       # NO interaction state and NO motion gate — a static attribution receipt has neither

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  role: list             # minted via ElementInternals on the HOST (never a host role attribute) — Context fact 4: role=list is free here (unlike ui-description-list's rejected role=list for label/value pairs, a numbered source list genuinely IS a list of items)
  roleSource: internals-role  # the ui-timeline/ui-list precedent (constructor placement, semantics before insertion); each built row separately carries its own real `role="listitem"` attribute (a plain light-DOM child — ElementInternals applies to the ONE host element only)
  labelSource: real-text  # the list's WHOLE meaning is real, selectable DOM text in reading order — index, title, snippet, row by row (DOM order); nothing silent to name

keyboard:              # NOT interactive/focusable except the ONE per-entry exception (ADR-0114, platform-native, not re-implemented)
  - note: an entry whose href is ALLOWED by the safeHref gate — the stamped <a> is a native tab stop; Enter activates it like any link (platform behaviour, not a component keyboard contract)
  - note: an entry whose href is DENIED or empty — NOT a tab stop (no href attribute on the plain-text <span> title — the same non-interactive posture as every other part)
  - note: the row/index/snippet parts are never focusable — no tabindex, no tabbable trait

geometry:
  sizeClass: display
  rowGap: var(--ui-source-list-row-gap)          # between source rows — --md-sys-space ladder, density-responsive
  indexGap: var(--ui-source-list-index-gap)      # index marker → title — --md-sys-space ladder
  # NO [size] attribute, NO [scale] geometry row, NO --md-sys-height-* consumption — the levers are the
  # type matrix (--md-sys-typescale-*) + the space ladder (the Display-band law, the ui-description-list precedent).

forcedColors: No dedicated block beyond the shared link treatment — every part is real text (only a background-drawn shape needs a forced-colors repoint); an allowed title link additionally paints the system LinkText ink under forced-colors (the ui-text ADR-0114 precedent, SPEC-R13 AC2), underline intact.
---

# ui-source-list

`ui-source-list` is the **source-attribution aggregate leaf** (ADR-0214, GH #1394): a Display-class leaf
that renders a numbered list of cited sources — the core agentic-trust pattern for a grounded answer. It is
**not** form-associated, emits no events, and takes no focus except the platform-native link behaviour an
allowed per-entry `href` stamps.

```html
<ui-source-list
  sources='[
    {"href":"https://example.com/report","title":"Q3 Market Report","snippet":"Revenue grew 12% year over year."},
    {"href":"javascript:alert(1)","title":"An untrusted source"},
    {"href":"https://example.com/notes","title":"Internal notes"}
  ]'
></ui-source-list>
```

> **An A2UI catalog type.** `ui-source-list` renders the catalog's `SourceList` type (ADR-0214) — the
> canonical source-attribution card for a grounded, cited answer. Reach for it whenever a flow presents the
> evidence behind a claim; reach for `ui-description-list` instead for a plain key–value receipt with no
> hyperlink semantics.

## Sources are data

`sources` is a hardened JSON array prop — `{ href: string, title: string, snippet?: string }[]` — the
`ui-description-list`/`ui-table` codec shape verbatim: an absent attribute or malformed JSON yields `[]`,
never a throw. Sources are **data, not children**: the list is rendered whole, so the component builds its
own DOM (whole-swap per change, the `ui-description-list` shape) and imposes no child element.

### Index markers are POSITIONAL — by construction

There is **no producer-authored `index`**. Every marker is the source's 1-based position in the surviving
array — "[2]" always means the second surviving source. This makes marker↔row drift structurally
unrepresentable: a composed alternative (a `List` of `Card`s with independently-authored index literals)
cannot make this guarantee (ADR-0214 Context fact 1).

### The drop-malformed-entries cleaner — by construction

An entry with no real title **never renders**: the hardening drops any entry that is not a plain object, or
whose `title` is absent, `null`, or an empty/whitespace-only string — on the attribute path (codec) *and*
on the property path (the render effect re-hardens) — so a titleless entry is unrepresentable, not merely
discouraged. A malformed or absent `href` does **not** drop the entry — it degrades to `''`, which the
per-entry `safeHref` gate denies the same as any other bad value (see below); the title still renders, as
plain text.

## The per-entry `safeHref` gate

Each entry's `href` crosses the fleet's fail-closed scheme allowlist (`../text/href.ts`'s `safeHref`,
ADR-0114 verbatim: `https:` / `http:` / `mailto:`, resolved against `document.baseURI`). **The static
validator's `format: 'safe-href'` leg does not descend into array items** — this component-side gate is the
**sole enforcement point** for a per-entry href, not a belt-and-braces extra (ADR-0214 Context fact 2).

- **Allowed** → the title renders as a real `<a href rel="noopener noreferrer" target="_blank">`, the value
  applied byte-identical (the gate never rewrites).
- **Denied or empty** → the title renders as a plain `<span>` — attribution survives, the link does not.
  Never an announced-broken anchor (no `href` attribute at all, so assistive tech never reports a link that
  goes nowhere).

## Accessibility

The host carries `role="list"` (via `ElementInternals`, never a host attribute) — Context fact 4 rules this
IN for a numbered source list (unlike `ui-description-list`'s rejected `role=list` for label/value pairs,
where "list, N items" for N pairs would mislead). Each built row separately carries a real
`role="listitem"` attribute. The whole meaning is real, selectable text in reading order: index → title →
snippet, row by row, DOM order.
