// plan-and-execute.ts — GH #1374's judged exemplar (the design ruling's own closure path, Findings
// comment 5343203377, 2026-08-19): plan-and-execute (show the plan, approve, watch progress) is a
// TEACHING gap, not a design gap — every fork the issue named already resolves by CITING a standing
// decision (mint-vs-compose smallest-floor test, ADR-0107→ADR-0205); no ADR, no catalog/token/prompt-
// contract change. Two coupled exemplars compose the recipe end to end — a documented REPAIR from this
// module's first draft (recorded in #1374's Findings, not silently smoothed over): the ruling's own
// text — "the ask rides the same validated stream on its own surfaceId; everything else routes to the
// canvas" (ADR-0097 §1) — describes a single RENDERER-legal producer turn addressing two surfaceIds,
// which `validateA2ui` (tier-1) genuinely allows. But a CORPUS record is stricter: ADR-0064/SPEC-R2 AC3
// require an exemplar's `a2uiOutput` to address EXACTLY ONE surfaceId (`record.ts#checkSingleSurface` —
// discovered the hard way, admission-time `E_SCHEMA: a2uiOutput[3]`, the second `createSurface`, when
// this module's original single-seed draft tried to carry both surfaces in one record). So the one
// producer turn the ruling describes is realized here as two SIBLING single-surface exemplars — exactly
// how `message-lifecycle.ts`/`catalog-frontier.ts` already split a multi-part flow across seed records
// when one record's shape can't carry it all — not as one seed spanning two surfaceIds:
//
// (1) `plan-and-execute-plan` (canvas surface) — the PLAN SNAPSHOT: a `Timeline` templated over
//     `/plan/steps` (the Grid/List/Column ChildList-templating idiom, applied to plan steps): every
//     `TimelineItem.status` is bound `{path:'status'}` to the shipped six-member enum
//     (`['', 'pending', 'active', 'done', 'error', 'warning']`, `timeline-item.ts:77`, `bindable: true`
//     on the catalog row) — proposed steps start `pending` (F3's hollow-ring "not yet run" signifier);
//     no new enum member, no `mode` prop (the ruling's fork 1: plan-ness is carried by CONTENT — a
//     visible, bound heading ("Proposed plan …") + an all-pending item set — never a host prop; the
//     ADR-0205 "second sparkline with a different name" test. REPAIR (round 2, independent review):
//     `Timeline.label` alone does NOT realize this — it maps to `internals.ariaLabel` only (never
//     painted), so the heading is a sibling `Text`, bound to `/plan/title` and flipped in the same turn
//     the plan is approved — "Proposed" stops being true the moment execution starts). The declined
//     step ("Publish summary" —
//     see (2)) is OMITTED on the post-approve `/plan/steps` resend, never a `skipped` status member (the
//     ruling's fork 4: the append-only feed + the frozen ask already preserve what was proposed and
//     declined; minting a member for a state history already narrates fails the smallest-floor test).
//     Then per-turn `updateDataModel` against the bound `status` paths on the SAME surface (the
//     `agentTaskStatusSeed` idiom, `catalog-coverage.ts`; the "dead data" doctrine) — no re-render, no
//     `updateComponents`, since every status is already bound. Each turn is a complete, validated,
//     replayable snapshot — never an imperative append/keyed-update stream (ADR-0122 F5's hard boundary:
//     "an agent emitting a Gen-UI payload emits a durable `Timeline` [a snapshot]; the LIVE narration
//     host is the app/shell" — `ui-status-stream`, untouched by this seed).
// (2) `plan-and-execute-approve-ask` (feed surface, `sendDataModel: true`) — THE ASK: ONE plan-level
//     commit-gated ask (ADR-0097's scalar lifecycle: at most one ask pending, frozen on dispatch), never
//     per-step approve Buttons (the ruling's fork 2: N pending asks would violate the scalar law).
//     Per-step opt-outs ride the ONE ask's data model as `Checkbox`es (`Checkbox` IS in
//     `FEED_SURFACE_TYPES`, `feed-catalog.ts`) under a `FormProvider` gate, committed by the single
//     "Approve plan" Button (`submit: true`, ADR-0054). `Timeline`/`TimelineItem` are `FEED_EXCLUDED`
//     (`feed-catalog.ts:227-231`: "an ask is a commit-gated question, not a narrative record") — so the
//     plan itself never enters this surface; only the approve controls do, which is exactly why this
//     couldn't be one record in the first place once the ADR-0064 single-surface rule applies.
//
// Emitted as ONE producer turn in the real system (both createSurface calls adjacent, same round), each
// seed's own `promptText` names the shared scenario so a reader sees them as one recipe without either
// record needing to reference the other's surfaceId.

