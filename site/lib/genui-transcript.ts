// genui-transcript.ts — the deterministic RECORDED BACKBONE for gen-ui-live.ts (Kim's 2026-07-24 ruling:
// "a chat + recorded/stub GenUI turns demo"). Mirrors `packages/agent-ui/a2ui/tools/agent/transcript.ts`'s
// OWN shape and role for the A2UI live-agent demo — a small, committed, hand-authored `RecordedTranscript`
// replayed by the SAME `createRecordedTransport` factory (`agent-runtime.ts` re-exports both) — but this
// one is GenUI-flavored: each turn's `lines` carries exactly ONE genui envelope line (`formatGenuiLine`,
// `genui-line.ts`) instead of A2UI JSONL, so the wire SHAPE this page consumes is already the real SPEC-R1
// contract (`{"genui":{surfaceId, html}}`), not an ad hoc demo format.
//
// PLACEMENT (deliberate, not an oversight): the A2UI demo transcript lives inside the `@agent-ui/a2ui`
// PACKAGE (`tools/agent/transcript.ts`) because its payloads are real, catalog-validated A2UI surfaces —
// admissible corpus-adjacent content with a real validator behind it (ADR-0137 clause 3). A GenUI turn's
// `html` is arbitrary, agent-authored markup with NO catalog/validator precedent to honor — there is no
// "admit this into the corpus" question for a hand-rolled demo document, so this transcript stays a
// SITE-LOCAL fixture (`site/lib/`), the same tier `agent-admin`'s own demo content lives at. Nothing here
// claims to be a judged or catalog-admitted exemplar.
//
// SELECTION LOGIC (mirrors a2ui-live's own): `createRecordedTransport` ignores `TurnInput` entirely and
// advances through `turns` by a plain incrementing index — a FIXED ROTATION, not a keyword match. Every
// call to `transport.turn()` — whether triggered by a typed chat message or by a received `action` event
// (the "agent continues" round-trip, SPEC-R8) — advances to the next turn regardless of its content. This
// page mirrors that identical selection mechanism rather than inventing a second one.
//
// The four turns are a genuinely different GenUI use case each — the kind a fixed A2UI catalog cannot
// enumerate (SPEC §1's own framing): (1) a bespoke animated data-viz layout, (2) a mini interactive widget
// exercising the ONE outward bridge channel (`genui.action`), (3) an animated explainer acknowledging that
// action (the "agent continues" turn), (4) a second bespoke layout. Every document reads the app's real
// `--md-sys-*` tokens (SPEC-R6's token bridge) with a plain literal fallback, so the rendered content
// visibly follows the docs site's own light/dark scheme toggle — no page-local theme UI needed.
import type { RecordedTranscript } from './agent-runtime.ts'
import { formatGenuiLine } from './genui-line.ts'

