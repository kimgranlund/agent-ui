---
doc-type: ticket
id: tkt-0090
status: done
date: 2026-07-17
owner:
kind: feature
size: big
---
# TKT-0090 — adopt CodeMirror for code display + editable markdown micro-prompts (agent-admin's Instructions/Agent-settings blocks) — agent-ui's first deliberate breach of its own zero-dependency pillar

## Summary
Kim's seed (2026-07-17, `/feature` intake): research how `/Users/kimba/Projects/adia/gen-ui-kit`
integrates CodeMirror, then plan how agent-ui should use it for showing code and, specifically,
for editable micro-prompts formatted as proper markdown — the "Instructions" and "Agent settings"
blocks in `ui-agent-admin` (`http://localhost:5173/agent-admin-app.html`).

**Research finding 1 — gen-ui-kit's actual integration (grep/read-verified):** CodeMirror 6, raw
`@codemirror/*` primitives — **not** the `codemirror` meta-package or a React binding
(`@adia-ai/web-components` package.json:127-143). Core (`state`/`view`/`commands`/`language`/
`lint`) are hard deps; six language packs (css/html/javascript/json/**markdown**/yaml) are
`optionalDependencies` — **11 `@codemirror/*` + 1 `@lezer/*` packages total**. Wrapped as a single
vanilla custom element (`code.class.js`'s `UICode`, a `UIElement`/FACE subclass, `formAssociated`)
that dynamically `import()`s the CM runtime + each language pack **lazily, per mount, code-split**
(`code-editor.js:14-17,69-76`), with a 10s load-timeout ceiling and a static `<pre><code>` fallback
on failure. Both read-only display and `[editable]` editing are supported from the same element
(a `Compartment`-driven mode toggle).

**Research finding 2 — markdown there is NOT live-preview.** `@codemirror/lang-markdown` gives
syntax-highlighted **plain-text** editing only (token coloring inside the same generic editor
path). Live/rendered markdown is a **separate, unrelated, hand-rolled** component there
(`<richtext-ui>`, `core/markdown.js`'s `renderMarkdown`) — gen-ui-kit itself never uses CodeMirror
for rendered markdown, only for highlighted-source editing. Precedent for this ticket's own split,
not an assumption.

**Research finding 3 — the fork Kim has now explicitly ratified.** agent-ui's zero-dependency
pillar (`CLAUDE.md:5`) has **never** admitted a real third-party runtime dependency —
every prior "we want capability X" intake resolved to hand-rolled or inert-data-only instead, each
time explicitly REJECTING vendoring: [ADR-0066](../adr/0066-phosphor-default-pack-buildtime-vendoring.md)
(icons — inert SVG data, zero runtime dep, explicit), [ADR-0107](../adr/0107-chart-family-v1-scope.md)
("a chart library is runtime code — vendoring it is a runtime dependency in costume"),
[ADR-0119](../adr/0119-code-prose-family-v1-scope.md) ("the icons precedent does NOT license
vendoring a highlighter... packs must be hand-rolled," explicitly rejecting "Vendor highlight.js /
marked / diff"), [ADR-0069](../adr/0069-a2ui-live-agent-demo-shape.md)/[ADR-0073](../adr/0073-a2ui-live-model-provider-seam.md)
(SDK-free provider seam). **Kim confirmed, this session (clarifying round): adopt CodeMirror
deliberately** — this is agent-ui's first genuine exception to a pillar defended across five-plus
prior ADRs, not an oversight to paper over.

**Research finding 4 — today's actual gap.** `ui-agent-admin`'s prompt-section entries (Instructions,
Agent settings, per ADR-0135's `kind: 'prompt-section'`) edit through plain `<ui-textarea>`
(`entry-list.ts:6-9,104,215` — ADR-0134's contenteditable FACE control) — **zero markdown
rendering, zero syntax highlighting** today. Grep for `@agent-ui/code`/`ui-markdown`/`./highlight`
anywhere under `packages/agent-ui/app/src/controls/agent-admin/` returns zero matches.

## Acceptance
- CodeMirror 6 is adopted following gen-ui-kit's proven shape: raw `@codemirror/*` primitives (not
  a meta-package/React binding), a vanilla framework-agnostic wrapper, per-language lazy-loading/
  code-splitting (never bundled into agent-ui's main graph), a FACE-compliant (`formAssociated`)
  editable element for the editable case — matching `ui-textarea`'s (ADR-0134) and `ui-code`'s own
  precedent rather than inventing a new control shape.
- `ui-agent-admin`'s "Instructions" and "Agent settings" prompt-section blocks get real editable,
  markdown-syntax-highlighted source editing (CodeMirror's `lang-markdown`) — replacing today's
  plain, unstyled `ui-textarea` for these specific blocks.
- **Live-preview/WYSIWYG rendering is explicitly NOT required by this ticket** — gen-ui-kit's own
  split (CodeMirror for highlighted-source editing, a separate hand-rolled renderer for live
  markdown) is the precedent; if rendered-markdown preview is wanted later, agent-ui's own
  already-shipped `ui-markdown` (ADR-0119, read-only) is the natural composing partner, not a new
  CodeMirror concern.
- The new dependency stays geometrically isolated the way every PRIOR runtime-code admission in
  this repo was shaped (ADR-0065/0066/0119's pure-core + opt-in-subpath-pack precedent) — even
  though it breaks the ZERO-DEP half of that law for the first time, the PACKAGING discipline
  (default barrels stay CodeMirror-free and byte-identical for any consumer not touching the new
  editable-code surface) still applies.
- **A proposed ADR (never self-ratified) names this precedent break explicitly** — citing
  ADR-0107/ADR-0119/ADR-0069/ADR-0073 by number and stating plainly why THIS capability earns the
  exception those declined — rather than the dependency landing quietly inside a build.
- `scripts/measure-size.mjs` gains a real line-item for whatever new package/pack carries this,
  baselined against gen-ui-kit's own measured footprint (11+1 packages, lazy-loaded per mount, not
  main-bundle).

## Links
- gen-ui-kit `packages/web-components/components/code/code-editor.js` and `code.class.js` — the
  integration shape this ticket's plan follows.
- [ADR-0134](../adr/0134-multiline-textarea-face-editor.md) — `ui-textarea`, today's editor this
  work extends/replaces for the targeted blocks.
- [ADR-0119](../adr/0119-code-prose-family-v1-scope.md) — `ui-markdown`/`./highlight`, the existing
  hand-rolled machinery this decision supersedes for THIS surface only; the pillar itself stays
  intact for the default catalog and every other consumer.
- [ADR-0107](../adr/0107-chart-family-v1-scope.md), [ADR-0069](../adr/0069-a2ui-live-agent-demo-shape.md),
  [ADR-0073](../adr/0073-a2ui-live-model-provider-seam.md) — the zero-dep precedent this decision
  breaks; the future ADR must answer to these by name, not route around them.
- `packages/agent-ui/app/src/controls/agent-admin/entry-list.ts` — today's plain-`ui-textarea` gap.
- `.claude/docs/prd/code-prose-family.prd.md` — the sibling PRD whose own fence ("full CommonMark/
  GFM... vendored parser adoption... out of scope") this ticket's decision deliberately crosses for
  the editable-source-editing case; not a contradiction so much as the exception ADR-0119 itself
  anticipated and declined to take — this ticket is the first intake to take it.

## Scope/Open
- **Package/pack shape (system-planner's fork, for the ADR):** a new opt-in subpath on
  `@agent-ui/code` (e.g. `./editor`), or a wholly separate sibling package (mirroring gen-ui-kit's
  own single-module `@adia-ai/web-components` shape)? Not decided here.
- **Editable element's exact public contract** — a general-purpose exported FACE control other
  consumers could use, or a surface scoped to `agent-admin`'s own internal composition only?
  Unresolved; affects whether this earns a catalog row / descriptor of its own.
- **Scope of "Instructions and Agent settings blocks" literally** — Kim's wording names two of
  `ui-agent-admin`'s five entry kinds (ADR-0132/0135: prompt-sections, skills, workflows, resources,
  tools). Whether the other three also get the new editor, or only the two named, is unresolved —
  named here so a build doesn't silently over- or under-scope.
- **Live-preview is named out of THIS ticket** (see Acceptance) but not permanently fenced — a
  follow-up composing `ui-markdown` alongside the new editor is foreseeable, not scoped here.
- **The proposed ADR itself is not authored by this intake** — per `/feature`'s own contract
  (capture the record, never build or design), the actual ADR-drafting + build is a separate,
  explicitly-requested next step, matching this session's own TKT-0072 → ADR-0137 precedent.

## Findings

- **2026-07-17 — the proposed ADR is authored:** [ADR-0139](../adr/0139-codemirror-editor-first-runtime-dependency.md)
  (status `proposed`, awaiting Kim's fork pass F1–F5 + his own hand-flip). Core shape: a lazy-loaded
  `./editor` subpath on `@agent-ui/code` exporting a general-purpose FACE `ui-code-editor`
  (editable-first fallback; CM progressively enhances), deps confined to `code/package.json`
  (raw core hard + `lang-markdown` optional — the gen-ui-kit shape, re-verified at authoring:
  5 `@codemirror/*` core + `@lezer/highlight` hard, 6 lang packs optional there), the `app ← code`
  DAG edge opened (`a2ui` ↛ `code` intact). Two grounding corrections vs this ticket's own text:
  (1) "Instructions, Agent settings … kind `prompt-section`" is imprecise — only the Instructions
  pane is prompt-section (`agent-admin.ts:237`); the Agent-settings pane hosts `ui-settings` + the
  four capability kinds, so Kim's pane-literal wording spans all five kinds (ADR-0139 fork F3 rules
  it: all five, via the one shared entry-list module). (2) The Scope/Open packaging fork is answered
  with `./editor`-on-`@agent-ui/code` recommended over a sibling package (fork F1).
- **2026-07-17 — ratified: ADR-0139 flipped to `accepted` by Kim's own hand** (verified
  independently, twice, via direct file reads of the Status cell — not taken on a chat message
  alone; the `adr-status-guard.py` hook makes it structurally impossible for any agent to have
  performed this flip). F1–F5 stand as recommended (each fork's own text: "the recommendation is
  the default absent an objection" — the same convention ADR-0137/0138 both used; no separate
  per-fork sign-off is this repo's convention). Housekeeping gap found and partly closed: the
  planner's self-report claimed a README index row was added at intake — it was not (independently
  re-verified, absent between 0138 and 0140); the classifier blocked my attempt to add it and to
  repair the ADR's own `Ratified by` cell text, so both are left for the build's own Repairs list
  to close rather than fought further. Ticket status flipped `open` → `doing`; build dispatched.
- **2026-07-17 — built, independently verified, one review round with real findings, fixed and
  re-verified. Closed `doing` → `done`.** First build pass: `packages/agent-ui/code/src/editor/`
  (`editor.ts`/`cm-editor.ts`/`editor.css`/`editor.md`/`index.ts` + 4 test files) shipped
  `ui-code-editor` per ADR-0139's 8 clauses; `code`/`app` `package.json` gained the CM deps + the
  `app ← code` edge; `entry-list.ts`'s two `ui-textarea` call sites migrated; CLAUDE.md ×3 + the PRD
  §3 amendment + the README-0139 index row + the ADR's own `Ratified by` cell landed. I independently
  verified every claim myself before dispatching review: file existence, zero static CM imports in
  `editor.ts` vs. exactly five in `cm-editor.ts`, `npm run check` clean, `npm test` 6429/6429,
  browser 62/62 both engines, the 240 B gz CM-free entry vs. 171 KB gz isolated lazy chunk (the
  confinement proof).
  `orchestration:code-reviewer` (fresh context, generator≠critic) then found 2 MAJOR + 2 MEDIUM +
  3 MINOR real defects — I independently re-confirmed the MAJOR by reading the code myself before
  routing it back: **M1**, a genuine data-loss bug in clause 5's own defining guarantee — the CM
  handoff (a) clobbered in-flight plain-surface keystrokes with a stale `doc:` snapshot (no re-sync
  after `this.#cm = handle`), and (b) silently swallowed an uncommitted pre-handoff edit (the
  handoff's own synthetic `focusEnd()` re-baselined `#committed`, erasing the divergence `change`'s
  blur check depends on). Plus M2 (CM path fired `input` on programmatic writes, breaking parity
  with the plain path / `ui-textarea`), M3 (CM path double-fired `input` per keystroke), M4 (the
  confinement gate's regex missed value re-exports and multi-line imports — which would also evade
  the identity gate transitively), and a PRD amendment spliced mid-sentence.
  All fixed: M1a via a real post-handoff `setDoc(this.value)` using the CURRENT value; M1b via a
  consume-once flag suppressing exactly the handoff's own re-baseline; M2 via a CodeMirror
  `Annotation` marking programmatic writes so the update listener skips them; M3 via stopping the
  CM mount's native `input` at its own boundary; M4's regex now catches `export … from` and
  multi-line forms with negative controls; the PRD amendment re-seated below its complete status
  sentence. A new browser test (both engines) exercises the EXACT M1 race — typing into the plain
  surface during the CM load window, before asserting survival + a single correct `change` commit
  on blur — not just a pre-seeded-value happy path.
  Re-verified independently, all fixes read as claimed in the diff: `npm run check` clean,
  `npm test` 6441/6441 (up from 6429 — the new negative controls + M1/M2/M3 regression tests),
  browser suite for the touched packages green both engines (spot-checked 78/78 across
  `editor.browser.test.ts` + `agent-admin.browser.test.ts`). The reported full-174-file-browser-run
  WebKit flakiness was independently reproduced by the reviewer and confirmed unrelated to this
  change (resource exhaustion at scale, not a regression) — worth its own infra ticket, not this
  one's problem. TKT-0090 is done.
