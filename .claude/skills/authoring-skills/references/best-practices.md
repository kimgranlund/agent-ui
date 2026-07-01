# Best Practices — Authoring Skills & Agents

How to articulate skills and subagents so they trigger reliably and behave consistently. Assumes `00-foundations.md`. Scored by `rubric-skill.md` and `rubric-agent.md`.

## Skills

A skill is a *procedure* artifact. Calibrate its description and body separately — they fail differently.

**Description (always-loaded trigger).** State what it does and the conditions that summon it, in third-person language carrying the words a user would actually use. A precise body behind a vague description is a dead capability.

**Body (loaded on demand).** Apply the calibration test to every line. Trust the model's general competence — do not lecture it on its own domain. Add only the non-obvious and project-specific. Route the deterministic to a script, not prose. Build in a validation loop: draft → check against a reference or script → fix → re-check → finalize only when clean.

**Structure for progressive disclosure.** Keep SKILL.md lean (target ~1,500–2,000 words, hard ceiling ~500 lines). Push detail into `references/` (read on demand) and determinism into `scripts/` (executed, never loaded). Use fully-qualified MCP tool names (`Server:tool`).

The articulation question is not "conversational vs. prescriptive." It is "what does the model not already know, and what must be exact." Be prescriptive precisely where reliability matters; trust the model everywhere else.

### Lead with the frame

**Prefer** words that front-load the reasoning mode before the detail — a leading word tells the model *how to read what follows*, so the instruction lands in one pass instead of being re-derived. These are the densest tokens you can spend: each compresses a paragraph of "here's how to think about this" into a word the model already holds. This is the sharp edge of the calibration test — not *fewer* words, but words that **imply the reasoning**.

**Open** each instruction with the word that names what it wants:
- **Priority / strength** — `Prefer`, `Default to`, `Favor`, `Avoid`, `Never`, `Always`, `Only`, `At minimum`.
- **Sequence / dependency** — `First… then`, `Before X`, `Once X`, `Until`.
- **Conditional routing** — `When X`, `If X`, `Unless`, `Otherwise`.
- **Reasoning mode** — `Verify`, `Decompose`, `Reconcile`, `Root-cause`, `Derive from`, `Treat X as Y`.
- **Rationale-implying** — `X because Y`, `X so that Y`, `X — otherwise Z`; the consequence clause carries the *why*, which generalizes the rule to cases you never enumerated.

- ❌ `The description should be written carefully and include information about when the skill is used.`
- ✅ `Write the description first: capability + trigger, in the user's words — vagueness here silently kills the skill.`

Same length; the ✅ leads with the imperative, front-loads the two required parts, and appends a consequence clause carrying the *why*.

**Two guardrails**, or it backfires:
- **Precision over punch.** A leading word is dense only when *accurate* — `Never` on a soft preference, or `Verify` where nothing is checkable, mislead more than filler would. Match the word's strength to the rule's.
- **One frame per line.** Density fails when leading words stack into telegraphic mush the model must decompress (`Prefer-first reconcile-derive verify-always…`). One clear frame per instruction; the rest of the line stays plain.

### Skill do / don't

Do: make the description carry discovery weight; keep the body lean; route exact work to scripts; bake in a check; build incrementally against real prompts.

Don't: restate general knowledge; front-load every file into SKILL.md; encode a decision tree in prose that the model executes worse than its own reasoning; impose rigid output phrasing that fights context.

### Skill best-in-class

```markdown
---
name: clinical-coding
description: Surfaces coding opportunities and validates ICD-10/CPT codes from
  clinical encounter notes. Use when the user mentions medical coding, billing,
  RCM, or wants to map diagnoses to codes.
---
# Clinical Coding
## When to use
The user has an encounter note and needs candidate codes, or wants codes validated.
## Process
1. Map candidates to ICD-10 using `references/coding-rules.md`.
2. Run `scripts/validate_codes.py <codes>` — checks existence, billability, bundling.
3. Fix flagged codes, re-run, finalize only when the validator exits clean.
Output each code with a one-line rationale. Match the user's working format.
```

## Agents

A subagent is *delegation with isolation*. Calibrate description, body, and tools.

**Description (the trigger).** Capability plus a model-evaluable condition plus a proactive nudge where appropriate. Do not encode preconditions the router cannot evaluate (it has no "in the last 5 minutes").

**Body (its system prompt).** Give a judgment framework — priorities, what to focus on, what to skip — not a rigid template and not linter-work spelled out in prose. Scope its context (e.g., "focus on the diff," not "read the whole repo"). Defer determinism to tooling. Tell it to return a summary.

**Tools.** Whitelist exactly the verbs the role needs. A read-only reviewer gets `Read, Grep, Glob, Bash` — never write or production access. Omitting `tools` inherits everything, which is the common unsafe default.

### Agent do / don't

Do: write the description as a trigger; scope tools tightly; set `model` to the task class; give priorities and a focus, not a template; keep one clear responsibility.

Don't: document agents inside CLAUDE.md (the router uses the agent's own description); write prose blurbs ("a helpful review agent"); enumerate eighty checks that belong in a linter; put invariants in the body that belong in a hook.

### Agent best-in-class

```markdown
---
name: code-reviewer
description: Reviews code for quality, security, and maintainability. Use
  PROACTIVELY immediately after writing or modifying code.
tools: Read, Grep, Glob, Bash
model: sonnet
---
You are a senior code reviewer. When invoked:
- Run `git diff`; focus only on changed files.
- Skip anything the linter/formatter already enforces.
- Report by priority: Critical (security, data loss, correctness) → Warnings
  (maintainability, edge cases) → Suggestions. Each with a concrete fix.
If nothing is Critical or Warning, say so in one line and stop.
```

## The shared principle

For both: the description is the interface, the body is judgment, and anything deterministic or invariant lives outside the prose (script, hook, linter). Over-prescription and vagueness are not opposite ends of one dial — they are two distinct failures of two distinct questions. Optimal passes both.
