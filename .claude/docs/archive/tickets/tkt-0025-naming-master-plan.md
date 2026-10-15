---
doc-type: ticket
id: tkt-0025
status: done
date: 2026-07-12
owner:
kind: feature
size: big
---
# TKT-0025 — the web-component naming master plan: one grammar, per-namespace, gate-backed

## Summary
Kim's ask (2026-07-12, the naming exploration): consolidate the repo's scattered-but-strong naming
law into ONE designed system — a grammar per NAMESPACE (element tags · classes · props/attributes ·
events · control-tier CSS tokens · system-tier tokens · data-part/data-role · custom states · A2UI
catalog types · packages/subpaths · doc IDs), with the principles the fleet already demonstrably
operates on made explicit: one-name-one-meaning (the reserved-word law — `size`), closed
vocabularies with an ADR-gated admission path, prefix-as-ownership-boundary (ADR-0081/0124),
names-as-machine-readable-API, grep-ability over brevity (the `^ui-` palette ruling).

## Acceptance
- The exception-count INVENTORY first (the agreed step 1): per-namespace tables of observed
  practice with every deviation counted — sized evidence before any rule is argued.
- `references/naming.md` beside geometry.md/anatomy.md: per-namespace grammar, reserved words,
  admission paths, and the worked example — deriving a new family's ENTIRE name set (tag, class,
  tokens, parts, states, catalog type, folder, descriptor) from the one family-name decision.
