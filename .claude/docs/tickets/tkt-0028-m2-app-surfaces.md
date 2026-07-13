---
doc-type: ticket
id: tkt-0028
status: doing
date: 2026-07-12
owner:
kind: feature
size: big
---
# TKT-0028 — agent-app-surfaces M2: the surface-host + conversation primitives

## Summary
Kim's directive (2026-07-12): run the design intake for the `agent-app-surfaces` M2 milestone —
the two never-specced PRD goals, **PRD-G3** (a surface-host primitive: agent-emitted A2UI content
appears in a running app with zero app-written renderer/transport glue) and **PRD-G4** (a
conversation primitive: a multi-turn agent conversation — thread + composer + streaming —
presented from a primitive, not hand-built chrome). Unlike a blank-page intake, M2 starts from
two independent, already-shipped site prototypes: `site/lib/surface-registry.ts` +
`site/lib/ask-registry.ts` + `site/lib/canvas-surface.ts` + `site/pages/a2ui-live.ts` +
`site/pages/a2ui-chat.ts` (TKT-0020). The intake's job is to generalize the proven mechanism into
two `@agent-ui/app` primitives, not invent a new one. This ticket is the milestone's spine; the
build fans out separately (docs only this wave).

## Acceptance
- `ui-surface-host` ships: one `RendererHost` per instance, mount/ingest/finalize/dispose +
  an `onClientMessage` callback, never a transport/produce-loop/provider-shaped API.
- `ui-conversation` ships: an opaque thread + composer, honest per-turn narration
  (`ui-status-stream`, ADR-0088), and composes N `ui-surface-host` instances internally — one per
  open surface, persistent identity across turns (generalizing `SurfaceRegistry`/`AskRegistry`).
- Both primitives land in `@agent-ui/app` (the PRD-D3 apex; the `@agent-ui/a2ui` dependency
  declared-but-unexercised at M1 is exercised here), pass the full fleet DoD (descriptor,
  contract↔props trip-wire, `component-reviewer` ≥4 both axes, forced-colors, cross-engine
  browser truth), and stay catalog-invisible by construction (no `EXCLUSION_ALLOWLIST` entry
  needed — the same posture as `ui-app-shell`/`ui-master-detail`/`ui-settings`).
- `a2ui-live` AND `a2ui-chat.ts` both re-express on the primitives (transport call sites
  unchanged); `site/lib/{canvas-surface,surface-registry,ask-registry}.*` are then deleted.
- The house pipeline: design intake (SPEC/LLD/decomp, doc-reviewed, genuine forks to Kim via a
  proposed ADR) → build (separately dispatched) → independent review → commit.

## Links
- `.claude/docs/prd/agent-app-surfaces.prd.md` — PRD-G3/G4's metric/baseline/target rows, §4
  Fork 2 (PRD-D2, the host-chrome/trusted-frame boundary this milestone composes into), §5's
  "still open" sub-questions (produce-loop ownership; the conversation+canvas-host pairing) —
  both resolved by this intake's ADR.
- `.claude/docs/spec/agent-app-shell.spec.md` + `.claude/docs/lld/agent-app-shell.lld.md` (M1,
  accepted/shipped) — the shell + region model M2's primitives dock into.
- `.claude/docs/adr/0120-app-surfaces-m4-panes-settings.md` (M4, accepted/shipped) — the sibling
  milestone already specced and built (`ui-split`, master-detail, settings); M2 fills the gap
  between M1 and M4.
- `.claude/docs/adr/0128-renderer-structural-resend-reconciliation.md` (accepted) — the resend-
  reconciliation fix `ui-conversation`'s persistent surface identity assumes as a precondition.
- `site/lib/surface-registry.ts` · `site/lib/ask-registry.ts` (ADR-0097 §2) · `site/lib/canvas-
  surface.ts` · `site/pages/a2ui-live.ts` · `site/pages/a2ui-chat.ts` (TKT-0020) — the generalized
  embryos; all five files are the migration/deletion targets, not independent inventions.
- `.claude/docs/references/naming.md` §4 (the closed six-event vocabulary — both primitives use
  callback registration, not a synthesized DOM event, per the shipped `RendererHost.
  onClientMessage` precedent) and §8/§9 (bare `./{name}` subpaths, the app/router package shape).

