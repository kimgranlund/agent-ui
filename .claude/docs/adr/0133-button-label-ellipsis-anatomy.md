# ADR-0133 — `ui-button` gains a real `[data-part="label"]` wrapper: CSS-only single-line ellipsis on the label region, reusing `ui-text`'s stamp/heal mechanism; `ui-badge`/`ui-tab` stay named deferrals

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-14
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-14 *(authored)* |
> | **Proposed by** | design intake for TKT-0042 (`control-label-overflow-ellipsis-anatomy`) — the evidence-backed anatomy follow-up ADR-0106 clause 6 reserved: "buttons that overflow their container are first a layout defect... to be taken with evidence it is needed." A reported screenshot (a pill "Send" button whose label would run past the frame with no ellipsis) is that evidence. |
> | **Ratified by** | — Kim |
> | **Repairs** | TKT-0042. On ratification+build: `controls/button/button.ts` (the label-wrap/heal mechanism) · `controls/button/button.css` (the `[data-part='label']` overflow legs) · `controls/button/button.md` (anatomy + `parts:` update) · `controls/button/button.test.ts` (the `button-host-as-grid` probe, whose "untouched, `childElementCount` stays 2" assertion is superseded by the new wrapper anatomy) · NEW `controls/button/button-label-overflow.browser.test.ts` · named deferral comments at `controls/badge/badge.css:98` and `controls/tabs/tabs.css:68` (no code change — comment only) |
> | **Supersedes / Superseded by** | **Extends [ADR-0106](./0106-text-truncate-css-only.md)** clause 6 (the reserved `ui-button` anatomy follow-up) and reuses its ratified CSS-only mechanism (Kim's "truncate should be CSS-only solution. no resize-observer overkill" ruling extends to this record — no box-size measurement here either). **Reuses the mechanism of [ADR-0078](./0078-ui-text-three-axis-variant-size-as.md)** clause 4 (the `ui-text` stamp/heal `MutationObserver`, adapted from a conditional semantic stamp to an unconditional label wrapper). Relates TKT-0042. |

## Context

`button.css:99-103` ships `white-space: nowrap` on `ui-button`'s host with a comment naming the
exact gap: "Ellipsis-on-constraint needs a label wrapper (anonymous grid text can't carry
`text-overflow`) — that anatomy follow-up is ticketed with the `ui-text` overflow-ellipsis
pattern." ADR-0106 shipped that `ui-text` pattern (a `[truncate]` boolean, two CSS legs mirroring
the stamp-transparency reset) but its clause 6 explicitly declined to extend it to `ui-button`:
"a clipped *control* label needs the label wrapper `button.css:99-103` describes — a separate
anatomy decision on a shipped control, to be taken with evidence it is needed." TKT-0042 supplies
that evidence (a reported "Send" pill button overflowing with no truncation affordance) and also
flags the identical gap on `ui-badge` (`badge.css:98`) and `ui-tab`/`ui-tabs` (`tabs.css:68`).

The mechanism gap is real, not stylistic: `ui-button` is `display: inline-grid` (host-as-grid,
ADR-0006/ADR-0012) with the label as **anonymous** host-as-content text — no element of its own.
Per the CSS Grid spec, a run of text nodes that are direct children of a grid container is wrapped
in an *anonymous* block box to become a grid item; that box corresponds to no element and so has
no selector any author stylesheet can target. `text-overflow` can only be set on a real block
container box. This is the same anatomy shape `ui-text`'s Display class does NOT have (a plain
`display: block` host, or its `as`-stamped child) — which is exactly why ADR-0106 could ship a
CSS-only two-leg rule with no wrapper, and exactly why `ui-button` cannot: **a real element is
required to carry the clip.**

`ui-text` already solved the adjacent problem — light-DOM content that must be wrapped in a real
element without becoming component-owned content (`render()` stays the inherited no-op; the
wrapper only ever *moves* nodes, never clones or replaces them) — with its stamp/heal mechanism
(ADR-0078 cl.4): a connect-time wrap, plus a `childList` `MutationObserver` that heals the
invariant whenever nodes land directly on the host (parser streaming, or an external write that
clobbers `textContent`). That second case is not hypothetical for `ui-button`: the A2UI
`buttonFactory` (`a2ui/src/catalog/default/factories.ts:117-119`) applies a bound `label` by
`el.textContent = value` — the identical clobbering write pattern `ui-text`'s heal observer exists
to survive. A label wrapper that only wrapped once at connect would silently vanish on the very
first bound-label update.

