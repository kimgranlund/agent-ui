# Foundations — Shared Mental Models

The load-bearing concepts every other document in this project depends on. Read this first. Every best-practices guide and rubric here assumes these models; they are not repeated elsewhere.

## The two document axes

Every artifact in an agent system sits on one of two axes.

**Behavioral** documents tell the agent what to do, who does it, or what is forbidden: entry files (CLAUDE.md), rules, skills, commands, subagents, team prompts, hooks, settings. They are obeyed (probabilistically) or executed.

**Referential** documents are read to ground or to check, never obeyed: knowledge (references/, `@`-imports, llms.txt, Project Knowledge) and verification artifacts (rubrics, eval corpora, validation checklists, `/goal` conditions). Most teams build the entire behavioral axis and neglect the referential one — especially rubrics. That gap is what makes regeneration impossible: a loop that has nothing to check against cannot repair anything.

## Discovery vs. continuation (two planes, never conflated)

**Discovery** decides *what* gets used on a turn. It runs off description-matching and progressive disclosure, every turn, always on. Selection is a property of descriptions.

**Continuation** decides *when* the next turn fires: `/goal` (until a verifiable condition), `/loop` (on a timer), auto mode, Stop hooks. Continuation is control flow.

Fusing these is the most common architecture error. `/goal` does not select skills or agents — discovery does that underneath it, every turn, goal or no goal. Keep the planes separate in design and in debugging: a failure is either wrong *selection* or wrong *continuation*, and conflating them makes it untraceable.

## The five control modes

Any behavioral artifact operates in one of five modes, ordered by how much you constrain the agent. Match the mode to the task's entropy.

| Mode | The artifact gives… | Use when | Native home |
|---|---|---|---|
| Instruction | A standing rule | Always-true facts/conventions | CLAUDE.md, rules |
| Procedure | An ordered method | A repeatable multi-step workflow | skills |
| Rubric | A standard to check against | Output quality needs verifying | rubrics, validation loops |
| Objective | A verifiable end-state | Autonomous work to a finish line | `/goal` |
| Mission | A goal + standing latitude | Long-running, self-coordinating | agent teams |

The failure is mismatch: a rigid procedure where the model should reason (over-prescription), or a bare objective where you needed a rubric to define "good" (under-specification).

## The two diseases

**Drift** is representation diverging from reality over time — a spec that no longer matches the code, a description that no longer matches what a skill does (so routing silently breaks). Silent, because nothing fails when it happens.

**Brittle-feature infection** is representation diverging via accretion — each special case, flag, or prompt-patch cheap alone, collectively making the system rigid and untestable.

Both are artifact–reality divergence: one through neglect, one through addition. The single cure, applied two ways: contracts that fail loudly, and loops that repair the source artifact rather than patch the output.

## Required reliability decides placement

A rule's *importance* does not decide where it lives — its *required reliability* does. Standing context (CLAUDE.md) shapes behavior probabilistically; it is delivered as input, not enforced. Anything that must hold every time belongs at a lifecycle boundary as a hook, not as a sentence in a markdown file. "Route determinism to code, not inference": anything with a true/false answer is a script or a hook, never a predicted result.

## Descriptions are typed interfaces

The one- or two-sentence description on a skill, command, or subagent is pre-loaded into context and is what the orchestrator routes on. It is an interface, not documentation. A stale or vague description is a silent integration failure: the capability either never fires or misfires, with no error. Version descriptions like API signatures.

## Progressive disclosure

The scaling primitive. Metadata (descriptions) is pre-loaded; bodies load on demand; reference files load when pointed to; scripts execute without ever entering context. You can install hundreds of capabilities for the cost of their descriptions and pay for a body only when a task summons it. Token economy is a public good — every line competes with everything else the system must attend to.

## The calibration test

Three questions decide every line of any artifact:

1. Does the model already know this? General competence → cut it; trust the model.
2. Must this be exact every time? Determinism → route to code or a hook, not prose.
3. Is this specific to our world and non-obvious? → state it precisely. This is the only category that earns prose.

Vague artifacts fail question 3. Over-prescriptive artifacts fail questions 1 and 2. Optimal artifacts pass all three — and are usually shorter than the vague version, because deleted lecturing makes room for the few facts that matter.
