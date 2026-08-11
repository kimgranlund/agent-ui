---
# conversation-dialog.md frontmatter — the attributes-as-API descriptor for ui-conversation-dialog
# (ADR-0004 · ADR-0180 · GH #688). The machine-checkable public surface lives HERE (frontmatter); the prose
# below the fence is the /site doc. `attributes: []` is the deliberate, verified-parseable empty sequence
# (the ui-toast-region/ui-form-provider precedent) — conversation-dialog.ts declares
# `static props = {} satisfies PropsSchema`; the contract↔props trip-wire (conversation-dialog.test.ts)
# targets the empty bijection. Field set per .claude/docs/plan.md §10 / ADR-0004. NOT catalogued — app-tier
# chrome, outside the catalog gate's scan scope (SPEC-R10, ADR-0180 §5's "no allowlist row").
tag: ui-conversation-dialog
tier: layout             # geometry size-class — a flex-scroll band with no control height of its own (the ui-conversation precedent, conversation.md:10)
extends: UIElement       # a plain structural base — no value, no form role; the engine (ui-conversation) drives its content
# marginal: measured at the @agent-ui/app integration slice (scripts/measure-size.mjs), folded into ui-conversation's own family total (the TKT-0056 composer-extraction precedent — no new package)

attributes: []            # the engine drives this element's content; nothing here is author-configurable in v1 (LLD §3)

properties:                # the public IDL — with no attributes, this is the entire public surface beyond the platform's own scroll properties
  - name: isNearBottom
    description: 'Method — isNearBottom(): boolean. The stick-to-bottom guard''s own probe (SPEC-R4 AC2): true when this element''s scroll position sits within 24px of its own bottom edge. `ui-conversation` samples this ONCE per turn, before that turn''s own content starts growing — never re-sampled reactively mid-turn (a naive reactive-scroll-listener regresses this — the a2ui-chat.ts banner''s own documented failure mode). Moved verbatim off `ui-conversation`''s own (now-deleted) `#isNearLogBottom` (ADR-0023 public-method seam).'
  - name: followTail
    description: 'Method — followTail(wasNear: boolean): Promise<''skipped''|''settled''|''exhausted''>. Scrolls to this element''s newest content IFF `wasNear` held; resolves `''skipped''` otherwise, `''settled''` once the scroll extent has held still for 3 consecutive 40ms checks, or `''exhausted''` at a ~1s ceiling (GH #365 — the three distinguishable outcomes). Never rejects — every call site is fire-and-forget. Timer-paced on purpose (this is a WRITER, not an observer of a smooth `scrollIntoView`) — see the source comment for why frame-pacing would make it worse at its actual job. Moved verbatim off `ui-conversation`''s own (now-deleted) `#tailFollowLog` (ADR-0023 public-method seam).'

events: []                 # scroll state is a method query, not an event — no closed-vocabulary member fits (LLD §3)

slots:
  - name: default
    optional: true
    description: 'When authored as a direct `ui-conversation` child (ADR-0180''s declarative adoption path), any pre-existing children are PRESERVED at adoption as initial content — later turns/bubbles (`ui-conversation`''s own [data-part] anatomy) append AFTER them; `reset()` clears them (a reset conversation is empty again, the SAME statement `reset()` already makes about turns). Standalone (outside `ui-conversation`), a consumer may put anything here too — nothing here is engine-owned; this element itself never reads, validates, or reacts to its own children.'

parts: []                  # this element creates NO light-DOM parts of its own — the turn/bubble/who/narration/mounts/… anatomy appended into it is ALL ui-conversation's own [data-part] markers (conversation.md's own parts: block), documented there, not here. The compat-spine `dataset.part = 'log'` marker itself is written by ui-conversation's connect-time seating, also documented on conversation.md.

customStates: []           # no :state() hooks — this element carries no interaction state of its own

face:
  formAssociated: false    # NOT a FACE form control — a scroll/live-region primitive contributes nothing to a form

aria:
  role: log                # a POLITE live region — role=log carries an implicit aria-relevant="additions" default (the ui-status-stream precedent)
  roleSource: internals    # this.internals.role — set in the constructor, before insertion; PLUS an explicit internals.ariaLive='polite' belt (ADR-0180 cl.1b) — never a host `role`/`aria-live` attribute
  childModel: none of this element's own — its children are EITHER ui-conversation's own [data-part] turn/bubble anatomy (appended by the engine) OR, when authored directly, the consumer's own initial-content DOM (preserved at adoption); this element itself imposes no structure

keyboard: []                # no keyboard interaction of its own — a scroll region's native scroll keys (arrow/PageUp/PageDown/Home/End) are the platform's, not a control behaviour this element adds

geometry:
  sizeClass: layout                 # a flex-scroll band — no control height of its own
  blockSize: consumer-supplied      # fills its flex parent (flex: 1 1 auto) when composed inside ui-conversation's own flex column; give it a definite block-size directly when mounted standalone (the ui-surface-host precedent)
  paddingBlock: consumer-supplied   # `--ui-conversation-dialog-pad` (default the fleet's --md-sys-space-lg, rename-with-alias off the old --ui-conversation-log-pad name) — this element owns its own inset, unlike ui-conversation's host (paddingBlock: 0)

forcedColors: No forced-colors rule of its own — this element paints no border/surface (a transparent scroll region); the turn/bubble chrome appended into it (ui-conversation's own anatomy) carries conversation.css's forced-colors handling.
---

# ui-conversation-dialog

`ui-conversation-dialog` is the **scrolling message-thread's mechanical role**, promoted to its own
registered custom element (ADR-0180, GH #688) — a structural, **non-form-associated** `UIElement`, light-DOM
by default. It owns exactly three things: the scroll region (`flex: 1 1 auto; overflow-y: auto`), the live-
region semantics (`role="log"`, a polite `aria-live`), and the stick-to-bottom pair
(`isNearBottom()`/`followTail()`) — moved verbatim off `ui-conversation`, which used to build this as a bare
`div[data-part="log"]` internally.

```html
<ui-conversation-dialog></ui-conversation-dialog>
```

## Adopted by `ui-conversation`, never a second imperative surface (ADR-0180 clause 2)

`ui-conversation` looks up an author-supplied `:scope > ui-conversation-dialog` at connect and seats it as
its own `#log`; absent, it creates one. Either way, `ui-conversation` drives EVERY turn/bubble append
directly onto this element (`this.#log.append(...)`) and reads its scroll state through the two public
methods below — this element grows **no** turn/registry/`AgentTurnHandle` API of its own. That whole engine
— both per-surface registries, narration, the busy counter — stays solely on `ui-conversation`
(`conversation.md`).

```ts
const dialog = conv.querySelector('ui-conversation-dialog') // when authored declaratively
dialog.isNearBottom() // true within 24px of the bottom edge
await dialog.followTail(true) // 'skipped' | 'settled' | 'exhausted' (GH #365)
```

## Legal standalone

Outside a `ui-conversation`, this element is an inert scrollable live region — nothing routed into it,
nothing throws. `ui-conversation` is what drives real content into it; this element itself never reacts to
its own children.

## Accessibility

`internals.role = 'log'` (a POLITE live region, the `ui-status-stream` precedent) plus an explicit
`internals.ariaLive = 'polite'` belt — both set in the constructor, before insertion. STRICTLY better than
the pre-ADR-0180 shape, which wrote a bare `aria-live` attribute directly onto the internal `div` (ARIA via
internals, never host attributes — the fleet law).
