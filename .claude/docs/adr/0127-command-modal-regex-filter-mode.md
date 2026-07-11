# ADR-0127 — `ui-command-modal` gains an opt-in `filter="regex"` match mode (TKT-0018 site command-search)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-11
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-11 *(authored)* |
> | **Proposed by** | design intake (TKT-0018, site command-search) — the load-bearing open TKT-0018 names: does the shipped `ui-command-modal` support regex-over-description filtering, and does it need a control change to get it? |
> | **Ratified by** | *(awaiting Kim — the taste fork below)* |
> | **Repairs** | NEW [`../spec/site-command-search.spec.md`](../spec/site-command-search.spec.md) SPEC-R6/R7 (the filter contingency). On ratification+build: amends [`../spec/command-modal.spec.md`](../spec/command-modal.spec.md) SPEC-R2 (props schema, +`filter`) and SPEC-R5 (filter semantics, +mode axis) · amends [`../lld/command-modal.lld.md`](../lld/command-modal.lld.md) LLD-C1/C5 · amends `packages/agent-ui/components/src/controls/command-modal/{command-modal.ts,command-modal.md}` — none edited by this design intake itself (build-team scope) |
> | **Supersedes / Superseded by** | **Extends ADR-0125** (does not reverse it — F1/F7 stand: substring stays the default and the proven v1 behavior; regex is a new, opt-in, additive mode, not the "fuzzy-match sophistication" F7 fenced) |

## Context

TKT-0018 asks the docs site to filter its `ui-command-modal`-backed search palette **by regex**, over each
result's name + tag + description. Source-reading the shipped control (verified against
`command-modal.ts:214-234`, `#filter()`) shows the match test is a single hardwired line:
`hay.includes(q)` — a fixed, case-insensitive **substring** test over the item's label + `data-keywords`. It is
not pluggable: `#filter()` is a private method, always wired to the search field's own `input` listener inside
`connected()` (`command-modal.ts:78`); a consumer has no seam to swap the algorithm, and no supported way to
suppress the control's own auto-filter to run a different one instead (SPEC-R5 states the substring/keyword
contract as the entire v1 filter behavior).

ADR-0125 F7 fenced **"fuzzy-match sophistication"** — typo-tolerant, ranked matching — as an explicit v1
non-goal ("the prior art does not prove them cheap"). Regex matching is a **different axis**: an exact-pattern
test the caller supplies, not fuzzy ranking. It does not reverse F7's reasoning; it is a capability F7 never
evaluated.

Separately, `site-command-search.lld.md` (this same intake) investigated whether the **other** half of
TKT-0018's load-bearing open — post-connect option mutation, needed to inject the lazily-loaded L3 corpora
(Changelog, Decision Records) after the palette has already connected — also needs a control change. Source
reading (`command-modal.ts:107-137`, `#ensureParts()`) confirms the author-children child-move is a **one-shot**
walk of `this.firstChild`, guarded against re-entry (`#modal && #search && #list` early-return), with no
`MutationObserver` and no public seam to add options after connect. **That gap does NOT need a control change**:
the site's design (`site-command-search.lld.md` §4) resolves it using only supported, already-tested lifecycle
behavior — tearing down and recreating the whole `<ui-command-modal>` element once L3 data resolves (while
closed), relying on the hotkey listener's documented reconnect-rearm (SPEC-R10 AC2: "the listener rides the
connection `AbortSignal`… re-armed on reconnect"). So this ADR proposes **only** the filter-mode extension; no
live/continuous child-move seam is requested.

## Decision

We **extend** ADR-0125 (F1/F7 stand unchanged): `ui-command-modal` gains one new prop, **`filter: 'substring' |
'regex'`**, default `'substring'` — fully backward compatible, every shipped consumer today passes no `filter`
attribute and sees zero behavior change. `#filter()`'s per-option match test becomes mode-dependent over the
**same haystack** (item label + `data-keywords`, SPEC-R5's existing definition, unchanged):

- `'substring'` (default) — the existing `hay.includes(q)`.
- `'regex'` — `new RegExp(q, 'i').test(hay)`; a `SyntaxError` from an invalid pattern is caught and the call
  falls back to the substring test **for that keystroke only**, never throwing (TKT-0018's own acceptance:
  "invalid regex must degrade gracefully — literal-substring fallback, never a throw").

Nothing else in SPEC-R5 changes: group-hide, active-reset, the result-count live region (SPEC-R7), and the
empty-state (SPEC-R8) are all mode-independent and untouched.

## Consequences

- SPEC-R2 (props schema) gains one attribute row (`filter`, string enum, default `'substring'`); SPEC-R5 gains a
  mode axis with a contingent AC (the same "Contingent on…" convention SPEC-R10/F2 already uses for a fork
  awaiting ratification).
- The descriptor (`command-modal.md`) gains one `attributes[]` row; the descriptor↔props trip-wire
  (`command-modal-descriptor.test.ts`) is unaffected in shape (an additive row, not a schema change).
- One new jsdom case joins `command-modal.test.ts` (LLD-C14): an invalid pattern (e.g. an unbalanced `(`) under
  `filter="regex"` does not throw and falls back to substring matching for that query.
- **Blast radius: none on ship.** A grep of every shipped site/demo/gallery usage of `<ui-command-modal>`
  confirms zero existing instances pass a `filter` attribute — the default preserves today's behavior
  byte-for-byte.
- **Fenced, not decided here:** a pluggable matcher *function* (beyond the closed two-value enum) is a v3
  trigger only if a third consumer needs a third algorithm (the `active-descendant-filter` extraction
  precedent — re-derive twice, extract on the third). Fuzzy/typo-tolerant matching stays ADR-0125 F7's non-goal.

## Alternatives considered

- **A pluggable matcher callback prop (`matchFn`).** Rejected: a function-valued prop is not attribute-
  serializable, breaking the fleet's attributes-as-API descriptor contract (ADR-0004) that every other
  `ui-command-modal` prop honors; a closed string enum needs no new prop-shape precedent.
- **Site-side filter bypass** (a capture-phase `input` listener + `stopImmediatePropagation` ahead of the
  control's own listener, the site manually toggling `hidden`). Rejected: it reaches around a private,
  always-wired listener by exploiting registration order — fragile against any future reordering inside
  `connected()`, and exactly the site-fork ADR-0102's three-lane law forbids for a **component-owned** concern
  (the matching algorithm is the control's own identity, not a page-author styling freedom).
- **A `filter="none"` consumer-owns-everything mode.** Rejected as broader than the need: TKT-0018's only unmet
  requirement is the matching *algorithm*, not full control of hidden-state/group-hide/status-announcement/
  empty-state — a `none` mode would force the site to re-implement SPEC-R5/R7/R8's logic the control already
  gets right, for no reason the ticket asks for.
- **Bundling a live/continuous child-move seam into this same ADR** (to also solve L3 lazy-injection).
  Rejected: `site-command-search.lld.md` §4 proves the mutation problem is solvable today with ordinary element
  teardown/recreate plus the already-shipped, already-tested hotkey reconnect-rearm guarantee (SPEC-R10 AC2) —
  no control change earns its cost for that half.