const REVENUE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; padding: 1.1rem 1rem; font-family: system-ui, sans-serif;
    background: var(--md-sys-color-neutral-surface, #fff); color: var(--md-sys-color-neutral-on-surface, #111); }
  h1 { font-size: 0.92rem; margin: 0 0 0.9rem; font-weight: 650; }
  .chart { display: flex; align-items: flex-end; gap: 0.85rem; height: 7.5rem; }
  .bar { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.35rem; height: 100%; justify-content: flex-end; }
  .bar-fill { width: 100%; border-radius: 6px 6px 0 0; background: var(--md-sys-color-primary, #4a67ff);
    animation: grow 0.7s ease-out; transform-origin: bottom; }
  @keyframes grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
  .bar-label { font-size: 0.68rem; color: var(--md-sys-color-neutral-on-surface-variant, #666); }
  .bar-value { font-size: 0.7rem; font-weight: 650; }
</style>
</head>
<body>
  <h1>Q3 revenue by region (thousands USD)</h1>
  <div class="chart">
    <div class="bar"><div class="bar-value">$182k</div><div class="bar-fill" style="height:78%"></div><div class="bar-label">NA</div></div>
    <div class="bar"><div class="bar-value">$94k</div><div class="bar-fill" style="height:40%"></div><div class="bar-label">EU</div></div>
    <div class="bar"><div class="bar-value">$146k</div><div class="bar-fill" style="height:62%"></div><div class="bar-label">APAC</div></div>
    <div class="bar"><div class="bar-value">$38k</div><div class="bar-fill" style="height:16%"></div><div class="bar-label">LATAM</div></div>
  </div>
</body>
</html>`

// The ONE turn that exercises the bridge's action channel end to end (SPEC-R8): a 5-star picker built
// entirely from plain buttons; clicking one calls `window.genui.action('rate', { stars })` — the SAME
// bootstrap-exposed API every real producer's authored HTML would call, no different for a recorded demo.
const FEEDBACK_WIDGET_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; padding: 1.1rem 1rem; font-family: system-ui, sans-serif;
    background: var(--md-sys-color-neutral-surface, #fff); color: var(--md-sys-color-neutral-on-surface, #111); }
  p { margin: 0 0 0.6rem; font-size: 0.85rem; }
  .stars { display: flex; gap: 0.2rem; }
  button.star { font-size: 1.5rem; line-height: 1; background: none; border: 0; cursor: pointer; padding: 0.15rem;
    color: var(--md-sys-color-neutral-outline, #999); }
  button.star[data-lit='true'] { color: var(--md-sys-color-primary, #4a67ff); }
  #thanks { margin-top: 0.7rem; font-size: 0.78rem; color: var(--md-sys-color-neutral-on-surface-variant, #666); display: none; }
</style>
</head>
<body>
  <p>How would you rate this mockup?</p>
  <div class="stars" id="stars"></div>
  <div id="thanks">Thanks — sending your rating back to the agent…</div>
  <script>
    var root = document.getElementById('stars');
    for (var i = 1; i <= 5; i++) {
      (function (n) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'star';
        b.textContent = '\\u2605';
        b.setAttribute('aria-label', n + ' star' + (n > 1 ? 's' : ''));
        b.addEventListener('click', function () {
          for (var j = 0; j < root.children.length; j++) root.children[j].setAttribute('data-lit', j < n ? 'true' : 'false');
          document.getElementById('thanks').style.display = 'block';
          window.genui.action('rate', { stars: n });
        });
        root.appendChild(b);
      })(i);
    }
  </script>
</body>
</html>`

// Turn 3 — the "agent continues" turn (SPEC-R8's routing law, demo-scale): rendered only after the
// feedback widget's `action` event round-trips back as the next turn. A bespoke, CSS-only animated
// explainer of the exact round trip that just happened — the kind of small, purpose-built diagram a
// catalog control has no row for.
const ACTION_EXPLAINER_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; padding: 1.15rem 1rem; font-family: system-ui, sans-serif;
    background: var(--md-sys-color-neutral-surface, #fff); color: var(--md-sys-color-neutral-on-surface, #111); }
  h1 { font-size: 0.9rem; margin: 0 0 1rem; font-weight: 650; }
  .pipeline { position: relative; display: flex; justify-content: space-between; align-items: center; height: 2.6rem; }
  .node { min-width: 5.2rem; padding: 0.4rem 0.5rem; border-radius: 8px; background: var(--md-sys-color-neutral-surface-high, #eee);
    border: 1px solid var(--md-sys-color-neutral-outline-variant, #ccc); font-size: 0.66rem; text-align: center; z-index: 1; }
  .track { position: absolute; left: 2.75rem; right: 2.75rem; top: 50%; height: 2px; background: var(--md-sys-color-neutral-outline-variant, #ccc); }
  .dot { position: absolute; top: 50%; width: 0.55rem; height: 0.55rem; margin-top: -0.275rem; margin-left: -0.275rem;
    border-radius: 50%; background: var(--md-sys-color-primary, #4a67ff); animation: travel 2.2s linear infinite; }
  @keyframes travel { 0% { left: 2.75rem; } 100% { left: calc(100% - 2.75rem); } }
  p { font-size: 0.72rem; color: var(--md-sys-color-neutral-on-surface-variant, #666); margin: 0.9rem 0 0; }
</style>
</head>
<body>
  <h1>How your rating just reached the agent</h1>
  <div class="pipeline">
    <div class="node">Sandbox frame</div>
    <div class="track"></div>
    <div class="dot"></div>
    <div class="node">Host bridge</div>
    <div class="node">Next turn</div>
  </div>
  <p><code>genui.action(name, payload)</code> posts one message out of the sandbox; the host frames it as the next turn — no other channel exists out.</p>
</body>
</html>`

const ROADMAP_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; padding: 1.1rem 1rem; font-family: system-ui, sans-serif;
    background: var(--md-sys-color-neutral-surface, #fff); color: var(--md-sys-color-neutral-on-surface, #111); }
  h1 { font-size: 0.9rem; margin: 0 0 1rem; font-weight: 650; }
  .timeline { display: flex; }
  .stop { flex: 1; position: relative; display: flex; flex-direction: column; align-items: center; }
  .stop:not(:last-child)::after { content: ''; position: absolute; top: 0.5rem; left: 50%; width: 100%; height: 2px;
    background: var(--md-sys-color-neutral-outline-variant, #ccc); }
  .dot { width: 1rem; height: 1rem; border-radius: 50%; z-index: 1; border: 2px solid var(--md-sys-color-neutral-surface, #fff); box-sizing: border-box; }
  .dot.done { background: var(--md-sys-color-primary, #4a67ff); }
  .dot.next { background: var(--md-sys-color-neutral-surface, #fff); border-color: var(--md-sys-color-primary, #4a67ff); }
  .dot.later { background: var(--md-sys-color-neutral-outline-variant, #ccc); }
  .stop-label { font-size: 0.66rem; margin-top: 0.4rem; text-align: center; color: var(--md-sys-color-neutral-on-surface-variant, #666); }
</style>
</head>
<body>
  <h1>GenUI feature roadmap</h1>
  <div class="timeline">
    <div class="stop"><div class="dot done"></div><div class="stop-label">Wire spec</div></div>
    <div class="stop"><div class="dot done"></div><div class="stop-label">Sandbox frame</div></div>
    <div class="stop"><div class="dot next"></div><div class="stop-label">Wire + producer</div></div>
    <div class="stop"><div class="dot later"></div><div class="stop-label">Judged corpus</div></div>
  </div>
</body>
</html>`

/** Every authored turn's own progress stages (ADR-0146 F1) — the SAME closed vocabulary a2ui-live's
 *  transcript authors, replayed as `{"a2uiMeta":{"progress":…}}` meta-lines ahead of this turn's genui
 *  line, so a visitor with no live producer still sees staged turn feedback. */
const STAGES = [{ stage: 'sent' as const }, { stage: 'started' as const }, { stage: 'content' as const }, { stage: 'done' as const }]

export const genuiTranscript: RecordedTranscript = {
  intent: 'A chat prompting a recorded GenUI demo backbone (no live producer — B2 has not shipped).',
  turns: [
    {
      lines: [formatGenuiLine('q3-revenue', REVENUE_HTML)],
      note: 'Here’s a quick data-viz mockup of Q3 revenue by region — a bespoke layout no fixed catalog enumerates.',
      progress: STAGES,
    },
    {
      lines: [formatGenuiLine('feedback-widget', FEEDBACK_WIDGET_HTML)],
      note: 'Here’s a tiny interactive widget — rate it and your click comes back to me as the next turn.',
      progress: STAGES,
    },
    {
      lines: [formatGenuiLine('flow-explainer', ACTION_EXPLAINER_HTML)],
      note: 'Got your rating — thanks! Here’s a quick animated explainer of how that click just round-tripped back to me.',
      progress: STAGES,
    },
    {
      lines: [formatGenuiLine('roadmap-preview', ROADMAP_HTML)],
      note: 'One more bespoke layout — a roadmap timeline showing where the real wire lands next.',
      progress: STAGES,
    },
  ],
}
