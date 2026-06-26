# Foundations — intent extraction

> The load-bearing models behind separating what was SAID from what is WANTED. Grounded in pragmatics,
> requirements engineering, and question design (sources at the foot). 2026-06-26.

## Literal meaning vs speaker meaning (pragmatics)

A request communicates more than its words. Grice's **Cooperative Principle** holds that speakers
contribute what is "required by the accepted purpose of the exchange," via four maxims — **Quality**
(truth), **Quantity** (the right amount), **Relation** (relevance), **Manner** (clarity). When a request
seems to *flout* a maxim — vague, over- or under-specified, oddly framed — that flout signals an
**implicature**: an unstated intent to infer, not a literal instruction to obey. Extraction is
recovering the implicature.

## The XY problem

A requester often asks about their attempted **solution (Y)** rather than their actual **goal (X)** —
"how do I do Y" when Y is a poor path to X. Surfacing X beats perfecting Y. A category-mismatch signal
(the requested *form* is wrong for the goal) is usually the tell.

## Requirements elicitation

Eliciting true requirements is a discipline — interviews, workshops, prototyping, observation all exist
because stated requests **omit hidden requirements and carry ambiguities**. A clarifying exchange is a
one-shot interview, and the same failure modes apply: intent loss, unstated assumptions, the elastic
"should." Ambiguity not resolved at intake **multiplies downstream**, which is why intake is the
highest-leverage place to resolve it.

## Jobs to be done

People "hire" a result to make progress in a situation. The **job** — the progress sought, in context —
is the root goal; the literal ask is one candidate way to get it. Optimise the job, not the wording.

## The delta — a taxonomy

The gap between ask and goal appears as one of: **category mismatch** (wrong form/unit), **ambiguity**
(two readings), **conflict** (two goals that can't both win), **unstated assumption** (a "should" with no
owner), **missing acceptance** (no definition of done), **hidden scope** (no non-goals). Each is a
distinct thing to either resolve or ask about.

## The economics of asking

A clarifying question spends the requester's attention — a real cost. **Closed** (multiple-choice)
questions lower that cost: easy to answer, fast to compare, low cognitive load (2–5 options is the
usable range). **Open** questions cost more but capture the unexpected. So ask only when the answer
changes the output; otherwise infer-with-stated-assumption. Over-asking is itself a failure.

---

Sources: [Grice's cooperative principle](https://en.wikipedia.org/wiki/Cooperative_principle) ·
[Implicature (SEP)](https://plato.stanford.edu/entries/implicature/) ·
[Requirements elicitation](https://www.geeksforgeeks.org/software-engineering/software-engineering-requirements-elicitation/) ·
[Open vs closed questions (NN/g)](https://www.nngroup.com/articles/open-ended-questions/)
