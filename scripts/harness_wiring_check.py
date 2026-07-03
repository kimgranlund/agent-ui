#!/usr/bin/env python3
"""harness_wiring_check.py — the A2UI expert-harness wave-close governance proof (LLD-C7).

Realizes `.claude/docs/specs/llds/a2ui-harness-wiring.lld.md` §9 for
`.claude/docs/specs/specs/a2ui-expert-harness.spec.md` SPEC-R5 AC1 + SPEC-R7. Two jobs:

  1. MODE CHECKS — run the shared `harness_checks.py` (skill|agent|rubric mode) over EVERY file
     in the enumerated harness artifact set (SPEC §5.1). This is the same mechanical gate each
     artifact was authored against; the wave-close proof re-runs it over the whole set at once.
  2. REACHABILITY (SPEC-R5 AC1) — the wiring only a whole-set view can see:
       a. every MAKER agent names a `graded by:` rubric that exists on disk;
       b. every fully-qualified `.claude/**` or `packages/**` path any harness artifact cites
          resolves to a real file;
       c. every `a2ui-*.md` rubric is referenced by >= 1 agent or skill (no orphan rubric);
       d. no MAKER file embeds its own verdict/score (generator != critic — SPEC-R8, LLD §8).

Exit 0 = everything resolves. Exit 1 = at least one wiring defect (fails loudly, prints each).

Stdlib only; no pip deps. This is a MANUAL gate (the `npm run size` precedent, ADR-0040 §3):
run by hand at authoring DoD + wave close. It is deliberately NOT wired into `npm test`/CI —
vitest's include is packages-only, and `.claude/` governance does not belong in a package suite.
Promotion to a standing gate triggers on the first observed wiring-drift incident (LLD §9).

    python3 scripts/harness_wiring_check.py

===============================================================================================
THE ENUMERATED HARNESS ARTIFACT SET (SPEC §5.1) — the exact files this script governs.

  skills : a2ui-compose · a2ui-corpus-curate
  agents : a2ui-composer (maker) · a2ui-reviewer (critic)
  rubrics: a2ui-payload · a2ui-catalog · a2ui-corpus

`a2ui-builder.md` is DELIBERATELY OUT of the maker->graded-by enumeration (LLD §9). It is a
package/renderer/catalog BUILD seat graded by the SPEC/LLD acceptance rows + the wave reviewer
seats, NOT by a harness rubric — so it carries no `graded by:` rubric line by design. Its absence
from the maker set below is intentional and must never be read as a missing-grader / orphan defect.

The deterministic gates (`validateA2ui`, admission `E_*`, `corpus-data.test.ts`), the tool CLIs
(`validate-payload.ts`, `judge.ts`, `rescore.ts`), and the routing corpora are verified by their
OWN suites/run-logs (SPEC §5.1) — they are not `harness_checks.py` skill/agent/rubric artifacts,
so they are not mode-checked here. Leg (b) still asserts any of their paths this set CITES resolve.
===============================================================================================
"""
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# --- the enumerated harness artifact set (SPEC §5.1) -------------------------------------------
SKILLS = [
    ".claude/skills/a2ui-compose/SKILL.md",
    ".claude/skills/a2ui-corpus-curate/SKILL.md",
]
# role per SPEC §5.1: a MAKER emits an artifact and is graded by a named rubric; a CRITIC grades
# (and so legitimately embeds verdict shapes — the self-grade check must NOT run over a critic).
AGENTS = [
    (".claude/agents/a2ui-composer.md", "maker"),
    (".claude/agents/a2ui-reviewer.md", "critic"),
]
RUBRICS = [
    ".claude/docs/rubrics/a2ui-payload.md",
    ".claude/docs/rubrics/a2ui-catalog.md",
    ".claude/docs/rubrics/a2ui-corpus.md",
]


def find_harness_checks():
    """`harness_checks.py` — the shared mechanical checker. skill|agent|rubric modes all live in
    ONE file (agent-author/scripts/harness_checks.py symlinks to skill-author's); either resolves."""
    home = Path.home()
    for owner in ("skill-author", "agent-author"):
        p = home / ".claude" / "skills" / owner / "scripts" / "harness_checks.py"
        if p.is_file():
            return p
    return None


