// site/lib/controls-coverage.test.ts — the CONTROLS-TO-PAGES coverage trip-wire (GH #837, the 2026-08-13
// docs-gap sweep's own root cause). site-coverage.test.ts (packages/agent-ui/components/src/descriptor/)
// already proves every DESCRIPTOR has its tier-required page SET — but it only walks
// `packages/agent-ui/components/src/controls` (+ `.../components`), never `packages/agent-ui/app/src/
// controls`. That gap is exactly how `ui-workspace-shell`/`ui-surface-host`/`ui-conversation` shipped
// page-less for a whole wave undetected, AND it is exactly how `ui-toggle` shipped a real FOLDER with zero
// site pages at all: no gate walked BOTH control trees and asked "does this folder have ANY matching site
// page" — the crude, folder-level question a descriptor-level gate never asks (a folder can exist before
// it grows a descriptor at all).
//
// This gate is deliberately CRUDER than site-coverage.test.ts (folder-level existence, not per-descriptor
// per-tier completeness) and deliberately BROADER (both trees, not one) — the two are complementary, not a
// duplicate: this one is the fleet-wide backstop that would have caught every gap named above from day one;
// site-coverage.test.ts is still the finer-grained per-tier-page-type gate for the components tree alone.
//
// A folder counts as documented iff `site/{folder}.html` OR `site/{folder}-doc.html` exists — the two
// naming conventions the site's own pages actually use (components/src's `{tag}-doc.html` convention,
// ADR-0004; app/src's ungrouped-guide `{name}.html` convention, the chat-shell.html/super-shell.html
// precedent — surface-host-doc.html/conversation-doc.html show BOTH conventions coexist even within
// app/src, so the check accepts either form for either tree rather than hard-coding a per-tree rule).
import { describe, it, expect } from 'vitest'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (sitemap.test.ts precedent)
import { readdirSync } from 'node:fs'
declare const process: { cwd(): string }

const ROOT = process.cwd()

/** The two control trees this gate walks — components (the fleet) + app (shell/surface compositions). */
const CONTROL_TREES = [
  'packages/agent-ui/components/src/controls',
  'packages/agent-ui/app/src/controls',
] as const

/**
 * EXEMPT — folders that are genuinely NOT a standalone documentable control, each with its own one-line
 * reason (the docs-writer charter's "every exemption carries a one-line reason" law). Shrinks only if a
 * name here turns out to need real docs after all; grows only with a real, named reason — never a bare
 * catch-all.
 */
const EXEMPT: ReadonlyMap<string, string> = new Map([
  ['_base', 'shared Indicator/Listbox/Range base classes (UIIndicatorElement/UIListboxElement/UIRangeElement) — no tag of their own, extended by real controls only'],
  ['_surface', 'shared G9 container/container-box base classes — no tag of their own, extended by ui-card and siblings'],
  ['_token-surface', "shared token-surface base class (ui-swatch/ui-ramp/ui-ladder's common ancestor) — no tag of its own"],
  ['entry-list', 'a shared entry-rendering helper (entry-list.ts/entry-data.ts) — no customElements.define, no tag of its own; consumed by ui-settings/ui-agent-admin'],
  // ADR-0224/GH #1429 — service-card's TEMPORARY entry removed here: its docs-writer S2 slice landed
  // service-card-doc.html + service-card-demo.html (the site-coverage.test.ts KNOWN_UNDOCUMENTED / ui-image
  // GH #1189 precedent, same wave-split reasoning) — the folder is documented, no exemption needed.
  // GH #1515 — breadcrumb's TEMPORARY entry removed here too: its docs-writer S3 slice landed
  // breadcrumb-doc.html + breadcrumb-demo.html (the same ui-service-card/ADR-0224 precedent) — the folder
  // is documented, no exemption needed.
])
const EXEMPT_NAMES = new Set<string>(EXEMPT.keys())

/** Every real (non-test-file) folder name under `tree` — directories only, `readdirSync(withFileTypes)`
 *  already excludes the *.test.ts sibling FILES at this level (naming-gates.test.ts etc. are files, not
 *  folders) so no separate filter is needed for those. */
function controlFolders(tree: string): string[] {
  return (readdirSync(`${ROOT}/${tree}`, { withFileTypes: true }) as { name: string; isDirectory(): boolean }[])
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
}

/** True iff `folder` has a matching site page under either naming convention. Pure — the SAME predicate
 *  the negative control below drives with synthetic inputs. */
