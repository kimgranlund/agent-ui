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

from adr_ratify import booked_repairs  # noqa: E402

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

# ADR-0028's real cell — no booking at all, but three code-span `(` glyphs leave its raw paren
# count +3. Proof that paren balancing must read code spans as opaque atoms.
ADR_0028_CELL = (
    "`a2ui-runtime SPEC-R10` (the `${…}` clause gains the function-expression form — the `(`-"
    "bearing expression resolves, no longer renders literally) · `a2ui-renderer LLD-C10 §7` (the "
    "`${…}` interpolator's classifier `(`-branch parses → `FunctionCall` → `evaluate`; the "
    'function-expression arm moves from "deferred" to "delivered") · **NEW** `a2ui/renderer/fn-'
    "expr.ts` (the function-expression tokenizer/parser)"
)

# ADR-0087's real cell — a books-nothing record.
ADR_0087_CELL = (
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
        self.assertEqual(booked_repairs(cell_to_adr(ADR_0087_CELL)), [])

    def test_0164_real_cell_keeps_its_nested_file_list_whole(self) -> None:
        items = booked_repairs(cell_to_adr(ADR_0164_CELL))
        self.assertEqual(len(items), 1, items)
        item = items[0]
        self.assertTrue(item.startswith("**On ratification+build**"), item)
        # the ` · `s inside the `(new — …)` file list are nested, so the item runs to its close
        self.assertTrue(item.endswith("a standalone mount smoke test)"), item)
        self.assertIn("`entry-data.ts`, the generic core split out of `entries.ts`", item)
        self.assertIn(item, ADR_0164_CELL)  # verbatim

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


if __name__ == "__main__":
    unittest.main()
