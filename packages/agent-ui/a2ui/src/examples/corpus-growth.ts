// corpus-growth.ts — the 2026-07-28 M-B exemplar-growth wave (`a2ui-corpus-curate`), authored to close
// four DISTINCT gaps found by reading the committed 11-record shard + the current live-failure roster,
// not to pad the count:
//
// (1) FEEDBACK FORM — `Textarea` had ZERO shard coverage (the control entered the catalog the same day,
//     GH #328/#329) — a plain multi-line form control an agent legitimately emits, same shape as
//     `TextField`. Covers: Textarea.
// (2) RETREAT RESCHEDULE — every existing Calendar-range seed (`booking-reservation`) binds
//     `valueStart`/`valueEnd` to EMPTY paths a user fills in for the first time — a write-only demo. This
//     one pre-populates the SAME two paths from the data model (a real existing booking) and binds the
//     Calendar to them, so the exemplar teaches a genuine READ+WRITE round trip (ADR-0161 widened the
//     mark to two-way; the prior seed's comment calling it "one-way" is now stale — fixed in the same
//     commit, see catalog-coverage.ts). Covers: Calendar (range, round-trip).
// (3) ELEVATION SCALE — every `Card` on the whole shelf (21 records, grep-verified) uses `elevation:"1"`
//     and NOTHING else; the corpus has literally never shown the model a differently-spelled member of
//     `Card.elevation`'s numeric-looking string enum. That is exactly the shape GH #286/#305 fixed the
//     PROMPT description for (a model that kept guessing the bare number `-2` instead of the string
//     `"-2"`) — a few-shot exemplar using FOUR distinct, correctly-quoted values reinforces the fix at
//     the conditioning layer, not just the prompt layer. Covers: Card.elevation (multi-value).
// (4) TRIVIA ROUND RESUME — GH #307 (open): a multi-round game-loop RESUME repeatedly fails IDGRAPH; the
//     shelf's only worked lifecycle exemplar (`kpi-panel-lifecycle`) shows exactly ONE restructure
//     (a container growing by one appended child) — it never demonstrates the actual resume shape a
//     multi-ROUND loop needs: the SAME mutable container id resent WHOLLY, with a completely different
//     child set each round (not an append), while the root wrapper is delivered once and never resent.
//     This seed is that missing worked arc — three rounds, each round's `q_area` a full resend, scoring
//     via data-only reacts between rounds. Covers: the #307 resume discipline.
//
// Each seed's `promptText`/`description` names its own gap so the corpus-quality rubric's D2 (prompt
// realism) and D5 (dedup adjacency / genuine diversity) can be judged against a stated intent, not
// inferred.

import type { ExampleSeed } from './types.ts'

// ── (1) Feedback form — Textarea's first shard exemplar ────────────────────────────────────────────

const FEEDBACK_ID = 'feedback-form'
export const feedbackFormSeed: ExampleSeed = {
  name: 'feedback-form',
  description:
    'A feedback form — an optional email TextField and a required multi-line Textarea comment box, gated by a FormProvider (Textarea’s first shard exemplar).',
  promptText:
    'Build a feedback form: an optional email address and a required box where people can write as much as they want about their experience, with a Send button.',
  surfaceId: FEEDBACK_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: FEEDBACK_ID, catalogId: 'agent-ui', sendDataModel: true } },
    { version: 'v1.0', updateDataModel: { surfaceId: FEEDBACK_ID, value: { feedback: { email: '', comments: '' } } } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: FEEDBACK_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['root_content'] },
          { id: 'root_content', component: 'CardContent', children: ['form'] },
          { id: 'form', component: 'FormProvider', children: ['col'] },
          { id: 'col', component: 'Column', gap: 'md', children: ['title', 'f_email', 'f_comments', 'actions'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'Send feedback' },
          { id: 'f_email', component: 'Field', label: 'Email (optional)', child: 'in_email' },
          {
            id: 'in_email', component: 'TextField', name: 'email', type: 'email', value: { path: '/feedback/email' },
            checks: [{ call: 'email', args: { value: { path: '/feedback/email' } }, message: 'Enter a valid email' }],
          },
          { id: 'f_comments', component: 'Field', label: 'Comments', description: 'What worked, what didn’t', child: 'in_comments' },
          {
            id: 'in_comments', component: 'Textarea', name: 'comments', required: true, rows: 5,
            placeholder: 'Tell us about your experience…', value: { path: '/feedback/comments' },
            checks: [{ call: 'required', args: { value: { path: '/feedback/comments' } }, message: 'Comments are required' }],
          },
          { id: 'actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_send'] },
          { id: 'btn_send', component: 'Button', variant: 'solid', label: 'Send feedback', action: { action: 'send_feedback', submit: true } },
        ],
      },
    },
  ],
}

// ── (2) Retreat reschedule — a genuinely round-tripping Calendar range ──────────────────────────────

