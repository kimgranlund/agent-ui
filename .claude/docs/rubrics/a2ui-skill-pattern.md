# Rubric — a2ui-skill-pattern (a skill-doc pattern section)

> Status: proposed · v0.1 · 2026-08-06 · Layer: rubric (the referential standard `a2ui-review-agent` grades a
> skill-doc pattern section against).
> Charter: GH #493 (PR #492's escalation) · extends [`../spec/a2ui-expert-harness.spec.md`](../spec/a2ui-expert-harness.spec.md)
> SPEC-R3's rubric set (its v0.4 amendment). Sibling of [`a2ui-catalog.md`](./a2ui-catalog.md) — split, not
> widened, because a taught pattern shares none of a catalog row's evidence AND none of a code mechanism's
> probes; see that rubric's "Scope & siblings" note for the routing.
> Spec IDs: unqualified `SPEC-R#`/`SPEC-N#`/`AC#`/`OF#` cites refer to
> [`../spec/persona-catalog-composition.spec.md`](../spec/persona-catalog-composition.spec.md) (the
> specimen's owning contract) — several estate specs mint their own `SPEC-R2`, so the qualification is
> load-bearing.

The standard a **skill-doc pattern section** is authored against and graded by. The artifact is ONE
pattern section added to (or extended in) an a2ui skill doc — prose teaching a reusable composition idiom
to a future consumer. **The reference specimen the anchors cite is `a2ui-multi-catalog` §5**
("Composed/derived catalogs", `.claude/skills/a2ui-multi-catalog/SKILL.md`, PR #492's fifth pattern).

**Lane split (deliberate, not an overlap):** the harness `skill-checker` critic keeps the skill
DOCUMENT's contract — frontmatter, description/routing grammar, body shape (`docs:doc-checker`'s own
charter fences SKILL.md files to it). THIS rubric grades the section's **A2UI substance**: whether what
it teaches is true of the shipped mechanism and complete enough to consume. The same section can pass
one lane and fail the other; neither verdict substitutes for the other.

Dimensions are typed **[gate]** (a named probe decides it — the anchor cites the realized script) or
**[review]** (judgment grounded in `file:line`). This rubric has NO `[gate]` dimension: no realized
script decides a prose claim, and the estate's `[gate]` law (a2ui-expert-harness.spec.md SPEC-R3)
requires a `[gate]` to cite a realized deterministic probe. S1 is instead **[review], definitional**:
judgment whose METHOD is fixed — open every cited source, diff the claim verbatim, record the result
claim by claim — and whose verdict hard-gates promotion exactly as a `[gate]` would. Scale 1–5;
1 = failure, 3 = adequate, 5 = excellent.

## Dimensions

| # | Dimension | Type | What it checks | 1 → 3 → 5 (anchors cite the shipped specimen) |
|---|---|---|---|---|
| S1 | Mechanism truth | [review], definitional | Every code fact the section states — signatures, error codes, naming schemes, defaults, id shapes — matches the shipped source verbatim, and every cited authority (a qualified SPEC-R#/AC#, an ADR clause, a `file:line`) resolves and says what is claimed. The fixed method: open each cited symbol/clause and diff the claim against it, claim by claim (the verify-cited-authorities discipline — a fabricated citation is a drift tell) | 1: a stated signature/code/id that does not match the shipped source (`composeCatalog(base, local, personaId)` misquoted, a wrong error-code string), or a citation that does not resolve / does not support its claim · 3: every stated symbol, diagnostic code, derived-id scheme (`<base>--<persona>`), and default matches the source verbatim, and every cited clause resolves and supports the sentence citing it (§5's persona-catalog-composition.spec.md SPEC-R2/SPEC-N4/OF1 cites) · 5: + line-anchored citation-key discipline with a stated re-derivation rule (the `0169:N` key + its "re-open the cited lines on any suspicion of drift" clause), so a future reader can detect drift without trusting the section |
| S2 | Routing & boundary | [review] | The section states where the pattern applies AND where it does not: it routes builds/asks to the owning seat or skill rather than absorbing them, and it disambiguates against its nearest sibling pattern so a reader cannot land on the wrong one | 1: no boundary — a reader cannot tell this pattern from its nearest sibling, or the section absorbs work the skill's own routing table sends elsewhere · 3: an explicit routing sentence (which asks land here, which route away — §5 routes via the skill's "compose onto a base → §5, NOT §1" boundary line) plus a disambiguation against the nearest sibling pattern · 5: + the boundary anticipates the KNOWN confusable ask with the reasoned distinction, not a bare pointer (§1-vs-§5: "registers a whole, independently-authored catalog" vs "MERGES a fragment onto an ALREADY-registered base — no merge primitive in common") |
| S3 | Worked example & policy teaching | [review] | The section teaches by a worked, mechanism-true example and states each ruled policy WITH its consequence (collision, naming, multi-target, failure behavior) — enough for a consumer to apply the pattern without opening the source | 1: policy-free prose (no collision/failure behavior taught), or an example that would not run against the shipped mechanism · 3: a worked example with real ids and shapes (§5's both-bases `targetCatalogs` walk-through → `agent-ui--concierge` / `a2ui-basic--concierge`), and each ruled policy stated with its consequence (reject-loud collision · unknown target fails the same way · one derivation per pairing, never a three-way merge) · 5: + the example covers the edges a consumer will actually hit (the identity case; the degrade-to-base selection path) and teaches each edge's CONSEQUENCE — what the consumer observes when it fires — not just the happy path |

## Gate to promote (the section is admissible / shippable)

- **S1 ([review], definitional) ≥ 4 — hard.** A mechanism claim that drifted from source blocks
  admission regardless of the other scores: a taught pattern that teaches the wrong bytes poisons every
  consumer that trusts it.
- **Every remaining [review] dimension (S2, S3) ≥ 4.**
- **No compensation across dimensions** — a 5 elsewhere cannot offset a sub-4 dimension.

The `a2ui-review-agent` critic scores against this rubric in a fresh context (generator ≠ critic,
a2ui-expert-harness.spec.md SPEC-R8); S1's claim-by-claim open-and-diff record in the findings is the
evidence of record.

**Top failure to look for first:** a mechanism claim or citation that drifted from the shipped source
(S1 = 1) — everything the section teaches downstream of a false fact is a defect multiplier.
