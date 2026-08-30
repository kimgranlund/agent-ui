| agent (agent-ui-marshal) | agent | manual | 2026-08-17 | fable+low (canonical agent tier) |
| reviewer (agent-ui-reviewer) | reviewer | background | 2026-08-17 | fable+xhigh (deny-edit-write) |
| planner (agent-ui-planner) | planner | background | 2026-08-17 | fable+medium (canonical planner tier) |
| product (agent-ui-product) | product | manual | 2026-08-17 | fable+high; row reconciled from fleet.json by the 2026-08-19 orchestration audit (A3-R2) |
| agent (agent-ui-marshal) (takeover) | agent | manual | 2026-08-22 | fable+low (canonical agent tier); /fleet-bootstrap takeover of the live agent seat |
| agent (agent-ui-marshal) (takeover) | agent | manual | 2026-08-23 | sonnet+high (canonical agent tier, reconciled 2026-08-23); /fleet-bootstrap takeover; address agent-ui-90 |
| agent (agent-ui-marshal) (takeover) | agent | manual | 2026-08-26 | sonnet+high (canonical agent tier, matches — reality check clean); /fleet-bootstrap takeover of same-conversation live row; address agent-ui-81 (corrected mid-run from agent-ui-90 — session-identity change observed, see fleet.json note); branch main (matches expected) |
| planner (agent-ui-planner) (fresh spawn) | planner | background | 2026-08-26 | fable+medium (canonical planner tier); replaces the 2026-08-17 planner row, released same day after /reload-plugins killed the prior process; holding for first charter |
| reviewer (agent-ui-reviewer) (fresh spawn) | reviewer | background-subprocess | 2026-08-26 | sonnet+high (deny-edit-write); replaces the 2026-08-17 reviewer row, released same day; genuinely walled claude -p subprocess in .claude/worktrees/agent-ui-reviewer, I2 probe confirmed structural enforcement (wall_applied: true) |
| reviewer (agent-ui-reviewer) (released) | reviewer | background-subprocess | 2026-08-28 | fleet stand-down, Kim's call after close-session; worktree kept for next bootstrap |
| planner (agent-ui-planner) (released) | planner | background | 2026-08-28 | fleet stand-down, Kim's call after close-session |
| agent (agent-ui-marshal) (released) | agent | manual | 2026-08-28 | fleet stand-down; bind-team charter ended explicitly; address agent-ui-81 |
| agent (agent-ui-marshal) | agent | manual | 2026-08-28 | sonnet+high (canonical agent tier, manifest matches); fresh join after the 2026-08-28 stand-down; address agent-ui-93; branch main (matches expected); reality check: terminal runs Fable 5, deviation-in-fact, unjustified |
| planner (agent-ui-planner) (fresh spawn) | planner | background | 2026-08-28 | fable+medium (canonical planner tier); fleet-bootstrap Phase 5 spawn after the 2026-08-28 stand-down; holding for first charter |
| reviewer (agent-ui-reviewer) (fresh spawn) | reviewer | background-subprocess | 2026-08-28 | sonnet+high (deny-edit-write); fleet-bootstrap Phase 5 spawn after the 2026-08-28 stand-down into the kept walled worktree .claude/worktrees/agent-ui-reviewer; I2 probe confirmed structural enforcement (wall_applied: true, subprocess-spawn) |
| agent (agent-ui-marshal) (retier) | agent | manual | 2026-08-29 | fable+medium (deviation, justified 2026-08-29, Kim: matches the launched terminal); address agent-ui-93 |
