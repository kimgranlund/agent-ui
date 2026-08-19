// corpus-growth.ts — the 2026-07-28 M-B exemplar-growth wave (`a2ui-corpus-curate`), authored to close
// DISTINCT gaps found by reading the committed 11-record shard + the current live-failure roster, not
// to pad the count. Judged against `a2ui-corpus.md` 2026-07-28 (`a2ui-reviewer`): `feedback-form` and
// `elevation-scale` ADMIT (qualityScore 4 each); a third candidate, `retreat-reschedule`, was REJECTED
// (qualityScore 2, failing D1/D5) and DROPPED from this shelf entirely — its claimed gap ("every
// existing Calendar-range seed binds to empty paths") was FALSE: `booking-reservation`
// (catalog-coverage.ts) already seeds real dates and binds `valueStart`/`valueEnd` to them, so the
// claimed-first technique already existed; the seed also placed its Calendar outside any FormProvider
// while its submit button carried `submit:true`, which silently no-ops with no `submitGate` ancestor
// (renderer.ts). Not salvaged — a materially different Calendar exemplar needs its own evidenced gap.
//
// (1) FEEDBACK FORM — `Textarea` had ZERO shard coverage (the control entered the catalog the same day,
//     GH #328/#329) — a plain multi-line form control an agent legitimately emits, same shape as
//     `TextField`. Covers: Textarea.
// (2) ELEVATION SCALE — every `Card` on the whole shelf (21 records, grep-verified) uses `elevation:"1"`
//     and NOTHING else; the corpus has literally never shown the model a differently-spelled member of
//     `Card.elevation`'s numeric-looking string enum. That is exactly the shape GH #286/#305 fixed the
//     PROMPT description for (a model that kept guessing the bare number `-2` instead of the string
//     `"-2"`) — a few-shot exemplar using FOUR distinct, correctly-quoted values reinforces the fix at
//     the conditioning layer, not just the prompt layer. Covers: Card.elevation (multi-value).
// (3) TRIVIA ROUND RESUME — GH #307 (open): a multi-round game-loop RESUME repeatedly fails IDGRAPH; the
//     shelf's only worked lifecycle exemplar (`kpi-panel-lifecycle`) shows exactly ONE restructure
//     (a container growing by one appended child) — it never demonstrates the actual resume shape a
//     multi-ROUND loop needs: the SAME mutable container id resent WHOLLY, with a completely different
//     child set each round (not an append), while the root wrapper is delivered once and never resent.
//     This seed is that missing worked arc — three `q_area` resends, scoring via data-only reacts
//     between rounds. Covers: the #307 resume discipline. NOT YET ADMITTED — the first judged pass
//     (qualityScore 1, failing D1/D2) caught a real binding bug (a bare `${score}` outside any list-item
//     scope, resolving to the empty-string sentinel per `binding.ts`'s `resolvePointer` guard — fixed
//     below to `${/score}`) and a prompt/description mismatch (claimed 3 questions, only 2 fire — the
//     third `q_area` resend is the summary screen; reframed honestly below as a 2-question round). Holds
//     for re-judging before its next admission attempt (ADR-0068 clause 2/5c discipline).
//
//     P9 card-anatomy repair (2026-08-18, GH #1262 back-score wave): `feedback-form`'s `btn_send` and
//     `trivia-round-resume`'s per-round answer Buttons used to ride a `Row` inside `CardContent` with no
//     `CardFooter`. `feedback-form` is FormProvider-gated, so — same reasoning as `patterns.ts`/
//     `generative-form.ts`/`catalog-coverage.ts`'s `booking-reservation` — `root` becomes the
//     `FormProvider` itself, `Card` moves one level down (non-root), and `CardContent`/`CardFooter` stay
//     `Card`'s DIRECT children (`card.css`'s region-selector law) while still sitting inside the
//     `FormProvider`'s DOM subtree (real `closest()` submit-gating). `trivia-round-resume` carries no
//     FormProvider, so its repair is the simpler per-scene move: each `q_area` resend now ships its own
//     `q_area_footer` `CardFooter` sibling of `q_area_content`, holding that round's answer-choice Row —
//     `q_area` itself is ALREADY resent whole every round (the #307 resume discipline this seed exists to
//     teach), so the new footer id is trivially resendable alongside it, no root-immutability concern.
//     The final (round-3) resend keeps `q_area_footer` in `q_area`'s children with EMPTY children of its
//     own, rather than dropping the reference outright: `validate.ts`'s containment check (SPEC-R6) reads
//     the whole MERGED id graph, and the wire has no per-id delete primitive — an id introduced once and
//     later left unreferenced by anything (the "just stop mentioning it" instinct) becomes an ORPHANED
//     CardFooter with no Card parent in the final graph, which the check correctly rejects. Keeping the
//     footer referenced-but-empty is the honest way to retire a region's content: the node stays validly
//     parented, and an empty CardFooter paints no buttons — the SAME zero-content result the "just drop
//     it" instinct wanted, without leaving the id-graph in cursor as an orphan.
//     Two further repairs land on `trivia-round-resume` in the SAME pass: (a) the answer-key TELL — both
//     rounds styled the correct choice `solid` and the wrong one `soft`, a dead giveaway independent of
//     the semantically-named `answer_*_correct`/`_wrong` actions (which stay, being semantic not visual)
//     — restyled as PEERS, both choices `soft`, so no variant leaks the answer; (b) the consumer-less
//     `/round` path (written twice via `updateDataModel`, read/bound nowhere) is DROPPED rather than
//     wired to a binding — dead data with no reader is a defect class of its own (BOARD ZERO 2026-08-13),
//     and no existing display slot needs it (the round number is already prose in each `q*_text` heading).
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
          { id: 'root', component: 'FormProvider', children: ['card'] },
          { id: 'card', component: 'Card', elevation: '1', children: ['root_content', 'root_footer'] },
          { id: 'root_content', component: 'CardContent', children: ['col'] },
          { id: 'col', component: 'Column', gap: 'md', children: ['title', 'f_email', 'f_comments'] },
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
          { id: 'root_footer', component: 'CardFooter', children: ['actions'] },
          { id: 'actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_send'] },
          { id: 'btn_send', component: 'Button', variant: 'solid', label: 'Send feedback', action: { action: 'send_feedback', submit: true } },
        ],
      },
    },
  ],
}

