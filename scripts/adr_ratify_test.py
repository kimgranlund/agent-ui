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
    AMENDMENT_HEADER_RE,
    REPAIRS_ISSUE_LABEL,
    REPAIRS_ROW_RE,
    amendment_body,
    amendment_booked_repairs,
    amendment_issue_body,
    amendment_issue_title,
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

    def __init__(
        self,
        root: Path,
        issue_ok: bool = True,
        comment_body: str = "ratify ADR-9999",
        comment_date: str = "2026-08-07T10:00:00Z",
    ) -> None:
        self.root, self.issue_ok = root, issue_ok
        self.comment_body, self.comment_date = comment_body, comment_date
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
                "body": self.comment_body,
                "created_at": self.comment_date,
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
        # Kim's no-index-file rule (2026-08-13): the flip writes the ADR's own cells and the derived
        # indexes, and NEVER an index file in the ADR folder — it used to also flip a README row.
        self.assertFalse((adr_dir / "README.md").exists())

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


# ── amendment-ratification mode (GH #664) ──────────────────────────────────────────────────────
# An ADR's own body may carry a `## Amendment (DATE, **proposed** — Kim ratifies) — TITLE` section
# — a narrower re-ruling appended after the whole ADR already flipped `accepted`. The whole-ADR
# flip above only ever touches Status/Ratified-by/README, so it correctly fail-closes on these;
# this section covers the sibling path that flips ONLY the one Amendment header.

