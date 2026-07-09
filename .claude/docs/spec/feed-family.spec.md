# SPEC — Feed / Agent-Activity Family (`ui-progress` + `ui-avatar` + `ui-attachment` + `ui-toast`/`ui-toast-region` + catalog surface)

> Status: proposed · v0.1 · 2026-07-08 · Layer: SPEC (execution contract)
> Refines: [`../prd/feed-family.prd.md`](../prd/feed-family.prd.md) — **PRD-G1, PRD-G2, PRD-G3, PRD-G4** — under the ratified scope + contract directions of [ADR-0112](../adr/0112-feed-family-v1-scope.md) (accepted 2026-07-09; forks F1–F4 as recommended). Every clause of ADR-0112 is binding here; this SPEC adds the behavior contract, it re-litigates nothing. The attachment link leg additionally binds to [ADR-0114](../adr/0114-text-hyperlink-href.md) (accepted) **by reference** — its scheme-gate policy is cited, never restated (SPEC-R11).
> Refined by: [`../lld/feed-family.lld.md`](../lld/feed-family.lld.md). Build plan: [`../decompositions/feed-family-build.decomp.json`](../decompositions/feed-family-build.decomp.json) (coverage-clean, plan+strict).
> Altitude: owns **what the five components do and how they behave at every boundary** + the family's catalog/allowlist/partition contract. Implementation (exact tokens, timer mechanics, file layout, CSS) is the LLD's. The catalog surface (`a2ui-catalog.spec.md` §5.2) stays the normative coverage home, cross-referenced.
> Requirement IDs file-scoped (`SPEC-R1…`); cross-document references qualify by doc name.

---

## 1. Purpose

Contract the v1 feed/agent-activity family ADR-0112 admits: `ui-progress` (bar-only task progress),
`ui-avatar` (compact identity mark), `ui-attachment` (FilePart-aligned file card) — three Display-tier
types entering the default catalog same-wave — plus `ui-toast`/`ui-toast-region` (the fleet's first
transient notification surface), deliberately **not** catalogued: the ADR-0087 allowlist's first
permanent, reasoned residents. The PRD §3 fence stands: rings/buffers/steps, avatar
groups/presence/hue-identity, attachment previews/uploads, toast queues/action-arrays/static
singletons, and any TaskState code coupling are out of this SPEC's normative reach.

## 2. Definitions

