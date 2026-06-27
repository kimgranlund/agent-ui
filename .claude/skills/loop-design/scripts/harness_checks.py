#!/usr/bin/env python3
"""harness_checks.py — mechanical [gate] checks for harness artifacts.

Routes the deterministic rubric dimensions to code instead of inference.
Judgment ([review]) dimensions are NOT checked here — score those against
the bundled rubric.md. This only verifies what is mechanically checkable.

Usage:
    python harness_checks.py <type> <file>
    python harness_checks.py goal "<goal string>"   # goal takes a string OR a file

Types: skill agent claude-md llms-txt rubric reference prd spec lld goal

Exit 0 = all gate checks passed.  Exit 1 = at least one failed (fails loudly).
"""
import re
import sys
from pathlib import Path

VAGUE = ("clean", "elegant", "good", "nice", "properly", "robust", "well")


def read(arg: str) -> str:
    p = Path(arg)
    return p.read_text(encoding="utf-8") if p.exists() else arg


def frontmatter(text: str) -> str:
    m = re.match(r"\s*---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    return m.group(1) if m else ""


class Result:
    def __init__(self):
        self.checks = []  # (ok, label, detail)

    def add(self, ok, label, detail=""):
        self.checks.append((bool(ok), label, detail))

    def report(self, title):
        print(f"== {title} ==")
        for ok, label, detail in self.checks:
            mark = "PASS" if ok else "FAIL"
            line = f"[{mark}] {label}"
            if detail and not ok:
                line += f" — {detail}"
            print(line)
        failed = [c for c in self.checks if not c[0]]
        print(f"-- {len(self.checks) - len(failed)}/{len(self.checks)} gate checks passed --")
        return 0 if not failed else 1


def check_skill(t, r):
    lines = t.count("\n") + 1
    r.add(lines <= 500, "D2 body \u2264 500 lines", f"{lines} lines")
    fm = frontmatter(t)
    r.add(re.search(r"^name:", fm, re.M), "D1 frontmatter has name")
    desc = re.search(r"description:\s*(.+)", fm, re.S)
    r.add(bool(desc), "D1 frontmatter has description")
    if desc:
        r.add(re.search(r"\buse\b", desc.group(1), re.I),
              "D1 description states a trigger", "no 'use when/whenever' phrasing")


def check_agent(t, r):
    fm = frontmatter(t)
    r.add(re.search(r"^tools:", fm, re.M), "D2 tools scoped (not omitted)",
          "no tools: field — inherits full toolset incl. MCP")
    r.add(re.search(r"^model:", fm, re.M), "D5 model set")
    desc = re.search(r"description:\s*(.+)", fm, re.S)
    r.add(bool(desc) and re.search(r"\buse\b", desc.group(1), re.I),
          "D1 description states a trigger")
    r.add(not re.search(r"IMPORTANT:\s*never|never\s+(do|touch|write|call)", t, re.I),
          "D7 no enforcement-in-prose", "found 'never do X' style invariant — belongs in a hook")


def check_claude_md(t, r):
    lines = t.count("\n") + 1
    r.add(lines <= 200, "B1 \u2264 200 lines", f"{lines} lines")
    r.add(not re.search(r"IMPORTANT:\s*never|^\s*never\s", t, re.I | re.M),
          "B4 no 'IMPORTANT: never' as control", "enforcement belongs in a hook")


def check_llms_txt(t, r):
    r.add(re.search(r"^#\s+\S", t, re.M), "D1 has H1 project name")
    r.add(re.search(r"^>\s+\S", t, re.M), "D1 has blockquote summary")
    r.add(re.search(r"^##\s+\S", t, re.M), "D1 has \u2265 1 H2 section")
    r.add(re.search(r"\[[^\]]+\]\([^)]+\)", t), "D2 has \u2265 1 markdown link")


def check_rubric(t, r):
    rows = [ln for ln in t.splitlines() if ln.count("|") >= 3 and re.search(r"\bD\d|\bP\d|\bS\d|\bL\d|\bC\d|\bA\d|\bB\d", ln)]
    r.add(len(rows) >= 1, "structure: dimension table present", "no dimension rows found")
    if rows:
        typed = all(("[gate]" in ln or "[review]" in ln) for ln in rows)
        r.add(typed, "D1 every dimension typed [gate]/[review]")
    r.add(re.search(r"gate\s+to\s+promote|^gate:", t, re.I | re.M),
          "D8 aggregation/gate rule present")


def check_reference(t, r):
    r.add(len(re.findall(r"^#{1,6}\s+\S", t, re.M)) >= 2, "D1 has headings (scannable)")
    r.add(re.search(r"\b20\d\d[-/]\d|updated|source:|version", t, re.I),
          "D5 freshness marker present", "no date/source/version on volatile content")


def _ids(text, pat):
    return set(re.findall(pat, text))


def check_prd(t, r):
    r.add(bool(_ids(t, r"PRD-G\d+")), "P7 goal IDs present (PRD-G#)")
    r.add(re.search(r"out[- ]?of[- ]?scope|^\s*out:", t, re.I | re.M), "P3 out-of-scope stated")
    r.add(re.search(r"\bmust\b|\bshould\b|\bcould\b|priority", t, re.I), "P5 prioritization present")


def check_spec(t, r):
    r.add(bool(_ids(t, r"SPEC-R\d+")), "S7 requirement IDs present (SPEC-R#)")
    r.add(bool(_ids(t, r"PRD-G\d+")), "S1 traces up to PRD goals (PRD-G#)")
    r.add(re.search(r"acceptance|given .*when .*then", t, re.I | re.S), "S2 acceptance criteria present")


def check_lld(t, r):
    r.add(bool(_ids(t, r"LLD-C\d+")), "L1 component IDs present (LLD-C#)")
    r.add(bool(_ids(t, r"SPEC-R\d+")), "L1 traces up to SPEC requirements (SPEC-R#)")
    r.add(re.search(r"error|edge|failure|fallback", t, re.I), "L5 error/edge handling section present")


def check_goal(t, r):
    r.add(re.search(r"stop after|\b\d+\s*(turn|minute|hour)", t, re.I), "C3 bounded (turn/time cap)")
    measurable = re.search(r"exits?\s*0|passes|== |\bzero\b|\btest", t, re.I) or re.search(r"\d", t)
    r.add(bool(measurable), "C1 measurable end-state token present")
    vague = [w for w in VAGUE if re.search(rf"\b{w}\b", t, re.I)]
    r.add(not vague, "C1 no vague success terms", f"vague: {', '.join(vague)}")


CHECKS = {
    "skill": check_skill, "agent": check_agent, "claude-md": check_claude_md,
    "llms-txt": check_llms_txt, "rubric": check_rubric, "reference": check_reference,
    "prd": check_prd, "spec": check_spec, "lld": check_lld, "goal": check_goal,
}


def main(argv):
    if len(argv) < 3 or argv[1] not in CHECKS:
        print(f"usage: harness_checks.py <{'|'.join(CHECKS)}> <file|string>")
        return 2
    kind, arg = argv[1], argv[2]
    text = read(arg)
    r = Result()
    CHECKS[kind](text, r)
    return r.report(kind)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