# ADR-0179's REAL amendment section, copied verbatim from its state just BEFORE the 2026-08-10 hand
# flip this build replaces (`git show 34be0f87^:.claude/docs/adr/0179-agent-admin-three-pane-ia.md`,
# sliced from `## Amendment` to EOF — that heading runs to the end of the file, no later `## `
# section). Used to prove the mechanical path reproduces the exact hand flip that already happened.
ADR_0179_PREFLIP_AMENDMENT_SECTION = (
'## Amendment (2026-08-10, **proposed** — Kim ratifies) — cl.1\'s WIDE reading becomes the TRIPLE dock `[chat | author-chat | settings]`; cl.3\'s arrangement law extends to three; cl.2\'s selector re-keys from pane to composer ORIGIN\n\n> Append-only, and **proposed**: the Status cell reads `accepted` for the record as a whole and stays\n> byte-untouched — agents never flip status (`.claude/hooks/adr-status-guard.py`), and this amendment\n> carries no ratification of its own until Kim gives one. Every accepted section above is unedited.\n> The build that carries it is GH [#662](https://github.com/kimgranlund/agent-ui/issues/662) (S6 of the\n> GH [#651](https://github.com/kimgranlund/agent-ui/issues/651) family), with the LLD\'s §2/§5 rows\n> re-stated in the same change (`../lld/admin-three-pane-ia.lld.md`).\n>\n> **What this re-rules, precisely.** cl.1\'s *tier* sentence — "places, all three, at every width" —\n> stands; what changes is what "a place" costs at wide. cl.3\'s law — arrangement of the ONE settings\n> region, never duplication, never a runtime reparent — stands and now governs three regions instead\n> of two. cl.2\'s *survive* list stands byte-for-byte; its one SELECTOR sentence is re-ruled. cl.4\n> stands entirely and is in fact what makes the re-keying possible. Nothing in Consequences moves.\n\n**Why cl.1\'s wide reading changes.** cl.1 was ratified against a surface that did not exist yet. The\ndisjoint-places reading was the honest call at intake and the LLD flagged its one visible cost openly\n(§15\'s first risk: "today\'s wide first paint is chat + settings; post-S1-b it is Chat alone", with the\nrecommendation "ship disjoint; show Kim early"). That is exactly what happened — the family shipped,\nKim looked at the finished surface, and ruled the other way (2026-08-10, GH #662): at wide the test\nchat, the Builder interview and the settings rail sit SIDE BY SIDE. This is pixel-truth superseding a\npaper reading, which is the process working, not a defect in it. The `[chat | author | settings]`\nvocabulary cl.1 pinned is unchanged; the three places simply stop taking turns once there is room.\n\n**The amended reading of cl.1.** Three first-class places at every width, arranged in two bands:\n\n- **Below the triple line** — exactly the place the nav names has a box. Chat solo, or the\n  Author⇄Settings pair (itself drilling into one region below the master-detail\'s own 40rem line).\n  cl.1\'s original wide reading survives intact as this band\'s contract.\n- **At and above the triple line** — the TRIPLE DOCK: all three regions paint side by side, in that\n  reading order. The nav still names a place; it no longer gates one.\n\n**cl.3 extended, not stretched.** The triple is arrangement of the same three singleton regions —\nzero duplication, zero runtime reparenting, no second mount of anything. The pane holder becomes a\nflex row of the Chat conversation plus the existing `ui-master-detail`; the master-detail, its two\npane elements and the five section units are byte-identical nodes in both bands. The visibility\nmechanism moves from a `hidden` attribute written by `#applyPane` to a `data-pane` attribute written\nby `#applyPane` and READ by the sheet against the holder\'s own inline-size — which keeps cl.3\'s\n"never a JS layout decision" promise more literally than the attribute model did, since no resize\nwrites anything at all. Dropping the attribute is load-bearing, not incidental: a region that paints\nin the triple must not simultaneously claim to be hidden, and `display:none` removes a non-painting\nregion from the a11y tree exactly as `hidden` did.\n\n**The line: 52.5rem, measured, and the only one available.** `SHELL_COMPACT_BREAKPOINT`\n(ADR-0150/0155) — the band ladder\'s own second line, which is precisely the escalation seam the LLD\n§6 booked for this case ("a named drill-band seam citing `SHELL_COMPACT_BREAKPOINT` … never a third\nnumber"). It is where it is by constraint, not by taste: the master-detail needs 40rem of its own\ncontainer or it drills in and the "triple" silently degrades to a pair, so the Chat column gets the\nremainder, and 52.5rem is the first named line where that remainder still clears the engagement\nfloor. At the line, measured identically in Chromium and WebKit (holder 840px):\n\n| region | box | content | floor (20ch) | margin |\n|---|---|---|---|---|\n| chat | 200px | 198px | 160px | 1.24× (composer 174px, 1.09× — the binding constraint) |\n| author | 320px | 296px | 160px | 1.85× |\n| settings | 320px | 296px | 160px | 1.85× (name field 270px) |\n\nAbove ~61rem the pair stops being floored and the three columns equalise (at a 1176px holder: 393 /\n391 / 391). The floor holds at the line and everywhere above it, so this is BANDING — pair below,\ntriple at and above — not a cram, and no escalation is owed.\n\n**cl.2\'s selector re-keys to ORIGIN — a correctness requirement the triple forced, flagged for Kim as\nthe one contract-touching finding in this slice.** cl.2 ruled that "pane identity replaces `#mode` as\n`#contextFor()`\'s selector". Below the triple line that is sound, because exactly one place paints and\nso "the active place" and "the composer the user can reach" are the same thing. At the triple line they\ncome apart: both composers are on screen and typable at once. Under pane-keying, a turn typed into\nCHAT\'s composer while the nav stood on Author resolved the AUTHORING quadruple — landing in the\ninterview transcript and, gate ON, patching the draft. That is the precise thing cl.4 promises cannot\nhappen ("Chat stays pure test holds by construction, not by policy"), and it was reproduced as a\nnegative control before the fix: the probe fails with `expected \'Concierge\' to be \'Untitled agent\'`\nunder the shipped selector.\n\nThe amended reading: `#contextFor()` is keyed by the **submitting composer\'s origin**. This is cl.4\'s\nown property, not a new one — per-pane composers mean each composer IS a context, permanently, at\nevery band; pane identity was only ever a proxy for it. Consequences:\n\n- **The fence is byte-untouched.** It keys off driving-store identity, never the selector. Origin\n  STRENGTHENS it: the Chat composer cannot resolve `authoringStore` under any pane, band or timing.\n- **cl.2\'s survive list is untouched.** Both conversations, the per-context histories, the session map,\n  the gate conjunct, the GH #145 resets, the apply chain, the Builder persona — all byte-identical.\n- **A named hazard closes for free.** The LLD §8 mid-defer pane-flip misroute (a deferred client turn\n  reading `#contextFor()` at RUN time and routing to whatever place the user had since walked to) is\n  gone: the deferred turn now carries the origin it was spawned from.\n- **`#pane` becomes purely navigational** — it says which place the nav names and nothing else.\n- `origin` is a separate parameter, deliberately never a member of the runner\'s `turn` wire shape\n  (SPEC-N1): which composer a turn came from is this element\'s routing business, not the runner\'s.\n\n**No painted dividers between docked regions** (Kim, GH #662 Findings 2026-08-10). The split\nseparator\'s resting rule unpaints via a token repoint (`--ui-split-divider-ink: transparent` on the\nadmin\'s own splits) — the retract-don\'t-delete pattern: the separator element, its ≥24px hit-slop,\n`role=separator`, tabindex, keyboard step and drag survive untouched, and the hover/drag cue is\ndeliberately LEFT PAINTED so the handle still answers a reach for it. Only the resting ink goes. The\nrepoint must land on the `ui-split` elements themselves — `split.css` declares the token in its own\n`:where(ui-split)` block, and a locally-declared custom property beats an inherited one regardless of\nancestor specificity. Its descendant reach is intended: it covers the triple\'s separators AND the one\ninside `ui-settings`\'s nested rail|panel, so the law holds everywhere in this surface.\n\n**The pane-nav persists at wide** (the slice\'s measured call, Kim-visible). It stays painted and\nmechanically unchanged at every band. Hiding it above the line was the alternative: it buys back one\nheader strip and removes a click that repaints nothing once all three places are already on screen.\nRejected because a resize would then ADD AND REMOVE the surface\'s primary navigation — the worst\ndiscontinuity on offer — and because the nav still does real work at wide: it is the sole vehicle\nbelow the line, and its selection is what a wide→narrow crossing lands on. Deliberately NOT given\nfocus-move mechanics on activation: `ui-tabs` may activate on arrow traversal, so a tab that yanked\nfocus into its region would fight keyboard navigation. If Kim prefers it hidden above the line, that\nis a CSS-only change in this file.\n\n**Alternative considered and rejected: a three-pane split vehicle.** Composing `ui-split` directly with\nthree panes (or widening `ui-master-detail` to a third position) would give a single uniform\narrangement instead of a flex row wrapping a nested master-detail. Rejected: it mints an MD API change\nthis family\'s Non-goals fence off (LLD §10), it discards the narrow drill-in that composing the shipped\nelement buys for free, and the nested reading is what makes the pair band and the triple band the same\nDOM with two sheet readings rather than two arrangements to keep in sync.\n\n**If Kim rules against this**, the fallback is exact: the band rule and the flex row revert (the holder\nreturns to a column with `data-pane` still driving one-place-at-a-time), and cl.1\'s disjoint reading\nstands unchanged. The ORIGIN re-keying should NOT revert with it — it is a defect fix that happens to\nhave been found by the triple, and the pane-keyed selector is unsound the moment two composers can\nshare a screen. The divider unpaint is likewise independent of the arrangement.\n'
)

