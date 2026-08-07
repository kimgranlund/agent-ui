#!/usr/bin/env python3
"""Unit test for adr_ratify.py's Repairs-cell parser and its booked-repairs artifacts.

The repo carries no python test runner, so this is stdlib `unittest`, run directly:

    python3 scripts/adr_ratify_test.py

Two scopes, no `gh` and no network in either:

  * the PURE parser + body composers (`booked_repairs`, `checklist`, `issue_title`, `issue_body`)
  * the WHOLE flip path (`main`) over a temp repo tree with `subprocess` faked — the only place the
    post-flip artifacts are observed as they actually land (GH #544). A green per-function assertion
    is not proof the flip files the tracking issue; this runs the real `main()` and reads the real
    `gh` calls it made.
"""
from __future__ import annotations

import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

import adr_ratify  # noqa: E402
from adr_ratify import (  # noqa: E402
    REPAIRS_ISSUE_LABEL,
    REPAIRS_ROW_RE,
    booked_repairs,
    checklist,
    issue_body,
    issue_title,
)

# ADR-0167's real Repairs cell (the hard case: two bold-labelled bookings in ONE ` · `-free cell,
# one plain "On ratification", one "On ratification+build"). Copied verbatim 2026-07-31.
ADR_0167_CELL = (
    "**On ratification (courtesy pointer, not a repair of amended text):** a dated REV forward "
    "pointer on [ADR-0154](./0154-shell-grammar-resizable-pane-tab-collapse.md) — its Consequences "
    "left the `paneResize` export CONDITIONAL (\"if the LLD's recommended fork lands\", `:91-93`), "
    "so a reader arriving there deserves the onward link to where the route question was finally "
    "answered (the ADR-0156 cl.5 / ADR-0165 pointer shape). **On ratification+build:** "
    "`packages/agent-ui/components/src/index.ts` (the standing note at `:7` gains the subpath route "
    "+ this ADR's ID; the shipped `./traits/overlay` bytes are UNCHANGED — PR #375 already built them)"
)

# ADR-0164's real Repairs cell (the nested-separator case: the single booking's parenthetical file
# list carries its own ` · `s, which must NOT end the item). Copied verbatim 2026-07-31.
ADR_0164_CELL = (
    'none owed backward — an intake ADR resolving a home, not a defect. **On ratification+build**'
    ' (the ADR-0162/0163 Repairs-row shape): `app/src/controls/entry-list/**` (new — `entry-'
    'list.ts` moved verbatim · `entry-data.ts`, the generic core split out of `entries.ts` · '
    '`entry-data.test.ts`, the core half of `entries.test.ts` moved with it · new `entry-'
    'list.css` · a standalone mount smoke test) · `app/src/controls/agent-admin/{agent-admin.ts, '
    'agent-admin.css, entries.ts, entries.test.ts, genui-pack-library.test.ts}` (imports re-'
    'pointed; `entries.ts` keeps its name, loses its generic half; `entries.test.ts` keeps the '
    'domain-half assertions; the entry-list style block moves out and its tokens repoint) · '
    '`app/package.json` (+`./entry-list`, `./entry-list.css`, `./entry-data`) · '
    '`app/src/index.ts` (re-pointed, names byte-identical) · the AC19 sheet-set one-line append ·'
    ' two `agent-ui-composition-patterns` rows (cl.5)'
)

# ADR-0137's real Repairs cell (the LABEL-SCOPE case: one cell-leading `on ratification+build:`
# heading over a four-item ` · ` list, where only the FIRST item repeats the phrase — the third says
# "repaired at build" and used to drop for it). Copied verbatim 2026-08-04.
ADR_0137_CELL = (
    'on ratification+build: '
    '[TKT-0072](../tickets/tkt-0072-exportable-a2ui-agent-producer-toolkit.md) (the owning '
    'ticket) · [`a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) **SPEC-N1** (a v0.5 '
    'versioned amendment — the surface list gains `./agent`, the "site/tools-scoped only" fence '
    "narrows to the key/proxy/registry shell; gated on ratification, the SPEC's own v0.2–v0.4 "
    'changelog mechanism) · [`a2ui-live-agent.lld.md`](../lld/a2ui-live-agent.lld.md) §0 '
    'placement law + §2 file map (repaired at build) · `packages/agent-ui/a2ui/package.json` '
    '(gains `"./agent"` at build time, gated on ratification — the '
    '[ADR-0062](./0062-corpus-packaging-pure-core-subpath-data-home.md) wording precedent)'
)

