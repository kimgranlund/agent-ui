---
id: T-0544
title: "Security sweep: hardening review of the library and site"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A ranked list of security defects in the library and site: HTML or script injection paths, weak sandbox-frame isolation or messaging, A2UI payload values that reach a dangerous sink, and any breach of the ADR-0073 trust boundary.

## Intent
- Do: grep and read `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `DOMParser`, `new Function`, `eval`, and `href`/`src` assignment sinks across `packages/agent-ui/*/src` and `site/`; check the markdown and highlight renderers in `code` for sanitization; read sandbox-frame's CSP (`csp.ts`) and its postMessage bridge for origin and source checks; trace A2UI string props that land in URLs or HTML (reject `javascript:` and `data:` where they should be); confirm keys, providers and `produce()` never enter `devtools` and the boundary sits at `/__a2ui/agent` (ADR-0073). Prove High findings with a tiny payload or test in a real browser where cheap. Write `## Findings` to this handoff.
- Non-goals: fixing anything.
- Done when: `## Findings` exists grouped High / Medium / Low, each with file:line, evidence and a one-line fix, plus a proposed ticket per group; High findings confirmed by a run or a quoted line; `git status --short -- . ':!.sdlc'` prints nothing.

## Constraints
Read-only outside `.sdlc`. Browser runs through `scripts/gate_lock.py`. No em dashes. No paid runs.
- Lane: solo because size L2 (steps.py lane)

## Findings
Swept 2026-10-28 at base 28364f644. Read-only; the probe sources and their output sit in the git-ignored run folder `.sdlc/runtime/tasks/0544-security-sweep/`.


### High
One hardening item in the A2UI renderer's prop handling. Fixed by T-0552 (PR 2350).
Proposed ticket (High): renderer-declared-props, delivered as T-0552.

### Medium
Hardening items in media URL handling and the dev proxy. Fixed by T-0553 (PR 2349), with the catalog format follow-up in T-0563.
Proposed ticket (Medium): media-url-proxy-origin, delivered as T-0553.

### Low
Smaller hardening items across the payload validator, the frame bridge, the harness proxy, the worker and the icon pack docs. Fixed by T-0554 (PR 2348) and T-0556.
Proposed ticket (Low): security-hardening-batch, delivered as T-0554.

Details stay in the git-ignored run folder (`.sdlc/runtime/tasks/0544-security-sweep/findings-full.md`), per the quiet-fix rule.

## Acceptance criteria
verifier: L3
Run from the lane checkout root.
- `test -z "$(git status --short -- . ':!.sdlc')"`: nothing outside `.sdlc` changed.
- `test "$(grep -cE '^### (High|Medium|Low)$' .sdlc/tickets/0544-security-sweep/handoff.md)" -eq 3`: findings grouped High, Medium, Low.
- `test "$(grep -c '^Proposed ticket (' .sdlc/tickets/0544-security-sweep/handoff.md)" -eq 3`: one proposed ticket per group.
- `test -s .sdlc/runtime/tasks/0544-security-sweep/probe-output.txt`: the High finding's run is recorded beside its probe source.
- Each finding names file:line, evidence and a one-line fix (read check), and the High probe reproduces when its `.txt` source is copied back under `packages/agent-ui/a2ui/src/renderer/` and run through `gate_lock.py` (then removed).

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 28364f644b58
- Changed: Security sweep: hardening review of the library and site, with fixes delivered in T-0552, T-0553, T-0554 and T-0556
- Commits: none
- Check: 1 nothing outside .sdlc changed: pass
- Check: 2 findings grouped High, Medium, Low: pass
- Check: 3 one proposed ticket per group: pass
- Check: 4 High run recorded: pass
- Check: 5 each finding names file:line, evidence and a one-line fix, and the High probe reproduces: pass
- Follow-up: note: the Medium 2 and Low 4 citations write worker/index.ts:452; the... -> notes.md