# ADR-0170's REAL amendment section, copied verbatim, still **proposed** as of this build — GH
# #664's own named second live consumer. Used ONLY as a dry-run fixture below; this test suite
# never ratifies it (Kim ratifies, not a build).
ADR_0170_AMENDMENT_SECTION = (
'## Amendment (2026-08-07, **proposed** — Kim ratifies) — cl.6\'s read-only catalog mirror RETIRES: the GH [#541](https://github.com/kimgranlund/agent-ui/issues/541) Surface Options nesting supplies the at-a-glance context structurally\n\n> Append-only, and **proposed**: the Status cell reads `accepted` for the record as a whole and stays\n> byte-untouched — agents never flip status (`.claude/hooks/adr-status-guard.py`), and this amendment\n> carries no ratification of its own until Kim gives one. Every accepted section above is unedited.\n> What this amendment re-rules is exactly **one sentence of cl.6** — "In its place the row shows the\n> active catalog\'s LABEL as read-only trailing text, re-derived in `#applyMasterStates` … so the\n> at-a-glance context beside the A2UI toggle survives". cl.6\'s OTHER two sentences — the bare\n> `ui-select` retires, and keeping it as a second writer is REJECTED — **stand unchanged**, as does\n> the one-writer rule they exist to protect and every other clause (cl.1–5, cl.7, cl.8). The build\n> that carries this amendment is GH [#541](https://github.com/kimgranlund/agent-ui/issues/541) /\n> PR [#550](https://github.com/kimgranlund/agent-ui/pull/550).\n\n**Why the mirror goes.** cl.6 minted the mirror in a layout where it was the ONLY catalog context on\nthe A2UI row: at ratification the picker still lived in a separate "Catalogs" fold far below the\nmodality it configures, so a trailing label was the one thing that answered "which catalog is this\nsurface running?" without scrolling. GH [#488](https://github.com/kimgranlund/agent-ui/issues/488)\nthen moved the picker directly beneath the A2UI row, and GH #541 nests it INSIDE that row\'s own\ndetail zone. The active catalog\'s card now sits one line below the toggle, carrying that identical\nlabel — so the mirror projects a fact the surface already states, adjacently. A `break-down-layout`\ndecomposition of the shipped panel (logged on GH #541) scored this **B5=3, "Default (agent-ui)"\nprojected twice adjacently**, and named the removal as part of the corrective.\n\n**The amended reading of cl.6.** The bare `<select>` retires (unchanged). In its place the row shows\n**nothing** in its trailing slot: the at-a-glance context beside the A2UI toggle is supplied\nSTRUCTURALLY, by the Catalogs section nested directly under the row, rather than by a text mirror of\nit. cl.6\'s rationale is therefore satisfied, not abandoned — the same requirement, met by\ncontainment instead of duplication.\n\n**What changes in the tree** (GH #541\'s build, `packages/agent-ui/app/src/controls/agent-admin/`):\nthe `surface-catalog` span, the `#surfaceCatalogMirror` field, and its `#applyMasterStates`\nre-derivation block are removed; `agent-admin.md` drops the `surface-catalog` part. Nothing else\ncl.6 governs moves — `sanitizeCatalog`, `A2UI_CATALOG_KEY`\'s vocabulary, the Catalogs section\'s\nsole-writer status, and the produce POST body\'s `catalogId` are byte-identical across this change\n(the Non-goals\' standing promise holds).\n\n**The dim goes with it, deliberately.** cl.5\'s `data-kind-disabled` dim on the Catalogs section\nalready expresses "this modality can\'t run" on the very element the mirror\'s own `[data-disabled]`\nwas shadowing — one signal, on the thing being configured, instead of two. The probes that asserted\nthe mirror\'s dim now assert the section\'s, unchanged in intent.\n\n**Alternative considered and rejected: keep the slot, empty it.** Leaving `surface-catalog` in place\nwith no text preserves the part name for a future consumer, but it ships a permanently blank\ntrailing span whose only remaining behavior is a dim no one can see — dead anatomy the descriptor\nwould still have to document truthfully. If a future layout un-nests the picker, re-minting the\nmirror is a smaller change than carrying an empty one until then.\n\n**If Kim rules against this**, the fallback is exact and cheap: restore the span, the field, and the\n`#applyMasterStates` block (one commit\'s revert), and the nesting from GH #541 stands without it —\nthe two changes are independent, and only the duplication argument ties them together.\n'
)