class Report:
    def __init__(self):
        self.checks = []  # (ok, label, detail)

    def add(self, ok, label, detail=""):
        self.checks.append((bool(ok), label, detail))

    def section(self, title):
        print("\n== %s ==" % title)

    def emit_since(self, start):
        for ok, label, detail in self.checks[start:]:
            line = "[%s] %s" % ("PASS" if ok else "FAIL", label)
            if detail and not ok:
                line += " — %s" % detail
            print(line)

    def result(self):
        failed = [c for c in self.checks if not c[0]]
        print("\n-- %d/%d wiring checks passed --"
              % (len(self.checks) - len(failed), len(self.checks)))
        return 0 if not failed else 1


# --- 1. mode checks ----------------------------------------------------------------------------

def run_mode(hc, mode, relpath, r):
    f = REPO / relpath
    if not f.is_file():
        r.add(False, "%s enumerated file exists: %s" % (mode, relpath), "file missing from tree")
        return
    proc = subprocess.run([sys.executable, str(hc), mode, str(f)],
                          capture_output=True, text=True)
    ok = proc.returncode == 0
    detail = ""
    if not ok:
        fails = [ln.strip() for ln in proc.stdout.splitlines() if "[FAIL]" in ln]
        detail = "; ".join(fails) or (proc.stdout.strip() or proc.stderr.strip())
    r.add(ok, "harness_checks.py %s exits 0: %s" % (mode, relpath), detail)


# --- 2a. maker -> graded-by rubric resolves ----------------------------------------------------

_GRADED_BY_LINE = re.compile(r"graded by:.*", re.I)
_RUBRIC_PATH = re.compile(r"\.claude/docs/rubrics/[A-Za-z0-9._-]+\.md")


def check_maker_graded_by(relpath, r):
    text = (REPO / relpath).read_text(encoding="utf-8")
    named = None
    for m in _GRADED_BY_LINE.finditer(text):
        pm = _RUBRIC_PATH.search(m.group(0))
        if pm:
            named = pm.group(0)
            break
    if named is None:
        r.add(False, "maker names a 'graded by:' rubric: %s" % relpath,
              "no 'graded by: .claude/docs/rubrics/*.md' line found")
        return
    r.add((REPO / named).is_file(),
          "maker's graded-by rubric resolves: %s -> %s" % (relpath, named),
          "rubric file does not exist on disk")


# --- 2b. fully-qualified references resolve -----------------------------------------------------
# Scope: fully-qualified, repo-root-relative paths only — `.claude/**` and `packages/**`. These
# are unambiguously resolvable against the repo root. Package-relative cites (`src/**`, `tools/**`,
# `corpus/**`) are ambiguous without a package base and stay judgment-tier; bundle-relative cites
# (`references/**`, `scripts/**`) are `harness_checks.py` D9's territory. Both are out of scope here.

_FQ_REF = re.compile(r"(?<![\w./-])((?:\.claude|packages)/[A-Za-z0-9._/-]+\.[A-Za-z0-9]+)")
_ALLOWED_EXT = {"md", "ts", "tsx", "js", "mjs", "cjs", "json", "jsonl", "py", "sh", "css", "html"}


def fq_refs(text):
    out = set()
    for raw in _FQ_REF.findall(text):
        tok = raw.split("#", 1)[0]                # strip a #fragment
        tok = re.split(r":\d", tok, 1)[0]         # strip a :line / :line-range suffix
        tok = tok.rstrip(").,;:`'\"")
        if "*" in tok:                            # a glob mention, not a literal path
            continue
        if tok.rsplit(".", 1)[-1].lower() not in _ALLOWED_EXT:
            continue
        out.add(tok)
    return out


def check_fq_refs(relpath, r):
    text = (REPO / relpath).read_text(encoding="utf-8")
    missing = sorted(ref for ref in fq_refs(text) if not (REPO / ref).exists())
    r.add(not missing, "fully-qualified refs resolve: %s" % relpath,
          "dangling: " + ", ".join(missing))


# --- 2c. no orphan rubric ----------------------------------------------------------------------

