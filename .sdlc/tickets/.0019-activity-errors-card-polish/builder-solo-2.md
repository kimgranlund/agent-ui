<!-- role=solo ticket=T-0019 attempt=2 -->
# T-0019 solo attempt 2: Do 2 (header overlap) and Do 3 (card padding)

## Result
Neither symptom reproduces in the real agent-admin Test Chat at base (`d7004800`) or at HEAD. No product
fix was made, because no product defect was found. The two non-biting standalone guards were replaced by
guards in the real host that go red when the stylesheet contract breaks (mutation evidence below). Defects 1,
4 and 5 untouched.

## Where I looked (all fresh page loads, keyless scripted turns)
Real page `site/pages/agent-admin-app.html` (and the docs `agent-admin.html`), the real `ui-agent-admin`
Test Chat, the Croupier persona, recorded Haiku and Sonnet Blackjack fixtures replayed through the e2e:admin
intercept, plus a hand-driven `beginAgentTurn()` handle on the real chat-pane `ui-conversation`.

| Axis | Values tried | Card regions (pad / margin / ink from card edge) | Strip header pinned and on top |
|---|---|---|---|
| Server | worktree dev (HEAD), main-checkout dev on :5173 (base `d7004800`), production `vite build` served statically | `6px 12px` / `6px` / 19px everywhere | HHH hit-test everywhere |
| Engine | Chromium, WebKit | same | same |
| Width | 1440, 1100, 800, 600, 430 | same | n/a |
| Setting | `bubbles` on and off, light, dark, forced-colors | same | same |
| Streaming | whole message, one component per line, 9 steps arriving per frame while expanded | inset 19px at every increment | header top equals strip top at every step |
| Page | `agent-admin-app.html`, `agent-admin.html` | same | same |

No stylesheet 404 or failed request (only the harness's `/__a2ui/agent/integrations`). Both servers load 18
sheets, 582 rules.

## Root cause
Not a code defect at base or HEAD. The one finding that fits all three reported symptoms at once is a
page that is missing the per-control sheets: with `all.css` removed from the real-host test, the Card
regions paint `padding 0px` (flush), every text part of the strip has inset 0 (flush), and the running
strip loses its height cap (rows overflow uncapped). That is the user's "card flush, activity text no inset,
list over the header" set. Environmental evidence for how that could happen: the main checkout's dev server
(pid 97066, `localhost:5173`) has been running since Oct 4 18:59, across 30 commits including the ADR-0233
barrel retirement (`4d90e826`, Oct 5 21:25, which moved `all.css` to a generated exports key) and the strip
rewrite (`5ec374d1`, Oct 6 08:43). A long-lived dev server or tab mixing the old and new module graph is the
likely carrier. A fresh load of that same server (5173) measures correctly. I did not kill or restart it.
This is a hypothesis from evidence, not a reproduction. Ask the user to restart `npm run dev`, hard-reload,
and if it persists send the browser, version and a screenshot.

Layout files between `5ec374d1` and `d7004800` for card, status-stream, conversation and the page CSS are
identical, so whatever the user saw on the intervening commits renders the same as these probes.

## Guards
New: `packages/agent-ui/app/src/controls/agent-admin/agent-admin-chat-surface.browser.test.ts` (app shard,
Chromium and WebKit, 6 tests). It mounts the real `ui-agent-admin` with the site page's sheet set and order,
drives a scripted `agentSurfaceTurn` runner through the real composer, and asserts:
1. an expanded, still-running strip that overflows its cap keeps its header pinned and topmost (hit-test at
   three points, three scroll positions) with an opaque background;
2. a streamed Card paints header, content and footer regions with 12px padding and 6px margin, ink at least
   18px from the card edge, and a trailing Badge on the title row;
3. every text part of the settled, expanded strip sits at least 12px inside the strip's left edge.
Removed from `conversation.browser.test.ts`: the standalone header-stacking and Card-padding tests (passed at
base, redundant with the above). Kept there: the retry-chip test, which bites at base.

## Red/green evidence
- HEAD: 6 passed (3 tests x 2 engines).
- Base `d7004800` (product tree checked out to base, new test file kept): 6 passed. Honest consequence: these
  guards cannot be red on base, because the defect is absent there. The brief's escape ("cannot be reproduced,
  replace the guard with one that can fail") applies; the proof they can fail is seeded mutations, each
  reverted afterwards:

| Seeded mutation | Result |
|---|---|
| Drop `import '@agent-ui/components/all.css'` from the test (sheet not delivered) | 6 failed: Card `paddingLeft` `'0px'` not `'12px'`; strip text inset `0` not `>= 12`; strip no longer overflows a capped height |
| `card.css`: `--ui-card-region-pad-inline: 0` | 2 failed (Card test, both engines): `'0px'` not `'12px'` |
| `status-stream.css`: header `position: sticky` to `static` | 2 failed (strip test, both engines): header moved 60px at `scrollTop 60` |
| `status-stream.css`: header `background` to `transparent` | 2 failed (strip test, both engines): not an opaque canvas |
| `status-stream.css`: header `z-index: 1` to `auto` | still green (rows are not positioned, so stacking never depended on it); not a guard target |

## Not done / open
- Do 2 and Do 3 have no product change; the user's own environment (stale dev server or tab) is the open
  item, listed above.
- Gates are recorded in the final report.
