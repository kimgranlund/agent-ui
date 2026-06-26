---
name: intent-extraction
description: >-
  Extract the ROOT intent behind a task, instruction, or artifact before acting on it — separate the
  literal ask from the underlying goal, surface ambiguities, conflicting signals, category mismatches,
  and unstated assumptions, then resolve them with low-effort multiple-choice questions and restate the
  task 10x sharper. Use when a request is vague, underspecified, or readable multiple ways; when the
  wording and the apparent goal diverge; before a high-stakes or hard-to-reverse action; or when asked
  to "figure out what they really want", "what's the actual intent", "clarify this", "what am I really
  asking for", or "improve this prompt / brief / spec".
---

# Intent extraction

Find the goal *under* the words and resolve only the gaps that genuinely change what you'd do — turning
a fuzzy or overloaded request into a precise, executable one.

## When to use / when not

- **Use** before acting on an ambiguous, underspecified, expensive, or hard-to-reverse request — or
  whenever you're asked to clarify intent or sharpen a prompt/brief/spec.
- **Skip** when the request is already unambiguous and low-stakes. Manufacturing questions for a clear
  ask is its own failure: over-clarifying spends the author's attention for nothing.

## Method

1. **Capture the literal ask.** Restate it near-verbatim — the surface form, before interpretation.
2. **Infer the root goal.** One sentence: the *why* — what outcome counts as success, who it's for, what
   they'll do with the result. This is the thing to optimize; the literal ask is just one candidate path
   to it.
3. **Scan for the delta** between ask and goal. Name each signal you find:
   - **Category mismatch** — the requested *form/unit* is wrong for the goal (e.g. "make a skill" for
     what is really reference knowledge; "build an agent" for a deterministic check).
   - **Ambiguity** — a term, scope, or referent readable two ways.
   - **Conflict** — two goals that can't both be maximized, or an instruction fighting a constraint.
   - **Unstated assumption** — a "should" with no owner; a dependency or default taken for granted.
   - **Missing acceptance** — no definition of done / no success signal.
   - **Hidden scope** — no non-goals; the unbounded "…and also".
4. **Sort the delta into Resolve vs. Ask.**
   - **Resolve silently** anything inferable from the artifact, surrounding context, or a conventional
     default — and *state the assumption* so it's correctable.
   - **Ask only** what genuinely changes what you'd do AND can't be defaulted. The bar is "their answer
     changes the output," not "I'm slightly unsure."
5. **Ask in one batched round** (discipline below) — never drip questions across turns.
6. **Synthesize** the Resolved Intent (output contract below).
7. **Validate, then finalize** (validation loop below) — do not deliver until it passes.

## Multiple-choice discipline — make it effortless for the author

Present clarifications as multiple-choice, not open prompts. Use the **AskUserQuestion** tool.

- **Batch everything** into one round of **1–4 questions**, **2–4 concrete options** each.
- **Lead with the option you'd recommend**, marked "(recommended)". An "Other" escape is always present,
  so never add one yourself.
- Give each question a **short header chip** and phrase options so the author **picks, not writes**.
- When an option is a concrete artifact (a layout, an approach, a structure), include a **tiny preview**
  so the author compares at a glance.
- **Pre-resolve everything defaultable and show the assumption** — only the load-bearing forks reach the
  author.

## Output contract — the "Resolved Intent"

```
ROOT GOAL   — one sentence: the why / what success looks like.
LITERAL ASK — what was said, near-verbatim.
DELTAS      — each ambiguity / conflict / category-mismatch / assumption found; for each you resolved
              by default, the assumption you made.
OPEN        — the multiple-choice questions, if any genuinely remain (else omit).
SHARPENED   — the 10x restatement: what to actually do, scoped (incl. non-goals), with the success
              criterion — ready to execute or hand to another agent.
```

## Validation loop (finalize only when clean)

Before delivering, check the draft against the source and fix what fails — re-check until all pass:

- **Goal test** — if SHARPENED were executed exactly, would it produce ROOT GOAL? If not, the goal is
  mis-stated or the restatement drifted → fix.
- **Coverage test** — is every DELTA either resolved (with a stated assumption) or in OPEN? A dropped
  ambiguity resurfaces downstream → fix.
- **Necessity test** — would each OPEN question's answer actually change the output? If not, default it
  and remove it → fix.
- **Grounding test** — is every inferred goal/assumption traceable to the text, the context, or a named
  convention — not invented? If not, downgrade it to an OPEN question → fix.

If no genuine ambiguity survives step 4, omit OPEN and deliver SHARPENED directly — extraction *without*
interrogation is the ideal outcome, not a skipped step.

## Worked example

> **Ask:** "create a few skills or agents based on these three design docs."
>
> **ROOT GOAL** — operationalize the design standards in those docs into reusable, enforceable agent
> capabilities, so the rules get applied consistently as work is built.
> **DELTAS** — *Category mismatch:* the docs are referential knowledge, not procedures — "skill" is the
> wrong unit for most of it (→ references + a deterministic check + one skill). *Ambiguity:* "a few" and
> "skills **or** agents" — count and unit unspecified. *Assumption (resolved):* they want to feed the
> existing tooling, not invent parallel capabilities (stated, correctable).
> **OPEN** — one AskUserQuestion: *"Which unit for the enforceable parts?"* → (recommended) deterministic
> probe · a reviewing agent · fold into the author skill.
> **SHARPENED** — "Distill the docs into one reference; route the arithmetic rules to a probe; fold the
> application method into the existing author skill; defer the steward agent until there's something to
> steward" — scoped, with non-goals, ready to execute.
