#!/usr/bin/env node
// Vendors a curated Phosphor `regular`-weight SVG subset into a committed, inert TS data file
// (ADR-0066). Reads from the `@phosphor-icons/core` devDependency only — never shipped at runtime.

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// The curation list — the ONE place to edit to add/remove a vendored icon (ADR-0066 clause 2).
// Keyed by the canonical `IconName`; value is the Phosphor `regular` asset basename (identity for
// all nine today — Phosphor's own names match). Order here fixes the deterministic emit order.
const NAME_MAP = {
  'caret-down': 'caret-down',
  'caret-up': 'caret-up',
  'caret-left': 'caret-left',
  'caret-right': 'caret-right',
  x: 'x',
  eye: 'eye',
  'eye-slash': 'eye-slash',
  'calendar-blank': 'calendar-blank',
  check: 'check',
  'arrow-right': 'arrow-right',
  'magnifying-glass': 'magnifying-glass',
  user: 'user',
  file: 'file',
  'file-image': 'file-image',
  'file-audio': 'file-audio',
  'file-video': 'file-video',
  'file-pdf': 'file-pdf',
  'file-text': 'file-text',
  'file-zip': 'file-zip',
  'file-code': 'file-code',
  plus: 'plus',
  minus: 'minus', // GH #1406 — ui-text-field's side-by-side − + stepper pair (identity: Phosphor's own name matches)
  'arrow-up': 'arrow-up',
  microphone: 'microphone',
  list: 'list', // ui-super-shell's header-hosted collapse toggle (M5, GH #83/#90)
  warning: 'warning',
  'circle-notch': 'circle-notch',
  'check-circle': 'check-circle',
  'x-circle': 'x-circle',
  clock: 'clock', // GH #147 / ADR-0153 — the group-level "Planned"/all-pending marker
  'dots-three': 'dots-three', // GH #168 — the horizontal overflow/more-actions glyph (Phosphor has no `dots-three-horizontal`; `dots-three` IS the horizontal one)
  'circle-half': 'circle-half', // GH #170/ADR-0155 narrow-header rework — the scheme-cycle icon-only chip
  palette: 'palette', // GH #170/ADR-0155 narrow-header rework — the theme-picker icon-only chip
  // ADR-0169 cl.9b — the a2ui-basic Icon row's `ICON_NAME_TABLE` regeneration (identity for all 44;
  // Phosphor's own names match every canonical name below, verified against @phosphor-icons/core 2.1.1).
  'user-circle': 'user-circle',
  'arrow-left': 'arrow-left',
  paperclip: 'paperclip',
  phone: 'phone',
  camera: 'camera',
  trash: 'trash',
  'download-simple': 'download-simple',
  'pencil-simple': 'pencil-simple',
  'calendar-check': 'calendar-check',
  'fast-forward': 'fast-forward',
  heart: 'heart',
  'heart-break': 'heart-break',
  folder: 'folder',
  question: 'question',
  house: 'house',
  info: 'info',
  'map-pin': 'map-pin',
  'lock-simple': 'lock-simple',
  'lock-simple-open': 'lock-simple-open',
  'envelope-simple': 'envelope-simple',
  'dots-three-vertical': 'dots-three-vertical',
  'bell-slash': 'bell-slash',
  bell: 'bell',
  pause: 'pause',
  'credit-card': 'credit-card',
  image: 'image',
  play: 'play',
  printer: 'printer',
  'arrow-clockwise': 'arrow-clockwise',
  rewind: 'rewind',
  'paper-plane-right': 'paper-plane-right',
  gear: 'gear',
  'share-network': 'share-network',
  'shopping-cart': 'shopping-cart',
  'skip-forward': 'skip-forward',
  'skip-back': 'skip-back',
  star: 'star',
  'star-half': 'star-half',
  stop: 'stop',
  'upload-simple': 'upload-simple',
  'speaker-low': 'speaker-low',
  'speaker-slash': 'speaker-slash',
  'speaker-none': 'speaker-none',
  'speaker-high': 'speaker-high',
  // ADR-0179 GH #686 Amendment S7-a — ui-toggle's downstream consumer's Chat/Settings/Co-pilot icon set.
  'chats-circle': 'chats-circle',
  'gear-six': 'gear-six',
  robot: 'robot',
  // GH #868 — conversation-composer's models/effort trigger glyphs (identity: Phosphor's own names match).
  sparkle: 'sparkle',
  brain: 'brain',
  // GH #1258 — the weather glyph set (identity: Phosphor's own names match all eight, verified against
  // @phosphor-icons/core's regular assets). Unblocks the five-day-weather seed's condition Icon swap.
  sun: 'sun',
  cloud: 'cloud',
  'cloud-sun': 'cloud-sun',
  'cloud-rain': 'cloud-rain',
  snowflake: 'snowflake',
  lightning: 'lightning',
  wind: 'wind',
  'cloud-fog': 'cloud-fog',
  // GH #1485 — the amenity/hospitality glyph set (identity: all seven verified present against
  // @phosphor-icons/core 2.1.1's regular assets). `campfire` and `bathtub` are nearest-available
  // substitutes (Phosphor has no dedicated "fireplace" or "hot tub" glyph); `wifi-high` is the
  // full-signal variant chosen as the generic "has Wi-Fi" glyph.
  mountains: 'mountains',
  tree: 'tree',
  campfire: 'campfire',
  bathtub: 'bathtub',
  'swimming-pool': 'swimming-pool',
  'wifi-high': 'wifi-high',
  'paw-print': 'paw-print',
  // GH #1508 — /command-modal-demo's Actions group (Log out / Share file); identity with Phosphor's
  // own regular-weight names (both verified present against @phosphor-icons/core 2.1.1's regular
  // assets). `share` is the plain arrow-out-of-box glyph, distinct from the already-vendored
  // `share-network` (a2ui's node-graph share glyph, ADR-0169 cl.9b) — kept as two separate names since
  // consumers reach for them by different intent (a single recipient action vs. a network/broadcast one).
  'sign-out': 'sign-out',
  share: 'share',
}