import type { ExampleSeed } from './types.ts'

const CANVAS_ID = 'plan-and-execute-canvas'
const ASK_ID = 'plan-and-execute-ask'

export const planAndExecutePlanSeed: ExampleSeed = {
  name: 'plan-and-execute-plan',
  description:
    'A plan-and-execute PLAN SNAPSHOT — a bound heading + a proposed Timeline (all steps pending, bound status paths); the heading flips Proposed→Approved and the declined step is omitted on re-emit, then per-turn updateDataModel advances the approved steps’ status as they run.',
  promptText:
    'Plan out this week’s metrics report — fetch the numbers, analyze the trend, and publish a summary — show me the plan first; once I approve it (I’ll skip publishing for now), run the steps and show progress as you go.',
  surfaceId: CANVAS_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: CANVAS_ID, catalogId: 'agent-ui' } },
    // Whole-record seed (ADR-0126 whole-record idiom, the backable-wizard precedent): every step the
    // Timeline will template over already exists in the data model before the components arrive.
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: CANVAS_ID,
        value: {
          plan: {
            steps: [
              { label: 'Fetch latest metrics', description: 'Query the analytics warehouse for the last 30 days.', status: 'pending' },
              { label: 'Analyze trends', description: 'Compare against last month and flag anomalies.', status: 'pending' },
              { label: 'Publish summary', description: 'Post the report to the #metrics channel.', status: 'pending' },
            ],
          },
        },
      },
    },
    {
      version: 'v1.0',
      updateDataModel: { surfaceId: CANVAS_ID, path: '/plan/title', value: 'Proposed plan — this week’s metrics report' },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: CANVAS_ID,
        components: [
          // Plan framing is carried by CONTENT (fork 1), not a host mode prop — but content-level framing
          // means a VISIBLE heading, not `Timeline.label` alone: that prop maps to `internals.ariaLabel`
          // only (`timeline.ts`), never painted, so it cannot carry the "this is proposed" signal to a
          // sighted reader on its own (an independent review caught this — the first draft claimed
          // `Timeline.label` alone did the job; it doesn't). `title` is the real, bound, updatable heading;
          // `Timeline.label` stays as the rail's own accessible name, describing what it IS (a list) not
          // its live state.
          { id: 'root', component: 'Column', gap: 'md', children: ['title', 'timeline'] },
          { id: 'title', component: 'Text', variant: 'h5', text: { path: '/plan/title' } },
          { id: 'timeline', component: 'Timeline', label: 'Plan steps', children: { path: '/plan/steps', componentId: 'plan_item' } },
          {
            id: 'plan_item', component: 'TimelineItem',
            status: { path: 'status' }, label: { path: 'label' }, description: { path: 'description' },
          },
        ],
      },
    },
    // The user approved the plan but opted out of "Publish summary" on the companion approve ask
    // (`plan-and-execute-approve-ask`) — whole-record resend of "/plan/steps" (the "dead data" doctrine:
    // never a diff), dropping the declined step entirely (fork 4). No new enum member for "declined";
    // the sibling ask's own record is the durable trace of what was proposed and skipped. The heading
    // flips in the SAME turn — "Proposed" is no longer true the moment execution starts (the staleness
    // an independent review also flagged: a bound, live heading is worth nothing if nothing ever moves it).
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: CANVAS_ID,
        path: '/plan/steps',
        value: [
          { label: 'Fetch latest metrics', description: 'Query the analytics warehouse for the last 30 days.', status: 'pending' },
          { label: 'Analyze trends', description: 'Compare against last month and flag anomalies.', status: 'pending' },
        ],
      },
    },
    { version: 'v1.0', updateDataModel: { surfaceId: CANVAS_ID, path: '/plan/title', value: 'Approved plan — this week’s metrics report' } },
    // Per-turn progress advance — scoped updateDataModel, no updateComponents (the agentTaskStatusSeed
    // idiom: every TimelineItem.status is already bound, so a status change alone re-paints the marker
    // glyph). Each turn a complete, replayable payload — ADR-0122 F5's snapshot boundary.
    { version: 'v1.0', updateDataModel: { surfaceId: CANVAS_ID, path: '/plan/steps/0/status', value: 'active' } },
    { version: 'v1.0', updateDataModel: { surfaceId: CANVAS_ID, path: '/plan/steps/0/status', value: 'done' } },
    { version: 'v1.0', updateDataModel: { surfaceId: CANVAS_ID, path: '/plan/steps/1/status', value: 'active' } },
    { version: 'v1.0', updateDataModel: { surfaceId: CANVAS_ID, path: '/plan/steps/1/status', value: 'done' } },
  ],
}

