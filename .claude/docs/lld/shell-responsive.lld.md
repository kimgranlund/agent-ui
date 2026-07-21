# LLD — Shell responsive system (GH #170)

> Status: proposed · v0.1 · 2026-07-20 · Layer: LLD (implementation plan)
> Implements: [`../spec/shell-archetypes-m5.spec.md`](../spec/shell-archetypes-m5.spec.md) §9
> (SPEC-R8/R9/R10, AC13–AC18). Refines
> [ADR-0155](../adr/0155-shell-responsive-band-ladder-toggle-law-scrollbar-seam.md) (proposed —
> **the build is gated on Kim ratifying it; nothing here dispatches before that flip**).
> Composes on: [`shell-archetypes-m5.lld.md`](./shell-archetypes-m5.lld.md) (LLD-C4 logical
> direction · LLD-C7 shared breakpoint) ·
> [`agent-admin-shell-rehost.lld.md`](./agent-admin-shell-rehost.lld.md) (the R7c survival
> trip-wire shape this extends). Decompose:
> [`../decompositions/shell-responsive-system.decomp.json`](../decompositions/shell-responsive-system.decomp.json)
> (nodes n2–n14 map 1:1 onto the components below; coverage mechanically clean).
> Altitude: owns HOW; behavior is the SPEC's. Sequencing: this branch stacks on PR #175
> (`build-52-shell-grammar-rehost`) and does NOT contain main's GH #166 menu fix (merge
> `181dad9`) — no file overlap, but the build lands after #175 merges and reads main's `menu.css`
> as the seam reference.

## 1. Component map (LLD-C# → decomp node → files)

| LLD-C | Component | Node | Files |
|---|---|---|---|
| **LLD-C1** | Compact line + `collapse-band` | n2, n3 | `app/src/shell-breakpoint.{ts,test.ts}` · `super-shell/super-shell.{ts,css}` |
| **LLD-C2** | Toggle affordance law (presence · menu⇄X · hygiene RO · dismissal) | n4–n7 | `super-shell/super-shell.{ts,css}` |
| **LLD-C3** | Scrollbar seam + scroll-fade | n8, n9 | `super-shell/super-shell.{ts,css}` · `components/src/index.ts` (export) |
| **LLD-C4** | Preset propagation | n10 | `workspace-shell/workspace-shell.ts` · `chat-shell/chat-shell.ts` (+ descriptors) |
| **LLD-C5** | Docs-site migration | n11 | `site/pages/_page.{ts,css}` |
| **LLD-C6** | `ui-app-shell` named dispositions | n12 | `app-shell/app-shell.md` only (zero code — negative control) |
| **LLD-C7** | Gates + pin map | n13, n14 | each component's `.test.ts`/`.browser.test.ts` · the visual shard |

## 2. LLD-C1 — the compact line + `collapse-band`

- `shell-breakpoint.ts` gains `SHELL_COMPACT_BREAKPOINT_REM = 52.5` /
  `SHELL_COMPACT_BREAKPOINT`, doc-commented against ADR-0150 (the shared number) + ADR-0155;
  `shell-breakpoint.test.ts` extends its literal sweep to BOTH values (the GH #99 mechanism,
  second row).
- `super-shell.ts` props gain
  `collapseBand: { ...prop.enum(['narrow', 'compact'] as const, 'narrow'), reflect: true, attribute: 'collapse-band' }`.
- `super-shell.css`: the existing `<40rem` query keeps everything it has. A second block,
  `@container ui-super-shell (inline-size < 52.5rem)`, guarded `:scope[collapse-band='compact']`,
  carries ONLY collapse-arm-side rules — and EVERY arm inside it is scoped per side to the
  collapse arm, not just the hide rule: the `[data-side]` hide rule, the `data-narrow-open`
  overlay arms, AND the toggle glyph/scrim visibility rules are each keyed
  `:scope[collapse-band='compact'][narrow-start='collapse'] …` (mirror `narrow-end`; the
  attribute is always present since the prop reflects its default). A `stack`/`tabs` side on the
  SAME shell is untouched by this block at every selector — its line stays 40rem (SPEC-R8b/R8d),
  so between 40–52.5rem it keeps full wide behavior: no hide, no overlay `position:absolute`, no
  X glyph. The compact block must never be able to re-stack the overlay arm onto an in-flow
  stacked side — that is the exact `super-shell.css:200-209` conflict this ticket kills, one band
  up. Keep the duplication to this one block. No attribute writes from CSS — the no-clobber law
  is preserved by construction (query-only hiding, same as R4).
- Note for the builder: with `collapse-band='compact'`, in 40–52.5rem the collapse side is hidden
  and overlay-restorable; below 40rem the SAME rules apply from the narrow block — behavior is
  continuous, only the entry line moves.

## 3. LLD-C2 — the toggle law

