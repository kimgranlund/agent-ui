# LLD — Shell archetypes M5

> Status: proposed · v0.1 · 2026-07-20 · Layer: LLD (implementation plan)
> Implements: [`../spec/shell-archetypes-m5.spec.md`](../spec/shell-archetypes-m5.spec.md) (`SPEC-R1…R4`, plus the v0.2 amendment `SPEC-R5` this LLD's C3 drives). Refines ADR-0151 (in-flight on PR #45).
> Altitude: owns **how the rest of M5 is built** — the five-round review plan's own component map, concrete interfaces, and build sequence. Behavior is the SPEC's; this doc never re-derives it. **§7's fork is RESOLVED — Kim ruled Option C (2026-07-20), recorded as [ADR-0156](../adr/0156-deprecate-app-shell-for-super-shell-family.md) (proposed); §7.1 closes with the ruling.**

## 1. Component map (LLD-C# → round → files)

| LLD-C | Component | Round | Files |
|---|---|---|---|
| **LLD-C1** | Per-region ARIA landmarks | 1 | `super-shell/super-shell.ts` |
| **LLD-C2** | The SPEC's "Composes on" claim, corrected | 1 | `../spec/shell-archetypes-m5.spec.md` |
| **LLD-C3** | Grammar amendment — N stacked panes per side, asymmetric sides | 3 | `../spec/shell-archetypes-m5.spec.md` (v0.2) |
| **LLD-C4** | `narrow-left`/`narrow-right`/`collapsed-left`/`collapsed-right` → logical `start`/`end` | 2 | `super-shell/super-shell.ts`, `.css` |
| **LLD-C5** | `ui-workspace-shell` | 3 | `workspace-shell/workspace-shell.{ts,css,md,test.ts}` |
| **LLD-C6** | `ui-chat-shell` | 4 | `chat-shell/chat-shell.{ts,css,md,test.ts}` |
| **LLD-C7** | Shared breakpoint token | 5 | a new generated-CSS or build-time constant, consumed by app-shell/master-detail/nav-rail/super-shell |
| **LLD-C8** | Gates (jsdom + cross-engine browser) per component above | 1–5 | each component's own `.test.ts`/`.browser.test.ts` |

## 2. Round 1 — LLD-C1: per-region ARIA landmarks

**Problem.** `ui-super-shell` sets `role: none` / `roleSource: none` — zero landmarks on any region, full punt to consumer content. Its own sibling `ui-app-shell-region` (same package) has a full region↔landmark map plus an ADR-0083-ratified override, and nothing in super-shell reuses or mirrors it.

**Design — a region-role map keyed by SLOT NAME, not a new custom element.** The middle-row/bar wrapper parts (`[data-part='rail']` ×2, `[data-part='pane']` ×2, `[data-part='canvas']`, `[data-part='bar'][data-bar='header'|'footer']`) are plain, non-custom `<div>`s `#compose()` creates — they carry no `ElementInternals` of their own (that handle exists only on the host custom element), so the role is set as a REAL `role="…"` attribute directly on each wrapper at compose time (parts are built once — SPEC-R3's behavior-only law — so this is a one-time write, not a reactive effect):

```
SLOT_ROLE = {
  header: 'banner', footer: 'contentinfo', content: 'main',
  'global-nav': 'navigation', 'nav-pane': 'navigation',
  'global-options': 'complementary', 'options-pane': 'complementary',
}
```

**Override.** An authored child MAY carry `data-landmark="X"` (X ∈ app-shell's own `LANDMARK_VALUES` set — banner/navigation/main/complementary/contentinfo/region/form/search, reused verbatim for vocabulary consistency) to override its slot's default landmark — read from the FIRST such child in that slot at compose time, mirroring ADR-0083's "role decoupled from placement" precedent, but data-attribute-driven since super-shell's placement is itself data-attribute-driven (no per-region prop to hang a `landmark` enum off of the way `ui-app-shell-region` does). Absent ⇒ falls through to `SLOT_ROLE[slot]`, the SAME `||`-fallthrough law (`data-landmark ?? SLOT_ROLE[slot]`, `??` is correct here since the attribute is genuinely absent rather than empty-string-present).

**One `main` per document** stays author responsibility — the same disclaimer app-shell's own descriptor already carries; no generic element can enforce it cross-instance.

**Not building:** a new `ui-super-shell-region` custom element mirroring `ui-app-shell-region` 1:1. The wrapper parts have no other behavior (no `collapse="toggle"`-style per-part interactivity today), so a bare attribute satisfies SPEC-R3 AC2-equivalent behavior without adding a fourth shell-family tag for a single-attribute concern. Revisit if a part ever needs real per-part behavior beyond role.

## 3. Round 1 — LLD-C2: the SPEC's "Composes on" claim, corrected

**Problem.** `shell-archetypes-m5.spec.md`'s header claims "Composes on: ADR-0082/0083/0084 (the frame contract)" — read as literal code reuse. `super-shell.ts` imports only `@agent-ui/components/controls/{button,icon}`; nothing from `app-shell`, `master-detail`, or `nav-rail`.

**Fix.** Reword the citation from implying code-level composition to stating what's actually true: `ui-super-shell` is an INDEPENDENT implementation that follows the SAME established patterns as its siblings (container-type-driven collapse, a landmark-role map with an override, the behavior-only vehicle law) without importing their code. This is a documentation-truth correction, not a mandate to re-architect — §7 covers the deeper "should it actually import" question separately, since that one has real trade-offs worth a ruling rather than a silent fix.

## 4. Round 2 — LLD-C4: logical direction (i18n/RTL)

**Problem.** `collapsed-left`/`collapsed-right`, `narrow-left`/`narrow-right`, and the toggle `aria-label`s ("Toggle left panes"/"Toggle right panes") are all physical. Never verified under `dir="rtl"`.

**Design (refined during build — simpler than the original sketch, same fork resolved the same direction).** Rename the reflected props/attributes to logical `collapsed-start`/`collapsed-end`, `narrow-start`/`narrow-end`. The DOM's `data-side` markers on the rail/pane parts ALSO become logical (`start`/`end`, not `left`/`right`) — since `[data-part='middle']` is a plain row-flex container with no `flex-direction` override, the browser's own bidi reversal under an ambient `dir="rtl"` already mirrors DOM-first-child to the physical right for free (the `ui-split` precedent: `getComputedStyle(this).direction === 'rtl'`, split.ts, is how the fleet reads direction in JS — but round 2 needs it NOWHERE, because nothing here computes a physical side anymore; `data-side='start'` always means "the first rail/pane in DOM order," full stop, regardless of physical rendering). This is strictly simpler than the original `:dir()`-selector sketch: no `:dir()` CSS at all, no runtime direction read in `#makeToggle`'s wide arm — logical in, logical out, physical placement is the browser's own bidi job. Toggle `aria-label`s become "Toggle start panes"/"Toggle end panes".

**Migration note.** `collapsed-left`/`collapsed-right`/`narrow-left`/`narrow-right` are pre-existing shipped attribute names (PR #88/#91) with exactly one consumer today (`site/pages/_page.ts`'s `narrow-left="stack"`) — that call site updates in the SAME PR, so this is a same-PR rename, not a deprecation window (no external consumers exist yet to break).

## 5. Round 3 — LLD-C3: grammar amendment (N stacked panes, asymmetric sides)

**Problem.** Two Figma frames (`app-shell-layout-single-nav` node 39:1629, `app-shell-layout-dual-sidebar` node 39:1596) show a side with an extra `section-nav` pane stacked beside the primary `nav-pane`/`sidebar`, and the two sides don't match in region count (dual-sidebar: left = rail + pane + pane, right = pane + rail).

**Amendment to SPEC-R1a.** A side is `rail? + pane*` (zero or more stacked panes, was `pane?`), and the two sides are independently composed — R1a's "one side definition, instantiated twice" still holds for the RAIL, but the pane stack's cardinality and the section-nav register are per-side, not forced-symmetric. New named slot: `section-nav` (an additional stackable pane beside `nav-pane`; `options-section` as its right-side mirror, though the reference frames only show it on the left — SPEC-R1a's absence law already covers "authored on one side only").

**Build impact (super-shell.ts).** `SLOTS` grows two members (`section-nav`, `options-section`); `place()`'s per-side calls become a loop over an ordered stack (`['global-nav', 'nav-pane', 'section-nav']` left, mirrored right) instead of two fixed calls; each stacked pane keeps its own `data-slot-name` for CSS targeting. Collapse stays per-SIDE (SPEC-R2a unchanged) — the paired toggle collapses the whole stack together, not per-pane; a future per-pane collapse is a separate fork if a real frame ever needs it (none do yet — YAGNI until a reference shows otherwise).

## 6. Round 4 — LLD-C6 & Round 3 — LLD-C5: `ui-chat-shell` / `ui-workspace-shell`

Both are thin `@agent-ui/app` compositions over the (amended) `ui-super-shell` grammar, per ADR-0151 rule 2 (behavior-only, no data/transport/navigation ownership):

- **`ui-workspace-shell`** composes the full grammar the two newest frames specify — header, global-nav rail, nav-pane, section-nav, content, options-pane, global-options rail, footer — as a fixed preset with sensible defaults, so a consumer doesn't hand-author all seven-plus slots themselves. Reproduces both reference frames as its own documented usage examples (round 3's acceptance criterion).
- **`ui-chat-shell`** composes a narrower slice — header, nav-pane (conversation list), content (the active thread), no options side — with at least one real page migrating onto it to prove the extraction is real, not cosmetic (round 4's acceptance criterion).

Both ship their own descriptor + jsdom/browser tests, following LLD-C1–C8's shape.

**Correction (round 4 build finding).** This section's original sketch claimed `ui-chat-shell` would be "extracted from a2ui-chat/agent-admin's existing hand-rolled chrome" — checked against the actual code and found FALSE: neither page hand-rolls a nav-pane/conversation-list. `agent-admin.ts` composes `ui-split` (a canvas pane + a settings/context tabs pane, no thread list); `a2ui-chat.ts` is header + `ui-conversation` + page-status chrome only (its own comment already states the old hand-built thread/composer/registry chrome was deleted when `ui-conversation` shipped); `ui-conversation` itself (`conversation.ts`) is pure message-feed + composer, no header/nav concept. What genuinely ships as an extraction: `a2ui-chat.ts`'s own hand-rolled `.chat-shell` (a flex-column div) and `.chat-head` (its header bar) — real page-chrome CSS/DOM construction, deleted in the same PR that migrates the page onto `ui-chat-shell`. `nav-pane` ships as part of the archetype's grammar (matching `ui-workspace-shell`'s sibling shape) but has no content provider in this migration — the absence law, not a gap. A genuine ordering hazard surfaced during the build: `ui-chat-shell` composes its inner `ui-super-shell` from `this.children` AT CONNECT time, so a caller that appends the element to the live DOM BEFORE appending its own children (a pattern harmless for a plain `<div>`, which `a2ui-chat.ts` used before this migration) composes it empty, permanently (`#compose()`'s once-only guard never re-fires) — `a2ui-chat.ts` now builds every child first and appends `shell` to the live region last.

## 7. Open fork — needs Kim's ruling, not self-ratified here

**Should `ui-super-shell` (and its new siblings above) actually import/compose `ui-app-shell`'s region+landmark machinery, or stay independent-by-design?**

- **Option A — stay independent (this LLD's round-1 fix, §2–3, already ships this way).** Lowest risk, ships today. Cost: two shell-family primitives in one package with parallel-but-separate landmark mechanisms — a future landmark law change has to be applied twice.
- **Option B — refactor `ui-super-shell`'s middle-row parts to compose real `ui-app-shell-region` instances.** Genuine code reuse, one landmark mechanism. Cost: `ui-app-shell` is a 5-region CSS GRID with region-name-driven placement; `ui-super-shell` is a flex-based, slot-driven, RECURSIVE layout with a different placement model (rail+stacked-panes, per-side collapse). Forcing one inside the other is a real architectural fit question, not a mechanical swap — likely a bigger LLD of its own if chosen.
- **Option C — deprecate `ui-app-shell` in favor of `ui-super-shell`** (a 5-region grid is expressible as a degenerate 1-pane-per-side super-shell with no recursion). Cost: `ui-app-shell` ships isolation (shadow-DOM opt-in) and `collapse="toggle"` per-region behavior that `ui-super-shell` doesn't have yet; a real consumer (`a2ui-live`) depends on `ui-app-shell` today.

**Recommendation:** Option A now (ships in round 1), revisit B/C only once `ui-workspace-shell`/`ui-chat-shell` exist and it's clear whether real drift between the two landmark mechanisms actually bites in practice — deciding B/C today is speculative; deciding it after two more real consumers exist is grounded. Flagging for your call, not deciding it here.

### 7.1 Revisit analysis (2026-07-20 — the precondition fired)

The recommendation above gated B/C on the two new consumers existing. They do: `ui-workspace-shell` and `ui-chat-shell` both compose `ui-super-shell` (`workspace-shell.ts:41`, `chat-shell.ts:57`; ADR-0151/0154 accepted), and the docs-site chrome runs on it too (`site/pages/_page.ts:913`). Evidence per option, from the tree as of this date. **Kim rules; this section analyzes.**

**A — what "parallel mechanisms" actually costs today.** Three duplications, one of which is already closed:

- The landmark OVERRIDE vocabulary is a verbatim copy: `LANDMARK_VALUES` in `app-shell.ts:197` and again in `super-shell.ts:77` (its own comment: "reused verbatim … minus its own `''` sentinel"). A vocabulary change edits two files; no gate reds a miss.
- The role MECHANISMS are structurally different designs, not copies: a reactive `internals.role` effect on a custom element (`app-shell.ts:248-250`) vs a one-shot `role` attribute on plain wrapper divs at compose time (`super-shell.ts:82-85`, applied at `:194`/`:216`/`:268`). A future landmark-law change is two designs to re-derive, not one paste — that half of the double-maintenance cost can't be deduplicated without option B's rework.
- The mandatory-`main`/`content` connect warning is duplicated (`app-shell.ts:142-150` vs `super-shell.ts:178`).
- The narrow BREAKPOINT was the fourth duplication and round 5 already closed it the cheap way: `shell-breakpoint.ts` + its consistency gate (LLD-C7) holds all five sheets to one cited literal with zero code fusion — the standing proof that a shared named constant plus a drift gate can hold this seam.

Has drift actually bitten? No filed defect traces to the two landmark mechanisms disagreeing. The narrow-REFLOW vocabularies *have* diverged since round 1 — `collapse ∈ hide·stack·toggle` per REGION (`app-shell.ts:206`, ADR-0084) vs `narrow-* ∈ collapse·stack·tabs` per SIDE (`super-shell.ts:98-99`; ADR-0154 added `tabs` to super-shell only) — but that is two different grains (per-region vs per-side) evolving under their own specs, not one law applied once and missed once. Verdict: the drift the round-1 fork feared is real only in the ~10-line copied vocabulary; everything else that reads "parallel" is deliberately different design.

**B — grid-vs-recursive-flex fit, measured.** The two placement models do not compose:

- `ui-app-shell` is a closed five-named-area grid — `grid-template` at `app-shell.css:30-35`, region→`grid-area` at `:53-65`, a 5-member `region` enum (`app-shell.ts:181`). `ui-super-shell`'s middle row is an ordered row-flex stack (`super-shell.css:70-76`) of open cardinality — 9 slots (`super-shell.ts:49-55`), N stacked panes per side, asymmetric sides (R5b, `:223-232`). A `ui-app-shell-region` cannot name `section-nav` vs `nav-pane` vs a rail — its enum has no such members; widening it to 9+ members or bypassing `region` entirely makes the "reuse" nominal.
- Super-shell's wrappers are compose-time, built-once plain divs that the resize (`super-shell.ts:344-381`), segments (`:459-493`), and narrow-tabs (`:501-545`) machinery all address by `data-part`. Making them custom elements adds per-wrapper connect/disconnect lifecycle — exactly the relocation-reconnect hazard class app-shell's own `wired` mechanism documents (`app-shell.ts:252-285`) — and touches every selector in `super-shell.{ts,css}` plus the SPEC-R1–R7 browser matrix.
- What would actually be shared after the rework: the role maps + the override vocabulary — roughly 30 lines. Full B is a multi-round LLD (recompose, enum widening, CSS re-expression, the matrices and the a2ui-live equivalence baseline re-proven) bought for ~30 shareable lines.
- **B′ — the honest kernel of B:** extract those ~30 lines (the landmark vocabulary + the slot/region→role maps) into one shared module both shells import, plus a `shell-breakpoint.test.ts`-shaped consistency gate. One small PR, no architecture moved, and it deletes the ONLY drift surface A's cost case actually demonstrated.

**C — `ui-app-shell`'s real dependency surface, enumerated.** Production consumers of the element: exactly one page. `a2ui-live.ts:19-20` (imports) and `:64-73` — one shell, two regions: the chat pane uses `region="navigation"` + `landmark="complementary"` (ADR-0083) + `collapse="stack"` (ADR-0084); the canvas uses `region="main"`. Super-shell parity for *that* usage exists today: `nav-pane` → `navigation` (`SLOT_ROLE`, `super-shell.ts:62-72`), the `data-landmark` override (`:79-85`), `narrow-start="stack"` (`:95-98`). The migration cost is not the page — it's the page's halo: `a2ui-live.css:21-57` keys the pane cards to the page's own `.chat-pane`/`.canvas-pane` classes plus one `[data-page-content] > ui-app-shell` element selector (`a2ui-live.css:29`) — class carry-over plus one selector re-key, smaller than a region-attribute sweep — and `a2ui-live.browser.test.ts:40-47,75-176` pins a measured-rect equivalence baseline against app-shell markup that would be re-measured from scratch. Beyond a2ui-live: the app-shell teaching page is a whole authored surface (`site/pages/app-shell.ts`, `site/app-shell.html`, nav row `site/main.ts:868`) with a live `isolated` demo (`site/pages/app-shell.ts:294-298`). And the parity C would owe super-shell is precisely the two capabilities no production consumer uses: `isolated` (ADR-0082 — the connect-time shadow flow `app-shell.ts:85-122` plus a `:host` mirror sheet; app-shell's mirror is 171 lines against a 210-line sheet, and super-shell's sheet is 246 lines; consumers today: the docs demo + tests, including two OTHER components' reconnect fixtures that compose `<ui-app-shell isolated>` as their relocation-reconnect vehicle — `settings.browser.test.ts:330-331`, `master-detail.browser.test.ts:139-140` — which at removal need a REPLACEMENT reconnect vehicle, not a rename) and per-region `collapse="toggle"` (ADR-0084/LLD-C11, `app-shell.ts:224-309`; consumers today: docs prose + tests — and super-shell's own header deliberately ruled per-pane collapse YAGNI, `super-shell.ts:15-17`). Deprecation also carries a doc bill: ADR-0082/0083/0084 are accepted and append-only, so C needs a superseding ADR ruling isolation's fate, not just a migration PR.

**Sharpened recommendation (for Kim's ruling — not self-ratified): A, plus B′ as a one-PR rider.** A's feared drift turned out to be ~30 lines of copied vocabulary; B′ deletes exactly that the way LLD-C7 deleted the breakpoint duplication, and nothing else the fork called "parallel" is the same design twice. Full B forces a closed 5-area grid into an open recursive stack for no net reuse — reject. C is cheaper than round 1 assumed (a2ui-live has full parity for its actual usage) but buys nothing today: its cost is carried entirely by two ratified-but-unconsumed capabilities (isolation, per-region toggle) and a teaching page, and it needs its own superseding ADR. A posture short of C, if the family should converge: **freeze `ui-app-shell`** — no new consumers, no new features; new shell work lands on the super-shell family — which costs nothing now and leaves C available the day isolation's fate gets its own ruling.

**Fork resolved — Kim's ruling, 2026-07-20: Option C.** Kim ruled the fork **Option C — deprecate
`ui-app-shell` in favor of the `ui-super-shell` archetype family** (in-session batched question round,
overriding this section's A+B′ recommendation). The decision record is
[ADR-0156](../adr/0156-deprecate-app-shell-for-super-shell-family.md) (proposed — awaits Kim's own
ratification flip): deprecation posture (in-tree + functional during migration, no new consumers,
removal separately gated), the capability fates (`isolated`/ADR-0082 and per-region
`collapse="toggle"`/ADR-0084 dropped with the component, not ported), pattern continuity (ADR-0083/0084's
ratified patterns stay family law in the super-shell grammar — the partial-supersession content), and
the migration surface this section enumerated. The migration itself is a separate campaign gated on that
ratification — nothing in this LLD's rounds changes.