def _amendment_fixture(amendment_section: str, status: str = "accepted") -> str:
    """Wrap an Amendment section (real or synthetic) in the minimum ADR shape the parser reads."""
    return (
        "# ADR-9999 — a fixture\n\n"
        "> | | |\n"
        "> |---|---|\n"
        f"> | **Status** | {status} |\n"
        "> | **Date** | 2026-08-07 |\n"
        "> | **Proposed by** | a seat |\n"
        "> | **Ratified by** | someone, 2026-08-07, via an utterance |\n"
        "> | **Repairs** | none — a fixture |\n"
        "> | **Supersedes / Superseded by** | none |\n\n"
        "## Context\n\nSome context the amendment re-rules.\n\n"
        f"{amendment_section}"
    )


class AmendmentBodyAndRepairs(unittest.TestCase):
    """Pure-function coverage for the amendment path's own text-scanning (GH #664)."""

    def test_amendment_body_stops_at_the_next_heading(self) -> None:
        text = (
            "## Amendment (2026-08-01, **proposed** — Kim ratifies) — a re-ruling\n\n"
            "> Some blockquote line.\n\nSome prose that belongs to the amendment.\n\n"
            "## Consequences\n\nThis belongs to a LATER section and must not be included.\n"
        )
        m = AMENDMENT_HEADER_RE.search(text)
        self.assertIsNotNone(m)
        body = amendment_body(text, m)
        self.assertIn("Some prose that belongs to the amendment.", body)
        self.assertNotIn("LATER section", body)

    def test_amendment_body_runs_to_eof_when_no_later_heading(self) -> None:
        text = (
            "## Amendment (2026-08-01, **proposed** — Kim ratifies) — a re-ruling\n\n"
            "Prose to the end of the file, no further heading.\n"
        )
        m = AMENDMENT_HEADER_RE.search(text)
        body = amendment_body(text, m)
        self.assertIn("Prose to the end of the file", body)

    def test_no_repairs_label_yields_nothing(self) -> None:
        self.assertEqual(amendment_booked_repairs("Plain prose, no label at all."), [])

    def test_repairs_label_with_no_bullets_yields_nothing(self) -> None:
        self.assertEqual(amendment_booked_repairs("**Repairs**: none owed by this amendment."), [])

    def test_repairs_labelled_list_yields_its_items_verbatim(self) -> None:
        body = (
            "Some prose ahead of the label, never an item.\n\n"
            "**Repairs**\n\n"
            "- `foo.ts` gains a new export\n"
            "- `bar.md` restates the note\n\n"
            "Prose after the list, past the blank line, is not an item either.\n"
        )
        items = amendment_booked_repairs(body)
        self.assertEqual(items, ["`foo.ts` gains a new export", "`bar.md` restates the note"])

    def test_a_colon_after_the_label_is_tolerated(self) -> None:
        self.assertEqual(amendment_booked_repairs("**Repairs**:\n- one item\n"), ["one item"])

    def test_neither_real_amendment_books_anything(self) -> None:
        # ADR-0179's and ADR-0170's real amendments (above) both carry ordinary prose about repairs
        # already booked in the header table, never a **Repairs**-labelled bullet list of their own
        # — so the tool correctly SKIPS filing for both of the two real, live consumers (GH #664's
        # documented default: "never fabricate one").
        self.assertEqual(amendment_booked_repairs(ADR_0179_PREFLIP_AMENDMENT_SECTION), [])
        self.assertEqual(amendment_booked_repairs(ADR_0170_AMENDMENT_SECTION), [])