- **Presence (SPEC-R9a).** `#compose()` computes each side's authored-content truth (its stack
  arrays are already in scope) and calls `#makeToggle(side)` only for a non-empty side. At
  narrow, CSS hides the toggle for `stack`/`tabs` sides:
  `:scope[narrow-start='stack'] [data-part='side-toggle'][data-side='start'] { display: none }`
  inside the `<40rem` NARROW query only (mirror for `end`/`tabs`) — never the compact block: a
  `stack`/`tabs` side's line is ALWAYS 40rem (SPEC-R8b/R8d), so on a `collapse-band='compact'`
  shell between 40–52.5rem that toggle stays visible with wide behavior. The click handler's
  below-line arm then only ever runs for collapse sides — delete the `tabs` no-op guard
  (unreachable) and the stack-conflict arm dies with it. (A visible `stack`/`tabs` toggle click
  at 40–52.5rem resolves through the per-side band read below: its side is above ITS line, so it
  takes the wide arm — persisted `collapsed-*`, never `data-narrow-open`.)
- **menu⇄X (SPEC-R9b).** `#makeToggle` appends TWO `ui-icon`s (`glyph="list"` `data-glyph="menu"`
  · `glyph="x"` `data-glyph="close"`), both in the leading cell. CSS: `[data-glyph='close']`
  defaults `display:none`; inside each band query,
  `:scope[data-narrow-open='start'] [data-part='side-toggle'][data-side='start'] [data-glyph='menu'] { display:none }`
  + the close-glyph inverse (mirror per side). Check the icon-only button anatomy tolerates two
  adornments where one is `display:none` — if the leading cell is a single grid cell, both icons
  share it (only one paints); verify against `button.md` at build, and if the cell rejects two
  children, fall back to swapping `glyph` from the RO + click handler (named fallback, keeps R9b's
  observable contract, loses only the zero-JS purity).