const RESCHEDULE_ID = 'retreat-reschedule'
export const retreatRescheduleSeed: ExampleSeed = {
  name: 'retreat-reschedule',
  description:
    'Rescheduling an already-booked multi-day retreat — a Calendar range PRE-POPULATED from the data model, with valueStart/valueEnd bound to the SAME two paths that seeded it, so a newly-picked range writes straight back (ADR-0161’s two-way widening, exercised as an actual round trip, not a first-time write).',
  promptText: 'We already booked the team offsite for Sep 1–3; let me pick new dates on a calendar and confirm the change.',
  surfaceId: RESCHEDULE_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: RESCHEDULE_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: { surfaceId: RESCHEDULE_ID, value: { retreat: { start: '2026-09-01', end: '2026-09-03' } } },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: RESCHEDULE_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['root_content'] },
          { id: 'root_content', component: 'CardContent', children: ['col'] },
          { id: 'col', component: 'Column', gap: 'md', children: ['title', 'f_dates', 'actions'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'Reschedule team offsite' },
          { id: 'f_dates', component: 'Field', label: 'New dates', child: 'cal_dates' },
          // Both `valueStart` and `valueEnd` are bound to the paths ALREADY populated above — the
          // Calendar opens showing the current booking (read) and a completed range pick writes the new
          // dates straight back into `/retreat/start`–`/retreat/end` (write), the same two slots.
          {
            id: 'cal_dates', component: 'Calendar', mode: 'range', name: 'dates', min: '2026-07-07',
            valueStart: { path: '/retreat/start' }, valueEnd: { path: '/retreat/end' },
          },
          { id: 'actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_confirm'] },
          { id: 'btn_confirm', component: 'Button', variant: 'solid', label: 'Confirm new dates', action: { action: 'confirm_reschedule', submit: true } },
        ],
      },
    },
  ],
}

// ── (3) Elevation scale — four correctly-quoted, non-"1" Card.elevation members ─────────────────────

const ELEVATION_ID = 'elevation-scale'
export const elevationScaleSeed: ExampleSeed = {
  name: 'elevation-scale',
  description:
    'A four-tile Card elevation legend — "-2"/"0"/"2"/"3", each the string-typed numeric-looking enum member double-quoted on the wire (GH #286/#305’s exact fix, reinforced here as conditioning material rather than only a prompt-description repair).',
  promptText: 'Show me a legend of card elevation levels — sunken, flat, raised, and floating — so I can see the depth scale.',
  surfaceId: ELEVATION_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: ELEVATION_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: ELEVATION_ID,
        components: [
          { id: 'root', component: 'Column', gap: 'lg', children: ['title', 'tiles_row'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'Card elevation scale' },
          { id: 'tiles_row', component: 'Row', gap: 'md', wrap: true, children: ['tile_n2', 'tile_0', 'tile_2', 'tile_3'] },

          { id: 'tile_n2', component: 'Card', elevation: '-2', children: ['tile_n2_content'] },
          { id: 'tile_n2_content', component: 'CardContent', children: ['tile_n2_col'] },
          { id: 'tile_n2_col', component: 'Column', gap: 'xs', children: ['tile_n2_label', 'tile_n2_desc'] },
          { id: 'tile_n2_label', component: 'Text', variant: 'h5', text: 'elevation "-2"' },
          { id: 'tile_n2_desc', component: 'Text', variant: 'caption', text: 'Sunken — recessed below the page' },

          { id: 'tile_0', component: 'Card', elevation: '0', children: ['tile_0_content'] },
          { id: 'tile_0_content', component: 'CardContent', children: ['tile_0_col'] },
          { id: 'tile_0_col', component: 'Column', gap: 'xs', children: ['tile_0_label', 'tile_0_desc'] },
          { id: 'tile_0_label', component: 'Text', variant: 'h5', text: 'elevation "0"' },
          { id: 'tile_0_desc', component: 'Text', variant: 'caption', text: 'Flat — flush with the page' },

          { id: 'tile_2', component: 'Card', elevation: '2', children: ['tile_2_content'] },
          { id: 'tile_2_content', component: 'CardContent', children: ['tile_2_col'] },
          { id: 'tile_2_col', component: 'Column', gap: 'xs', children: ['tile_2_label', 'tile_2_desc'] },
          { id: 'tile_2_label', component: 'Text', variant: 'h5', text: 'elevation "2"' },
          { id: 'tile_2_desc', component: 'Text', variant: 'caption', text: 'Raised — a lifted panel' },

          { id: 'tile_3', component: 'Card', elevation: '3', children: ['tile_3_content'] },
          { id: 'tile_3_content', component: 'CardContent', children: ['tile_3_col'] },
          { id: 'tile_3_col', component: 'Column', gap: 'xs', children: ['tile_3_label', 'tile_3_desc'] },
          { id: 'tile_3_label', component: 'Text', variant: 'h5', text: 'elevation "3"' },
          { id: 'tile_3_desc', component: 'Text', variant: 'caption', text: 'Floating — overlay-level depth' },
        ],
      },
    },
  ],
}

// ── (4) Trivia round resume — the GH #307 multi-round resume discipline ─────────────────────────────

