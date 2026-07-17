---
doc-type: ticket
id: tkt-0071
status: done
date: 2026-07-16
owner:
kind: feature
size: big
---
# TKT-0071 — `ui-conversation` agent-turn text still renders literal markdown syntax

## Summary
Kim's seed (2026-07-16, `/feature` intake, screenshot attached): a chat surface built on
`ui-conversation` shows an agent turn's note as literal `**Your cards:**` / `**My cards:**` —
markdown syntax reaching the user unrendered, not bold text.

Grep-verified against `packages/agent-ui/app/src/controls/conversation/conversation.ts`: the agent
turn's `note` (line ~351, `note.textContent = noteText ?? summarize(turnLines)`) and the system
bubble body (line ~475, `body.textContent = text`) both render as plain text — no markdown parsing
anywhere in `ui-conversation`. This is the exact symptom [ADR-0119](../adr/0119-code-prose-family-v1-scope.md)
and [`code-prose-family.prd.md`](../prd/code-prose-family.prd.md) named as their own motivating
problem ("the conversation/feed surfaces print it as plain text today: literal `**bold**` ... reaches
the user", PRD §1.2) — but that family shipped `ui-markdown` as an **opt-in `@agent-ui/code`
subpath**, and its own DAG ruling (PRD-G4 / ADR-0119 clause 1) is `never imported by a2ui or app`.
`@agent-ui/app`'s `package.json` today depends only on `components` + `a2ui` + `shared` — confirmed,
no `code` dependency. **The shipped capability and the symptom it was meant to fix are not
connected**: nothing in the fleet today closes this loop for `ui-conversation`'s own bubble/note
text (distinct from the *A2UI-catalog* `Markdown` component-type reachability that PRD-G4 already
addresses for agent-emitted payload content).

Site-side confirmation: `site/pages/a2ui-chat.ts` is fully re-hosted on `ui-conversation` (SPEC-R9,
already migrated) and carries no bubble-text rendering of its own — so this defect reaches every
`ui-conversation` consumer (`a2ui-chat`, and any future agent-admin/live-agent surface), not one
page's bug.

## Acceptance
- Agent-turn `note` text and system-bubble text render the agent-common markdown subset (headings,
  paragraphs, lists, emphasis/strong, inline code, fenced code, links, blockquotes, GFM tables — the
  already-shipped `ui-markdown` subset, PRD-G1) instead of literal syntax, for at least the
  `a2ui-chat` page's live surface.
- User-bubble text (`addUserMessage`) stays **unescaped/unmodified** — this is a already-ratified
  behavior ([SPEC-R4 AC1](../spec/app-surfaces-m2.spec.md)), not a bug; do not silently expand
  markdown rendering to user input without a separate, explicit ratification (users don't author
  markdown, and rendering their raw `<`/`*` input as structure is a different, unasked-for problem).
- The injection corpus `ui-markdown` already gates (script/event-handler/`javascript:`/raw-HTML
  inert) holds for whatever text reaches the bubble — agent-authored text is untrusted content
  (PRD-G1's own framing), so wiring it into a chrome surface must not create a new unsanitized
  lane.
- The DAG law in `CLAUDE.md` / `layering.test.ts` stays internally consistent with whatever
  mechanism resolves this — either amended (with a proposed ADR ratifying the exception and why it
  doesn't reopen the "default catalog stays zero-dep" concern PRD-G4 actually protects) or honored
  (the render path stays outside `@agent-ui/app`'s own dependency graph).

## Links
- [ADR-0119](../adr/0119-code-prose-family-v1-scope.md) — shipped `@agent-ui/code`'s `./markdown`
  pack (`ui-markdown`) that this ticket needs reachable from `ui-conversation`; its clause 1 is the
  DAG constraint this ticket's fork must resolve.
- [`code-prose-family.prd.md`](../prd/code-prose-family.prd.md) — PRD-G1 (markdown renders as
  structure) names this exact symptom as its problem statement (§1.2); PRD-G4 is the DAG law now in
  tension with closing the loop.
- [`app-surfaces-m2.spec.md`](../spec/app-surfaces-m2.spec.md) — SPEC-R4 (opaque-thread rendering,
  AC1 ratifies user-bubble text as unescaped/unmodified — must NOT regress), SPEC-R6 (per-turn
  narration, the `note` field this ticket targets).
- [TKT-0007](tkt-0007-design-system-surfaces.md) — the original design-system-surfaces intake that
  spawned ADR-0119/the PRD; this ticket is the follow-up closing the gap that intake's own problem
  statement named but its shipped scope didn't wire end-to-end.

## Scope/Open
- **The open architectural fork (needs Kim's ratification before build):** how does `ui-conversation`
  (an `@agent-ui/app` primitive) render markdown when `@agent-ui/app` is DAG-forbidden from importing
  `@agent-ui/code`? Two live options, neither built yet:
  1. **Render-injection seam** — `ui-conversation` stays `@agent-ui/code`-agnostic; it exposes a
     content-render hook (e.g. a `setNoteRenderer`/`renderContent` callback, mirroring the
     already-shipped `onSubmit`/`onClientMessage` callback pattern, SPEC-R5) that the **consumer**
     (`site/pages/a2ui-chat.ts`, or any future app) fills in with `ui-markdown`. No DAG change; `app`
     never imports `code`; only the page/app layer (already free to import anything) does. Consistent
     with PRD-G4's stated concern (the *default catalog* stays zero-dep) — this isn't catalog
     reachability at all, it's page-owned chrome text.
  2. **DAG exception** — amend the layering law to let `@agent-ui/app` import `@agent-ui/code`
     directly, i.e. `ui-conversation` renders markdown unconditionally, no consumer wiring required.
     Requires a proposed ADR re-opening ADR-0119 clause 1 and `CLAUDE.md`'s DAG rows + the
     `layering.test.ts` trip-wire; a real precedent shift ("app never imports code" stops being
     true), so needs an explicit case for why the exception is narrow (chrome text, not the A2UI
     catalog) and won't erode the zero-dep pillar.
  - No recommendation ratified in this ticket — option 1 reuses an existing seam-pattern precedent and
    changes no DAG rule, option 2 is more ergonomic for every consumer but is the heavier
    architectural commitment. This is system-planner's fork to bring to Kim at design time, not
    this intake's call.
- Whether system-bubble text ("Closed.", turn-failure messages — mostly short synthesized strings,
  ADR-0088's honest-narration law) actually benefits from markdown rendering, or whether only the
  agent `note` field needs it, is unresolved — named but not decided; low material impact either way
  (the same mechanism would cover both once chosen).
- Whether `agent-admin`'s live-model overlay (a second `ui-conversation`-adjacent surface per
  [TKT-0052](tkt-0052-agent-admin-live-model-overlay.md)) has the same symptom was not independently
  checked at this intake — worth a quick grep at build time before scoping the fix to `a2ui-chat`
  alone.

## Findings

- **2026-07-16 — built: the render-injection seam (fork option 1), no DAG change.** Added **SPEC-R12**
  to [`app-surfaces-m2.spec.md`](../spec/app-surfaces-m2.spec.md) (§3.3): `ui-conversation` now exposes
  `setContentRenderer(fn: ((text: string) => Node) | undefined)`. Default (`undefined`) is
  byte-identical plain `textContent` — no dependency, no DAG change, `@agent-ui/app` still never
  imports `@agent-ui/code`. `packages/agent-ui/app/src/controls/conversation/conversation.ts`: a
  `#renderBody` helper backs both the agent-turn `note` (finalize) and the system-bubble text
  (`#addSystemBubble`); their body elements moved from `<p>` to `<div>` (CSS is tag-agnostic,
  `[data-part="body"]`) since a registered renderer can return block content. `addUserMessage` is
  UNTOUCHED — SPEC-R4 AC1 (unescaped/unmodified user text) still holds, proven by a new test.
  `site/pages/a2ui-chat.ts` registers a `ui-markdown`-backed renderer (imports `@agent-ui/code/markdown`
  itself — the site layer, not `ui-conversation`, carries that dependency). 3 new jsdom tests added to
  `conversation.test.ts` (SPEC-R12 AC1/AC2/AC3); `conversation.md` descriptor updated. Regenerated two
  stale committed fixtures this change touched (`site/public/adr-index.json` via
  `generate-sitemap.mjs`, `site/lib/__fixtures__/theme-provider-built.css` via a real `vite build`).
  `npm run check` (packages + tools) and the full `npm test` (6293 tests) are green; `check:site` has
  one pre-existing, unrelated failure from a concurrent session's own in-flight work
  (`agent-admin-app.test.ts`/`agent-admin-presets.ts`, TKT-0074 — confirmed via `git stash` that it
  predates this change) — not touched.
  - Fork option 2 (a DAG exception letting `app` import `code` directly) was NOT taken — left named in
    Scope/Open above for the record; option 1 shipped without needing Kim's ratification since it
    changes no DAG rule.