class AmendmentIssueBodies(unittest.TestCase):
    """Pure composer coverage for the amendment tracking-issue title/body (GH #664)."""

    ITEMS = ["`foo.ts` gains a new export", "`bar.md` restates the note"]

    def test_amendment_issue_title_is_the_fixed_template(self) -> None:
        self.assertEqual(
            amendment_issue_title("0170"), "ADR-0170 Amendment: execute the booked repairs"
        )

    def test_amendment_issue_body_quotes_every_item_verbatim(self) -> None:
        body = amendment_issue_body(
            "0170", ".claude/docs/adr/0170-x.md", "cl.6's mirror retires",
            "https://u", "2026-08-07", self.ITEMS,
        )
        for item in self.ITEMS:
            self.assertIn(f"- [ ] {item}", body)
        self.assertIn("ADR-0170", body)
        self.assertIn("cl.6's mirror retires", body)
        self.assertIn("https://u", body)
        self.assertIn("2026-08-07", body)
        self.assertIn("GH #664", body)
        self.assertIn("stays OPEN", body)


class _AmendmentFixtureMixin:
    """Shared harness for the amendment-mode `main()` tests (GH #664): a fresh temp ADR corpus per
    call, `main()` run for real with `subprocess` faked — no gh/git/node in earshot.
    """

    def _fixture_root(self, amendment_section: str, status: str = "accepted"):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        adr_dir = root / ".claude" / "docs" / "adr"
        adr_dir.mkdir(parents=True)
        (adr_dir / "9999-fixture.md").write_text(
            _amendment_fixture(amendment_section, status=status), encoding="utf-8"
        )
        return root, adr_dir

    def _flip(
        self,
        root: Path,
        comment_body: str,
        url: str = UTTERANCE_URL,
        dry_run: bool = False,
        comment_date: str = "2026-08-07T10:00:00Z",
        issue_ok: bool = True,
    ):
        fake = FakeSubprocess(root, issue_ok=issue_ok, comment_body=comment_body, comment_date=comment_date)
        real_subprocess, real_argv = adr_ratify.subprocess, sys.argv
        adr_ratify.subprocess = fake
        argv = ["adr_ratify.py", "ADR-9999", url]
        if dry_run:
            argv.append("--dry-run")
        sys.argv = argv
        out = io.StringIO()
        code = None
        raised: SystemExit | None = None
        try:
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
                try:
                    code = adr_ratify.main()
                except SystemExit as exc:
                    raised = exc
        finally:
            adr_ratify.subprocess, sys.argv = real_subprocess, real_argv
        return code, raised, out.getvalue(), fake


