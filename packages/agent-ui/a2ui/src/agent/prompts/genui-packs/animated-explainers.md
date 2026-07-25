---
id: animated-explainers
label: Animated explainers
description: Small CSS-only diagrams that narrate a process, flow, or timeline.
---
A small, purpose-built diagram explaining a process, a pipeline, or a sequence of steps — the kind of
bespoke illustration a fixed catalog control has no row for. CSS-only animation (`@keyframes`,
`transform`, `transition`) — never a video/canvas/WebGL dependency, and never JavaScript animation
loops where a CSS transition/animation does the job.

Anatomy — a pipeline/flow diagram: a row of labeled nodes connected by a track, with a moving dot
animating along the track to show direction of flow:
```html
<div class="pipeline">
  <div class="node">Step one</div>
  <div class="track"></div>
  <div class="dot"></div>
  <div class="node">Step two</div>
</div>
<style>
  .pipeline { position: relative; display: flex; justify-content: space-between; align-items: center; height: 2.6rem; }
  .node { padding: 0.4rem 0.5rem; border-radius: 8px; background: var(--md-sys-color-neutral-surface-high);
    border: 1px solid var(--md-sys-color-neutral-outline-variant); font-size: 0.7rem; z-index: 1; }
  .track { position: absolute; left: 2.75rem; right: 2.75rem; top: 50%; height: 2px;
    background: var(--md-sys-color-neutral-outline-variant); }
  .dot { position: absolute; top: 50%; width: 0.55rem; height: 0.55rem; border-radius: 50%;
    background: var(--md-sys-color-primary); animation: travel 2.2s linear infinite; }
  @keyframes travel { 0% { left: 2.75rem; } 100% { left: calc(100% - 2.75rem); } }
</style>
```

Anatomy — a roadmap/timeline: a row of "stops", each a dot (done/next/later, distinguished by fill —
solid for done, outline for next, muted for later) with a connecting line and a label underneath.
Never rely on color alone to distinguish done/next/later — vary the dot's fill/outline treatment too.

Anatomy — a state-machine diagram: a small set of labeled boxes with arrows (CSS borders/pseudo-
elements, or a simple SVG `<path>` if precision matters) showing transitions; highlight the CURRENT
state with an accent border, never a separate redundant "you are here" callout.

Wall: an explainer illustrates a REAL process the turn is actually describing — never invent steps
that didn't happen, and never pad a 2-step process into an artificially longer diagram. Keep the
animation SUBTLE (a slow, continuous loop reads as "in progress"; a one-shot entrance animation reads
as "just happened") — never a distracting, fast, attention-grabbing motion.