def check_no_orphan_rubrics(r):
    referrers = SKILLS + [a for a, _ in AGENTS]
    corpus = "\n".join((REPO / f).read_text(encoding="utf-8") for f in referrers)
    for rub in RUBRICS:
        base = Path(rub).name  # cited FQ or bare — match the basename either way
        r.add(base in corpus,
              "rubric referenced by >=1 agent/skill (no orphan): %s" % base,
              "no enumerated agent or skill cites it — orphan capability")


# --- 2d. no self-grading maker (generator != critic, SPEC-R8 / LLD §8) -------------------------
# A maker must never embed its OWN verdict. Two mechanical signals of a violation:
#   (i)  a VerdictsFile score KEY emitted in the maker body (`"qualityScore"` / `"passed"` JSON
#        keys) — that is the critic's machine artifact, never a maker's;
#   (ii) an AFFIRMATIVE reflexive self-score clause — a grading verb bound to a reflexive pronoun
#        (yourself/myself/itself) or a `self-grade`/`self-score`/`self-assess` form, with NO
#        negation in the clause. The legit composer only ever speaks of grading in the passive or
#        negated form ("graded BY a rubric", "you never self-grade", "not a licence to score
#        yourself") — none of which fires. Runs over MAKERS ONLY: a critic embeds verdicts by design.

_VERDICT_KEY = re.compile(r'"(?:qualityScore|passed)"\s*:')
_REFLEX_SCORE = re.compile(
    r"(?:(?:grade|scor|rate|rat|assess|judg)\w*\s+(?:your|my|it)self)"
    r"|(?:self[-\s]?(?:grade|scor|rat|assess|judg)\w*)", re.I)
_NEGATION = re.compile(
    r"\b(?:never|not|no|nothing|without|cannot|can't|don'?t|does\s?n'?t|is\s?n'?t|are\s?n'?t)\b",
    re.I)


def _clauses(text):
    # clause-ish units for negation scoping: split on sentence/line/semicolon + em/en/double dash
    return re.split(r"[.\n;]|—|–|--", text)


def check_no_self_grade(relpath, r):
    text = (REPO / relpath).read_text(encoding="utf-8")
    hits = []
    if _VERDICT_KEY.search(text):
        hits.append('embeds a VerdictsFile score key ("qualityScore"/"passed") — the critic\'s artifact')
    for cl in _clauses(text):
        if _REFLEX_SCORE.search(cl) and not _NEGATION.search(cl):
            hits.append("affirmative self-score clause: \"%s\"" % " ".join(cl.split())[:90])
    r.add(not hits, "maker does not self-grade (generator != critic): %s" % relpath,
          "; ".join(hits))


def main():
    hc = find_harness_checks()
    if hc is None:
        print("FATAL: harness_checks.py not found under "
              "~/.claude/skills/{skill-author,agent-author}/scripts/ — cannot run mode checks.")
        return 1

    r = Report()

    r.section("1. mode checks — harness_checks.py over the enumerated set (SPEC §5.1)")
    start = len(r.checks)
    for f in SKILLS:
        run_mode(hc, "skill", f, r)
    for f, _role in AGENTS:
        run_mode(hc, "agent", f, r)
    for f in RUBRICS:
        run_mode(hc, "rubric", f, r)
    r.emit_since(start)

    r.section("2a. reachability — every maker names a graded-by rubric that resolves")
    start = len(r.checks)
    for f, role in AGENTS:
        if role == "maker":
            check_maker_graded_by(f, r)
    r.emit_since(start)

    r.section("2b. reachability — every fully-qualified .claude/** & packages/** cite resolves")
    start = len(r.checks)
    for f in SKILLS + [a for a, _ in AGENTS] + RUBRICS:
        check_fq_refs(f, r)
    r.emit_since(start)

    r.section("2c. reachability — no orphan rubric (each cited by >=1 agent or skill)")
    start = len(r.checks)
    check_no_orphan_rubrics(r)
    r.emit_since(start)

    r.section("2d. generator != critic — no maker embeds its own verdict (SPEC-R8)")
    start = len(r.checks)
    for f, role in AGENTS:
        if role == "maker":
            check_no_self_grade(f, r)
    r.emit_since(start)

    return r.result()


if __name__ == "__main__":
    sys.exit(main())