# ADR-0028's real cell, WHOLE (720 chars) — no booking at all, but three code-span `(` glyphs
# leave its raw paren count +3, the corpus's only unbalanced cell. Proof that paren balancing must
# read code spans as opaque atoms. Copied verbatim 2026-07-31.
ADR_0028_CELL = (
    '`a2ui-runtime SPEC-R10` (the `${…}` clause gains the function-expression form — the '
    '`(`-bearing expression resolves, no longer renders literally) · `a2ui-renderer LLD-C10 §7` '
    "(the `${…}` interpolator's classifier `(`-branch parses → `FunctionCall` → `evaluate`; the "
    'function-expression arm moves from "deferred" to "delivered") · **NEW** `a2ui/renderer/fn-'
    'expr.ts` (the function-expression tokenizer/parser) · `a2ui/renderer/interpolate.ts` (the '
    "`body.includes('(')` classifier branch swaps verbatim-render → parse+evaluate; `interpolate` "
    'signature gains `emitError`+`registry` to reach `evaluate`) · `a2ui/renderer/functions.ts` '
    '(`resolveValue` threads `emitError`+`registry` into `interpolate` — both already in scope)'
)

# ADR-0001's real cell — a books-nothing record. (Carried the label ADR_0087 until 2026-07-31; the
# text was always ADR-0001's, so the FIXTURE moved to its true owner rather than the text changing.)
ADR_0001_CELL = (
    "*(none — sequencing/routing decision; edits no owning doc. Consistent with `PRD-A2`, runtime "
    "`SPEC-R11`/`SPEC-N6`, renderer `LLD-C11`, catalog `SPEC-R1`/`R2`/`R7`.)*"
)

# ADR-0065's real cell — two bookings, this time as separate ` · ` segments among non-booked ones.
ADR_0065_CELL = (
    "`icon-adapter.lld.md` LLD-C1/C2/C3/C5 (authored this change) · "
    "`packages/agent-ui/components/src/layering.test.ts:57` (allowlist gains `@agent-ui/icons` as a "
    "second lower-tier sibling — build-time, gated on ratification) · "
    "NEW `packages/agent-ui/icons/` workspace (gated on ratification)"
)


def cell_to_adr(cell: str) -> str:
    """Wrap a Repairs cell in the minimum ADR header-table shape the parser reads."""
    return f"> | **Status** | proposed |\n> | **Repairs** | {cell} |\n\n## Context\n"


