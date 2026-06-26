# Rubric — Agent (Subagent)

Scores a `.claude/agents/*.md` definition. Scoring method and severities: see `README.md`. `[gate]` = mechanically checkable; `[review]` = judgment with cited evidence.

| # | Dimension | Type | What it checks | 1 (fail) → 3 (adequate) → 5 (excellent) |
|---|---|---|---|---|
| D1 | Description as trigger | [gate] | Capability + a model-evaluable use condition (proactive nudge where apt) | 1: blurb ("a helpful agent") · 3: condition present · 5: clear capability + evaluable trigger + nudge |
| D2 | Tools scoping | [gate] | `tools` whitelisted to the role's actual verbs | 1: omitted (inherits all incl. MCP) on a constrained role · 3: scoped but loose · 5: exactly the verbs needed, no write/exec for read-only |
| D3 | Single responsibility | [review] | One clear job with defined input/output | 1: vague catch-all · 3: mostly focused · 5: one job, crisp contract |
| D4 | Body as judgment frame | [review] | Priorities and focus, not a rigid template or linter-work-in-prose | 1: 80-item checklist or forced template · 3: some structure · 5: priority framework, defers determinism to tooling |
| D5 | Model selection | [gate] | `model` set deliberately to the task class | 1: unset/mismatched · 3: set · 5: matched (fast for search, stronger for build) |
| D6 | Context scoping | [review] | Instructs the agent to scope reads and return a summary | 1: "read the whole repo" · 3: some scoping · 5: explicit scope (e.g., diff only) + summary contract |
| D7 | Enforcement placement | [gate] | Invariants delegated to hooks, not "never do X" in the body | 1: relies on prose for hard rules · 3: mixed · 5: invariants in hooks; body is guidance only |
| D8 | Skills wiring | [review] | `skills:` preload used when a specialist needs standing expertise (else dynamic) | 1: re-explains expertise inline every time · 3: n/a or partial · 5: standing expertise preloaded, discovery left dynamic |

**Gate to promote:** D1, D2, D5, D7 must each score ≥ 3. An agent that won't auto-delegate (D1), inherits unsafe tools (D2), or leans on prose for invariants (D7) is not production-ready.

**Top failure to look for first:** omitted `tools` on a read-only role (D2) — silent blast-radius expansion to the full toolset including MCP.