- **Determinate / indeterminate** — a progress bar with a real fraction (`value` present and finite) vs. one that only says "working" (`value` absent/null) — the native `<progress>` semantic, one prop, no boolean to desync.
- **Effective value / effective max** — the post-hardening pair rendering AND announcement derive from (SPEC-R1's table), never the raw props.
- **Fallback chain** — the avatar's ordered rendering: `src` image → initials from `name` → the person glyph. Exactly one link renders at a time.
- **File category** — the 8-way mimeType classification (`image · audio · video · pdf · text · archive · data · default`) driving the attachment glyph and the name fallback.
- **Actionable toast** — a toast whose `action` prop is non-empty. Actionable ⇒ never auto-dismissed (SPEC-R16 — WCAG 2.2.1 made structural).
- **The region** — the single `ui-toast-region` element hosting toasts in the platform top layer via `popover=manual` (fork F1).

## 3. Requirements

Normative per RFC 2119; each carries an ID, PRD trace, and acceptance criteria.

### 3.1 `ui-progress`

**SPEC-R1 — Component contract & value model.** `ui-progress` MUST be a Display-class, non-interactive, non-form-associated leaf (`UIElement`; no events, no keyboard contract, no children content model) with exactly three props: `value` (`number | null`, default `null`), `max` (`number`, default `100` — the ARIA progressbar default, percent-natural for `{"component":"Progress","value":42}`), and `label` (`string`, default `''` — the accessible name). `value === null` ⇒ **indeterminate**. Hardening — all behavior derives from the effective pair; no case may throw:

| Input | Effective state |
|---|---|
| `value` absent / `null` / non-finite (`NaN`, `±Infinity`) / non-numeric attribute | indeterminate |
| `value < 0` | determinate, clamped to `0` |
| `value > max` | determinate, clamped to `max` |
| `max` non-finite, `≤ 0`, or malformed | `max` = `100` (the default), `value` still clamped against it |

*(→ PRD-G1, PRD-G2; ADR-0112 cl.2)*
- **AC1** *Given* `<ui-progress value="42">`, *then* determinate at 42/100; *given* `<ui-progress>` (no value), *then* indeterminate — no separate boolean prop exists.
- **AC2** *Given* each hardening row (property and attribute forms), *then* the stated effective state, no exception, and the host still paints (SPEC-R18 floor).
- **AC3** *Given* the descriptor (`progress.md`), *then* `tier: display`, `events: []`, attributes mirror `static props`.

**SPEC-R2 — Rendering: determinate fill, indeterminate sweep, reduced motion.** The mark is a thin horizontal rail: a full-width **track** and a **fill** whose inline-size is `effectiveValue / effectiveMax` of the track when determinate. Indeterminate MUST render a visibly-animated sweep (a partial-width fill translating along the track) so "working" is distinguishable from both `0%` and `100%` at a glance. Under `prefers-reduced-motion: reduce` the sweep's translation MUST be replaced by a motion-free alternative (a stationary partial fill with a slow opacity pulse — no translation, no scaling) that remains visually distinct from any determinate state. Bar direction follows the writing direction (fill grows from inline-start — logical CSS). *(→ PRD-G1, PRD-G2; ADR-0112 cl.2)*
- **AC1** *Given* `value=25 max=100`, *then* the fill's measured inline-size is within ε of 25% of the track's (browser leg).
- **AC2** *Given* indeterminate, *then* a translation animation runs on the fill; *given* `prefers-reduced-motion: reduce` emulation, *then* computed style shows no translation animation and the indeterminate mark still differs from a static determinate fill.
- **AC3** *Given* `dir="rtl"`, *then* the determinate fill grows from the inline-start (right) edge (browser leg).

**SPEC-R3 — A11y: always announced (the chart inversion holds).** Progress is status data, never decoration: via `ElementInternals` (never host attributes) the host is **always** `role=progressbar` — never `aria-hidden`, no silent state. Determinate: `ariaValueMin = "0"`, `ariaValueMax = String(effectiveMax)`, `ariaValueNow = String(effectiveValue)`, and `ariaValueText` = the percent reading (`Intl.NumberFormat` percent over `effectiveValue/effectiveMax`, default locale). Indeterminate: `ariaValueNow` and `ariaValueText` are **absent** (`null`) — the ARIA-native indeterminate signal — while role/min/max persist. The accessible name comes from `label` when non-empty. *(→ PRD-G2; ADR-0112 cl.2)*
- **AC1** *Given* `value=42 label="Indexing"`, *then* `internals.role === 'progressbar'`, `ariaValueNow === '42'`, `ariaValueText === '42%'`, `ariaLabel === 'Indexing'`.
- **AC2** *Given* value removed at runtime, *then* `ariaValueNow` and `ariaValueText` become `null` while role/min/max persist — and back again when a value returns.

*(TaskState pairing is catalog guidance only — SPEC-R22; no `@agent-ui/a2a` import exists anywhere in this family — SPEC-N6.)*

### 3.2 `ui-avatar`

**SPEC-R4 — Component contract.** `ui-avatar` MUST be a non-interactive, non-form-associated leaf with exactly four props: `src` (`string`, default `''` — image URL), `name` (`string`, default `''` — the identity whose initials the fallback derives; NOT announced by default), `label` (`string`, default `''` — the a11y escape hatch, SPEC-R6), and `size` (`'sm' | 'md' | 'lg'`, default `'md'` — the Indicator-class widget-box lever, fork F3/SPEC-R20). *(→ PRD-G1; ADR-0112 cl.3)*
- **AC1** *Given* the descriptor (`avatar.md`), *then* the attributes block mirrors `static props` and `events: []`.

**SPEC-R5 — The fallback chain.** Rendering walks `src` image → initials → person glyph; exactly one link renders; **never a broken-image box, never silent-empty** (the document-row glyph defect is the counter-example). Required transitions: a `src` load error falls back to initials (or glyph when `name` is empty) without a broken-image frame ever painting as the final state; setting a new `src` after a failure re-attempts the image; clearing `src` falls back immediately. Initials derive from `name` by a pure, grapheme-safe function: first grapheme of the first word + first grapheme of the last word (a single word yields one grapheme), locale-uppercased; empty/whitespace `name` skips to the glyph. The glyph is the vendored person icon through the icon adapter (SPEC-N5 — the icons prerequisite). *(→ PRD-G1, PRD-G2; ADR-0112 cl.3)*
- **AC1** *Given* a `src` that errors, `name="Ada Lovelace"`, *then* the rendered content is the initials `AL` — no `<img>` remains in the final state.
- **AC2** *Given* no `src` and no `name`, *then* the person glyph renders — the host is never empty.
- **AC3** *Given* the initials unit rows (multi-word, single word, grapheme clusters e.g. emoji/combining marks, whitespace-only), *then* the pinned derivations hold (the pure function is unit-tested DOM-free).

**SPEC-R6 — A11y: decorative by default, `label` opts in.** The ADR-0065 cl.4 decorative default HOLDS (a feed avatar sits beside a visible name — announcing it duplicates the name). Default: `internals.ariaHidden = 'true'`, no role; any internal `<img>` carries empty-alt semantics. Non-empty `label` ⇒ `internals.role = 'img'` + `internals.ariaLabel = label` + `ariaHidden` cleared — the `ui-icon` contract shape, one fleet idiom. A label-less avatar beside no name announces nothing **by contract** (author error; the descriptor MUST say so). *(→ PRD-G2; ADR-0112 cl.3)*
- **AC1** *Given* default props, *then* `internals.ariaHidden === 'true'` and no role; *given* `label="Ada Lovelace"`, *then* `role === 'img'`, `ariaLabel` set, `ariaHidden` cleared.

**SPEC-R7 — Identity surface: one neutral pair, no hue identity.** The fallback surface (initials and glyph states) is ONE neutral plane + on-surface ink pair — AA-verifiable once; hash-picked per-identity hues are forbidden (ADR-0057 hue-only signifier + the unbounded AA matrix; the curated accent-pair palette is the named foreseen extension). The mask is a circle. Identity is carried by the initials/name text, never by color. *(→ PRD-G2; ADR-0112 cl.3)*
- **AC1** *Given* two avatars with different `name`s, *then* their fallback planes compute identical colors; the initials text ≥ AA against the plane (token probe).

### 3.3 `ui-attachment`

**SPEC-R8 — Component contract (FilePart-aligned).** `ui-attachment` MUST be a Display-class, non-form-associated compact file card with exactly four props mirroring the wire where the wire speaks (`A2aFilePart`, `a2a/src/protocol/types.ts:55-74` — alignment by shape, never by import): `name` (`string`, default `''` — optional on the wire), `mimeType` (`string`, default `''`), `sizeBytes` (`number | null`, default `null`, HTML attribute `size-bytes` — renamed from `size` at build, ADR-0112 Amendment 1, since the fleet reserves a literal `size` attribute for the widget-tier `[sm,md,lg]` geometry enum — **deliberately NOT a wire field**: `A2aFilePart` carries none; it is embedder-supplied, e.g. computed from decoded bytes — the descriptor says so, so no one "fixes" the wire alignment later), and `href` (`string`, default `''` — SPEC-R11). Empty `name` ⇒ the title falls back to the file category's label (never an empty title). `sizeBytes` `null`/non-finite/negative ⇒ the size cell is absent. *(→ PRD-G1, PRD-G4; ADR-0112 cl.4/Amendment 1)*
- **AC1** *Given* `{name:"report.pdf", mimeType:"application/pdf", size:48200}`, *then* the card renders title "report.pdf", the pdf-category glyph, and a formatted size.
- **AC2** *Given* no `name` and `mimeType="image/png"`, *then* the title is the image category label — never empty; *given* `size` absent, *then* no size cell renders.

**SPEC-R9 — Rendering: glyph derivation, size formatting, truncation, posture.** MimeType → category is a pure DOM-free module (unit-testable; the ADR-0107 cl.3 precedent): case-insensitive, parameters stripped, the 8 categories of §2, unknown/empty → `default`; the category resolves to a vendored file glyph through the icon adapter. `size` (bytes) formats through a pure module (`Intl.NumberFormat`, default locale, ≤ 1 fraction digit, B/KB/MB/GB/TB decimal steps). The name cell renders single-line with ellipsis truncation (the ADR-0106 CSS-only mechanism, cited — its home use); the full name remains the accessible/selectable text. Posture (fork F4): a compact card with its **own bordered surface** (`--ui-radius-base`, the entry/container radius kin), one-row anatomy `glyph | name+meta`, composable N-up in a `Row(wrap)` or as `ui-list` children (list semantics stay in `ui-list`, never baked in). *(→ PRD-G1, PRD-G2; ADR-0112 cl.4)*
- **AC1** *Given* the mime unit rows (`image/*`, `audio/*`, `video/*`, `application/pdf`, `text/*`, archive types, data types incl. `text/csv`→data, unknown, empty, `"IMAGE/PNG; charset=x"`), *then* the pinned categories hold.
- **AC2** *Given* the byte rows (`0`, `999`, `48200`, `5_300_000`, `null`, `NaN`, `-1`), *then* the pinned formatted strings / absent-cell results hold.
- **AC3** *Given* a long name in a narrow container, *then* the name shows single-line ellipsis and the card never grows past its container (browser leg).

**SPEC-R10 — A11y: the name text is the accessible datum.** The glyph is decorative (`aria-hidden` — it repeats the category the name/mime already carry); the host takes no ARIA role by default (real text children read naturally — the bar-chart printed-value posture); the title and size are real DOM text. When the link leg is active (SPEC-R11) the name is a native `<a>` and announces as a link — the platform's own semantics, no synthetic role. *(→ PRD-G2; ADR-0112 cl.4)*
- **AC1** *Given* a rendered card, *then* the glyph node carries `aria-hidden` and the name+size are text nodes an AT walk reads without any component ARIA.

**SPEC-R11 — The `href` leg: ADR-0114's gate, reused by reference.** When `href` is non-empty, the name cell MUST render as a native `<a>` under **exactly** the ADR-0114 cl.2/cl.4 ruling, consumed as a **shared implementation** — one gate module, one policy site, never a restated copy: the value parses against `document.baseURI`; the resolved scheme must be in ADR-0114's allowlist (`https:` · `http:` · `mailto:` — owned there; widening is an ADR-0114 amendment, never a feed-family edit); denied or unparseable ⇒ the `<a>` **never receives an `href` attribute** (text intact, not exposed as a link — capability denied, content never destroyed); allowed ⇒ the anchor carries the fixed `rel="noopener noreferrer"` + `target="_blank"` policy. Empty `href` ⇒ a plain text node, no anchor. The gate covers attribute, property, and bound writes identically (the component is the last line — ADR-0114 cl.3's defense-in-depth stands for `Attachment.href` exactly as for `Text.href`, including the validator first line over static literals). *(→ PRD-G1, PRD-G4; ADR-0112 cl.4; ADR-0114 cl.2/3/4)*
- **AC1** *Given* `href="https://example.com/report.pdf"`, *then* the name is an `<a>` with that href + `rel="noopener noreferrer"` + `target="_blank"`.
- **AC2** *Given* `href="javascript:alert(1)"` (and a `data:` and an unparseable value), *then* no `href` attribute exists on the stamped anchor, the name text renders, and no link is announced or navigable (browser negative control, both engines).
- **AC3** *Given* the shared gate module, *then* grep proves a single URL-parse/allowlist site consumed by both `ui-text` and `ui-attachment` — no second policy copy.

### 3.4 `ui-toast` + `ui-toast-region`

**SPEC-R12 — The region: `popover=manual` top layer.** `ui-toast-region` MUST host toasts in the platform top layer via `popover=manual` (fork F1 — no anchor, no light-dismiss, concurrent-open legal; deliberately NOT the ADR-0043/0045 overlay controller, whose anchored-placement/light-dismiss/focus-restore bundle is wrong on all three counts for a toast; not `position:fixed`, which loses to top-layer content — ADR-0102's deterministic wrong rendering). The region promotes itself when it holds ≥ 1 toast and demotes (hides) when its last toast leaves; while empty it MUST NOT intercept pointer events anywhere. A toast **shown while a modal `<dialog>` is open** MUST paint above it (the region re-asserts top-layer order on each show — mechanism is LLD business). Placement: a viewport corner inset by tokens (default block-end/inline-end); v1 exposes **no placement prop** (tokens are the page's override; a placement prop is a foreseen extension). Toasts stack inside in normal flow, newest nearest the inset edge, CSS-only column + gap. *(→ PRD-G3; ADR-0112 cl.5)*
- **AC1** *Given* `region.show(…)`, *then* the region is `:popover-open` in the top layer; *given* the last toast closes, *then* the region is hidden and `elementsFromPoint` at its former rect no longer returns it.
- **AC2** *Given* an open `ui-modal` (`showModal()`), *when* a toast is shown, *then* the toast is visible above the dialog (top-layer browser leg, both engines — `elementsFromPoint` at the toast's rect returns the toast, not the dialog).
- **AC3** *Given* two shows, *then* both toasts render stacked with the token gap, in normal flow inside the region.

**SPEC-R13 — Ownership & API: declarative region + instance `show()`, no singleton.** The region is a declarative element the page or app composes (the modal precedent: an element you place, not a service you summon — fork F2); **no static/global `show()` exists** (ADR-0082's no-shared-global-state law; two shells must never fight over one region). `region.show(options)` — the sanctioned imperative seam (the `mount()` precedent) — creates, appends, and **returns** the `ui-toast` element; `options`: `{ message: string; urgent?: boolean; duration?: number; action?: string }`, with a bare-string shorthand for `message`. Declarative `<ui-toast>` children are equally legal. Message content is set before insertion (announcement-correct — SPEC-R15). Who mounts the region — including whether the app-shell composes a default — is the LLD's recorded ruling. *(→ PRD-G3; ADR-0112 cl.5, fork F2)*
- **AC1** *Given* `const t = region.show('Export finished')`, *then* `t instanceof UIToastElement`, `t.isConnected`, and its text is the message.
- **AC2** *Given* the public API surface, *then* no static show/singleton region exists (API review + test asserting two regions operate independently).

**SPEC-R14 — Toast contract.** `ui-toast` MUST carry exactly three props: `urgent` (`boolean`, default `false` — presence-boolean, SPEC-R15), `duration` (`number`, default `6000` ms; `≤ 0` or non-finite ⇒ never auto-dismiss), `action` (`string`, default `''` — the label of the at-most-one action button; non-empty makes the toast actionable). Light-DOM children are the message. The component builds its affordances: the optional action button (labelled by `action`) and an always-present close button (accessible name "Dismiss" — the fleet's stated English-only limitation). Events (fleet vocabulary, nothing new): activating the action dispatches **`select`** then closes; any dismissal (close button, `close()` method, timer expiry) dispatches **`close`** exactly once, after which the toast removes itself from the DOM. *(→ PRD-G3; ADR-0112 cl.5)*
- **AC1** *Given* an actionable toast, *when* the action button is activated, *then* one `select` then one `close` fire and the element is removed.
- **AC2** *Given* the close button (or `close()`), *then* one `close` fires, the element is removed, and — when it was the last — the region hides (SPEC-R12 AC1).
- **AC3** *Given* the descriptor (`toast.md`), *then* events list exactly `select` + `close`; attributes mirror `static props`.

**SPEC-R15 — A11y: announced, never interrupting.** Each toast carries **`role=status`** via internals (polite), set **before insertion** so the live-region semantics exist when content lands; `urgent` opts into **`role=alert`** (assertive — failures that warrant interruption). Showing a toast MUST NOT move focus (`document.activeElement` unchanged — the ADR-0020 interruption-inversion prior art); the action and close affordances are reachable in normal tab order while the toast is present (the region takes no focus trap, no autofocus, no tabindex games). *(→ PRD-G3; ADR-0112 cl.5)*
- **AC1** *Given* focus in a text field, *when* `region.show(…)` fires, *then* `document.activeElement` is unchanged (browser probe, both engines).
- **AC2** *Given* default props, *then* `internals.role === 'status'` at insertion time; *given* `urgent`, *then* `'alert'` — probes read internals directly (locators are blind to internals-only ARIA — the tabs precedent).
- **AC3** *Given* a visible toast, *then* Tab reaches its action (when present) then its close button in DOM order.

**SPEC-R16 — Timing: humane pauses, actionable never expires.** A non-actionable toast auto-dismisses when its `duration` elapses. The countdown MUST pause while the toast is hovered **or** has focus within (the reader/magnifier case) and resume with **remaining-time accounting** (never a restart). An **actionable toast never auto-dismisses** — WCAG 2.2.1 timing-adjustable made structural: an offered action waits to be dismissed (the deliberate consequence: an unattended "undo" toast persists — expiring an offered action under the user is the WCAG failure). `urgent` does not change timing, only politeness. *(→ PRD-G3; ADR-0112 cl.5)*
- **AC1** *Given* `duration=100` (fake timers), *then* `close` fires at ~100 ms; *given* hover at 50 ms for 200 ms, *then* expiry lands ~50 ms after unhover (remaining-time, not restart).
- **AC2** *Given* focus moved into the toast, *then* the timer pauses until focus leaves.
- **AC3** *Given* `action="Undo"`, *then* no auto-dismissal ever occurs (timer probes at ≫ duration) — dismissal requires the user.

**SPEC-R17 — NOT catalogued: the allowlist's first permanent residents.** `Toast` + `ToastRegion` MUST NOT enter the default catalog. Both enter the fleet-derived gate's `EXCLUSION_ALLOWLIST` with ADR-0112 cl.6's recorded reason (app-surface chrome, not agent-emittable content: self-expiring records break history-must-not-lie; agent-raised chrome breaks payload↔DOM traceability; the partition already bans overlays in asks). The residue guard MUST prove neither is catalogued (an allowlist entry can never mask a real row). Their consumption story is the **app-surface docs** (descriptors + the site demo page), not a catalog row; no ADR-0097 partition disposition is owed (the partition is total over the *catalog* — stated so no build wave goes looking). *(→ PRD-G3; ADR-0112 cl.6/7)*
- **AC1** *Given* the fleet-derived gate over shipped descriptors, *then* it passes with exactly `Toast` + `ToastRegion` as allowlist entries, each carrying the cl.6 reason string, and `allowlistResidue` returns empty.

### 3.5 Cross-cutting (all five)

**SPEC-R18 — Tokens, floors, and the CSS-less consumer.** Every rendered-correctness concern rides component-owned tokens with safe defaults (ADR-0102 Lane A): `--ui-progress-*` (incl. the **density-invariant thin-rail thickness** — the slider-rail precedent verbatim, `slider.css:76-79`: a bar is a rail, NOT a `--ui-compact-*` box; track = `--md-sys-color-neutral-track`, the ADR-0059 solid-track role; fill = the primary role), `--ui-avatar-*`, `--ui-attachment-*`, `--ui-toast-*`/`--ui-toast-region-*`. A bare, unsized `ui-progress` and `ui-attachment` in any container (including a flex row) MUST paint visible and non-collapsed — **`min-inline-size` floors are mandatory** (the slider-dot collapse is the exact failure shape; test-the-whole-shape). Exact token values are the LLD's. *(→ PRD-G2; ADR-0112 cl.2/8; ADR-0102)*
- **AC1** *Given* a bare `<ui-progress>` and a populated `<ui-attachment>` each inside an unstyled flex row (browser, both engines), *then* each bounding box ≥ its token floor — never a dot/sliver.
- **AC2** *Given* the family-coherence token gate, *then* each control's token block declares only its own `--ui-{name}-*` (∪ shared allowlist).
- **AC3** *Given* `[density]` on an ancestor, *then* rhythm (gaps/padding on the space ladder) changes and the progress rail thickness / avatar box / floors do not.

**SPEC-R19 — Forced colors (WHCM).** All five MUST remain legible under `forced-colors: active`: the progress **fill** paints a system ink with the track distinguishable (explicit `forced-colors` block — a background-drawn fill otherwise vanishes; the bar-chart lesson, `bar-chart.css:101-107`), including the indeterminate sweep; the avatar keeps a visible circle boundary (system-ink border) with initials as real text; the attachment keeps its border + glyph (currentColor) + text; the toast surface stays distinguishable from the page (system-ink border). *(→ PRD-G2)*
- **AC1** *Given* forced-colors emulation (browser leg, both engines), *then* computed styles show system inks per control (the ADR-0102 sanctioned visual proof; fill ≠ track for progress).

**SPEC-R20 — Geometry posture.** Per `geometry.md`'s five classes: `ui-progress` and `ui-attachment` are **Display** (no `[size]`/`[scale]` row, no control height; the progress rail is a thin fleet constant; the attachment reads the type matrix for its text). `ui-avatar` is the **Indicator-class widget box** (fork F3): `--ui-avatar-size` defaults off the ratified `--ui-compact-{sm,md,lg}` `[size]`×`[scale]` lookup (ADR-0041 — no new register minted; 12–28 px; the component token is the page's override for larger chrome, and a real >28 px fleet register is the named re-open trigger); initials/glyph sizes derive from the box. `ui-toast` is Pattern-band (surface padding on the space ladder; its buttons are ordinary controls); `ui-toast-region` is layout (inset + gap tokens only). *(→ PRD-G2; ADR-0112 cl.2/3, fork F3; ADR-0041)*
- **AC1** *Given* `ui-avatar[size]` ∈ sm/md/lg under a `[scale]` ancestor, *then* the box tracks the re-tabled `--ui-compact-*` values exactly (the ADR-0041 lookup — geometry probe).
- **AC2** *Given* the progress/attachment descriptors, *then* neither declares a `size` attribute nor consumes `--ui-height-*`.

### 3.6 Catalog + teaching surface

**SPEC-R21 — Catalog rows, allowlist, partition — same wave.** The default catalog MUST declare `Progress`, `Avatar`, `Attachment` in the wave the descriptors land (ADR-0087 gate; SPEC-R17 carries the allowlist arm). All three rows are **display-only**: one-way props, no `value:{prop,event}` mark (no ADR-0019 seam slot), no children; agent-driven updates ride `updateDataModel` on bound paths. Row contracts (the `a2ui-catalog.spec.md` §5.2 table stays the normative coverage home; this SPEC is their derivation):

| A2UI type | `ui-*` widget | Properties |
|---|---|---|
| `Progress` | `ui-progress` | `value` (number, **bindable**, `mapsTo: value`) · `max` (number, bindable) · `label` (string, bindable) |
| `Avatar` | `ui-avatar` | `src` (string, bindable) · `name` (string, **bindable**) · `label` (string, bindable) · `size` (enum `sm`/`md`/`lg`, non-bindable — structural) |
| `Attachment` | `ui-attachment` | `name` (string, **bindable**) · `mimeType` (string, bindable) · `sizeBytes` (number, bindable — renamed from `size`, ADR-0112 Amendment 1; embedder-supplied, NOT a wire field; the row note says so) · `href` (string, **bindable** — the ADR-0114 posture: destination is content; every bound value passes the component gate, and the static-literal validator first line covers `Attachment.href` as it covers `Text.href`) |

Feed-partition dispositions land in the same change (ADR-0097, ADR-0112 cl.7): `Avatar` → IN `FEED_SURFACE_TYPES`; `Progress` → OUT + reason (a live indicator in a frozen-able ask is a lying record); `Attachment` → OUT + reason + the named revisit trigger (a real file-pick ask). The partition moves 23 IN / 13 OUT → **24 IN / 15 OUT** over the 39-type catalog. *(→ PRD-G1; ADR-0112 cl.6/7)*
- **AC1** *Given* the fleet-derived gate, *then* the three types are declared AND factory-bound; *given* the partition gate, *then* IN ∪ OUT = the widened catalog exactly at 24/15.
- **AC2** *Given* `{"component":"Progress","value":{"path":"/task/pct"}}` with a number in the data model, *then* it renders determinate and re-renders on `updateDataModel`; a payload using all three types validates 0 `CATALOG` errors.

**SPEC-R22 — Teaching: guidance + exemplar + retiring the hand-built card (M2).** §5.2 Notes MUST gain the when-to-use guidance (*Avatar for who acted — beside a name, decorative · Progress for how far along — indeterminate unless a real fraction exists · Attachment for what was produced — never a hand-built Icon+Text card*) **plus the TaskState pairing guidance** (`submitted`/`working` → indeterminate, or determinate when the agent reports a fraction; `input-required` → an ask, never a progress bar; terminals → no bar — completion announcements are toast/app-chrome territory) — guidance prose only, zero `@agent-ui/a2a` imports (SPEC-N6). The examples shelf gains the **agent-activity exemplar** (task-status card: Avatar + Progress + Attachment in a Card), validator-clean, in `allSeeds`; the `document-row-toolbar` seed's hand-composed attachment assembly (`catalog-coverage.ts:184-235`) upgrades to the real type; corpus + derived prompt re-validate over the widened catalog. *(→ PRD-G4; ADR-0112 cl.6)*
- **AC1** *Given* the exemplar seed, *then* `validateA2ui` reports 0 errors and it renders in the gallery (browser-verified); *given* the upgraded document-row seed, *then* no hand-composed Icon+Text attachment card remains in it.
- **AC2** *Given* the corpus/derived-prompt gates, *then* they run green over the widened catalog.

## 4. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| **SPEC-N1** | Zero runtime dependency, no new package | No toast/avatar/progress library, ever (CLAUDE.md pillar); four ordinary `controls/` folders (`ui-toast-region` = toast's second in-folder file set — the radio/radio-group precedent); pure modules in-folder (ADR-0112 cl.8) |
| **SPEC-N2** | Cross-engine proof | jsdom is blind to top layer, timers-vs-hover interplay, painted geometry, and WHCM — browser legs (Chromium + WebKit) are mandatory per control; toast a11y probes read internals directly (the tabs precedent) |
| **SPEC-N3** | Fleet gates stay green | file-set, family-coherence, descriptor↔props trip-wires, site per-tier page sets, `npm run check && npm test`; negative controls on every gate edit (the reverted edit must fail) |
| **SPEC-N4** | Size budget honesty | `npm run size` run at the build wave (manual, ADR-0040 §3); the family-ceiling re-base ADR-0112 cl.8 expects is recorded, never silently absorbed |
| **SPEC-N5** | Icons prerequisite | The `@agent-ui/icons` vendor addition (person + 8 file-category glyphs, ADR-0066 mechanics) lands **before** the avatar/attachment slices render any glyph — the build sequence pins it as the PREP slice (the document-row silent-empty defect is what skipping it looks like) |
| **SPEC-N6** | Layering law | `@agent-ui/components` imports nothing upward — no `@agent-ui/a2a` import, no TaskState prop enum anywhere in the family (the layering trip-wire is the gate); the TaskState mapping lives only as SPEC-R22 guidance prose |

## 5. Open items (non-normative)

- Foreseen extensions, deliberately out of v1 (each re-enters only by its own record, per the PRD §3 fence): progress ring (`shape` axis) · buffer/segments · avatar curated accent-pair palette, groups, presence · a >28 px avatar register (F3's named trigger) · attachment previews/upload affordances · a region placement prop · toast queue/dedup discipline · a `target` prop on the link leg (ADR-0114's foreseen extension, owned there).
- **A v1 residual (doc-review MINOR, recorded):** a toast already visible when a modal opens LATER is occluded by the modal's top-layer entry until that toast's next `show()` — SPEC-R12 AC2 only contracts the reverse ordering (a completion arriving while a modal is open). The `role=status`/`role=alert` announcement already fired at the original `show()` regardless of paint order, so only visual persistence is affected, not the a11y event. See LLD §10.8.

## 6. Traceability

| Requirement | PRD goal(s) |
|---|---|
| SPEC-R1–R3 | PRD-G1 (progress exists + behaves), PRD-G2 (a11y, hardening, WHCM/motion) |
| SPEC-R4–R7 | PRD-G1 (identity mark), PRD-G2 (fallback chain, decorative default, no-hue law) |
| SPEC-R8–R11 | PRD-G1/G4 (file vocabulary; the hand-composition retires), PRD-G2 (pillars) |
| SPEC-R12–R17 | PRD-G3 (the transient surface + its a11y/timing contract; deliberately not agent-emittable) |
| SPEC-R18–R20 | PRD-G2 (tokens, CSS-less consumer, WHCM, geometry law) |
| SPEC-R21 | PRD-G1 (catalog-reachable, dispositions total) |
| SPEC-R22 | PRD-G4 (exemplar, guidance, corpus re-validation) |
| SPEC-N1–N6 | PRD-G2 (zero-dep, cross-engine, gates, size, prerequisite, layering) |