class BookedRepairs(unittest.TestCase):
    def test_0167_yields_its_two_bookings_verbatim(self) -> None:
        items = booked_repairs(cell_to_adr(ADR_0167_CELL))
        self.assertEqual(len(items), 2, items)
        self.assertTrue(items[0].startswith("**On ratification (courtesy pointer"))
        self.assertTrue(items[0].endswith("ADR-0165 pointer shape)."))
        self.assertTrue(items[1].startswith("**On ratification+build:**"))
        self.assertTrue(items[1].endswith("PR #375 already built them)"))
        # verbatim: every item is a literal substring of the source cell
        for item in items:
            self.assertIn(item, ADR_0167_CELL)

    def test_0065_yields_its_two_gated_segments(self) -> None:
        items = booked_repairs(cell_to_adr(ADR_0065_CELL))
        self.assertEqual(len(items), 2, items)
        self.assertTrue(items[0].startswith("`packages/agent-ui/components/src/layering.test.ts:57`"))
        self.assertTrue(items[1].startswith("NEW `packages/agent-ui/icons/` workspace"))

    def test_cell_booking_nothing_yields_nothing(self) -> None:
        self.assertEqual(booked_repairs(cell_to_adr(ADR_0001_CELL)), [])

    def test_0164_real_cell_keeps_its_nested_file_list_whole(self) -> None:
        items = booked_repairs(cell_to_adr(ADR_0164_CELL))
        self.assertEqual(len(items), 6, items)
        self.assertTrue(items[0].startswith("**On ratification+build**"), items[0])
        # the ` · `s inside the `(new — …)` file list are nested, so the item runs to its close
        self.assertTrue(items[0].endswith("a standalone mount smoke test)"), items[0])
        self.assertIn("`entry-data.ts`, the generic core split out of `entries.ts`", items[0])
        # …and the label's scope carries its five depth-0 tail segments (GH #394 residual 2)
        self.assertTrue(items[1].startswith("`app/src/controls/agent-admin/{agent-admin.ts"), items[1])
        self.assertTrue(items[2].startswith("`app/package.json`"), items[2])
        self.assertTrue(items[3].startswith("`app/src/index.ts`"), items[3])
        self.assertEqual(items[4], "the AC19 sheet-set one-line append")
        self.assertEqual(items[5], "two `agent-ui-composition-patterns` rows (cl.5)")
        # the cell's leading non-booked prose still precedes the label, so it is still no item
        for item in items:
            self.assertNotIn("none owed backward", item)
            self.assertIn(item, ADR_0164_CELL)  # verbatim

    def test_0137_real_cell_books_every_item_under_its_leading_label(self) -> None:
        # The label-scope case: `on ratification+build:` heads the list, so item 3 is booked despite
        # saying "repaired at build" instead of repeating the phrase (GH #394 residual 1).
        items = booked_repairs(cell_to_adr(ADR_0137_CELL))
        self.assertEqual(len(items), 4, items)
        self.assertTrue(items[0].startswith("on ratification+build: [TKT-0072]"), items[0])
        self.assertTrue(items[1].startswith("[`a2ui-live-agent.spec.md`]"), items[1])
        self.assertEqual(
            items[2],
            "[`a2ui-live-agent.lld.md`](../lld/a2ui-live-agent.lld.md) §0 placement law + §2 file "
            "map (repaired at build)",
        )
        self.assertTrue(items[3].startswith("`packages/agent-ui/a2ui/package.json`"), items[3])
        for item in items:
            self.assertIn(item, ADR_0137_CELL)  # verbatim

    def test_a_parenthesised_mention_is_a_note_not_a_label(self) -> None:
        # The discriminator that keeps label scope from swallowing whole cells: `(… on ratification)`
        # books its OWN segment only. ADR-0065's real cell is the corpus witness (test above).
        cell = "`x.ts` (gated on ratification) · `y.ts` (cosmetic only, already landed)"
        items = booked_repairs(cell_to_adr(cell))
        self.assertEqual(items, ["`x.ts` (gated on ratification)"])

    def test_0028_real_cell_survives_its_unbalanced_code_span_parens(self) -> None:
        # Books nothing, so the OUTPUT is [] either way — the point is that the three code-span
        # `(` glyphs must not open a parenthetical that swallows the rest of the cell.
        self.assertEqual(booked_repairs(cell_to_adr(ADR_0028_CELL)), [])

    def test_a_code_span_paren_does_not_swallow_the_next_segment(self) -> None:
        cell = "`foo.ts` (the `(`-branch, gated on ratification) · `bar.ts` (gated on ratification)"
        items = booked_repairs(cell_to_adr(cell))
        self.assertEqual(len(items), 2, items)
        self.assertTrue(items[1].startswith("`bar.ts`"), items)

    def test_prefix_before_a_bold_booking_label_is_dropped(self) -> None:
        # The minimal shape behind ADR-0164: prose that books nothing, then a bold label mid-segment.
        cell = (
            "none owed backward — an intake ADR resolving a home, not a defect. "
            "**On ratification+build** (the ADR-0162/0163 Repairs-row shape): "
            "`app/src/controls/entry-list/**` (new — moved verbatim)"
        )
        items = booked_repairs(cell_to_adr(cell))
        self.assertEqual(len(items), 1, items)
        self.assertTrue(items[0].startswith("**On ratification+build**"))

    def test_malformed_and_empty_inputs_return_empty_without_throwing(self) -> None:
        self.assertEqual(booked_repairs(""), [])
        self.assertEqual(booked_repairs("not an ADR at all"), [])
        self.assertEqual(booked_repairs(cell_to_adr("")), [])
        self.assertEqual(booked_repairs(cell_to_adr(" · · ")), [])
        self.assertEqual(booked_repairs("> | **Repairs** | unterminated row"), [])