function hasMatchingPage(folder: string, siteHtml: ReadonlySet<string>): boolean {
  return siteHtml.has(`${folder}.html`) || siteHtml.has(`${folder}-doc.html`)
}

/** The folders genuinely lacking a matching page, minus the named exemptions — pure, so the negative
 *  control can drive it with synthetic inputs (the site-coverage.test.ts `missingPages` precedent). */
function undocumentedFolders(folders: readonly string[], siteHtml: ReadonlySet<string>, exempt: ReadonlySet<string>): string[] {
  return folders.filter((f) => !exempt.has(f) && !hasMatchingPage(f, siteHtml))
}

// ── the live site state ──────────────────────────────────────────────────────────────────────────────────
const SITE_HTML = new Set<string>(
  (readdirSync(`${ROOT}/site`, { withFileTypes: true }) as { name: string; isFile(): boolean }[])
    .filter((e) => e.isFile() && e.name.endsWith('.html'))
    .map((e) => e.name),
)

describe('controls-coverage — the folder inventory + the site HTML inventory are both real (anti-vacuous)', () => {
  it('found real control folders in both trees', () => {
    const componentsFolders = controlFolders(CONTROL_TREES[0])
    const appFolders = controlFolders(CONTROL_TREES[1])
    expect(componentsFolders.length).toBeGreaterThan(50) // the whole components fleet
    expect(appFolders.length).toBeGreaterThanOrEqual(10) // agent-admin/chat-shell/conversation/entry-list/master-detail/nav-rail/settings/super-shell/surface-host/workspace-shell
    expect(componentsFolders).toContain('button')
    expect(componentsFolders).toContain('toggle') // GH #832 — the exact folder that shipped page-less
    expect(appFolders).toContain('workspace-shell')
    expect(appFolders).toContain('surface-host')
    expect(appFolders).toContain('conversation')
  })

  it('found real site/*.html pages (an empty/broken scan cannot pass silently)', () => {
    expect(SITE_HTML.size).toBeGreaterThan(50)
    expect(SITE_HTML.has('button-doc.html')).toBe(true)
    expect(SITE_HTML.has('chat-shell.html')).toBe(true)
  })
})

describe('controls-coverage — every public control folder has a matching site page (minus the named exemptions)', () => {
  for (const tree of CONTROL_TREES) {
    const folders = controlFolders(tree)
    for (const folder of folders) {
      if (EXEMPT_NAMES.has(folder)) {
        it.skip(`${tree}/${folder} — SKIPPED (EXEMPT: ${EXEMPT.get(folder)})`, () => {})
        continue
      }
      it(`${tree}/${folder} has a matching site/${folder}.html OR site/${folder}-doc.html`, () => {
        expect(hasMatchingPage(folder, SITE_HTML), `expected site/${folder}.html or site/${folder}-doc.html to exist`).toBe(true)
      })
    }
  }

  it('every EXEMPT name is a REAL folder in one of the two trees (no stale exemption lingers)', () => {
    const allFolders = new Set([...controlFolders(CONTROL_TREES[0]), ...controlFolders(CONTROL_TREES[1])])
    for (const name of EXEMPT_NAMES) expect(allFolders.has(name), `EXEMPT name "${name}" is not a real control folder`).toBe(true)
  })
})

describe('controls-coverage — the check BITES (negative controls; pure predicates with synthetic inputs)', () => {
  it('flags a folder with NO matching page at all (the exact ui-toggle-before-GH#832 shape)', () => {
    expect(undocumentedFolders(['toggle'], new Set(), new Set())).toEqual(['toggle'])
  })

  it('accepts EITHER naming convention — {name}.html (app-tier guides) or {name}-doc.html (components-tier docs)', () => {
    expect(undocumentedFolders(['chat-shell'], new Set(['chat-shell.html']), new Set())).toEqual([])
    expect(undocumentedFolders(['button'], new Set(['button-doc.html']), new Set())).toEqual([])
  })

  it('honors the exemption set — an exempt folder is never flagged even with zero matching pages', () => {
    expect(undocumentedFolders(['_base'], new Set(), new Set(['_base']))).toEqual([])
  })

  it('a REAL page for a DIFFERENT folder does not satisfy this one (no accidental cross-match)', () => {
    expect(undocumentedFolders(['workspace-shell'], new Set(['chat-shell.html', 'super-shell.html']), new Set())).toEqual(['workspace-shell'])
  })
})
