# LLD — Shell archetypes M5

> Status: proposed · v0.1 · 2026-07-20 · Layer: LLD (implementation plan)
> Implements: [`../spec/shell-archetypes-m5.spec.md`](../spec/shell-archetypes-m5.spec.md) (`SPEC-R1…R4`, plus the v0.2 amendment `SPEC-R5` this LLD's C3 drives). Refines ADR-0151 (in-flight on PR #45).
> Altitude: owns **how the rest of M5 is built** — the five-round review plan's own component map, concrete interfaces, and build sequence. Behavior is the SPEC's; this doc never re-derives it. **§7's one open fork needs Kim's ruling — this LLD recommends but does not self-ratify it.**

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
- **`ui-chat-shell`** composes a narrower slice — header, nav-pane (conversation list), content (the active thread), no options side — extracted from a2ui-chat/agent-admin's existing hand-rolled chrome, with at least one of those two pages migrating onto it to prove the extraction is real, not cosmetic (round 4's acceptance criterion).

Both ship their own descriptor + jsdom/browser tests, following LLD-C1–C8's shape.

## 7. Open fork — needs Kim's ruling, not self-ratified here

**Should `ui-super-shell` (and its new siblings above) actually import/compose `ui-app-shell`'s region+landmark machinery, or stay independent-by-design?**

- **Option A — stay independent (this LLD's round-1 fix, §2–3, already ships this way).** Lowest risk, ships today. Cost: two shell-family primitives in one package with parallel-but-separate landmark mechanisms — a future landmark law change has to be applied twice.
- **Option B — refactor `ui-super-shell`'s middle-row parts to compose real `ui-app-shell-region` instances.** Genuine code reuse, one landmark mechanism. Cost: `ui-app-shell` is a 5-region CSS GRID with region-name-driven placement; `ui-super-shell` is a flex-based, slot-driven, RECURSIVE layout with a different placement model (rail+stacked-panes, per-side collapse). Forcing one inside the other is a real architectural fit question, not a mechanical swap — likely a bigger LLD of its own if chosen.
- **Option C — deprecate `ui-app-shell` in favor of `ui-super-shell`** (a 5-region grid is expressible as a degenerate 1-pane-per-side super-shell with no recursion). Cost: `ui-app-shell` ships isolation (shadow-DOM opt-in) and `collapse="toggle"` per-region behavior that `ui-super-shell` doesn't have yet; a real consumer (`a2ui-live`) depends on `ui-app-shell` today.

**Recommendation:** Option A now (ships in round 1), revisit B/C only once `ui-workspace-shell`/`ui-chat-shell` exist and it's clear whether real drift between the two landmark mechanisms actually bites in practice — deciding B/C today is speculative; deciding it after two more real consumers exist is grounded. Flagging for your call, not deciding it here.