const TRIVIA_ID = 'trivia-round-resume'
export const triviaRoundResumeSeed: ExampleSeed = {
  name: 'trivia-round-resume',
  description:
    'A three-round trivia loop — the mutable question-area container ("q_area") is resent WHOLE every round with a completely different child set (never an append), the root wrapper is delivered exactly once and never resent, and the score updates via data-only reacts between rounds (the GH #307 same-surface RESUME discipline the shelf’s only other lifecycle exemplar, kpi-panel-lifecycle, never exercises — that one only ever appends).',
  promptText: 'Run a 3-question trivia round: show one question with answer buttons, update the score after each pick, and load the next question each time without breaking anything.',
  surfaceId: TRIVIA_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: TRIVIA_ID, catalogId: 'agent-ui', sendDataModel: true } },

    // `root` is a STABLE wrapper delivered exactly once and never resent (runtime SPEC-R3 AC2, the
    // kpi-panel-lifecycle precedent). It names `q_area` before that id has arrived — a legal pending
    // anchor (SPEC-R4) filled by round 1's message below.
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: TRIVIA_ID,
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: ['title', 'score_stat', 'q_area'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'Trivia round' },
          { id: 'score_stat', component: 'Stat', label: 'Score', value: { path: '/score' } },
        ],
      },
    },
    { version: 'v1.0', updateDataModel: { surfaceId: TRIVIA_ID, value: { score: 0, round: 1 } } },

    // Round 1 — q_area's FIRST delivery.
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: TRIVIA_ID,
        components: [
          { id: 'q_area', component: 'Card', elevation: '1', children: ['q_area_content'] },
          { id: 'q_area_content', component: 'CardContent', children: ['q_area_col'] },
          { id: 'q_area_col', component: 'Column', gap: 'sm', children: ['q1_text', 'q1_choices'] },
          { id: 'q1_text', component: 'Text', variant: 'h5', text: 'Round 1 — What is the capital of Finland?' },
          { id: 'q1_choices', component: 'Row', gap: 'sm', wrap: true, children: ['q1_helsinki', 'q1_stockholm'] },
          { id: 'q1_helsinki', component: 'Button', variant: 'solid', label: 'Helsinki', action: { action: 'answer_capital_correct', wantResponse: true } },
          { id: 'q1_stockholm', component: 'Button', variant: 'soft', label: 'Stockholm', action: { action: 'answer_capital_wrong', wantResponse: true } },
        ],
      },
    },
    // React only — no updateComponents in this step (the correct answer landed).
    { version: 'v1.0', updateDataModel: { surfaceId: TRIVIA_ID, path: '/score', value: 1 } },
    { version: 'v1.0', updateDataModel: { surfaceId: TRIVIA_ID, path: '/round', value: 2 } },

    // Round 2 — q_area resent WHOLE with a completely DIFFERENT child set (q2_* ids, not appended q1_*
    // survivors) — the resume shape #307's live failures are missing, not an append like the KPI seed.
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: TRIVIA_ID,
        components: [
          { id: 'q_area', component: 'Card', elevation: '1', children: ['q_area_content'] },
          { id: 'q_area_content', component: 'CardContent', children: ['q_area_col'] },
          { id: 'q_area_col', component: 'Column', gap: 'sm', children: ['q2_text', 'q2_choices'] },
          { id: 'q2_text', component: 'Text', variant: 'h5', text: 'Round 2 — Which planet is known as the Red Planet?' },
          { id: 'q2_choices', component: 'Row', gap: 'sm', wrap: true, children: ['q2_mars', 'q2_venus'] },
          { id: 'q2_mars', component: 'Button', variant: 'solid', label: 'Mars', action: { action: 'answer_planet_correct', wantResponse: true } },
          { id: 'q2_venus', component: 'Button', variant: 'soft', label: 'Venus', action: { action: 'answer_planet_wrong', wantResponse: true } },
        ],
      },
    },
    { version: 'v1.0', updateDataModel: { surfaceId: TRIVIA_ID, path: '/score', value: 2 } },
    { version: 'v1.0', updateDataModel: { surfaceId: TRIVIA_ID, path: '/round', value: 3 } },

    // Round 3 (final) — q_area resent WHOLE a third time, this time with a summary instead of choices,
    // proving the discipline holds for an arbitrary number of rounds, not just a second one.
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: TRIVIA_ID,
        components: [
          { id: 'q_area', component: 'Card', elevation: '1', children: ['q_area_content'] },
          { id: 'q_area_content', component: 'CardContent', children: ['q_area_col'] },
          { id: 'q_area_col', component: 'Column', gap: 'sm', children: ['game_over_text', 'final_score_text'] },
          { id: 'game_over_text', component: 'Text', variant: 'h5', text: 'Round complete!' },
          { id: 'final_score_text', component: 'Text', variant: 'body', text: '${score}/2 correct' },
        ],
      },
    },
  ],
}

/** Every seed this module defines — the barrel's family-array precedent (index.ts derives `allSeeds`
 *  length from these, never a hand-counted literal). */
export const corpusGrowthSeeds: readonly ExampleSeed[] = [
  feedbackFormSeed,
  retreatRescheduleSeed,
  elevationScaleSeed,
  triviaRoundResumeSeed,
]
