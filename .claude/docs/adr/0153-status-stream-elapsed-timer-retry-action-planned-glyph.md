# ADR-0153 — `ui-status-stream` gains a ticking elapsed timer, an inline retry/action affordance (a new closed-vocabulary `action` event), and a "Planned" pending-group glyph; step-count/score ship as a `description` convention

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-20
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-20 |
> | **Proposed by** | build seat ([GH #147](https://github.com/kimgranlund/agent-ui/issues/147) intake — the design-options comment posted against the issue, which Kim reviewed and approved in full ("these all look good") before this build; the three Figma "Claude Code Gateway" frames, file `PPMexsWELAquyP9WaheCyt`, node-ids 21:1642/21:1643/21:1641) |
> | **Ratified by** | kimgranlund (repo owner), 2026-07-20, via the [`ratify ADR-0153` utterance](https://github.com/kimgranlund/agent-ui/issues/147#issuecomment-5025823481) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on this build: `packages/agent-ui/components/src/controls/status-stream/{status-stream.ts,status-stream.css,status-stream.md,status-stream.test.ts,status-stream.browser.test.ts,status-stream-descriptor.test.ts}` (new `StatusEntry.startedAt`/`StatusEntry.action` fields, the ticking-interval mechanism, the inline retry button, the new `action` event) · `packages/agent-ui/components/src/controls/timeline-item/timeline-item.ts` (+`.test.ts`) — `GROUP_STATUS_GLYPH` gains `pending: 'clock'` · `packages/agent-ui/icons/src/types.ts` (+`.test.ts`) + `packages/agent-ui/icons/scripts/vendor-phosphor.mjs` + `packages/agent-ui/icons/src/phosphor/icons.gen.ts` — the new `clock` icon, vendored from the existing `@phosphor-icons/core` devDependency (no new asset invented) · `packages/agent-ui/components/src/controls/naming-gates.test.ts` + `packages/agent-ui/components/src/controls/family-coherence.test.ts` — `action` added to both `ALLOWED_EVENTS` allowlists + the `data-role` registry's `ALLOWED_ROLES` · `.claude/docs/references/naming.md` §4/§6 + `CLAUDE.md` — the closed event vocabulary grows to seven, the `data-role` registry gains `action` · `site/pages/status-stream-doc.ts` — real, checked-in specimens for all three Figma states plus a fourth all-pending "Planned" card and a leaf `trailing`-slot example |
> | **Supersedes / Superseded by** | Composes on [ADR-0146](./0146-live-turn-lifecycle-progress-channel.md) (the grouping/escalation/header mechanism this build's Fork 1/3 render into) and [ADR-0143](./0143-timeline-item-recursive-nesting-accordion.md) (the collapsed-summary `trailing` auto-fill this build's Fork 1 finding routes AROUND, not through) — neither is edited, both stand unchanged. Cites [ADR-0057](./0057-intent-non-color-signifier-rule.md) (the pending/active/done/error group glyphs stay SHAPE-distinct, never hue-only) and [ADR-0066](./0066-phosphor-default-pack-buildtime-vendoring.md) (the `clock` icon is vendored through the SAME curated Phosphor pipeline `circle-notch`/`check-circle`/`x-circle` used, not hand-drawn). Precedent for the size:big / design-intake bar this build itself clears: [TKT-0091](../tickets/tkt-0091-ui-timeline-nesting-accordion.md) / [ADR-0143](./0143-timeline-item-recursive-nesting-accordion.md).

## Context

GH #147 named three Figma frames beyond what `ui-status-stream`'s already-shipped grouping/escalation
mechanism (ADR-0146) renders: a live elapsed-timer per group/step header ("32s", "8s"), a group-header
step-count/score summary ("3 Steps", "94/100"), a "Planned" treatment for a not-yet-started nested step,
and an inline retry `Button` inside an expanded error step. A design-options comment was posted against
the issue, grounding each fork against the real shipped source (`status-stream.ts`'s `StatusEntry`/
`STATUS_RANK`/`HEADER_STATUS_GLYPH`, `timeline-item.ts`'s `trailing` cell) rather than guessing, and named
firm leanings without forcing a recommendation on the two genuinely open contract questions. Kim reviewed
that comment and replied "these all look good," approving the analysis and its leanings. This ADR records
the three resulting builds plus one finding made only once the code was actually written (the `trailing`-
slot conflict, below) that the posted comment did not anticipate.

**Verified against the real shipped source** before any code changed: `HEADER_STATUS_GLYPH`
(`status-stream.ts:103`, pre-build) mapped only `done`/`error`/`warning`; `GROUP_STATUS_GLYPH`
(`timeline-item.ts`, pre-build) mapped `active`/`done`/`error`/`warning` but not `pending`; `StatusEntry`
had no `startedAt`/`action` field; the closed event vocabulary (`naming.md` §4) had six members, none
naming "a user committed a per-entry action."

## Decision

### Fork 1 — elapsed timer / step-count / score: the middle-ground path, PLUS one finding the posted comment didn't have

Per Kim's approval of the comment's middle-ground lean: **`startedAt?: string` (an ISO 8601 timestamp)
ships as a genuine, additive `StatusEntry` field; step-count/score ship as a documented convention with
zero further contract change.**

- **`startedAt`** is consumed by `appendEntry`/`update` as a routing fact (never projected onto the
  timeline-item as a prop — the SAME treatment `parent` already gets) and drives ONE shared per-host
  `setInterval`, ticking once per second into the entry's *existing* `timestamp` cell — the SAME visible
  slot a consumer's own static `timestamp` string already occupies, just live instead of frozen. Ticking is
  eligible while the entry's (or, for a group, its already-escalated) `.status` reads `active`; it force-
  stops at `finalize()`/`fail()` regardless of an entry's raw `.status` (truncation is a custom STATE, not
  a status write — `#markTruncated` never touches `.status`, so the naive `status === 'active'` check alone
  would NOT have caught this; `#settle()` calls `#stopTicking()` explicitly). ISO chosen over a raw
  `elapsedMs` snapshot: a wall-clock anchor is the one fact a repeated tick can re-derive itself from without
  the component inventing its OWN second wall-clock anchor to make an `elapsedMs` snapshot advance.
- **Step-count/score** ship as a **`description`-field convention**, not the `trailing`-slot pattern the
  issue's own intake first proposed. **Finding, made only while building this** (not in the posted
  comment): `trailing` on a GROUP parent is *already live* — ADR-0143's collapsed-summary preview
  (`timeline-item.ts`'s `#renderTrailingPreview()`) auto-fills it with the last nested descendant's
  status+label whenever the group is closed, via a `MutationObserver` on the nested subtree. A consumer's
  own direct write to that same cell would be silently clobbered the next time ANY nested child mutates —
  a real DOM conflict, not a style preference. `description` is a plain stamped prop cell with no
  competing auto-fill mechanism, so it is the conflict-free home for a group header's step-count/score
  (`description: '3 Steps'` → `description: '3 Steps · 94/100'` on resolution). The genuine `trailing`-slot
  **consumer-content** pattern the intake asked to see demonstrated still holds exactly as documented — for
  a **non-grouped** (leaf) entry, where nothing competes for the cell, and ships as a real, working,
  checked-in example (`site/pages/status-stream-doc.ts`'s `leaf-trailing` entry, `stream.appendEntry(...)`
  then a direct `.querySelector('[data-role="trailing"]').textContent = …` write).

### Fork 2 — retry action: the first-class path, with the event named `action`

Per Kim's approval of the comment's first-class lean: **`StatusEntry.action?: { label: string }`** — when
present on an entry whose *effective* status reads `error`, the host renders a `<ui-button>`
(`variant="soft"`, `size="sm"`) into a new, host-appended `[data-role="action"]` cell (the SAME "host
creates a plain cell outside the item's own anatomy" shape `status-stream.ts`'s pre-existing `#growText`
already uses for `[data-role="text"]` — no change to `timeline-item.ts`'s own anatomy). A click emits
**`action`** (detail `{ key: string }`) on the **stream host** — a genuinely **new, seventh member of the
closed event vocabulary** (`naming.md` §4, was `change · input · select · open · close · toggle`). None of
the original six name "a user committed a per-entry action button," and `select`'s own commit semantics
(a list-item commit) are a different consumer intent than an arbitrary per-entry action — reusing it would
blur the two. `action` was chosen over an alternative like `retry` because the field itself
(`StatusEntry.action`) is deliberately generic (a `label`, not a fixed "retry" semantic) — a future action
kind other than retry reuses the SAME event, not a new one per verb. The component **never re-runs
anything itself** on click; the consumer's own listener owns the actual retry (proven in both the browser
test suite and the doc-page specimen, where the listener flips the entry back to `active` and simulates a
successful retry on its own timeline).

### Fork 3 — "Planned": the glyph+convention path, landing on BOTH named surfaces (a genuine ambiguity, resolved and documented)

Per Kim's approval of the comment's glyph+convention lean: add a `pending` entry to the group-level marker
glyph set, pick a neutral/outline icon from the fleet's existing vendored Phosphor pipeline (never a
hand-drawn asset), and document "Planned" as a freeform `label`/`description` convention (unenforced,
matching the issue's own framing).

**A genuine ambiguity the posted comment did not resolve, found and settled while building:** the comment's
own Fork 3 text cites `HEADER_STATUS_GLYPH` (`status-stream.ts:103`) by name and line, and the build brief
built from it names that exact symbol/file. But re-deriving the actual "group headers currently paint
NOTHING distinctive for an all-pending group" claim against the real escalation logic shows the truly
**reachable** all-pending-group case renders through a *different* symbol: `timeline-item.ts`'s
`GROUP_STATUS_GLYPH` (the group PARENT's own marker glyph, painted via `ensureNestedSlot`/
`#renderMarkerGlyph` whenever a group has nested children) — `#recomputeGroups` escalates a group of
all-`pending` children to `escalateStatus`'s `pending` rank the moment they're appended, before any child
starts, a real and common state. `status-stream.ts`'s `HEADER_STATUS_GLYPH`, by contrast, feeds the
DIFFERENT stream-level opt-in F8 header (ADR-0146) — and verified against `#overallStatus()`'s own logic,
`pending` is **not reachable there**: the pre-`finalize()` floor rule always floors a pending-only
escalation up to `active` (rank 2 never outranks rank 3), and post-`finalize()`/`fail()`, `#settle()`
truncates every still-`active`/`pending` entry, which `#effectiveStatus` then reports as `warning`, not
`pending` — no live combination of `appendEntry`/`update`/`finalize`/`fail` ever leaves that header's
escalation sitting on `pending`.

**Resolution: both.** `GROUP_STATUS_GLYPH.pending = 'clock'` ships as the real, tested, REACHABLE fix (a
browser test proves an all-pending group escalates and paints the icon) — this is the actual, load-bearing
answer to "an all-pending group paints nothing distinctive." `HEADER_STATUS_GLYPH.pending = 'clock'` ALSO
ships, closing the identically-named gap the design-options comment explicitly pointed at, kept honestly
even though it is not currently reachable through this build's own logic (additive, `Partial<...>`, zero
regression to the three already-reachable members) — changing `#overallStatus()`'s floor/truncation rule
to make it reachable would be a real behavior change this build does not make, named here rather than
silently glossed over. The `clock` icon itself is vendored through the existing curated-Phosphor pipeline
(`packages/agent-ui/icons/scripts/vendor-phosphor.mjs`'s `NAME_MAP`, the SAME mechanism `circle-notch`/
`check-circle`/`x-circle` used for this same Figma card) — never a hand-drawn SVG asset. "Planned" itself
stays a freeform `label`/`description` convention (no enforced field), demonstrated in the doc page's
pre-existing `g-progress-2`/`g-error-3` specimens and a new `g-planned` card (an all-pending group,
proving the new glyph live).

## Consequences

- `StatusEntry` gains two additive optional fields (`startedAt`, `action`) — every existing consumer's
  calls remain byte-valid; neither field is ever required.
- `ui-status-stream` gains its FIRST emitted event, `action` — the descriptor's `events: []` becomes
  `events: [action]`; the SPEC-R12 "streamed state rides role=log, never a synthetic event" rule is
  UNCHANGED for streamed text/state (still true), narrowed to exclude this one user-committed-action
  exception, exactly as ADR-0146 F8 narrowed "no header" to "header opt-in."
- The closed event vocabulary (`naming.md` §4) grows from six to seven members; both fleet-wide gates
  (`naming-gates.test.ts`'s emit-seam allowlist, `family-coherence.test.ts`'s per-descriptor events check)
  extend together, per their own "extend both together" contract comments.
- The `data-role` registry (`naming.md` §6) gains `action`; `ui-timeline-item`'s own anatomy is UNCHANGED
  (the action cell is host-appended by `status-stream.ts`, mirroring the pre-existing `text` cell — no
  new anatomy in the shared, family-wide `timeline-item.ts`).
- `@agent-ui/icons`' `ICON_NAMES` grows from 28 to 29 (`clock`), vendored through the existing pipeline;
  `GROUP_STATUS_GLYPH` and `HEADER_STATUS_GLYPH` both gain a `pending` member (see Fork 3's reachability
  split, above).
- No catalog (A2UI) change ships with this build — `ui-status-stream` stays an `EXCLUSION_ALLOWLIST` entry
  (ADR-0122 F5), unaffected by this ADR.
