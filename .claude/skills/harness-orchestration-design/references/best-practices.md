# Best Practices — Orchestration, Integration & YAML Frontmatter

Covers how subagents, skills, and teams discover and compose with each other, and the productive expressions of the frontmatter that wires them. Assumes the models in `00-foundations.md`. Scored by `rubric-usage-patterns.md` (§A).

## Choosing the unit of work

Three primitives, three different jobs. Pick by the shape of the task, not by habit.

A **skill** is a *procedure* — a repeatable workflow loaded on demand. Use it when the same multi-step method recurs.

A **subagent** is *delegation with isolation* — a focused worker in its own context window that returns a summary to the caller. Use it when a task is scoped, isolatable, and only the result matters ("research X and report back"). Cost is lower because only the summary returns.

An **agent team** is *collaboration* — multiple full Claude instances that message each other and self-coordinate through a shared task list. Use it only when workers need to share findings and challenge each other ("investigate this bug from three angles and debate"). Cost is higher (each teammate is a separate instance); justify the fan-out with genuine parallel value.

The decision rule: result-only → subagent; discussion required → team; recurring method → skill. Reaching for a team when a subagent would do is the most common over-spend.

## How they discover each other (the connective tissue)

Skills and subagents do not read each other's files. The connective tissue is that **every capability's description is concatenated into the system prompt at startup**, and the orchestrator — not the skills or agents — holds them all and routes by relevance. This is the dynamic, implicit layer.

There is also a static, explicit layer: a subagent can preload skills via a `skills:` frontmatter field, injecting that skill's content at the subagent's startup so it never has to discover its core expertise. (Verify the exact key against your installed build — subagent frontmatter drifts.)

Three tiers, used deliberately:
- **Descriptions** = dynamic connective tissue the orchestrator resolves per turn.
- **`skills:` preload** = static hard-wiring when a specialist must always have certain expertise.
- **CLAUDE.md** = the human-authored standing index of what exists.

## How teams are described vs. subagents

A subagent is *authored statically* as a reusable file (`.claude/agents/*.md`) discovered by its description. An agent-team teammate is *described in natural language at runtime* — you enable the feature with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and then describe the teammates you want in the prompt; Claude spawns them dynamically. There is no team file you author; the team config is machine-generated runtime state and pre-authoring it is unsupported. To define reusable team *roles*, you still write subagent definitions — teams compose them at runtime.

## Frontmatter: productive expressions

Frontmatter is the integration contract. Treat each field as load-bearing.

**Skill frontmatter** — `name` and `description`. The description is the whole trigger: state what it does *and* when to use it, in third-person natural language ("This skill should be used when…"), carrying the intent keywords a user would actually say. No keyword dumps; a few representative anchors generalize better than an exhaustive list.

**Subagent frontmatter** — `name`, `description` (the auto-delegation trigger; write it as a use condition, add a proactive nudge like "Use PROACTIVELY immediately after writing code" when warranted), `tools` (whitelist to the verbs the role needs — omitting it inherits the full toolset including MCP, which is unsafe for a read-only role), `model` (set deliberately: a fast model for search, a stronger one for implementation), and optionally `skills:` to preload standing expertise.

## Do

- Treat every description as a precise interface; review it whenever behavior changes.
- Scope `tools` to the role's actual needs.
- Use `skills:` preload for a specialist that should never have to "discover" its expertise.
- Keep discovery dynamic; only hard-wire what genuinely must always be present.
- Match the unit to the task: subagent for results, team for collaboration, skill for procedures.

## Don't

- Rely on files cross-referencing each other by name as the wiring — the orchestrator routes on descriptions, not file mentions.
- Write vague descriptions ("helps with documents") — that starves the router and silently disables the capability.
- Inherit the full toolset by omitting `tools` on a constrained role.
- Reach for a team when a subagent's summary would do.
- Conflate discovery with continuation (see foundations).

## Best-in-class example

A reviewer subagent with a precise trigger, scoped tools, deliberate model, and a preloaded standard:

```markdown
---
name: code-reviewer
description: Reviews code for quality, security, and maintainability. Use
  PROACTIVELY immediately after writing or modifying code.
tools: Read, Grep, Glob, Bash
model: sonnet
skills: [clinical-coding-standards]
---
You are a senior code reviewer. When invoked: run `git diff`, focus on changed
files, skip anything the linter already enforces. Report by priority —
Critical / Warnings / Suggestions — each with a concrete fix. If nothing is
Critical or Warning, say so in one line and stop.
```

The description routes it, the tools box its blast radius, the model fits the task, and `skills:` gives it standing expertise without discovery.