class FixturesMatchTheRealCells(unittest.TestCase):
    """Every fixture above claims to be some ADR's REAL cell — so prove it against the file.

    Both fixture defects found in review were this drift: one cell carried a neighbour's ID, one was
    a silent truncation whose comment then described the WHOLE cell's paren count. A fixture that
    only claims to be real is worth nothing; this reads the ADR and compares. Skips (never fails)
    when the corpus is absent, so the parser test stays runnable outside a checkout.
    """

    def test_each_fixture_is_its_named_adr_cell_verbatim(self) -> None:
        adr_dir = Path(__file__).resolve().parent.parent / ".claude" / "docs" / "adr"
        if not adr_dir.is_dir():
            self.skipTest(f"no ADR corpus at {adr_dir}")
        for adr_id, fixture in (
            ("0001", ADR_0001_CELL), ("0028", ADR_0028_CELL), ("0065", ADR_0065_CELL),
            ("0137", ADR_0137_CELL), ("0164", ADR_0164_CELL), ("0167", ADR_0167_CELL),
        ):
            with self.subTest(adr=adr_id):
                files = sorted(adr_dir.glob(f"{adr_id}-*.md"))
                self.assertEqual(len(files), 1, f"{len(files)} files match {adr_id}-*.md")
                row = REPAIRS_ROW_RE.search(files[0].read_text(encoding="utf-8"))
                self.assertIsNotNone(row, f"{files[0].name} has no Repairs row")
                self.assertEqual(fixture, row.group(1), f"fixture drifted from {files[0].name}")


class TheWholeCorpusParses(unittest.TestCase):
    """Six fixtures prove six shapes; this reads every real cell in the repo (168 at 2026-08-04).

    The parser's whole promise is that a posted checklist item is the ADR's own text, quoted verbatim
    and never paraphrased (ADR-0149 F2) — so assert exactly that over the real corpus, which is also
    the population the label-scope rule was derived from. Skips (never fails) outside a checkout.
    """

    def test_every_cell_yields_verbatim_non_empty_items(self) -> None:
        adr_dir = Path(__file__).resolve().parent.parent / ".claude" / "docs" / "adr"
        if not adr_dir.is_dir():
            self.skipTest(f"no ADR corpus at {adr_dir}")
        cells = 0
        for path in sorted(adr_dir.glob("0*.md")):
            text = path.read_text(encoding="utf-8")
            row = REPAIRS_ROW_RE.search(text)
            if not row:
                continue
            cells += 1
            for item in booked_repairs(text):
                with self.subTest(adr=path.name):
                    self.assertEqual(item, item.strip())
                    self.assertIn(item, row.group(1))  # verbatim, never composed
        self.assertGreater(cells, 150, "the ADR corpus got smaller — is the glob still right?")


class BookedRepairsBodies(unittest.TestCase):
    """The two surfaces' text is composed, never paraphrased (ADR-0149 F2)."""

    ITEMS = ["**On ratification:** `roadmap.md` restates", "`catalog.json` gains a row (cl.2)"]

    def test_checklist_is_one_unticked_box_per_item_verbatim(self) -> None:
        self.assertEqual(
            checklist(self.ITEMS),
            "- [ ] **On ratification:** `roadmap.md` restates\n"
            "- [ ] `catalog.json` gains a row (cl.2)",
        )

    def test_issue_title_is_the_fixed_template(self) -> None:
        self.assertEqual(issue_title("0175"), "ADR-0175: execute the booked repairs")

    def test_issue_body_quotes_every_item_verbatim_and_says_open_is_the_state(self) -> None:
        body = issue_body("0175", ".claude/docs/adr/0175-x.md", "https://u", "2026-08-06", self.ITEMS)
        for item in self.ITEMS:
            self.assertIn(f"- [ ] {item}", body)
        self.assertIn("ADR-0175", body)
        self.assertIn("https://u", body)
        self.assertIn("2026-08-06", body)
        self.assertIn(".claude/docs/adr/0175-x.md", body)
        self.assertIn("stays OPEN", body)


# ── the whole-path harness ──────────────────────────────────────────────────────────────────────

FIXTURE_ADR = """# ADR-9999 — a fixture

> | | |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-07 |
> | **Proposed by** | a seat |
> | **Ratified by** | *(pending)* |
> | **Repairs** | none owed backward — a fixture. **On ratification:** `roadmap.md` restates · \
**On ratification+build:** `catalog.json` gains a row |
> | **Supersedes / Superseded by** | none |

## Context
"""

FIXTURE_README = (
    "# ADR index\n\n"
    "| ADR | Title | Status | Date |\n"
    "|---|---|---|---|\n"
    "| [9998](./9998-other.md) | Other | accepted | 2026-08-06 |\n"
    "| [9999](./9999-fixture.md) | A fixture | proposed | 2026-08-07 |\n"
)

UTTERANCE_URL = "https://github.com/OWNER/REPO/pull/38#issuecomment-77"


class FakeProc:
    def __init__(self, stdout: str = "", returncode: int = 0, stderr: str = "") -> None:
        self.stdout, self.returncode, self.stderr = stdout, returncode, stderr


