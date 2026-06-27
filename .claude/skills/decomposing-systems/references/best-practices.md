# Best practices — decomposition

> The judgment layer: the non-obvious do/don't beyond the procedure. `method.md` owns the procedure;
> `references/<domain>.md` owns the axis vocabulary; this is what a competent decomposer still gets
> wrong. 2026-06-26.

## Do

- **Derive the two planes independently.** Run INSIDE-OUT *without* reading the node tree — the
  cross-check is worthless if one plane was copied from the other.
- **Make parts MECE** — mutually exclusive (no two nodes own the same responsibility) and collectively
  exhaustive (every part of the whole is covered).
- **Name a node by its responsibility**, not its position ("submit bar," not "bottom row"). The
  cross-check tests what a part *does*, not where it sits.
- **Justify or delete** every action-free leaf — give it a `justify` (`affordance` / `grouping`) or
  remove it. Decoration is gold-plating.
- **Write the manifest and run `scripts/coverage_check.py`** — the gate is deterministic.
- **Stop at one owner** — buildable/assignable without opening another branch.

## Don't

- **Read one plane off the other** — the cardinal sin: it runs one direction twice and passes the
  coverage script *trivially* (the host map is tautological) while finding nothing.
- **Over-decompose** (split past a single owner → coordination cost) or **under-decompose** (a "leaf"
  still hiding two responsibilities is not atomic).
- **Eyeball coverage** — trust `UNHOSTED` / `DANGLING` / `UNJUSTIFIED-LEAF` over your own reading.
- **Decompose into the solution** — name needs and parts, not the implementation you intend; that is the
  downstream author's job.
- **Skip the domain reference** — each domain's axis vocabulary + stop rule keep the planes concrete and
  comparable.

## When to add a domain

If none of the five domains' vocabulary fits, copy `_template.md`, fill both axes + the stop rule + a
worked pass, and add a row to the SKILL.md domain table — don't force a misfit domain onto the problem.

## The validation loop

draft both planes → write the manifest → `coverage_check.py` → fix every defect → re-run → finalize at
**exit 0**. The script is the gate; the prose is the method; `rubric.md` grades the result.

---

Sources: [Functional decomposition (PSU ME491)](http://web.cecs.pdx.edu/~gerry/class/ME491/notes/functional_decomposition.html) ·
[Work Breakdown Structure principles (PMI)](https://www.pmi.org/learning/library/work-breakdown-structure-basic-principles-4883)
