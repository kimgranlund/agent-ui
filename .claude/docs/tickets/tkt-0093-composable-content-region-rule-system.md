---
doc-type: ticket
id: tkt-0093
status: done
date: 2026-07-17
owner:
kind: feature
size: big
---
# TKT-0093 — a composable-content rule system for pane/tab-hosted regions (header/body/footer): `ui-tabs` + `ui-split-pane` decomposition

## Summary
Kim's ask (2026-07-17, screenshots of `ui-agent-admin`'s current persona tab-strip and
Instructions/Agent tab panels): decompose `ui-tabs`' and `ui-split-pane`'s composition anatomy
properly, and settle whether panes/tab-panels should manage header/body/footer content patterns
directly or delegate to a shared container pattern placed inside them. The fleet has no rule
system today governing how a consumer composes a sticky-header / scrollable-body / footer region
inside a pane or tab panel — `agent-admin.css` (TKT-0085, just shipped) already had to hand-roll
its own "pinned tablist | scrolling panel" composition for lack of one, by its own admission
(`agent-admin.css:118-120`: *"the fleet has no shipped 'scrolling tab body' variant yet; this is
this consumer's own composition, not a tabs.css change"*).

## Acceptance
A decomposition + rule system exists (authored as the SPEC/LLD the resolved forks below earn —
not minted by this ticket, see Scope/Open) that:
- Names the anatomy of `ui-tabs` (tablist strip + `ui-tab-panel`, a bare surface-less focusable
  scroll container per ADR-0104) and `ui-split-pane` (a bare flex pane, a components-tier layout
  primitive sibling to `ui-row`/`ui-column`/`ui-grid` per ADR-0120) precisely, and states whether
  either owns content-region semantics (header/body/footer, sticky header, scrollable body) or
  stays a pure layout/behavior primitive with zero content opinion.
- Resolves whether the Card region idiom (`CardHeader`/`CardContent`/`CardFooter`, ADR-0056's
  region-less-fallback pattern, ADR-0046's box-model) generalizes into a reusable "content
  regions" pattern any container can host (tab-panel, split-pane, card-in-card) — or whether pane/
  tab consumers keep composing Card (or another dedicated container) INSIDE their panels, per
  ADR-0120's existing primitive-vs-chrome tier split.
- States a spacing policy for `ui-split-pane` explicitly: whether it already rides the
  `--ui-space` density-responsive ladder (ADR-0015 cl.4) or needs its own consumption seam, and
  reconciles it against Card's `--ui-container-*`/`--ui-space` box-model (ADR-0046).
- Names a path to retire the ad hoc "pinned tablist | scrolling panel" CSS `agent-admin.css` had
  to hand-build (TKT-0085) in favor of the fleet-level pattern, once one exists — the retrofit
  itself is a follow-up build, out of this ticket's scope.

## Links
- [ADR-0104](../adr/0104-tabs-transparent-surface-default.md) — `ui-tabs` has no surface identity
  of its own (tablist strip + indicator only); directly frames whether tab panels can own content
  regions.
- [ADR-0120](../adr/0120-app-surfaces-m4-panes-settings.md) — the primitive-vs-chrome tier split
  (`ui-split` is a bare components-tier layout control; composed chrome patterns like
  master-detail live app-tier) — the precedent this ticket's Q3 generalizes.
- [ADR-0056](../adr/0056-region-less-card-humane-default.md) / [ADR-0046](../adr/0046-container-box-model.md)
  — the existing header/content/footer "region" composition idiom, currently Card-only.
- [ADR-0015](../adr/0015-container-surface-space-token-model.md) — the `--ui-space` layout-spacing
  ladder and the container surface (elevation × brightness) model this ticket's spacing-policy
  question must reconcile against.
- [TKT-0085](tkt-0085-agent-admin-responsive-shell-tabs-collapse.md) — the just-shipped responsive
  tabs/split collapse whose CSS is the concrete motivating anti-pattern
  (`packages/agent-ui/app/src/controls/agent-admin/agent-admin.css:118-120`).
- [TKT-0007](tkt-0007-design-system-surfaces.md) — the design-system-surfaces intake that first
  ruled `ui-split`'s tier; same reconciliation shape (a fork round before any ADR is minted).
- `packages/agent-ui/components/src/controls/tabs/tab-panel.ts`,
  `packages/agent-ui/components/src/controls/split/split-pane.css`,
  `packages/agent-ui/components/src/controls/card/{card-header,card-content,card-footer}.ts` —
  the three anatomies this decomposition must reconcile.

## Scope/Open
Dedup swept clean (2026-07-17): no queued record, PRD, or SPEC covers this; the codebase confirms
the gap (`ui-tab-panel` and `ui-split-pane` are both bare containers with zero region types; only
Card has a region idiom, and it is not yet documented as reusable outside Card itself).

This ticket intentionally does **not** mint a PRD/SPEC/LLD — the ask is three genuinely open
architectural forks, not a ratified scope, and minting a doc ahead of Kim/system-planner resolving
them would pre-empt the decision rather than record it (doc-authoring-standards' no-speculative-
docs discipline). The forks, verbatim from the raw ask, for system-planner to run through
`system-decompose`'s two-plane method at build time:

1. **Q1 — `ui-tabs` decomposition.** What is the proper outside-in/inside-out breakdown of
   `ui-tabs`' current anatomy (tablist, tab, indicator, tab-panel) against real composed content
   (not just the bare-tab case ADR-0104 already settled)?
2. **Q2 — `ui-split-pane` spacing policy.** What governs padding/gap inside a split pane today,
   and should it adopt `--ui-space` explicitly, or does it already (unverified as of this
   ticket)?
3. **Q3 — direct region ownership vs. a container pattern.** Do panes/tab-panels grow their own
   header/body/footer anatomy, or does a generalized container pattern (Card's regions,
   generalized) get placed INSIDE them — the rule system Kim is asking for is the answer to this
   question, stated once and taught fleet-wide rather than re-decided per consumer.

## Findings

- **2026-07-17 — design intake complete; the three forks resolved as [ADR-0144](../adr/0144-pane-tab-content-region-rule-system.md) (proposed) + a coverage-clean decomposition ([`pane-tab-content-region-rules.decomp.json`](../decompositions/pane-tab-content-region-rules.decomp.json), `--strict` green).** Run through `system-decompose`'s two-plane method against the full shipped source (tabs triple, split triple, card triple, `container-box.css`, `agent-admin.css:83-152`). Resolutions: **Q1** — anatomy = coordinator shell · tablist strip · bare panels; the one unhosted action (pinned strip + scrolling active panel in a bounded parent) becomes an opt-in `<ui-tabs fill>` reflected boolean, CSS-only, with a `--ui-tabs-panel-scrollbar-width` inherited seam and a measured (not assumed) keyboard-scroll disposition at build. **Q2 — the open verification resolves NO:** `split-pane.css` declares zero padding/gap and references no space token (grepped, then read in full); ruled to STAY zero-padding — no `--md-sys-space-*` adoption, no new pad token (ADR-0046 deliberately rejected ladder-driven region padding, and a padded pane double-insets every region-bearing child); the policy lands as `split-pane.md` prose, `split.css`/`split-pane.css` confirmed no-ops. **Q3** — panes/tab-panels never grow region anatomy; regions compose INSIDE via `ui-card` (chrome-grade) or the `[data-box]` system — `container-box.css` already IS "Card's regions, generalized" (six consumers — including `ui-command-modal`'s listbox, `command-modal.ts:132`, a doc-review-caught undercount fixed pre-ratification), ratified as a public taught idiom; content rhythm stays in content wrappers. **Doc shape:** no SPEC/LLD minted — the forks resolved to *no new pattern family*, so the single-component build's acceptance criteria live inline in the ADR (the ticket's "the SPEC/LLD the forks earn" resolved to an ADR). The `agent-admin.css:121-137` retrofit is named in ADR-0144's Consequences as a follow-up build, per this ticket's own scope line. Ratification: Kim (the ADR status stays `proposed`).

- **2026-07-17 — independent review (`scribe:doc-reviewer`) closed the gap the design agent's own environment couldn't (no Agent tool to dispatch one itself).** Verdict: fix-then-ship. Independently re-verified every central claim directly against source (the Q2 `split-pane.css` grep, `tab-panel.ts`'s anatomy, the `agent-admin.css:117-137` citation, `tabs.css`'s shell/panel rules, ADR-0046's real rejection of ladder-driven padding, `coverage_check.py --strict` re-run clean) — all TRUE, no fabricated citation, no strawman. One real finding applied: the `[data-box]` consumer count was undercounted at five, missing `ui-command-modal`'s listbox (`command-modal.ts:132`) — fixed to six in both this ticket and ADR-0144 (four spots), plus a minor `tab-panel.ts:27-28`→`:26-28` citation-precision fix. The no-SPEC/LLD judgment call was separately scrutinized and held: the build is a single-component opt-in variant (94 of ~146 ADRs in this corpus carry inline Acceptance the same way), and `[data-box]`'s fleet-wide ratification already has a spec-grade home in ADR-0046 + its own tests — a new SPEC would restate that substrate, the exact drift-pair failure this repo's doc standards name. With the fix applied, ADR-0144 is ratification-ready.

- **2026-07-18 — build complete; ADR-0144 realized to the letter, status flipped to `done`.** Q1: `<ui-tabs fill>` shipped as ONE opt-in reflected boolean (`controls/tabs/tabs.ts`), CSS-only in `controls/tabs/tabs.css` (`:scope[fill]` shell flex-column + the `ui-tab-panel:not([hidden])` scroll leg), with the consumer-inherited `--ui-tabs-panel-scrollbar-width` seam (var()-fallback only, NOT declared in the `:where()` token block — verified by a dedicated negative-control test) and a MEASURED (not assumed) keyboard-scroll disposition: a real-engine run of the new `tabs.browser.test.ts` legs found the identical `ui-card-content` gap (WebKit does not move a focused `overflow:auto` region on Arrow/Page/Home/End; Chromium is inconsistent) reproduces for a filled tab panel, so `tab-panel.ts` wires the SAME explicit keydown handler `card-content.ts` ships, gated to `fill` mode + the panel itself as the event target — proven green on BOTH Chromium and WebKit, including the whole-shape assertion (a fixed-height flex-column parent, the agent-admin shell shape: the widget fills it, the strip stays pinned across a panel scroll, hidden panels compute `display:none`, and switching panels re-engages scroll) and the negative control (a `fill`-less `<ui-tabs>` is untouched). The A2UI `Tabs` catalog row (Q1 cl.4) gained `fill` as a plain 1:1 structural boolean (the `SplitPane.collapsible` precedent, Lane B) — `catalog.json` + `factories.ts`'s doc comment, no bespoke factory code needed (`accessorFactory` is generic); the byte-pinned agent system-prompt baseline was deliberately re-captured (the derived capability inventory line for `Tabs` now lists `fill`) per the `a2ui-prompt-author` skill's sanctioned recapture flow. Q2/Q3: `controls/split/split-pane.md` + `controls/tabs/tabs.md` both gained the ruled prose (zero-padding/no-space-ladder law; the three fleet-wide region rules — layout hosts own bounds+scroll, regions compose inside via `ui-card`/`[data-box]`, content rhythm stays in the content wrapper) — pure prose, confirmed **zero** hunks in `controls/split/*.css`, `controls/card/*`, `controls/_surface/container-box.css` (`git diff --stat` checked). The docs-site composing-containers teaching block (`site/pages/a2ui-patterns.ts`) gained a second rule list, "Panes and tab panels — the region rules," stating Q1/Q2/Q3 as consumer-facing prose. Filed the named follow-up for the `agent-admin.css:117-137` retrofit as **[GitHub issue #14](https://github.com/kimgranlund/agent-ui/issues/14)** (`enhancement`, `size:small`) rather than building it here, per this ticket's own out-of-scope line. Gates: `npm run check` green; `npm test` green module-wide except two PRE-EXISTING, unrelated sandbox failures (`site/pages/a2ui-live.ask-lifecycle.test.ts` / `agent-admin-app.test.ts`, both a `Denied ID` path-resolution error reproduced identically on an unmodified tree via `git stash` — an environment constraint, not a regression); `npm run test:browser` green for every touched/adjacent suite (tabs, split, card, container-box/container — run individually after the full-fleet run OOM'd on this machine, an unrelated resource ceiling); `node scripts/generate-llms-full.mjs` re-run (the `tabs.md` prose change touches the llms corpus). **Open item, flagged rather than faked:** this build session's toolset had no Agent/Task dispatch capability, so the independent `ui:component-reviewer` pass the seat contract requires before a control-wave commit could NOT be run from within the build seat itself — the coordinator/host should dispatch it against this diff before merge, mirroring the doc-tier's own "no Agent tool" gap the design pass hit one entry up in this same Findings log.