class FakeSubprocess:
    """Stands in for the `subprocess` module, recording every call `main()` makes.

    Every command `main()` shells out to is answered here, so the whole path runs with no git, no
    node, no `gh` and no network — and the two post-flip artifacts are readable as the exact API
    payloads they would have been.
    """

    def __init__(self, root: Path, issue_ok: bool = True) -> None:
        self.root, self.issue_ok = root, issue_ok
        self.calls: list[tuple[list[str], str | None]] = []

    def run(self, cmd, capture_output=False, text=False, input=None):  # noqa: A002 — mirrors subprocess
        self.calls.append((list(cmd), input))
        joined = " ".join(cmd)
        if cmd[:2] == ["git", "rev-parse"]:
            return FakeProc(f"{self.root}\n")
        if cmd[:2] == ["git", "remote"]:
            return FakeProc("https://github.com/OWNER/REPO.git\n")
        if cmd[0] == "node":
            return FakeProc("")
        if cmd[:2] == ["gh", "repo"]:
            return FakeProc(json.dumps({"owner": {"login": "OWNER"}}))
        if cmd[:2] == ["gh", "api"] and cmd[2].endswith("/issues/comments/77"):
            return FakeProc(json.dumps({
                "user": {"login": "OWNER"},
                "body": "ratify ADR-9999",
                "created_at": "2026-08-07T10:00:00Z",
            }))
        if joined.endswith("repos/OWNER/REPO/issues --input -"):
            if not self.issue_ok:
                return FakeProc("", returncode=1, stderr="HTTP 503")
            return FakeProc(json.dumps({"number": 601, "html_url": "https://github.com/x/601"}))
        if joined.endswith("repos/OWNER/REPO/issues/38/comments --input -"):
            return FakeProc(json.dumps({"id": 9}))
        raise AssertionError(f"unstubbed command: {joined}")

    def payload(self, suffix: str) -> dict:
        """The JSON body of the one recorded call whose command ends with `suffix`."""
        hits = [body for cmd, body in self.calls if " ".join(cmd).endswith(suffix)]
        assert len(hits) == 1, f"{len(hits)} calls ending '{suffix}'"
        return json.loads(hits[0])

    def called(self, suffix: str) -> int:
        return sum(1 for cmd, _ in self.calls if " ".join(cmd).endswith(suffix))


