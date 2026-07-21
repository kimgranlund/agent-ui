# ADR-0155 — The shell family goes responsive as a system: a two-line band ladder (compact 52.5rem joins narrow 40rem via `collapse-band`), a header-toggle affordance law (presence · menu⇄X · overlay dismissal), the fleet scrollbar seam on the shell's own scroll regions, and the docs-site narrow story moves from `stack` to overlay

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-20
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-20 |
> | **Proposed by** | planner seat (the GH #170 design dispatch — Kim's verdict on the shipped chrome at narrow: *"this still looks like absolute garbage"*; the issue's own first acceptance gate is the deep two-plane decompose this record ratifies the outputs of) |
> | **Ratified by** | kimgranlund (repo owner), 2026-07-20, via the [`ratify ADR-0155` utterance](https://github.com/kimgranlund/agent-ui/issues/170#issuecomment-5028182888) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | [`../spec/shell-archetypes-m5.spec.md`](../spec/shell-archetypes-m5.spec.md) → v0.4 (additive amendment §9: SPEC-R8 band ladder · SPEC-R9 toggle affordance law · SPEC-R10 scrollbar seam, AC13–AC18; SPEC-R1–R7 untouched) |
> | **Supersedes / Superseded by** | (none) — Extends [ADR-0151](./0151-named-shell-archetypes-m5.md) (the grammar-ceiling law: responsive machinery lands ONCE in `ui-super-shell`, the presets parameterize it) · [ADR-0154](./0154-shell-grammar-resizable-pane-tab-collapse.md) (the R7c survival law this amendment's one observer must honor) · Relates [ADR-0084](./0084-app-shell-narrow-reflow-collapse.md) (the narrow-reflow vocabulary) · [ADR-0150](./0150-compact-window-body-typescale-breakpoint.md) (the 52.5rem compact-window line this reuses by number) · [ADR-0130](./0130-nav-rail-family-unification.md)/TKT-0035 (the site-nav `collapse="menu"` arrangement clause 4 retires) · GH #166 (the `ui-menu` hidden-scrollbar realization, the seam's reference diff) · GH #44 (Kim's outer-in collapse cascade sketch, realized by clause 1) |

## Context

GH #170: the shell system's mechanics shipped (per-side collapse, the <40rem container query,
header toggles, `stack`/`tabs` arms) but the COMPOSED result — the docs-site chrome on
`ui-super-shell` at a narrow viewport — reads broken to Kim. The issue gates any build on a deep
two-plane decompose of the whole family; that decompose
([`../decompositions/shell-responsive-system.decomp.json`](../decompositions/shell-responsive-system.decomp.json),
fourteen actions × the shipped structure) found six unhosted actions, all verified against live
source on the `build-52-shell-grammar-rehost` stack:

1. **No compact band.** One shared 40rem container line means a nested (depth-2) composition
   collapses the INNER shell first — the inner container is always the narrower one — the exact
   opposite of Kim's GH #44 outer-in cascade ("the app rails first, the canvas panes next"). And
   for the depth-1 docs site, a 252px nav pane rides beside the doc column all the way down to
   640px, a window [ADR-0150](./0150-compact-window-body-typescale-breakpoint.md) already rules
   compact reading width.
2. **A dead toggle ships today.** `#makeToggle` renders BOTH side toggles unconditionally — the
   docs site authors no end side, so its header carries a button that toggles nothing. At narrow,
   a `stack` side's toggle sets `data-narrow-open`, stacking the overlay arm's
   `position:absolute` CSS onto the in-flow stacked nav — the "overlay pushes/overlaps" symptom
   in Kim's screenshots is this conflict.
3. **The glyph and the ARIA state lie below 40rem.** The toggle icon is statically `list`;
   `aria-expanded` tracks only the wide `collapsed-*` props. The narrow overlay state
   (`data-narrow-open`) drives neither, and a stale `data-narrow-open` survives a resize back to
   wide.
4. **The JS band read drifts from the named line.** `super-shell.ts` hardcodes
   `getBoundingClientRect().width < 640` — raw px, bypassing `shell-breakpoint.ts`'s 40REM
   constant (the GH #99 gate only sweeps CSS literals, so this drift is invisible to it).
5. **No overlay dismissal contract.** No scrim, no Escape, no focus behavior — only re-tapping
   the toggle closes an open side.
6. **The shell is the fleet's scrollbar-convention holdout.** Zero `scrollbar-width` rules on its
   four owned scroll regions (pane · active segment · narrow-tabs strip · overlay side), while
   command-modal, `ui-menu` (GH #166, the reference diff), card, conversation, surface-host, and
   agent-admin all carry the hidden-scroller + scroll-fade seam. The `scrollFade` trait the seam
   needs is not on `@agent-ui/components`' public barrel (`paneResize` is — the export precedent).

## Decision

**The responsive system lands at the grammar ceiling (`ui-super-shell`), per ADR-0151's own law —
five clauses, mechanisms in SPEC v0.4 §9 (SPEC-R8/R9/R10) and the build plan in
[`../lld/shell-responsive.lld.md`](../lld/shell-responsive.lld.md).**

1. **The band ladder is two named lines, selected per shell by `collapse-band` (SPEC-R8).**
   `SHELL_COMPACT_BREAKPOINT_REM = 52.5` joins the existing 40 in `shell-breakpoint.ts` (same
   consistency gate). A shell's collapse-mode sides hide below its `collapse-band` line
   (`'narrow'` default — every shipped shell byte-compatible — or `'compact'`); `stack`/`tabs`
   sides keep the 40rem line, which answers a different question (row cramp, not side
   visibility). 52.5rem is ADR-0150's number on purpose: one fleet-named line, two mechanisms,
   and the shell's own module math (dual full sides + canvas floor ≈ 846px) lands within one
   module of it. The GH #44 outer-in cascade becomes a parameterization — `compact` on the outer
   ring, default inner — not new machinery.
2. **The toggle affordance law (SPEC-R9).** Presence: only for authored sides; hidden below the
   line for `stack`/`tabs` sides (defects 2's both halves become unreachable). Glyph: both
   `list` and `x` composed, CSS-swapped off `data-narrow-open` INSIDE the band query — the X is
   band-correct by construction. Truth: one shell-owned, VISIBILITY-ONLY `ResizeObserver`
   (attributes only; the ADR-0154 R7c survival law extends to it) clears stale `data-narrow-open`
   on band exit and keeps `aria-expanded` truthful per band; every JS band read derives from the
   named constants × live root font-size (the 640 literal retires). Dismissal: scrim part +
   Escape + toggle re-tap, focus to the pane on open / back to the toggle on close, non-modal,
   overlay width capped so a canvas edge stays visible.
3. **The scrollbar seam (SPEC-R10).** `--ui-super-shell-scrollbar-width: none` (consumer-
   overridable, the command-modal/GH #166 shape) on pane boxes, active segments, and the
   narrow-tabs strip; `scrollFade` wired per scrollable box as the replacement affordance. This
   ratifies exporting **`scrollFade` from `@agent-ui/components`' root barrel** — a public-API
   widening decided here, riding the `paneResize`/ADR-0023 precedent, never a silent deep-import.
4. **The docs-site narrow story moves from `stack` to overlay — a product-visible change on the
   shipped site chrome, ratified here, never a refactor side effect.** `_page.ts` sets
   `collapse-band="compact"` + `narrow-start="collapse"`; the site nav's
   `ui-nav-rail collapse="menu"` dropdown and its TKT-0035 `collapse-container="ancestor"`
   arrangement RETIRE (the rail renders its full vertical anatomy inside the pane/overlay);
   `_page.css`'s 40rem stacked-nav media arms retire with them. `ui-workspace-shell`'s preset
   default follows its extraction source (`stack` → `collapse` + `compact`) — also a default
   change on a shipped element, named here. `ui-chat-shell` only gains `collapse-band` in its
   forward list; its defaults hold (agent-admin's pinned 640px narrow-tabs parity).
5. **Named non-adoptions.** `ui-app-shell` is untouched: it owns no scroll region (verified — the
   seam is vacuous), and its `app-surfaces-m4.lld.md` LLD-C11 `collapse="toggle"` Show/Hide disclosure is a region-local
   affordance, not a header side toggle — menu⇄X deliberately does not apply. Both dispositions
   land in `app-shell.md` so absence reads as decision, not omission.

### Forks for Kim (recommendation is the default absent an objection)

- **F1 — the compact line's number.** *Recommend 52.5rem (ADR-0150 alignment — one fleet line,
  already ratified once).* Alternative: a geometry-true ~53rem module line (2·(54+252)+162+4·18 =
  846px); rejected as a third magic number within 6px of an existing named one.
- **F2 — narrow geometry compression.** Whether the 18px module/gap/radius ladder compresses at
  narrow (18px gaps are ~10% of a 360px viewport). *Recommend: unchanged in this wave* — no Figma
  frame grounds a compressed ladder; inventing geometry without an owner frame is how R1c got its
  authority. Named for a future frame, not built.
- **F3 — the workspace-shell default flip (clause 4).** *Recommend: flip with the site* (the
  preset's charter is "the docs site's own shipped UX"); the alternative — site flips, preset
  keeps `stack` — leaves the preset teaching the exact arrangement Kim just rejected.

## Consequences

- `ui-super-shell` gains its first `ResizeObserver` — deliberately scoped to attribute hygiene
  (visibility-only, R7c-compliant); the pure-CSS band styling stays the styling source of truth,
  the observer only serves JS-side state truth (ARIA, stale-overlay clearing, click-arm band
  reads).
- `@agent-ui/components`' public surface widens by one export (`scrollFade`) — the tree-shake and
  size gates re-measure at build (ADR-0040/0049 discipline).
- The site's TKT-0035 nav arrangement (ancestor-container `collapse="menu"`) retires; `ui-nav-rail`
  itself keeps the capability — only this consumer stops using it.
- `agent-admin.browser.test.ts` band pins are UNAFFECTED (chat-shell defaults hold); the site
  shard's nav pins re-target the overlay story (the LLD carries the pin map).
- Two new SPEC IDs' worth of CSS arms under a second container query — the compact arms duplicate
  the narrow hide/overlay selectors under a guard; the LLD owns keeping that duplication to one
  block.
- **Stale → re-verify at the build wave:** `super-shell.md`/`workspace-shell.md`/`chat-shell.md`/
  `app-shell.md` descriptors · the shell pick-table + demo pages · `_page.ts` SHELL comments ·
  CLAUDE.md's `app` row if wording shifts · GH #170 (Findings comment at each stage). This branch
  does NOT contain main's GH #166 menu fix (merge `181dad9`) — no file overlap, but the build
  lands after PR #175 and treats main's `menu.css` as the seam reference.

## Acceptance

Design-phase (this change): the decompose record exists and its coverage map is mechanically
clean (every action hosted, every leaf carries an acceptance predicate); SPEC v0.4 §9 exists and
passes the docs-grammar gate; this record passes the ADR gates and is indexed; the LLD exists.
Build-phase (post-ratification, separately dispatched): SPEC AC13–AC18 green cross-engine;
**Kim's visual sign-off on the narrow rendering (GH #170 acceptance clause 3) is the final gate —
no agent proxy exists for it; the visual-shard screenshots are the review artifact.**

## Alternatives considered

- **Keep the single 40rem line.** Rejected: inner-first collapse contradicts the owner's GH #44
  cascade, and the docs page stays cramped through the whole 640–840px window the fleet itself
  (ADR-0150) already calls compact.
- **A full multi-band ladder (N lines, rail-only intermediate states).** Rejected: no frame and
  no consumer needs a rails-persist band; two lines + one prop realize every grounded shape
  (YAGNI — the same discipline that capped R5d).
- **Structural band selection (rail-bearing sides collapse at compact automatically, no prop).**
  Rejected: the docs site — the triggering consumer — has a rail-less nav side and would be
  unaffected by the very mechanism built for it.
- **JS-swapped single glyph for menu⇄X.** Rejected: paint would depend on JS band detection;
  a stale attribute after a resize paints a wrong X. Two glyphs + CSS under the band query make
  the wrong paint unrepresentable.
- **A modal drawer (focus trap + inert canvas) for the narrow overlay.** Rejected for v1: the
  overlay is a navigation drawer, not a dialog; scrim + Escape + focus return cover the
  interaction without inerting a live canvas (a live A2UI surface keeps running — the R7c law's
  spirit). Revisit only on an a11y-review finding.
- **Keep the site on `stack` and only restyle it.** Rejected: the stacked-nav-above-content
  arrangement IS what Kim rejected; restyling it preserves the structure that reads broken.