const EXPECTED_VIEW_BOX = '0 0 256 256'
const OUT_PATH = fileURLToPath(new URL('../src/phosphor/icons.gen.ts', import.meta.url))

function extractBody(svg, canonicalName) {
  const viewBoxMatch = svg.match(/viewBox="([^"]*)"/)
  if (!viewBoxMatch || viewBoxMatch[1] !== EXPECTED_VIEW_BOX) {
    throw new Error(
      `vendor-phosphor: "${canonicalName}" has viewBox "${viewBoxMatch?.[1] ?? '(none)'}", expected "${EXPECTED_VIEW_BOX}"`,
    )
  }
  const bodyMatch = svg.match(/<svg\b[^>]*>([\s\S]*)<\/svg>\s*$/)
  if (!bodyMatch) throw new Error(`vendor-phosphor: could not extract an inner body for "${canonicalName}"`)
  // Strip fixed width/height/fill/stroke from the extracted body (ADR-0066 clause 3). None of the
  // curated nine carry these on inner elements today, but a future addition might.
  return bodyMatch[1].trim().replace(/\s(?:width|height|fill|stroke)="[^"]*"/g, '')
}

async function vendorIcon(canonicalName) {
  const phosphorName = NAME_MAP[canonicalName]
  const assetUrl = import.meta.resolve(`@phosphor-icons/core/regular/${phosphorName}.svg`)
  const svg = await readFile(fileURLToPath(assetUrl), 'utf8')
  return extractBody(svg, canonicalName)
}

async function main() {
  const names = Object.keys(NAME_MAP)
  const entries = []
  for (const name of names) entries.push([name, await vendorIcon(name)])

  const lines = entries.map(([name, body]) => `  '${name}': ${JSON.stringify(body)},`)
  const output = `// GENERATED by scripts/vendor-phosphor.mjs — DO NOT EDIT BY HAND (ADR-0066).
// Re-run \`node packages/agent-ui/icons/scripts/vendor-phosphor.mjs\` to regenerate.
import type { IconName } from '../types.ts'

export const phosphorIcons: Record<IconName, string> = {
${lines.join('\n')}
}
`
  await writeFile(OUT_PATH, output, 'utf8')
  console.log(`vendor-phosphor: wrote ${entries.length} icons to ${path.relative(process.cwd(), OUT_PATH)}`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