export const planAndExecuteApproveAskSeed: ExampleSeed = {
  name: 'plan-and-execute-approve-ask',
  description:
    'A plan-and-execute APPROVE ASK — one ADR-0097 commit-gated Button under a FormProvider, with per-step Checkbox opt-outs riding the ask’s own data model (the scalar-lifecycle-conformant realization of "approve before running steps").',
  promptText: 'Plan out this week’s metrics report: fetch the latest numbers, analyze the trend, and publish a summary — but let me approve the plan first, and I want to skip the publish step for now.',
  surfaceId: ASK_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    // `sendDataModel: true` — the cardAnatomyAskSeed/backableWizardSeed convention: the ask's answer
    // round-trips back to the producer.
    { version: 'v1.0', createSurface: { surfaceId: ASK_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: ASK_ID,
        value: { approve: { includeFetch: true, includeAnalyze: true, includePublish: true } },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: ASK_ID,
        components: [
          { id: 'root', component: 'FormProvider', children: ['card'] },
          { id: 'card', component: 'Card', elevation: '1', children: ['card_header', 'card_content', 'card_footer'] },
          { id: 'card_header', component: 'CardHeader', children: ['title'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'Approve this plan?' },
          { id: 'card_content', component: 'CardContent', children: ['col'] },
          { id: 'col', component: 'Column', gap: 'sm', children: ['cb_fetch', 'cb_analyze', 'cb_publish'] },
          // Per-step opt-outs ride the ONE ask's data model — never per-step approve Buttons (fork 2:
          // N pending asks would violate ADR-0097's scalar lifecycle).
          { id: 'cb_fetch', component: 'Checkbox', name: 'includeFetch', label: 'Fetch latest metrics', checked: { path: '/approve/includeFetch' } },
          { id: 'cb_analyze', component: 'Checkbox', name: 'includeAnalyze', label: 'Analyze trends', checked: { path: '/approve/includeAnalyze' } },
          { id: 'cb_publish', component: 'Checkbox', name: 'includePublish', label: 'Publish summary', checked: { path: '/approve/includePublish' } },
          { id: 'card_footer', component: 'CardFooter', children: ['actions'] },
          { id: 'actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_approve'] },
          // The ONE commit — freezes on dispatch (ADR-0097 §2); `submit: true` gates on the FormProvider's
          // validity (ADR-0054), same convention as `pattern-settings-form`'s `save_settings` commit.
          { id: 'btn_approve', component: 'Button', variant: 'solid', label: 'Approve plan', action: { action: 'approve_plan', submit: true } },
        ],
      },
    },
    // The user unchecks "Publish summary" before approving — a live two-way Checkbox toggle, the same
    // scoped-path form `message-lifecycle.ts`'s "react" step uses.
    { version: 'v1.0', updateDataModel: { surfaceId: ASK_ID, path: '/approve/includePublish', value: false } },
  ],
}

/** Every seed this module defines — the barrel's family-array precedent (index.ts derives `allSeeds`
 *  length from these, never a hand-counted literal). */
export const planAndExecuteSeeds: readonly ExampleSeed[] = [planAndExecutePlanSeed, planAndExecuteApproveAskSeed]