- The gate gaps closed: a descriptor↔DOM `parts[]` truthfulness gate (the exact hole the
  color-picker review's L2 exposed), a custom-state vocabulary check, an event-name allowlist
  assertion at the emit seam.
- The five-question decision rubric for new names (namespace? reserved collision? closed-set
  admission → ADR? prefix = ownership? derivable from the family name?) folded into the
  agent-ui-component-design intake so naming stops being re-litigated per component.
- The ONE open taste fork brought to Kim with migration cost sized, not argued abstractly: the
  two token dialects (`--ui-*` control-tier vs `--md-sys-*` system-tier) — permanent two-tier vs
  convergence.
- Migration policy: fix-on-touch with a recorded exceptions list (the DISPOSITION_ALLOWLIST
  shape); the gates strict for NEW names from day one.

## Links
- The exploration record (this conversation, 2026-07-12) · `references/{geometry,anatomy,tokens}.md`
  · ADR-0078 (token naming) · ADR-0081/0124 (the family-root prefix law) · ADR-0032/0041 (the
  reserved `size`) · the family-coherence A2/A2b gates · `packages/agent-ui/a2ui/src/catalog/naming.test.ts`
  (the catalog namespace's existing gate) · `agent-ui-doc-standards` (the doc-ID namespace, done).
- `.claude/docs/reports/repo-alignment-2026-07-12/follow-up-queue.md` Q2 (the queue entry).

## Scope / Open
- Whether `references/naming.md` subsumes the naming slices currently living inside
  geometry/anatomy/tokens or only cross-references them (one-fact-one-home decides at authoring).
- **Non-goals:** renaming shipped surfaces (fix-on-touch only); the doc-ID namespace (codified in
  agent-ui-doc-standards at the repo-alignment).

## Findings

### 2026-07-12 — steps 1+2 done: the inventory + references/naming.md (review-shipped)

- The sized inventory: [`../reports/naming-inventory-2026-07-12.md`](../reports/naming-inventory-2026-07-12.md)
  (9 namespaces, top-10 exceptions; one count corrected at review — `axis` is ui-split only, 7:1).
- [`../references/naming.md`](../references/naming.md) authored + independently reviewed (SHIP after one
  MAJOR — ui-text falsely listed as an axis exception, fixed; the data-role registry scoped to
  control-emitted + named author hooks; the 7-class ladder footnoted). The §10 five-question rubric
  folded into `agent-ui-component-design` (naming is not re-litigated at build).
- REMAINING: the four §11 gate closures (emit-seam allowlist · custom-state vocabulary · data-role
  registry scan · descriptor↔DOM parts) — build slices; and the §12 OPEN fork (the two token
  dialects) → Kim.
- **The §12 fork RULED (Kim, 2026-07-12): two-tier stands, permanent.** Remaining: the four gate closures only.

### 2026-07-12 — the four §11 gate closures shipped (naming-gates.test.ts)

- New file: `packages/agent-ui/components/src/controls/naming-gates.test.ts` (53 tests), sited beside
  family-coherence.test.ts — gates 1-3 are the SAME shape (closed-vocabulary membership + a synthetic
  negative control proving it bites), widened from one descriptor to a repo-wide `packages/**/src`
  fs-walk (the docs-grammar.test.ts idiom); gate 4 is a live jsdom construction probe.
- **Gate 1 (emit-seam, §4):** scanned `emit('` / `new CustomEvent(` across all 8 package `src/` trees
  (a2a·a2ui·app·code·components·icons·router·shared), comment-stripped. **ZERO violations** — the six
  literal events found (change/input/select/toggle/close; no literal `open`/`click` emit site) all
  legal; `click` is NOT added to the seam allowlist (no emit-seam site uses it — button's pure-activation
  carve-out calls the platform `host.click()` directly, never `this.emit('click')`). Node-stream
  `.emit(` calls exist only in a2a's dev-proxy-plugin TEST file (excluded, confirmed). One real
  finding: `dom/form.ts`'s ADR-0050 protocol events (`ui-form-connect`/`ui-form-reset`) are
  identifier-fed `new CustomEvent(...)` calls outside the public vocab BY DESIGN (form.ts's own header
  says so) — added as `PROTOCOL_EVENT_EXCEPTIONS`, cited to form.ts + ADR-0050. One narrow, verified
  exception for a non-literal `this.emit(kind)` call (`color-picker.ts`'s `#commit`, `kind: 'input' |
  'change'`, both in-vocabulary) — a source-text scan can't resolve a typed parameter, so it's a named,
  cited `EMIT_IDENTIFIER_EXCEPTIONS` entry, not a blind allowance. No registry changes needed.
- **Gate 2 (custom states, §6):** scanned `states?.add/delete/toggle/replace/has(` (both `this.internals.states`
  and the checkbox.ts bare-local-alias form) + CSS `:state(...)`, all 8 packages. **ZERO violations** —
  exactly the 10 registered names in live use (ready/user-invalid/checked/dragging/revealed/disabled/
  collapsed/truncated/selected/indeterminate). No registry changes needed.
- **Gate 3 (data-role, §6):** scanned `data-role=`/`dataset.role =`, all 8 packages. **ZERO
  violations** — the 16 values found are all ∈ the §6 registry ∪ `empty` (the one real author-hook
  site, command-modal.ts). Confirmed naming.md §6's SECOND cited author hook, "command-modal", has NO
  matching `data-role="command-modal"` site anywhere in the fleet — NOT added to the registry (a gate
  assertion pins this: it fails if that ever silently starts being true without a design decision).
  No registry changes needed.
- **Gate 4 (descriptor↔DOM parts truthfulness, the color-picker L2 hole):** constructs all 30 real
  parts-bearing controls in `@agent-ui/components` (jsdom), lets each connect + flush, and checks every
  rendered `[data-part]` against the FLEET-WIDE union of declared `parts[]` (not just the host's own
  descriptor — naming.md §6 explicitly sanctions cross-control part-name reuse, e.g. `panel` everywhere,
  and two real composition patterns proved a per-host boundary check ambiguous: color-picker composing
  `ui-text-field`/`ui-swatch` wholesale, and command-modal's content getting RELOCATED into a nested
  `ui-modal`'s `<dialog>` at the modal's own connect time — the union check is correct and immune to
  both). **ZERO undeclared-anywhere violations** across the whole parts-bearing fleet. Two jsdom-harness
  fixes were needed (not exemptions — genuine preconditions any real consumer must also satisfy):
  jsdom lacks `ElementInternals.setFormValue`/`setValidity` (patched once on the prototype, generalizing
  the existing per-instance `calendar.test.ts` stub precedent); `ui-menu`/`ui-popover`/`ui-tooltip`
  throw at connect without a leading trigger/anchor child (seeded a bare `<button>`, the
  `menu.test.ts` DEFAULT_MARKUP shape). `EXCLUSION_ALLOWLIST` stays empty — every parts-bearing control
  constructs cleanly. **Scope cut, named in the gate's own comment:** construction-based, so it can
  only reach `@agent-ui/components`'s own fleet (not `@agent-ui/app`'s 3 parts-bearing descriptors —
  `ui-app-shell-region`/`ui-master-detail`/`ui-settings` — components sits below app in the package DAG
  and importing upward would be backwards even though nothing gates it on a `.test.ts` file). This
  mirrors `site-coverage.test.ts`'s own `FAMILY_ROOTS` scope-cut for its page-coverage gate (components
  only, same precedent). An app-package-local mirror of this gate is the natural follow-up if that
  coverage is wanted.
- Gates: `npm run check` green · the new file's 53 tests green · `npx vitest run packages/agent-ui/components
  site/lib` → 191/193 files, 3956/3958 tests green (the 2 red are `sitemap.test.ts` +
  `theme-provider-build-fixture.test.ts`, both pre-existing/unrelated — Kim's live, uncommitted
  `tokens.css` rework; confirmed by stashing it, `sitemap.test.ts` goes green while
  `theme-provider-build-fixture.test.ts` stays red on a clean tree too, i.e. neither traces to this
  change) · full `npm test` → 322/326 files, 5854/5858 tests green (same 2 + `tokens.test.ts` +
  `tokens-doc.test.ts`, all four tokens.css-shaped, zero overlap with naming/family-coherence/controls).
  No `naming.md` registry edits were needed — all four scans found the live fleet already fully
  conformant to the closed vocabularies (the point of freezing them into a gate now).

### 2026-07-12 — the gates reviewed (GO + one MAJOR, closed) — TKT-0025 COMPLETE

Independent review of `naming-gates.test.ts`: GO — every NC verified to bite, gate-1's
identifier-exception pinned per file::identifier (not a blind pass-through), the union parts check
justified by both real composition patterns, prototype patches isolation-safe. ONE MAJOR, closed
at the host (the builder seat was lost to a session restart): gate 3 missed `setAttribute
('data-role', …)` — the fleet's DOMINANT write form (12 sites) — and silently ignored the three
DYNAMIC sites gate 1 would have failed closed on. Fixed to gate-1 parity: the literal scan
widened, dynamic sites fail closed against `ROLE_IDENTIFIER_EXCEPTIONS` (timeline-item's
CONTENT_ROLES and text-field's LeadingRole/AffordanceRole unions verified member-by-member ∈ the
registry, cited), + three new NCs (56 tests, was 53). Gate 1's template-literal/aliased-emit scan
limits now NAMED in its comment (the review MINOR). All four §11 gates standing; the ticket's
acceptance is fully met — the naming master plan is inventory + grammar + rubric + gates, done.
