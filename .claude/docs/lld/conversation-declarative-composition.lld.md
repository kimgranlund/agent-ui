# LLD — `ui-conversation` declarative composition (GH #688): `ui-conversation-header` + `ui-conversation-dialog` + the adoption seam

> Status: proposed · v1 · 2026-08-10 · Layer: app (`app/src/controls/conversation/`) · designer (component-design)
>
> Refines: [ADR-0180](../adr/0180-conversation-declarative-composition-opt-in.md) (proposed — **the
> whole build is BLOCKED until Kim ratifies it**; this LLD exists so the builder starts the moment the
> flip lands, not so anyone starts sooner) · GH #688's four acceptance bullets ·
> [`app-surfaces-m2.spec.md`](../spec/app-surfaces-m2.spec.md) SPEC-R4 (amended on ratification, per
> ADR-0180's Repairs cell). Composes on: conversation.ts/.css/.md (shipped),
> conversation-composer.ts (the TKT-0056 extraction precedent), ADR-0023's public-method seam,
> GH #666's `setEmptyState` lifecycle. Build plan:
> [`../decompositions/conversation-declarative-composition.decomp.md`](../decompositions/conversation-declarative-composition.decomp.md)
> (two-plane, coverage clean, slices S1–S4).
>
> Every interface below was verified against shipped source in this intake (file:line cited) — never a
> doc summary. Acceptance criteria are the §7 checkable predicates; "done when good" appears nowhere.

## 1. Scope

Two NEW app-tier custom elements + one seam change in `ui-conversation`:

- `<ui-conversation-dialog>` — the log's mechanical role promoted to its own element (S1).
- `<ui-conversation-header>` — a new, fully author-composed non-scrolling band (S2).
- `ui-conversation.connected()` — adopt-or-create seating for dialog/composer, header recognition,
  band-order normalization, CSS migration (S3), then gates (S4).

No transport, catalog, or a2ui change anywhere. Both new tags are `@agent-ui/app` chrome —
catalog-invisible by construction (SPEC-R10's reasoning, no allowlist row).

## 2. Fork sheet — `ui-conversation-header`

| Row | Decision | Why |
|---|---|---|
| Tag | `ui-conversation-header` | family-derived (naming.md §13); no bare `ui-header` minted |
| Tier | `layout` | a band distributing author content; no control height (the `ui-conversation` precedent, conversation.md:10) |
| Base class | `UIElement` | reactive display shell; no value, no form role |
| Anatomy | host IS the band; light-DOM children are the CONSUMER'S OWN DOM, rendered as-authored — the family's one fully author-composed member | its entire job (ADR-0180 cl.3) |
| Props | none (v1) | KISS — chrome the author fills; nothing to configure yet |
| Events | none | nothing to announce; consumer wires its own content |
| Geometry | non-scrolling flex band; `padding: --ui-conversation-header-pad`; `border-block-end: 1px solid --ui-conversation-header-border`; `flex: 0 0 auto` | pinned by construction (ADR-0180 cl.3 — never sticky) |
| Tokens | `--ui-conversation-header-surface` ← `--md-sys-color-neutral-surface-low` · `-ink` ← `neutral-on-surface` · `-border` ← `neutral-outline-variant` · `-pad` ← `--md-sys-space-sm --md-sys-space-lg` | mirrors the conversation token block's roles (conversation.css:28–55); minted in its own `:where()` block, consumed only in its own `@scope` (ADR-0003 discipline) |
| A11y | no `internals.role` (generic) — the consumer's own content declares semantics (a heading, buttons…) | same posture as `ui-conversation` itself (conversation.md:136 `role: none`) |
| Interaction states | none beyond law defaults | static chrome |
| Form participation | `formAssociated: false` | structural |
| Site surfaces | descriptor `conversation-header.md` (slots: default children, author-composed) + a declarative-composition demo block on the conversation doc page | SPEC-R11's descriptor bar |

Standalone posture: legal only as a `ui-conversation` child by CONTRACT (descriptor states it);
outside one it renders as an inert band — no error, no warning (matching the fleet's degrade posture).

## 3. Fork sheet — `ui-conversation-dialog`

| Row | Decision | Why |
|---|---|---|
| Tag | `ui-conversation-dialog` | ticket-named; "dialog" = conversational sense; HTML `<dialog>` canon collision knowingly accepted, family-prefixed (ADR-0180 Consequences; naming.md §12 exception candidate at build) |
| Tier | `layout` | the scroll band; no control height |
| Base class | `UIElement` | structural |
| Anatomy | host IS the scroll region — turns/bubbles append as its direct children (all `[data-part]` turn anatomy from conversation.md:104–122 UNCHANGED, just re-parented from the old div to this element) | one shape both paths (ADR-0180 cl.1/2) |
| Props | none (v1) | the engine drives it; nothing author-configurable |
| Public methods | `isNearBottom(): boolean` · `followTail(wasNear: boolean): Promise<'skipped' \| 'settled' \| 'exhausted'>` | bodies moved VERBATIM from conversation.ts `#isNearLogBottom` (:1027–:1030) and `#tailFollowLog` (:1051–:1076), `this.#log!` → `this`; constants (`LOG_STICK_THRESHOLD_PX` 24 · `TAIL_FOLLOW_STABLE_CHECKS` 3 · `TAIL_FOLLOW_CHECK_MS` 40 · `TAIL_FOLLOW_MAX_CHECKS` 25, conversation.ts:305–308) move with them — ADR-0023 public-method seam; the timer-paced-on-purpose doc block (:1043–:1050) moves too, it is load-bearing |
| Events | none | scroll state is a method query, not an event (no closed-vocabulary member fits; inventing one is the fork this LLD does not take) |
| Geometry | `flex: 1 1 auto; min-block-size: 0; overflow-y: auto; padding: --ui-conversation-dialog-pad; display: flex; flex-direction: column; gap: 0.65rem` (the turn-stacking layout — turns are the scroller's flex children — moves with the scroll region) | the log rules move over from conversation.css:75–84, values unchanged (`-log-pad` token aliased, §5) |
| Tokens | `--ui-conversation-dialog-pad` ← `--md-sys-space-lg` (the old `--ui-conversation-log-pad` value) · scrollbar-width consumer-seam preserved (conversation.css:79) | rename-with-alias, §5 |
| A11y | `this.internals.role = 'log'` (implicit `aria-live="polite"`) + `this.internals.ariaLive = 'polite'` explicit belt | STRICTLY better than today's bare `aria-live` attribute (role `log` is the platform's chat-log semantic) AND fleet-law compliant (ARIA via internals — element.ts:281–286, never host attributes) |
| Interaction states | none | scroll chrome only |
| Form participation | `formAssociated: false` | structural |
| Site surfaces | descriptor `conversation-dialog.md` + the same demo block | SPEC-R11 |

NOT standalone-imperative: it exposes NO `addUserMessage`/turn API — the engine stays on
`ui-conversation` (ADR-0180 cl.2). Outside a `ui-conversation` it is an inert scrollable live region.

## 4. The adoption seam — `ui-conversation.connected()` (conversation.ts:347–:400 rewritten)

```ts
// S3 — adopt-or-create. ALL three lookups are :scope > direct-child, connect-time only.
const authoredHeader = this.querySelector<UIConversationHeaderElement>(':scope > ui-conversation-header')
const authoredDialog = this.querySelector<UIConversationDialogElement>(':scope > ui-conversation-dialog')
const authoredComposer = this.querySelector<UIConversationComposerElement>(':scope > ui-conversation-composer')

if (this.#log === undefined) {
  const dialog = authoredDialog ?? (document.createElement('ui-conversation-dialog') as UIConversationDialogElement)
  dialog.dataset.part = 'log'            // the compat spine — every shipped selector keys on [data-part="log"]
  this.#log = dialog                     // #log's TYPE narrows to UIConversationDialogElement
  const composer = authoredComposer ?? (document.createElement('ui-conversation-composer') as UIConversationComposerElement)
  // …the existing forwarder registrations (:361–:375) run UNCHANGED against `composer` —
  // they already read #onXCb fresh per invocation (LLD CVC-C5), adopted or created alike.
  this.#composer = composer
  // Canonical band order, normalized by re-append (append MOVES an existing child; connect-time
  // only — no turn state, no focus, no CodeMirror-class stateful child exists yet):
  if (authoredHeader) this.append(authoredHeader)
  this.append(dialog, composer)
  if (this.#emptyState !== undefined) dialog.prepend(this.#emptyState)   // GH #666 seating, unchanged
}
```

- `#log`'s field type: `HTMLElement | undefined` → `UIConversationDialogElement | undefined`; the two
  private scroll helpers DELETE and their seven call sites (`#isNearLogBottom` :405/:434/:935 ·
  `#tailFollowLog` :412/:470/:715/:945 — grep both helper names) become `this.#log.isNearBottom()` /
  `void this.#log.followTail(wasNear)` — mechanical, same semantics.
- `aria-live` attribute write (:351) DELETES — the dialog's own internals carry it (§3).
- The header is NEVER created and NEVER touched by any imperative method; absent ⇒ today's DOM shape
  minus nothing.
- Adopted-dialog author children: preserved at adoption (turns append after); cleared by `reset()`
  (:880's `replaceChildren` law unchanged — empty-state node the one survivor).
- Pre-connect discipline (`#guard`, :1080) unchanged: adoption happens at connect; a pre-connect call
  is the same documented no-op it is today.
- `disconnected()` (:907) unchanged — registry closure logic never touches the log node identity.

## 5. CSS migration (S3, same slice as §4 — the seam and the sheet move together)

- `conversation.css` `[data-part='log']` block (:75–:84, including the `display: flex;
  flex-direction: column; gap: 0.65rem` turn-stacking rules at :81–:83) MOVES to `conversation-dialog.css`
  (`:where(ui-conversation-dialog)` tokens + `@scope (ui-conversation-dialog)` styles). The selector
  inside the conversation sheet becomes unnecessary; a one-line alias keeps the old token name live:
  `--ui-conversation-dialog-pad: var(--ui-conversation-log-pad, var(--md-sys-space-lg))` — a consumer
  that set `--ui-conversation-log-pad` keeps working (rename-with-alias, never a silent break).
- `conversation-header.css` is new (§2's tokens/geometry); linked via the package `./conversation-header.css`
  export exactly as `conversation.css`/`conversation-composer.css` are (behaviour-only `.ts`, plan §2).
- The host's flex column (conversation.css:59–:72) is UNCHANGED — the header band slots in as a plain
  first child with `flex: 0 0 auto`.

## 6. Descriptor/doc changes (S3)

- `conversation.md`: `slots:` restates from `[]` to the recognized-children contract (three named
  child tags, all optional, adopt-or-create semantics; STILL not platform slots — light-DOM law);
  `childModel`/`contentModel`/`aria` rows re-state the same delta; `composes:` gains the two new tags.
  Blocked on ADR-0180 ratification (it contradicts SPEC-R4's current text otherwise).
- New `conversation-dialog.md` / `conversation-header.md` descriptors per §2/§3 (contract↔props
  trip-wire green — both have empty `props`, the trip-wire still pins that).

## 7. Test plan (S1/S2 co-located units · S4 browser) — the acceptance predicates

1. **Byte-identical default (jsdom + browser):** mount `<ui-conversation>` with no children; assert
   the full existing conversation.test.ts/browser suite green UNCHANGED except the one deliberate
   delta — `[data-part="log"]` is now tagName `UI-CONVERSATION-DIALOG` (one assertion updated, named
   in the PR body as ADR-0180 cl.1's chosen delta).
2. **Declarative adoption:** author all three children → after connect, `#log` IS the authored dialog
   (identity, `===`), the composer forwarders fire (submit → `onSubmit` cb), the header is untouched
   and first in DOM order.
3. **Partial authoring:** header-only → dialog+composer created after it, canonical order asserted;
   composer-only → same; dialog-with-children → children preserved, `addUserMessage` appends AFTER
   them; `reset()` clears them, empty-state node survives (GH #666 parity).
4. **Imperative identity both paths:** run the same script (addUserMessage → beginAgentTurn →
   ingestLine createSurface → setNote → finalize(actions) → action event → reset) against a
   no-children mount AND an all-authored mount; assert identical resulting DOM shape (same
   `[data-part]` tree) and identical callback traces.
5. **Scroll law (browser, real engine):** SPEC-R4 AC2's pair (follow when near, hold when reading
   history) re-run against the dialog element; `followTail` resolution values asserted
   (`'skipped'`/`'settled'` — the GH #365 contract).
6. **A11y:** dialog's computed role is `log` (browser: `internals` reflection), no `aria-live` HOST
   attribute anywhere; header has no role.
7. **Gates (S4):** `npm run check` + `npm test` + `npm run test:browser` exit 0 (exit codes, never
   grep counts) · descriptor trip-wires green · catalog residue guard unaffected (SPEC-R10 AC1) ·
   `npm run size` re-measured, `@agent-ui/app` budget re-based BEFORE S1's first commit (SPEC-R11's
   kickoff discipline — two new elements will not fit current headroom).

## 8. Risks / non-decisions (recorded here, not manufactured into ADRs)

- **Tag-visible internal delta** (div → `ui-conversation-dialog`): chosen and named in ADR-0180;
  the in-tree grep (20 `[data-part="log"]` sites, zero tag-qualified) is the evidence; test 1 pins it.
- **`agent-admin.browser.test.ts:2636`'s `:scope > [data-part="log"]`**: still matches — the dialog
  stays a direct child. No test rewrite beyond test 1's tagName assertion.
- **Header props (kicker text, actions slot conventions)**: deliberately NOT designed — v1 is a bare
  band; a props surface is a future additive intake if real consumers ask (default-no on speculative
  API).
- **`ui-conversation-composer` outside a `ui-conversation`**: no standalone use ships today (the
  former agent-admin `#createAuthorEmpty` use was removed by GH #684 — `agent-admin.ts:1271–1273`'s
  record); if one ever appears, it never enters the adoption path (the `:scope >` direct-child lookup
  is the fence).
- **jsdom vs internals role reflection**: role assertions may need the browser shard (the fleet's
  known jsdom internals gap) — test 6 is placed in the browser leg for that reason.
- **Non-ADR non-decision**: whether the site gallery gets a dedicated declarative-composition page
  vs a doc-page block — S4 implementer's call, cosmetic either way.