class WholeFlipPath(unittest.TestCase):
    """Runs the real `main()` end to end and asserts what it actually did (GH #544).

    The regression this pins: before the fix, a flip's ONLY post-flip artifact was a comment on the
    ratifying PR — which is closed by then, carries no state and sits in no queue, so two ADRs'
    repairs fell through in a day. The load-bearing assertion is that a flip owing repairs files an
    OPEN tracking issue.
    """

    def flip(self, issue_ok: bool = True):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        adr_dir = root / ".claude" / "docs" / "adr"
        adr_dir.mkdir(parents=True)
        (adr_dir / "9999-fixture.md").write_text(FIXTURE_ADR, encoding="utf-8")
        (adr_dir / "README.md").write_text(FIXTURE_README, encoding="utf-8")

        fake = FakeSubprocess(root, issue_ok=issue_ok)
        real_subprocess, real_argv = adr_ratify.subprocess, sys.argv
        adr_ratify.subprocess = fake
        sys.argv = ["adr_ratify.py", "ADR-9999", UTTERANCE_URL]
        out = io.StringIO()
        try:
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
                code = adr_ratify.main()
        finally:
            adr_ratify.subprocess, sys.argv = real_subprocess, real_argv
        return code, fake, adr_dir, out.getvalue()

    def test_a_flip_owing_repairs_files_an_open_tracking_issue(self) -> None:
        code, fake, adr_dir, stdout = self.flip()
        self.assertEqual(code, 0, stdout)

        # the flip itself still lands, unchanged
        adr = (adr_dir / "9999-fixture.md").read_text(encoding="utf-8")
        self.assertIn("> | **Status** | accepted |", adr)
        self.assertIn("OWNER (repo owner), 2026-08-07", adr)
        readme = (adr_dir / "README.md").read_text(encoding="utf-8")
        self.assertIn("| [9999](./9999-fixture.md) | A fixture | accepted | 2026-08-07 |", readme)
        self.assertIn("| [9998](./9998-other.md) | Other | accepted | 2026-08-06 |", readme)

        # …and the booked repairs now land as a tracked artifact, not only a comment
        issue = fake.payload("repos/OWNER/REPO/issues --input -")
        self.assertEqual(issue["title"], "ADR-9999: execute the booked repairs")
        self.assertEqual(issue["labels"], [REPAIRS_ISSUE_LABEL])
        self.assertIn("- [ ] **On ratification:** `roadmap.md` restates", issue["body"])
        self.assertIn("- [ ] **On ratification+build:** `catalog.json` gains a row", issue["body"])
        # the cell's leading non-booked prose is not an item (the ADR-0164 shape)
        self.assertNotIn("none owed backward", issue["body"])
        self.assertIn(UTTERANCE_URL, issue["body"])

        # the comment stays, and points at the issue that actually holds the state
        comment = fake.payload("repos/OWNER/REPO/issues/38/comments --input -")
        self.assertIn("Tracked in #601", comment["body"])
        self.assertIn("- [ ] **On ratification:** `roadmap.md` restates", comment["body"])
        self.assertIn("filed:  booked-repairs tracking issue OWNER/REPO#601", stdout)

    def test_a_failed_filing_still_exits_zero_and_the_comment_says_so(self) -> None:
        # Fail-OPEN: the flip is the primary act and has landed — a 503 may not revert or red it.
        code, fake, adr_dir, stdout = self.flip(issue_ok=False)
        self.assertEqual(code, 0, stdout)
        self.assertIn("> | **Status** | accepted |", (adr_dir / "9999-fixture.md").read_text())
        comment = fake.payload("repos/OWNER/REPO/issues/38/comments --input -")
        self.assertIn("No tracking issue was filed", comment["body"])
        self.assertNotIn("Tracked in", comment["body"])

    def test_a_flip_owing_nothing_files_nothing(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        adr_dir = root / ".claude" / "docs" / "adr"
        adr_dir.mkdir(parents=True)
        (adr_dir / "9999-fixture.md").write_text(
            FIXTURE_ADR.replace(
                FIXTURE_ADR.split("> | **Repairs** | ")[1].split(" |\n")[0],
                "*(none — a sequencing decision; edits no owning doc.)*",
            ),
            encoding="utf-8",
        )
        (adr_dir / "README.md").write_text(FIXTURE_README, encoding="utf-8")
        fake = FakeSubprocess(root)
        real_subprocess, real_argv = adr_ratify.subprocess, sys.argv
        adr_ratify.subprocess = fake
        sys.argv = ["adr_ratify.py", "ADR-9999", UTTERANCE_URL]
        try:
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                code = adr_ratify.main()
        finally:
            adr_ratify.subprocess, sys.argv = real_subprocess, real_argv
        self.assertEqual(code, 0)
        self.assertEqual(fake.called("repos/OWNER/REPO/issues --input -"), 0)
        self.assertEqual(fake.called("repos/OWNER/REPO/issues/38/comments --input -"), 0)

    def test_dry_run_writes_nothing_and_names_the_issue_it_would_file(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        adr_dir = root / ".claude" / "docs" / "adr"
        adr_dir.mkdir(parents=True)
        (adr_dir / "9999-fixture.md").write_text(FIXTURE_ADR, encoding="utf-8")
        (adr_dir / "README.md").write_text(FIXTURE_README, encoding="utf-8")
        fake = FakeSubprocess(root)
        real_subprocess, real_argv = adr_ratify.subprocess, sys.argv
        adr_ratify.subprocess = fake
        sys.argv = ["adr_ratify.py", "ADR-9999", UTTERANCE_URL, "--dry-run"]
        out = io.StringIO()
        try:
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
                code = adr_ratify.main()
        finally:
            adr_ratify.subprocess, sys.argv = real_subprocess, real_argv
        stdout = out.getvalue()
        self.assertEqual(code, 0, stdout)
        self.assertIn("DRY-RUN", stdout)
        self.assertIn("would file 'ADR-9999: execute the booked repairs'", stdout)
        self.assertIn(f"label '{REPAIRS_ISSUE_LABEL}'", stdout)
        # zero writes, zero artifacts
        self.assertIn("> | **Status** | proposed |", (adr_dir / "9999-fixture.md").read_text())
        self.assertEqual(fake.called("repos/OWNER/REPO/issues --input -"), 0)
        self.assertEqual(fake.called("repos/OWNER/REPO/issues/38/comments --input -"), 0)


if __name__ == "__main__":
    unittest.main()
