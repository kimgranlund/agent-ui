---
# icon.md frontmatter — the attributes-as-API descriptor for ui-icon (ADR-0004 / ADR-0065 / ADR-0066).
# The machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site
# doc. The `attributes[]` block MUST mirror icon.ts `static props` (name/label) — the contract↔props
# trip-wire (icon-descriptor.test.ts) targets this fence. Field set per .claude/docs/plan.md §10 / ADR-0004.
tag: ui-icon
tier: display          # geometry size-class (Display band — NO control frame/height; geometry.md lists "icon" as a Display example)
extends: UIElement     # a non-interactive display LEAF — NOT form-associated (face below), NOT a UIContainerElement surface
# marginal: ui-icon adds 513 B gz (1546 B min) to the self-defining ui-* family (the delta of `npm run size`'s components barrel with vs. without ui-icon's export — it + the @agent-ui/icons resolve/registry/types path it pulls in, zero Phosphor bytes — subpath-only) — within budget: family total 22193 B gz / 22528 B gz (scripts/measure-size.mjs); the family total stays gated each run.

attributes:            # attributes-as-API — mirrors icon.ts `static props` (name, label)
  - name: glyph
    type: string
    default: ''
    reflect: false     # NOT reflected — an empty name clears the host; a set name re-resolves via setIcon() (@agent-ui/icons). Deliberately a plain string, not an enum: a consumer's own pack can register names beyond the shipped nine (ADR-0065 clause 5)
  - name: label
    type: string
    default: ''
    reflect: true       # TKT-0069 item 2 ruling: label reflects fleet-wide

properties: []         # no manual accessors beyond the two typed props

events: []             # display-only — emits nothing (not interactive)

slots: []              # no light-DOM content model — render() stays the inherited no-op; the ONLY child is the control-injected <svg> (setIcon/resolveIcon, @agent-ui/icons), never author-slotted content

parts: []              # no data-part parts — the injected svg is selected by tag (icon.css `:scope svg`), not a named part

customStates: []       # NO interaction state and NO motion gate — a display leaf has neither (no :state(ready); there is nothing to transition)

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  role: img              # role=img ONLY when `label` is non-empty (meaningful icon); decorative (aria-hidden) otherwise — no implicit role
  roleSource: internals  # a reactive connected() effect off `label` sets internals.role/.ariaLabel/.ariaHidden — NEVER a host role/aria-*/aria-hidden attribute (the FACE pattern)
  labelSource: label prop  # `label` (non-empty) IS the accessible name (internals.ariaLabel); a decorative icon (label='') has none and is aria-hidden

keyboard: []           # NOT interactive and NOT focusable — no tabindex, no `tabbable` trait, no keyboard contract

geometry:
  sizeClass: display
  inlineSize: var(--ui-icon-size)   # 1em — NO size/tone lever (no [size] ramp); the consumer's ambient font-size or an explicit inline-size override IS the lever (LLD §3, geometry.md "intrinsic structural sizing")
  blockSize: var(--ui-icon-size)

forcedColors: No dedicated `@media (forced-colors: active)` block — the host paints nothing of its own; `color: inherit` means the injected `<svg fill="currentColor">` (resolve.ts) tracks whatever forced-colors ink the CONSUMING context already resolves to (e.g. a button's ButtonText), so ui-icon needs no WHCM override of its own.
---

# ui-icon

`ui-icon` is the **Display**-class icon primitive — the declarative consumer surface over the
`@agent-ui/icons` adapter (ADR-0065/0066). It is **not** interactive and **not** form-associated: it
carries no value, no focus, and no keyboard contract. Given a canonical icon `name`, it resolves the
active pack's SVG body and injects it as its only child.

```html
<ui-icon glyph="caret-down"></ui-icon>
<ui-icon glyph="eye-slash" label="Hide password"></ui-icon>
<ui-icon glyph="calendar-blank" style="font-size: 1.5rem"></ui-icon>
```

## Resolution

`name` is a plain string (not a closed enum) resolved through `@agent-ui/icons`' active pack —
`setIcon(this, name)` on every change; an empty `name` clears the host. An unregistered name resolves to
a non-throwing empty `<svg data-icon-missing>` rather than breaking the render (`resolveIcon`,
`@agent-ui/icons`). The shipped default is the Phosphor pack (`@agent-ui/icons/phosphor`), covering the
current `ICON_NAMES` set (`@agent-ui/icons/src/types.ts` — the source of truth; twenty names as of the
feed-family wave's LLD-C9 icons PREP, spanning caret/chevron · dismissal/visibility · calendar/check ·
search · and the file-type glyphs `user`/`file`/`file-image`/`file-audio`/`file-video`/`file-pdf`/
`file-text`/`file-zip`/`file-code`). A consuming app can register its own pack, or override individual
icons, with zero changes to `ui-icon` itself (`registerPack`/`overrideIcon`, ADR-0065 clause 5).

**Live pack-swap reactivity is deferred** (ADR-0065 clause 4): an already-rendered `<ui-icon>` does not
auto-update if a pack is swapped *after* it renders — re-setting `name` (or an app restart) reflects the
swap. The normal case is registering a pack once at startup, before first render.

## Sizing

The host is a `1em × 1em` cell by default (`--ui-icon-size`) — there is no size ramp or lever. A consumer
sizes an icon via ambient `font-size` (the common case, matching surrounding text) or an explicit
`inline-size`/`block-size` override on the host. `color: inherit` means the icon's ink (the injected
`<svg fill="currentColor">`) always tracks the surrounding context with no per-icon color plumbing.

## Accessibility

`ui-icon` is **decorative by default** (`aria-hidden`, no role) — the common case for an icon that
accompanies its own visible/labelled text (e.g. inside a button). Supplying a non-empty `label` makes it
**meaningful**: `role="img"` + `aria-label` (via `ElementInternals`, never a host attribute), and
`aria-hidden` is cleared. Use `label` only for an icon that is itself the sole accessible content (e.g. an
icon-only button's child) — an icon alongside its own text label should stay decorative so the
surrounding text remains the single accessible name.