## Scope / Open
- In scope: `ui-surface-host` + `ui-conversation` (design + build, this ticket spans both); the
  `a2ui-live`/`a2ui-chat.ts` re-hosts; deleting the now-redundant site/lib embryos; the
  `@agent-ui/app` size re-base.
- Out of scope (later milestones/tickets): the tool-call/result surface (PRD-G5, M3); `ui-split`/
  master-detail/settings (PRD-G7/G8, M4 — already specced separately,
  `app-surfaces-m4.{spec,lld}.md`); any transport/provider/backend change (PRD's own non-goal —
  app surfaces consume the existing `AgentTransport`/produce-loop seam, they do not reimplement
  it); a new DOM-event vocabulary member (naming.md §4's closed-set discipline — an ADR-gated
  admission this intake deliberately declines to request).
- **Non-goals:** a chat framework; protocol changes; new `@agent-ui/components` controls (compose
  the shipped fleet — a gap surfaces as its own component ticket, the ADR-0102 routing law).
- Constraints held during this intake: never touched `tokens.css`; never touched `controls/
  select` or the `a2ui-compose` skill (a concurrent seat's territory, cited by anchor only).

## Findings

**2026-07-12 — design intake complete, documents-only, no build.** Produced:
- [`../spec/app-surfaces-m2.spec.md`](../spec/app-surfaces-m2.spec.md) (SPEC-R1…R11).
- [`../lld/app-surfaces-m2.lld.md`](../lld/app-surfaces-m2.lld.md) (component map LLD-C1…C13,
  frozen `ui-surface-host`/`ui-conversation`/`AgentTurnHandle` interfaces, the build sequence
  incl. the deletion-ordering guard, risks, four open forks in §8).
- [`../decompositions/app-surfaces-m2.decomp.json`](../decompositions/app-surfaces-m2.decomp.json)
  (`coverage_check.py --strict` clean: 18 nodes/18 actions/18 hosts/18 edges, plan mode).
- [`../adr/0129-app-surfaces-m2-composition-and-transport-boundary.md`](../adr/0129-app-surfaces-m2-composition-and-transport-boundary.md)
  (proposed; four forks — transport boundary, composition, narration/disclosure split,
  reference-app scope — await Kim's ruling, each with a firm recommendation).

**The package-boundary ruling (re-affirmed, not re-opened):** both primitives land in
`@agent-ui/app`, exercising the `@agent-ui/a2ui` dependency M1's `package.json` declared but left
unexercised. This is PRD-D3's ratified DAG-forcing argument applied, not a fresh decision — the
intake verified the M1 LLD's own comment ("declared now for M2's canvas-host") and did not
re-litigate Fork 3/PRD-D2.

**The composition ruling:** `ui-conversation` composes `ui-surface-host` internally, one instance
per open surface — the `SurfaceRegistry`/`AskRegistry` lifecycle promoted from site-land into the
primitive's own mechanism, now assuming the accepted ADR-0128 resend-reconciliation fix.

**The transport ruling:** neither primitive owns a transport, a produce loop, or provider config.
`ui-surface-host` exposes `ingest`/`finalize`/`dispose`/`onClientMessage`; `ui-conversation`
exposes an imperative `AgentTurnHandle` (`ingestLine`/`setNote`/`finalize`/`fail`) the APP'S OWN
turn loop drives as its own transport yields lines. This resolves the PRD §5 open question
("does the canvas/surface-host fully own the `produce` loop… or only mount + stream") as **only
mount + stream** — the model-calling machinery stays Node/site-scoped, never promoted into a
package.

**A correction to the intake brief's `EXCLUSION_ALLOWLIST` assumption:** the brief anticipated
both new elements would "join the `EXCLUSION_ALLOWLIST`." Verified against
`a2ui/src/catalog/default/index.test.ts`: that gate's `FLEET_TYPES`/residue guard scans only
`@agent-ui/components` descriptors — `ui-app-shell`, `ui-master-detail`, and `ui-settings` (all
shipped, M1/M4) carry **no** allowlist row today because they live in `@agent-ui/app`, outside
the gate's scan scope entirely. `ui-surface-host`/`ui-conversation` follow the identical,
already-precedented posture — catalog-invisible by construction, no allowlist entry needed or
added (SPEC-R10).

**Doc review (self-run, `scribe:doc-reviewer`):** dispatched against both new documents; see the
review verdicts recorded by the reviewing pass. Fixes applied pre-commit where the review found
gaps; verdicts reported to the requesting seat.