// ── (2) Elevation scale — four correctly-quoted, non-"1" Card.elevation members ─────────────────────

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

// ── (3) Trivia round resume — the GH #307 multi-round resume discipline ─────────────────────────────
//
// NOT YET ADMITTED (holds for re-judging after the fixes below — module-header note).

const TRIVIA_ID = 'trivia-round-resume'
export const triviaRoundResumeSeed: ExampleSeed = {
  name: 'trivia-round-resume',
  description:
    'A two-question trivia round then a final score summary — the mutable question-area container ("q_area") is resent WHOLE three times (two questions, one summary) with a completely different child set each time (never an append), the root wrapper is delivered exactly once and never resent, each round\'s answer Buttons ride their own CardFooter (never loose in CardContent), the two choices are styled as visual peers so no variant leaks which one is correct, and the score updates via data-only reacts between rounds (the GH #307 same-surface RESUME discipline the shelf’s only other lifecycle exemplar, kpi-panel-lifecycle, never exercises — that one only ever appends).',
  promptText: 'Run a 2-question trivia round: show one question with answer buttons, update the score after each pick, load the next question, then show a final score summary — without breaking anything as it moves through each step.',
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
    // `/round` (written per-round below in the pre-repair draft) had no reader anywhere on the surface —
    // the round number is already prose in each q*_text heading — so it is dropped here rather than
    // seeded, never wired to a phantom binding (dead-data defect class, BOARD ZERO 2026-08-13).
    { version: 'v1.0', updateDataModel: { surfaceId: TRIVIA_ID, value: { score: 0 } } },

    // Round 1 — q_area's FIRST delivery. CardContent carries the question substance; the answer choices
    // ride their OWN CardFooter (P9 card-anatomy law) — both choices `soft` (peer styling): the
    // `answer_*_correct`/`_wrong` action names stay semantic, but the identical variant means neither
    // Button's LOOK gives away which one is correct.
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: TRIVIA_ID,
        components: [
          { id: 'q_area', component: 'Card', elevation: '1', children: ['q_area_content', 'q_area_footer'] },
          { id: 'q_area_content', component: 'CardContent', children: ['q_area_col'] },
          { id: 'q_area_col', component: 'Column', gap: 'sm', children: ['q1_text'] },
          { id: 'q1_text', component: 'Text', variant: 'h5', text: 'Round 1 — What is the capital of Finland?' },
          { id: 'q_area_footer', component: 'CardFooter', children: ['q1_choices'] },
          { id: 'q1_choices', component: 'Row', gap: 'sm', wrap: true, children: ['q1_helsinki', 'q1_stockholm'] },
          { id: 'q1_helsinki', component: 'Button', variant: 'soft', label: 'Helsinki', action: { action: 'answer_capital_correct', wantResponse: true } },
          { id: 'q1_stockholm', component: 'Button', variant: 'soft', label: 'Stockholm', action: { action: 'answer_capital_wrong', wantResponse: true } },
        ],
      },
    },
    // React only — no updateComponents in this step (the correct answer landed).
    { version: 'v1.0', updateDataModel: { surfaceId: TRIVIA_ID, path: '/score', value: 1 } },

    // Round 2 — q_area resent WHOLE with a completely DIFFERENT child set (q2_* ids, not appended q1_*
    // survivors) — the resume shape #307's live failures are missing, not an append like the KPI seed.
    // The new round ships its OWN q_area_footer alongside the resent q_area_content — q_area is already
    // resent whole every round, so the footer's own id is trivially resendable with it.
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: TRIVIA_ID,
        components: [
          { id: 'q_area', component: 'Card', elevation: '1', children: ['q_area_content', 'q_area_footer'] },
          { id: 'q_area_content', component: 'CardContent', children: ['q_area_col'] },
          { id: 'q_area_col', component: 'Column', gap: 'sm', children: ['q2_text'] },
          { id: 'q2_text', component: 'Text', variant: 'h5', text: 'Round 2 — Which planet is known as the Red Planet?' },
          { id: 'q_area_footer', component: 'CardFooter', children: ['q2_choices'] },
          { id: 'q2_choices', component: 'Row', gap: 'sm', wrap: true, children: ['q2_mars', 'q2_venus'] },
          { id: 'q2_mars', component: 'Button', variant: 'soft', label: 'Mars', action: { action: 'answer_planet_correct', wantResponse: true } },
          { id: 'q2_venus', component: 'Button', variant: 'soft', label: 'Venus', action: { action: 'answer_planet_wrong', wantResponse: true } },
        ],
      },
    },
    { version: 'v1.0', updateDataModel: { surfaceId: TRIVIA_ID, path: '/score', value: 2 } },

    // Final summary — q_area resent WHOLE a third time, this time with a summary instead of choices,
    // proving the discipline holds for an arbitrary number of resends, not just a second one. `${/score}`
    // (an absolute path, per protocol.ts's `${…}` grammar) — NOT the bare `${score}` a first draft used:
    // this Text sits outside any list-item scope (no ancestor children-template), so a relative name has
    // no scope to resolve against and `resolvePointer` (binding.ts) coerces it to the empty-string
    // sentinel, silently dropping the score. Every OTHER `${…}` template on this shelf sits INSIDE a
    // list-item scope, where a bare relative name is the correct, idiomatic form — this is the shelf's
    // first top-level (non-list) `${…}` use, so it is exactly the case with no prior example to imitate.
    // No answer Buttons this round — `q_area_footer` stays referenced (EMPTY children) rather than
    // dropped: the wire has no per-id delete primitive, so unreferencing it outright would leave an
    // ORPHANED CardFooter with no Card parent in the merged id graph (`validate.ts`'s SPEC-R6 containment
    // check reads the whole stream, not just this message) — module-header note.
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: TRIVIA_ID,
        components: [
          { id: 'q_area', component: 'Card', elevation: '1', children: ['q_area_content', 'q_area_footer'] },
          { id: 'q_area_content', component: 'CardContent', children: ['q_area_col'] },
          { id: 'q_area_col', component: 'Column', gap: 'sm', children: ['game_over_text', 'final_score_text'] },
          { id: 'game_over_text', component: 'Text', variant: 'h5', text: 'Round complete!' },
          { id: 'final_score_text', component: 'Text', variant: 'body', text: '${/score}/2 correct' },
          { id: 'q_area_footer', component: 'CardFooter', children: [] },
        ],
      },
    },
  ],
}

/** Every seed this module defines — the barrel's family-array precedent (index.ts derives `allSeeds`
 *  length from these, never a hand-counted literal). `retreat-reschedule` was authored and REJECTED by
 *  the judge (module-header note) and dropped entirely — never re-added here. */
export const corpusGrowthSeeds: readonly ExampleSeed[] = [feedbackFormSeed, elevationScaleSeed, triviaRoundResumeSeed]
