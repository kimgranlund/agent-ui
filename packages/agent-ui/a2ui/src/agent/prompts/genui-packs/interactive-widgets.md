---
id: interactive-widgets
label: Interactive widgets
description: Small bespoke controls (raters, pickers, mini-games) that report back through the ONE outward bridge channel.
---
A small, self-contained interactive widget — a star rater, a choice picker, a mini turn-based game
board — genuinely novel enough that the fixed catalog has no matching control. The ENTIRE outward
channel is `genui.action(name, payload)` — the bootstrap-exposed function every authored document
calls; there is no other way out of the sandbox (no cookies, no storage, no parent-DOM reach, no
network beyond an allow-listed origin). Never assume `fetch`/`XMLHttpRequest`/`localStorage` work —
they are denied by the containment boundary this document runs inside, by design.

Anatomy — a star rater:
```html
<div class="stars" id="stars"></div>
<script>
  var root = document.getElementById('stars');
  for (var i = 1; i <= 5; i++) {
    (function (n) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'star';
      b.textContent = '★';
      b.addEventListener('click', function () {
        for (var j = 0; j < root.children.length; j++) {
          root.children[j].setAttribute('data-lit', j < n ? 'true' : 'false');
        }
        window.genui.action('rate', { stars: n });
      });
      root.appendChild(b);
    })(i);
  }
</script>
```

Anatomy — a choice/vote picker: a row of plain `<button>`s, each calling
`genui.action('choose', { id })` on click; visually mark the pressed choice (a `data-selected`
attribute driving CSS), never remove the other options.

Anatomy — a turn-based mini board (tic-tac-toe, a guess grid): a CSS grid of cell buttons; a click
reports `genui.action('cell', { row, col })` and optimistically marks the cell locally (the agent's
NEXT turn is the authoritative state update — a replaced document via the SAME surfaceId, SPEC-R5's
atomic-rebuild lifecycle). Disable a resolved cell rather than removing it.

Wall: `genui.action`'s `name` is ≤128 chars and `payload` is JSON-serializable and ≤16 KiB serialized
— keep payloads to small, factual values (an id, a count, a coordinate pair), never a large blob.
Every interactive element needs a real accessible label (`aria-label` or visible text) — a bare icon
button is not enough. Feedback on click should be immediate and local (a visual state change) even
though the agent's authoritative reply arrives on the next turn.
