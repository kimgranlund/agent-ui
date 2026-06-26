# Best practices — intent extraction

> How to recover the goal under the words and resolve only the gaps that change what you'd do.
> 2026-06-26. (Mental models: `foundations.md`.)

## Do

- **Restate the literal ask first**, near-verbatim — before interpreting. Then state the **root goal** in
  one sentence (the why / what success looks like).
- **Scan for the delta** with the taxonomy (foundations) and name each signal you find.
- **Resolve-with-stated-assumption** anything inferable from the text, surrounding context, or a
  conventional default — and *say* the assumption so it stays correctable.
- **Ask only what changes the output.** The bar is "their answer changes what I do," not "I'm unsure."
- **Make questions low-effort** (closed-question design): multiple-choice, **2–4 options**, **lead with
  the recommended option**, neutral wording, a tiny preview where an option is a concrete artifact, and
  **batch into one round**.
- **Restate 10× sharper** at the end — scoped (incl. non-goals), with a success criterion, ready to
  execute or hand to another agent.

## Don't

- **Manufacture questions for a clear ask** — over-clarifying spends attention for nothing. Extraction
  *without* interrogation is the ideal outcome, not a skipped step.
- **Lead the witness** — "what problems did you hit?" presumes problems; ask "how did it go?". Neutral,
  non-presupposing phrasing.
- **Drip questions across turns** — batch them; each round costs a context switch.
- **Invent intent** — every inferred goal/assumption must trace to the text, context, or a named
  convention; if it can't, downgrade it to a question.
- **Optimise the literal Y** when the real goal is X (the XY problem) — surface X first.

## Techniques worth stealing

- **The 5 Whys** — chase a request up its causal chain to the root goal; stop when the next "why" leaves
  the problem domain.
- **Closed-then-open** — a multiple-choice fork to *decide*, with an "Other" escape for the
  unanticipated; follow up only the chosen branch if depth is needed.
- **Read-back / playback** — restate the resolved intent and let the requester correct it; a cheap,
  high-yield validation (the elicitation "confirm" step).

## The validation loop

Before delivering, check the restatement against the source and fix until clean: **goal** (executing the
sharpened restatement yields the root goal?), **coverage** (every delta resolved-with-assumption or in
an open question?), **necessity** (each open question would change the output?), **grounding** (nothing
invented?).

---

Sources: [Open vs closed questions (NN/g)](https://www.nngroup.com/articles/open-ended-questions/) ·
[Requirements elicitation](https://www.geeksforgeeks.org/software-engineering/software-engineering-requirements-elicitation/) ·
[Grice's cooperative principle](https://en.wikipedia.org/wiki/Cooperative_principle)