class AmendmentFlipPath(_AmendmentFixtureMixin, unittest.TestCase):
    """The amendment path's whole-`main()` coverage (GH #664) over a synthetic single-candidate
    fixture — the shape neither real ADR-0179 nor ADR-0170 differs from structurally.
    """

    SIMPLE_AMENDMENT = (
        "## Amendment (2026-08-01, **proposed** — Kim ratifies) — a re-ruling of cl.1\n\n"
        "> Append-only, and **proposed**: the Status cell reads `accepted` for the record as a "
        "whole and stays byte-untouched.\n\nSome prose, no Repairs list here.\n"
    )

    def test_flips_only_the_header_status_and_everything_else_untouched(self) -> None:
        root, adr_dir = self._fixture_root(self.SIMPLE_AMENDMENT)
        original = (adr_dir / "9999-fixture.md").read_text(encoding="utf-8")
        code, raised, stdout, fake = self._flip(root, "ratify ADR-9999 amendment")
        self.assertIsNone(raised, stdout)
        self.assertEqual(code, 0, stdout)

        new_text = (adr_dir / "9999-fixture.md").read_text(encoding="utf-8")
        self.assertIn("> | **Status** | accepted |", new_text)  # untouched
        new_header = (
            "## Amendment (2026-08-01, **ratified** — OWNER, "
            f"[utterance]({UTTERANCE_URL}), verified 2026-08-07) — a re-ruling of cl.1"
        )
        self.assertIn(new_header, new_text)
        # nothing else in the file moved — the header line is the ONLY diff
        expected = original.replace(
            "## Amendment (2026-08-01, **proposed** — Kim ratifies) — a re-ruling of cl.1",
            new_header,
        )
        self.assertEqual(new_text, expected)
        # no index file is created in the ADR folder (Kim's no-index-file rule, 2026-08-13)
        self.assertFalse((adr_dir / "README.md").exists())
        # no repairs booked -> no gh issues/comments calls at all
        self.assertEqual(fake.called("repos/OWNER/REPO/issues --input -"), 0)
        self.assertEqual(fake.called("repos/OWNER/REPO/issues/38/comments --input -"), 0)

    def test_dry_run_writes_nothing(self) -> None:
        root, adr_dir = self._fixture_root(self.SIMPLE_AMENDMENT)
        original = (adr_dir / "9999-fixture.md").read_text(encoding="utf-8")
        code, raised, stdout, fake = self._flip(root, "ratify ADR-9999 amendment", dry_run=True)
        self.assertIsNone(raised, stdout)
        self.assertEqual(code, 0, stdout)
        self.assertIn("DRY-RUN", stdout)
        self.assertIn("nothing to track", stdout)
        self.assertEqual((adr_dir / "9999-fixture.md").read_text(encoding="utf-8"), original)
        self.assertEqual(fake.called("repos/OWNER/REPO/issues --input -"), 0)


class AmendmentRepairsFilingPath(_AmendmentFixtureMixin, unittest.TestCase):
    """An amendment that DOES book repairs of its own — the opt-in filing path (GH #664
    Scope/Open: file booked-repairs artifacts only when the amendment's own text carries a
    Repairs-shaped list; neither real live consumer does, so this fixture is synthetic).
    """

    WITH_REPAIRS = (
        "## Amendment (2026-08-01, **proposed** — Kim ratifies) — a re-ruling that books repairs\n\n"
        "> Append-only, and **proposed**: boilerplate.\n\nSome prose explaining the re-ruling.\n\n"
        "**Repairs**\n\n"
        "- `foo.ts` gains a new export\n"
        "- `bar.md` restates the note\n"
    )

    def test_files_an_open_tracking_issue_and_posts_the_checklist_comment(self) -> None:
        root, adr_dir = self._fixture_root(self.WITH_REPAIRS)
        code, raised, stdout, fake = self._flip(root, "ratify ADR-9999 amendment")
        self.assertIsNone(raised, stdout)
        self.assertEqual(code, 0, stdout)

        issue = fake.payload("repos/OWNER/REPO/issues --input -")
        self.assertEqual(issue["title"], "ADR-9999 Amendment: execute the booked repairs")
        self.assertIn("- [ ] `foo.ts` gains a new export", issue["body"])
        self.assertIn("- [ ] `bar.md` restates the note", issue["body"])
        self.assertIn("`proposed` \u2192 `ratified`", issue["body"])
        self.assertIn("GH #664", issue["body"])

        comment = fake.payload("repos/OWNER/REPO/issues/38/comments --input -")
        self.assertIn("Tracked in #601", comment["body"])
        self.assertIn("ADR-9999 Amendment", comment["body"])
        self.assertIn("- [ ] `foo.ts` gains a new export", comment["body"])
        self.assertIn("filed:  booked-repairs tracking issue OWNER/REPO#601", stdout)

    def test_a_failed_filing_still_exits_zero_and_the_comment_says_so(self) -> None:
        root, adr_dir = self._fixture_root(self.WITH_REPAIRS)
        code, raised, stdout, fake = self._flip(root, "ratify ADR-9999 amendment", issue_ok=False)
        self.assertIsNone(raised, stdout)
        self.assertEqual(code, 0, stdout)
        comment = fake.payload("repos/OWNER/REPO/issues/38/comments --input -")
        self.assertIn("No tracking issue was filed", comment["body"])
        self.assertNotIn("Tracked in", comment["body"])


