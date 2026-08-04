#!/usr/bin/env python3
"""Unit test for adr_ratify.py's Repairs-cell parser.

The repo carries no python test runner, so this is stdlib `unittest`, run directly:

    python3 scripts/adr_ratify_test.py

Scope is the PURE parser only (`booked_repairs`) — no `gh`, no network, no file writes.
"""
from __future__ import annotations

import unittest
from pathlib import Path

import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from adr_ratify import REPAIRS_ROW_RE, booked_repairs  # noqa: E402

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


if __name__ == "__main__":
    unittest.main()