- **Band hygiene RO + ARIA truth (SPEC-R9c).** One `ResizeObserver` on the host, installed in
  `connected()` (guarded like `#resizeHandle`), disconnected in `disconnected()`. The band read
  is PER SIDE, never one shell-level boolean (SPEC-R8b — `stack`/`tabs` sides are not governed by
  `collapse-band`): `bandLineRem(side) = (narrowArm(side) === 'collapse' && collapseBand ===
  'compact') ? 52.5 : 40` — a `collapse`-arm side uses the shell's `collapse-band` line; a
  `stack`/`tabs`-arm side ALWAYS uses 40rem. `bandLinePx(side) = bandLineRem(side) * rootFontPx`
  (import both constants; `rootFontPx =
  parseFloat(getComputedStyle(document.documentElement).fontSize)`). Callback: if
  `data-narrow-open` is set and the host is NOT below the OPEN side's line → remove it; re-sync
  each toggle's `aria-expanded` against its OWN side's line
  (`#belowBandLine(side) ? (narrowOpen === side) : !collapsed[side]`). The click handler's
  `< 640` literal is replaced by the same derivation (one private `#belowBandLine(side)` helper,
  the ONLY JS band read). Attributes only — extend the survival trip-wire (agent-admin-shell-rehost
  LLD §3's `isConnected` identity assertion) across an RO-driven band round-trip.
- **Dismissal (SPEC-R9d).** `#compose()` appends `[data-part='scrim']` as the middle row's first
  child (composed once, like every part); CSS: `display:none` default; inside the band queries,
  `:scope[data-narrow-open] [data-part='scrim'] { display:block; position:absolute; inset:0; z-index:1; background: rgb(0 0 0 / 0.32) }`
  (overlay side stays `z-index:2`). Click → clear `data-narrow-open` + re-sync (the same private
  close helper the toggle uses). `keydown` Escape on the host (listen once, `connected()`) closes
  when open. Focus: on open, `pane.focus()` after setting `tabindex="-1"` on the side's innermost
  box at compose; on close, `toggle.focus()` — track the opener toggle in a private field.
  Overlay cap: `max-inline-size: calc(100cqi - var(--ui-super-shell-bar-size))` on the overlay
  arms.

## 4. LLD-C3 — the scrollbar seam

- Token block: `--ui-super-shell-scrollbar-width: none;` with the command-modal.css-shape comment
  (cite GH #166 as the reference realization).
- Rules: `scrollbar-width: var(--ui-super-shell-scrollbar-width)` on `[data-part='pane']`,
  `[data-segmented] > [data-segment][data-active]`, and `[data-part='narrow-tabs']`. No
  `::-webkit-scrollbar` leg (both shipped engines support `scrollbar-width` — the split-pane.css
  note both prior realizations cite). The overlay side inherits the pane rule (same element).
- `components/src/index.ts` exports
  `export { scrollFade, type ScrollFadeOptions } from './traits/scroll-fade.ts'` (the `paneResize`
  row's exact shape, one line above it). Descriptor/size/tree-shake gates re-run.
- `super-shell.ts` wires `scrollFade(this, { viewport: box })` for each pane box at compose and
  for each segment element of a segmented pane (the active one is the live viewport; the trait's
  own observers no-op on `display:none` boxes). The narrow-tabs strip gets the hidden bar only —
  a horizontal fade is a named optional hardening, not v1 (the trait's axis support is unverified;
  do not block the wave on it).

## 5. LLD-C4 — presets

- `workspace-shell.ts` `#compose()`: `shell.setAttribute('narrow-start', 'collapse')` +
  `shell.setAttribute('collapse-band', 'compact')` (ADR-0155 F3; update the header comment's
  "docs site's own shipped narrow UX" rationale — it flips WITH the site). `workspace-shell.md` +
  tests updated in the same change.
- `chat-shell.ts`: `'collapse-band'` joins `FORWARD_ATTRS`. Defaults untouched — agent-admin's
  640px narrow-tabs pins stay green unmodified (the negative control).

## 6. LLD-C5 — the docs-site migration

- `_page.ts` `buildThemedShell()`: `narrow-start` `'stack'` → `'collapse'`;
  `collapse-band='compact'`; the localStorage `collapsed-start` persistence stays verbatim
  (SPEC-R8's no-clobber law means narrow visits never rewrite it).
- `buildNav()`: drop `collapse="menu"` and `collapse-container="ancestor"` (the rail renders its
  wide vertical anatomy inside the pane/overlay at every band — TKT-0035's arrangement retires
  for this consumer; `ui-nav-rail` keeps the capability).
- `_page.css`: retire the `@media (max-width: 40rem)` stacked-nav arms (the `[data-site-nav]`
  scroll/`overflow-y: visible` overrides tied to the stack story); keep the site's own
  `.app-page` scroll/scrollbar rules (site-owned region, already seam-compliant).
- Header at 360px: verify the brand + Search + Theme + single menu-toggle row fits without
  overflow; if it doesn't, compact the site's OWN header content CSS (site-side only — bars never
  scroll, SPEC-R8d; the Search/Theme affordances stay present per the standing header-activation
  convention).
- Pin map (site shard): the stacked-nav-at-narrow assertions RETIRE → replaced by AC17's overlay
  probes (hidden below 52.5rem · toggle opens overlay w/ X · scrim/Escape dismiss · link
  navigates · persisted wide collapse round-trip).

## 7. LLD-C6 — `ui-app-shell` dispositions (zero code)

`app-shell.md` gains two named dispositions: (1) the fleet scrollbar seam is vacuous here — the
element owns no scroll region (regions' scroll is consumer content; verified against
app-shell.css); (2) the `app-surfaces-m4.lld.md` LLD-C11 `collapse="toggle"` Show/Hide disclosure deliberately does NOT
adopt menu⇄X — it is a region-local disclosure, not a header side toggle (ADR-0155 clause 5).
`git diff --stat` for the build shows zero hunks in `app-shell.{ts,css}`.

## 8. LLD-C7 — gates

- jsdom: prop schema (`collapse-band`), toggle presence (no end toggle without an end side —
  assert against the docs-site shape), scrim part existence, forwarding lists.
- Browser (app shard, both engines): AC13 (compact vs default at 48rem + no-clobber round-trip) ·
  AC14 (depth-2 outer-in) · AC15 (glyph/ARIA truth incl. the stale-X resize probe) · AC16
  (scrim/Escape/focus/320px cap) · AC18 (the GH #166 probe shape on pane/segment/strip + the
  token-repoint override leg) · the survival trip-wire across an RO band round-trip · the
  mixed-arm compact probe: a `collapse-band='compact'` shell with a `stack` start side, probed at
  45rem — the start toggle stays VISIBLE with wide/collapse behavior (menu glyph, not X; no
  overlay arm reachable — a click toggles persisted `collapsed-start`, never sets
  `data-narrow-open`), since 45rem is above the 40rem line that actually governs a `stack` side.
- Site shard: AC17. Visual shard: docs chrome at narrow, closed AND overlay-open — the artifact
  for Kim's sign-off (the final gate, out of agent scope by GH #170's own clause 3).
- All gates judged by exit codes, run FOREGROUND (the standing dispatch law).

## 9. Build sequence

1. ADR-0155 ratified (Kim) → 2. LLD-C1+C2+C3 in `ui-super-shell` (+ the `scrollFade` export),
own suite green cross-engine → 3. LLD-C4 presets → 4. LLD-C5 site migration + LLD-C6 descriptor
notes → 5. LLD-C7 full six-shard run + visual screenshots → 6. GH #170 Findings comment + the
handoff naming Kim's visual review as the open gate.
