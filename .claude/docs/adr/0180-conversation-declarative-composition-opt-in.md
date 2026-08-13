# ADR-0180 — `ui-conversation` declarative composition: an explicit OPT-IN adoption mode (header/dialog/composer as authorable children) carved out beside SPEC-R4's imperative-only default

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-10
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-10 |
> | **Proposed by** | design intake for [GH #688](https://github.com/kimgranlund/agent-ui/issues/688) (the ticket's own Scope section routes here: "a fork from a ratified decision, not a clean extension") — decomposition [`conversation-declarative-composition.decomp.md`](../decompositions/conversation-declarative-composition.decomp.md), two-plane coverage clean · LLD [`conversation-declarative-composition.lld.md`](../lld/conversation-declarative-composition.lld.md) (proposed, same wave) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-10, via the [`ratify ADR-0180` utterance](https://github.com/kimgranlund/agent-ui/issues/688#issuecomment-5243253369) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification: [`app-surfaces-m2.spec.md`](../spec/app-surfaces-m2.spec.md) gains an append-only amendment block — SPEC-R4's "the DOM is never author-composed" gains its delta ("never by default; an explicit opt-in declarative adoption mode exists, ADR-0180") + a NEW SPEC-R13 stating the declarative contract (clauses 1–4 below) · [`conversation.md`](../../../packages/agent-ui/app/src/controls/conversation/conversation.md) `slots:`/`childModel`/`contentModel` rows restate (line 102's "no slotted children" is superseded by the recognized-children contract) · on ratification+build: the S1–S4 slices the decomposition sequences (two new element file-triples · the `connected()` adoption seam · CSS migration · descriptor trip-wires · `@agent-ui/app` size re-base per SPEC-R11's discipline) |
> | **Supersedes / Superseded by** | **Extends [ADR-0129](./0129-app-surfaces-m2-composition-and-transport-boundary.md) (partial)** — the composition boundary its Repairs minted (SPEC-R4's "the DOM is never author-composed", `app-surfaces-m2.spec.md:71`) gains an explicit opt-in adoption mode; ADR-0129's own clauses stand byte-untouched, including clause 2's per-surface internal `ui-surface-host` composition/identity rules (LLD §3 keeps both registries + `AgentTurnHandle` on `UIConversationElement`) and clauses 1 (transport boundary), 3 (narration/disclosure), 4 (migration scope). Relates [ADR-0023](./0023-components-mount-directive-host-public-seam.md) (the public-method seam `followTail`/`isNearBottom` ride) · TKT-0056/TKT-0058 (the composer-extraction precedent this generalizes) · [ADR-0160](./0160-chat-redesign-agent-bubble-reversal-header-flat-action-chips.md) (turn chrome unchanged inside the dialog) · GH #666 (the empty-state lifecycle rule clause 4 composes with) |

## Context

GH #688 asks for the common declarative three-part chat shape — `<ui-conversation-header>` /
`<ui-conversation-dialog>` / `<ui-conversation-composer>` authored as light-DOM children of
`<ui-conversation>` — where today the thread is an internal `div[data-part="log"]` and the composer a
JS-created child, and the contract says so in three ratified places: SPEC-R4 ("the thread's DOM is not a
composition surface the developer authors"), ADR-0129 clause 2 (internal composition, ratified by Kim
2026-07-12), and `conversation.md:102` (`slots: []`, "no slotted children"). This is therefore a fork
from a ratified decision and cannot ship as a silent SPEC violation — the ticket says so itself.

What has changed since ADR-0129: `<ui-conversation-composer>` already exists as its own tagged element
(TKT-0056/0058) — the "own tag, composable" treatment exists for one of the three parts, just not as a
child-of-`ui-conversation` contract. (GH #688's own body cites a standalone agent-admin use,
`#createAuthorEmpty`; that premise is stale — GH #684, Kim's 2026-08-10 ruling, removed it entirely
(`agent-admin.ts:1271–1273`'s record), and no standalone `ui-conversation-composer` creation exists
in-tree today. The precedent that carries this ADR is the tag's existence, not that dead example.) And the imperative engine has grown path-independent seams
(GH #666's `setEmptyState`, SPEC-R12's `setContentRenderer`) that already demonstrate the pattern this
ADR generalizes: consumer-supplied DOM seated by the element, engine unchanged.

Four questions the ticket names as unresolved are decided below (clauses 1–4), each with the mechanics
that force it. Everything here is design-seat output — status `proposed`, no build before Kim's flip.

## Decision

1. **Strictly additive, opt-in — the declarative path never replaces the internal one.** A consumer
   that authors no children gets byte-identical behavior (the standing law every prior
   `ui-conversation` prop already follows: `receipt`, `sources`, `models`…, all default-off). The
   internal JS-composition path is not deprecated and not scheduled for replacement — three shipped
   consumers (a2ui-chat, a2ui-live, agent-admin) drive it imperatively with zero children, and
   replacement would buy nothing while touching all three. Two deliberate DOM-observable deltas ride this,
   moving together as one change of the log's identity: (a) the internal log vehicle is PROMOTED from
   `div[data-part="log"]` to a JS-created `<ui-conversation-dialog data-part="log">` — the exact
   TKT-0056 composer-extraction precedent — so ONE engine drives one structural shape on both paths;
   (b) the `aria-live` channel moves off the host-written attribute to the element's own
   `ElementInternals` (fleet law: ARIA via internals, never host attributes). Every shipped
   selector/test keys on `[data-part="log"]`, tag-agnostic — grep `data-part=.log.` across ts/css/html,
   both quote styles: ZERO tag-qualified matches, the load-bearing claim (the absolute site count is
   pattern-dependent and not relied on); no shipped test asserts the log's tagName or `aria-live`
   placement.

2. **Adoption, not a parallel imperative surface.** `<ui-conversation>` looks up an author-supplied
   `:scope > ui-conversation-dialog` at connect and seats it as `#log`; it does NOT grow a second
   imperative API on the dialog element. `UIConversationDialogElement` owns only the log's MECHANICAL
   role — the scroll region, `role=log` (implicit `aria-live="polite"`, with an explicit
   `internals.ariaLive` belt), and the stick-to-bottom pair promoted as public methods
   (`isNearBottom()` / `followTail(wasNear)`, the ADR-0023 public-method-seam precedent, bodies moved
   verbatim from `#isNearLogBottom`/`#tailFollowLog`). The turn engine — both surface registries,
   `AgentTurnHandle`, narration, the busy counter — stays solely on `UIConversationElement`.
   *Rejected alternative:* a parallel imperative surface on the dialog would duplicate the entire
   engine (registry identity, genui registry, TKT-0034 busy accounting) across two owners that would
   immediately drift — the exact two-implementations failure ADR-0129 clause 4 exists to prevent.

3. **`<ui-conversation-header>` is a plain non-scrolling band sibling — never `position: sticky` in a
   shared scroll region.** The host is already a flex column; the band order becomes header (optional)
   → dialog (`flex: 1 1 auto`, the scroller) → composer. The header is trivially pinned by not being
   inside the scroller, which satisfies the ticket's acceptance ("remains visible while the dialog
   beneath it scrolls") with zero change to the scroll mechanics: the scrolling element stays the log
   itself, so `#isNearLogBottom`/`#tailFollowLog`'s math and SPEC-R4 AC2's sampled-once guard (with
   its biting negative control on record) are untouched. A sticky-in-shared-scroller shape would
   re-home the scroll owner and re-derive that guarded machinery for no additional capability. The
   header is the family's ONE fully author-composed member (its children are the consumer's own DOM —
   title, avatar, actions); it is never created internally — absent means today's shape, and the
   imperative API never touches it.

4. **The imperative API is path-blind by construction.** Every method already writes through the
   seated `#log`/`#composer` references; adoption only changes HOW those references get seated
   (adopt-if-authored, else create), so `addUserMessage` / `beginAgentTurn`+`AgentTurnHandle` /
   `reset` / `setContentRenderer` / `setEmptyState` gain zero mode branches — identity under both
   paths is structural, not promised. An authored `<ui-conversation-composer>` child is adopted the
   same way (the callback forwarders in `connected()` register against the adopted instance
   identically — they already read their `#onXCb` fields fresh per invocation, LLD CVC-C5). Lifecycle
   rules stated once: an adopted dialog's author-authored children are preserved at adoption as
   initial content (turns append after them); `reset()` clears them (a reset thread is empty — the
   same statement `reset()` already makes, with GH #666's empty-state node still the one survivor);
   band order is normalized at connect by re-appending in canonical order (connect-time only, before
   any turn state exists).

5. **The SPEC is amended append-only, on ratification.** SPEC-R4's body text stays verbatim; the
   amendment block records the delta and a new SPEC-R13 carries the declarative contract + ACs (the
   ticket's own four acceptance bullets, made checkable). SPEC-R10's catalog invisibility extends to
   both new tags by construction (app-tier, outside the catalog gate's scan scope — no allowlist row);
   SPEC-R11's size discipline applies (re-measure `@agent-ui/app`, re-base before the first slice).

## Alternatives considered

- **A parallel imperative surface on `<ui-conversation-dialog>`** — rejected in clause 2 (engine
  duplication/drift).
- **`position: sticky` header inside one shared scroller** — rejected in clause 3 (re-homes the
  scroll owner; regression surface on the guarded tail-follow with no capability gained).
- **Keep the internal `div` and mint the element only on the declarative path** — rejected: two
  structural shapes for one engine; every scroll/live-region behavior and test forks per path,
  the opposite of clause 4's structural identity.
- **Shadow-DOM slots** — rejected: the fleet is light-DOM by construction (CLAUDE.md law);
  "slots" here means a recognized-children contract, not platform `<slot>`.
- **Replace the imperative composition outright** — rejected in clause 1 (three shipped consumers,
  zero benefit, maximal churn).

## Consequences

- SPEC-R4's absolute ("never author-composed") narrows to "never by default; explicit opt-in
  adoption exists" — a real weakening of a ratified guarantee, which is exactly why this is an ADR
  and not a patch. The trusted-frame law (PRD-D2) is unaffected: authored children are page-author
  DOM, not agent-emitted content; both new tags stay catalog-invisible.
- Naming: `ui-conversation-dialog` reuses "dialog" in the conversational sense while the HTML canon
  reserves `<dialog>` for modals — accepted knowingly (family-prefixed, no bare `ui-dialog` minted;
  the ticket names the tag) and recorded as a `references/naming.md` §12 exception candidate at build.
- Internal-DOM delta: the default log's tag changes `div` → `ui-conversation-dialog` (clause 1). A
  consumer styling `div[data-part="log"]` by tag would break; none exists in-tree, and the descriptor
  documents parts, not tags. Named here so the risk is chosen, not discovered.
- Stale → repair on ratification: the Repairs cell's list (SPEC amendment · `conversation.md`
  restate · size re-base) plus `agent-ui-compose-app`/site docs if they teach the "never
  author-composed" line verbatim.
- Build stays BLOCKED until Kim flips this record — the `proposed` marker is the real gate.