## Decision

1. **`ui-button` gains a persistent, unconditional `<span data-part="label">` wrapper around its
   label region** — the non-adornment light-DOM children (any child without `slot="leading"` /
   `slot="trailing"`). Built by adapting `ui-text`'s stamp/heal shape (`text.ts` `#restamp`/`#heal`)
   to button's anatomy: an initial wrap on `connected()`, plus a `childList` `MutationObserver` that
   re-adopts any stray non-adornment child that lands directly on the host afterward (parser
   streaming, or the `buttonFactory`/A2UI `textContent` clobber). Nodes are **moved, never cloned**
   (node identity, ADR-0022 precedent) — content, not just its rendering, is preserved. The wrapper's
   insert point is anchored on the **trailing adornment element itself** (never on the first stray
   node) — adornments are never moved, so inserting immediately before whatever trailing element
   currently exists (or appending, when there is none) places the wrapper after any leading adornment
   and before any trailing one *regardless of interspersed whitespace text nodes* — the fix a
   component-review pass caught: a `strays[0]`-anchored first draft inverted the anatomy on
   pretty-printed, multiline-authored markup (a whitespace-only text node landing before the leading
   adornment).
   - **The wrapper is unconditional, not opt-in.** `ui-button` already forces `white-space: nowrap`
     unconditionally (Kim, 2026-07-08 — "a control label NEVER wraps"). Ellipsis-on-overflow is the
     direct completion of that existing default, not a new orthogonal axis — every button benefits
     without an author flag, none regress. This is why `ui-button` does not need `ui-text`'s
     `truncate` boolean: `ui-text` wraps by default and opts INTO single-line; `ui-button` is
     already single-line and only needs the overflow affordance completed.
   - **The wrapper is never created for an empty label.** The heal pass only builds/attaches the
     span when there is at least one stray non-adornment node to hold. An `icon-only` button (the
     geometry law's fifth structure, `button.css:190-195`) has no label content at all and keeps its
     existing single-column square anatomy untouched — no empty label track, no regression.
2. **CSS — one new leg on the wrapper, not a second copy of the stamp-transparency two-leg
   pattern.** `white-space: nowrap` already lives on `:scope` and inherits into the span for free
   (the same inheritance shortcut ADR-0106's host leg uses), so `[data-part='label']` needs only:
   ```css
   :scope > [data-part='label'] {
     overflow: hidden;
     text-overflow: ellipsis;
     min-inline-size: 0; /* grid items default to min-width:auto (their content's intrinsic size),
                             which defeats shrinking below content — the host-as-grid adaptation
                             ui-text's block-level two-leg pattern never needed */
   }
   ```
   The `min-inline-size: 0` line is the one genuinely new mechanic this record adds beyond reusing
   ADR-0106's shape: `ui-text`'s clipping box is a plain block (or its stamp), never a grid item, so
   it never fights `min-width: auto`. A grid item does, and without zeroing it the label would never
   shrink far enough to clip.
3. **`ui-badge` and `ui-tab` stay named deferrals, not silently skipped.** TKT-0042's evidence (the
   screenshot) is `ui-button`-specific; neither `ui-badge` nor `ui-tab` has a submitted repro, and
   ADR-0106's own Alternatives already rejected "a generic fleet `truncate` on every control" —
   "controls own their own overflow contracts... per-control adoption stays per-control evidence."
   Applying the same wrapper mechanism to `ui-badge` (compact-realm widget-box anatomy, ADR-0041 —
   a fixed-box control the fleet treats as a short tag/count, not free text) or `ui-tab` (a flex-row
   tablist item with its own selection/indicator machinery) without evidence would be exactly that
   rejected move. Each gets a named-deferral comment at its existing `white-space: nowrap` site
   (`badge.css:98`, `tabs.css:68`), matching `button.css:99-103`'s own precedent style, pointing back
   to this ADR and TKT-0042 so a future report has a paved path rather than a fresh investigation.

## Consequences

- **First DOM-mutating anatomy on `ui-button`.** `button.ts`'s header comment currently states
  "The button does NOT `render()` a wrapper over them" as an invariant; this record revises it —
  `render()` itself stays the inherited no-op (no template, no clobbering render effect), but a
  scope-owned connect-time effect + observer now *adopts* label children into a real wrapper, the
  same architectural move `ui-text` already made for its stamp. The comment and the existing
  `button-host-as-grid` unit test (`button.test.ts`) — which currently asserts an unwrapped
  `<svg class="icon"></svg><span>Save</span>` payload stays `childElementCount === 2`, "untouched"
  — are both stale under this decision and are repaired in the same build (the "stale context is a
  defect" standing rule). The repaired test asserts content survives (text/nodes reachable,
  accessible name unchanged) rather than DOM-shape identity.
- **Geometry stays byte-identical when the label fits.** The span is a bare wrapper — no margin,
  padding, or border; blockified automatically as a grid item; inherits `font-size`/`line-height`/
  `color` from `:scope`. Its rendered box occupies exactly the space the anonymous text run
  previously occupied. A browser-engine regression test proves this (frame height/width/padding
  unchanged across `[size]`/`[scale]`/`[density]`, adapting the existing `button-geometry.browser
  .test.ts` harness).
- **Accessible name is unaffected.** `role="button"`'s accessible name computes from the button's
  full text content regardless of intervening wrapper elements (the `<span>` is not `aria-hidden`
  and carries no ARIA role of its own) — `internals.role`/`labelSource: textContent` in `button.md`
  needs no change.
- **The heal observer is a permanent, always-on cost** for every `ui-button` instance (one
  `MutationObserver`, disconnected on `disconnected()` — the `ui-text` zero-residue precedent),
  not a lazily-installed one — because the wrapper is unconditional (Decision cl.1), unlike
  `ui-text`'s `truncate`-gated title mirror. This is the accepted cost of a zero-author-flag fix.
- **`ui-badge`/`ui-tab` stay clipped-without-affordance** wherever an ancestor constrains their
  inline space — a known, now-named gap, not a silent one. A future report against either carries
  its own evidence and reopens this ADR's Alternatives rather than starting cold.

## Alternatives considered

- **Require the author to supply the wrapper** (e.g. document `<ui-button><span
  slot="label">Long text…</span></ui-button>` as the only ellipsis-capable form). Rejected: breaks
  the ergonomics of every existing bare-text call site (`<ui-button>Save</ui-button>`) and the
  entire A2UI `buttonFactory` `label` → `textContent` path, pushing a mechanical, easy-to-forget
  wrapping burden onto every consumer for a rendering concern the control itself should own.
- **A CSS-only trick with no wrapper element** (targeting the grid container's own box, a
  `display: -webkit-box`/line-clamp hack on `:scope`, or similar). Rejected: `text-overflow` has no
  selector surface for an anonymous grid-item box — this is the documented finding the original
  `button.css:99-103` deferral comment already recorded, not re-litigated speculation.
- **Gate the fix behind a new opt-in prop**, mirroring `ui-text`'s `truncate` boolean. Rejected:
  unlike `ui-text` (wraps by default; `truncate` is a deliberate opt-in to a DIFFERENT behavior),
  `ui-button` is *already* unconditionally single-line (`white-space: nowrap`, no opt-out exists
  today) — ellipsis-on-overflow completes that existing, non-optional contract rather than adding a
  new orthogonal axis nothing else in the control schema needs.
- **A ResizeObserver-driven measured ellipsis** (only clip when actually overflowing, à la the
  rejected first draft of ADR-0106). Rejected for the same reason ADR-0106 cl.3 rejected it for
  `ui-text`: `text-overflow: ellipsis` is native, box-size-agnostic CSS — no measurement is needed
  to know when to clip, only to know whether a *reveal* affordance (a `title` mirror) should exist.
  `ui-button`'s existing accessible name IS the full label already; this record adds no `title`
  mirror (control labels are short, first-order UI, not `ui-text`'s free-form prose case — no
  evidence a reveal affordance is needed here, and one is not free: it would require the same
  `title`-ownership bookkeeping ADR-0106 cl.3 built. Left as a future fork if evidence surfaces).
- **Apply the same wrapper mechanism to `ui-badge` and `ui-tab` in this same build**, since they
  share the anatomy gap. Rejected — twice-rejected, in fact: ADR-0106's own Alternatives already
  reject a generic fleet-wide fix, and neither control has submitted evidence of the problem
  actually occurring (TKT-0042's screenshot is `ui-button`-specific). Named deferral, not silence
  (Decision cl.3).