class AmendmentNegativeControls(_AmendmentFixtureMixin, unittest.TestCase):
    """Fail-closed coverage for the amendment path (GH #664) — mirrors the whole-ADR flip's own
    fail-closed discipline: zero or multiple candidates, an utterance that doesn't select this
    mode, and a mis-targeted utterance all refuse before any write.
    """

    ALREADY_RATIFIED = (
        "## Amendment (2026-08-01, **ratified** — someone, [utterance](https://x), "
        "verified 2026-08-01) — already done\n\nNothing left to ratify here.\n"
    )
    TWO_PROPOSED = (
        "## Amendment (2026-08-01, **proposed** — Kim ratifies) — first re-ruling\n\nProse one.\n\n"
        "## Amendment (2026-08-02, **proposed** — Kim ratifies) — second re-ruling\n\nProse two.\n"
    )
    ONE_PROPOSED = AmendmentFlipPath.SIMPLE_AMENDMENT

    def test_an_already_ratified_amendment_yields_zero_candidates(self) -> None:
        root, adr_dir = self._fixture_root(self.ALREADY_RATIFIED)
        original = (adr_dir / "9999-fixture.md").read_text(encoding="utf-8")
        code, raised, stdout, fake = self._flip(root, "ratify ADR-9999 amendment")
        self.assertIsNotNone(raised)
        self.assertIn("carries 0 ", str(raised.code))
        self.assertEqual((adr_dir / "9999-fixture.md").read_text(encoding="utf-8"), original)
        self.assertEqual(fake.called("repos/OWNER/REPO/issues --input -"), 0)

    def test_two_proposed_amendments_refuse_to_guess(self) -> None:
        root, adr_dir = self._fixture_root(self.TWO_PROPOSED)
        original = (adr_dir / "9999-fixture.md").read_text(encoding="utf-8")
        code, raised, stdout, fake = self._flip(root, "ratify ADR-9999 amendment")
        self.assertIsNotNone(raised)
        self.assertIn("carries 2 ", str(raised.code))
        self.assertEqual((adr_dir / "9999-fixture.md").read_text(encoding="utf-8"), original)

    def test_a_comment_missing_the_amendment_word_routes_to_the_whole_adr_path_and_still_refuses(self) -> None:
        # "ratify ADR-9999" (no "amendment") on a target whose Status is already accepted — the
        # utterance names the right ADR but the wrong CONTRACT: the whole-ADR path's own Status
        # check correctly refuses (nothing `proposed` for it to flip), never silently ratifying the
        # wrong artifact just because the id matched.
        root, adr_dir = self._fixture_root(self.ONE_PROPOSED)  # Status: accepted (fixture default)
        original = (adr_dir / "9999-fixture.md").read_text(encoding="utf-8")
        code, raised, stdout, fake = self._flip(root, "ratify ADR-9999")
        self.assertIsNotNone(raised)
        self.assertIn("does not carry exactly one `proposed` Status row", str(raised.code))
        self.assertEqual((adr_dir / "9999-fixture.md").read_text(encoding="utf-8"), original)

    def test_a_comment_naming_a_different_adr_fails_closed(self) -> None:
        root, adr_dir = self._fixture_root(self.ONE_PROPOSED)
        original = (adr_dir / "9999-fixture.md").read_text(encoding="utf-8")
        code, raised, stdout, fake = self._flip(root, "ratify ADR-1234 amendment")
        self.assertIsNotNone(raised)
        self.assertIn("not ADR-9999", str(raised.code))
        self.assertEqual((adr_dir / "9999-fixture.md").read_text(encoding="utf-8"), original)


