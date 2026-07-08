// a2ui-gallery.ts — the A2UI COMPOSITION GALLERY page. A scalable gallery whose members are DERIVED from
// the example-seed shelf (`allSeeds`, ADR-0055) — one card per seed, NEVER hand-listed — each rendering a
// LIVE mini-surface through the REAL @agent-ui/a2ui renderer. Companion to /a2ui-patterns.html: that page
// is the small hand-annotated 5-pattern tour (payload beside surface, deep pedagogy); THIS page is the
// broad composition gallery that grows with the shelf. A future seed added to the shelf appears here with
// zero edits to this file (the load-bearing property, pinned by lib/a2ui-gallery.test.ts).
//
// Follows the page convention exactly: `_page.ts` FIRST (the load-bearing foundation CSS cascade + self-
// defining ui-* controls, ADR-0003), then the derivation lib. An MPA entry auto-discovered by
// vite.config.ts's site/**/*.html glob (matches the nav link ./a2ui-gallery.html) — no config edit.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import { buildSeedGallery } from '../lib/a2ui-gallery.ts' // the shelf-derived card grid (+ its page-local CSS)

const { content } = mountPage({ title: 'A2UI gallery' })
content.append(
  pageLead(
    'Every composition on the A2UI example-seed shelf, rendered live through the same @agent-ui/a2ui ' +
      'renderer the canvas and patterns pages use — one card per seed, each showing the surface it produces ' +
      'alongside a disclosure of the exact JSON payload the agent sends. The member list is derived from the ' +
      'shelf itself, so a new seed appears here automatically. For the deep, hand-annotated tour of five ' +
      'representative patterns, see A2UI Patterns.',
  ),
  buildSeedGallery().root,
)