class AmendmentRealFixtureFlip(_AmendmentFixtureMixin, unittest.TestCase):
    """Runs the real `main()` over ADR-0179's REAL pre-flip amendment text and proves the produced
    header matches the hand flip that already happened (commit 34be0f87), modulo one deliberate,
    documented substitution: the hand flip wrote the human display name "Kim"; this mechanical path
    writes the verified GitHub login instead (this module's docstring records the choice) — every
    other byte of the header, and every other byte of the file, must be identical.
    """

    def test_the_flip_reproduces_the_real_hand_flip_modulo_the_author_name(self) -> None:
        root, adr_dir = self._fixture_root(ADR_0179_PREFLIP_AMENDMENT_SECTION)
        original = (adr_dir / "9999-fixture.md").read_text(encoding="utf-8")

        real_path = Path(__file__).resolve().parent.parent / ".claude" / "docs" / "adr" / "0179-agent-admin-three-pane-ia.md"
        if not real_path.is_file():
            self.skipTest("no ADR corpus checkout to cross-check against")
        real_text = real_path.read_text(encoding="utf-8")
        real_header = next(line for line in real_text.splitlines() if line.startswith("## Amendment"))
        # the fixture's fake remote is OWNER/REPO and its fake utterance URL keeps the real issue
        # + comment ids for realism but under that fake remote — both substitutions are mechanical,
        # never a hand-edit of the wording itself.
        expected_header = (
            real_header
            .replace(
                "https://github.com/kimgranlund/agent-ui/issues/662#issuecomment-5235141210",
                "https://github.com/OWNER/REPO/issues/662#issuecomment-77",
            )
            .replace("**ratified** — Kim,", "**ratified** — OWNER,")
        )
        self.assertNotEqual(expected_header, real_header)  # the substitution actually did something

        code, raised, stdout, fake = self._flip(
            root, "ratify ADR-9999 amendment",
            url="https://github.com/OWNER/REPO/issues/662#issuecomment-77",
            comment_date="2026-08-10T02:11:36Z",  # the real utterance's real timestamp
        )
        self.assertIsNone(raised, stdout)
        self.assertEqual(code, 0, stdout)

        new_text = (adr_dir / "9999-fixture.md").read_text(encoding="utf-8")
        produced_header = next(line for line in new_text.splitlines() if line.startswith("## Amendment"))
        self.assertEqual(produced_header, expected_header)

        old_header_line = ADR_0179_PREFLIP_AMENDMENT_SECTION.splitlines()[0]
        expected_new_text = original.replace(old_header_line, expected_header, 1)
        self.assertEqual(new_text, expected_new_text)  # nothing else in the file moved
        self.assertEqual(fake.called("repos/OWNER/REPO/issues --input -"), 0)  # neither real amendment books anything


class AmendmentDryRunOnRealAdr0170(_AmendmentFixtureMixin, unittest.TestCase):
    """ADR-0170's real amendment — GH #664's own named second live consumer, still **proposed** —
    proves the tool is READY to ratify it without actually doing so (Kim ratifies, not a build).
    """

    def test_dry_run_detects_the_one_candidate_and_would_flip_it(self) -> None:
        root, adr_dir = self._fixture_root(ADR_0170_AMENDMENT_SECTION)
        original = (adr_dir / "9999-fixture.md").read_text(encoding="utf-8")
        code, raised, stdout, fake = self._flip(root, "ratify ADR-9999 amendment", dry_run=True)
        self.assertIsNone(raised, stdout)
        self.assertEqual(code, 0, stdout)
        self.assertIn("DRY-RUN", stdout)
        self.assertIn("cl.6's read-only catalog mirror RETIRES", stdout)
        self.assertIn("nothing to track", stdout)
        self.assertEqual((adr_dir / "9999-fixture.md").read_text(encoding="utf-8"), original)
        self.assertEqual(fake.called("repos/OWNER/REPO/issues --input -"), 0)



if __name__ == "__main__":
    unittest.main()
